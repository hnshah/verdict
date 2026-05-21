/* global React, Panel, PRow, PDiv, S, spark, hbar, TabBar */

function HomeScreen({ data, theme, navigate }) {
  return (
    <>
      <TabBar active={1} theme={theme} onNavigate={navigate} />
      <div style={{ height: 8 }} />

      <div style={{
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.8fr) minmax(0, 1fr)",
        gap: 8,
      }}>
        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0, minWidth: 0 }}>
          <Leaderboard models={data.models} />
          <TrendPanel models={data.models} />
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0, minWidth: 0 }}>
          <DaemonPanel meta={data.meta} configured={data.configured} discovered={data.discovered} packs={data.packs} />
          <CostQualityPanel models={data.models} />
          <ActivityPanel runs={data.runs} />
        </div>
      </div>
    </>
  );
}

// =====================================================================
// Leaderboard
// =====================================================================

function Leaderboard({ models }) {
  const list = models || [];
  const totalRuns = list.reduce((s, m) => s + (m.runs || 0), 0);
  const regressions = list.filter(m => m.regression);
  return (
    <Panel title="⚡ top models" badge={`avg across ${totalRuns} run${totalRuns === 1 ? "" : "s"}`} box="rounded">
      <PRow>
        <Row>
          <Cell w={28}><S c="mute"> #</S></Cell>
          <Cell><S c="mute">model</S></Cell>
          <Cell w={60}><S c="mute">score</S></Cell>
          <Cell w={110}><S c="mute">strength</S></Cell>
          <Cell w={70}><S c="mute">trend</S></Cell>
          <Cell w={50} right><S c="mute">runs</S></Cell>
          <Cell w={60} right><S c="mute">last</S></Cell>
          <Cell w={80} right><S c="mute">Δ</S></Cell>
        </Row>
      </PRow>
      <PDiv box="sharp" />
      {list.length === 0
        ? <PRow><S c="mute">no runs yet — run </S><S c="fg" bold>verdict run</S><S c="mute"> in the terminal</S></PRow>
        : list.map(m => <ModelRow key={m.id} m={m} highlight={false} />)}
      {regressions.length > 0 && (
        <>
          <PDiv box="sharp" />
          <PRow>
            <S c="warn">⚠ {regressions.length} regression{regressions.length === 1 ? "" : "s"} vs recent · </S>
            {regressions.slice(0, 3).map((r, i) => (
              <span key={r.id}>
                {i > 0 && <S c="mute">, </S>}
                <S c="fg" bold>{r.id}</S> <S c="mute">({r.delta.toFixed(2)})</S>
              </span>
            ))}
          </PRow>
        </>
      )}
    </Panel>
  );
}

function ModelRow({ m, highlight }) {
  const dC = m.delta >= 0 ? "good" : m.delta < -0.3 ? "bad" : "warn";
  const dStr = (m.delta >= 0 ? "+" : "−") + Math.abs(m.delta).toFixed(2);
  const arrow = m.delta >= 0 ? "▲" : "▼";
  return (
    <PRow className={highlight ? "hi" : ""}>
      <Row>
        <Cell w={28}><S c="mute">{(m.rank + ".").padStart(3, " ")}</S></Cell>
        <Cell>
          <S c={m.dot}>●</S> <S c="fg" bold>{m.id}</S>{"  "}
          <S c="mute">{m.provider}</S>
          {m.local && <> <S c="cyn">local</S></>}
        </Cell>
        <Cell w={60}><S c="acc" bold>{m.score.toFixed(2)}</S></Cell>
        <Cell w={110}><S c="acc">{hbar(m.score, 10, 10, "block")}</S></Cell>
        <Cell w={70}><span className="spark acc">{spark(m.trend, "block")}</span></Cell>
        <Cell w={50} right><S c="mute">{m.runs}</S></Cell>
        <Cell w={60} right><S c="fg">{m.last.toFixed(2)}</S></Cell>
        <Cell w={80} right><S c={dC}>{arrow} {dStr}</S></Cell>
      </Row>
    </PRow>
  );
}

// =====================================================================
// Trend chart panel
// =====================================================================

