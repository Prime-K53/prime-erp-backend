import React, { useMemo, useState } from 'react';
import { useData } from '../../context/DataContext';
import { format, parseISO, startOfWeek, startOfMonth, isWithinInterval, subDays, isSameDay } from 'date-fns';
import {
    DollarSign, TrendingUp, TrendingDown, CreditCard, Wallet, Users,
    ShoppingCart, Building2, ArrowUpRight, ArrowDownRight, Activity,
    BarChart3, PieChart, Calendar, RefreshCw
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

type DateRange = 'week' | 'month' | 'quarter' | 'year' | 'all';

const RevenueDashboard: React.FC = () => {
    const { 
        sales = [], invoices = [], expenses = [], purchases = [], 
        customers = [], customerPayments = [], accounts = [], ledger = [],
        companyConfig 
    } = useData();
    const currency = companyConfig?.currencySymbol || '$';
    const [dateRange, setDateRange] = useState<DateRange>('month');

    const formatCurrency = (val: number) => {
        if (val === undefined || val === null || isNaN(val)) return `${currency}0.00`;
        return `${currency}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const filterByDateRange = (dateStr: string): boolean => {
        if (dateRange === 'all') return true;
        const date = parseISO(dateStr);
        const now = new Date();

        switch (dateRange) {
            case 'week':
                return isWithinInterval(date, { start: startOfWeek(now, { weekStartsOn: 1 }), end: now });
            case 'month':
                return isWithinInterval(date, { start: startOfMonth(now), end: now });
            case 'quarter': {
                const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
                return isWithinInterval(date, { start: quarterStart, end: now });
            }
            case 'year':
                return date.getFullYear() === now.getFullYear();
            default:
                return true;
        }
    };

    const stats = useMemo(() => {
        // Filter data by date range
        const filteredSales = sales.filter((s: any) => filterByDateRange(s.date));
        const filteredInvoices = invoices.filter((i: any) => filterByDateRange(i.date));
        const filteredExpenses = expenses.filter((e: any) => filterByDateRange(e.date));
        const filteredPurchases = purchases.filter((p: any) => filterByDateRange(p.date));
        const filteredPayments = customerPayments.filter((p: any) => filterByDateRange(p.date));
        const gl = companyConfig?.glMapping || {};
        const cogsAccount = gl.defaultCOGSAccount || '5000';

        // Total Revenue (Sales + Invoices)
        const totalRevenue = filteredSales.reduce((sum: number, s: any) => sum + (s.totalAmount || s.total || 0), 0) +
                            filteredInvoices.reduce((sum: number, i: any) => sum + (i.totalAmount || 0), 0);

        const cogsTotal = ledger
            .filter((entry: any) => entry.debitAccountId === cogsAccount && filterByDateRange(entry.date))
            .reduce((sum: number, entry: any) => sum + (entry.amount || 0), 0);

        // Total Expenses
        const totalExpenses = filteredExpenses.reduce((sum: number, e: any) => sum + (e.amount || 0), 0) + cogsTotal;

        // Net Income
        const netIncome = totalRevenue - totalExpenses;

        // Accounts Receivable (unpaid invoices)
        const accountsReceivable = invoices
            .filter((i: any) => i.status !== 'Paid' && i.status !== 'Cancelled')
            .reduce((sum: number, i: any) => sum + ((i.totalAmount || 0) - (i.paidAmount || 0)), 0);

        // Accounts Payable (unpaid purchases)
        const accountsPayable = purchases
            .filter((p: any) => p.paymentStatus !== 'Paid' && p.status !== 'Cancelled')
            .reduce((sum: number, p: any) => sum + ((p.total || p.totalAmount || 0) - (p.paidAmount || 0)), 0);

        // Total Payments Collected
        const paymentsCollected = filteredPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

        // Transaction counts
        const salesCount = filteredSales.length;
        const invoiceCount = filteredInvoices.length;

        // Top customers by revenue
        const customerRevenue: Record<string, number> = {};
        [...filteredSales, ...filteredInvoices].forEach((t: any) => {
            const name = t.customerName || 'Walk-in';
            customerRevenue[name] = (customerRevenue[name] || 0) + (t.totalAmount || t.total || 0);
        });

        const topCustomers = Object.entries(customerRevenue)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, amount]) => ({ name, amount }));

        // Revenue trend (last 7 days)
        const trendData: { date: string; revenue: number; expenses: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const date = subDays(new Date(), i);
            const dateStr = format(date, 'yyyy-MM-dd');
            
            const dayRevenue = [...sales, ...invoices]
                .filter((t: any) => t.date.startsWith(dateStr))
                .reduce((sum: number, t: any) => sum + (t.totalAmount || t.total || 0), 0);
            
            const dayExpenses = expenses
                .filter((e: any) => e.date.startsWith(dateStr))
                .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
            const dayCogs = ledger
                .filter((entry: any) => entry.debitAccountId === cogsAccount && entry.date.startsWith(dateStr))
                .reduce((sum: number, entry: any) => sum + (entry.amount || 0), 0);

            trendData.push({
                date: format(date, 'EEE'),
                revenue: dayRevenue,
                expenses: dayExpenses + dayCogs
            });
        }

        // Payment method breakdown
        const paymentMethods: Record<string, number> = {};
        filteredSales.forEach((s: any) => {
            const method = s.paymentMethod || 'Cash';
            paymentMethods[method] = (paymentMethods[method] || 0) + (s.totalAmount || s.total || 0);
        });

        return {
            totalRevenue,
            totalExpenses,
            cogsTotal,
            netIncome,
            accountsReceivable,
            accountsPayable,
            paymentsCollected,
            salesCount,
            invoiceCount,
            topCustomers,
            trendData,
            paymentMethods
        };
    }, [sales, invoices, expenses, purchases, customerPayments, ledger, companyConfig, dateRange]);

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Date Range Filter */}
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Revenue Dashboard</h2>
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                    {(['week', 'month', 'quarter', 'year', 'all'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setDateRange(range)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === range
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            {range.charAt(0).toUpperCase() + range.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Primary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 tablet-auto-fit-250 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Total Revenue</p>
                            <h3 className="text-2xl font-black text-emerald-600 mt-1 tabular-nums">{formatCurrency(stats.totalRevenue)}</h3>
                            <p className="text-[11px] text-slate-500 mt-1 font-medium">{stats.salesCount + stats.invoiceCount} transactions</p>
                        </div>
                        <div className="p-3 bg-emerald-50 rounded-xl">
                            <TrendingUp size={24} className="text-emerald-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Total Expenses</p>
                            <h3 className="text-2xl font-black text-rose-600 mt-1 tabular-nums">{formatCurrency(stats.totalExpenses)}</h3>
                            <p className="text-[11px] text-slate-500 mt-1 font-medium">Operating + COGS</p>
                            <p className="text-[11px] text-slate-400 mt-1 font-medium">COGS: {formatCurrency(stats.cogsTotal)}</p>
                        </div>
                        <div className="p-3 bg-rose-50 rounded-xl">
                            <TrendingDown size={24} className="text-rose-600" />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Net Income</p>
                            <h3 className={`text-2xl font-black mt-1 tabular-nums ${stats.netIncome >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                {formatCurrency(stats.netIncome)}
                            </h3>
                            <p className="text-[11px] text-slate-500 mt-1 font-medium">
                                {stats.netIncome >= 0 ? 'Profit' : 'Loss'}
                            </p>
                        </div>
                        <div className={`p-3 rounded-xl ${stats.netIncome >= 0 ? 'bg-blue-50' : 'bg-rose-50'}`}>
                            <DollarSign size={24} className={stats.netIncome >= 0 ? 'text-blue-600' : 'text-rose-600'} />
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Payments Collected</p>
                            <h3 className="text-2xl font-black text-violet-600 mt-1 tabular-nums">{formatCurrency(stats.paymentsCollected)}</h3>
                            <p className="text-[11px] text-slate-500 mt-1 font-medium">Cash inflow</p>
                        </div>
                        <div className="p-3 bg-violet-50 rounded-xl">
                            <Wallet size={24} className="text-violet-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Secondary KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 tablet-auto-fit-250 gap-4">
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-5 rounded-2xl shadow-lg text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-blue-200 tracking-widest uppercase">Accounts Receivable</p>
                            <h3 className="text-2xl font-black mt-1 tabular-nums">{formatCurrency(stats.accountsReceivable)}</h3>
                            <p className="text-[11px] text-blue-200 mt-1 font-medium">Outstanding invoices</p>
                        </div>
                        <div className="p-3 bg-white/20 rounded-xl">
                            <Users size={24} />
                        </div>
                    </div>
                </div>

                <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-5 rounded-2xl shadow-lg text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-amber-200 tracking-widest uppercase">Accounts Payable</p>
                            <h3 className="text-2xl font-black mt-1 tabular-nums">{formatCurrency(stats.accountsPayable)}</h3>
                            <p className="text-[11px] text-amber-200 mt-1 font-medium">Outstanding bills</p>
                        </div>
                        <div className="p-3 bg-white/20 rounded-xl">
                            <Building2 size={24} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 tablet-auto-fit-280 tablet-auto-fit-reset gap-6">
                {/* Revenue Trend Chart */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2">
                        <Activity size={18} className="text-blue-500" />
                        7-Day Revenue Trend
                    </h3>
                    <div style={{ width: '100%', height: 256, minHeight: 150 }}>
                        <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={0}>
                            <AreaChart data={stats.trendData}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${currency}${v >= 1000 ? (v/1000).toFixed(0) + 'k' : v}`} />
                                <Tooltip 
                                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#colorRevenue)" name="Revenue" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Customers */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2">
                        <Users size={18} className="text-violet-500" />
                        Top Customers
                    </h3>
                    <div className="space-y-3">
                        {stats.topCustomers.map((customer, idx) => (
                            <div key={customer.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold">
                                        {idx + 1}
                                    </div>
                                    <span className="font-semibold text-slate-700 text-sm">{customer.name}</span>
                                </div>
                                <span className="font-bold text-slate-900 tabular-nums text-sm">{formatCurrency(customer.amount)}</span>
                            </div>
                        ))}
                        {stats.topCustomers.length === 0 && (
                            <div className="text-center text-slate-400 py-8 text-sm">No customer data available</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Payment Methods Breakdown */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 text-sm tracking-tight mb-4 flex items-center gap-2">
                    <CreditCard size={18} className="text-blue-500" />
                    Revenue by Payment Method
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 tablet-auto-fit-180 gap-4">
                    {Object.entries(stats.paymentMethods)
                        .sort((a, b) => b[1] - a[1])
                        .map(([method, amount]) => (
                            <div key={method} className="p-4 bg-slate-50 rounded-xl text-center">
                                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{method}</p>
                                <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{formatCurrency(amount)}</p>
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {stats.totalRevenue > 0 ? ((amount / stats.totalRevenue) * 100).toFixed(1) : 0}%
                                </p>
                            </div>
                        ))}
                </div>
            </div>
        </div>
    );
};

export default RevenueDashboard;
