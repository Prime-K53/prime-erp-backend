# Examination Module BOM Redesign Implementation Plan

## Executive Summary
This document outlines a comprehensive redesign of the examination module's Bill of Materials (BOM) integration. The goal is to replicate the complete BOM settings structure from the Inventory Modal (`ItemModal.tsx`) and apply it as the authoritative source for all examination calculations, cost deductions, material deductions, and pricing computations throughout the system.

---

## 1. Current State Analysis

### 1.1 Examination Module Architecture
**File:** `views/production/ExaminationPrinting.tsx`

The examination module currently uses a simplified BOM configuration:
- **BOM Source:** `companyConfig.productionSettings.defaultExamBomId`
- **Fallback:** Generic BOM (`BOM-EXAM-GENERIC`)
- **Current Flow:**
  1. Reads `defaultExamBomId` from company config
  2. Tries to find matching BOMTemplate first
  3. Falls back to regular BOM
  4. Uses hardcoded generic fallback

```typescript
// Current implementation (lines 200-242)
const examBOM = useMemo(() => {
  const configuredBomId = companyConfig?.productionSettings?.defaultExamBomId;
  if (configuredBomId) {
    const template = (bomTemplates || []).find(t => t.id === configuredBomId);
    // ... template handling
  }
  // Fallback to generic BOM
}, [boms, companyConfig?.productionSettings?.defaultExamBomId, bomTemplates]);
```

### 1.2 Inventory Modal BOM Settings Structure
**File:** `views/inventory/components/ItemModal.tsx`

The inventory modal provides comprehensive BOM settings:

| Setting | Type | Description |
|---------|------|-------------|
| `pricingConfig.paperId` | string | Paper material ID |
| `pricingConfig.tonerId` | string | Toner material ID |
| `smartPricing.pricingModel` | enum | 'per-page', 'per-learner', 'per-book', 'per-job', 'cost-plus' |
| `smartPricing.bomTemplateId` | string | BOM template ID for dynamic pricing |
| `smartPricing.baseMargin` | number | Base margin percentage |
| `smartPricing.marketAdjustmentId` | string | Market adjustment ID |
| `smartPricing.isOnlineMode` | boolean | Online mode flag |
| `smartPricing.vatEnabled` | boolean | VAT enable flag |
| `smartPricing.vatPercentage` | number | VAT percentage |

### 1.3 Related Types
**File:** `types.ts`

```typescript
// SmartPricingConfig (lines 1653-1660)
export interface SmartPricingConfig {
  pricingModel: 'per-page' | 'per-learner' | 'per-book' | 'per-job' | 'cost-plus';
  bomTemplateId?: string;
  baseMargin: number;
  marketAdjustmentId?: string;
  isOnlineMode: boolean;
  vatEnabled: boolean;
  vatPercentage?: number;
}

// BOMTemplate (lines 1598-1613)
export interface BOMTemplate {
  id: string;
  name: string;
  type: string;
  components: {
    itemId: string;
    name: string;
    quantityFormula: string;
    unit: string;
    consumptionMode?: 'PAGE_BASED' | 'UNIT_BASED';
    costRole?: 'production' | 'inventory' | 'both';
  }[];
  defaultMargin?: number;
  laborCost?: number;
  lastUpdated?: string;
}

// Production Settings (lines 843-851)
export interface ProductionSettings {
  autoConsumeMaterials?: boolean;
  requireQAApproval?: boolean;
  allowOverproduction?: boolean;
  trackMachineDownTime?: boolean;
  defaultWorkCenterId?: string;
  showKioskSummary?: boolean;
  defaultExamBomId?: string;
}
```

---

## 2. Functionalities to Preserve

### 2.1 Core Examination Module Features
- [ ] School/Class/Subject management
- [ ] Examination batch creation
- [ ] Cost calculation (per learner, per sheet)
- [ ] Inventory deduction (paper, toner)
- [ ] Invoice generation
- [ ] Status tracking (Pending → In Progress → Completed → Invoiced)
- [ ] Statistics and reporting
- [ ] Waste tracking

### 2.2 Business Logic
- [ ] Pricing type: margin-based vs per-sheet
- [ ] Extra copies calculation
- [ ] Waste percentage handling
- [ ] Material consumption formulas
- [ ] Labor cost calculations

### 2.3 Navigation & Integration
- [ ] Route: `/industrial/exams` (IndustrialHub.tsx)
- [ ] Dashboard integration (examinationQueue)
- [ ] Invoice generation (ExaminationInvoice)
- [ ] Payment integration (Payments.tsx - exam invoice handling)
- [ ] POS integration

---

## 3. Implementation Phases