function TrendPanel({ models }) {
  // Top 3 models with their actual trend sparklines. When we only have 1
  // run, the sparkline is a single block — that's accurate, not a bug.
  const top = (models || []).slice(0, 5);
  if (top.length === 0) {
    return (
      <Panel title="📈 score trend" box="rounded">
        <PRow><S c="mute">no runs yet</S></PRow>
      </Panel>
    );
  }
  const colors = ["grn", "cyn", "mag", "yel", "orng"];
  return (
    <Panel title="📈 score trend" badge={`top ${top.length} · last ${Math.max(...top.map(m => (m.trend || []).length))} runs`} box="rounded">
      <PRow>
        <Row>
          <Cell w={160}><S c="mute">model</S></Cell>
          <Cell w={120}><S c="mute">trend</S></Cell>
          <Cell w={60} right><S c="mute">avg</S></Cell>
          <Cell w={60} right><S c="mute">last</S></Cell>
          <Cell w={60} right><S c="mute">Δ</S></Cell>
        </Row>
      </PRow>
      <PDiv box="sharp" />
      {top.map((m, i) => {
        const trend = (m.trend && m.trend.length > 0) ? m.trend : [m.score];
        const dColor = m.delta >= 0 ? "good" : m.delta < -0.3 ? "bad" : "warn";
        const arrow = m.delta >= 0 ? "▲" : "▼";
        const dStr = (m.delta >= 0 ? "+" : "−") + Math.abs(m.delta).toFixed(2);
        return (
          <PRow key={m.id}>
            <Row>
              <Cell w={160}>
                <S c={colors[i % colors.length]} bold>● </S>
                <S c="fg">{m.id}</S>
              </Cell>
              <Cell w={120}>
                <span className={`spark ${colors[i % colors.length]}`}>{spark(trend, "block")}</span>
              </Cell>
              <Cell w={60} right><S c="acc" bold>{m.score.toFixed(2)}</S></Cell>
              <Cell w={60} right><S c="fg">{m.last.toFixed(2)}</S></Cell>
              <Cell w={60} right><S c={dColor}>{arrow} {dStr}</S></Cell>
            </Row>
          </PRow>
        );
      })}
    </Panel>
  );
}

// =====================================================================
// Daemon panel
// =====================================================================

function DaemonPanel({ meta, configured, discovered, packs }) {
  const cfg = (configured || []).length;
  const disc = (discovered || []).length;
  const pck = (packs || []).length;
  // The dashboard runs INSIDE the verdict serve process — proxy is by
  // definition up. The standalone `verdict daemon` is a separate process
  // we don't yet have a status pipe to; show that explicitly.
  return (
    <Panel title="🛰 serve" box="rounded">
      <PRow><KV k="proxy"      v={<><S c="good">●</S> <S c="fg">localhost:4000</S></>} /></PRow>
      <PRow><KV k="path"       v={<S c="fg">{(meta && meta.path) || "~/.verdict"}</S>} /></PRow>
      <PRow><KV k="version"    v={<S c="fg">v{(meta && meta.version) || "0.4.0"}</S>} /></PRow>
      <PDiv joins={false} />
      <PRow><KV k="models"     v={<><S c="fg" bold>{cfg}</S> <S c="mute">configured</S></>} /></PRow>
      <PRow><KV k="discovered" v={<><S c="cyn" bold>{disc}</S> <S c="mute">live</S></>} /></PRow>
      <PRow><KV k="packs"      v={<><S c="fg" bold>{pck}</S> <S c="mute">eval packs</S></>} /></PRow>
      <PDiv joins={false} />
      <PRow><KV k="daemon"     v={<S c="mute">use </S>} /></PRow>
      <PRow><KV k=""           v={<S c="fg" bold>verdict daemon</S>} /></PRow>
    </Panel>
  );
}

function KV({ k, v }) {
  return (
    <Row>
      <Cell w={80}><S c="mute">{k}</S></Cell>
      <Cell>{v}</Cell>
    </Row>
  );
}

// =====================================================================
// Cost-quality
// =====================================================================

