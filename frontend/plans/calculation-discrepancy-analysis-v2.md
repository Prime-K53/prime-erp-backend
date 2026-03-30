# Calculation Discrepancy Analysis - REVISED

## Problem Statement (Corrected Understanding)
For 48 pages × 450 learners with identical BOM items (paper + toner only, NO finishing):
- **Pricing Calculator**: 874,800
- **Service Calculator**: 874,800  
- **Examination**: 540,000 (38% lower!)

Since finishing was explicitly excluded, all three calculators should produce the same result.

---

## Formula Comparison

### 1. Paper Cost Calculation

| Calculator | Formula |
|------------|---------|
| **Pricing Calculator** | `ceil(pages/2) * copies * (paper.cost / reamSize)` |
| **Service Calculator** | `ceil(pages/2) * copies * (paper.cost_price / 500)` |
| **Examination** | `(totalSheets / conversionRate) * paperUnitCost` |
| | where `totalSheets = ceil(pages/2) * (learners + extraCopies)` |

**Constants:**
- All use 500 sheets per ream
- All use same cost field priority: cost_price → cost → default

**Result:** Paper cost formulas are **EQUIVALENT**

---

### 2. Toner Cost Calculation

| Calculator | Formula |
|------------|---------|
| **Pricing Calculator** | `pages * copies * (toner.cost / 20000)` |
| **Service Calculator** | `pages * copies * (toner.cost / 20000)` |
| **Examination** | `(totalPages / 20000) * tonerUnitCost` |
| | where `totalPages = pages * (learners + extraCopies)` |

**Constants:**
- All use 20,000 pages per kg toner capacity
- All use same cost field priority

**Result:** Toner cost formulas are **EQUIVALENT**

---

### 3. Market Adjustments (CRITICAL DIFFERENCE FOUND!)

#### Pricing Calculator (`context/PricingCalculatorContext.tsx:230-265`):
```javascript
// FIXED adjustment:
total += adj.value * pages * copies

// PERCENTAGE adjustment:
total += baseCost * (adj.value / 100)

// Custom adjustment (if enabled):
if (customAdjustmentType === 'PERCENTAGE') {
    total += baseCost * (customAdjustmentValue / 100);
} else {
    total += customAdjustmentValue * copies;
}
```

#### Service Calculator (`views/pos/components/PosModals.tsx:349-350`):
```javascript
// FIXED adjustment:
const totalAmount = isPercent 
    ? (baseCost * (pct / 100)) 
    : (Number(adj.value) || 0) * pages * copies;
```

#### Examination (`server/services/examinationService.cjs:639-678`):
```javascript
const buildClassAdjustmentBreakdown = (baseBomCost, totalPages, activeAdjustments) => {
    const amount = adjustmentType === 'FIXED'
        ? pricingEngine.roundCurrency(rawValue * safeTotalPages)  // ← Uses totalPages
        : pricingEngine.roundCurrency(safeBaseCost * (rawValue / 100));
    
    return {
        rows: [...],
        totalAdjustmentCost  // ← Sum of all adjustments
    };
};

// Then:
let totalAdjustments = pricingEngine.roundCurrency(classAdjustmentBreakdown.totalAdjustmentCost);
let expectedTotal = pricingEngine.roundCurrency(totalBomCost + totalAdjustments);
let expectedFeePerLearner = learners > 0
    ? pricingEngine.roundCurrency(expectedTotal / learners)  // ← PER LEARNER!
    : 0;
```

---

## Key Differences Identified

### 1. Adjustment Calculation Chain
**Pricing/Service:**
1. Calculate base cost (paper + toner)
2. Apply adjustments to base cost
3. Result = base + adjustments

**Examination:**
1. Calculate base BOM cost (paper + toner)
2. Apply adjustments to base cost
3. Calculate total with adjustments
4. **DIVIDE by learners to get per-learner fee**
5. **THEN apply rounding to nearest 50**

### 2. The Critical Difference: What is Being Returned

