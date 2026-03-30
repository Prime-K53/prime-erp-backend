import { Item, BOMTemplate, ConsumptionSnapshot, MarketAdjustment, ProductVariant, TransactionAdjustmentSnapshot, MarketAdjustmentTransaction, DynamicServiceDetails } from '../types';
import { pagesToReams, pagesToTonerKg } from '../utils/printConversions';
import { roundToCurrency } from '../utils/helpers';
import { calculateItemFinancials } from '../utils/pricing';
import { SafeFormulaEngine } from './formulaEngine';
import { applyProductPriceRounding } from './pricingRoundingService';

export interface PricingResult {
    price: number;
    basePrice: number;
    cost: number;
    consumption: ConsumptionSnapshot | null;
    breakdown: { category: string; amount: number }[];
    adjustmentTotal: number;
    adjustmentSnapshots: any[];
    /** Granular transaction-level adjustment snapshots for detailed tracking */
    transactionAdjustmentSnapshots: TransactionAdjustmentSnapshot[];
}

export interface DynamicServiceComponentCost {
    itemId: string;
    name: string;
    quantity: number;
    unit: string;
    unitCost: number;
    totalCost: number;
    usageType: 'per-page' | 'per-copy';
}

export interface DynamicServicePricingResult {
    pages: number;
    copies: number;
    totalPages: number;
    unitCostPerCopy: number;
    unitPricePerCopy: number;
    unitCostPerPage: number;
    unitPricePerPage: number;
    totalCost: number;
    totalPrice: number;
    calculatedTotalPrice: number;
    adjustmentTotal: number;
    adjustmentSnapshots: any[];
    components: DynamicServiceComponentCost[];
    serviceDetails: DynamicServiceDetails;
    /** When true, indicates the price has been locked by user confirmation and should not be recalculated on quantity changes */
    priceLocked?: boolean;
    /** The locked total price that should remain constant regardless of quantity modifications */
    lockedTotalPrice?: number;
    /** The locked unit price per copy that was confirmed by the user */
    lockedUnitPricePerCopy?: number;
    /** The locked unit cost per copy that was confirmed by the user */
    lockedUnitCostPerCopy?: number;
}

/**
 * Context for generating transaction-level adjustment records
 */
export interface TransactionContext {
    saleId: string;
    itemId: string;
    itemName: string;
    variantId?: string;
    quantity: number;
}

/**
 * Generate a unique ID for adjustment snapshots
 */
