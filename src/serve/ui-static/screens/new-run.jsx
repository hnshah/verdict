/* global React, Panel, PRow, PDiv, S, TabBar, hbar, spark */

function NewRunScreen({ data, theme, navigate }) {
  // Read-only dashboard — the picker visualises configured models but does
  // not launch a run. The bottom strip surfaces the CLI command to copy
  // instead of a launch button.
  const [focus, setFocus] = React.useState("models"); // 'models' | 'packs'
  const [pickedModels, setPickedModels] = React.useState(
    new Set((data.configured || []).slice(0, 3).map(c => c.id))
  );
  const [pickedPacks, setPickedPacks] = React.useState(new Set());
  const running = false;
  const progress = 0;

  const toggle = (set, val) => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    return next;
  };

  const totalCases = (data.packs || [])
    .filter(p => pickedPacks.has(p.id))
    .reduce((s, p) => s + p.cases, 0) * pickedModels.size;
  const estCost = totalCases * 0.006;
  // CLI snippet derived from the selection
  const modelArg = pickedModels.size > 0 ? ` --models "${[...pickedModels].join(",")}"` : "";
  const packArg = pickedPacks.size > 0 ? ` --pack ${[...pickedPacks].join(",")}` : "";
  const cliCmd = `verdict run${packArg}${modelArg}`;

  return (
    <>
      <TabBar active={2} tabs={["Home","Runs","Models","Baselines","Daemon","Packs"]} theme={theme} onNavigate={navigate} />
      <div style={{ height: 4 }} />
      {/* breadcrumb */}
      <div style={{ padding: "0 6px", marginBottom: 6 }}>
        <S c="mute">runs › </S><S c="acc" bold>new run</S>
        <span style={{ marginLeft: 18 }}>
          <S c="mute">space</S> <S c="fg">toggle selection</S>{"  "}
          <S c="warn">read-only · use the CLI to actually run</S>
        </span>
      </div>

      <div style={{
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 8,
      }}>
        <PickerPanel
          title="🧠 models"
          items={data.configured.map(c => ({ id: c.id, sub: c.provider, latency: c.latency }))}
          picked={pickedModels}
          onToggle={id => setPickedModels(p => toggle(p, id))}
          active={focus === "models"}
          onFocus={() => setFocus("models")}
          countLabel={`${pickedModels.size} of ${data.configured.length} selected`}
        />
        <PickerPanel
          title="📦 eval packs"
          items={data.packs.map(p => ({ id: p.id, sub: p.category, cases: p.cases }))}
          picked={pickedPacks}
          onToggle={id => setPickedPacks(p => toggle(p, id))}
          active={focus === "packs"}
          onFocus={() => setFocus("packs")}
          countLabel={`${pickedPacks.size} of ${data.packs.length} selected`}
          rightLabel="cases"
          rightField="cases"
        />
      </div>

      <div style={{ height: 6 }} />

      {/* Summary + CLI command strip (read-only dashboard) */}
      <Panel title="run from the CLI" badge="dashboard is read-only" box="rounded">
        <PRow>
          <div style={{ display: "flex", gap: 22, alignItems: "baseline" }}>
            <span><S c="mute">models  </S><S c="acc" bold>{pickedModels.size}</S></span>
            <span><S c="mute">packs   </S><S c="acc" bold>{pickedPacks.size}</S></span>
            <span><S c="mute">cases   </S><S c="fg" bold>{totalCases}</S></span>
            <span><S c="mute">est $   </S><S c={estCost === 0 ? "good" : "warn"}>{estCost === 0 ? "$0.00" : `$${estCost.toFixed(2)}`}</S></span>
          </div>
        </PRow>
        <PDiv joins={false} />
        <PRow>
          <div>
            <S c="mute">copy this into your terminal:</S>
          </div>
        </PRow>
        <PRow>
          <div style={{
            background: "var(--bg-3)",
            padding: "4px 10px",
            borderLeft: "2px solid var(--accent)",
            fontFamily: "var(--tui-font)",
          }}>
            <S c="acc" bold>$ </S><S c="fg">{cliCmd}</S>
          </div>
        </PRow>
        <PRow>
          <S c="mute">→ refreshes the dashboard automatically when the run finishes.</S>
        </PRow>
      </Panel>
    </>
  );
}

