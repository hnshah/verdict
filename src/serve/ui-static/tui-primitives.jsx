/* global React */
/* Verdict TUI — layout primitives
   Panels are flex-columns with stretching box-drawing border rows.
   Callers MUST use <PRow> for body rows — no auto-wrap magic. */

const PanelCtx = React.createContext("rounded");

// color/highlight span
function S({ c, b, bold, ul, dim, inv, children, className = "" }) {
  const cls = [
    c && `c-${c}`, b && `b-${b}`,
    bold && "bold", ul && "ul", dim && "dim", inv && "inv",
    className,
  ].filter(Boolean).join(" ");
  return <span className={cls}>{children}</span>;
}

function fillChar(ch) { return ch.repeat(400); }

const BOX = {
  rounded: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│", lj: "├", rj: "┤" },
  sharp:   { tl: "┌", tr: "┐", bl: "└", br: "┘", h: "─", v: "│", lj: "├", rj: "┤" },
  double:  { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║", lj: "╠", rj: "╣" },
  thick:   { tl: "┏", tr: "┓", bl: "┗", br: "┛", h: "━", v: "┃", lj: "┣", rj: "┫" },
  hair:    { tl: " ", tr: " ", bl: " ", br: " ", h: "─", v: " ", lj: " ", rj: " " },
};

function Panel({ title, badge, box = "rounded", color = "acc", children, className = "", style }) {
  const b = BOX[box];
  return (
    <PanelCtx.Provider value={box}>
      <div className={`tp ${className}`} style={style}>
        <div className="tp-top">
          <span>{b.tl}{b.h}</span>
          {title && <span><S c={color} bold>{` ${title} `}</S></span>}
          {badge && <S c="mute">· {badge} </S>}
          <span className="tp-fill">{fillChar(b.h)}</span>
          <span>{b.tr}</span>
        </div>
        <div className="tp-body">{children}</div>
        <div className="tp-bot">
          <span>{b.bl}</span>
          <span className="tp-fill">{fillChar(b.h)}</span>
          <span>{b.br}</span>
        </div>
      </div>
    </PanelCtx.Provider>
  );
}

function PRow({ children, className = "", style }) {
  const box = React.useContext(PanelCtx);
  const v = BOX[box].v;
  return (
    <div className={`tp-row ${className}`} style={style}>
      <span className="side">{v} </span>
      <div className="content">{children}</div>
      <span className="side"> {v}</span>
    </div>
  );
}

function PDiv({ box, joins = true }) {
  const panelBox = React.useContext(PanelCtx);
  const innerBox = box || "sharp";
  const outer = BOX[panelBox];
  const inner = BOX[innerBox];
  return (
    <div className="tp-divider">
      <span className="side">{joins ? outer.lj : outer.v}</span>
      <span className="fill">{fillChar(inner.h)}</span>
      <span className="side">{joins ? outer.rj : outer.v}</span>
    </div>
  );
}

// Sparklines / bars
const SPARK = {
  block:   ["▁","▂","▃","▄","▅","▆","▇","█"],
  braille: ["⠀","⡀","⡄","⡆","⡇","⣇","⣧","⣷","⣿"],
  dots:    ["·","∶","∷","∴","∵","⁞","⁝","⁞"],
  bars:    [".",",","-","=","≡","⌷","|","‖"],
};
function spark(values, scale = "block") {
  const set = SPARK[scale];
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  return values.map(v => {
    const t = (v - min) / Math.max(0.0001, (max - min));
    return set[Math.min(set.length - 1, Math.round(t * (set.length - 1)))];
  }).join("");
}
function hbar(score, max = 10, width = 10, style = "block") {
  const fill = Math.round((score / max) * width);
  if (style === "ascii")      return "|".repeat(fill) + ".".repeat(width - fill);
  if (style === "block")      return "█".repeat(fill) + "░".repeat(width - fill);
  if (style === "block-soft") return "▰".repeat(fill) + "▱".repeat(width - fill);
  if (style === "dots")       return "●".repeat(fill) + "○".repeat(width - fill);
  return "█".repeat(fill) + " ".repeat(width - fill);
}

// Tab bar
function TabBar({ active, tabs = ["Home","Runs","Models","Baselines","Daemon","Packs"], theme, brand = "verdict", onNavigate }) {
  const route = (n) => {
    const map = { 1: "home", 2: "runs", 3: "models", 4: "baselines", 5: "daemon", 6: "packs" };
    onNavigate?.(map[n]);
  };
  return (
    <div className="tabs">
      <span className="brand">{brand}</span>
      <S c="mute">›</S>
      {tabs.map((t, i) => {
        const n = i + 1;
        return (
          <span
            key={t}
            className={"tab " + (n === active ? "active" : "")}
            onClick={() => route(n)}
            style={{ cursor: onNavigate ? "pointer" : "default" }}
          >
            {`${n} ${t}`}
          </span>
        );
      })}
      <span style={{ flex: 1 }} />
      {theme && <S c="mute">theme: <S c="fg">{theme}</S></S>}
    </div>
  );
}

// Status bar
function StatusBar({ mode = "NORMAL", keys, right }) {
  const defaultKeys = [
    [":", "cmd"], ["/", "filter"], ["?", "help"],
    ["t", "theme"], ["^o", "back"], ["n", "new run"], ["q", "quit"],
  ];
  const k = keys || defaultKeys;
  return (
    <div className="statusbar">
      <span className="mode">{mode}</span>
      <span className="keys">
        {k.map(([key, label], i) => (
          <span key={i} className="k">
            <span className="lbl">{key}</span>
            <span className="v">{label}</span>
          </span>
        ))}
      </span>
      <span className="right">{right}</span>
    </div>
  );
}

// Window chrome
function WinChrome({ title, sub }) {
  return (
    <div className="shell-chrome">
      <span className="d r" /><span className="d y" /><span className="d g" />
      <span className="t">{title}</span>
      {sub && <span className="meta">{sub}</span>}
    </div>
  );
}

Object.assign(window, {
  S, Panel, PRow, PDiv, BOX, fillChar,
  TabBar, StatusBar, WinChrome,
  spark, hbar,
});
