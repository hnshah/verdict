# TimesFM Analysis - Google's Time Series Foundation Model

**Date:** 2026-03-31  
**Source:** https://github.com/google-research/timesfm  
**Paper:** https://arxiv.org/abs/2310.10688 (ICML 2024)

---

## 🎯 What Is TimesFM?

**TimesFM (Time Series Foundation Model)** - Google Research's pretrained foundation model for time-series forecasting.

**Think:** "GPT but for predicting numbers over time"

---

## 📊 Key Specs (Version 2.5)

**Model Size:** 200M parameters (down from 500M in v2.0)  
**Context Length:** Up to 16K points (up from 2K)  
**Horizon:** Up to 1K forecast points  
**Training Data:** 400 billion real-world time-points  
**Zero-Shot:** Works without retraining on your data!

**Architecture:**
- Decoder-only transformer (like GPT)
- Continuous quantile forecast (uncertainty quantification)
- 30M parameter quantile head (optional)
- No frequency indicator needed

---

## 🚀 What It Does

**Input:** Historical time series data (any domain, any frequency)  
**Output:** Future predictions with confidence intervals

**Example Use Cases:**

### 📈 Business/Analytics:
- Sales forecasting
- Demand prediction
- Revenue projections
- User growth forecasting
- Metric trending

### 💻 Tech/DevOps:
- Server load prediction
- Resource usage forecasting
- Traffic prediction
- Anomaly detection
- Capacity planning

### 🤖 AI/ML Ops:
- Model performance trending
- Token usage forecasting
- Cost prediction
- Latency trending
- Error rate prediction

### 🎯 Benchmarking:
- LLM performance trending
- Benchmark score prediction
- Eval result forecasting
- Model degradation detection

---

## 💡 Why It's Interesting

### **Zero-Shot Forecasting:**
No training needed! Just give it your historical data and it predicts the future.

**Trained on 400B time-points from:**
- Retail
- Finance
- Energy
- Web traffic
- And many more domains

**This means:** It understands general time series patterns across domains.

### **Small & Fast:**
- 200M params (runs on CPU/GPU, not just cloud)
- 16K context (can look at a lot of history)
- Quantile forecasts (tells you confidence/uncertainty)

### **Open Source:**
- Apache 2.0 license
- Available on HuggingFace
- PyTorch & Flax (JAX) versions
- Easy pip install

---

## 🔧 How to Use

### Installation:
```bash
pip install timesfm
```

### Basic Usage:
```python
import timesfm
import numpy as np

# Load pretrained model
model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
    "google/timesfm-2.5-200m-pytorch"
)

# Configure forecasting
model.compile(
    timesfm.ForecastConfig(
        max_context=1024,
        max_horizon=256,
        normalize_inputs=True,
        use_continuous_quantile_head=True,
    )
)

# Forecast (zero-shot!)
point_forecast, quantile_forecast = model.forecast(
    horizon=12,  # Predict next 12 points
    inputs=[
        np.array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),  # Your historical data
    ],
)

# point_forecast: (1, 12) - next 12 values
# quantile_forecast: (1, 12, 10) - 10th-90th percentile confidence
```

**That's it! No training, no hyperparameters, no domain expertise.**

---

## 🎯 Potential Uses for Us

### 1. **Verdict Dashboard - Model Performance Trending**
**What:** Predict future LLM benchmark scores based on historical evals

