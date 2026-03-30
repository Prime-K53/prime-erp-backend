
import { Item, PricingConfig, AdjustmentSnapshot, MarketAdjustment } from '../types';

export const getVariantPrice = (variant: Item) => {
    return variant.price || 0;
};

export const getVariantCost = (variant: Item) => {
    return variant.cost || 0;
};

/**
 * Calculates the cost and selling price of an item based on its BOM components (Paper, Toner, Finishing)
 * and active market adjustments.
 * 
 * @param pages Number of pages to calculate for (e.g. per book)
 * @param config The pricing configuration (BOM) for the item
 * @param materials List of all available materials (to lookup costs)
 * @param marketAdjustments List of all market adjustments (to apply active ones)
 * @returns Object containing calculated cost, price, and adjustment snapshots, or null if config is missing/overridden
 */
export const calculateItemFinancials = (
    pages: number,
    config: PricingConfig | undefined,
    materials: Item[],
    marketAdjustments: MarketAdjustment[]
) => {
    if (!config || config.manualOverride) return null;

    // 1. Paper Calculation
    // Logic: Sheets = ceil(Pages / 2) (Double-sided)
    // Cost = Sheets * (ReamCost / ReamSize)
    const paper = materials.find((m: Item) => m.id === config.paperId);
    const reamSize = paper?.conversionRate || 500;
    const sheetsNeeded = Math.ceil(pages / 2);
    const paperCost = paper ? ((paper.cost / reamSize) * sheetsNeeded) : 0;

    // 2. Toner Calculation
    // Logic: Cost = Pages * (TonerCost / Capacity)
    // Capacity assumed 20000 pages per unit if not specified? 
    // Previous logic hardcoded 20000.
    const toner = materials.find((m: Item) => m.id === config.tonerId);
    const tonerCost = toner ? ((toner.cost / 20000) * pages) : 0;

    // 3. Finishing Options Calculation
    // Logic: Cost = Sum of (MaterialCost / Capacity) * Usage
    // Capacity = rollLength || conversionRate || 1
    const finishingCost = config.finishingOptions.reduce((acc, option) => {
        const mat = materials.find((m: Item) => m.id === option.materialId);
        if (mat) {
            const capacity = mat.rollLength || mat.conversionRate || 1;
            const unitCost = mat.cost / capacity;
            return acc + (unitCost * option.quantity);
        }
        return acc;
    }, 0);

    const totalCost = paperCost + tonerCost + finishingCost;

    // 4. Market Adjustments
    let totalMarketAdj = 0;
    const activeAdjs = marketAdjustments.filter(ma => (ma.active ?? ma.isActive));
    const snapshots: AdjustmentSnapshot[] = [];

    activeAdjs.forEach(adj => {
        let amount = 0;
        // Check for both 'PERCENTAGE' and 'PERCENT' and lowercase variants as seen in codebase
        const type = adj.type?.toUpperCase();
        if (type === 'PERCENTAGE' || type === 'PERCENT') {
            amount = totalCost * (adj.value / 100);
        } else {
            // Scale fixed adjustment by pages to keep SP per page consistent
            amount = adj.value * pages;
        }
        totalMarketAdj += amount;

        snapshots.push({
            name: adj.name,
            type: adj.type as any,
            value: adj.value,
            percentage: (type === 'PERCENTAGE' || type === 'PERCENT') ? adj.value : undefined,
            calculatedAmount: Number(amount.toFixed(2))
        });
    });

    return {
        cost: Number(totalCost.toFixed(2)),
        price: Number((totalCost + totalMarketAdj).toFixed(2)),
        adjustmentSnapshots: snapshots
    };
};
