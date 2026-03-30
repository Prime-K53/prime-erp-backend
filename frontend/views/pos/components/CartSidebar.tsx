
import React, { useMemo, useState, useEffect } from 'react';
import { ShoppingCart, Trash2, User, Plus, Minus, ShoppingBag, PauseCircle, Undo2, ArrowRight, UserPlus, CreditCard, Clock, ChevronRight, Tag, School, Building2, AlertTriangle, X, TrendingUp, Truck, Scale } from 'lucide-react';
import { CartItem } from '../../../types';
import { useData } from '../../../context/DataContext';

import { formatNumber } from '../../../utils/helpers';

interface CartSidebarProps {
    cart: CartItem[];
    selectedCustomerName: string | null;
    selectedSubAccount: string;
    setSelectedSubAccount: (val: string) => void;
    onSelectCustomer: () => void;
    updateQuantity: (id: string, delta: number, isAbsolute?: boolean) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    onPark: () => void;
    onReturn: () => void;
    onPay: () => void;
    totals: { subtotal: number, discount: number, total: number };
    /** Adjustment summary for display in totals section */
    adjustmentSummary?: { adjustmentId: string; adjustmentName: string; totalAmount: number; itemCount: number; }[];
    rounding?: {
        enabled: boolean;
        applyRounding: boolean;
        calculatedPrice: number;
        roundedPrice: number;
        difference: number;
        method: string;
        methodLabel?: string;
        methodOptions?: { value: string; label: string }[];
        showOriginalPrice?: boolean;
        manualOverrideAllowed?: boolean;
        onToggle?: (value: boolean) => void;
        onMethodChange?: (value: string) => void;
    };
}

