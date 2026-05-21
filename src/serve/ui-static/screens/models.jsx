/* global React, Panel, PRow, PDiv, S, TabBar, hbar */

const { useState: useStateM } = React;

function ModelsScreen({ data, theme, navigate }) {
  const first = (data.configured && data.configured[0]) || { id: "" };
  const [selected, setSelected] = useState(first.id);
  const [showDiscovery, setShowDiscovery] = useState(true);

  if (!data.configured || data.configured.length === 0) {
    return (
      <>
        <TabBar active={3} theme={theme} onNavigate={navigate} />
        <div style={{ height: 8 }} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
          <S c="acc" bold>no models configured yet</S>
          <S c="mute">run <S c="fg" bold>verdict init</S> then <S c="fg" bold>verdict run</S> to see this screen populate</S>
        </div>
      </>
    );
  }

  return (
    <>
      <TabBar active={3} theme={theme} onNavigate={navigate} />
      <div style={{ height: 8 }} />

      <div style={{
        flex: 1, minHeight: 0,
        display: "grid",
        gridTemplateRows: showDiscovery ? "1.4fr 1fr" : "1fr",
        gap: 8,
      }}>
        <ConfiguredPanel
          models={data.configured}
          selected={selected}
          onSelect={setSelected}
          onToggle={() => setShowDiscovery(s => !s)}
          showDiscovery={showDiscovery}
        />
        {showDiscovery && <DiscoveryPanel discovered={data.discovered} />}
      </div>
    </>
  );
}

function ConfiguredPanel({ models, selected, onSelect, onToggle, showDiscovery }) {
  return (
    <Panel title="🧠 configured models" badge={`${models.length} in verdict.yaml`} box="rounded">
      <PRow>
        <Row>
          <Cell w={26}><S c="mute"> </S></Cell>
          <Cell w={150}><S c="mute">id</S></Cell>
          <Cell w={110}><S c="mute">provider</S></Cell>
          <Cell w={210}><S c="mute">endpoint</S></Cell>
          <Cell w={70}><S c="mute">latency</S></Cell>
          <Cell w={60}><S c="mute">status</S></Cell>
          <Cell><S c="mute">notes</S></Cell>
        </Row>
      </PRow>
      <PDiv box="sharp" />
      {models.map(m => {
        const isSel = m.id === selected;
        return (
          <PRow key={m.id} className={isSel ? "sel" : ""}>
            <div
              onClick={() => onSelect(m.id)}
              onMouseEnter={() => onSelect(m.id)}
              style={{ width: "100%", cursor: "pointer" }}
            >
              <Row>
                <Cell w={26}>
                  {isSel ? <S c="acc" bold>{"▸"}</S> : <span> </span>}
                </Cell>
                <Cell w={150}><S c="fg" bold>{m.id}</S></Cell>
                <Cell w={110}>
                  <ProviderBadge p={m.provider} />
                </Cell>
                <Cell w={210}><S c="mute">{m.base}</S></Cell>
                <Cell w={70}>
                  <S c={m.latency < 150 ? "good" : m.latency < 400 ? "fg" : "warn"}>
                    {m.latency} ms
                  </S>
                </Cell>
                <Cell w={60}>
                  {m.status === "ok"
                    ? <><S c="good">●</S> <S c="fg">ok</S></>
                    : <><S c="warn">●</S> <S c="warn">warn</S></>}
                </Cell>
                <Cell><S c="mute">{m.notes}</S></Cell>
              </Row>
            </div>
          </PRow>
        );
      })}
      <PDiv box="sharp" />
      <PRow>
        <span>
          <S c="mute">{"d "}</S>
          <S onClick={onToggle} className="ul"><S c="fg" bold>{showDiscovery ? "hide" : "show"} discovery</S></S>
          {"   "}
          <S c="warn">read-only · edit </S><S c="fg" bold>verdict.yaml</S><S c="warn"> to add/remove models</S>
        </span>
      </PRow>
    </Panel>
  );
}

function DiscoveryPanel({ discovered }) {
  return (
    <Panel title="🛰 discovery" badge="Ollama · MLX · OpenRouter · scanning…" box="rounded">
      <PRow>
        <Row>
          <Cell w={26}>{" "}</Cell>
          <Cell w={200}><S c="mute">id</S></Cell>
          <Cell w={110}><S c="mute">provider</S></Cell>
          <Cell w={80}><S c="mute">size</S></Cell>
          <Cell><S c="mute">host</S></Cell>
          <Cell w={40} right>{" "}</Cell>
        </Row>
      </PRow>
      <PDiv box="sharp" />
      {discovered.map(d => (
        <PRow key={d.id}>
          <Row>
            <Cell w={26}><S c="mute">[ ]</S></Cell>
            <Cell w={200}><S c="fg">{d.id}</S></Cell>
            <Cell w={110}><ProviderBadge p={d.provider} /></Cell>
            <Cell w={80}><S c="mute">{d.size}</S></Cell>
            <Cell><S c="mute">{d.host}</S></Cell>
            <Cell w={40} right><S c="mute">+</S></Cell>
          </Row>
        </PRow>
      ))}
      <PDiv joins={false} />
      <PRow>
        <span>
          <S c="mute">{"space "}</S><S c="fg">toggle</S>
          {"   "}
          <S c="mute">{"a "}</S><S c="fg">add selected</S>
          {"   "}
          <S c="mute">{"r "}</S><S c="fg">rescan</S>
        </span>
      </PRow>
    </Panel>
  );
}

function ProviderBadge({ p }) {
  const colors = {
    openai: "grn", anthropic: "mag", mistral: "orng",
    ollama: "cyn", mlx: "blu", openrouter: "yel",
  };
  return <S c={colors[p] || "fg"}>{p}</S>;
}

// shared cells (self-contained)
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

// alias to React.useState (uniform across screens regardless of load order)
const useState = React.useState;

Object.assign(window, { ModelsScreen });
