/* global React, ReactDOM,
   HomeScreen, RunsScreen, ModelsScreen, NewRunScreen,
   CommandPalette, HelpOverlay, Splash, COMMANDS,
   StatusBar, WinChrome, S */

const { useState: useS, useEffect: useE, useCallback: useC, useRef: useR } = React;

const THEMES = ["default", "monokai", "dracula", "solarized"];

function App() {
  const [theme, setTheme] = useS(localStorage.getItem("verdict.theme") || "default");
  const [screen, setScreen] = useS("home"); // home, runs, models, new-run, stub
  const [history, setHistory] = useS([]);    // back stack (Ctrl-O)
  const [overlay, setOverlay] = useS(null);  // 'palette' | 'help' | null
  const [splash, setSplash] = useS(sessionStorage.getItem("verdict.booted") !== "1");
  // Bump on each `verdict:data` event so the app re-renders with fresh data.
  const [dataTick, setDataTick] = useS(0);

  useE(() => { localStorage.setItem("verdict.theme", theme); }, [theme]);

  // Re-render whenever the data loader fetches fresh runs/leaderboard.
  useE(() => {
    function onData() { setDataTick(t => t + 1); }
    window.addEventListener("verdict:data", onData);
    return () => window.removeEventListener("verdict:data", onData);
  }, []);

  const navigate = useC((to, recordHistory = true) => {
    if (recordHistory && to !== screen) setHistory(h => [...h.slice(-19), screen]);
    setScreen(to);
    setOverlay(null);
  }, [screen]);

  const cycleTheme = useC(() => {
    setTheme(t => THEMES[(THEMES.indexOf(t) + 1) % THEMES.length]);
  }, []);

  // ── Global keyboard ──
  useE(() => {
    function h(e) {
      // ignore if user typing in palette (palette has its own handler)
      if (overlay === "palette") return;
      if (e.metaKey || e.altKey) return;

      // Esc closes any overlay
      if (e.key === "Escape") { setOverlay(null); return; }

      if (overlay) return; // help captures its own esc/?

      if (e.key === ":")        { setOverlay("palette"); e.preventDefault(); return; }
      if (e.key === "?")        { setOverlay("help");    e.preventDefault(); return; }
      if (e.key === "t")        { cycleTheme(); return; }
      if (e.key === "r")        { window.verdictRefresh && window.verdictRefresh(); return; }

      if (e.ctrlKey && (e.key === "o" || e.key === "O")) {
        setHistory(h => {
          if (h.length === 0) return h;
          const prev = h[h.length - 1];
          setScreen(prev);
          return h.slice(0, -1);
        });
        e.preventDefault(); return;
      }

      // 1-6 tab nav
      const map = { "1":"home", "2":"runs", "3":"models", "4":"baselines", "5":"daemon", "6":"packs" };
      if (map[e.key]) { navigate(map[e.key]); return; }

      // 'n' new run
      if (e.key === "n") { navigate("new-run"); return; }
    }
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [overlay, navigate, cycleTheme]);

  // splash dismissal
  useE(() => {
    if (!splash) return;
    function dismiss() { setSplash(false); sessionStorage.setItem("verdict.booted", "1"); }
    window.addEventListener("keydown", dismiss, { once: true });
    return () => window.removeEventListener("keydown", dismiss);
  }, [splash]);

  function onPalettePick(cmd) {
    if (cmd.screen) navigate(cmd.screen);
    else if (cmd.action === "cycleTheme") { setOverlay(null); cycleTheme(); }
    else if (cmd.action === "help") setOverlay("help");
    else if (cmd.action === "refresh") { setOverlay(null); window.verdictRefresh && window.verdictRefresh(); }
    else setOverlay(null);
  }

  const data = window.VERDICT_DATA;
  const version = (data.meta && data.meta.version) || "0.4.0";
  const fontClass = ""; // can flip via tweaks later

  return (
    <div className={`app theme-${theme}`}>
      <WinChrome
        title="verdict — local dashboard"
        sub={`v${version} · ${theme} theme · ${data.models.length} models · ${data.runs.length} runs · read-only`}
      />
      <div className={`tui-screen ${fontClass}`}>
        {renderScreen(screen, { data, theme, navigate })}
        <StatusBar
          mode={overlay === "palette" ? "COMMAND" : "NORMAL"}
          keys={statusKeysFor(screen)}
          right={
            <>
              <S c="mute">theme </S><S c="fg">{theme}</S>
              <S c="mute"> · </S>
              <S c="acc">{data.models.length} models</S>
              <S c="mute"> · </S>
              <S c="fg">{(data.meta && data.meta.path) || "~/.verdict"}</S>
            </>
          }
        />
      </div>

      {overlay === "palette" && (
        <CommandPalette
          onClose={() => setOverlay(null)}
          onPick={onPalettePick}
        />
      )}
      {overlay === "help" && (
        <HelpOverlay screen={screen} onClose={() => setOverlay(null)} />
      )}
      {splash && (
        <Splash onDone={() => { setSplash(false); sessionStorage.setItem("verdict.booted", "1"); }} />
      )}
    </div>
  );
}

function renderScreen(screen, props) {
  switch (screen) {
    case "home":    return <HomeScreen {...props} />;
    case "runs":    return <RunsScreen {...props} />;
    case "models":  return <ModelsScreen {...props} />;
    case "new-run": return <NewRunScreen {...props} />;
    default:        return <StubScreen name={screen} {...props} />;
  }
}

function statusKeysFor(screen) {
  const base = [
    [":", "cmd"], ["/", "filter"], ["?", "help"],
    ["t", "theme"], ["^o", "back"],
  ];
  if (screen === "home")    return [...base, ["n", "new run"], ["q", "quit"]];
  if (screen === "runs")    return [...base, ["↵", "open"], ["n", "new run"], ["b", "baseline"], ["q", "quit"]];
  if (screen === "models")  return [...base, ["d", "discover"], ["a", "add"], ["e", "edit"], ["q", "quit"]];
  if (screen === "new-run") return [...base, ["tab", "switch"], ["space", "toggle"], ["↵", "launch"], ["q", "quit"]];
  return [...base, ["q", "quit"]];
}

// ---------------------------------------------------------------------
// Stub screen for ones we haven't built out
// ---------------------------------------------------------------------
function StubScreen({ name, theme, navigate }) {
  const titles = {
    baselines: "📚 baselines",
    daemon:    "🛰 daemon",
    packs:     "📦 eval packs",
    compare:   "⇌ compare",
    router:    "↬ router",
    serve:     "⇄ serve",
    config:    "⚙ config",
  };
  return (
    <>
      <window.TabBar active={tabIndexFor(name)} theme={theme} onNavigate={navigate} />
      <div style={{ height: 8 }} />
      <div style={{
        flex: 1, minHeight: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 12,
      }}>
        <div style={{ fontSize: 22 }}>
          <S c="acc" bold>{titles[name] || name}</S>
        </div>
        <div><S c="mute">screen not implemented in this prototype</S></div>
        <div style={{ marginTop: 18 }}>
          <S c="mute">press </S><S c="acc" bold>:</S><S c="mute"> to open the command palette, or </S>
          <S c="acc" bold>1</S><S c="mute"> to return home</S>
        </div>
      </div>
    </>
  );
}
function tabIndexFor(name) {
  return { home:1, runs:2, models:3, baselines:4, daemon:5, packs:6 }[name];
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
