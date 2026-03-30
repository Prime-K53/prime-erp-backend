
import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    AreaChart, Area, Cell, PieChart, Pie
} from 'recharts';
import {
    Activity, Filter, Printer, X,
    Users, BarChart3, Receipt, ShieldCheck
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useLocation } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { calculateMarginAnalysis, calculateAdjustmentStatistics } from '../services/reportService';
import SalesAudit from './reports/SalesAudit';
import RevenueDashboard from './reports/RevenueDashboard';
import ClientLedger from './reports/ClientLedger';
import InternalAuditor from './reports/InternalAuditor';
import RoundingAnalytics from './reports/RoundingAnalytics';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

type ReportCategory =
    | 'Overview'
    | 'Sales Audit'
    | 'Auditor'
    | 'Financials'
    | 'Client Ledger'
    | 'Margin Performance'
    | 'Rounding Analytics';

const Reports: React.FC = () => {
    const { sales = [], companyConfig, invoices = [], customers = [] } = useData();
    const location = useLocation();
    const currency = companyConfig?.currencySymbol || '$';

    const [activeCategory, setActiveCategory] = useState<ReportCategory>(() => {
        if (location.pathname.includes('sales-audit')) return 'Sales Audit';
        if (location.pathname.includes('margin-performance')) return 'Margin Performance';
        if (location.pathname.includes('rounding-analytics')) return 'Rounding Analytics';
        if (location.pathname.includes('financials')) return 'Financials';
        if (location.pathname.includes('contacts')) return 'Client Ledger';
        return 'Overview';
    });
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
    const [selectedSubAccountNames, setSelectedSubAccountNames] = useState<string[]>([]);
    const [isCustomerFilterOpen, setIsCustomerFilterOpen] = useState(false);
    const [selectedDateRange, setSelectedDateRange] = useState<'all' | 'week' | 'month' | 'quarter' | 'year'>('all');

    const formatCurrency = (val: number) => {
        if (val === undefined || val === null || isNaN(val)) return `${currency}0.00`;
        return `${currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    };

    const renderAuditor = () => <InternalAuditor />;


    const renderClientLedger = () => <ClientLedger />;

    const renderMarginPerformance = () => {
        // ✅ Include both sales and invoices in margin analysis
        // Convert invoices to sale-like format for margin analysis
        const invoicesAsSales = (invoices || []).map((inv: any) => ({
            ...inv,
            id: inv.id,
            date: inv.date,
            customerName: inv.customerName,
            totalAmount: inv.totalAmount,
            items: inv.items,
            adjustmentSnapshots: inv.adjustmentSnapshots || [],
            adjustmentTotal: inv.adjustmentTotal || 0,
            transactionAdjustments: inv.transactionAdjustments || [],
            adjustmentSummary: inv.adjustmentSummary || []
        }));
        
        const allTransactions = [...(sales || []), ...invoicesAsSales];
        const marginData = calculateMarginAnalysis(allTransactions);

        // Filter by date range
        const now = new Date();
        const filterByDate = (dateStr: string) => {
            if (selectedDateRange === 'all') return true;
            const date = new Date(dateStr);
            const diffDays = differenceInDays(now, date);
            switch (selectedDateRange) {
                case 'week': return diffDays <= 7;
                case 'month': return diffDays <= 30;
                case 'quarter': return diffDays <= 90;
                case 'year': return diffDays <= 365;
                default: return true;
            }
        };

        const filteredData = marginData.filter(d => {
            if (selectedCustomerId && d.customerName !== customers.find(c => c.id === selectedCustomerId)?.name) return false;
            if (!filterByDate(d.date)) return false;
            return true;
        });

        // Calculate adjustment statistics from all transactions
        const adjustmentStats = calculateAdjustmentStatistics(allTransactions);

        return (
            <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <p className="text-[12px] font-black text-slate-400 tracking-widest">Avg gross margin</p>
                        <h3 className="text-2xl font-black text-emerald-600 mt-1">
                            {(filteredData.reduce((sum, d) => sum + d.marginPercent, 0) / (filteredData.length || 1)).toFixed(1)}%
                        </h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <p className="text-[12px] font-black text-slate-400 tracking-widest">Total market adjustments</p>
                        <h3 className="text-2xl font-black text-blue-600 mt-1">
                            {formatCurrency(filteredData.reduce((sum, d) => sum + d.totalAdjustments, 0))}
                        </h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <p className="text-[12px] font-black text-slate-400 tracking-widest">Total gross profit</p>
                        <h3 className="text-2xl font-black text-slate-900 mt-1">
                            {formatCurrency(filteredData.reduce((sum, d) => sum + d.grossMargin, 0))}
                        </h3>
                    </div>
                </div>

                {/* Adjustment Statistics Section */}
                {adjustmentStats.length > 0 && (
                    <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm overflow-hidden">
                        <h3 className="font-black text-slate-800 text-[14px] tracking-widest mb-6">Adjustment Performance Summary</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="text-slate-400 font-black text-[10px] tracking-widest border-b border-slate-100">
                                        <th className="px-4 py-3">Adjustment Name</th>
                                        <th className="px-4 py-3 text-right">Total Amount</th>
                                        <th className="px-4 py-3 text-right">Transactions</th>
                                        <th className="px-4 py-3 text-right">Items Affected</th>
                                        <th className="px-4 py-3 text-right">Avg per Transaction</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {adjustmentStats.map((stat, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-4 font-bold text-slate-800">{stat.adjustmentName}</td>
                                            <td className="px-4 py-4 text-right font-mono text-blue-600 font-bold">{formatCurrency(stat.totalAmount)}</td>
                                            <td className="px-4 py-4 text-right font-mono text-slate-600">{stat.transactionCount}</td>
                                            <td className="px-4 py-4 text-right font-mono text-slate-600">{stat.itemCount}</td>
                                            <td className="px-4 py-4 text-right font-mono text-slate-500">{formatCurrency(stat.avgPerTransaction)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm overflow-hidden">
                    <h3 className="font-black text-slate-800 text-[14px] tracking-widest mb-6">Sales margin audit (Snapshot-based)</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-slate-400 font-black text-[10px] tracking-widest border-b border-slate-100">
                                    <th className="px-4 py-3">Sale ID / Date</th>
                                    <th className="px-4 py-3">Customer</th>
                                    <th className="px-4 py-3 text-right">Production cost</th>
                                    <th className="px-4 py-3 text-right">Cost (pre-wastage)</th>
                                    <th className="px-4 py-3 text-right">Cost (pre-transport)</th>
                                    <th className="px-4 py-3 text-right">Cost (pre-profit)</th>
                                    <th className="px-4 py-3 text-right">Net margin</th>
                                    <th className="px-4 py-3 text-right">Final price</th>
                                    <th className="px-4 py-3 text-right">Gross margin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredData.map(d => (
                                    <React.Fragment key={d.saleId}>
                                        <tr className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-4">
                                                <div className="font-bold text-slate-800">{d.saleId}</div>
                                                <div className="text-[11px] text-slate-400">{format(new Date(d.date), 'MMM dd, yyyy')}</div>
                                            </td>
                                            <td className="px-4 py-4 font-medium text-slate-600">{d.customerName}</td>
                                            <td className="px-4 py-4 text-right font-mono text-slate-500">{formatCurrency(d.totalCost)}</td>
                                            <td className="px-4 py-4 text-right font-mono text-slate-600">{formatCurrency(d.costBeforeWastage)}</td>
                                            <td className="px-4 py-4 text-right font-mono text-slate-600">{formatCurrency(d.costBeforeTransport)}</td>
                                            <td className="px-4 py-4 text-right font-mono text-slate-600">{formatCurrency(d.costBeforeProfit)}</td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="font-bold text-emerald-600">{formatCurrency(d.netMarginPerSale)}</div>
                                                <div className="text-[9px] text-slate-400 font-bold">Profit component</div>
                                            </td>
                                            <td className="px-4 py-4 text-right font-black text-slate-900">{formatCurrency(d.finalPrice)}</td>
                                            <td className="px-4 py-4 text-right">
                                                <div className="font-black text-slate-900">{formatCurrency(d.grossMargin)}</div>
                                                <div className="text-[10px] font-bold text-emerald-500">{d.marginPercent.toFixed(1)}%</div>
                                            </td>
                                        </tr>
                                        {/* Show adjustment breakdown if available */}
                                        {d.adjustmentBreakdown && d.adjustmentBreakdown.length > 0 && (
                                            <tr key={`${d.saleId}-breakdown`} className="bg-slate-50/50">
                                                <td colSpan={9} className="px-4 py-3">
                                                    <div className="text-[10px] font-bold text-slate-400 mb-2">ADJUSTMENT BREAKDOWN</div>
                                                    <div className="flex flex-wrap gap-3">
                                                        {d.adjustmentBreakdown.map((adj, idx) => (
                                                            <div key={idx} className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-[11px]">
                                                                <span className="font-bold text-slate-700">{adj.adjustmentName}:</span>{' '}
                                                                <span className="text-blue-600 font-mono">{formatCurrency(adj.totalAmount)}</span>
                                                                <span className="text-slate-400 ml-1">({adj.itemCount} items)</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    const renderOverview = () => <RevenueDashboard />;
    const renderRoundingAnalytics = () => <RoundingAnalytics />;

    const NAV_ITEMS = [
        { id: 'Overview', label: 'Dashboard', icon: Activity },
        { id: 'Sales Audit', label: 'Sales Audit', icon: Receipt },
        { id: 'Margin Performance', label: 'Margin Performance', icon: BarChart3 },
        { id: 'Rounding Analytics', label: 'Rounding Analytics', icon: BarChart3 },
        { id: 'Client Ledger', label: 'Client Ledger', icon: Users },
        { id: 'Auditor', label: 'Internal Auditor', icon: ShieldCheck },
    ];

    return (
        <div className="flex flex-col h-screen w-full bg-[#f8fafc] font-sans text-[13px] leading-[1.5] text-slate-700 overflow-hidden">
            <div className="bg-white border-b border-slate-200 shrink-0 px-6 py-4 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="font-bold text-2xl text-slate-900 tracking-tight">Business Intelligence</h2>
                        <p className="text-slate-500 text-sm font-medium">Financial insights and performance metrics</p>
                    </div>
                    <div className="flex gap-2">
                        {/* Date Range Filter - Only show for Margin Performance */}
                        {activeCategory === 'Margin Performance' && (
                            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                                {(['all', 'week', 'month', 'quarter', 'year'] as const).map(range => (
                                    <button
                                        key={range}
                                        onClick={() => setSelectedDateRange(range)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedDateRange === range
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                    >
                                        {range === 'all' ? 'All' : range.charAt(0).toUpperCase() + range.slice(1)}
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="relative mr-4">
                            <button
                                onClick={() => setIsCustomerFilterOpen(!isCustomerFilterOpen)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-semibold tracking-wide ${selectedCustomerId ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'}`}
                            >
                                <Filter size={16} />
                                {selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name : 'Filter by Customer'}
                                {selectedCustomerId && (
                                    <X
                                        size={16}
                                        className="ml-1 hover:text-rose-500 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedCustomerId('');
                                            setSelectedSubAccountNames([]);
                                        }}
                                    />
                                )}
                            </button>

                            {isCustomerFilterOpen && (
                                <div className="absolute top-full right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[12px] font-semibold text-slate-400 tracking-widest block">Select customer</label>
                                            <button onClick={() => setIsCustomerFilterOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                                        </div>
                                        <select
                                            value={selectedCustomerId}
                                            onChange={(e) => {
                                                setSelectedCustomerId(e.target.value);
                                                setSelectedSubAccountNames([]);
                                            }}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] font-medium outline-none focus:border-blue-500 transition-colors"
                                        >
                                            <option value="">All customers</option>
                                            {customers.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>

                                        {selectedCustomerId && (
                                            <div className="pt-2 border-t border-slate-100">
                                                <label className="text-[12px] font-semibold text-slate-400 tracking-widest mb-2 block">Filter sub-accounts</label>
                                                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                                                    {['Main', ...(customers.find(c => c.id === selectedCustomerId)?.subAccounts?.map(s => s.name) || [])].map(sub => (
                                                        <label key={sub} className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors group">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedSubAccountNames.includes(sub)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setSelectedSubAccountNames([...selectedSubAccountNames, sub]);
                                                                    } else {
                                                                        setSelectedSubAccountNames(selectedSubAccountNames.filter(s => s !== sub));
                                                                    }
                                                                }}
                                                                className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                            />
                                                            <span className="text-[13px] font-medium text-slate-600 group-hover:text-blue-600 transition-colors">{sub}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-2 font-medium">Leave unchecked to see all sub-accounts</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex bg-white rounded-xl border border-slate-200 p-1 shadow-sm">
                            <button
                                onClick={() => window.print()}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Print report"
                            >
                                <Printer size={20} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Top Navigation Tabs */}
                <div className="flex gap-2">
                    <div className="flex p-1 bg-slate-100/80 rounded-xl overflow-hidden self-start">
                        {NAV_ITEMS.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveCategory(item.id as any)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeCategory === item.id
                                    ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5 scale-[1.02]'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                    }`}
                            >
                                <item.icon size={16} className={activeCategory === item.id ? 'stroke-[2.5px]' : ''} />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div id="report-content" className="flex-1 min-h-0 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50">
                <div className="max-w-[1600px] mx-auto">
                    {activeCategory === 'Overview' && renderOverview()}
                    {activeCategory === 'Sales Audit' && <SalesAudit />}
                    {activeCategory === 'Margin Performance' && renderMarginPerformance()}
                    {activeCategory === 'Rounding Analytics' && renderRoundingAnalytics()}
                    {activeCategory === 'Client Ledger' && renderClientLedger()}
                    {activeCategory === 'Auditor' && renderAuditor()}
                </div>
            </div>
        </div>
    );
};

export default Reports;
