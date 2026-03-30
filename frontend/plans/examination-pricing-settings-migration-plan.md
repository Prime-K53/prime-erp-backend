# Examination Pricing Settings Migration Plan

## Executive Summary

This plan details the migration of Examination Pricing Settings functionality from `ExaminationPricingSettingsDialog` into `ExaminationBatchDetail`, creating a unified interface where pricing configuration and class management coexist. The migration follows the "Smart Container" pattern, elevating state management to the parent component while maintaining dialog components for specific interactions.

## Current Architecture Analysis

### Component Responsibilities

| Component | Current Responsibility | Post-Migration Responsibility |
|-----------|----------------------|------------------------------|
| `ExaminationPricingSettingsDialog` | Full pricing settings UI, BOM selection, market adjustments, live preview | Simplified read-only preview dialog or deprecated |
| `ExaminationBatchDetail` | Class/subject management, basic pricing display | **Central hub**: pricing settings, BOM config, market adjustments, live previews |
| `AddClassDialog` | Class creation (name, learners) | Unchanged - receives pricing context via props |
| `ManageSubjectsDialog` | Subject management | Enhanced with live cost preview panel |

### State Distribution (Current)

```
ExaminationPricingSettingsDialog (isolated state):
├── settings: PricingSettings | null
├── inventoryItems: Item[]
├── marketAdjustments: MarketAdjustment[]
├── loading, saving, error states
└── preview: BatchPricingResult (via useMemo)

ExaminationBatchDetail (minimal state):
├── batch: ExaminationBatch
├── pricingSettings: PricingSettings | null
├── marketAdjustments: MarketAdjustment[]
└── livePreviewState: Record<string, number>
```

### State Distribution (Target)

```
ExaminationBatchDetail (centralized state - "Smart Container"):
├── batch: ExaminationBatch
├── pricingSettings: PricingSettings | null
├── marketAdjustments: MarketAdjustment[]
├── inventoryItems: Item[]  ← NEW
├── activePreview: BatchPricingResult  ← NEW (useMemo)
├── dialogVisibility states
└── loading/error states for pricing operations

AddClassDialog (enhanced):
└── Receives pricingPreview via props for live cost estimation

ManageSubjectsDialog (enhanced):
├── Local subject form state
├── Receives pricingSettings, marketAdjustments via props
└── Internal livePreview via useMemo (using props)
```

## Migration Strategy

### Phase 1: State Elevation to ExaminationBatchDetail

#### 1.1 Expand State Interface in ExaminationBatchDetail

```typescript
// State additions to ExaminationBatchDetail
const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
const [marketAdjustments, setMarketAdjustments] = useState<MarketAdjustment[]>([]);
const [inventoryItems, setInventoryItems] = useState<Item[]>([]);  // NEW
const [pricingLoading, setPricingLoading] = useState(false);       // NEW
const [pricingError, setPricingError] = useState<string | null>(null); // NEW

// Live preview calculation (elevated from dialog)
const activeMarketAdjustments = useMemo(
  () => marketAdjustments.filter(a => a.active ?? a.isActive),
  [marketAdjustments]
);

const livePricingPreview = useMemo(
  () => calculateBatchPricing(batch, pricingSettings, activeMarketAdjustments),
  [batch, pricingSettings, activeMarketAdjustments]
);
```

#### 1.2 Unified Data Loading

```typescript
// Consolidated load function in ExaminationBatchDetail
const loadPricingData = async () => {
  setPricingLoading(true);
  try {
    const [settingsData, adjustmentsData, inventoryData] = await Promise.all([
      examinationBatchService.getPricingSettings(),
      dbService.getAll<MarketAdjustment>('marketAdjustments'),
      dbService.getAll<Item>('inventory')  // NEW
    ]);

    setPricingSettings(settingsData);
    setMarketAdjustments(Array.isArray(adjustmentsData) ? adjustmentsData : []);
    setInventoryItems(Array.isArray(inventoryData) ? inventoryData : []);
  } catch (error) {
    console.error('Error loading pricing data:', error);
    setPricingError('Failed to load pricing configuration');
  } finally {
    setPricingLoading(false);
  }
};

// Load on mount
useEffect(() => {
  fetchBatch();
  loadPricingData();
}, [id]);
```

### Phase 2: Service Layer Integration

#### 2.1 syncMarketAdjustmentsToBackend Integration