### Phase 1: Data Structure Alignment (Week 1)
1.1. **Extend Production Settings**
   - Add new fields to `productionSettings` in `types.ts`
   - Add `pricingModel`, `baseMargin`, `marketAdjustmentId`, `paperId`, `tonerId`

1.2. **Create BOM Settings Component**
   - Create reusable BOM settings component
   - Replicate Inventory Modal's Hidden BOM section
   - Add to Examination Settings in ExaminationPrinting.tsx

### Phase 2: Calculation Pathway Modification (Week 2)
2.1. **Update Cost Calculation**
   - Modify `calculateCost` function in ExaminationPrinting.tsx
   - Use new BOM settings instead of legacy defaultExamBomId

2.2. **Update Pricing Calculation**
   - Implement pricingModel-based pricing
   - Apply baseMargin from settings
   - Integrate market adjustments

2.3. **Update Material Deduction**
   - Modify inventory deduction logic
   - Use paperId/tonerId from settings
   - Apply consumption formulas

### Phase 3: UI/UX Enhancement (Week 3)
3.1. **Settings Panel Redesign**
   - Add comprehensive BOM configuration panel
   - Include material selection
   - Add pricing model selector

3.2. **Integration with Inventory Modal**
   - Ensure consistency between both BOM settings
   - Add sync mechanism

### Phase 4: Testing & Validation (Week 4)
4.1. **Unit Testing**
   - Test all calculation functions
   - Test material deduction

4.2. **Integration Testing**
   - End-to-end examination workflow
   - Invoice generation

4.3. **User Acceptance Testing**
   - Real-world scenarios

---

## 4. Detailed Implementation Steps

### Step 1: Extend Types
**File:** `types.ts`

```typescript
// Add to productionSettings
export interface ProductionSettings {
  autoConsumeMaterials?: boolean;
  requireQAApproval?: boolean;
  allowOverproduction?: boolean;
  trackMachineDownTime?: boolean;
  defaultWorkCenterId?: string;
  showKioskSummary?: boolean;
  defaultExamBomId?: string;
  // NEW FIELDS - Replicated from Inventory Modal
  pricingModel?: 'per-page' | 'per-learner' | 'per-book' | 'per-job' | 'cost-plus';
  baseMargin?: number;
  marketAdjustmentId?: string;
  paperId?: string;
  tonerId?: string;
  laborCostPerHour?: number;
  defaultWastePercentage?: number;
}
```

### Step 2: Update ExaminationPrinting.tsx
**File:** `views/production/ExaminationPrinting.tsx`

**Current BOM Logic (lines 200-242):**
```typescript
const examBOM = useMemo(() => {
  const configuredBomId = companyConfig?.productionSettings?.defaultExamBomId;
  if (configuredBomId) {
    const template = (bomTemplates || []).find(t => t.id === configuredBomId);
    // ...
  }
}, [boms, companyConfig?.productionSettings?.defaultExamBomId, bomTemplates]);
```

**New BOM Logic:**
```typescript
const examBOM = useMemo(() => {
  // 1. Use new comprehensive settings
  const settings = companyConfig?.productionSettings;
  
  // 2. Get materials from settings
  const paperItem = (inventory || []).find(i => i.id === settings?.paperId);
  const tonerItem = (inventory || []).find(i => i.id === settings?.tonerId);
  
  // 3. Get BOM template
  const bomTemplateId = settings?.defaultExamBomId || settings?.bomTemplateId;
  const template = (bomTemplates || []).find(t => t.id === bomTemplateId);
  
  return {
    paper: paperItem,
    toner: tonerItem,
    template: template,
    pricingModel: settings?.pricingModel || 'per-learner',
    baseMargin: settings?.baseMargin || 20,
    marketAdjustmentId: settings?.marketAdjustmentId,
    laborCost: settings?.laborCostPerHour || 10,
    wastePercentage: settings?.defaultWastePercentage || 10
  };
}, [bomTemplates, inventory, companyConfig?.productionSettings]);
```

### Step 3: Add Settings Panel
**File:** `views/production/ExaminationPrinting.tsx`

Add a new settings section that mirrors the Inventory Modal's Hidden BOM section:

