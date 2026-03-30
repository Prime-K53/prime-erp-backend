# Examination Calculation Fix Plan

## Core Problem
ManageSubjectsDialog calculates fees client-side using potentially stale data, while ExaminationBatchDetail shows saved backend values. This causes discrepancies.

## Solution: Backend-Driven Preview + Auto-Recalculation

---

## Phase 1: Create Backend Preview Endpoint

### File: `server/services/examinationService.cjs`

Add `calculateClassPreview` method (around line 2556, after `calculateBatch`):

```javascript
calculateClassPreview: async (classId, options = {}) => {
  const cls = await examinationService.getClass(classId);
  if (!cls) throw new Error('Class not found');
  
  const {
    paperUnitCost,
    tonerUnitCost,
    paperConversionRate
  } = await resolveExamMaterialConfiguration();
  
  // Override with preview options if provided
  const effectivePaperUnitCost = options.paperUnitCost || paperUnitCost;
  const effectiveTonerUnitCost = options.tonerUnitCost || tonerUnitCost;
  const effectiveConversionRate = options.paperConversionRate || paperConversionRate;
  
  const activeAdjustments = await resolveEffectiveClassAdjustments();
  const learners = Math.max(1, Math.floor(Number(cls.number_of_learners) || 0));
  
  let classTotalSheets = 0;
  let classTotalPages = 0;
  
  for (const sub of cls.subjects || []) {
    const subjectConsumption = pricingEngine.calculateSubjectConsumption(sub, learners);
    classTotalSheets += subjectConsumption.totalSheets;
    classTotalPages += subjectConsumption.totalPages;
  }
  
  const paperQuantity = classTotalSheets / effectiveConversionRate;
  const tonerQuantity = classTotalPages / pricingEngine.TONER_PAGES_PER_KG;
  const paperCost = pricingEngine.roundCurrency(paperQuantity * effectivePaperUnitCost);
  const tonerCost = pricingEngine.roundCurrency(tonerQuantity * effectiveTonerUnitCost);
  const totalBomCost = pricingEngine.roundCurrency(paperCost + tonerCost);
  
  const classAdjustmentBreakdown = buildClassAdjustmentBreakdown(totalBomCost, classTotalPages, activeAdjustments);
  let totalAdjustments = pricingEngine.roundCurrency(classAdjustmentBreakdown.totalAdjustmentCost);
  let expectedTotal = pricingEngine.roundCurrency(totalBomCost + totalAdjustments);
  let expectedFeePerLearner = learners > 0
    ? pricingEngine.roundCurrency(expectedTotal / learners)
    : 0;
  
  // Apply rounding
  const roundedFeePerLearner = pricingEngine.roundUpToNearest(expectedFeePerLearner, 50);
  const roundingDiffPerLearner = pricingEngine.roundCurrency(roundedFeePerLearner - expectedFeePerLearner);
  if (roundingDiffPerLearner > 0) {
    const roundingTotalForClass = pricingEngine.roundCurrency(roundingDiffPerLearner * learners);
    totalAdjustments = pricingEngine.roundCurrency(totalAdjustments + roundingTotalForClass);
    expectedTotal = pricingEngine.roundCurrency(totalBomCost + totalAdjustments);
    expectedFeePerLearner = roundedFeePerLearner;
  }
  
  return {
    classId,
    learners,
    totalSheets: classTotalSheets,
    totalPages: classTotalPages,
    paperCost,
    tonerCost,
    totalBomCost,
    totalAdjustments,
    totalCost: expectedTotal,
    expectedFeePerLearner,
    materialTotalCost: totalBomCost,
    adjustmentTotalCost: totalAdjustments,
    calculatedTotalCost: expectedTotal
  };
}
```

### File: `server/routes/examination.cjs`

Add route (around line 293, after calculate batch route):

```javascript
router.post('/classes/:id/preview', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || 'System';
    const result = await examinationService.calculateClassPreview(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    console.error('[Examination] Class preview error:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate class preview' });
  }
});
```