```typescript
// Wrapper in ExaminationBatchDetail for sync operations
const syncMarketAdjustments = async (options?: { triggerRecalculate?: boolean }) => {
  try {
    setPricingLoading(true);
    await syncMarketAdjustmentsToBackend(options);
    // Refresh local state after sync
    await loadPricingData();
    notify('Market adjustments synchronized successfully', 'success');
  } catch (error) {
    console.error('Sync failed:', error);
    notify('Failed to synchronize market adjustments', 'error');
    throw error;
  } finally {
    setPricingLoading(false);
  }
};
```

#### 2.2 examinationBatchService Operations

```typescript
// Save pricing settings with optimistic updates
const savePricingSettings = async (settings: Partial<PricingSettings>) => {
  setPricingLoading(true);
  setPricingError(null);
  
  try {
    // Step 1: Update settings
    await examinationBatchService.updatePricingSettings({
      paper_item_id: settings.paper_item_id,
      toner_item_id: settings.toner_item_id,
      trigger_recalculate: true,
      lock_pricing_snapshot: Boolean(batch?.id),
      lock_batch_id: batch?.id
    });

    // Step 2: Sync to batch classes
    if (batch?.id) {
      await examinationBatchService.syncPricingToBatch(batch.id, {
        settings: settings as PricingSettings,
        adjustments: activeMarketAdjustments,
        triggerSource: 'BATCH_DETAIL_SYNC'
      });
    }

    // Step 3: Refresh data
    await loadPricingData();
    await fetchBatch(); // Refresh batch to get updated class costs
    
    notify('Pricing settings saved and applied', 'success');
  } catch (error) {
    console.error('Save failed:', error);
    setPricingError('Failed to save pricing settings');
    throw error;
  } finally {
    setPricingLoading(false);
  }
};
```

### Phase 3: Component Refactoring

#### 3.1 ExaminationPricingSettingsDialog Transformation

**Option A: Convert to View-Only Preview Dialog**

```typescript
interface PricingPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  batch: ExaminationBatch | null;
  pricingSettings: PricingSettings | null;      // Passed from parent
  marketAdjustments: MarketAdjustment[];        // Passed from parent
  livePreview: BatchPricingResult;              // Passed from parent (calculated)
  inventoryItems: Item[];                       // Passed from parent
  onSaveSettings: (settings: PricingSettings) => Promise<void>; // Callback to parent
}

// Dialog becomes presentation-only, all state managed by parent
```

**Option B: Deprecate and Inline UI into ExaminationBatchDetail**

Move the pricing settings UI directly into ExaminationBatchDetail as a collapsible section or tab, eliminating the dialog entirely.

#### 3.2 AddClassDialog Enhancement

```typescript
interface AddClassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: { class_name: string; number_of_learners: number }) => Promise<void>;
  // NEW: Pricing context props
  pricingSettings: PricingSettings | null;
  marketAdjustments: MarketAdjustment[];
  currency: string;
}

// Enhanced to show estimated cost preview
// Uses local useMemo with props for calculation
```

#### 3.3 ManageSubjectsDialog Enhancement (Critical)

```typescript
interface ManageSubjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  examinationClass: ExaminationClass | null;
  onAddSubject: (data: Partial<ExaminationSubject>) => Promise<void>;
  onRemoveSubject: (subjectId: string) => Promise<void>;
  // NEW: Pricing context for live preview
  batch: ExaminationBatch | null;
  pricingSettings: PricingSettings | null;
  marketAdjustments: MarketAdjustment[];
  currency: string;
}

// Internal state for draft subjects (subjects not yet saved)
const [draftSubjects, setDraftSubjects] = useState<ExaminationSubject[]>([]);

// Live preview calculation using props
const livePreview = useMemo(() => {
  if (!examinationClass || !pricingSettings) return null;
  
  const previewClass = {
    ...examinationClass,
    subjects: [...(examinationClass.subjects || []), ...draftSubjects]
  };
  
  const previewBatch = batch ? { ...batch, classes: [previewClass] } : null;
  const activeAdjustments = marketAdjustments.filter(a => a.active ?? a.isActive);
  
  return calculateBatchPricing(previewBatch, pricingSettings, activeAdjustments);
}, [examinationClass, draftSubjects, pricingSettings, marketAdjustments, batch]);
```

### Phase 4: Prop Drilling Elimination Strategy

#### 4.1 Context-Based Solution (Recommended)

Create a lightweight context for examination pricing data:

```typescript
// context/ExaminationPricingContext.tsx
interface ExaminationPricingContextValue {
  pricingSettings: PricingSettings | null;
  marketAdjustments: MarketAdjustment[];
  inventoryItems: Item[];
  activePreview: BatchPricingResult;
  loading: boolean;
  error: string | null;
  refreshPricingData: () => Promise<void>;
  savePricingSettings: (settings: PricingSettings) => Promise<void>;
  syncMarketAdjustments: (options?: { triggerRecalculate?: boolean }) => Promise<void>;
}

// Provider wraps ExaminationBatchDetail and its children
// Dialogs access via useExaminationPricing() hook
```

