# Examination Pricing Redesign - Visual Architecture

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        EXAMINATION PRICING SYSTEM                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐         ┌──────────────────────────┐
│  PRICING SETTINGS MODULE │         │   CLASSES & SUBJECTS     │
│                          │         │       TABLE              │
│  ┌────────────────────┐  │         │  ┌────────────────────┐  │
│  │ Hidden BOM Config  │  │         │  │ Class A            │  │
│  │ • Paper Cost       │  │         │  │ ├─ Expected Fee    │  │
│  │ • Toner Cost       │  │         │  │ ├─ Final Fee       │  │
│  │ • Conversion Rate  │  │         │  │ ├─ Live Total      │  │
│  └────────────────────┘  │         │  │ └─ Subjects[]      │  │
│  ┌────────────────────┐  │         │  └────────────────────┘  │
│  │ Market Adjustments │  │         │  ┌────────────────────┐  │
│  │ • Transport        │  │         │  │ Class B            │  │
│  │ • Markup           │  │         │  │ ├─ Expected Fee    │  │
│  │ • Rounding         │  │         │  │ ├─ Final Fee       │  │
│  └────────────────────┘  │         │  │ ├─ Live Total      │  │
│           │              │         │  │ └─ Subjects[]      │  │
│           ▼              │         │  └────────────────────┘  │
│  ┌────────────────────┐  │         │           ...            │
│  │     SAVE BUTTON    │  │         │                          │
│  └────────────────────┘  │         └──────────────────────────┘
│           │                           ▲           ▲
│           │                           │           │
│           └───────────┬───────────────┘           │
│                       │                           │
│                       ▼                           │
│         ┌────────────────────────┐                │
│         │  BIDIRECTIONAL SYNC    │                │
│         │  ENGINE                │                │
│         │                        │                │
│         │  For Each Class:       │                │
│         │  1. Calculate Expected │                │
│         │     Fee (BOM + Adj)    │                │
│         │  2. Set Final Fee =    │                │
│         │     Expected           │                │
│         │  3. Calculate Live     │                │
│         │     Total              │                │
│         │  4. Persist to DB      │────────────────┘
│         └────────────────────────┘
│                       │
│                       ▼
│         ┌────────────────────────┐
│         │   AUDIT TRAIL          │
│         │  • Updated At          │
│         │  • Updated By          │
│         │  • Source (System/     │
│         │    Manual/Pricing)     │
│         └────────────────────────┘
└──────────────────────────┘
```

## Real-Time Override Cascade

```
┌─────────────────────────────────────────────────────────────────┐
│                 OVERRIDE INPUT FIELD                            │
│  User types: 150.00                                             │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼ Immediate (no delay)
                    ┌──────────────────────────┐
                    │  CASCADE ENGINE          │
                    │                          │
                    │  Input: 150.00           │
                    │                          │
                    │  Process:                │
                    │  • Update Final Fee      │
                    │    = 150.00              │
                    │  • Recalculate Live      │
                    │    Total = 150 × 25      │
                    │    learners              │
                    │  • Result: 3750.00       │
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌─────────────────┐ ┌──────────────┐ ┌────────────────┐
    │ UI UPDATE       │ │ UI UPDATE    │ │ UI UPDATE      │
    │                 │ │              │ │                │
    │ Final Fee/Learner│ │ Live Total   │ │ Status         │
    │ MWK 150.00      │ │ MWK 3,750.00 │ │ Modified*      │
    │ (orange text)   │ │ (green text) │ │ (unsaved)      │
    └─────────────────┘ └──────────────┘ └────────────────┘
                               │
                               ▼ On "Apply" Button Click
                    ┌──────────────────────────┐
                    │  PERSISTENCE             │
                    │                          │
                    │  • Save Final Fee        │
                    │  • Save Live Total       │
                    │  • Save Override Reason  │
                    │  • Update Audit Trail    │
                    └──────────────────────────┘