---

## Phase 2: Add Frontend Service Method

### File: `services/examinationBatchService.ts`

Add method (around line 500):

```typescript
async getClassPreview(
  classId: string, 
  options?: { paperId?: string; tonerId?: string }
): Promise<{
  classId: string;
  learners: number;
  totalSheets: number;
  totalPages: number;
  paperCost: number;
  tonerCost: number;
  totalBomCost: number;
  totalAdjustments: number;
  totalCost: number;
  expectedFeePerLearner: number;
  materialTotalCost: number;
  adjustmentTotalCost: number;
  calculatedTotalCost: number;
}> {
  const response = await requestWithFallback(`/classes/${classId}/preview`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(options || {})
  }, MEDIUM_REQUEST_TIMEOUT_MS);
  
  if (!response.ok) throw new Error(await toServiceError(response, 'Failed to fetch class preview'));
  return response.json();
}
```

---

## Phase 3: Update ManageSubjectsDialog

### File: `views/examination/components/ManageSubjectsDialog.tsx`

#### 3.1 Replace livePreview with API-driven preview (lines 90-144)

REMOVE:
```typescript
const livePreview = useMemo(() => {
  // ... client-side calculation
}, [examinationClass, pricingSettings, materials, marketAdjustments, localPaperId, localTonerId]);
```

REPLACE WITH:
```typescript
const [preview, setPreview] = useState<{
  totalSheets: number;
  totalPages: number;
  totalBomCost: number;
  totalAdjustments: number;
  totalCost: number;
  expectedFeePerLearner: number;
  materialTotalCost: number;
  adjustmentTotalCost: number;
  calculatedTotalCost: number;
} | null>(null);

const [isPreviewLoading, setIsPreviewLoading] = useState(false);

useEffect(() => {
  if (!examinationClass?.id) {
    setPreview(null);
    return;
  }
  
  setIsPreviewLoading(true);
  examinationBatchService.getClassPreview(examinationClass.id, {
    paperId: localPaperId || undefined,
    tonerId: localTonerId || undefined
  })
  .then(data => {
    setPreview({
      totalSheets: data.totalSheets,
      totalPages: data.totalPages,
      totalBomCost: data.totalBomCost,
      totalAdjustments: data.totalAdjustments,
      totalCost: data.totalCost,
      expectedFeePerLearner: data.expectedFeePerLearner,
      materialTotalCost: data.materialTotalCost,
      adjustmentTotalCost: data.adjustmentTotalCost,
      calculatedTotalCost: data.calculatedTotalCost
    });
  })
  .catch(error => {
    console.error('Failed to fetch preview:', error);
    setPreview(null);
  })
  .finally(() => setIsPreviewLoading(false));
}, [examinationClass?.id, localPaperId, localTonerId]);

// Also refresh when subjects change
useEffect(() => {
  if (!examinationClass?.id || !preview) return;
  
  setIsPreviewLoading(true);
  examinationBatchService.getClassPreview(examinationClass.id, {
    paperId: localPaperId || undefined,
    tonerId: localTonerId || undefined
  })
  .then(data => {
    setPreview({
      totalSheets: data.totalSheets,
      totalPages: data.totalPages,
      totalBomCost: data.totalBomCost,
      totalAdjustments: data.totalAdjustments,
      totalCost: data.totalCost,
      expectedFeePerLearner: data.expectedFeePerLearner,
      materialTotalCost: data.materialTotalCost,
      adjustmentTotalCost: data.adjustmentTotalCost,
      calculatedTotalCost: data.calculatedTotalCost
    });
  })
  .catch(console.error)
  .finally(() => setIsPreviewLoading(false));
}, [examinationClass?.subjects?.length, examinationClass?.subjects?.map(s => s.pages + s.extra_copies).join(',')]);
```

#### 3.2 Update handleSavePricing (lines 146-165)

