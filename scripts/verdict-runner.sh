#!/bin/bash
#
# verdict-runner.sh
# Scheduled runner for the Verdict 24/7 Local Eval Machine.
#
# Usage:
#   ./scripts/verdict-runner.sh --local --model qwen2.5:7b --pack general
#   ./scripts/verdict-runner.sh --auto --since 24 --max-models 3 --pack comprehensive-mix
#

set -euo pipefail

DEFAULT_ENDPOINT="http://localhost:11434/v1"
DEFAULT_PACK="comprehensive-mix"
DEFAULT_CONFIG="./verdict.yaml"
VERDICT_BIN="${VERDICT_BIN:-verdict}"
RESULTS_DIR="results"

ENDPOINT="$DEFAULT_ENDPOINT"
MODEL=""
PACK="$DEFAULT_PACK"
CONFIG="$DEFAULT_CONFIG"
AUTO="0"
SINCE="24"
MAX_MODELS="3"

usage() {
  sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
}

verdict_cli() {
  if command -v "$VERDICT_BIN" >/dev/null 2>&1; then
    "$VERDICT_BIN" "$@"
  elif [[ -f dist/cli/index.js ]]; then
    node dist/cli/index.js "$@"
  else
    npm run -s dev -- "$@"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --local)
      ENDPOINT="$DEFAULT_ENDPOINT"
      shift
      ;;
    --endpoint)
      ENDPOINT="$2"
      shift 2
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --pack)
      PACK="$2"
      shift 2
      ;;
    --config)
      CONFIG="$2"
      shift 2
      ;;
    --auto)
      AUTO="1"
      shift
      ;;
    --since)
      SINCE="$2"
      shift 2
      ;;
    --max-models)
      MAX_MODELS="$2"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! [[ "$SINCE" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "--since must be a non-negative number of hours" >&2
  exit 1
fi

if ! [[ "$MAX_MODELS" =~ ^[0-9]+$ ]]; then
  echo "--max-models must be a non-negative integer" >&2
  exit 1
fi

mkdir -p "$RESULTS_DIR" .context/tmp
TMP_DIR=$(mktemp -d .context/tmp/verdict-runner.XXXXXX)
trap 'rm -rf "$TMP_DIR"' EXIT

resolve_pack() {
  local pack="$1"
  if [[ -f "$pack" ]]; then
    printf '%s\n' "$pack"
  elif [[ -f "eval-packs/$pack.yaml" ]]; then
    printf '%s\n' "eval-packs/$pack.yaml"
  elif [[ -f "eval-packs/$pack.yml" ]]; then
    printf '%s\n' "eval-packs/$pack.yml"
  else
    printf '%s\n' "$pack"
  fi
}

default_model_from_config() {
  node - "$CONFIG" <<'NODE'
const fs = require('fs');
const yaml = require('js-yaml');
const configPath = process.argv[2];
try {
  const config = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
  const first = (config.models || [])[0];
  process.stdout.write(first?.id || first?.model || 'llama3.1:8b');
} catch {
  process.stdout.write('llama3.1:8b');
}
NODE
}

create_run_config() {
  local model="$1"
  local provider="$2"
  local base_url="$3"
  local output="$4"

  node - "$CONFIG" "$model" "$provider" "$base_url" "$RESULTS_DIR" "$output" <<'NODE'
const fs = require('fs');
const yaml = require('js-yaml');
const [configPath, modelName, provider, baseUrl, resultsDir, outputPath] = process.argv.slice(2);

let base = {};
try {
  base = yaml.load(fs.readFileSync(configPath, 'utf8')) || {};
} catch {}

const models = Array.isArray(base.models) ? base.models : [];
const existingTarget = models.find(m => m.id === modelName || m.model === modelName);
const target = {
  ...(existingTarget || {}),
  id: modelName,
  provider: existingTarget?.provider || provider || 'ollama',
  model: existingTarget?.model || modelName,
  base_url: existingTarget?.base_url || baseUrl || 'http://localhost:11434/v1',
  api_key: existingTarget?.api_key || 'none',
  tags: existingTarget?.tags || ['local', 'auto'],
};

const config = {
  version: base.version || '1.0',
  name: `Scheduled ${modelName}`,
  models: [target],
  judge: {
    ...(base.judge || {}),
    model: target.id,
  },
  packs: base.packs || ['./eval-packs/general.yaml'],
  run: {
    concurrency: 1,
    retries: base.run?.retries ?? 2,
    cache: base.run?.cache ?? true,
  },
  output: {
    dir: resultsDir,
    formats: ['json', 'markdown'],
    delta: true,
  },
};

fs.writeFileSync(outputPath, yaml.dump(config, { lineWidth: 120 }));
NODE
}

dashboard_has_recent_run() {
  local id="$1"
  local model="$2"
  local since_hours="$3"

  node - "$id" "$model" "$since_hours" "$RESULTS_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');
const [id, model, sinceHoursRaw, resultsDir] = process.argv.slice(2);
const sinceHours = Number(sinceHoursRaw);
const cutoff = Date.now() - sinceHours * 60 * 60 * 1000;
const names = new Set([id, model].filter(Boolean));

function parseTime(value) {
  if (!value) return 0;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function runMentionsModel(run) {
  if ((run.models || []).some(name => names.has(name))) return true;
  if (run.summary && Object.keys(run.summary).some(name => names.has(name))) return true;
  return (run.cases || []).some(c => {
    const responses = Object.keys(c.responses || {});
    const scores = Object.keys(c.scores || {});
    return responses.some(name => names.has(name)) || scores.some(name => names.has(name));
  });
}

function checkRunFile(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const timestamp = parseTime(data.timestamp);
    return timestamp >= cutoff && runMentionsModel(data);
  } catch {
    return false;
  }
}

if (fs.existsSync(resultsDir)) {
  for (const file of fs.readdirSync(resultsDir)) {
    if (file.endsWith('.json') && checkRunFile(path.join(resultsDir, file))) process.exit(0);
  }
}

try {
  const dashboard = JSON.parse(fs.readFileSync('dashboard-data.json', 'utf8'));
  for (const caseData of dashboard.cases || []) {
    for (const run of caseData.runs || []) {
      const timestamp = parseTime(run.run_meta?.timestamp || run.timestamp || run.run_id);
      if (timestamp < cutoff) continue;
      const responses = Object.keys(run.responses || {});
      const scores = Object.keys(run.scores || {});
      if (responses.some(name => names.has(name)) || scores.some(name => names.has(name))) process.exit(0);
    }
  }
} catch {}

process.exit(1);
NODE
}

write_skip_record() {
  local timestamp="$1"
  local catalog_json="$TMP_DIR/catalog.json"
  local output="$RESULTS_DIR/skipped_models_${timestamp}.json"

  if ! verdict_cli models catalog --json > "$catalog_json"; then
    echo "warning: could not collect model catalog skip data" >&2
    return
  fi

  node - "$catalog_json" "$output" "$timestamp" <<'NODE'
const fs = require('fs');
const [catalogPath, outputPath, timestamp] = process.argv.slice(2);
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const skipped = (catalog.models || [])
  .filter(model => model.fit && !model.fit.fits)
  .map(model => ({
    name: model.name,
    reason: model.fit.reason || 'does not fit this hardware',
    needs_gb: model.fit.needs_gb,
    available_gb: model.fit.available_gb,
  }));

if (skipped.length === 0) process.exit(0);

fs.writeFileSync(outputPath, JSON.stringify({
  run_id: `skipped-models-${timestamp}`,
  name: 'Models skipped on this hardware',
  timestamp: new Date().toISOString(),
  models: [],
  cases: [],
  summary: {},
  skipped_models: skipped,
}, null, 2));
NODE
}

PACK_PATH=$(resolve_pack "$PACK")
if [[ -f "$PACK_PATH" ]]; then
  PACK_PATH="$(cd "$(dirname "$PACK_PATH")" && pwd)/$(basename "$PACK_PATH")"
fi
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")

echo "Verdict Runner"
echo "  Pack: $PACK_PATH"
echo "  Config: $CONFIG"

if [[ "$AUTO" == "1" ]]; then
  echo "  Mode: auto"
  echo "  Since: $SINCE hours"
  echo "  Max models: $MAX_MODELS"
  echo ""

  write_skip_record "$TIMESTAMP"

  if [[ "$MAX_MODELS" -eq 0 ]]; then
    echo "Auto run complete"
    echo "  ran: 0"
    echo "  skipped recent: 0"
    echo "  failed: 0"
    exit 0
  fi

  DISCOVERED="$TMP_DIR/discovered.json"
  verdict_cli models discover --json > "$DISCOVERED"

  ran=0
  skipped_recent=0
  failed=0

  while IFS=$'\t' read -r discovered_id discovered_model discovered_provider discovered_base_url; do
    [[ -z "$discovered_model" ]] && continue
    if [[ "$ran" -ge "$MAX_MODELS" ]]; then
      break
    fi

    if dashboard_has_recent_run "$discovered_id" "$discovered_model" "$SINCE"; then
      echo "skip recent: $discovered_model"
      skipped_recent=$((skipped_recent + 1))
      continue
    fi

    RUN_CONFIG="$TMP_DIR/${discovered_model//[^a-zA-Z0-9._-]/_}.yaml"
    create_run_config "$discovered_model" "$discovered_provider" "$discovered_base_url" "$RUN_CONFIG"

    echo "run: $discovered_model"
    if verdict_cli run -c "$RUN_CONFIG" -p "$PACK_PATH"; then
      ran=$((ran + 1))
    else
      failed=$((failed + 1))
      echo "failed: $discovered_model" >&2
    fi
  done < <(node - "$DISCOVERED" <<'NODE'
const fs = require('fs');
process.stdout.on('error', () => process.exit(0));
const models = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const model of models) {
  process.stdout.write([
    model.id || '',
    model.model || '',
    model.provider || '',
    model.base_url || '',
  ].join('\t') + '\n');
}
NODE
)

  echo ""
  echo "Auto run complete"
  echo "  ran: $ran"
  echo "  skipped recent: $skipped_recent"
  echo "  failed: $failed"
  exit 0
fi

if [[ -z "$MODEL" ]]; then
  MODEL=$(default_model_from_config)
fi

echo "  Mode: single"
echo "  Endpoint: $ENDPOINT"
echo "  Model: $MODEL"
echo ""

RUN_CONFIG="$TMP_DIR/${MODEL//[^a-zA-Z0-9._-]/_}.yaml"
create_run_config "$MODEL" "ollama" "$ENDPOINT" "$RUN_CONFIG"
verdict_cli run -c "$RUN_CONFIG" -p "$PACK_PATH"

echo "Run finished"