#### 4.2 Component Composition Pattern

```typescript
// In ExaminationBatchDetail render:
<ExaminationPricingProvider 
  batch={batch}
  initialSettings={pricingSettings}
  initialAdjustments={marketAdjustments}
>
  <div className="batch-detail-layout">
    {/* Main content */}
    <AddClassDialog />
    <ManageSubjectsDialog />
    {/* Pricing settings inline or dialog */}
  </div>
</ExaminationPricingProvider>
```

### Phase 5: Type Safety Enforcement

#### 5.1 MarketAdjustment Interface Compliance

```typescript
// Ensure all MarketAdjustment usage follows types.ts interface
import { MarketAdjustment } from '../../types';

// Type guard for runtime validation
const isValidMarketAdjustment = (obj: any): obj is MarketAdjustment => {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    (obj.active === undefined || typeof obj.active === 'boolean') &&
    (obj.isActive === undefined || typeof obj.isActive === 'boolean')
  );
};

// Usage in data loading
const validatedAdjustments = rawAdjustments.filter(isValidMarketAdjustment);
```

#### 5.2 PricingSettings Type Safety

```typescript
// utils/examinationPricingCalculator.ts
export const isValidPricingSettings = (obj: any): obj is PricingSettings => {
  return (
    typeof obj === 'object' &&
    (obj.paper_item_id === null || typeof obj.paper_item_id === 'string') &&
    typeof obj.paper_unit_cost === 'number' &&
    (obj.toner_item_id === null || typeof obj.toner_item_id === 'string') &&
    typeof obj.toner_unit_cost === 'number' &&
    typeof obj.conversion_rate === 'number'
  );
};
```

### Phase 6: UI/UX Integration

#### 6.1 ExaminationBatchDetail Layout Enhancement

```tsx
// New section in main layout (replacing the removed BOM info box)
<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
  {/* Existing stat cards */}
  
  {/* NEW: Quick Pricing Summary Card */}
  <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-4 rounded-2xl border border-violet-200">
    <div className="text-[10px] font-bold text-violet-600 uppercase tracking-tight mb-2">
      Pricing Configuration
    </div>
    <div className="space-y-1 text-xs">
      <div className="flex justify-between">
        <span className="text-slate-500">Paper:</span>
        <span className="font-medium text-slate-700">
          {pricingSettings?.paper_item_name || 'Not configured'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Toner:</span>
        <span className="font-medium text-slate-700">
          {pricingSettings?.toner_item_name || 'Not configured'}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Active Adjustments:</span>
        <span className="font-medium text-slate-700">
          {activeMarketAdjustments.length} rules
        </span>
      </div>
    </div>
    <button
      onClick={() => setIsPricingSettingsOpen(true)}
      className="mt-3 w-full text-xs bg-violet-100 text-violet-700 py-1.5 rounded-lg hover:bg-violet-200 transition-colors"
    >
      Configure Pricing
    </button>
  </div>
</div>
```

#### 6.2 ManageSubjectsDialog Live Preview Panel

```tsx
{/* Inside ManageSubjectsDialog, above subjects list */}
{livePreview && (
  <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 mb-4">
    <div className="flex items-center gap-2 mb-3">
      <Calculator size={16} className="text-blue-600" />
      <span className="text-sm font-semibold text-blue-900">Live Cost Preview</span>
    </div>
    
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
      <div className="bg-white/60 rounded-lg p-2">
        <div className="text-slate-500">Total Sheets</div>
        <div className="font-semibold text-slate-900">
          {livePreview.classes[0]?.totalSheets.toLocaleString() || 0}
        </div>
      </div>
      <div className="bg-white/60 rounded-lg p-2">
        <div className="text-slate-500">BOM Cost</div>
        <div className="font-semibold text-slate-900">
          {currency} {livePreview.classes[0]?.totalBomCost.toFixed(2) || '0.00'}
        </div>
      </div>
      <div className="bg-white/60 rounded-lg p-2">
        <div className="text-slate-500">Adjustments</div>
        <div className="font-semibold text-slate-900">
          {currency} {livePreview.classes[0]?.totalAdjustments.toFixed(2) || '0.00'}
        </div>
      </div>
      <div className="bg-white rounded-lg p-2 border-2 border-blue-200">
        <div className="text-slate-500">Expected Fee</div>
        <div className="font-bold text-blue-900">
          {currency} {livePreview.classes[0]?.expectedFeePerLearner.toFixed(2) || '0.00'}
        </div>
        <div className="text-[9px] text-slate-400">per learner</div>
      </div>
    </div>
  </div>
)}
```

