# OpenViking Setup - Complete!

**Date:** 2026-03-31  
**Status:** ✅ Installed & Configured

---

## ✅ Installation Complete

### **Python Package:**
```bash
python3 -m pip install openviking
# Version: 0.3.1 ✅
```

### **Configuration:**
- **Location:** `~/.openviking/ov.conf`
- **Workspace:** `~/.openviking/workspace/`

**Config includes:**
- Embedding: OpenAI text-embedding-3-large
- VLM: Claude 3.5 Sonnet (via LiteLLM)
- Storage workspace configured
- Logging to stdout

---

## 🚀 Next Steps

### **1. Add API Keys:**

Edit `~/.openviking/ov.conf` and replace placeholders:
```bash
# OpenAI API key (for embeddings)
"api_key": "your-openai-key"

# Anthropic API key (for VLM)
"api_key": "your-anthropic-key"
```

### **2. Start Server:**

```bash
export OPENVIKING_CONFIG_FILE=~/.openviking/ov.conf
openviking-server
```

Or in background:
```bash
nohup openviking-server > ~/.openviking/logs/server.log 2>&1 &
```

### **3. Add Verdict Knowledge:**

```bash
# Add verdict repo
ov add-resource ~/verdict

# Add GitHub repo
ov add-resource https://github.com/hnshah/verdict

# Browse
ov ls viking://resources/
ov tree viking://resources/verdict -L 2
```

### **4. Test Retrieval:**

```bash
# Semantic search
ov find "how to add new eval pack"

# Grep within directory
ov grep "auto-contribute" --uri viking://resources/verdict
```

---

## 📋 CLI Tool (Optional - Requires Cargo)

**To install CLI:**
```bash
# Install Rust/Cargo first
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install ov CLI
cargo install --git https://github.com/volcengine/OpenViking ov_cli
```

**For now:** Python server works fine without CLI!

---

## 🔗 OpenClaw Integration

**Once server is running:**

1. Install OpenClaw plugin (from OpenViking repo)
2. Configure OpenClaw to use OpenViking
3. Automatic context management!

**Benefits:**
- 83-92% token savings
- Better context retrieval
- Agent gets smarter over time

---

## 📊 Expected Benefits (Based on Benchmarks)

**Before (OpenClaw alone):**
- Task completion: 35.65%
- Input tokens: 24.6M

**After (OpenClaw + OpenViking):**
- Task completion: 52.08% (+46%)
- Input tokens: 4.3M (-83%)

**For our use cases:**
- Verdict knowledge organized
- OSS patterns remembered
- Dataset library accessible
- Massive token savings!

---

## ✅ Status

- [x] Python package installed (0.3.1)
- [x] Config created
- [x] Workspace directory ready
- [ ] API keys added (manual step)
- [ ] Server started
- [ ] CLI installed (optional)
- [ ] OpenClaw plugin configured

---

## 🎯 Quick Test

**Once API keys are added:**

```python
import openviking
from openviking import OVClient

# Connect to server
client = OVClient(url="http://localhost:1933")

# Add resource
client.add_resource("~/verdict")

# Search
results = client.find("auto-contribute feature")
print(results)
```

---

**OpenViking is ready to use once API keys are configured!** 🚀
