/* global React, S, hbar */

const { useState: useState_o, useEffect: useEffect_o, useMemo: useMemo_o } = React;

// =====================================================================
// Command palette — `:` opens, fuzzy filter, ↓↑ navigate, Enter selects
// =====================================================================

// Read-only dashboard — only navigation, theme, refresh, help are wired.
// Mutating actions (launch, save baseline, discover-then-add) must use the CLI.
const COMMANDS = [
  { kw: ["home", "1"],            screen: "home",     label: "Home",                  hint: "1"   },
  { kw: ["runs", "history", "2"], screen: "runs",     label: "Runs · history",        hint: "2"   },
  { kw: ["models", "3"],          screen: "models",   label: "Models · configured",   hint: "3"   },
  { kw: ["new", "run", "launch"], screen: "new-run",  label: "New run · CLI hint",    hint: "n"   },
  { kw: ["refresh", "reload"],    action: "refresh",  label: "Refresh data",          hint: "r"   },
  { kw: ["theme", "cycle"],       action: "cycleTheme", label: "Cycle theme",         hint: "t"   },
  { kw: ["help"],                 action: "help",     label: "Help · keybinds",       hint: "?"   },
];

function CommandPalette({ onClose, onPick }) {
  const [query, setQuery] = useState_o("");
  const [idx, setIdx] = useState_o(0);

  const filtered = useMemo_o(() => {
    if (!query) return COMMANDS;
    const q = query.toLowerCase();
    return COMMANDS.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.kw.some(k => k.includes(q))
    );
  }, [query]);

  useEffect_o(() => { setIdx(0); }, [query]);

  useEffect_o(() => {
    function h(e) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown" || (e.ctrlKey && e.key === "n")) {
        setIdx(i => (i + 1) % Math.max(1, filtered.length)); e.preventDefault();
      } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key === "p")) {
        setIdx(i => (i - 1 + filtered.length) % Math.max(1, filtered.length)); e.preventDefault();
      } else if (e.key === "Enter") {
        const c = filtered[idx];
        if (c) onPick(c);
        e.preventDefault();
      } else if (e.key === "Backspace") {
        setQuery(q => q.slice(0, -1));
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        setQuery(q => q + e.key);
      }
    }
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [filtered, idx, onClose, onPick]);

  return (
    <div className="overlay-scrim" onClick={onClose}>
      <div className="overlay-palette" onClick={e => e.stopPropagation()}>
        <div className="overlay-palette__input">
          <S c="acc" bold>{": "}</S>
          <S c="fg">{query || ""}</S>
          <span className="caret">▏</span>
          <span style={{ flex: 1 }} />
          <S c="mute">{filtered.length} match{filtered.length !== 1 ? "es" : ""}</S>
        </div>
        <div className="overlay-palette__list">
          {filtered.length === 0 && (
            <div className="palette-row dim"><S c="mute">no matches</S></div>
          )}
          {filtered.map((c, i) => (
            <div
              key={c.label}
              className={"palette-row " + (i === idx ? "sel" : "")}
              onMouseEnter={() => setIdx(i)}
              onClick={() => onPick(c)}
            >
              <span style={{ flex: 1 }}>
                {c.action === "cycleTheme" && <S c="mag">⤺ </S>}
                {c.action === "discover"   && <S c="cyn">🛰 </S>}
                {c.action === "quit"       && <S c="red">⏻ </S>}
                {c.screen                  && <S c="acc">› </S>}
                <S c="fg">{c.label}</S>
              </span>
              {c.hint && <S c="mute">{c.hint}</S>}
            </div>
          ))}
        </div>
        <div className="overlay-palette__foot">
          <S c="mute">↑↓</S> <S c="fg">navigate</S>
          {"   "}
          <S c="mute">↵</S> <S c="fg">select</S>
          {"   "}
          <S c="mute">esc</S> <S c="fg">close</S>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Help overlay — context-sensitive keybinds
// =====================================================================

const HELP_GLOBAL = [
  [":",        "command palette"],
  ["/",        "filter visible list"],
  ["?",        "this help"],
  ["1‥6",      "jump to tab 1‥6"],
  ["tab / ⇧tab","next / prev pane"],
  ["t",        "cycle theme"],
  ["^o",       "back (history)"],
  ["esc",      "cancel · normal mode"],
  ["q",        "quit"],
];
const HELP_LIST = [
  ["j k / ↓ ↑", "next / previous row"],
  ["g / G",     "top / bottom"],
  ["pgdn / pgup","scroll by page"],
  ["↵",         "open / drill in"],
];
const HELP_BY_SCREEN = {
  home:    [["n", "new run"], ["c", "compare"]],
  runs:    [["n", "new run"], ["c", "compare two"], ["b", "save baseline"]],
  models:  [["d", "discover"], ["a", "add"], ["e", "edit yaml"], ["p", "ping all"], ["x", "remove"]],
  "new-run":[["tab","switch pane"],["space","toggle"],["↵","launch"]],
};

function HelpOverlay({ screen, onClose }) {
  useEffect_o(() => {
    const h = e => { if (e.key === "Escape" || e.key === "?") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const scr = HELP_BY_SCREEN[screen] || [];
  return (
    <div className="overlay-scrim" onClick={onClose}>
      <div className="overlay-help" onClick={e => e.stopPropagation()}>
        <div className="overlay-help__head">
          <S c="acc" bold>? help</S>
          <span style={{ flex: 1 }} />
          <S c="mute">esc to close</S>
        </div>
        <div className="overlay-help__cols">
          <HelpSection title="global" rows={HELP_GLOBAL} />
          <HelpSection title="list navigation" rows={HELP_LIST} />
          <HelpSection title={`screen · ${screen}`} rows={scr} />
        </div>
      </div>
    </div>
  );
}

function HelpSection({ title, rows }) {
  return (
    <div className="overlay-help__sec">
      <div className="overlay-help__title"><S c="mag" bold>{title}</S></div>
      <div className="overlay-help__rows">
        {rows.length === 0 && <div className="dim"><S c="mute">no shortcuts</S></div>}
        {rows.map(([k, v]) => (
          <div key={k} className="overlay-help__row">
            <span className="overlay-help__key"><S c="acc" bold>{k}</S></span>
            <span><S c="fg">{v}</S></span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// ASCII splash — shown for ~1.4s on first mount
// =====================================================================

const SPLASH_LOGO = [
  "                                                            ",
  "    ██╗   ██╗███████╗██████╗ ██████╗ ██╗ ██████╗████████╗  ",
  "    ██║   ██║██╔════╝██╔══██╗██╔══██╗██║██╔════╝╚══██╔══╝  ",
  "    ██║   ██║█████╗  ██████╔╝██║  ██║██║██║        ██║     ",
  "    ╚██╗ ██╔╝██╔══╝  ██╔══██╗██║  ██║██║██║        ██║     ",
  "     ╚████╔╝ ███████╗██║  ██║██████╔╝██║╚██████╗   ██║     ",
  "      ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝ ╚═════╝   ╚═╝     ",
  "                                                            ",
];

function Splash({ onDone }) {
  const [step, setStep] = useState_o(0);
  const lines = [
    ["loading", "verdict v0.4.2", 220],
    ["check",   "config · verdict.yaml ✓", 180],
    ["check",   "judge · qwen2.5:7b (local, free) ✓", 200],
    ["check",   "6 models · 6 packs · 102 cases", 200],
    ["check",   "daemon · port 4000 · queue 0", 260],
  ];
  useEffect_o(() => {
    if (step >= lines.length) {
      const t = setTimeout(onDone, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep(s => s + 1), lines[step][2]);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="splash">
      <div className="splash-logo">
        {SPLASH_LOGO.map((l, i) => (
          <div key={i}><S c="acc">{l}</S></div>
        ))}
        <div className="splash-tag">
          <S c="mute">{"           "}</S>
          <S c="fg">local + cloud model benchmarking · </S>
          <S c="acc">which model should i use?</S>
        </div>
      </div>
      <div className="splash-boot">
        {lines.slice(0, step).map(([kind, txt], i) => (
          <div key={i}>
            {kind === "loading"
              ? <><S c="mag" bold>{"⟳ "}</S><S c="fg">{txt}</S></>
              : <><S c="good" bold>{"✓ "}</S><S c="fg">{txt}</S></>}
          </div>
        ))}
        {step < lines.length && (
          <div><S c="mag" bold>{"⟳ "}</S><S c="mute">{lines[step][1]}</S></div>
        )}
      </div>
      <div className="splash-foot">
        <S c="mute">press any key to skip</S>
      </div>
    </div>
  );
}

Object.assign(window, { CommandPalette, HelpOverlay, Splash, COMMANDS });