REPLACE:
```typescript
const handleSavePricing = async () => {
  if (!examinationClass || !livePreview) {
    onOpenChange(false);
    return;
  }
  setLoading(true);
  try {
    await onSaveClassPricing(examinationClass.id, {
      material_total_cost: livePreview.totalBomCost,
      adjustment_total_cost: livePreview.totalAdjustments,
      calculated_total_cost: livePreview.totalCost,
      expected_fee_per_learner: livePreview.expectedFeePerLearner
    });
    onOpenChange(false);
  } catch (error) {
    console.error('Failed to save class pricing:', error);
  } finally {
    setLoading(false);
  }
};
```

WITH:
```typescript
const handleSavePricing = async () => {
  if (!examinationClass || !preview) {
    onOpenChange(false);
    return;
  }
  setLoading(true);
  try {
    await onSaveClassPricing(examinationClass.id, {
      material_total_cost: preview.materialTotalCost,
      adjustment_total_cost: preview.adjustmentTotalCost,
      calculated_total_cost: preview.calculatedTotalCost,
      expected_fee_per_learner: preview.expectedFeePerLearner
    });
    onOpenChange(false);
  } catch (error) {
    console.error('Failed to save class pricing:', error);
  } finally {
    setLoading(false);
  }
};
```

#### 3.3 Replace livePreview references in JSX (lines 327-340)

REPLACE:
```typescript
{livePreview && (
  <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 mt-4">
    <Calculator size={14} />
    <span>{livePreview.totalSheets.toLocaleString()} Sheets</span>
    <span>BOM: {livePreview.totalBomCost.toLocaleString()}</span>
    <span>Adjust: {livePreview.totalAdjustments.toLocaleString()}</span>
    <span>Total: {livePreview.totalCost.toLocaleString()}</span>
    <span>Fee/Learner: {livePreview.expectedFeePerLearner.toLocaleString()}</span>
  </div>
)}
```

WITH:
```typescript
{preview && (
  <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 mt-4">
    <Calculator size={14} className={isPreviewLoading ? 'animate-spin' : ''} />
    <span>{preview.totalSheets.toLocaleString()} Sheets</span>
    <span>BOM: {preview.totalBomCost.toLocaleString()}</span>
    <span>Adjust: {preview.totalAdjustments.toLocaleString()}</span>
    <span>Total: {preview.totalCost.toLocaleString()}</span>
    <span>Fee/Learner: {preview.expectedFeePerLearner.toLocaleString()}</span>
    
    {/* Mismatch Warning */}
    {examinationClass?.expected_fee_per_learner && 
     Math.abs(preview.expectedFeePerLearner - examinationClass.expected_fee_per_learner) > 1 && (
      <div className="w-full mt-2 bg-yellow-100 border border-yellow-300 rounded p-2 text-xs text-yellow-800">
        Preview differs from saved value. Click "Calculate" in main view to update.
      </div>
    )}
  </div>
)}
```

---

## Phase 4: Auto-Recalculate on Subject Changes

### File: `views/examination/ExaminationBatchDetail.tsx`

#### 4.1 Modify handleAddSubject (lines 185-194)

REPLACE:
```typescript
const handleAddSubject = async (data: Partial<ExaminationSubject>) => {
  if (!selectedClass) return;
  try {
    await examinationBatchService.addSubject(selectedClass.id, data);
    await fetchBatch();
  } catch (error) {
    console.error('Error adding subject:', error);
    throw error;
  }
};
```

WITH:
```typescript
const handleAddSubject = async (data: Partial<ExaminationSubject>) => {
  if (!selectedClass || !batch) return;
  try {
    await examinationBatchService.addSubject(selectedClass.id, data);
    // Auto-recalculate to keep values synchronized
    const updatedBatch = await calculateBatch(batch.id);
    setBatch(updatedBatch);
  } catch (error) {
    console.error('Error adding subject:', error);
    throw error;
  }
};
```

