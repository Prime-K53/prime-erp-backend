# Pricing Calculator Feature Specification

## Project Overview
**Project Name:** Dashboard Pricing Calculator  
**Type:** Standalone pricing calculator with custom state management  
**Core Functionality:** A comprehensive pricing calculator positioned adjacent to the POS icon on the main dashboard interface that provides real-time price calculations based on pages, BOM, addons, and market adjustments.  
**Target Users:** Dashboard users (sales staff, administrators) who need quick price calculations

---

## UI/UX Specification

### Layout Structure

**Calculator Modal:**
- Fixed position modal overlay (z-index: 9999)
- Centered on screen with backdrop blur
- Dimensions: 600px width, auto height (max 700px)
- Sections arranged vertically with clear visual separation

**Dashboard Placement:**
- Calculator button positioned immediately to the right of the POS (ShoppingCart) button
- Uses Calculator icon from lucide-react
- Tooltip: "Pricing Calculator"

### Visual Design

**Color Palette:**
- Primary: `#2563eb` (Blue-600)
- Secondary: `#64748b` (Slate-500)
- Accent: `#10b981` (Emerald-500) for price display
- Background: `#ffffff` (White)
- Surface: `#f8fafc` (Slate-50)
- Border: `#e2e8f0` (Slate-200)
- Text Primary: `#1e293b` (Slate-800)
- Text Secondary: `#64748b` (Slate-500)
- Error: `#ef4444` (Red-500)
- Success: `#22c55e` (Green-500)

**Typography:**
- Font Family: Inter, system-ui, sans-serif
- Headings: 18px bold
- Labels: 14px medium
- Input text: 14px regular
- Price display: 24px bold (emerald color)

**Spacing System:**
- Container padding: 24px
- Section gap: 20px
- Input gap: 12px
- Border radius: 12px (containers), 8px (inputs/buttons)

**Visual Effects:**
- Box shadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25)`
- Backdrop blur: 12px
- Hover transitions: 150ms ease
- Input focus: 2px blue ring

### Components

**1. Calculator Toggle Button:**
- Size: 40px x 40px
- Icon: Calculator (24px)
- Position: Right of ShoppingCart button
- States: default, hover (bg-slate-200/50), active (scale-95)

**2. Calculator Modal Container:**
- White background with rounded corners
- Close button (X) top-right
- Header with title and subtitle
- Scrollable content area

**3. Page Count Input:**
- Label: "Number of Pages"
- Type: Number input with increment/decrement
- Range: 1-10000
- Default: 1
- Real-time calculation on change

**4. BOM Calculator Section:**
- Label: "Bill of Materials (BOM)"
- Collapsible accordion
- Material list with:
  - Material name
  - Unit cost display
  - Quantity (calculated)
  - Line total
- Materials tracked:
  - Paper (reams, calculated from pages)
  - Toner (grams/kg)
  - Finishing options (lamination, binding, etc.)
- Total BOM cost display

**5. Addon Pricing Module:**
- Label: "Add-ons"
- List of toggleable addons
- Each addon has:
  - Name
  - Cost input (number)
  - Toggle switch
- Default addons:
  - Design/Layout fee
  - Rush job surcharge
  - Delivery fee
  - Custom addon (user-defined)

**6. Market Adjustment Panel:**
- Label: "Market Adjustments"
- Toggle enable/disable
- Adjustment type selector: Percentage | Fixed Amount
- Value input field
- Active adjustments list from system (read-only)
- Custom adjustment input

**7. Price Summary Panel:**
- Sticky at bottom of modal
- Sections:
  - Base Cost (BOM)
  - Add-ons Total
  - Market Adjustment
  - **Final Price** (large, emerald colored)
- Real-time updates with subtle animation

---

## Functionality Specification

### Core Features

**1. Page-Based Calculation:**
- Input: Number of pages (1-10000)
- Output: Calculated paper sheets (double-sided: ceil(pages/2))
- Formula: `sheets = Math.ceil(pages / 2)`
- Paper cost: `sheets * (reamCost / 500)`

**2. BOM Calculator:**
- Reads material costs from inventory
- Calculates per-unit costs:
  - Paper: based on sheets needed
  - Toner: `pages * (tonerCost / 20000)`
  - Finishing: configurable options
- Displays itemized breakdown
- Updates in real-time

**3. Addon Pricing:**
- Predefined addons with editable costs
- Toggle on/off for each addon
- Custom addon support
- Addon costs are flat (not per-page)

**4. Market Adjustment:**
- Reads active market adjustments from system
- Supports:
  - Percentage adjustments (e.g., +15%)
  - Fixed amount adjustments (e.g., +ZAR 5.00)
- Custom adjustment input override
- Shows combined adjustment total

**5. Real-Time Calculations:**
- All changes trigger immediate recalculation
- No submit button needed
- Smooth number transitions

### User Interactions

1. Click Calculator icon → Opens modal
2. Enter/adjust page count → BOM recalculates
3. Toggle/add addons → Price updates
4. Enable/adjust market adjustment → Price updates
5. Click X or outside → Closes modal

### Data Handling

**State Management:**
- Custom React context: `PricingCalculatorContext`
- Local component state for inputs
- Integration with existing inventory/pricing services

**Integration Points:**
- `pricingService.calculateItemFinancials()` - for BOM calculations
- `dbService.getAll('marketAdjustments')` - for active adjustments
- `dbService.getAll('inventory')` - for material costs

### Edge Cases

- Zero pages: Show minimum price (base cost only)
- Very high pages (>10000): Allow but show warning
- No BOM template: Show manual cost input fallback
- No market adjustments: Show zero adjustment
- Negative values: Prevent/reset to zero

---

## Acceptance Criteria

1. ✅ Calculator button visible on dashboard next to POS button
2. ✅ Clicking button opens calculator modal
3. ✅ Page count input accepts values 1-10000
4. ✅ BOM section shows calculated material costs
5. ✅ Addons can be toggled and costs edited
6. ✅ Market adjustments can be applied (% or fixed)
7. ✅ Final price updates in real-time on any change
8. ✅ Modal closes on X click or outside click
9. ✅ UI matches color palette and typography specs
10. ✅ Calculator works without errors

---

## Implementation Notes

### Files to Create/Modify:
1. `context/PricingCalculatorContext.tsx` - State management
2. `components/PricingCalculator.tsx` - Main component
3. `views/Dashboard.tsx` - Add calculator button
4. `services/pricingCalculatorService.ts` - Calculation logic (optional)

### Dependencies:
- Existing: lucide-react, zustand, React hooks
- No new npm packages needed