**Input:** Past eval scores for a model (e.g., phi4's GSM8K scores over time)  
**Output:** Predicted future scores + confidence intervals

**Use Case:**
- Detect model degradation early
- Predict when a model will hit a threshold
- Compare expected vs actual performance
- Spot anomalies (sudden drops/gains)

**Example:**
```python
# Historical phi4 scores on GSM8K
history = [9.2, 9.3, 9.4, 9.3, 9.5, 9.4, 9.6, 9.5]

# Predict next 5 eval scores
forecast = model.forecast(horizon=5, inputs=[history])
# -> [9.55, 9.57, 9.58, 9.59, 9.60] ± confidence
```

### 2. **PR Review Time Prediction**
**What:** Forecast how long until a PR gets reviewed/merged

**Input:** Historical PR review times for a repo  
**Output:** Expected review time for new PR

**Use Case:**
- Set realistic expectations
- Identify stale PRs earlier
- Optimize contribution timing

### 3. **OSS Contribution Success Rate Trending**
**What:** Predict future PR acceptance rates

**Input:** Historical acceptance rates per repo  
**Output:** Forecasted acceptance probability

**Use Case:**
- Identify repos becoming less welcoming
- Spot reputation trends
- Time contributions better

### 4. **Eval Run Duration Forecasting**
**What:** Predict how long verdict evals will take

**Input:** Historical run times for different configs  
**Output:** Expected runtime for new eval

**Use Case:**
- Better scheduling
- Resource planning
- Cost estimation

### 5. **Dashboard Traffic Prediction**
**What:** Forecast dashboard views/usage

**Input:** Historical GitHub Pages traffic  
**Output:** Expected future traffic

**Use Case:**
- Capacity planning
- Content planning
- Growth tracking

---

## 🎨 Integration Ideas

### **Verdict Dashboard:**

**Add "Trending" Section:**
```markdown
## Model Performance Trends

**phi4:**
- Current: 9.6/10 (GSM8K)
- 30-day forecast: 9.7 ± 0.2
- Trend: ↗ Improving (+2.1%)

**qwen-coder:**
- Current: 9.0/10
- 30-day forecast: 8.9 ± 0.3
- Trend: ↘ Declining (-1.1%)
- ⚠ Alert: Below expected range
```

**Model Degradation Detection:**
- Automatically flag when actual scores diverge from forecast
- Alert when confidence intervals widen (instability)
- Detect unusual patterns

**Competitive Analysis:**
- Forecast which models will lead in 30/60/90 days
- Identify emerging trends
- Spot momentum shifts

### **PR/OSS Work:**

**Contribution Timing:**
- Forecast best times to submit PRs (based on historical review patterns)
- Predict maintainer availability
- Optimize for fastest review

**Repo Health Trending:**
- Track PR acceptance rate trends
- Forecast community engagement
- Identify repos to avoid/prioritize

---

## 🚧 Limitations

**What TimesFM CAN'T Do:**

1. **Explain WHY** - Only predicts WHAT, not causal reasoning
2. **Handle Regime Changes** - Assumes future ~ past patterns
3. **Zero-Knowledge Domains** - Needs some historical data (not totally zero-shot)
4. **Discrete Events** - Better for smooth trends than sudden jumps
5. **External Factors** - Doesn't know about launches, announcements, etc.

**When NOT to Use:**
- Predicting one-off events
- New products with no history
- Rapid regime changes (e.g., model architecture breakthroughs)

---

## 📈 Comparison to Alternatives

| Approach | Effort | Accuracy | Flexibility |
|----------|--------|----------|-------------|
| Manual extrapolation | Low | Low | High |
| Statistical (ARIMA) | Medium | Medium | Low |
| ML (XGBoost) | High | High | Medium |
| **TimesFM (Zero-Shot)** | **Very Low** | **Medium-High** | **High** |
| Fine-tuned TimesFM | Medium | Very High | Medium |

**TimesFM sweet spot:** Quick, decent forecasts without domain expertise or training.

---

## 🎯 Should We Use It?

### **Pros:**
- ✅ Zero-shot (no training needed)
- ✅ Open source (Apache 2.0)
- ✅ Small enough to run locally (200M params)
- ✅ Quantile forecasts (uncertainty quantification)
- ✅ Perfect for trending/dashboards
- ✅ Works across domains

### **Cons:**
- ❌ Not as accurate as domain-specific models
- ❌ Needs some historical data (not magic)
- ❌ Can't explain predictions
- ❌ Assumes stationary-ish patterns

### **Verdict:**

**YES, for dashboard trending & OSS workflow optimization!**

**Use Cases:**
1. ✅ Model performance trending on dashboard
2. ✅ Eval runtime prediction
3. ✅ PR review time forecasting
4. ✅ Contribution success rate trending

**Not For:**
- ❌ Critical decisions (use domain models)
- ❌ Explaining model behavior
- ❌ One-off predictions

---

## 🚀 Next Steps

### **Quick Win (30 min):**
1. Install timesfm
2. Load verdict eval results (scores over time)
3. Forecast next eval scores
4. Add "Trending" badge to dashboard

### **Medium Project (2-3 hours):**
1. Build trending analysis script
2. Generate forecasts for all models
3. Add trend arrows to dashboard
4. Detect anomalies/alerts

### **Long-term:**
1. Real-time trending on dashboard
2. PR timing optimizer
3. Repo health forecasting
4. Automated degradation alerts

---

## 📚 Resources

- **GitHub:** https://github.com/google-research/timesfm
- **Paper:** https://arxiv.org/abs/2310.10688
- **HuggingFace:** https://huggingface.co/google/timesfm-2.5-200m-pytorch
- **Blog:** https://research.google/blog/a-decoder-only-foundation-model-for-time-series-forecasting/
- **BigQuery Integration:** https://cloud.google.com/bigquery/docs/timesfm-model

---

## 💡 Bottom Line

**TimesFM is a GPT-like model for time series.**

**Perfect for:**
- Quick forecasts without training
- Dashboard trending features
- Performance monitoring
- Anomaly detection

**Not perfect for:**
- Critical business decisions
- Explaining predictions
- Regime changes

**For our use case (verdict dashboard + OSS workflow):** **Absolutely worth trying!** ✅

---

**Want to prototype a trending feature on the verdict dashboard?** 🚀