## Implementation Steps

### Step 1: Foundation (Day 1)

1. **Expand ExaminationBatchDetail State**
   - Add `inventoryItems`, `pricingLoading`, `pricingError` states
   - Implement unified `loadPricingData()` function
   - Add derived `activeMarketAdjustments` and `livePricingPreview` memos

2. **Type Safety Setup**
   - Add type guards for MarketAdjustment and PricingSettings
   - Update imports to include all required types

### Step 2: Service Integration (Day 1-2)

1. **Sync Service Wrapper**
   - Implement `syncMarketAdjustments()` wrapper in ExaminationBatchDetail
   - Add error handling and notification integration

2. **Save Operations**
   - Implement `savePricingSettings()` with optimistic updates
   - Add batch sync integration

### Step 3: Dialog Refactoring (Day 2-3)

1. **ExaminationPricingSettingsDialog**
   - Transform to presentation-only component
   - Remove internal state management
   - Accept all data via props with callbacks

2. **ManageSubjectsDialog Enhancement**
   - Add pricing-related props interface
   - Implement draft subjects state
   - Add live preview calculation via useMemo
   - Integrate preview UI panel

3. **AddClassDialog Enhancement**
   - Add pricing props for cost estimation
   - Optional: Add simple cost preview

### Step 4: Context Implementation (Day 3-4)

1. **Create ExaminationPricingContext**
   - Define context interface
   - Implement provider component
   - Add useExaminationPricing() hook

2. **Integration**
   - Wrap ExaminationBatchDetail children with provider
   - Update dialogs to use context instead of props where beneficial

### Step 5: Testing & Validation (Day 4-5)

1. **Unit Tests**
   - Test calculateBatchPricing with various inputs
   - Verify MarketAdjustment type guards
   - Test context provider state management

2. **Integration Tests**
   - End-to-end pricing settings flow
   - Live preview accuracy validation
   - Sync operation error handling

3. **Regression Tests**
   - Verify AddClassDialog still functions
   - Verify ManageSubjectsDialog subject operations
   - Confirm batch calculation persistence

## Migration Checklist

### Code Changes

- [ ] ExaminationBatchDetail state expansion
- [ ] Unified data loading implementation
- [ ] Service wrapper functions
- [ ] ExaminationPricingSettingsDialog transformation
- [ ] ManageSubjectsDialog live preview integration
- [ ] AddClassDialog enhancement
- [ ] ExaminationPricingContext creation (optional)
- [ ] Type guards implementation
- [ ] Error handling and notifications

### Testing

- [ ] TypeScript compilation errors resolved
- [ ] Unit tests for calculation logic
- [ ] Integration tests for service calls
- [ ] UI interaction testing
- [ ] Performance testing (useMemo efficiency)

### Documentation

- [ ] Update component documentation
- [ ] Document new props interfaces
- [ ] Add usage examples for context
- [ ] Update architecture diagrams

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| State synchronization issues | High | Implement proper loading states, useEffect dependencies |
| Performance degradation | Medium | Use useMemo for calculations, lazy load inventory |
| Breaking changes to dialogs | High | Maintain backward-compatible props, gradual migration |
| Type safety violations | Medium | Implement runtime type guards, strict TypeScript |
| Data persistence failures | High | Add error boundaries, retry logic for service calls |

## Success Criteria

1. **Functionality**: All pricing settings configurable from ExaminationBatchDetail
2. **Performance**: No perceptible lag in live preview updates (<100ms)
3. **UX**: Users see cost impact immediately when adding subjects
4. **Maintainability**: Clear separation of concerns, documented interfaces
5. **Reliability**: Zero data loss, proper error handling

## Appendix: File Modifications Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `views/examination/ExaminationBatchDetail.tsx` | Major | State expansion, service integration, UI enhancements |
| `views/examination/components/ExaminationPricingSettingsDialog.tsx` | Major | Transform to presentation component |
| `views/examination/components/ManageSubjectsDialog.tsx` | Major | Add live preview, pricing props |
| `views/examination/components/AddClassDialog.tsx` | Minor | Add pricing context props |
| `context/ExaminationPricingContext.tsx` | New | Optional context for prop drilling elimination |
| `types.ts` | None | No changes required |
| `utils/examinationPricingCalculator.ts` | Minor | Add type guards |
| `services/examinationSyncService.ts` | None | No changes required |
| `services/examinationBatchService.ts` | None | No changes required |