export const CartSidebar: React.FC<CartSidebarProps> = ({
    cart, selectedCustomerName, selectedSubAccount, setSelectedSubAccount, onSelectCustomer, updateQuantity, removeFromCart, clearCart, onPark, onReturn, onPay, totals, adjustmentSummary, rounding
}) => {
    const { companyConfig, invoices } = useData();
    const currency = companyConfig.currencySymbol;

    const grandTotal = totals.total;
    const hasAdjustments = adjustmentSummary && adjustmentSummary.length > 0;
    const totalAdjustments = hasAdjustments ? adjustmentSummary.reduce((sum, adj) => sum + adj.totalAmount, 0) : 0;

    const customerOutstanding = useMemo(() => {
        if (!selectedCustomerName) return 0;
        return (invoices || [])
            .filter((i: any) => i.customerName === selectedCustomerName && i.status !== 'Paid' && i.status !== 'Draft' && i.status !== 'Cancelled')
            .reduce((acc: number, inv: any) => acc + ((inv.totalAmount || 0) - (inv.paidAmount || 0)), 0);
    }, [selectedCustomerName, invoices]);

    return (
        <div className="flex flex-col h-full bg-white overflow-hidden border-l border-slate-200 rounded-xl">
            {/* Checkout Header */}
            <div className="px-6 py-3 flex justify-between items-center bg-white border-b border-slate-200 shrink-0 rounded-t-xl">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-slate-100 rounded text-slate-800">
                        <ShoppingCart size={16} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-slate-800">Current Order</h3>
                        <p className="text-[10px] text-slate-500 font-medium">{cart.reduce((s, i) => s + i.quantity, 0)} items</p>
                    </div>
                </div>
                <button
                    onClick={clearCart}
                    disabled={cart.length === 0}
                    className="text-red-600 hover:underline text-[10px] font-semibold disabled:opacity-0"
                >
                    Clear all
                </button>
            </div>

            {/* Customer Selector */}
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 shrink-0">
                <button
                    onClick={onSelectCustomer}
                    className={`w-full flex justify-between items-center p-1.5 rounded-xl border transition-all bg-white
                    ${selectedCustomerName
                            ? 'border-blue-600'
                            : 'border-slate-200 hover:border-slate-400'}`}
                >
                    <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center
                          ${selectedCustomerName ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {selectedCustomerName ? <User size={12} /> : <UserPlus size={12} />}
                        </div>
                        <div className="text-left">
                            <div className="text-[10px] font-semibold text-slate-800">
                                {selectedCustomerName ? selectedCustomerName : 'Add Customer'}
                            </div>
                            {selectedCustomerName && (
                                <div className="text-[8px] text-slate-500 font-medium">
                                    Bal: {currency}{customerOutstanding.toLocaleString()}
                                </div>
                            )}
                        </div>
                    </div>
                    <ChevronRight size={10} className="text-slate-400" />
                </button>
            </div>

            {/* Cart Item List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10 text-center">
                        <ShoppingBag size={48} className="mb-4 opacity-20" />
                        <p className="text-sm font-medium">Your cart is empty</p>
                        <p className="text-xs mt-1">Add items from the product grid to start an order.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {cart.map(item => (
                            <CartItemRow
                                key={item.id}
                                item={item}
                                updateQuantity={updateQuantity}
                                removeFromCart={removeFromCart}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Checkout Totals Summary */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-3 shrink-0 rounded-b-xl">
                {/* Adjustment Breakdown */}
                {hasAdjustments && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-50">
                        {adjustmentSummary.map((adj, idx) => {
                            const n = adj.adjustmentName.toLowerCase();
                            let Icon = Tag;
                            let colorClass = "text-indigo-500";
                            let textClass = "text-indigo-600";

                            if (n.includes('profit') || n.includes('margin')) {
                                Icon = TrendingUp;
                                colorClass = "text-emerald-500";
                                textClass = "text-emerald-600";
                            } else if (n.includes('transport') || n.includes('logistics') || n.includes('delivery')) {
                                Icon = Truck;
                                colorClass = "text-blue-500";
                                textClass = "text-blue-600";
                            } else if (n.includes('wastage') || n.includes('shrinkage')) {
                                Icon = Scale;
                                colorClass = "text-amber-500";
                                textClass = "text-amber-600";
                            }

                            return (
                                <div key={idx} className="flex justify-between items-center">
                                    <span className="text-slate-400 text-[11px] font-normal tracking-tight flex items-center gap-1.5">
                                        <Icon size={10} className={colorClass} /> • {adj.adjustmentName}
                                    </span>
                                    <span className={`${textClass} font-mono text-[11px] font-medium`}>+{currency}{formatNumber(adj.totalAmount)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}

                {rounding?.enabled && (
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 font-semibold">Apply Rounding</span>
                            <label className="inline-flex items-center gap-2 text-[10px] text-slate-500">
                                <input
                                    type="checkbox"
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    checked={rounding.applyRounding}
                                    disabled={!rounding.manualOverrideAllowed}
                                    onChange={e => rounding.onToggle?.(e.target.checked)}
                                />
                                {rounding.manualOverrideAllowed ? 'Enabled' : 'Locked'}
                            </label>
                        </div>

                        {rounding.manualOverrideAllowed && rounding.methodOptions && (
                            <div>
                                <label className="text-[11px] text-slate-500 font-medium">Rounding Method</label>
                                <select
                                    className="w-full mt-1 p-1.5 border border-slate-200 rounded-lg bg-white text-[11px] font-semibold text-slate-700"
                                    value={rounding.method}
                                    onChange={e => rounding.onMethodChange?.(e.target.value)}
                                >
                                    {rounding.methodOptions.map(option => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {rounding.showOriginalPrice !== false && (
                            <div className="flex justify-between items-center text-[11px]">
                                <span className="text-slate-400">Calculated Price</span>
                                <span className="font-mono text-slate-700">{currency}{formatNumber(rounding.calculatedPrice)}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">Rounded Price</span>
                            <span className="font-mono text-blue-700">{currency}{formatNumber(rounding.roundedPrice)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400">Difference</span>
                            <span className={`font-mono ${rounding.difference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {rounding.difference >= 0 ? '+' : ''}{currency}{formatNumber(rounding.difference)}
                            </span>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-800">Total</span>
                    <span className="text-xl font-bold text-slate-800">{currency}{formatNumber(grandTotal)}</span>
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        onClick={onPay}
                        disabled={cart.length === 0}
                        className="w-full py-2.5 rounded-full bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:bg-slate-300 flex items-center justify-center gap-2 shadow-sm"
                    >
                        <span>Receive Payment</span> <ArrowRight size={16} />
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                        <button onClick={onPark} disabled={cart.length === 0} className="flex items-center justify-center gap-2 py-2 rounded-full border border-slate-200 bg-white text-slate-800 font-bold text-xs hover:bg-slate-50 disabled:opacity-50 transition-all">
                            <Clock size={12} /> Hold
                        </button>
                        {companyConfig.transactionSettings?.pos?.allowReturns !== false && (
                            <button onClick={onReturn} className="flex items-center justify-center gap-2 py-2 rounded-full border border-slate-200 bg-white text-slate-800 font-bold text-xs hover:bg-slate-50 transition-all">
                                <Undo2 size={12} /> Refund
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

const CartItemRow: React.FC<{ item: CartItem, updateQuantity: (id: string, delta: number, isAbsolute?: boolean) => void, removeFromCart: (id: string) => void }> = ({ item, updateQuantity, removeFromCart }) => {
    const { companyConfig } = useData();
    const currency = companyConfig.currencySymbol;
    const [localQty, setLocalQty] = useState(item.quantity.toString());
    const serviceDetails = (item as any).serviceDetails;

    useEffect(() => {
        setLocalQty(item.quantity.toString());
    }, [item.quantity]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const val = parseInt(localQty);
            if (!isNaN(val) && val >= 1) {
                updateQuantity(item.id, val, true);
            } else {
                setLocalQty(item.quantity.toString());
            }
        }
    };

    const handleBlur = () => {
        const val = parseInt(localQty);
        if (!isNaN(val) && val >= 1) {
            updateQuantity(item.id, val, true);
        } else {
            setLocalQty(item.quantity.toString());
        }
    };

    return (
        <div className="p-4 bg-slate-50 hover:bg-blue-50/30 transition-all group relative rounded-xl">
            <div className="flex justify-between items-start mb-2">
                <div className="flex-1 min-w-0 pr-8">
                    <h4 className="font-semibold text-slate-800 text-xs leading-tight mb-1">{item.name}</h4>
                    {serviceDetails && (
                        <div className="text-[10px] text-slate-500 leading-snug mb-1.5">
                            <div>{serviceDetails.pages} pages x {serviceDetails.copies} copies</div>
                        </div>
                    )}
                    {item.attributes && Object.keys(item.attributes).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(item.attributes).map(([key, value]) => (
                                <span key={key} className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {key.replace(/_/g, ' ')}: {value}
                                </span>
                            ))}
                        </div>
                    )}

                </div>
                <button onClick={() => removeFromCart(item.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1">
                    <X size={14} />
                </button>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                        <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-50 border-r border-slate-200"><Minus size={10} /></button>
                        <input
                            type="number"
                            className="w-10 text-xs font-bold text-slate-800 text-center focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={localQty}
                            onChange={(e) => setLocalQty(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={handleBlur}
                        />
                        <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-50 border-l border-slate-200"><Plus size={10} /></button>
                    </div>
                    <span className="text-[11px] text-slate-500">
                        {serviceDetails
                            ? `${serviceDetails.pages} pages x ${serviceDetails.copies} copies`
                            : `@ ${currency}${formatNumber(item.price)}`}
                    </span>
                </div>
                <div className="font-bold text-slate-800 text-sm">{currency}{formatNumber(item.price * item.quantity)}</div>
            </div>
        </div>
    );
};