**Pricing Calculator:** Returns `finalPrice` which is **total for all copies**
- `finalPrice = baseCost + marketAdjustmentTotal`
- For 450 learners: returns 874,800 total

**Service Calculator:** Returns `totalPrice` which is **total for all copies**
- `totalPrice = baseCost + adjustmentTotal`
- For 450 learners: returns 874,800 total

**Examination:** Returns `expectedFeePerLearner` which is **per learner**
- First calculates `expectedTotal = baseCost + adjustments` for all copies
- Then divides: `expectedFeePerLearner = expectedTotal / learners`
- For 450 learners: returns ~1,200 per learner
- **BUT WAIT**: The user said Examination returns 540,000 total

---

## Hypothesis: The Issue is in Examination Total Calculation

If Examination shows 540,000 as the **total**, that means:
- Either the fee per learner is being calculated incorrectly
- Or the total is being calculated as `feePerLearner × learners` with some error

Let me calculate:
- If total should be 874,800 for 450 learners
- Then fee per learner should be 874,800 / 450 = 1,944
- But Examination might be calculating: 540,000 / 450 = 1,200 per learner

The discrepancy is 874,800 vs 540,000 = 38% difference.

**540,000 / 874,800 = 0.617 or about 62% of expected**

This suggests the Examination calculation is missing about 38% of the cost.

---

## Possible Root Causes

### Hypothesis 1: Extra Copies Being Subtracted
In Examination:
```javascript
const totalCopies = safeLearners + extraCopies;  // 450 + extra
const totalPages = pages * totalCopies;          // 48 × (450 + extra)
// ... calculate cost for all copies ...
let expectedFeePerLearner = expectedTotal / learners;  // Divide by 450 only
```

If extraCopies > 0, the cost is calculated for (450 + extra) copies but divided by 450 learners, which would actually INCREASE the per-learner cost, not decrease it.

### Hypothesis 2: Different Market Adjustments
The Examination might be using different market adjustments than Pricing/Service calculators.

### Hypothesis 3: Rounding Location Difference
Examination rounds the **per-learner fee** to nearest 50:
```javascript
const roundedFeePerLearner = pricingEngine.roundUpToNearest(expectedFeePerLearner, 50);
```

If the unrounded fee was 1,944, rounding to nearest 50 gives 1,950.
That's only a 6 difference, not 334,800.

### Hypothesis 4: Base Cost Calculation Error
There might be a difference in how the base paper/toner costs are calculated that accumulates to 38%.

### Hypothesis 5: Adjustment Formula Difference
In Examination's `buildClassAdjustmentBreakdown`:
```javascript
const amount = adjustmentType === 'FIXED'
    ? pricingEngine.roundCurrency(rawValue * safeTotalPages)
    : pricingEngine.roundCurrency(safeBaseCost * (rawValue / 100));
```

FIXED adjustments use `rawValue * safeTotalPages` (value per page × total pages).

But what is `rawValue`? It comes from:
```javascript
const rawValue = adjustmentType === 'FIXED'
    ? (toNumericValue(adjustment?.value) ?? 0)
    : (toNumericValue(adjustment?.percentage ?? adjustment?.value) ?? 0);
```

If the FIXED adjustment value is being interpreted differently (e.g., as a total rather than per-page), that could cause a massive difference.

---

## Recommended Investigation Steps

1. **Log the actual values** in all three calculators with the same input (48 pages, 450 learners/copies)
2. **Compare intermediate results:**
   - Paper cost
   - Toner cost
   - Base cost
   - Adjustment amounts
   - Final total
3. **Check if the 540,000 is total or per-learner**
4. **Verify market adjustments** are the same across all calculators
5. **Check for any division/multiplication errors** in the chain

---

## Next Actions Required

Need to add detailed logging or create a test case to trace through the actual calculation with real values from the database. The formulas look equivalent, so the issue must be in:
- Different data being used (different paper/toner items)
- Different market adjustments
- A bug in the calculation chain
- Misunderstanding of what values are being compared
