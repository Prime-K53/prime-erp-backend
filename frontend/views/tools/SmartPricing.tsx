import React, { useState, useEffect } from 'react';
import { Calculator, TrendingUp, DollarSign, Percent, RefreshCw, Save, Plus, Trash2 } from 'lucide-react';
import { dbService } from '../../services/db';
import { MarketAdjustment, SmartPricingConfig, BOMTemplate } from '../../types';
import { useData } from '../../context/DataContext';

const SmartPricing: React.FC = () => {
    const { notify } = useData();
    const [adjustments, setAdjustments] = useState<MarketAdjustment[]>([]);
    const [bomTemplates, setBomTemplates] = useState<BOMTemplate[]>([]);
    const [config, setConfig] = useState<SmartPricingConfig>({
        pricingModel: 'cost-plus',
        baseMargin: 25,
        isOnlineMode: false,
        vatEnabled: true,
        vatPercentage: 16.5,
        vatPricingMode: 'exclusive',
        pricingPriority: 'market-adjustments'
    });
    const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null);
    const [baseCost, setBaseCost] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [adjustmentsData, templatesData, configData] = await Promise.all([
                dbService.getAll<MarketAdjustment>('marketAdjustments'),
                dbService.getAll<BOMTemplate>('bomTemplates'),
                dbService.getSetting<SmartPricingConfig>('smartPricingConfig')
            ]);

            setAdjustments(adjustmentsData.filter(a => a.active || a.isActive));
            setBomTemplates(templatesData);
            if (configData) {
                setConfig(configData);
            }
        } catch (error) {
            console.error('Error loading smart pricing data:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculatePrice = () => {
        let cost = baseCost;

        // Apply market adjustments
        if (config.marketAdjustmentId) {
            const adjustment = adjustments.find(a => a.id === config.marketAdjustmentId);
            if (adjustment) {
                if (adjustment.type === 'PERCENTAGE' || adjustment.type === 'PERCENT' || adjustment.type === 'percentage') {
                    cost = cost * (1 + (adjustment.value || adjustment.percentage || 0) / 100);
                } else {
                    cost = cost + adjustment.value;
                }
            }
        }

        // Apply base margin
        const marginMultiplier = 1 + config.baseMargin / 100;
        let price = cost * marginMultiplier;

        // Apply VAT if enabled and exclusive
        if (config.vatEnabled && config.vatPricingMode === 'exclusive' && config.vatPercentage) {
            price = price * (1 + config.vatPercentage / 100);
        }

        setCalculatedPrice(price);
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            await dbService.saveSetting('smartPricingConfig', config);
            notify('Smart pricing configuration saved', 'success');
        } catch (error) {
            console.error('Error saving config:', error);
            notify('Failed to save configuration', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-auto bg-gradient-to-br from-slate-50 to-indigo-50/30 p-6">
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 rounded-xl">
                        <Calculator className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Smart Pricing Engine</h1>
                        <p className="text-slate-500">Configure pricing models and market adjustments</p>
                    </div>
                </div>

                {/* Pricing Model Selection */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Pricing Model</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { value: 'per-page', label: 'Per Page' },
                            { value: 'per-learner', label: 'Per Learner' },
                            { value: 'per-book', label: 'Per Book' },
                            { value: 'cost-plus', label: 'Cost Plus' }
                        ].map(model => (
                            <button
                                key={model.value}
                                onClick={() => setConfig({ ...config, pricingModel: model.value as any })}
                                className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${config.pricingModel === model.value
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                            >
                                {model.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Base Margin */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Base Margin</h2>
                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={config.baseMargin}
                            onChange={(e) => setConfig({ ...config, baseMargin: Number(e.target.value) })}
                            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-lg">
                            <Percent className="w-4 h-4 text-slate-500" />
                            <span className="text-lg font-bold text-slate-700">{config.baseMargin}%</span>
                        </div>
                    </div>
                </div>

                {/* Market Adjustment Selection */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Market Adjustment</h2>
                    {adjustments.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No active market adjustments found.</p>
                            <p className="text-sm">Create adjustments in the Market Adjustments module.</p>
                        </div>
                    ) : (
                        <select
                            value={config.marketAdjustmentId || ''}
                            onChange={(e) => setConfig({ ...config, marketAdjustmentId: e.target.value || undefined })}
                            className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">No adjustment</option>
                            {adjustments.map(adj => (
                                <option key={adj.id} value={adj.id}>
                                    {adj.name} ({adj.type === 'PERCENTAGE' || adj.type === 'PERCENT' || adj.type === 'percentage' ? `${adj.value || adj.percentage}%` : `$${adj.value}`})
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* VAT Settings */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">VAT Settings</h2>
                    <div className="space-y-4">
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={config.vatEnabled}
                                onChange={(e) => setConfig({ ...config, vatEnabled: e.target.checked })}
                                className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-slate-700">Enable VAT</span>
                        </label>

                        {config.vatEnabled && (
                            <>
                                <div className="flex items-center gap-4">
                                    <label className="text-sm text-slate-600 w-24">VAT Rate:</label>
                                    <input
                                        type="number"
                                        value={config.vatPercentage || 16.5}
                                        onChange={(e) => setConfig({ ...config, vatPercentage: Number(e.target.value) })}
                                        className="w-24 p-2 border border-slate-200 rounded-lg"
                                    />
                                    <span className="text-slate-500">%</span>
                                </div>

                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="vatMode"
                                            checked={config.vatPricingMode === 'inclusive'}
                                            onChange={() => setConfig({ ...config, vatPricingMode: 'inclusive' })}
                                            className="w-4 h-4 text-indigo-600"
                                        />
                                        <span className="text-slate-700">Inclusive</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="radio"
                                            name="vatMode"
                                            checked={config.vatPricingMode === 'exclusive'}
                                            onChange={() => setConfig({ ...config, vatPricingMode: 'exclusive' })}
                                            className="w-4 h-4 text-indigo-600"
                                        />
                                        <span className="text-slate-700">Exclusive</span>
                                    </label>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Price Calculator */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Price Calculator</h2>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <label className="text-sm text-slate-600 w-32">Base Cost:</label>
                            <div className="flex items-center gap-2 flex-1">
                                <DollarSign className="w-4 h-4 text-slate-400" />
                                <input
                                    type="number"
                                    value={baseCost}
                                    onChange={(e) => setBaseCost(Number(e.target.value))}
                                    className="flex-1 p-2 border border-slate-200 rounded-lg"
                                    placeholder="Enter base cost"
                                />
                            </div>
                        </div>

                        <button
                            onClick={calculatePrice}
                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Calculate Price
                        </button>

                        {calculatedPrice !== null && (
                            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="text-sm text-green-600 mb-1">Calculated Price</div>
                                <div className="text-3xl font-bold text-green-700">
                                    ${calculatedPrice.toFixed(2)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Button */}
                <button
                    onClick={saveConfig}
                    disabled={saving}
                    className="w-full py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <Save className="w-4 h-4" />
                    {saving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>
        </div>
    );
};

export default SmartPricing;