const generateAdjustmentId = () => {
    return `ADJ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const getCompanyConfig = () => {
    if (typeof window === 'undefined' || !window.localStorage) return undefined;
    try {
        const raw = localStorage.getItem('nexus_company_config');
        return raw ? JSON.parse(raw) : undefined;
    } catch {
        return undefined;
    }
};

export const pricingService = {
    formulaEngine: new SafeFormulaEngine(),

    /**
     * Calculates the price, cost, and consumption for an item based on its BOM and current market rates.
     */
    calculateItemPrice(
        item: Item,
        quantity: number,
        variantId: string | undefined,
        pagesOverride: number | undefined,
        inventory: Item[],
        bomTemplates: BOMTemplate[],
        marketAdjustments: MarketAdjustment[]
    ): PricingResult {
        let basePrice = item.price || 0;
        let baseCost = item.cost || 0;

        // 0. Find variant if applicable to get its specific base price/cost
        if (variantId && item.variants) {
            const variant = item.variants.find(v => v.id === variantId);
            if (variant) {
                if (variant.price > 0) basePrice = variant.price;
                if (variant.cost > 0) baseCost = variant.cost;
            }
        }

        // 0.1 If it's a material or stationery, it doesn't support BOM here
        if (item.type === 'Material' || item.type === 'Stationery') {
            return {
                price: item.type === 'Stationery' ? (basePrice * quantity) : 0,
                basePrice: item.type === 'Stationery' ? basePrice : 0,
                cost: baseCost * quantity,
                consumption: null,
                breakdown: [],
                adjustmentTotal: 0,
                adjustmentSnapshots: [],
                transactionAdjustmentSnapshots: []
            };
        }

        let cost = baseCost;
        let price = basePrice;
        let consumption: ConsumptionSnapshot | null = null;
        let breakdown: { category: string; amount: number }[] = [];
        let adjustmentTotal = 0;
        let adjustmentSnapshots: any[] = [];

        // 1. Calculate Base Cost from BOM if applicable
        if ((item as any).printConsumptionEnabled) {
            const templateId = item.smartPricing?.bomTemplateId;
            const template = bomTemplates.find(t => t.id === templateId);

            if (template) {
                // Determine Pages
                let pagesPerJob = 0;
                if (variantId && item.variants) {
                    const variant = item.variants.find(v => v.id === variantId);
                    if (variant) pagesPerJob = Number(variant.pages) || 0;
                } else {
                    pagesPerJob = pagesOverride ?? (item as any).pagesPerJob ?? Number(item.pages) ?? 0;
                }

                const totalPages = pagesPerJob * quantity;
                let paperConsumed = 0;
                let tonerConsumed = 0;
                let bomCost = 0;
                const bomBreakdown: any[] = [];

                for (const comp of template.components) {
                    const material = inventory.find(i => i.id === comp.itemId || i.name === comp.name);
                    if (!material) continue;

                    const mode = comp.consumptionMode || (comp.quantityFormula.includes('pages') ? 'PAGE_BASED' : 'UNIT_BASED');
                    const isPaper = comp.itemId.toLowerCase().includes('paper') || material.category === 'Paper';
                    const isToner = comp.itemId.toLowerCase().includes('toner') || material.category === 'Toner';

                    let consumedQty = 0;
                    if (isPaper) {
                        consumedQty = pagesToReams(mode === 'PAGE_BASED' ? totalPages : quantity);
                        paperConsumed += consumedQty;
                    } else if (isToner) {
                        consumedQty = pagesToTonerKg(mode === 'PAGE_BASED' ? totalPages : quantity);
                        tonerConsumed += consumedQty;
                    } else {
                        try {
                            const formula = comp.quantityFormula;
                            const variables = { quantity: quantity, pages: pagesPerJob };
                            const result = this.formulaEngine.evaluateWithResult(formula, variables);
                            consumedQty = result.success ? result.value : 0;

                            if (material.conversionRate && material.conversionRate > 1) {
                                if (!comp.quantityFormula.includes(material.conversionRate.toString())) {
                                    consumedQty = consumedQty / material.conversionRate;
                                }
                            }
                        } catch (e) {
                            console.error('Error evaluating formula:', e);
                        }
                    }

                    if (consumedQty > 0) {
                        const matCost = consumedQty * (material.cost || 0);
                        bomCost += matCost;
                        bomBreakdown.push({
                            materialId: material.id,
                            materialName: material.name,
                            quantity: consumedQty,
                            unit: material.unit,
                            cost: material.cost
                        });
                    }
                }

                cost = bomCost / quantity; // Unit cost

                consumption = {
                    id: `SNAP-${Date.now()}`,
                    saleId: '',
                    itemId: item.id,
                    variantId: variantId,
                    pages: totalPages,
                    paperConsumed,
                    tonerConsumed,
                    costPerUnit: cost,
                    bomBreakdown,
                    timestamp: new Date().toISOString()
                };
            }
        }

        // 2. Determine calculatedPrice based on inventory price or cost+margin
        let calculatedPrice = basePrice;

        if (consumption && basePrice <= cost) {
            calculatedPrice = cost * 1.3;
        }

        // Initialize transaction-level adjustment snapshots
        let transactionAdjustmentSnapshots: TransactionAdjustmentSnapshot[] = [];

        // Apply ALL active market adjustments with granular tracking
        marketAdjustments.forEach(adj => {
            const isActive = adj.active ?? adj.isActive;
            const categoryMatch = !adj.applyToCategories || adj.applyToCategories.length === 0 || adj.applyToCategories.includes(item.category);

            if (isActive && categoryMatch) {
                let amount = 0;
                if (adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' || adj.type === 'percentage') {
                    const pct = adj.percentage || adj.value;
                    amount = calculatedPrice * (pct / 100);
                } else {
                    amount = adj.value;
                }

                adjustmentTotal += amount;

                // Create basic adjustment snapshot (for backward compatibility)
                adjustmentSnapshots.push({
                    name: adj.name,
                    type: adj.type,
                    value: adj.value,
                    calculatedAmount: amount
                });

                // Create transaction-level adjustment snapshot with full tracking
                // Note: saleId will be populated when the transaction is processed
                const transactionSnapshot: TransactionAdjustmentSnapshot = {
                    id: generateAdjustmentId(),
                    saleId: '', // Will be populated during sale processing
                    itemId: item.id,
                    itemName: item.name,
                    variantId: variantId,
                    quantity: quantity,
                    baseCost: calculatedPrice,
                    unitAdjustmentAmount: amount,
                    totalAdjustmentAmount: roundToCurrency(amount * quantity),
                    adjustmentId: adj.id,
                    timestamp: new Date().toISOString(),
                    name: adj.name,
                    type: adj.type as 'PERCENTAGE' | 'FIXED' | 'PERCENT',
                    value: adj.value,
                    calculatedAmount: amount,
                    category: adj.adjustmentCategory || adj.category,
                    isActive: isActive
                };
                transactionAdjustmentSnapshots.push(transactionSnapshot);
            }
        });

        price = roundToCurrency(calculatedPrice + adjustmentTotal);

        return {
            price,
            basePrice: calculatedPrice,
            cost,
            consumption,
            breakdown,
            adjustmentTotal,
            adjustmentSnapshots,
            transactionAdjustmentSnapshots
        };
    },

    /**
     * Calculates dynamic service pricing using pages x copies as the pricing driver.
     * Supports BOM template formulas (preferred), pricingConfig fallback, and static fallback.
     */
    calculateDynamicServicePrice(
        item: Item,
        pages: number,
        copies: number,
        inventory: Item[],
        bomTemplates: BOMTemplate[],
        marketAdjustments: MarketAdjustment[],
        options?: { useStoredPriceAsFinal?: boolean }
    ): DynamicServicePricingResult {
        const safePages = Math.max(1, Math.floor(Number(pages) || Number(item.pages) || 1));
        const safeCopies = Math.max(1, Math.floor(Number(copies) || 1));
        const totalPages = safePages * safeCopies;
        const components: DynamicServiceComponentCost[] = [];

        // Service calculator pricing should honor material consumption granularity.
        // Paper, for example, is charged per sheet (after page->sheet conversion),
        // so we compute the actual run cost first, then derive per-page/per-copy rates.
        const templateId = item.smartPricing?.bomTemplateId || item.smartPricing?.hiddenBOMId;
        const template = templateId ? bomTemplates.find(t => t.id === templateId) : undefined;

        const evaluateTemplateCost = (
            evalPages: number,
            evalCopies: number,
            collectBreakdown: boolean
        ) => {
            const evalTotalPages = evalPages * evalCopies;
            const sheetsPerCopy = Math.ceil(evalPages / 2);
            const totalSheets = sheetsPerCopy * evalCopies;
            let total = 0;
            const breakdown: DynamicServiceComponentCost[] = [];

            template?.components?.forEach(comp => {
                const material = inventory.find(i => i.id === comp.itemId || i.name === comp.name);
                if (!material) return;

                const materialName = String(material.name || '').toLowerCase();
                const materialCategory = String(material.category || '').toLowerCase();
                const isPaper = materialName.includes('paper') || materialCategory.includes('paper');
                const mode = comp.consumptionMode || (comp.quantityFormula?.includes('pages') ? 'PAGE_BASED' : 'UNIT_BASED');
                let consumedQty = 0;

                if (comp.quantityFormula) {
                    const normalizedFormula = comp.quantityFormula.replace(/\s+/g, '').toLowerCase();
                    consumedQty = SafeFormulaEngine.evaluate(comp.quantityFormula, {
                        pages: evalPages,
                        pageCount: evalPages,
                        quantity: evalCopies,
                        copies: evalCopies,
                        totalPages: evalTotalPages,
                        total_pages: evalTotalPages,
                        sheetsPerCopy,
                        sheets_per_copy: sheetsPerCopy,
                        totalSheets,
                        total_sheets: totalSheets
                    } as any);

                    // Normalize legacy paper formulas that are page-driven to sheet-driven costing.
                    if (isPaper) {
                        const isSimplePageDrivenPaperFormula =
                            /^(pages|pagecount|totalpages|total_pages)$/.test(normalizedFormula) ||
                            /^(quantity|copies)\*(pages|pagecount|totalpages|total_pages)$/.test(normalizedFormula) ||
                            /^(pages|pagecount|totalpages|total_pages)\*(quantity|copies)$/.test(normalizedFormula) ||
                            /^(pages|pagecount|totalpages|total_pages)\/2$/.test(normalizedFormula) ||
                            /^(quantity|copies)\*(pages|pagecount|totalpages|total_pages)\/2$/.test(normalizedFormula) ||
                            /^(pages|pagecount|totalpages|total_pages)\*(quantity|copies)\/2$/.test(normalizedFormula) ||
                            /^(quantity|copies)\*(pages|pagecount|totalpages|total_pages)\*0?\.5$/.test(normalizedFormula) ||
                            /^(pages|pagecount|totalpages|total_pages)\*(quantity|copies)\*0?\.5$/.test(normalizedFormula);

                        if (isSimplePageDrivenPaperFormula) {
                            consumedQty = totalSheets;
                        }
                    }
                } else {
                    consumedQty = (isPaper && mode === 'PAGE_BASED')
                        ? totalSheets
                        : (mode === 'PAGE_BASED' ? evalTotalPages : evalCopies);
                }

                if (!isFinite(consumedQty) || consumedQty <= 0) return;

                if (material.conversionRate && material.conversionRate > 1) {
                    const formulaIncludesConversion = !!comp.quantityFormula && comp.quantityFormula.includes(String(material.conversionRate));
                    const shouldAutoConvert = (isPaper && !formulaIncludesConversion) || (!!comp.quantityFormula && !formulaIncludesConversion);
                    if (shouldAutoConvert) {
                        consumedQty = consumedQty / material.conversionRate;
                    }
                }

                const unitCost = Number(material.cost_price ?? material.cost) || 0;
                const lineCost = consumedQty * unitCost;
                total += lineCost;

                if (collectBreakdown) {
                    breakdown.push({
                        itemId: material.id,
                        name: material.name,
                        quantity: consumedQty,
                        unit: material.unit,
                        unitCost,
                        totalCost: lineCost,
                        usageType: mode === 'PAGE_BASED' ? 'per-page' : 'per-copy'
                    });
                }
            });

            return { total, breakdown };
        };

        let unitCostPerPage = 0;
        let resolvedTotalCost = 0;

        if (template?.components?.length) {
            const currentRun = evaluateTemplateCost(safePages, safeCopies, true);
            components.push(...currentRun.breakdown);
            resolvedTotalCost = roundToCurrency(currentRun.total || 0);
            if (totalPages > 0) {
                unitCostPerPage = roundToCurrency(resolvedTotalCost / totalPages);
            }
        } else if (item.pricingConfig && !item.pricingConfig.manualOverride) {
            const oneCopySpec = calculateItemFinancials(safePages, item.pricingConfig, inventory, []);
            if ((oneCopySpec?.cost || 0) > 0) {
                resolvedTotalCost = roundToCurrency((oneCopySpec!.cost || 0) * safeCopies);
                if (totalPages > 0) {
                    unitCostPerPage = roundToCurrency(resolvedTotalCost / totalPages);
                }
            }
        }

        if (unitCostPerPage <= 0) {
            const fallbackPerPageCost = Number(item.cost) || 0;
            unitCostPerPage = roundToCurrency(fallbackPerPageCost);
        }

        if (resolvedTotalCost <= 0) {
            resolvedTotalCost = roundToCurrency(unitCostPerPage * totalPages);
        }

        const unitCostPerCopy = safeCopies > 0
            ? roundToCurrency(resolvedTotalCost / safeCopies)
            : roundToCurrency(resolvedTotalCost);
        const totalCost = roundToCurrency(resolvedTotalCost);

        const adjustmentSnapshots: any[] = [];
        let unitAdjustmentPerPage = 0;

        marketAdjustments.forEach(adj => {
            const isActive = adj.active ?? adj.isActive;
            const categoryMatch = !adj.applyToCategories || adj.applyToCategories.length === 0 || adj.applyToCategories.includes(item.category);
            if (!isActive || !categoryMatch) return;

            const isPercent = adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' || adj.type === 'percentage';
            const pct = Number(adj.percentage ?? adj.value ?? 0);
            const adjPerPage = roundToCurrency(isPercent
                ? unitCostPerPage * (pct / 100)
                : (Number(adj.value) || 0));

            unitAdjustmentPerPage = roundToCurrency(unitAdjustmentPerPage + adjPerPage);

            // Keep snapshots per copy for downstream quantity aggregation compatibility.
            adjustmentSnapshots.push({
                name: adj.name,
                type: adj.type,
                value: adj.value,
                calculatedAmount: roundToCurrency(adjPerPage * safePages)
            });
        });

        let calculatedUnitPricePerPage = roundToCurrency(unitCostPerPage + unitAdjustmentPerPage);
        if (calculatedUnitPricePerPage <= 0 && (options?.useStoredPriceAsFinal ?? false)) {
            calculatedUnitPricePerPage = roundToCurrency(Number(item.calculated_price ?? item.price) || 0);
        }
        const totalAdjustment = roundToCurrency(unitAdjustmentPerPage * totalPages);
        const calculatedTotalPrice = roundToCurrency(calculatedUnitPricePerPage * totalPages);

        const roundedPricing = applyProductPriceRounding({
            calculatedPrice: calculatedTotalPrice,
            companyConfig: getCompanyConfig(),
            trackAnalytics: false
        });

        const totalPrice = roundedPricing.roundedPrice;
        const finalUnitPricePerCopy = safeCopies > 0 ? (totalPrice / safeCopies) : totalPrice;
        const finalUnitPricePerPage = safePages > 0 ? (finalUnitPricePerCopy / safePages) : finalUnitPricePerCopy;

        const serviceDetails: DynamicServiceDetails = {
            pages: safePages,
            copies: safeCopies,
            totalPages,
            unitCostPerPage: roundToCurrency(unitCostPerPage),
            unitPricePerPage: finalUnitPricePerPage,
            unitCostPerCopy,
            unitPricePerCopy: finalUnitPricePerCopy,
            totalCost,
            totalPrice,
            calculatedTotalPrice
        };

        return {
            pages: safePages,
            copies: safeCopies,
            totalPages,
            unitCostPerCopy,
            unitPricePerCopy: finalUnitPricePerCopy,
            unitCostPerPage: roundToCurrency(unitCostPerPage),
            unitPricePerPage: finalUnitPricePerPage,
            totalCost,
            totalPrice,
            calculatedTotalPrice,
            adjustmentTotal: totalAdjustment,
            adjustmentSnapshots,
            components,
            serviceDetails
        };
    },

    /**
     * Creates MarketAdjustmentTransaction records from transaction adjustment snapshots.
     * This should be called during sale processing to persist individual adjustment records.
     */
    createAdjustmentTransactions(
        snapshots: TransactionAdjustmentSnapshot[],
        saleId: string
    ): MarketAdjustmentTransaction[] {
        return snapshots.map(snap => ({
            id: `MAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            saleId: saleId,
            itemId: snap.itemId,
            variantId: snap.variantId,
            adjustmentId: snap.adjustmentId || '',
            adjustmentName: snap.name,
            adjustmentType: snap.type,
            adjustmentValue: snap.value,
            baseAmount: snap.baseCost,
            calculatedAmount: snap.totalAdjustmentAmount,
            quantity: snap.quantity,
            unitAmount: snap.unitAdjustmentAmount,
            timestamp: new Date().toISOString(),
            status: 'Active' as const,
            notes: `Applied to ${snap.itemName}${snap.variantId ? ' (variant: ' + snap.variantId + ')' : ''}`
        }));
    },

    /**
     * Generates an adjustment summary from transaction adjustment snapshots.
     * Groups adjustments by adjustment ID and calculates totals.
     */
    generateAdjustmentSummary(
        snapshots: TransactionAdjustmentSnapshot[]
    ): { adjustmentId: string; adjustmentName: string; totalAmount: number; itemCount: number; }[] {
        const summaryMap = new Map<string, { adjustmentId: string; adjustmentName: string; totalAmount: number; itemCount: number; }>();

        snapshots.forEach(snap => {
            const key = snap.adjustmentId || snap.name;
            const existing = summaryMap.get(key);
            if (existing) {
                existing.totalAmount += snap.totalAdjustmentAmount;
                existing.itemCount += 1;
            } else {
                summaryMap.set(key, {
                    adjustmentId: snap.adjustmentId || '',
                    adjustmentName: snap.name,
                    totalAmount: snap.totalAdjustmentAmount,
                    itemCount: 1
                });
            }
        });

        return Array.from(summaryMap.values()).map(s => ({
            ...s,
            totalAmount: roundToCurrency(s.totalAmount)
        }));
    },

    /**
     * Calculates variant price based on parent's Hidden BOM.
     * Replaces parent's default page count with variant's specific page count.
     * 
     * @param parentItem - The parent product item containing the Hidden BOM reference
     * @param variant - The variant with specific pages attribute
     * @param quantity - Quantity being priced
     * @param inventory - Full inventory list for material lookups
     * @param bomTemplates - BOM templates list
     * @param marketAdjustments - Active market adjustments
     * @returns PricingResult with calculated price, cost, and snapshots
     */
    calculateVariantPrice(
        parentItem: Item,
        variant: ProductVariant,
        quantity: number,
        inventory: Item[],
        bomTemplates: BOMTemplate[],
        marketAdjustments: MarketAdjustment[]
    ): PricingResult {
        // 1. Check if variant uses dynamic pricing
        if (variant.pricingSource === 'static') {
            return {
                price: variant.price,
                basePrice: variant.price,
                cost: variant.cost,
                consumption: null,
                breakdown: [],
                adjustmentTotal: 0,
                adjustmentSnapshots: variant.adjustmentSnapshots || [],
                transactionAdjustmentSnapshots: []
            };
        }

        // 2. Get the Hidden BOM from parent
        const hiddenBOMId = variant.bomOverrideId
            || parentItem.smartPricing?.hiddenBOMId
            || parentItem.smartPricing?.bomTemplateId;

        // 3. If no BOM configured, return variant's stored price
        if (!hiddenBOMId) {
            return {
                price: variant.price,
                basePrice: variant.price,
                cost: variant.cost,
                consumption: null,
                breakdown: [],
                adjustmentTotal: 0,
                adjustmentSnapshots: variant.adjustmentSnapshots || [],
                transactionAdjustmentSnapshots: []
            };
        }

        // 4. Create a virtual item with variant's pages for BOM calculation
        const virtualItem: Item = {
            ...parentItem,
            pages: variant.pages,  // KEY: Replace parent pages with variant pages
            price: 0,              // Force BOM calculation
            cost: 0,
            // Enable print consumption for BOM calculation
            smartPricing: {
                ...parentItem.smartPricing,
                bomTemplateId: hiddenBOMId
            }
        } as Item;

        // Mark for BOM processing
        (virtualItem as any).printConsumptionEnabled = true;

        // 5. Use existing pricing calculation with variant's pages
        const result = this.calculateItemPrice(
            virtualItem,
            quantity,
            undefined,         // variantId - we're using virtual item approach
            variant.pages,     // pagesOverride - variant's specific pages
            inventory,
            bomTemplates,
            marketAdjustments
        );

        // 6. Add calculation metadata
        return {
            ...result,
            consumption: result.consumption ? {
                ...result.consumption,
                variantId: variant.id
            } : null
        };
    },

    /**
     * Batch calculates prices for all variants of a parent product.
     * Useful for bulk recalculation when BOM or materials change.
     * 
     * @param parentItem - The parent product with variants
     * @param inventory - Full inventory list
     * @param bomTemplates - BOM templates list
     * @param marketAdjustments - Active market adjustments
     * @returns Map of variant ID to PricingResult
     */
    calculateAllVariantPrices(
        parentItem: Item,
        inventory: Item[],
        bomTemplates: BOMTemplate[],
        marketAdjustments: MarketAdjustment[]
    ): Map<string, PricingResult> {
        const results = new Map<string, PricingResult>();

        if (!parentItem.variants || parentItem.variants.length === 0) {
            return results;
        }

        for (const variant of parentItem.variants) {
            const result = this.calculateVariantPrice(
                parentItem,
                variant,
                1, // Unit quantity for per-item pricing
                inventory,
                bomTemplates,
                marketAdjustments
            );
            results.set(variant.id, result);
        }

        return results;
    },

    /**
     * Determines if a variant should use dynamic pricing.
     * Checks variant settings and parent configuration.
     */
    shouldUseDynamicPricing(variant: ProductVariant, parentItem: Item): boolean {
        // Explicit static pricing takes precedence
        if (variant.pricingSource === 'static') {
            return false;
        }

        // Check if variant is configured for dynamic pricing
        if (variant.pricingSource === 'dynamic' || variant.inheritsParentBOM) {
            return true;
        }

        // Check parent's variant pricing mode
        if (parentItem.smartPricing?.variantPricingMode === 'inherit') {
            return true;
        }

        // Default to static for backward compatibility
        return false;
    }
}
