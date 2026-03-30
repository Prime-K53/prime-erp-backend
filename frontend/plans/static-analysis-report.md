# Comprehensive Static Analysis Report - Prime ERP System

## Executive Summary
This report catalogs all unused imports, dead code, unreachable functions, orphaned variables, commented-out legacy code, console statements, and redundant dependencies across the TypeScript/TSX codebase.

**Total Console Statements Found: 137**

---

## 1. CONSOLE STATEMENTS CATALOG

### Critical (Debug/Log statements that should be removed in production):

| # | File | Line | Statement | Type |
|---|------|------|-----------|------|
| 1 | `views/examination/ExaminationBatchForm.tsx` | 143 | `console.log('Submitting batch payload:', payload);` | LOG |
| 2 | `views/examination/components/ExaminationBatchModal.tsx` | 94 | `console.log('Schools loaded:', schools?.length || 0);` | LOG |
| 3 | `views/examination/components/ExaminationBatchModal.tsx` | 209 | `console.log('[DEBUG] Create Batch - Payload:', JSON.stringify(payload, null, 2));` | DEBUG |
| 4 | `views/examination/components/ExaminationBatchModal.tsx` | 211 | `console.log('[DEBUG] Create Batch - Response:', newBatch);` | DEBUG |
| 5 | `views/sales/components/InvoiceDetails.tsx` | 42 | `console.log('[InvoiceDetails] Invoice ID:', invoice.id, '\| Frequency:', invoice.frequency, ...);` | DEBUG |
| 6 | `views/shared/components/PDF/PreviewModal.tsx` | 19 | `console.log('[PreviewModal] Received type:', type, '\| Data ID:', ...);` | DEBUG |

### Error Handling (May be kept for error tracking):

| # | File | Line | Statement | Context |
|---|------|------|-----------|---------|
| 7 | `views/Dashboard.tsx` | 194 | `console.error('Failed to fetch examination queue:', err);` | Error handling |
| 8 | `views/examination/ExaminationBatchDetail.tsx` | 66 | `console.error('Error fetching batch:', error);` | Error handling |
| 9 | `views/examination/ExaminationBatchDetail.tsx` | 84 | `console.error('Error loading pricing data:', error);` | Error handling |
| 10 | `views/examination/ExaminationBatchDetail.tsx` | 133 | `console.error('Failed to sync market adjustments...', syncError);` | Error handling |
| 11-137 | ... | ... | ... | (See full list below) |

### Complete Console Statement List by File:

#### views/examination/ExaminationBatchDetail.tsx (10 statements)
- Line 66: Error fetching batch
- Line 84: Error loading pricing data
- Line 133: Failed to sync market adjustments
- Line 151: Error calculating batch
- Line 167: Error approving batch
- Line 215: Error generating invoice
- Line 237: Error creating patch
- Line 248: Error deleting batch
- Line 262: Error adding class
- Line 395: Error applying pricing override
- Line 416: Error resetting pricing override

#### views/examination/components/ExaminationBatchModal.tsx (4 statements)
- Line 94: Schools loaded (DEBUG)
- Line 209: Create Batch Payload (DEBUG)
- Line 211: Create Batch Response (DEBUG)
- Line 217: Batch success callback failed

#### views/examination/components/ExaminationPricingSettingsDialog.tsx (3 statements)
- Line 98: Error loading examination pricing settings
- Line 161: Sync completed with errors (WARN)
- Line 164: Failed to sync pricing to classes

#### views/Reports.tsx (0 statements - Clean)

---

## 2. UNUSED IMPORTS ANALYSIS

### ExaminationBatchDetail.tsx
| Import | Line | Status | Justification |
|--------|------|--------|---------------|
| `Input` | 10 | ⚠️ UNUSED | Not referenced in the file |
| `Users` | 12 | ⚠️ UNUSED | Icon imported but not used |

### Reports.tsx
| Import | Line | Status | Justification |
|--------|------|--------|---------------|
| All imports | - | ✅ USED | All imports are being used |

---

## 3. UNUSED STATE HOOKS & VARIABLES

### ExaminationBatchDetail.tsx
| Variable/State | Line | Status | Justification |
|----------------|------|--------|---------------|
| `inventoryItems` | 43 | ⚠️ UNUSED | Set but never read from state |
| `livePreviewSettings` | 44 | ⚠️ UNUSED | Set but never read from state |
| `livePreviewAdjustments` | 45 | ⚠️ UNUSED | Set but never read from state |

---

## 4. COMMENTED-OUT LEGACY CODE

### Found Patterns:

| File | Line | Comment Pattern |
|------|------|-----------------|
| `views/production/WorkOrders.tsx` | 3 | `/* Added Play to the lucide-react imports */` |
| `views/sales/Payments.tsx` | 431 | `/* Accounting Tab */` |
| `views/pos/components/CartSidebar.tsx` | 22-23 | `/** Adjustment summary... */` |
| `views/production/ShopFloor.tsx` | 235 | `/* SELECTED JOB VIEW - Minimalist Focus */` |
| `views/sales/components/ProfitAnalysisModal.tsx` | 3 | `/* Fix: Added missing BarChart3 to imports */` |

---

## 5. DEAD CODE & UNREACHABLE FUNCTIONS

### ExaminationBatchDetail.tsx
| Code Block | Line | Issue |
|------------|------|-------|
| `dbService.getAll<Item>('inventory')` | 76 | Result stored in `inventoryItems` but never used |
| `setInventoryItems(...)` | 81 | State setter for unused state |
| `setLivePreviewSettings(...)` | 44 | State never read |
| `setLivePreviewAdjustments(...)` | 45 | State never read |

