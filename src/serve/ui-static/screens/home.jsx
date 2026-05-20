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
          <TrendPanel />
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0, minWidth: 0 }}>
          <DaemonPanel />
          <CostQualityPanel />
          <ActivityPanel />
        </div>
      </div>
    </>
  );
}

// =====================================================================
// Leaderboard
// =====================================================================

function Leaderboard({ models }) {
  return (
    <Panel title="⚡ top models" badge="avg across 15 runs · last 24h" box="rounded">
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
      {models.map(m => <ModelRow key={m.id} m={m} highlight={m.rank === 2} />)}
      <PDiv box="sharp" />
      <PRow>
        <S c="warn">⚠</S> <S c="warn">1 regression vs recent avg ·</S>{" "}
        <S c="fg" bold>llama3.2:3b</S> <S c="mute">on tool-calling pack (−1.4)</S>
      </PRow>
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

function TrendPanel() {
  // an ascii line chart with 3 series, hand-tuned glyphs
  const rows = [
    [" 10", "                                                          "],
    ["  9", "                                       ╭───╮               "],
    ["  8", "      ╭──────────────────╮          ╭──╯   ╰─╮             "],
    ["  7", "─────╯                   ╰──╮  ╭────╯         ╰──────╮     "],
    ["  6", "                            ╰──╯                      ╰─── "],
    ["  5", "                                                          "],
  ];
  return (
    <Panel title="📈 score trend" badge="top 3 · last 8 runs" box="rounded">
      {rows.map(([y, body], i) => (
        <PRow key={i}>
          <Row>
            <Cell w={28}><S c="mute">{y}</S> <S c="line">│</S></Cell>
            <Cell><S c="acc">{body}</S></Cell>
          </Row>
        </PRow>
      ))}
      <PRow>
        <Row>
          <Cell w={28}><S c="line">    └</S></Cell>
          <Cell><S c="line">──────────────────────────────────────────────────────────</S></Cell>
        </Row>
      </PRow>
      <PRow>
        <Row>
          <Cell w={28}> </Cell>
          <Cell><S c="mute">run40  run41  run42  run43  run44  run45  run46  run47</S></Cell>
        </Row>
      </PRow>
      <PRow>
        <Row>
          <Cell w={28}> </Cell>
          <Cell>
            <span style={{ display: "inline-flex", gap: 18 }}>
              <span><S c="grn" bold>●</S> <S c="fg">gpt-4o</S></span>
              <span><S c="cyn" bold>●</S> <S c="fg">qwen2.5:7b</S></span>
              <span><S c="mag" bold>●</S> <S c="fg">claude-haiku</S></span>
            </span>
          </Cell>
        </Row>
      </PRow>
    </Panel>
  );
}

// =====================================================================
// Daemon panel
// =====================================================================

function DaemonPanel() {
  return (
    <Panel title="🛰 daemon" box="rounded">
      <PRow><KV k="status"  v={<S c="good">● running</S>} /></PRow>
      <PRow><KV k="uptime"  v={<S c="fg">2h 14m</S>} /></PRow>
      <PRow><KV k="queue"   v={<><S c="fg">0</S> <S c="mute">jobs</S></>} /></PRow>
      <PRow><KV k="today"   v={<><S c="good">✓ 14</S>{"  "}<S c="bad">✗ 1</S></>} /></PRow>
      <PRow><KV k="watcher" v={<><S c="good">●</S> <S c="fg">3 found</S></>} /></PRow>
      <PDiv joins={false} />
      <PRow><KV k="proxy"    v={<><S c="good">●</S> <S c="fg">port 4000</S></>} /></PRow>
      <PRow><KV k="baseline" v={<><S c="fg">v1.2</S> <S c="mute">3d ago</S></>} /></PRow>
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

function CostQualityPanel() {
  return (
    <Panel title="cost · quality" box="rounded">
      <PRow>
        <Row>
          <Cell w={60}><S c="mute">tier</S></Cell>
          <Cell w={110}><S c="mute">model</S></Cell>
          <Cell w={60} right><S c="mute">$/run</S></Cell>
          <Cell w={50} right><S c="mute">score</S></Cell>
        </Row>
      </PRow>
      <PDiv box="sharp" />
      <CQRow tier="free"  tc="grn" model="qwen2.5:7b" cost="$0.00" score="8.7"  costColor="good" />
      <CQRow tier="cheap" tc="cyn" model="haiku"      cost="$0.03" score="7.6"  costColor="fg" />
      <CQRow tier="prem"  tc="mag" model="gpt-4o"     cost="$0.15" score="8.66" costColor="warn" />
      <PDiv joins={false} />
      <PRow><S c="acc" bold>→ </S><S c="fg" bold>qwen2.5:7b</S> <S c="fg">matches sonnet</S></PRow>
      <PRow><S c="fg">within 0.3 pts ·</S> <S c="good">save $50/mo</S></PRow>
    </Panel>
  );
}
function CQRow({ tier, tc, model, cost, score, costColor }) {
  return (
    <PRow>
      <Row>
        <Cell w={60}><S c={tc}>{tier}</S></Cell>
        <Cell w={110}><S c="fg">{model}</S></Cell>
        <Cell w={60} right><S c={costColor}>{cost}</S></Cell>
        <Cell w={50} right><S c="acc">{score}</S></Cell>
      </Row>
    </PRow>
  );
}

// =====================================================================
// Activity
// =====================================================================

function ActivityPanel() {
  const ev = [
    ["12:04", "good", "✓", "run #847 gpt-4o · code-gen · 9.1"],
    ["12:01", "cyn",  "⇣", "baseline saved · v1.2"],
    ["11:48", "yel",  "+", "model discovered · mistral-small"],
    ["11:32", "good", "✓", "run #846 qwen · tool-call · 8.4"],
    ["11:18", "bad",  "✗", "run #845 llama · regression"],
    ["10:50", "mag",  "⟳", "daemon started · queue 3"],
  ];
  return (
    <Panel title="activity" badge="last 10" box="rounded">
      {ev.map((e, i) => (
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