function CostQualityPanel({ models }) {
  // Bucket the leaderboard into free (local), cheap (≤$0.05/run), premium (>$0.05).
  // Pick the top scorer in each bucket — that's the cost-quality frontier.
  const list = models || [];
  const free   = list.filter(m => m.cost === 0 || m.local).slice(0, 1)[0];
  const cheap  = list.filter(m => m.cost > 0 && m.cost <= 0.05).slice(0, 1)[0];
  const prem   = list.filter(m => m.cost > 0.05).slice(0, 1)[0];

  if (!free && !cheap && !prem) {
    return (
      <Panel title="cost · quality" box="rounded">
        <PRow><S c="mute">no runs yet — run </S><S c="fg" bold>verdict run</S><S c="mute"> to populate</S></PRow>
      </Panel>
    );
  }

  // Cost-quality synthesis: if free model is within 0.3pts of premium,
  // recommend the free model and quantify savings.
  let synthesis = null;
  if (free && prem && (prem.score - free.score) <= 0.3) {
    const monthlyRuns = 1000; // a conservative "1k runs/mo" assumption
    const savings = ((prem.cost - free.cost) * monthlyRuns).toFixed(0);
    synthesis = (
      <>
        <PRow><S c="acc" bold>→ </S><S c="fg" bold>{free.id}</S> <S c="fg">matches </S><S c="fg" bold>{prem.id}</S></PRow>
        <PRow><S c="fg">within {(prem.score - free.score).toFixed(2)} pts · </S><S c="good">save ${savings}/mo @1k runs</S></PRow>
      </>
    );
  } else if (free && !prem) {
    synthesis = (
      <PRow><S c="acc" bold>→ </S><S c="fg" bold>{free.id}</S> <S c="fg">tops the frontier · </S><S c="good">$0.00</S></PRow>
    );
  }

  return (
    <Panel title="cost · quality" box="rounded">
      <PRow>
        <Row>
          <Cell w={60}><S c="mute">tier</S></Cell>
          <Cell w={150}><S c="mute">model</S></Cell>
          <Cell w={60} right><S c="mute">$/run</S></Cell>
          <Cell w={50} right><S c="mute">score</S></Cell>
        </Row>
      </PRow>
      <PDiv box="sharp" />
      {free && <CQRow tier="free"  tc="grn" model={free.id}  cost={fmtCost(free.cost)}  score={free.score.toFixed(2)}  costColor="good" />}
      {cheap && <CQRow tier="cheap" tc="cyn" model={cheap.id} cost={fmtCost(cheap.cost)} score={cheap.score.toFixed(2)} costColor="fg" />}
      {prem && <CQRow tier="prem"  tc="mag" model={prem.id}  cost={fmtCost(prem.cost)}  score={prem.score.toFixed(2)}  costColor="warn" />}
      {synthesis && <PDiv joins={false} />}
      {synthesis}
    </Panel>
  );
}
function fmtCost(c) { return c === 0 ? "$0.00" : "$" + c.toFixed(2); }
function CQRow({ tier, tc, model, cost, score, costColor }) {
  return (
    <PRow>
      <Row>
        <Cell w={60}><S c={tc}>{tier}</S></Cell>
        <Cell w={150}><S c="fg">{model}</S></Cell>
        <Cell w={60} right><S c={costColor}>{cost}</S></Cell>
        <Cell w={50} right><S c="acc">{score}</S></Cell>
      </Row>
    </PRow>
  );
}

// =====================================================================
// Activity
// =====================================================================

function ActivityPanel({ runs }) {
  const events = (runs || []).slice(0, 8).map(r => {
    const passed = r.score >= 7;
    return [
      r.date,
      passed ? "good" : "bad",
      passed ? "✓" : "✗",
      `run ${r.id.slice(-12)} · ${r.model} · ${r.pack} · ${r.score.toFixed(1)}`,
    ];
  });
  return (
    <Panel title="activity" badge={`last ${events.length}`} box="rounded">
      {events.length === 0
        ? <PRow><S c="mute">no recent runs</S></PRow>
        : events.map((e, i) => (
          <PRow key={i}>
            <Row>
              <Cell w={50}><S c="mute">{e[0]}</S></Cell>
              <Cell w={20}><S c={e[1]}>{e[2]}</S></Cell>
              <Cell><S c="fg">{e[3]}</S></Cell>
            </Row>
          </PRow>
        ))}
    </Panel>
  );
}

// =====================================================================
// Tiny grid primitives — flex row + fixed-width cells
// =====================================================================

function Row({ children }) {
  return <div style={{ display: "flex", width: "100%", alignItems: "baseline" }}>{children}</div>;
}
function Cell({ w, right, children }) {
  return (
    <span style={{
      width: w ? `${w}px` : undefined,
      flex: w ? "0 0 auto" : "1 1 auto",
      textAlign: right ? "right" : "left",
      overflow: "hidden",
      whiteSpace: "pre",
    }}>
      {children}
    </span>
  );
}

Object.assign(window, { HomeScreen });
