# Bot Handoff Checklist

## ✅ System Status

### Dashboard
- ✅ 10 evaluation runs with descriptive names
- ✅ 80 test cases
- ✅ 16 models
- ✅ All QA checks passing
- ✅ Live at https://hnshah.github.io/verdict/

### Test Coverage
- ✅ TypeScript: 307/307 tests passing (~50% coverage)
- ✅ Dashboard scripts: All working
- ✅ Data validation: Automated
- ✅ Pre-deployment QA: Automated

### Documentation
- ✅ WORKFLOW.md - Complete guide for adding runs
- ✅ DASHBOARD-MIGRATION.md - Migration notes
- ✅ All scripts documented inline

### Automation
- ✅ `quick-add-run.sh` - One-command add + deploy
- ✅ `test-all.sh` - Full test suite
- ✅ `audit-data.sh` - Data quality check
- ✅ `regenerate-dashboard-data.sh` - Rebuild dashboard
- ✅ Auto-commit and push on success

---

## 🤖 Bot Workflow

### Step 1: Run Eval
```bash
cd verdict-fork
npx verdict run --pack eval-packs/[pack-name].yaml --config verdict.yaml
```

**Available packs:**
- `code-generation.yaml` - 8 coding tasks
- `general.yaml` - 10 general cases
- `gsm8k.yaml` - 50 math word problems

### Step 2: Add to Dashboard
```bash
./quick-add-run.sh $(ls -t results/*.json | head -1)
```

**This automatically:**
1. Copies run to `dashboard/published/data/`
2. Regenerates `dashboard-data.json`
3. Rebuilds all pages
4. Runs QA checks
5. Commits and pushes to GitHub
6. Deploys to live site

### Step 3: Verify
Check https://hnshah.github.io/verdict/ in ~2 minutes

---

## ⚠️ Prerequisites for Bots

### Ollama Must Be Running
```bash
# Check if running
curl http://localhost:11434/api/tags

# Start if needed
ollama serve
```

### Models Must Be Pulled
```bash
# Check available models
ollama list

# Pull if needed
ollama pull qwen2.5:7b
ollama pull phi4
# etc.
```

### Git Configured
```bash
# Should already be set, but verify:
git config user.name
git config user.email
```

---

## 🧪 Test Run (For New Bots)

```bash
# 1. Clone and setup
cd ~/.openclaw/workspace
git clone https://github.com/hnshah/verdict.git verdict-bot-test
cd verdict-bot-test
npm install

# 2. Run small eval
npx verdict run --pack eval-packs/general.yaml --config verdict.yaml

# 3. Add to dashboard (dry run)
./quick-add-run.sh $(ls -t results/*.json | head -1)

# If it works, you're ready!
```

---

## 📊 Current Dashboard State

**10 Runs:**
1. Qwen vs Llama Comparison (2 models, 10 cases)
2. Code Models Benchmark (4 models, 10 cases)
3. Popular 7B Models Comparison (3 models, 10 cases)
4. 5 Models - 50 Cases (5 models, 50 cases)
5. Comprehensive Benchmark (10 models, 10 cases)
6. 7B Models Re-test (3 models, 10 cases)
7. Qwen Family + Phi4 + Gemma2 (4 models, 10 cases)
8. phi4 - 10 cases (1 model, 10 cases)
9. 3 Model Comparison (3 models, 10 cases)
10. Verdict Auto-Dashboard (5 models, 20 cases)

**16 Models:** deepseek-coder:6.7b, gemma2:9b, llama3.1:70b, llama3.2:3b, llama3.3:70b, mathstral:7b, mistral:7b, phi3.5:3.8b, phi4:14b, qwen2.5-coder:7b, qwen2.5:14b, qwen2.5:32b, qwen2.5:7b, smollm2:1.7b, starcoder2:7b, tinyllama:latest

---

## 🐛 Troubleshooting

### Eval hangs after "Pre-loading models"
- Check Ollama is responding: `curl http://localhost:11434/api/tags`
- Restart Ollama: `pkill ollama && ollama serve`

### "Connection error" in results
- Ollama not running or model not loaded
- Don't add these runs (quick-add-run will skip them)

### Git push fails
- Pull first: `git pull --rebase origin main`
- Then push: `git push origin main`

### Dashboard shows wrong data
- Re-run: `./regenerate-dashboard-data.sh`
- Rebuild: `cd dashboard/build && ./rebuild-all.sh`

---

## ✅ Ready for Handoff

Everything is automated and tested. Bots can:
1. Run evals with `npx verdict run`
2. Add to dashboard with `./quick-add-run.sh`
3. Verify on live site

**No manual intervention needed!**
