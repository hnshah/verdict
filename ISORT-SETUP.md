# isort Setup & Usage

**Status:** ✅ Configured and using!  
**Date:** 2026-03-30  
**Why:** Dogfooding for authentic OSS contributions

---

## What We Did

### 1. Added isort Configuration

**File:** `pyproject.toml`

```toml
[tool.isort]
profile = "black"
line_length = 88
multi_line_output = 3
include_trailing_comma = true
force_grid_wrap = 0
use_parentheses = true
ensure_newline_before_comments = true

# Group imports properly
known_third_party = ["torch", "transformers", "pypdfium2", "PIL"]
sections = ["FUTURE", "STDLIB", "THIRDPARTY", "FIRSTPARTY", "LOCALFOLDER"]
```

---

### 2. Cleaned Our Imports

**File:** `ocr-batch-processor.py`

**Before (unsorted, mixed):**
```python
import argparse
import json
import time
from pathlib import Path
from typing import List, Dict, Any, Optional
from concurrent.futures import ProcessPoolExecutor, as_completed
import torch
from transformers import LightOnOcrForConditionalGeneration, LightOnOcrProcessor
import pypdfium2 as pdfium
from PIL import Image
```

**After (sorted, grouped):**
```python
import argparse
import json
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional

import pypdfium2 as pdfium
import torch
from PIL import Image
from transformers import (
    LightOnOcrForConditionalGeneration,
    LightOnOcrProcessor,
)
```

**Changes:**
- ✅ Standard library imports grouped together
- ✅ Third-party imports grouped separately (with blank line)
- ✅ Alphabetical order within groups
- ✅ Multi-line imports formatted cleanly
- ✅ Typing imports sorted (Any, Dict, List, Optional)

---

## How to Use isort

### Install (if not already)

```bash
pip install isort
# or
pipx install isort
```

---

### Run on Files

**Check what would change:**
```bash
isort --check-only --diff ocr-batch-processor.py
```

**Apply changes:**
```bash
isort ocr-batch-processor.py
```

**Run on all Python files:**
```bash
isort *.py
```

---

### Pre-commit Hook (Optional)

**File:** `.pre-commit-config.yaml`

```yaml
repos:
  - repo: https://github.com/PyCQA/isort
    rev: 5.13.2
    hooks:
      - id: isort
        name: isort (python)
```

**Install:**
```bash
pip install pre-commit
pre-commit install
```

**Now:** isort runs automatically before every commit!

---

## Dogfooding Journey

### Phase 1: Setup ✅ (Today)

- [x] Add isort config to `pyproject.toml`
- [x] Clean existing imports in `ocr-batch-processor.py`
- [x] Commit changes
- [x] Document setup

---

### Phase 2: Daily Use (This Week)

**As we write Python:**
- Run isort on all new/modified files
- Experience the tool as real users
- Notice any pain points or edge cases
- Understand user perspective

**Track:**
- What works well?
- What's confusing?
- What could be better?
- Any bugs or issues?

---

### Phase 3: Contribute (When Ready)

**When we find:**
- A real bug (not synthetic)
- An edge case from actual usage
- A feature we genuinely need
- Documentation that confused us

**Then:**
- Open issue with real-world context
- Submit PR with user perspective
- Reference our dogfooding experience
- Show we USE the tool we're improving

---

## Benefits We're Getting

### Immediate ✅

**Code Quality:**
- Cleaner, more readable imports
- Consistent style across Python files
- Easier to review changes
- Professional standard

**Example:**
- Before: Jumbled stdlib + third-party mixed
- After: Clean groups, alphabetical, formatted

---

### Long-term ✅

**Better Contributions:**
- Real user perspective (not guessing)
- Authentic issues (from actual usage)
- Stronger PRs (with real-world motivation)
- Maintainer respect (we use what we improve)

**Content Value:**
- Authentic story: "I fixed my daily tool"
- Relatable to developers
- Shows dogfooding process
- Proves commitment to OSS

---

## What to Track

### Usage Notes

**Keep a log of:**
1. Situations where isort helped
2. Edge cases it didn't handle well
3. Configuration confusion
4. Features we wished existed
5. Bugs we encountered

**Example entries:**
```
2026-03-30: Set up isort, cleaned ocr-batch-processor.py
  - Config took 5 min to understand
  - "profile = black" made it easy
  - Multi-line formatting is clean!
  
2026-04-01: Used on new data pipeline script
  - Automatically grouped imports correctly
  - Saved ~2 min of manual sorting
  - Love the typing.* alphabetical sort
  
2026-04-03: Found edge case - [describe]
  - This could be an issue to file!
```

---

## isort Tips

### Common Commands

**Check before committing:**
```bash
isort --check-only *.py
```

**See what would change:**
```bash
isort --diff ocr-batch-processor.py
```

**Dry run:**
```bash
isort --check-only --diff *.py
```

**Actually fix:**
```bash
isort *.py
```

---

### Configuration Tips

**Profile = black:**
- Matches Black formatter settings
- Line length 88
- Trailing commas
- Consistent with modern Python

**Sections:**
- FUTURE: `from __future__ import`
- STDLIB: Python standard library
- THIRDPARTY: pip-installed packages
- FIRSTPARTY: Our own modules
- LOCALFOLDER: Relative imports

---

## Next Steps

### This Week

**1. Write new Python code:**
- Use isort on every new file
- Experience the workflow
- Note any friction

**2. Find edge cases:**
- Complex import scenarios
- Multi-line imports
- Conditional imports
- Dynamic imports

**3. Document experience:**
- What works?
- What doesn't?
- What's confusing?

---

### When Ready to Contribute

**1. Check existing issues:**
```bash
# Search isort repo
gh issue list --repo PyCQA/isort --label "good first issue"
```

**2. Or file new issue:**
- Describe real-world scenario
- Show example from our usage
- Explain user impact
- Reference dogfooding

**3. Submit PR:**
- Start with "I use isort daily..."
- Explain the pain point from experience
- Show before/after from our code
- Demonstrate we're real users

---

## Success Metrics

### Code Quality ✅

- [ ] All Python files have sorted imports
- [ ] Consistent style across repo
- [ ] Clean diffs (imports don't clutter reviews)

### Dogfooding ✅

- [ ] Used isort for at least 1 week
- [ ] Documented usage experience
- [ ] Found genuine issue/improvement
- [ ] Understand user perspective deeply

### Contribution ✅

- [ ] Filed issue or PR to isort
- [ ] Referenced real-world usage
- [ ] Showed we're authentic users
- [ ] Created content about journey

---

## Resources

**isort Documentation:**
- https://pycqa.github.io/isort/
- Configuration: https://pycqa.github.io/isort/docs/configuration/config_files.html

**Our Config:**
- `verdict/pyproject.toml` - isort settings

**Contribution Guide:**
- https://github.com/PyCQA/isort/blob/main/CONTRIBUTING.md

---

**Status:** Setup complete! Now using isort daily. ✅  
**Next:** Track usage, find genuine issues, contribute authentically.
