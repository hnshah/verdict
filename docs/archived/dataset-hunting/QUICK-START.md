# Dataset Conversion Quick Start

## Install Dependencies

```bash
pip install datasets pyyaml
```

## Convert Top 5 Datasets (Phase 1)

### 1. MMLU (Sample 100 from 15K)
```bash
python dataset-hunting/convert-datasets.py mmlu --sample 100
# Creates: eval-packs/mmlu-hf.yaml (100 questions across subjects)
```

### 2. GSM8K (Sample 50 from 8.5K)
```bash
python dataset-hunting/convert-datasets.py gsm8k --sample 50
# Creates: eval-packs/gsm8k-hf.yaml (50 math problems)
```

### 3. HellaSwag (Sample 100 from 70K)
```bash
python dataset-hunting/convert-datasets.py hellaswag --sample 100
# Creates: eval-packs/hellaswag-hf.yaml (100 commonsense reasoning)
```

### 4. ARC-Challenge (Sample 50 from 2.6K)
```bash
python dataset-hunting/convert-datasets.py arc --sample 50
# Creates: eval-packs/arc-hf.yaml (50 science questions)
```

### 5. TruthfulQA (All 817 questions)
```bash
python dataset-hunting/convert-datasets.py truthfulqa
# Creates: eval-packs/truthfulqa-hf.yaml (817 truthfulness tests)
```

## Run Converted Datasets

```bash
# Run with auto-contribute enabled
verdict run -c verdict-auto-dashboard.yaml --pack eval-packs/mmlu-hf.yaml
verdict run -c verdict-auto-dashboard.yaml --pack eval-packs/gsm8k-hf.yaml
verdict run -c verdict-auto-dashboard.yaml --pack eval-packs/hellaswag-hf.yaml
verdict run -c verdict-auto-dashboard.yaml --pack eval-packs/arc-hf.yaml
verdict run -c verdict-auto-dashboard.yaml --pack eval-packs/truthfulqa-hf.yaml
```

## Batch Convert All

```bash
for dataset in mmlu gsm8k hellaswag arc truthfulqa; do
  python dataset-hunting/convert-datasets.py $dataset --sample 50
done
```

## Sample Sizes Recommended

- **MMLU** (15K total): Sample 50-200 (covers 57 subjects)
- **GSM8K** (8.5K total): Sample 50-100 (math problems)
- **HellaSwag** (70K total): Sample 100-200 (commonsense)
- **ARC** (2.6K total): Sample 50-100 (science)
- **TruthfulQA** (817 total): Use all or sample 100

## Next Steps

After conversion, datasets auto-flow to dashboard:
1. Convert datasets ✅
2. Run with auto-contribute ✅
3. Dashboard updates automatically ✅
4. Beautiful results with Brief design ✅

🎯 **Go nuts!**
