
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, CheckCircle, Printer, Usb, Wallet, UserPlus, Save, ArrowRight, Calculator, DollarSign, Tag, ShieldCheck, Plus, Search, Building2, FileText, Clock } from 'lucide-react';
import { HeldOrder, Sale, Invoice, Item, ProductVariant, BillOfMaterial, WorkOrder, BOMTemplate } from '../../../types';
import { useData } from '../../../context/DataContext';
import { DEFAULT_ACCOUNTS } from '../../../constants';
import { hardwareService } from '../../../services/hardwareService';
import { generateAccountNumber, roundFinancial, formatNumber, roundToCurrency } from '../../../utils/helpers';
import { bomService } from '../../../services/bomService';
import { pricingService, DynamicServicePricingResult } from '../../../services/pricingService';
import { calculateItemFinancials } from '../../../utils/pricing';
import { getVariantPrice, getVariantCost } from '../../../utils/pricing';
import { dbService } from '../../../services/db';
import { applyProductPriceRounding } from '../../../services/pricingRoundingService';



// --- Printing Variant Modal ---
export const PrintingVariantModal: React.FC<{
    product: Item;
    bom?: BillOfMaterial;
    materials: Item[];
    onSelect: (variant: any) => void;
    onClose: () => void;
}> = ({ product, bom, materials, onSelect, onClose }) => {
    const { companyConfig, notify, inventory, marketAdjustments } = useData();
    const currency = companyConfig.currencySymbol;
    const [bomTemplates, setBomTemplates] = useState<BOMTemplate[]>([]);
    const [attributes, setAttributes] = useState<Record<string, any>>({
        number_of_pages: 1,
        paper_type: 'A4 80g',
        print_mode: 'B/W',
        binding_type: 'None'
    });
    const [pricingState, setPricingState] = useState({
        baseCost: product.cost,
        adjustmentTotal: 0,
        sellingPrice: product.price,
        adjustmentBreakdown: [] as any[],
        adjustmentSnapshots: [] as any[]
    });
    const [quantity, setQuantity] = useState(1);

    // Load BOM templates on mount
    useEffect(() => {
        let mounted = true;
        dbService.getAll<BOMTemplate>('bomTemplates')
            .then((templates) => {
                if (mounted) setBomTemplates(templates || []);
            })
            .catch((err) => {
                console.error('Failed to load BOM templates for variant pricing', err);
            });
        return () => { mounted = false; };
    }, []);

    // Memoize values to prevent infinite loops
    const materialsList = useMemo(() => inventory || materials, [inventory, materials]);
    const adjustmentsList = useMemo(() => marketAdjustments || [], [marketAdjustments]);

    useEffect(() => {
        // Check if parent has Hidden BOM for dynamic pricing
        const hasHiddenBOM = product.smartPricing?.hiddenBOMId || product.smartPricing?.bomTemplateId;

        if (hasHiddenBOM) {
            // Use dynamic variant pricing from pricingService
            const virtualVariant: ProductVariant = {
                id: 'virtual',
                sku: product.sku,
                name: product.name,
                attributes: attributes,
                pages: attributes.number_of_pages || 1,
                price: 0,
                cost: 0,
                stock: 0,
                pricingSource: 'dynamic',
                inheritsParentBOM: true
            };

            const result = pricingService.calculateVariantPrice(
                product,
                virtualVariant,
                quantity,
                materialsList,
                bomTemplates,
                adjustmentsList
            );

            setPricingState({
                baseCost: result.cost,
                adjustmentTotal: result.adjustmentTotal,
                sellingPrice: result.price,
                adjustmentBreakdown: result.breakdown,
                adjustmentSnapshots: result.adjustmentSnapshots
            });
        } else if (bom) {
            // Legacy BOM calculation
            const result = bomService.calculateVariantBOM(bom, { attributes } as any, materials);
            const cost = roundFinancial(result.totalProductionCost);

            let price = product.price;
            if (bom.priceFormula) {
                price = roundFinancial(bomService.resolveFormula(bom.priceFormula, attributes));
            }

            setPricingState({
                baseCost: cost,
                adjustmentTotal: 0,
                sellingPrice: roundToCurrency(cost),
                adjustmentBreakdown: [],
                adjustmentSnapshots: []
            });
        }
    }, [attributes, bom, materials, product, quantity, materialsList, adjustmentsList]);

    const handleAttributeChange = (key: string, value: any) => {
        setAttributes(prev => ({ ...prev, [key]: value }));
    };

    const handleConfirm = () => {
        const variantName = `${product.name} (${Object.entries(attributes).map(([k, v]) => `${k}: ${v}`).join(', ')})`;
        const virtualVariant = {
            ...product,
            id: `${product.id}-${Date.now()}`,
            parentId: product.id,
            name: variantName,
            attributes: attributes,
            quantity: quantity,
            price: pricingState.sellingPrice,
            cost: pricingState.baseCost,
            adjustmentTotal: pricingState.adjustmentTotal,
            adjustmentSnapshots: pricingState.adjustmentSnapshots,
            pagesOverride: attributes.number_of_pages // Pass through for transactionService
        };
        onSelect(virtualVariant);
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
            <div className="bg-white rounded shadow-2xl w-full max-w-lg overflow-hidden border border-[#d4d7dc]">
                <div className="px-6 py-4 border-b border-[#d4d7dc] flex justify-between items-center bg-[#f4f5f8]">
                    <h2 className="text-sm font-bold text-[#393a3d] uppercase tracking-wider">Configure {product.name}</h2>
                    <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]"><X size={20} /></button>
                </div>
                <div className="p-8 space-y-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider mb-1.5">Number of Pages</label>
                            <input
                                type="number"
                                className="w-full p-2 border border-[#babec5] rounded text-sm focus:border-[#0077c5] outline-none"
                                placeholder="e.g. 100"
                                onChange={e => handleAttributeChange('number_of_pages', parseInt(e.target.value))}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider mb-1.5">Paper Type</label>
                            <select
                                className="w-full p-2 border border-[#babec5] rounded text-sm focus:border-[#0077c5] outline-none"
                                onChange={e => handleAttributeChange('paper_type', e.target.value)}
                            >
                                <option value="">Select...</option>
                                <option value="A4 80g">A4 80g</option>
                                <option value="A4 100g">A4 100g</option>
                                <option value="A3 80g">A3 80g</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider mb-1.5">Quantity</label>
                            <input
                                type="number"
                                className="w-full p-2 border border-[#babec5] rounded text-sm font-bold focus:border-[#0077c5] outline-none"
                                value={quantity}
                                onChange={e => setQuantity(parseInt(e.target.value))}
                            />
                        </div>
                    </div>

                    <div className="bg-[#f4f5f8] p-6 rounded border border-[#d4d7dc] space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-bold text-[#6b6c7f] uppercase">Unit Price</span>
                            <span className="text-sm font-bold text-[#393a3d]">{currency}{pricingState.sellingPrice.toLocaleString()}</span>
                        </div>
                        <div className="pt-3 border-t border-[#d4d7dc] flex justify-between items-center">
                            <span className="text-xs font-bold text-[#393a3d] uppercase">Total Amount</span>
                            <span className="text-xl font-bold text-[#0077c5]">{currency}{(pricingState.sellingPrice * quantity).toLocaleString()}</span>
                        </div>
                    </div>

                    <button
                        onClick={handleConfirm}
                        className="w-full py-3.5 bg-[#2ca01c] text-white rounded-full font-bold text-sm hover:bg-[#248217] transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                        Add to Order <ArrowRight size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Dynamic Service Calculator Modal ---
export const ServiceCalculatorModal: React.FC<{
    service: Item;
    currencySymbol: string;
    calculatePricing: (pages: number, copies: number) => DynamicServicePricingResult;
    initialPages?: number;
    initialCopies?: number;
    onConfirm: (pricing: DynamicServicePricingResult) => void;
    onClose: () => void;
}> = ({ service, currencySymbol, calculatePricing, initialPages = 1, initialCopies = 1, onConfirm, onClose }) => {
    const { inventory = [], marketAdjustments = [], companyConfig } = useData();
    const [pages, setPages] = useState(Math.max(1, Number(initialPages) || 1));
    const [copies, setCopies] = useState(Math.max(1, Number(initialCopies) || 1));
    const [bomExpanded, setBomExpanded] = useState(false);
    const [finishingExpanded, setFinishingExpanded] = useState(false);
    const [adjustmentsExpanded, setAdjustmentsExpanded] = useState(false);
    const [finishingOptions, setFinishingOptions] = useState([
        {
            id: 'binding',
            type: 'Binding',
            name: 'Binding',
            quantity: 0,
            cost: 0,
            priceAdjustment: 0,
            materialConversionRate: 1,
            coversPerCopy: 0
        },
        {
            id: 'pinning',
            type: 'Stapling',
            name: 'Pinning/Stapling',
            quantity: 0,
            cost: 0,
            priceAdjustment: 0,
            materialConversionRate: 5000,
            coversPerCopy: 0
        },
        {
            id: 'covers',
            type: 'Covers',
            name: 'Covers',
            quantity: 0,
            cost: 0,
            priceAdjustment: 0,
            materialConversionRate: 100,
            coversPerCopy: 0
        }
    ]);

    useEffect(() => {
        setPages(Math.max(1, Number(initialPages) || 1));
        setCopies(Math.max(1, Number(initialCopies) || 1));
    }, [initialPages, initialCopies, service.id]);

    useEffect(() => {
        const binding = inventory.find(i => i.name?.toLowerCase().includes('binding'));
        const pinning = inventory.find(i => i.name?.toLowerCase().includes('staple') || i.name?.toLowerCase().includes('pin'));
        const covers = inventory.find(i => i.name?.toLowerCase().includes('cover') || i.name?.toLowerCase().includes('card'));

        setFinishingOptions(prev => prev.map(opt => {
            let materialCost = 0;
            let conversionRate = opt.materialConversionRate || 1;
            let materialId: string | undefined;

            if (opt.id === 'binding' && binding) {
                materialCost = Number((binding as any).cost_price ?? (binding as any).cost_per_unit ?? binding.cost ?? 0);
                conversionRate = Number((binding as any).conversionRate ?? (binding as any).conversion_rate ?? 1);
                materialId = binding.id;
            } else if (opt.id === 'pinning' && pinning) {
                materialCost = Number((pinning as any).cost_price ?? (pinning as any).cost_per_unit ?? pinning.cost ?? 0);
                conversionRate = Number((pinning as any).conversionRate ?? (pinning as any).conversion_rate ?? 5000);
                materialId = pinning.id;
            } else if (opt.id === 'covers' && covers) {
                materialCost = Number((covers as any).cost_price ?? (covers as any).cost_per_unit ?? covers.cost ?? 0);
                conversionRate = Number((covers as any).conversionRate ?? (covers as any).conversion_rate ?? 100);
                materialId = covers.id;
            }

            return {
                ...opt,
                cost: materialCost,
                materialConversionRate: conversionRate,
                materialId
            };
        }));
    }, [inventory]);

    const paper = useMemo(() => {
        return inventory.find(i =>
            i.type === 'Material' &&
            (i.name?.toLowerCase().includes('paper') || String(i.category || '').toLowerCase() === 'paper')
        );
    }, [inventory]);

    const toner = useMemo(() => {
        return inventory.find(i =>
            i.type === 'Material' &&
            (i.name?.toLowerCase().includes('toner') || String(i.category || '').toLowerCase() === 'toner')
        );
    }, [inventory]);

    const paperCost = useMemo(() => {
        if (!paper) return 0;
        const sheetsPerCopy = Math.ceil(pages / 2);
        const totalSheets = sheetsPerCopy * copies;
        const SHEETS_PER_REAM = 500;
        const paperCostBasis = Number((paper as any).cost_price ?? (paper as any).cost_per_unit ?? paper.cost ?? 0);
        const costPerSheet = paperCostBasis / SHEETS_PER_REAM;
        return roundToCurrency(totalSheets * costPerSheet);
    }, [paper, pages, copies]);

    const tonerCost = useMemo(() => {
        if (!toner) return 0;
        const capacity = 20000;
        const totalPages = pages * copies;
        const tonerCostBasis = Number((toner as any).cost_price ?? (toner as any).cost_per_unit ?? toner.cost ?? 0);
        const costPerPage = tonerCostBasis / capacity;
        return roundToCurrency(totalPages * costPerPage);
    }, [toner, pages, copies]);

    const finishingCost = useMemo(() => {
        const total = finishingOptions
            .filter(opt => opt.coversPerCopy > 0)
            .reduce((sum, opt) => {
                const totalUsage = copies * opt.coversPerCopy;
                const conversionRate = opt.materialConversionRate || 1;
                if (conversionRate <= 0) return sum;
                const materialUnitsNeeded = totalUsage / conversionRate;
                return sum + (materialUnitsNeeded * opt.cost);
            }, 0);
        return roundToCurrency(total);
    }, [finishingOptions, copies]);

    const baseCost = useMemo(() => {
        return roundToCurrency(paperCost + tonerCost + finishingCost);
    }, [paperCost, tonerCost, finishingCost]);

    const { adjustmentTotal, adjustmentSnapshots } = useMemo(() => {
        let total = 0;
        const snapshots: any[] = [];

        marketAdjustments.forEach(adj => {
            const isActive = adj.active ?? adj.isActive;
            const categoryMatch = !adj.applyToCategories || adj.applyToCategories.length === 0 || adj.applyToCategories.includes(service.category);
            if (!isActive || !categoryMatch) return;

            const isPercent = adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' || adj.type === 'percentage';
            const pct = Number(adj.percentage ?? adj.value ?? 0);
            const totalAmount = isPercent ? (baseCost * (pct / 100)) : (Number(adj.value) || 0) * pages * copies;
            total += totalAmount;

            const perCopy = copies > 0 ? (totalAmount / copies) : totalAmount;
            snapshots.push({
                name: adj.name,
                type: adj.type,
                value: adj.value,
                calculatedAmount: roundToCurrency(perCopy)
            });
        });

        return {
            adjustmentTotal: roundToCurrency(total),
            adjustmentSnapshots: snapshots
        };
    }, [marketAdjustments, baseCost, pages, copies, service.category]);

    const pricing = useMemo(() => {
        const totalPages = pages * copies;
        const totalPrice = roundToCurrency(baseCost + adjustmentTotal);
        // Apply rounding consistent with product inventory modal
        const rounding = applyProductPriceRounding({
            calculatedPrice: totalPrice,
            companyConfig
        });
        const roundedTotalPrice = rounding.roundedPrice;
        const roundingDiff = rounding.roundingDifference;

        // Track rounding as an adjustment row (per-copy for consistency with existing rows)
        const snapshotsExtended = [...adjustmentSnapshots];
        if (roundingDiff > 0) {
            const perCopyRound = copies > 0 ? roundToCurrency(roundingDiff / copies) : roundingDiff;
            snapshotsExtended.push({
                name: 'Rounding Adjustment',
                type: 'ROUNDING',
                value: rounding.stepUsed,
                calculatedAmount: perCopyRound
            });
        }
        const totalAdjustmentWithRounding = roundToCurrency(adjustmentTotal + roundingDiff);
        const unitCostPerCopy = copies > 0 ? roundToCurrency(baseCost / copies) : baseCost;
        const unitCostPerPage = totalPages > 0 ? roundToCurrency(baseCost / totalPages) : baseCost;
        const unitPricePerCopy = copies > 0 ? roundToCurrency(roundedTotalPrice / copies) : roundedTotalPrice;
        const unitPricePerPage = totalPages > 0 ? roundToCurrency(roundedTotalPrice / totalPages) : roundedTotalPrice;

        return {
            pages,
            copies,
            totalPages,
            unitCostPerCopy,
            unitCostPerPage,
            unitPricePerCopy,
            unitPricePerPage,
            totalPrice: roundedTotalPrice,
            calculatedTotalPrice: roundedTotalPrice,
            adjustmentTotal: totalAdjustmentWithRounding,
            adjustmentSnapshots: snapshotsExtended,
            rounding: {
                method: rounding.methodUsed,
                step: rounding.stepUsed,
                difference: roundingDiff,
                originalTotal: totalPrice,
                roundedTotal: roundedTotalPrice
            },
            serviceDetails: {
                pages,
                copies,
                totalPages,
                unitCostPerPage,
                unitPricePerPage,
                unitCostPerCopy,
                unitPricePerCopy,
                totalCost: baseCost,
                totalPrice: roundedTotalPrice,
                calculatedTotalPrice: roundedTotalPrice
            }
        };
    }, [pages, copies, baseCost, adjustmentTotal, adjustmentSnapshots, companyConfig]);

    const adjustmentRows = adjustmentSnapshots || [];
    const formatCurrency = (value: number) => `${currencySymbol}${formatNumber(value)}`;
    const bomTotal = roundToCurrency(paperCost + tonerCost);
    const toggleFinishingOption = (optionId: string) => {
        setFinishingOptions(prev => prev.map(opt =>
            opt.id === optionId
                ? { ...opt, coversPerCopy: opt.coversPerCopy > 0 ? 0 : 1 }
                : opt
        ));
    };
    const updateFinishingOption = (optionId: string, coversPerCopy: number) => {
        setFinishingOptions(prev => prev.map(opt =>
            opt.id === optionId
                ? { ...opt, coversPerCopy: Math.max(0, coversPerCopy) }
                : opt
        ));
    };
    const calculateMaterialUnits = (option: any) => {
        if (option.coversPerCopy === 0) return 0;
        const totalNeeded = copies * option.coversPerCopy;
        const conversionRate = option.materialConversionRate || 1;
        if (conversionRate <= 0) return 0;
        return totalNeeded / conversionRate;
    };
    const calculateFinishingOptionCost = (option: any) => {
        const materialUnitsNeeded = calculateMaterialUnits(option);
        return roundToCurrency(materialUnitsNeeded * option.cost);
    };

    return (
        <div className="absolute inset-0 z-[80] bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
            <div className="bg-white rounded shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden border border-[#d4d7dc]">
                <div className="px-6 py-4 border-b border-[#d4d7dc] flex justify-between items-center bg-[#f4f5f8]">
                    <div>
                        <h2 className="text-sm font-bold text-[#393a3d] uppercase tracking-wider">Service Calculator</h2>
                        <p className="text-[10px] text-[#6b6c7f] font-medium">{service.name}</p>
                    </div>
                    <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider mb-1.5">
                                Number of Pages
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={pages}
                                onChange={e => setPages(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                                className="w-full p-2.5 border border-[#babec5] rounded text-sm focus:border-[#0077c5] outline-none font-medium text-[#393a3d]"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider mb-1.5">
                                Quantity (Copies)
                            </label>
                            <input
                                type="number"
                                min={1}
                                value={copies}
                                onChange={e => setCopies(Math.max(1, parseInt(e.target.value || '1', 10) || 1))}
                                className="w-full p-2.5 border border-[#babec5] rounded text-sm focus:border-[#0077c5] outline-none font-medium text-[#393a3d]"
                            />
                        </div>
                    </div>

                    <div className="bg-[#f4f5f8] rounded border border-[#d4d7dc]">
                        <button
                            onClick={() => setBomExpanded(!bomExpanded)}
                            className="w-full px-4 py-3 flex justify-between items-center text-xs font-bold text-[#6b6c7f] uppercase tracking-wider"
                        >
                            <span>Bill of Materials (BOM)</span>
                            <span className="text-[10px] font-bold text-[#0077c5]">{bomExpanded ? 'Hide' : 'Show'}</span>
                        </button>
                        {bomExpanded && (
                            <div className="px-4 pb-4 space-y-3">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-[#6b6c7f]">Service Dimensions</span>
                                    <span className="font-bold text-[#393a3d]">{pricing.pages} pages x {pricing.copies} copies</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-[#6b6c7f]">Total Pages</span>
                                    <span className="font-bold text-[#393a3d]">{pricing.totalPages}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[#6b6c7f]">Paper Cost</span>
                                        <span className="text-[10px] text-[#8d9096]">({Math.ceil(pages / 2) * copies} sheets)</span>
                                    </div>
                                    <span className="font-bold text-[#393a3d]">{formatCurrency(paperCost)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[#6b6c7f]">Toner Cost</span>
                                        <span className="text-[10px] text-[#8d9096]">({pages * copies} pages)</span>
                                    </div>
                                    <span className="font-bold text-[#393a3d]">{formatCurrency(tonerCost)}</span>
                                </div>
                                <div className="pt-2 border-t border-[#d4d7dc] flex justify-between items-center text-xs">
                                    <span className="font-bold text-[#393a3d] uppercase">BOM Total</span>
                                    <span className="font-bold text-[#0077c5]">{formatCurrency(bomTotal)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-[#f4f5f8] rounded border border-[#d4d7dc]">
                        <button
                            onClick={() => setFinishingExpanded(!finishingExpanded)}
                            className="w-full px-4 py-3 flex justify-between items-center text-xs font-bold text-[#6b6c7f] uppercase tracking-wider"
                        >
                            <span>Finishing Options</span>
                            <span className="text-[10px] font-bold text-[#10b981]">{finishingExpanded ? 'Hide' : 'Show'}</span>
                        </button>
                        {finishingExpanded && (
                            <div className="px-4 pb-4 space-y-3">
                                {finishingOptions.map(option => {
                                    const materialUnitsNeeded = calculateMaterialUnits(option);
                                    const optionCost = calculateFinishingOptionCost(option);

                                    return (
                                        <div key={option.id} className="flex items-center justify-between py-1.5">
                                            <div className="flex items-center gap-3">
                                                <button
                                                    onClick={() => toggleFinishingOption(option.id)}
                                                    className={`w-10 h-6 rounded-full transition-colors relative ${option.coversPerCopy > 0 ? 'bg-[#0077c5]' : 'bg-[#d1d5db]'}`}
                                                >
                                                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${option.coversPerCopy > 0 ? 'left-5' : 'left-1'}`} />
                                                </button>
                                                <div>
                                                    <span className={`text-xs block ${option.coversPerCopy > 0 ? 'text-[#393a3d]' : 'text-[#8d9096]'}`}>
                                                        {option.name}
                                                    </span>
                                                    {option.coversPerCopy > 0 && (
                                                        <span className="text-[10px] text-[#8d9096]">
                                                            {option.coversPerCopy}/copy | {option.materialConversionRate} per unit
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {option.coversPerCopy > 0 && (
                                                    <div className="flex flex-col items-end">
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-[10px] text-[#8d9096]">covers/copy:</span>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                value={option.coversPerCopy}
                                                                onChange={(e) => updateFinishingOption(option.id, parseInt(e.target.value) || 0)}
                                                                className="w-14 h-7 px-1 text-right text-xs rounded border border-[#d4d7dc] focus:border-[#0077c5] outline-none"
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-[#8d9096]">
                                                            {copies * option.coversPerCopy} total → {formatNumber(materialUnitsNeeded)} unit(s)
                                                        </span>
                                                    </div>
                                                )}
                                                {option.coversPerCopy > 0 && (
                                                    <span className="text-xs font-bold text-[#393a3d] w-20 text-right">
                                                        {formatCurrency(optionCost)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                {finishingCost > 0 && (
                                    <div className="pt-2 border-t border-[#d4d7dc] flex justify-between items-center text-xs">
                                        <span className="font-bold text-[#393a3d] uppercase">Finishing Total</span>
                                        <span className="font-bold text-[#0077c5]">{formatCurrency(finishingCost)}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="bg-[#f4f5f8] rounded border border-[#d4d7dc]">
                        <button
                            onClick={() => setAdjustmentsExpanded(!adjustmentsExpanded)}
                            className="w-full px-4 py-3 flex justify-between items-center text-xs font-bold text-[#6b6c7f] uppercase tracking-wider"
                        >
                            <span>Market Adjustments</span>
                            <span className="text-[10px] font-bold text-[#f59e0b]">{adjustmentsExpanded ? 'Hide' : 'Show'}</span>
                        </button>
                        {adjustmentsExpanded && (
                            <div className="px-4 pb-4 space-y-2">
                                {adjustmentRows.length > 0 ? (
                                    adjustmentRows.map((adj, index) => {
                                        const totalAdj = (Number(adj.calculatedAmount) || 0) * pricing.copies;
                                        return (
                                            <div key={`${adj.name}-${index}`} className="flex justify-between items-center text-xs">
                                                <span className="text-[#6b6c7f]">{adj.name}</span>
                                                <span className="font-bold text-[#393a3d]">{formatCurrency(totalAdj)}</span>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-xs text-[#8d9096]">No market adjustments applied</div>
                                )}
                                <div className="pt-2 border-t border-[#d4d7dc] flex justify-between items-center text-xs">
                                    <span className="font-bold text-[#393a3d] uppercase">Adjustment Total</span>
                                    <span className="font-bold text-[#f59e0b]">{formatCurrency(pricing.adjustmentTotal)}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-[#f4f5f8] p-4 rounded border border-[#d4d7dc] space-y-2.5">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-[#6b6c7f]">Unit Cost / Copy</span>
                            <span className="font-bold text-[#393a3d]">{formatCurrency(pricing.unitCostPerCopy)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-[#6b6c7f]">Unit Price / Copy</span>
                            <span className="font-bold text-[#0077c5]">{formatCurrency(pricing.unitPricePerCopy)}</span>
                        </div>
                        {/* Hidden: Unit Price / Page */}
                        {/*
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-[#6b6c7f]">Unit Price / Page</span>
                            <span className="font-bold text-[#0077c5]">{formatCurrency(pricing.unitPricePerPage)}</span>
                        </div>
                        */}
                        <div className="pt-2 border-t border-[#d4d7dc] space-y-1.5">
                            {/* Hidden: Cost Price (CP) */}
                            {/*
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-[#6b6c7f]">Cost Price (CP)</span>
                                <span className="font-bold text-[#393a3d]">{formatCurrency(pricing.totalCost)}</span>
                            </div>
                            */}
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-[#393a3d] uppercase">Selling Price (SP)</span>
                                <span className="text-xl font-bold text-[#0077c5]">{formatCurrency(pricing.totalPrice)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 bg-white border border-[#babec5] text-[#393a3d] rounded-full font-bold text-sm hover:bg-[#f4f5f8]"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onConfirm({
                                ...pricing,
                                priceLocked: true,
                                lockedTotalPrice: pricing.totalPrice,
                                lockedUnitPricePerCopy: pricing.unitPricePerCopy,
                                lockedUnitCostPerCopy: pricing.unitCostPerCopy
                            })}
                            className="flex-1 py-3 bg-[#2ca01c] text-white rounded-full font-bold text-sm hover:bg-[#248217] shadow-sm flex items-center justify-center gap-2"
                        >
                            Confirm <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Customer Modal ---
export const CustomerModal: React.FC<{
    onSelect: (name: string) => void;
    onClose: () => void;
}> = ({ onSelect, onClose }) => {
    const { invoices, companyConfig, notify } = useData();
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [newCustomerName, setNewCustomerName] = useState('');
    const [newCustomerContact, setNewCustomerContact] = useState('');

    const customerNames = useMemo(() => {
        const names = new Set<string>();
        invoices?.forEach(inv => {
            if (inv.customerName) names.add(inv.customerName);
        });
        return Array.from(names).sort();
    }, [invoices]);

    const handleQuickAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCustomerName) return;

        onSelect(newCustomerName);
        notify(`Customer ${newCustomerName} selected`, 'success');
        onClose();
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
            <div className="bg-white rounded shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden border border-[#d4d7dc]">
                <div className="px-6 py-4 border-b border-[#d4d7dc] flex justify-between items-center bg-[#f4f5f8]">
                    <h2 className="text-sm font-bold text-[#393a3d] uppercase tracking-wider">Select Customer</h2>
                    <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]"><X size={20} /></button>
                </div>

                <div className="px-6 py-4 bg-white border-b border-[#d4d7dc] flex justify-between items-center shrink-0">
                    <p className="text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider">Accounts</p>
                    <button
                        onClick={() => setShowQuickAdd(!showQuickAdd)}
                        className={`flex items-center gap-2 px-6 py-2 rounded-full text-xs font-bold transition-all ${showQuickAdd ? 'bg-[#f4f5f8] text-[#393a3d] border border-[#babec5]' : 'bg-[#0077c5] text-white'}`}
                    >
                        {showQuickAdd ? <X size={14} /> : <UserPlus size={14} />}
                        {showQuickAdd ? 'Cancel' : 'New Customer'}
                    </button>
                </div>

                {showQuickAdd && (
                    <form onSubmit={handleQuickAdd} className="p-6 bg-[#f4f5f8] border-b border-[#d4d7dc] animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-[#6b6c7f] uppercase">Full Name *</label>
                                <input
                                    className="w-full p-2.5 border border-[#babec5] rounded text-sm focus:border-[#0077c5] outline-none bg-white"
                                    placeholder="Enter name"
                                    value={newCustomerName}
                                    onChange={e => setNewCustomerName(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-[#6b6c7f] uppercase">Contact info</label>
                                <input
                                    className="w-full p-2.5 border border-[#babec5] rounded text-sm focus:border-[#0077c5] outline-none bg-white"
                                    placeholder="Phone or email"
                                    value={newCustomerContact}
                                    onChange={e => setNewCustomerContact(e.target.value)}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={!newCustomerName}
                            className="px-8 py-2.5 bg-[#2ca01c] text-white rounded-full text-sm font-bold hover:bg-[#248217] disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                        >
                            <Save size={16} /> Save and Select
                        </button>
                    </form>
                )}

                <div className="p-2 overflow-y-auto flex-1 divide-y divide-[#f4f5f8] custom-scrollbar">
                    {customerNames.map(name => {
                        const custInvoices = invoices.filter(i => i.customerName === name && i.status !== 'Paid' && i.status !== 'Draft');
                        const custDebt = custInvoices.reduce((sum, i) => sum + (i.totalAmount - (i.paidAmount || 0)), 0);

                        return (
                            <button key={name} onClick={() => onSelect(name)} className="w-full text-left px-6 py-4 hover:bg-[#f4f5f8] flex justify-between items-center transition-all group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#eceef1] flex items-center justify-center text-[#393a3d] font-bold group-hover:bg-[#0077c5] group-hover:text-white transition-all">
                                        {name.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-[#393a3d] text-sm">{name}</div>
                                    </div>
                                </div>
                                {custDebt > 0 && (
                                    <div className="text-right">
                                        <div className="text-xs font-bold text-[#d52b1e]">{companyConfig.currencySymbol}{custDebt.toLocaleString()}</div>
                                        <div className="text-[10px] text-[#6b6c7f] font-medium uppercase">Outstanding</div>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- Held Orders Modal ---
export const HeldOrdersModal: React.FC<{
    orders: HeldOrder[];
    onRetrieve: (o: HeldOrder) => void;
    onClose: () => void;
}> = ({ orders, onRetrieve, onClose }) => (
    <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
        <div className="bg-white rounded shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-[#d4d7dc]">
            <div className="px-6 py-4 border-b border-[#d4d7dc] flex justify-between items-center bg-[#f4f5f8]">
                <h2 className="text-sm font-bold text-[#393a3d] uppercase tracking-wider">Parked Orders</h2>
                <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]"><X size={20} /></button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 divide-y divide-[#f4f5f8] custom-scrollbar">
                {orders.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-[#8d9096]">
                        <Clock size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">No parked orders found</p>
                    </div>
                )}
                {orders.map(order => (
                    <div key={order.id} className="px-6 py-5 flex justify-between items-center hover:bg-[#f4f5f8] transition-all group">
                        <div className="space-y-1">
                            <div className="font-bold text-[#393a3d]">{order.customerName}</div>
                            <div className="text-xs text-[#6b6c7f] flex items-center gap-3">
                                <span>{new Date(order.date).toLocaleString()}</span>
                                <span className="w-1 h-1 bg-[#d4d7dc] rounded-full"></span>
                                <span>{order.items.length} items</span>
                            </div>
                            {order.note && <div className="text-xs text-[#6b6c7f] italic">Note: {order.note}</div>}
                        </div>
                        <button onClick={() => onRetrieve(order)} className="bg-white border border-[#babec5] text-[#393a3d] px-6 py-2 rounded-full font-bold text-xs hover:bg-[#eceef1] hover:border-[#8d9096] transition-all">
                            Retrieve
                        </button>
                    </div>
                ))}
            </div>
        </div>
    </div>
);

// --- Returns Modal ---
export const ReturnsModal: React.FC<{
    sales: Sale[];
    onProcess: (saleId: string, items: any[], accountId: string) => void;
    onClose: () => void;
}> = ({ sales, onProcess, onClose }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
    const [returnItems, setReturnItems] = useState<{ itemId: string, qty: number }[]>([]);
    const [refundAccountId, setRefundAccountId] = useState('1000'); // Default to Cash Account

    const cashBankAccounts = useMemo(() =>
        DEFAULT_ACCOUNTS.filter(acc => ['1000', '1050', '1060'].includes(acc.id)),
        []);

    const handleSearch = () => {
        const sale = sales.find(s => s.id === searchTerm);
        if (sale) setSelectedSale(sale); else alert("Sale not found");
    };

    const toggleItem = (itemId: string, max: number) => {
        setReturnItems(prev => {
            if (prev.find(i => i.itemId === itemId)) return prev.filter(i => i.itemId !== itemId);
            return [...prev, { itemId, qty: max }];
        });
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
            <div className="bg-white rounded shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col border border-[#d4d7dc]">
                <div className="px-6 py-4 border-b border-[#d4d7dc] flex justify-between items-center bg-[#f4f5f8]">
                    <h2 className="text-sm font-bold text-[#393a3d] uppercase tracking-wider">Process Return</h2>
                    <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]"><X size={20} /></button>
                </div>
                <div className="p-6 bg-white border-b border-[#d4d7dc]">
                    <div className="flex gap-3 max-w-lg">
                        <input
                            type="text"
                            placeholder="Scan or enter Receipt ID..."
                            className="flex-1 p-2.5 border border-[#babec5] rounded text-sm focus:border-[#0077c5] outline-none"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        <button onClick={handleSearch} className="bg-[#0077c5] text-white px-6 rounded-full text-xs font-bold hover:bg-[#005da3]">Search</button>
                    </div>
                </div>
                <div className="p-2 overflow-y-auto flex-1 divide-y divide-[#f4f5f8] custom-scrollbar">
                    {selectedSale ? (
                        <div className="p-4 space-y-2">
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-[11px] font-bold text-[#6b6c7f] uppercase tracking-wider">Select items to refund</p>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">POS Sale</span>
                            </div>
                            {selectedSale.items.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-4 hover:bg-[#f4f5f8] rounded transition-all cursor-pointer group" onClick={() => toggleItem(item.id, item.quantity)}>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-5 h-5 border rounded flex items-center justify-center transition-all ${returnItems.some(r => r.itemId === item.id) ? 'bg-[#0077c5] border-[#0077c5] text-white' : 'border-[#babec5] bg-white group-hover:border-[#8d9096]'}`}>
                                            {returnItems.some(r => r.itemId === item.id) && <CheckCircle size={14} />}
                                        </div>
                                        <div>
                                            <div className="font-bold text-[#393a3d] text-sm">{item.name}</div>
                                            <div className="text-[11px] text-[#6b6c7f]">{item.quantity} units @ ${item.price}</div>
                                        </div>
                                    </div>
                                    <div className="font-bold text-[#393a3d]">${formatNumber(item.quantity * item.price)}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-[#8d9096]">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p className="text-sm font-medium">Search for a sale to begin refund</p>
                        </div>
                    )}
                </div>
                <div className="p-6 bg-[#f4f5f8] border-t border-[#d4d7dc] flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <label className="text-[10px] font-black text-[#6b6c7f] uppercase mb-1">Pay Refund From</label>
                            <select
                                value={refundAccountId}
                                onChange={(e) => setRefundAccountId(e.target.value)}
                                className="p-2 border border-[#babec5] rounded text-sm bg-white font-bold text-[#393a3d] focus:border-[#0077c5] outline-none min-w-[200px]"
                            >
                                {cashBankAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={() => selectedSale && onProcess(selectedSale.id, returnItems, refundAccountId)}
                        disabled={returnItems.length === 0}
                        className="bg-[#d52b1e] text-white px-10 py-3 rounded-full font-bold text-sm uppercase tracking-wider disabled:opacity-50 shadow-sm hover:bg-[#b9251a] transition-all"
                    >
                        Complete Refund
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Variant Selector Modal ---
export const VariantSelectorModal: React.FC<{
    product: Item;
    onSelect: (variant: ProductVariant) => void;
    onClose: () => void;
}> = ({ product, onSelect, onClose }) => {
    const { companyConfig } = useData();
    const currency = companyConfig.currencySymbol;
    const [quantity, setQuantity] = useState(1);

    // Check if this is a Stationery item - skip configure step for stationery
    const isStationery = product.type === 'Stationery';

    // For products with existing variants, we also skip the configure step
    // Users should set the correct pages/price when creating variants in inventory
    const shouldSkipConfigure = isStationery || (product.variants && product.variants.length > 0);

    const handleVariantClick = (v: ProductVariant) => {
        // Directly select the variant without configure step for stationery/products with variants
        onSelect({ ...v, quantity } as any);
    };

    return (
        <div className="absolute inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-[2px]">
            <div className="bg-white rounded shadow-2xl w-full max-w-lg max-h-[75vh] flex flex-col overflow-hidden border border-[#d4d7dc]">
                <div className="px-6 py-4 border-b border-[#d4d7dc] flex justify-between items-center bg-[#f4f5f8]">
                    <div>
                        <h2 className="text-sm font-bold text-[#393a3d] uppercase tracking-wider">
                            Select Variant
                        </h2>
                        <p className="text-[10px] text-[#6b6c7f] font-medium">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="text-[#8d9096] hover:text-[#d52b1e]"><X size={20} /></button>
                </div>

                {/* Quantity Selector */}
                <div className="px-6 py-3 bg-white border-b border-[#f4f5f8] flex items-center justify-between">
                    <label className="text-xs font-bold text-[#6b6c7f] uppercase tracking-wider">Quantity to Add</label>
                    <div className="w-32">
                        <input
                            type="number"
                            min="1"
                            className="w-full p-2 border border-[#babec5] rounded text-sm font-bold focus:border-[#0077c5] outline-none text-right"
                            value={quantity}
                            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                    </div>
                </div>

                <div className="p-2 overflow-y-auto flex-1 divide-y divide-[#f4f5f8] custom-scrollbar">
                    {product.variants?.map(v => (
                        <button
                            key={v.id}
                            onClick={() => handleVariantClick(v)}
                            className="w-full text-left px-6 py-4 hover:bg-[#f4f5f8] flex justify-between items-center transition-all group"
                        >
                            <div className="flex-1">
                                <div className="font-bold text-[#393a3d] text-sm">{v.name}</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {Object.entries(v.attributes || {}).map(([key, val]) => (
                                        <span key={key} className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#eceef1] text-[#6b6c7f] uppercase">
                                            {key.replace(/_/g, ' ')}: {val}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            <div className="text-right ml-4">
                                <div className="text-sm font-bold text-[#0077c5]">{currency}{formatNumber(v.price)}</div>
                                <div className={`text-[10px] font-medium ${v.stock <= 0 ? 'text-[#d52b1e]' : 'text-[#6b6c7f]'}`}>
                                    {v.stock} in stock
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