```

## Data Governance - Invoice Generation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   INVOICE GENERATION REQUEST                    │
│  User clicks "Generate Invoice"                                 │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │  DATA GOVERNANCE         │
                    │  VALIDATOR               │
                    │                          │
                    │  STRICT ENFORCEMENT:     │
                    │                          │
                    │  FOR EACH CLASS:         │
                    │  ┌────────────────────┐  │
                    │  │ Check final_fee_   │  │
                    │  │ per_learner exists │  │
                    │  │ ► ERROR if null    │  │
                    │  └────────────────────┘  │
                    │  ┌────────────────────┐  │
                    │  │ Check live_total_  │  │
                    │  │ preview exists     │  │
                    │  │ ► ERROR if null    │  │
                    │  └────────────────────┘  │
                    │  ┌────────────────────┐  │
                    │  │ Validate:          │  │
                    │  │ Live Total ==      │  │
                    │  │ Final Fee ×        │  │
                    │  │ Learners           │  │
                    │  │ ► WARNING if off   │  │
                    │  └────────────────────┘  │
                    └──────────┬───────────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │ VALIDATION PASSES   │         │ VALIDATION FAILS    │
    │                     │         │                     │
    │ All classes have    │         │ Missing fields      │
    │ required fields     │         │ or invalid data     │
    └──────────┬──────────┘         └──────────┬──────────┘
               │                                 │
               ▼                                 ▼
    ┌─────────────────────┐         ┌─────────────────────┐
    │ CREATE INVOICE      │         │ SHOW ERROR          │
    │                     │         │                     │
    │ Line Items:         │         │ "Class 1:           │
    │ • Unit Price =      │         │ final_fee_per_      │
    │   final_fee_per_    │         │ learner not         │
    │   learner           │         │ populated"          │
    │                     │         │                     │
    │ • Total Amount =    │         │ BLOCK GENERATION    │
    │   live_total_       │         │                     │
    │   preview           │         │                     │
    │                     │         │                     │
    │ STRICT FIELD USAGE  │         │                     │
    │ No other fields     │         │                     │
    │ allowed!            │         │                     │
    └─────────────────────┘         └─────────────────────┘
```

## Three Critical Financial Metrics