function PickerPanel({ title, items, picked, onToggle, active, onFocus, countLabel, rightLabel, rightField }) {
  return (
    <div onClick={onFocus} style={{ minHeight: 0, display: "flex" }}>
      <Panel
        title={title}
        badge={countLabel}
        box="rounded"
        color={active ? "acc" : "fg-mute"}
      >
        <PRow>
          <Row>
            <Cell w={28}>{" "}</Cell>
            <Cell><S c="mute">name</S></Cell>
            <Cell w={120}><S c="mute">provider</S></Cell>
            <Cell w={60} right>
              {rightLabel ? <S c="mute">{rightLabel}</S> : <S c="mute">latency</S>}
            </Cell>
          </Row>
        </PRow>
        <PDiv box="sharp" />
        {items.map((it, i) => {
          const on = picked.has(it.id);
          return (
            <PRow key={it.id} className={on && active ? "hi" : ""}>
              <div
                onClick={(e) => { e.stopPropagation(); onFocus(); onToggle(it.id); }}
                style={{ width: "100%", cursor: "pointer" }}
              >
                <Row>
                  <Cell w={28}>
                    <S c={on ? "good" : "mute"} bold>{on ? "[×]" : "[ ]"}</S>
                  </Cell>
                  <Cell><S c="fg" bold>{it.id}</S></Cell>
                  <Cell w={120}><S c="cyn">{it.sub}</S></Cell>
                  <Cell w={60} right>
                    {rightField === "cases"
                      ? <S c="mute">{it.cases}</S>
                      : <S c={it.latency < 150 ? "good" : "fg"}>{it.latency}ms</S>}
                  </Cell>
                </Row>
              </div>
            </PRow>
          );
        })}
      </Panel>
    </div>
  );
}

function ProgressRow({ progress, totalCases }) {
  const done = Math.floor((progress / 100) * totalCases);
  const width = 36;
  const fill = Math.floor((progress / 100) * width);
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
      <S c="mute">progress</S>
      <S c="acc" bold>{"█".repeat(fill)}</S>
      <S c="line">{"░".repeat(width - fill)}</S>
      <S c="fg" bold>{progress.toFixed(0)}%</S>
      <S c="mute">{done}/{totalCases} cases</S>
      <span style={{ flex: 1 }} />
      <S c="mute">eta</S>{" "}<S c="fg">{Math.max(0, Math.ceil((100 - progress) * 0.2))}s</S>
    </div>
  );
}

function LiveStream({ progress, models, packs }) {
  // simulate per-model streaming completion bars
  const perModel = models.map((m, i) => {
    const offset = i * 8;
    const p = Math.max(0, Math.min(100, progress * 1.2 - offset));
    return { id: m, p };
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {perModel.map(m => (
        <div key={m.id} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <S c="cyn">{"›"}</S>
          <span style={{ width: 130 }}><S c="fg">{m.id}</S></span>
          <S c="acc">{"█".repeat(Math.floor(m.p / 4))}</S>
          <S c="line">{"░".repeat(25 - Math.floor(m.p / 4))}</S>
          <S c="mute">{m.p.toFixed(0)}%</S>
          <span style={{ flex: 1 }} />
          <S c="mute">on pack</S>{" "}<S c="cyn">{packs[Math.floor(m.p / 50) % packs.length] || packs[0]}</S>
        </div>
      ))}
    </div>
  );
}

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
    }}>{children}</span>
  );
}

Object.assign(window, { NewRunScreen });
