# MLX Repository Opportunities

**Repo:** ml-explore/mlx  
**Stars:** 24.9K  
**Description:** MLX: An array framework for Apple silicon  
**Assessed:** 2026-03-31 00:18 PT

---

## Repository Health

**Activity:** ✅ Very Active
- 20+ open issues (March 2026)
- Recent issues from yesterday
- Maintainer engagement visible

**Community:** ✅ Strong
- 24.9K stars
- Active issues/PRs
- Apple-backed project

**Labels:** ❌ No "good first issue" labels
- Makes discovery harder
- Need to evaluate each issue manually

---

## Top Opportunities

### 1. Issue #3335: Add matrix determinant support
**Created:** 2026-03-30 (Yesterday!)  
**Author:** jessegrabowski  
**Type:** Enhancement

**Description:**
- Add `mx.linalg.det` (matrix determinant)
- Add `mx.linalg.slogdet` (numerically stable version)
- Use case: Probabilistic programming, normalizing flows

**Opportunity Score:**

**Impact: 4/5**
- Core linalg functionality
- Clear use cases (PPL, ML)
- Would benefit many users

**Merge Probability: 3/5**
- Enhancement (not critical bug)
- No maintainer endorsement yet
- But: core functionality request

**Effort: 5/5** (HIGH = worse score)
- Need to implement Metal kernels
- Numerical stability concerns
- Requires deep MLX knowledge
- Matrix operations are complex

**Score:** (4 × 3) / 5 = **2.4/10**

**Rating:** SKIP

**Why Skip:**
- Too complex for first contribution
- Requires Metal programming expertise
- Numerical algorithms non-trivial
- Better for MLX experts

---

### 2. Issue #3330: scipy.special functions
**Created:** 2026-03-29  
**Author:** jessegrabowski  
**Type:** Enhancement  
**Comments:** 2 (active discussion!)

**Description:**
- Add scipy.special statistical functions
- Examples: erfcinv, bessel_ive, bessel_kve
- For probabilistic programming

**Key Discussion Point:**
- Maintainer (zcbenz) noted existing PRs (#3193, #3181, #3156)
- Concern about bloat
- Suggestion: Create `special` sub-module (like jax.scipy.special)
- Author willing to contribute if architecture decided

**Opportunity Score:**

**Impact: 4/5**
- Enables probabilistic programming
- Clear demand (TensorFlow Probability has these)
- Multiple users interested

**Merge Probability: 3/5**
- Architecture decision needed first
- Some existing PRs to learn from
- But: maintainer concerned about bloat

**Effort: 5/5** (VERY HIGH)
- Metal kernel implementation
- Special mathematical functions
- Numerical precision critical
- Need to follow emerging architecture

**Score:** (4 × 3) / 5 = **2.4/10**

**Rating:** SKIP (for now)

**Why Skip:**
- Architecture undecided (wait for maintainer decision)
- Very high complexity (Metal + special functions)
- Better to watch and learn from existing PRs first

---

### 3. Issue #3326: "test random uniform" fails for CPU backend
**Created:** Recent  
**Type:** Bug  
**Comments:** 0

**Description:**
- Test failure in CPU backend
- Random number generation

**Opportunity Score:**

**Impact: 2/5**
- Test failure (lower impact than user-facing bug)
- CPU backend (less used than Metal on Apple silicon)

**Merge Probability: 4/5**
- Clear bug with failing test
- Reproducible
- Likely straightforward fix

**Effort: 3/5** (MEDIUM)
- Need to debug test
- Understand random number implementation
- But: test failures usually have clear fixes

**Score:** (2 × 4) / 3 = **2.7/10**

**Rating:** SKIP

**Why Skip:**
- Lower impact (test, CPU backend)
- Would need MLX build setup
- Not compelling for story/learning

---

## Other Issues Scanned

**Bugs (#3338, #3337, #3327, #3326, #3302, #3297, #3267, #3248):**
- Mix of Metal bugs, edge cases, performance issues
- Most require deep MLX + Metal expertise
- Some involve macOS Tahoe (latest OS) edge cases
- All: HIGH complexity

**Enhancements (#3335, #3330, #3324):**
- Most require Metal kernel development
- Numerical algorithms expertise needed
- High barrier to entry

---

## Overall Assessment

**Repository Quality:** ✅ Excellent (Apple-backed, active, 24.9K stars)

**Contribution Difficulty:** ⚠️ VERY HIGH
- Most issues require Metal programming
- Numerical algorithms expertise
- Deep MLX architecture knowledge
- No "good first issue" path

**Recommendation:** ⏸️ **WATCH, don't contribute yet**

**Why Wait:**
1. **No easy entry point** - All issues are complex
2. **Metal expertise required** - Not our strength yet
3. **Better learning path** - Build with MLX first, then contribute
4. **Watch existing PRs** - Learn from #3193, #3181, #3156

**Better Approach:**
1. ✅ Use MLX in our projects (we already do!)
2. ✅ Hit real issues from usage
3. ✅ Learn Metal programming separately if interested
4. ✅ Watch scipy.special architecture decision
5. ⏸️ Circle back when we have Metal + MLX expertise

---

## Comparison to Other Opportunities

**isort #1518:** 12.0/10 (documentation, we use it, clear fix)  
**MLX best issue:** 2.7/10 (test failure, needs expertise)

**The delta:** 4.4× better opportunity with isort!

---

## Conclusion

**MLX is a great project** but **not right for us now.**

**Key blocker:** Every issue requires Metal kernel programming + numerical algorithms expertise.

**Better repos for contribution:**
- Tools we use daily (isort ✅)
- Documentation improvements
- Developer experience issues
- Projects with "good first issue" labels

**MLX strategy:** Use it → Hit real issues → Then contribute

---

**Status:** Assessed, no immediate opportunities, watching repo
