UAT Checklist: Examination Module Rollout

Pre-Release Feature Flags
- Enable VITE_EXAM_INVOICE_SYNC_V2 for invoice mapper rollout
- Enable VITE_EXAM_BACKEND_META_SOURCE for backend adjustment metadata
- Optional local override: localStorage prime_feature_flags {"exam_invoice_sync_v2": true}

Core Scenarios
- BOM Preview: BOM modal loads persisted material rows and matches backend totals
- Adjustments: preview uses backend adjustment metadata or shows warning when stale
- Override: unauthorized users blocked, authorized users require reason, totals updated
- Rounding: fee rounding toggle reflects preview and saved class metrics
- Page Columns: class tables show pages/copies/sheets totals that match backend
- Grand Summary: operational totals and monetary totals reconcile with class tables
- Invoice Preview: no blank descriptions or quantities for invoice line items

Regression Focus Areas
- Batch hub list page totals and amount rendering
- Subject totals footer in SubjectTable
- Examination invoice class-grouped layout and legacy itemized layout