```tsx
// Settings Panel Component
const ExamSettingsPanel = () => {
  const { companyConfig, updateCompanyConfig } = useData();
  const settings = companyConfig?.productionSettings || {};
  
  return (
    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
      <h4 className="text-sm font-medium text-slate-700 mb-3">
        Examination BOM Configuration
      </h4>
      
      {/* Paper Material */}
      <select
        value={settings.paperId || ''}
        onChange={(e) => updateCompanyConfig({
          productionSettings: { ...settings, paperId: e.target.value }
        })}
      >
        <option value="">Select Paper Material...</option>
        {paperMaterials.map(m => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      
      {/* Toner Material */}
      <select
        value={settings.tonerId || ''}
        onChange={(e) => updateCompanyConfig({
          productionSettings: { ...settings, tonerId: e.target.value }
        })}
      >
        <option value="">Select Toner Material...</option>
        {tonerMaterials.map(m => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
      
      {/* Pricing Model */}
      <select
        value={settings.pricingModel || 'per-learner'}
        onChange={(e) => updateCompanyConfig({
          productionSettings: { ...settings, pricingModel: e.target.value }
        })}
      >
        <option value="per-learner">Per Learner</option>
        <option value="per-page">Per Page</option>
        <option value="per-book">Per Book</option>
        <option value="per-job">Per Job</option>
        <option value="cost-plus">Cost Plus</option>
      </select>
      
      {/* Base Margin */}
      <input
        type="number"
        value={settings.baseMargin || 20}
        onChange={(e) => updateCompanyConfig({
          productionSettings: { ...settings, baseMargin: Number(e.target.value) }
        })}
      />
    </div>
  );
};
```

---

## 5. Calculation/Deduction Pathway Mapping

### 5.1 Cost Calculation Flow
| Step | Current Path | New Path |
|------|--------------|----------|
| 1 | Read defaultExamBomId | Read full productionSettings |
| 2 | Find BOMTemplate | Find BOMTemplate + Materials |
| 3 | Calculate base cost | Calculate with paper/toner costs |
| 4 | Apply legacy formulas | Apply consumption formulas |

### 5.2 Inventory Deduction Flow
| Step | Current Path | New Path |
|------|--------------|----------|
| 1 | Use hardcoded materials | Use settings.paperId |
| 2 | Calculate sheets | Use formula from template |
| 3 | Deduct from inventory | Same + apply toner deduction |
| 4 | Log transaction | Enhanced logging |

### 5.3 Pricing Flow
| Step | Current Path | New Path |
|------|--------------|----------|
| 1 | Use charge_per_learner | Use pricingModel |
| 2 | Fixed calculation | Dynamic: baseMargin + marketAdj |
| 3 | No VAT handling | Apply vatEnabled/vatPercentage |

---

## 6. Testing & Validation Strategy

### 6.1 Unit Tests
- [ ] Test BOM template resolution
- [ ] Test cost calculation with different pricing models
- [ ] Test material deduction formulas
- [ ] Test market adjustment application
- [ ] Test VAT calculation

### 6.2 Integration Tests
- [ ] Create examination → verify cost calculation
- [ ] Complete examination → verify inventory deduction
- [ ] Generate invoice → verify pricing
- [ ] Process payment → verify ledger entry

### 6.3 Data Validation
- [ ] Verify paper/toner quantities match actual consumption
- [ ] Verify cost totals align with BOM calculations
- [ ] Verify invoice amounts match expected pricing

---

## 7. Rollback Plan

### 7.1 Pre-Implementation Backup
1. **Database:** Create full backup of SQLite database
2. **Configuration:** Export companyConfig JSON
3. **Code:** Tag current version in git

### 7.2 Rollback Triggers
- Critical calculation errors > 5% variance
- Inventory deduction failures
- Invoice generation failures
- Data integrity issues

### 7.3 Rollback Steps
1. Revert code changes
2. Restore database from backup
3. Restore companyConfig
4. Verify examination module functions
5. Notify stakeholders of rollback

### 7.4 Quick Fix Strategy
For minor issues:
1. Add feature flag to toggle between old/new logic
2. Log detailed error information
3. Implement hotfix without full rollback

---

## 8. Implementation Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1: Data Structure | 1 week | Extended types, updated configs |
| Phase 2: Calculation | 2 weeks | New calculation pathways |
| Phase 3: UI Enhancement | 1 week | Settings panel |
| Phase 4: Testing | 1 week | Test reports, validation |
| **Total** | **5 weeks** | Complete implementation |

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing calculations | High | Feature flag, extensive testing |
| Data migration issues | Medium | Backup, validation scripts |
| Performance degradation | Low | Memoization, optimization |
| User adoption | Medium | Training, documentation |

---

## 10. Approval Required

This implementation plan requires approval from:
- [ ] Technical Lead
- [ ] Product Owner
- [ ] QA Lead

---

## Summary

This plan replicates the comprehensive BOM settings from the Inventory Modal into the Examination Module, creating a unified configuration source. The key changes include:

1. **Extended Production Settings** - Adding all inventory modal BOM fields
2. **Enhanced BOM Resolution** - Using full settings instead of just BOM ID
3. **Material Selection** - Paper/toner from settings
4. **Pricing Models** - Supporting all pricing models from inventory
5. **Market Adjustments** - Full integration with market adjustment system

The implementation maintains all existing functionality while providing a more robust and configurable BOM system.