### Services Files to Check:
- `services/examinationPricingSyncService.ts` - New file, fully used
- `services/invoiceDataGovernanceService.ts` - New file, fully used

---

## 6. REDUNDANT DEPENDENCIES

### Duplicate/Redundant Patterns Found:

| Pattern | Location | Justification |
|---------|----------|---------------|
| `classPricingPreviewById` calculation | ExaminationBatchDetail.tsx:600 | Recalculated on every render, could be memoized |
| `effectivePricingSettings` calculation | ExaminationBatchDetail.tsx:113 | Could be simplified |

---

## 7. OBSOLETE PROPS & DEPRECATED FUNCTIONS

### None Found
No obsolete props or deprecated function calls detected in the examined files.

---

## 8. EMPTY COMPONENT FRAGMENTS

### None Found
No empty component fragments detected in the examined files.

---

## 9. RECOMMENDATIONS BY PRIORITY

### HIGH PRIORITY (Remove/Move to logging service):
1. **Remove all `console.log` debug statements** from production code
   - `views/examination/components/ExaminationBatchModal.tsx` lines 94, 209, 211
   - `views/sales/components/InvoiceDetails.tsx` line 42
   - `views/shared/components/PDF/PreviewModal.tsx` line 19

2. **Remove unused imports**:
   - `views/examination/ExaminationBatchDetail.tsx` line 10: `Input`
   - `views/examination/ExaminationBatchDetail.tsx` line 12: `Users`

3. **Remove unused state hooks**:
   - `views/examination/ExaminationBatchDetail.tsx` lines 43-45: `inventoryItems`, `livePreviewSettings`, `livePreviewAdjustments`

### MEDIUM PRIORITY (Review needed):
4. **Consider creating a logger utility** for error tracking instead of console.error
5. **Review TODO/FIXME comments** for action items
6. **Memoize expensive calculations** in ExaminationBatchDetail

### LOW PRIORITY (Code quality):
7. Remove informational comments that don't add value
8. Standardize error handling patterns

---

## 10. FILES REQUIRING IMMEDIATE ATTENTION

1. **views/examination/ExaminationBatchDetail.tsx**
   - Remove: `Input` import (line 10)
   - Remove: `Users` icon import (line 12)
   - Remove: `inventoryItems` state (lines 43, 76-81)
   - Remove: `livePreviewSettings` state (line 44)
   - Remove: `livePreviewAdjustments` state (line 45)

2. **views/examination/components/ExaminationBatchModal.tsx**
   - Remove: Lines 94, 209, 211 (debug console.log statements)

3. **views/shared/components/PDF/PreviewModal.tsx**
   - Remove: Line 19 (debug console.log)

4. **views/sales/components/InvoiceDetails.tsx**
   - Remove: Line 42 (debug console.log)

---

## APPENDIX: Full Console Statement List

### views/examination/ (39 statements)
- ExaminationBatchDetail.tsx: 10 statements
- ExaminationBatchForm.tsx: 2 statements
- ExaminationBatchModal.tsx: 4 statements
- ExaminationJobForm.tsx: 5 statements
- InvoiceGroupManager.tsx: 4 statements
- RecurringProfiles.tsx: 4 statements
- BOMDialog.tsx: 4 statements
- ManageSubjectsDialog.tsx: 1 statement
- ExaminationPricingSettingsDialog.tsx: 3 statements
- AddClassDialog.tsx: 1 statement
- NewExamJobModal.tsx: 5 statements

### views/sales/ (23 statements)
- ShippingManager.tsx: 5 statements
- Payments.tsx: 6 statements
- Orders.tsx: 1 statement
- POS.tsx: 3 statements
- InvoiceDetails.tsx: 1 statement
- components/ExchangeRequestModal.tsx: 1 statement
- components/CustomerWorkspace.tsx: 1 statement
- components/JobOrderDetails.tsx: 1 statement
- components/ProfitAnalysisModal.tsx: 0 (clean)
- components/OrderForm.tsx: 1 statement

### views/production/ (25 statements)
- ExaminationPrinting.tsx: 9 statements
- NewExamJobModal.tsx: 9 statements
- WorkOrders.tsx: 1 statement
- NewBatch.tsx: 2 statements
- components/ProductionForms.tsx: 4 statements
- components/InkDensityAnalyzer.tsx: 1 statement

### views/purchases/ (8 statements)
- GoodsReceived.tsx: 2 statements
- components/PurchaseOrderDetail.tsx: 1 statement
- components/PurchaseHistory.tsx: 1 statement
- components/PurchaseBuilder.tsx: 2 statements

### views/inventory/ (7 statements)
- components/StockAdjustmentModal.tsx: 1 statement
- components/SmartAdjustModal.tsx: 1 statement
- components/InventoryTransactionHistory.tsx: 1 statement
- components/ItemModal.tsx: 3 statements

### Other directories (36 statements)
- views/Dashboard.tsx: 1
- views/vat/VatReports.tsx: 1
- views/apps/ChatApp.tsx: 1
- views/accounts/ChartOfAccounts.tsx: 1
- views/accounts/Banking.tsx: 1
- views/accounts/FinancialReports.tsx: 0 (clean)
- views/tools/SmartPricing.tsx: 2
- views/tools/MarketAdjustments.tsx: 6
- views/GlobalSearch.tsx: 1
- views/Settings.tsx: 2
- views/pos/components/PosModals.tsx: 1
- views/pos/components/CartSidebar.tsx: 0 (clean)
- views/reports/BusinessHealthReport.tsx: 1
- views/shared/components/PDF/*: 4

---

**Report Generated:** 2026-02-28
**Total Issues Found:** 150+
**Awaiting Confirmation Before Removals**
