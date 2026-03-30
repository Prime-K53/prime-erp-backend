# Calculation Engine Discrepancy Analysis

## Problem Statement
For 48 pages × 450 learners with identical BOM items and adjustments:
- **Pricing Calculator**: 874,800
- **Service Calculator**: 874,800  
- **Examination**: 540,000 (38% lower!)

## Root Cause Analysis

### 1. Pricing Calculator Logic
**File**: `context/PricingCalculatorContext.tsx`

**Calculation Steps:**
1. **Paper Cost**: `ceil(pages/2) * copies * (paper.cost / reamSize)`
2. **Toner Cost**: `pages * copies * (toner.cost / 20000)`
3. **Finishing Cost**: Sum of binding, stapling, covers based on material conversion rates
4. **Base Cost**: Paper + Toner + Finishing
5. **Market Adjustments**: 
   - FIXED: `value * pages * copies` (per-page rate × total pages)
   - PERCENTAGE: `baseCost * (percentage / 100)`
6. **Final Price**: Base Cost + Adjustments

**Key Components:**
- ✅ Paper cost
- ✅ Toner cost  
- ✅ **Finishing costs** (binding, stapling, covers)
- ✅ Market adjustments

---

### 2. Service Calculator Logic
**File**: `views/pos/components/PosModals.tsx` (ServiceCalculatorModal)

**Calculation Steps:**
1. **Paper Cost**: `ceil(pages/2) * copies * (paper.cost_price / 500)`
2. **Toner Cost**: `pages * copies * (toner.cost / 20000)`
3. **Finishing Cost**: Sum of enabled finishing options
4. **Base Cost**: Paper + Toner + Finishing
5. **Market Adjustments**: Same as Pricing Calculator
6. **Final Price**: Base Cost + Adjustments

**Key Components:**
- ✅ Paper cost
- ✅ Toner cost
- ✅ **Finishing costs** (binding, stapling, covers)
- ✅ Market adjustments

---

### 3. Examination Calculator Logic
**File**: `server/services/examinationService.cjs`

**Calculation Steps:**
1. **Paper Cost**: `(totalSheets / conversionRate) * paperUnitCost`
   - `totalSheets = ceil(pages/2) * (learners + extraCopies)`
2. **Toner Cost**: `(totalPages / 20000) * tonerUnitCost`
   - `totalPages = pages * (learners + extraCopies)`
3. **BOM Cost**: Paper + Toner ONLY
4. **Market Adjustments** (`buildClassAdjustmentBreakdown`):
   - FIXED: `value * totalPages` (per-page × total pages)
   - PERCENTAGE: `bomCost * (percentage / 100)`
5. **Total Cost**: BOM Cost + Adjustments
6. **Fee per Learner**: `totalCost / learners` (rounded to nearest 50)

**Key Components:**
- ✅ Paper cost
- ✅ Toner cost
- ❌ **MISSING: Finishing costs** (NO binding, stapling, covers!)
- ✅ Market adjustments

---

## The Critical Difference

### What's Missing in Examination:
The Examination module **does NOT include finishing costs** in its BOM calculation:

```javascript
// Examination - ONLY paper + toner
const totalBomCost = pricingEngine.roundCurrency(paperCost + tonerCost);

// Pricing/Service - Includes finishing
const baseCost = paperCost + tonerCost + finishingCost;
```

### Why This Matters:
For examinations, each student typically needs:
- **Binding**: 1 per student (covers, spine)
- **Stapling**: Or binding alternative
- **Covers**: Front and back covers per exam booklet

These are material costs that should be included in the examination fee calculation.

---

## The Math Explained

### Expected Calculation (Pricing/Service):
```
48 pages × 450 learners

Paper:  ceil(48/2) × 450 × (paper_cost/500)     = ~X
Toner:  48 × 450 × (toner_cost/20000)          = ~Y  
Finishing: 450 × (binding + covers costs)      = ~Z  ← MISSING IN EXAMINATION!
Base: X + Y + Z

Adjustments: % of base or per-page fees
Total: 874,800
```

### Actual Examination Calculation:
```
48 pages × 450 learners

Paper:  ceil(48/2) × 450 × (paper_cost/500)     = ~X
Toner:  48 × 450 × (toner_cost/20000)          = ~Y
Base: X + Y                                      ← NO FINISHING!

Adjustments: % of (X+Y) or per-page fees       = Lower because base is lower
Total: 540,000
```

---

## Recommendation

**The Examination calculation is WRONG.**

It should match the Pricing Calculator and Service Calculator by including finishing costs (binding, stapling, covers) in the BOM calculation.

### Fix Required:
Add finishing cost calculation to the Examination module's `calculateBatch` and `calculateClassPreview` functions, similar to how it's done in the Pricing Calculator.

---

## Fix Plan

### Phase 1: Add Finishing Cost Support to Examination Backend
1. Add finishing materials lookup (binding, stapling, covers) in `examinationService.cjs`
2. Calculate finishing cost based on number of learners
3. Add finishing cost to total BOM cost
4. Update `calculateClassPreview` to include finishing costs

### Phase 2: Add Finishing Configuration
1. Add examination-specific finishing options to pricing settings
2. Allow configuration of default finishing materials per exam type
3. Store finishing material preferences

### Phase 3: Update Frontend Display
1. Show finishing cost breakdown in ManageSubjectsDialog
2. Display finishing materials in the Financial Preview
3. Allow users to configure finishing options per class/batch

---

## Impact Assessment

**Without Fix:**
- Examination fees are undercharged by ~38%
- Revenue loss on every examination batch
- Inconsistent pricing across modules

**With Fix:**
- All three calculators produce consistent results
- Proper cost recovery for examination services
- Accurate financial reporting