#### 4.2 Modify handleRemoveSubject (lines 196-205)

REPLACE:
```typescript
const handleRemoveSubject = async (subjectId: string) => {
  if (!selectedClass) return;
  try {
    await examinationBatchService.deleteSubject(subjectId);
    await fetchBatch();
  } catch (error) {
    console.error('Error removing subject:', error);
    throw error;
  }
};
```

WITH:
```typescript
const handleRemoveSubject = async (subjectId: string) => {
  if (!selectedClass || !batch) return;
  try {
    await examinationBatchService.deleteSubject(subjectId);
    // Auto-recalculate to keep values synchronized
    const updatedBatch = await calculateBatch(batch.id);
    setBatch(updatedBatch);
  } catch (error) {
    console.error('Error removing subject:', error);
    throw error;
  }
};
```

---

## Phase 5: Fix OverrideDialog Consistency

### File: `views/examination/ExaminationBatchDetail.tsx` (lines 619-627)

Ensure OverrideDialog receives the same value shown in the main view:

```typescript
{selectedClass && (
  <OverrideDialog
    isOpen={isOverrideOpen}
    onClose={() => setIsOverrideOpen(false)}
    onSubmit={handleOverrideSubmit}
    currentPrice={selectedClass.expected_fee_per_learner ?? selectedClass.suggested_cost_per_learner ?? 0}
    expectedPrice={selectedClass.expected_fee_per_learner ?? 0}
    currencySymbol={batch.currency}
  />
)}
```

Update `OverrideDialog` component to show both current and expected prices.

---

## Phase 6: Add Calculation Stale Indicator

### File: `views/examination/ExaminationBatchDetail.tsx`

#### 6.1 Add calculation status check (after line 267)

```typescript
const isCalculationStale = useMemo(() => {
  if (!batch?.last_calculated_at) return true;
  if (!batch?.classes) return false;
  
  const lastCalcTime = new Date(batch.last_calculated_at).getTime();
  
  // Check if any class has been modified since last calculation
  for (const cls of batch.classes) {
    const classUpdateTime = cls.updated_at ? new Date(cls.updated_at).getTime() : 0;
    if (classUpdateTime > lastCalcTime) return true;
    
    // Check subjects
    for (const subject of cls.subjects || []) {
      const subjectUpdateTime = subject.updated_at ? new Date(subject.updated_at).getTime() : 0;
      if (subjectUpdateTime > lastCalcTime) return true;
    }
  }
  
  return false;
}, [batch?.last_calculated_at, batch?.classes]);
```

#### 6.2 Display stale indicator (around line 328, near status badge)

```typescript
<span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass}`}>
  {batch.status}
</span>
{isCalculationStale && batch?.status !== 'Approved' && batch?.status !== 'Invoiced' && (
  <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-yellow-50 text-yellow-700 border border-yellow-100">
    Calculation Stale - Recalculate Needed
  </span>
)}
```

---

## Testing Checklist

- [ ] Opening ManageSubjectsDialog shows preview matching saved value
- [ ] Adding subject updates preview immediately
- [ ] Changing paper/toner in modal updates preview correctly via API
- [ ] Saving subjects triggers recalculation automatically
- [ ] OverrideDialog shows correct base value matching main view
- [ ] Classes and Subjects view matches ManageSubjectsDialog values
- [ ] Stale calculation indicator appears when subjects change
- [ ] No discrepancies between modal and main view after recalculate

---

## Files Modified Summary

1. `server/services/examinationService.cjs` - Add `calculateClassPreview` method
2. `server/routes/examination.cjs` - Add POST `/classes/:id/preview` route
3. `services/examinationBatchService.ts` - Add `getClassPreview` method
4. `views/examination/components/ManageSubjectsDialog.tsx` - Replace client calc with API
5. `views/examination/ExaminationBatchDetail.tsx` - Auto-recalc + stale indicator
6. `views/examination/components/OverrideDialog.tsx` - Show expected vs current price
