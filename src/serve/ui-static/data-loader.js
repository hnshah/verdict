/*
 * Verdict TUI dashboard — data loader.
 *
 * Replaces the static mock `data.js` from the design prototype.
 * Reads server-injected `window.VERDICT_DATA_SSR` (set by handleUiIndex)
 * and shapes it into the structure each screen expects on `window.VERDICT_DATA`.
 *
 * Also exposes `window.verdictRefresh()` to re-fetch /ui/runs +
 * /ui/leaderboard at runtime and re-render the React tree.
 */

(function () {
  function toDisplay(ts) {
    // "2026-05-20T06:50:37.739Z" → "06:50"
    if (!ts) return "—";
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  }

  // The design colors each row with a "dot" color slot — assign deterministically
  // from a small palette so the home leaderboard is visually scannable.
  const DOT_PALETTE = ["grn", "cyn", "mag", "yel", "orng", "blu", "pnk", "good", "warn", "bad"];
  function dotFor(idx) { return DOT_PALETTE[idx % DOT_PALETTE.length]; }

  function shapeRuns(serverRuns) {
    // One row per run, showing the winning model — keeps run_id unique
    // (required by React keys) and matches the design's mock-data shape.
    return serverRuns.map(r => {
      const winnerRow = (r.models || [])[0] || {};
      return {
        id: r.run_id,
        run_id: r.run_id,
        date: toDisplay(r.run_at),
        run_at: r.run_at,
        model: r.winner || winnerRow.model_id || "—",
        pack: r.pack,
        cases: r.cases_run,
        score: r.winner_score || winnerRow.score || 0,
        cost: (r.models || []).reduce((s, m) => s + (m.cost_usd || 0), 0),
        ms: Math.round(winnerRow.latency_ms || 0),
        status: "ok",
        models_count: (r.models || []).length,
      };
    });
  }

  function shapeLeaderboard(rows) {
    // Server returns: model_id, provider, avg_score, runs, last_score, delta, trend[]
    return rows.map((r, i) => ({
      rank: i + 1,
      id: r.model_id,
      provider: r.provider || "unknown",
      score: Number(r.avg_score || 0),
      runs: r.runs || 0,
      last: Number(r.last_score || 0),
      delta: Number(r.delta || 0),
      trend: (r.trend || []).slice(-8),
      cost: Number(r.avg_cost_usd || 0),
      local: (r.provider === "ollama" || r.provider === "mlx" || r.provider === "lmstudio"),
      dot: dotFor(i),
      regression: r.delta != null && r.delta < -0.3,
    }));
  }

  // Server may not return some fields — normalise.
  function shapeConfigured(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => ({
      id: r.id || r.model_id,
      model: r.model || r.model_id,
      provider: r.provider || "unknown",
      base: r.base || "—",
      status: r.status || "ok",
      latency: Math.round(r.latency || r.avg_latency_ms || 0),
      avg_score: r.avg_score,
      notes: r.notes || "",
    }));
  }

  function shapeDiscovered(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => ({
      id: r.id,
      provider: r.provider,
      size: r.size || "—",
      host: r.host || "—",
    }));
  }

  function shapePacks(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => ({
      id: r.id,
      cases: r.cases || 0,
      judge: r.judge || "—",
      category: r.category || "—",
    }));
  }

  function shape(server) {
    const runs = shapeRuns(server.runs || []);
    const leaderboard = shapeLeaderboard(server.leaderboard || []);
    const configured = shapeConfigured(server.configured || []);
    const discovered = shapeDiscovered(server.discovered || []);
    const packs = shapePacks(server.packs || []);
    const cases = {};
    for (const [runId, list] of Object.entries(server.cases || {})) {
      cases[runId] = (list || []).map((c, i) => ({
        n: i + 1,
        cat: c.category || "—",
        prompt: (c.prompt || "").split("\n")[0].slice(0, 110),
        score: Number(c.score || 0),
        ok: Number(c.score || 0) >= 7,
        comment: c.response ? c.response.slice(0, 140) : "",
      }));
    }
    return {
      meta: server.meta || { version: "0.4.0", path: "~/.verdict" },
      models: leaderboard,
      runs,
      configured,
      discovered,
      packs,
      cases,
      // The design references `data.cases847` for the drill-in; expose the
      // first run's cases under that key as a fallback.
      cases847: (cases[Object.keys(cases)[0]] || []),
    };
  }

  async function fetchAll() {
    const [runsRes, lbRes, cfgRes, packsRes, discRes] = await Promise.all([
      fetch("/ui/runs").then(r => r.json()).catch(() => ({ runs: [] })),
      fetch("/ui/leaderboard").then(r => r.json()).catch(() => ({ leaderboard: [] })),
      fetch("/ui/models/configured").then(r => r.json()).catch(() => ({ configured: [] })),
      fetch("/ui/packs").then(r => r.json()).catch(() => ({ packs: [] })),
      fetch("/ui/models/discovered").then(r => r.json()).catch(() => ({ discovered: [] })),
    ]);
    // Fetch cases for the most recent run so the drill-in panel has data.
    const firstRunId = runsRes.runs && runsRes.runs[0] && runsRes.runs[0].run_id;
    let cases = {};
    if (firstRunId) {
      try {
        const cr = await fetch("/ui/runs/" + encodeURIComponent(firstRunId) + "/cases").then(r => r.json());
        cases[firstRunId] = cr.cases || [];
      } catch (_) { /* ignore */ }
    }
    return {
      runs: runsRes.runs || [],
      leaderboard: lbRes.leaderboard || [],
      configured: cfgRes.configured || [],
      discovered: discRes.discovered || [],
      packs: packsRes.packs || [],
      cases,
      meta: runsRes.meta || lbRes.meta,
    };
  }

  // SSR-first hydration: if the server pre-injected data, use it immediately
  // so screens have something on first paint.
  if (window.VERDICT_DATA_SSR) {
    window.VERDICT_DATA = shape(window.VERDICT_DATA_SSR);
  } else {
    // Empty shell — screens render their empty states. We'll repopulate
    // after the async fetch returns.
    window.VERDICT_DATA = shape({});
  }

  window.verdictRefresh = async function () {
    try {
      const server = await fetchAll();
      window.VERDICT_DATA = shape(server);
      // The App component subscribes to this custom event to re-render.
      window.dispatchEvent(new CustomEvent("verdict:data"));
    } catch (e) {
      // Swallow — better to keep stale data than break the page.
      console.warn("verdictRefresh failed", e);
    }
  };

  // First refresh: if SSR provided data, also kick off a fetch to get fresh
  // server-side state (and the cases for the most-recent run).
  window.addEventListener("DOMContentLoaded", () => {
    window.verdictRefresh();
    // Optional polling — disabled by default; enable with ?poll=5
    const u = new URL(window.location.href);
    const poll = parseInt(u.searchParams.get("poll") || "0", 10);
    if (poll > 0) {
      setInterval(window.verdictRefresh, poll * 1000);
    }
  });
})();
