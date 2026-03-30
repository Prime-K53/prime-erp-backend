# POS Window UI/Theme Alignment Plan

## Objective
Transform the POS window to match the Create New Quotation window in terms of UI, theme, and dimensions.

---

## Current State Analysis

### POS Window (views/POS.tsx)
- **Layout:** Full-screen flex layout with horizontal split
- **Background:** `#f4f5f8` 
- **Borders:** `#d4d7dc`
- **Text:** `#393a3d`
- **Accent:** `#0077c5`
- **Success:** `#2ca01c`
- **Right Panel:** Fixed width 350-400px

### Create New Quotation Window (OrderForm.tsx)
- **Layout:** Modal overlay with max-w-6xl h-[90vh]
- **Background:** white, slate-50, #F8FAFC
- **Borders:** slate-200
- **Text:** slate-900, slate-800
- **Accent:** blue-600
- **Success:** emerald-600
- **Right Panel:** w-1/3

---

## Key Differences to Address

| Aspect | POS Current | Quotation Target |
|--------|-------------|------------------|
| Background | #f4f5f8 | #F8FAFC / slate-50 |
| Borders | #d4d7dc | slate-200 |
| Text Primary | #393a3d | slate-800 |
| Text Muted | #6b6c7f | slate-500 |
| Accent | #0077c5 | blue-600 |
| Success | #2ca01c | emerald-600 |
| Border Radius | Minimal | rounded-xl |
| Left Panel | flex-1 | w-2/3 |
| Right Panel | 350-400px | w-1/3 |

---

## Implementation Plan

### Phase 1: Main Container (POS.tsx)
1. Change background from `bg-[#f4f5f8]` to `bg-[#F8FAFC]`
2. Change text from `text-[#393a3d]` to `text-slate-800`
3. Update left panel width from `flex-1` to `w-2/3`
4. Update right panel width from `w-[350px] lg:w-[400px]` to `w-1/3`

### Phase 2: Header Styling (POS.tsx lines 590-623)
1. Background: white → slate-50
2. Border: #d4d7dc → slate-200
3. Text colors update
4. Button styling update

### Phase 3: ProductGrid Component
**Search Bar:**
- Border: #babec5 → slate-200
- Focus: #0077c5 → blue-600

**Category Filters:**
- Active: #393a3d → slate-900
- Inactive: #babec5 → slate-200

**Product Items:**
- Border: #d4d7dc → slate-200
- Active: #0077c5 → blue-600
- Add rounded-xl

### Phase 4: CartSidebar Component
**Container:**
- Border: #d4d7dc → slate-200

**Header:**
- Background: white → slate-50
- Icon: #eceef1 → slate-900

**Customer Selector:**
- Background: #f4f5f8 → slate-50
- Border: #babec5 → slate-200

**Cart Items:**
- Divider: #d4d7dc → slate-100
- Hover: #f4f5f8 → blue-50/30

**Totals Section:**
- Background: #f4f5f8 → slate-50
- Button: #2ca01c → emerald-600
- Add rounded-xl

### Phase 5: Modal Components
Update Z-Report and Payment modals to match theme

---

## Files to Modify

1. views/POS.tsx
2. views/pos/components/ProductGrid.tsx
3. views/pos/components/CartSidebar.tsx
4. views/pos/components/PaymentModal.tsx

---

## Acceptance Criteria

- [ ] POS window uses slate color palette
- [ ] Dimensions match Quotation proportions
- [ ] All borders use slate-200
- [ ] Accent color is blue-600
- [ ] Success buttons use emerald-600
- [ ] Rounded corners applied
- [ ] All POS functionality preserved
