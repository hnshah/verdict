/* global React, Panel, PRow, PDiv, S, spark, hbar, TabBar */

const { useState } = React;

function RunsScreen({ data, theme, navigate }) {
  const firstRunId = (data.runs && data.runs[0] && data.runs[0].id) || "";
  const [selectedId, setSelectedId] = useState(firstRunId);
  const [filter, setFilter] = useState("");

  if (!data.runs || data.runs.length === 0) {
    return (
      <>
        <TabBar active={2} theme={theme} onNavigate={navigate} />
        <div style={{ height: 8 }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <S c="acc" bold>no runs yet</S>
          <S c="mute">run <S c="fg" bold>verdict run</S> in the terminal — results land here automatically</S>
        </div>
      </>
    );
  }

  const runs = data.runs.filter(r =>
    !filter ||
    r.model.includes(filter) || r.pack.includes(filter) || r.id.includes(filter)
  );
  const selected = data.runs.find(r => r.id === selectedId) || data.runs[0];
  const selKey = selected.run_id || selected.id;
  const cases = (data.cases && data.cases[selKey]) || data.cases847 || [];

  return (
    <>
      <TabBar active={2} theme={theme} onNavigate={navigate} />
      <div style={{ height: 8 }} />

      {/* filter strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "2px 6px", marginBottom: 4 }}>
        <S c="acc" bold>{"/"}</S>
        <span style={{
          background: "var(--bg-3)", padding: "0 8px",
          minWidth: 220, borderBottom: "1px solid var(--line-2)"
        }}>
          {filter
            ? <S c="fg">{filter}<S c="acc">▏</S></S>
            : <S c="mute">filter model · pack · id…<S c="acc">▏</S></S>}
        </span>
        <S c="mute">{runs.length}/{data.runs.length} runs</S>
        <span style={{ flex: 1 }} />
        <S c="mute">sort: </S><S c="fg">date</S>{" "}<S c="acc">↓</S>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
        gap: 8,
      }}>
        <RunsTable runs={runs} selectedId={selectedId} onSelect={setSelectedId} />
        <DrillIn run={selected} cases={cases} />
      </div>
    </>
  );
}

function RunsTable({ runs, selectedId, onSelect }) {
  return (
    <Panel title="🗂 run history" badge={`${runs.length} runs`} box="rounded">
      <PRow>
        <RunRow head />
      </PRow>
      <PDiv box="sharp" />
      <div style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {runs.map((r, i) => (
          <PRow
            key={`${r.id}-${r.model}-${i}`}
            className={r.id === selectedId ? "sel" : ""}
          >
            <div
              onClick={() => onSelect(r.id)}
              onMouseEnter={() => onSelect(r.id)}
              style={{ cursor: "pointer", width: "100%" }}
            >
              <RunRow r={r} />
            </div>
          </PRow>
        ))}
      </div>
      <PDiv box="sharp" />
      <PRow>
        <S c="mute">{"↵ "}</S><S c="fg">open drill-in</S>{"   "}
        <S c="mute">{"n "}</S><S c="fg">new run</S>{"   "}
        <S c="mute">{"c "}</S><S c="fg">compare</S>{"   "}
        <S c="mute">{"b "}</S><S c="fg">baseline</S>
      </PRow>
    </Panel>
  );
}

function RunRow({ r, head }) {
  if (head) {
    return (
      <div style={{ display: "flex", width: "100%" }}>
        <Cell w={50}><S c="mute">run</S></Cell>
        <Cell w={50}><S c="mute">time</S></Cell>
        <Cell w={130}><S c="mute">model</S></Cell>
        <Cell w={110}><S c="mute">pack</S></Cell>
        <Cell w={40} right><S c="mute">n</S></Cell>
        <Cell w={50} right><S c="mute">score</S></Cell>
        <Cell w={60} right><S c="mute">$</S></Cell>
        <Cell w={60} right><S c="mute">ms</S></Cell>
        <Cell w={30}>{" "}</Cell>
      </div>
    );
  }
  const statusMark =
    r.status === "regression" ? <S c="bad" bold>✗</S> :
    r.status === "warn" ? <S c="warn">!</S> :
    <S c="good">✓</S>;
  const scoreColor = r.score >= 8 ? "good" : r.score >= 7 ? "fg" : r.score >= 6.5 ? "warn" : "bad";

  return (
    <div style={{ display: "flex", width: "100%" }}>
      <Cell w={50}><S c="mute">#</S><S c="fg" bold>{r.id}</S></Cell>
      <Cell w={50}><S c="mute">{r.date}</S></Cell>
      <Cell w={130}><S c="fg">{r.model}</S></Cell>
      <Cell w={110}><S c="cyn">{r.pack}</S></Cell>
      <Cell w={40} right><S c="mute">{r.cases}</S></Cell>
      <Cell w={50} right><S c={scoreColor} bold>{r.score.toFixed(2)}</S></Cell>
      <Cell w={60} right><S c={r.cost === 0 ? "good" : "fg"}>{r.cost === 0 ? "$0.00" : `$${r.cost.toFixed(3)}`}</S></Cell>
      <Cell w={60} right><S c="mute">{r.ms}</S></Cell>
      <Cell w={30}>{" "}{statusMark}</Cell>
    </div>
  );
}

// =====================================================================
// Drill-in panel — per-case results for the selected run
// =====================================================================

function DrillIn({ run, cases }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
      <Panel title={`run #${run.id}`} badge={`${run.model} · ${run.pack}`} box="rounded">
        <PRow>
          <div style={{ display: "flex", gap: 18 }}>
            <span><S c="mute">score </S><S c="acc" bold>{run.score.toFixed(2)}</S><S c="mute">/10</S></span>
            <span><S c="mute">cost  </S><S c={run.cost === 0 ? "good" : "fg"}>{run.cost === 0 ? "$0.00" : `$${run.cost.toFixed(3)}`}</S></span>
            <span><S c="mute">time  </S><S c="fg">{run.ms} ms</S></span>
            <span><S c="mute">cases </S><S c="fg">{run.cases}</S></span>
          </div>
        </PRow>
        <PRow>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <S c="mute">distribution</S>
            <span className="spark acc" style={{ fontSize: 14 }}>{spark([5,7,8,9,9,8,9,9,9,10], "block")}</span>
            <S c="mute">5 → 10</S>
            <span style={{ flex: 1 }} />
            <S c="acc">{hbar(run.score, 10, 14, "block")}</S>
          </div>
        </PRow>
      </Panel>

      <Panel title="cases" badge={`${cases.length} of ${run.cases}`} box="rounded">
        <PRow>
          <Row>
            <Cell w={28}><S c="mute"> #</S></Cell>
            <Cell w={70}><S c="mute">category</S></Cell>
            <Cell><S c="mute">prompt</S></Cell>
            <Cell w={50} right><S c="mute">score</S></Cell>
            <Cell w={26}>{" "}</Cell>
          </Row>
        </PRow>
        <PDiv box="sharp" />
        {cases.map(c => (
          <PRow key={c.n}>
            <Row>
              <Cell w={28}><S c="mute">{(c.n + ".").padStart(3, " ")}</S></Cell>
              <Cell w={70}><S c="cyn">{c.cat}</S></Cell>
              <Cell><S c="fg">{c.prompt}</S></Cell>
              <Cell w={50} right>
                <S c={c.score >= 9 ? "good" : c.score >= 8 ? "fg" : "warn"} bold>
                  {c.score.toFixed(1)}
                </S>
              </Cell>
              <Cell w={26}>{" "}{c.ok ? <S c="good">✓</S> : <S c="bad">✗</S>}</Cell>
            </Row>
          </PRow>
        ))}
      </Panel>
    </div>
  );
}

// shared cell helpers (mirrored from home.jsx for self-containment)
function Row({ children }) {
  return <div style={{ display: "flex", width: "100%", alignItems: "baseline" }}>{children}</div>;
}
function Cell({ w, right, children }) {
  return (
    <span style={{
      width: w ? `${w}px` : undefined,
      flex: w ? "0 0 auto" : "1 1 auto",
      textAlign: right ? "right" : "left",
      overflow: "hidden", whiteSpace: "pre",
    }}>
      {children}
    </span>
  );
}

Object.assign(window, { RunsScreen });