```
┌─────────────────────────────────────────────────────────────────┐
│              THE THREE METRICS EXPLAINED                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  1. EXPECTED FEE PER LEARNER                                    │
│     ┌────────────────────────────────────────────────────┐      │
│     │  Calculation:                                      │      │
│     │  BOM Cost = Paper + Toner                          │      │
│     │  Adjustments = Market Adj + Rounding               │      │
│     │  Total Cost = BOM + Adjustments                    │      │
│     │  Expected Fee = Total Cost ÷ Learners              │      │
│     │                                                    │      │
│     │  Example: MWK 145.50                               │      │
│     └────────────────────────────────────────────────────┘      │
│                          │                                      │
│                          ▼                                      │
│     READ-ONLY (System Calculated)                               │
│     └────────────────────────────────────────────────────┐      │
│     │  Mirrors Pricing Settings exactly                  │      │
│     │  Changes when pricing settings saved               │      │
│     │  Reference value for comparison                    │      │
│     └────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  2. FINAL FEE PER LEARNER                                       │
│     ┌────────────────────────────────────────────────────┐      │
│     │  Initial Value: = Expected Fee                     │      │
│     │                                                    │      │
│     │  After Override: = User Input                      │      │
│     │                                                    │      │
│     │  Example: MWK 150.00 (overridden from 145.50)      │      │
│     └────────────────────────────────────────────────────┘      │
│                          │                                      │
│                          ▼                                      │
│     MUTABLE (Editable via Override)                             │
│     ┌────────────────────────────────────────────────────┐      │
│     │  Used as UNIT PRICE on invoices                    │      │
│     │  Can be changed per class                          │      │
│     │  Preserved across recalculations                   │      │
│     └────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  3. LIVE TOTAL PREVIEW                                          │
│     ┌────────────────────────────────────────────────────┐      │
│     │  Calculation:                                      │      │
│     │  Live Total = Final Fee × Number of Learners       │      │
│     │                                                    │      │
│     │  Example: 150.00 × 25 learners = MWK 3,750.00      │      │
│     └────────────────────────────────────────────────────┘      │
│                          │                                      │
│                          ▼                                      │
│     AUTO-CALCULATED (Real-time)                                 │
│     ┌────────────────────────────────────────────────────┐      │
│     │  Used as TOTAL AMOUNT on invoices                  │      │
│     │  Updates immediately when Final Fee changes        │      │
│     │  Per-class granular total                          │      │
│     └────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## Per-Class Financial Segmentation

```
┌─────────────────────────────────────────────────────────────────┐
│              EXAMINATION BATCH: "Mid-Term Exams 2026"           │
│              School: ABC Academy                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CLASS 1: Grade 10A                     25 Learners              │
├─────────────────────────────────────────────────────────────────┤
│ Metric              │ Value           │ Invoice Usage           │
├─────────────────────┼─────────────────┼─────────────────────────┤
│ Expected Fee/Learner│ MWK 145.50      │ Display only            │
│ Final Fee/Learner   │ MWK 150.00      │ ► UNIT PRICE            │
│ Live Total Preview  │ MWK 3,750.00    │ ► TOTAL AMOUNT          │
├─────────────────────┴─────────────────┴─────────────────────────┤
│ Subjects: Mathematics (20 pages), English (15 pages)            │
│ Override Reason: Rush order fee                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CLASS 2: Grade 10B                     30 Learners              │
├─────────────────────────────────────────────────────────────────┤
│ Metric              │ Value           │ Invoice Usage           │
├─────────────────────┼─────────────────┼─────────────────────────┤
│ Expected Fee/Learner│ MWK 145.50      │ Display only            │
│ Final Fee/Learner   │ MWK 145.50      │ ► UNIT PRICE            │
│ Live Total Preview  │ MWK 4,365.00    │ ► TOTAL AMOUNT          │
├─────────────────────┴─────────────────┴─────────────────────────┤
│ Subjects: Mathematics (20 pages), Science (25 pages)            │
│ Override: None (using system calculated)                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ CLASS 3: Grade 11A                     22 Learners              │
├─────────────────────────────────────────────────────────────────┤
│ Metric              │ Value           │ Invoice Usage           │
├─────────────────────┼─────────────────┼─────────────────────────┤
│ Expected Fee/Learner│ MWK 180.25      │ Display only            │
│ Final Fee/Learner   │ MWK 175.00      │ ► UNIT PRICE            │
│ Live Total Preview  │ MWK 3,850.00    │ ► TOTAL AMOUNT          │
├─────────────────────┴─────────────────┴─────────────────────────┤
│ Subjects: Physics (30 pages), Chemistry (28 pages)              │
│ Override Reason: Volume discount applied                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ INVOICE TOTALS                                                  │
├─────────────────────────────────────────────────────────────────┤
│ Grade 10A: MWK 3,750.00                                         │
│ Grade 10B: MWK 4,365.00                                         │
│ Grade 11A: MWK 3,850.00                                         │
├─────────────────────────────────────────────────────────────────┤
│ GRAND TOTAL: MWK 11,965.00                                      │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Checklist

```
┌─────────────────────────────────────────────────────────────────┐
│                   IMPLEMENTATION STATUS                         │
└─────────────────────────────────────────────────────────────────┘

Database Layer              [✓] Complete
├── Schema updates          [✓] Added 6 new columns
├── Migration script        [✓] Created with data backfill
└── Indexes                 [✓] Performance optimization

Backend Services            [✓] Complete
├── Calculation updates     [✓] Persist three metrics
├── New API endpoints       [✓] 3 new routes
├── Sync engine             [✓] Bidirectional sync
└── Audit logging           [✓] Full trail

Frontend Services           [✓] Complete
├── Sync service            [✓] examinationPricingSyncService.ts
├── Governance service      [✓] invoiceDataGovernanceService.ts
├── Cascade engine          [✓] overrideCascadeEngine.ts
└── Calculator updates      [✓] Three metrics calculation

UI Components               [✓] Complete
├── Pricing Settings Dialog [✓] Auto-sync on save
├── Batch Detail View       [✓] Three metrics display
├── Real-time cascade       [✓] Immediate update
└── Override handling       [✓] Apply/Reset flow

Data Governance             [✓] Complete
├── Field validation        [✓] Strict enforcement
├── Invoice generation      [✓] Only allowed fields
└── Error handling          [✓] Clear messages

Testing & Validation        [○] Pending
├── Migration testing       [○] Run on test data
├── Integration testing     [○] End-to-end flow
└── Performance testing     [○] Load testing
```
