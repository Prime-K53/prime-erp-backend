import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, ReferenceLine
} from 'recharts';
import { subWeeks, subMonths, subYears, isAfter, format } from 'date-fns';
import {
  Search, Bell, ChevronRight, ListTodo,
  Ticket, BarChart2, Triangle, MoreVertical, Plus,
  ShoppingCart, AlertCircle, Timer, Calculator,
  Clock, CheckSquare, Briefcase, CheckCircle2, Zap, Calendar, Eye,
  X, AlertTriangle, Package, Info, Wallet, Trophy, User, TrendingUp, Truck,
  ArrowUpRight, RefreshCw, School, Trash2, Activity, ShieldCheck, DollarSign
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { usePricingCalculator } from '../context/PricingCalculatorContext';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { OFFLINE_MODE } from '../constants';
import { api } from '../services/api';
import { financialIntegrityService } from '../services/financialIntegrityService';
import { OfflineImage } from '../components/OfflineImage';
import PrintPreview from '../components/PrintPreview';
import DocumentDispatcher from '../components/DocumentDispatcher';
import { DocumentType } from '../utils/documentMapper';
import { DashboardSkeleton } from '../components/Skeleton';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ExaminationBatchNotificationCard } from '../components/ExaminationBatchNotificationCard';
import { ExaminationBatchNotificationCardCompact } from '../components/ExaminationBatchNotificationCardCompact';

const Dashboard: React.FC = () => {
  const {
    invoices = [], workOrders = [], customerPayments = [],
    expenses = [], sales = [], tasks = [],
    inventory = [], accounts = [], ledger = [],
    alerts = [], purchases = [], recurringInvoices = [],
    auditLogs = [], customers = [],
    deliveryNotes = [], shipments = [],
    supplierPayments = [],
    companyConfig,
    user,
    addTask,
    updateWorkOrderStatus,
    updateTask,
    notify,
    dismissAlert,
    isInitialized,
    setIsPosModalOpen
  } = useData();

  const { notifications: batchNotifications, loading: notificationsLoading } = useNotifications();

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ type: DocumentType; data: any }>({ type: 'Receipt', data: null });

  const handleViewDocument = (type: string, id: string | number) => {
    // Logic to find document data based on type and ID
    let data: any = null;
    let docType: DocumentType | null = null;

    if (type === 'Job') {
      const wo = workOrders.find(w => w.id === id);
      if (wo) {
        data = wo;
        docType = 'Work Order';
      }
    } else if (type === 'Examination') {
      const exam = examinationQueue.find(e => e.batch_id === id);
      if (exam) {
        data = exam;
        docType = 'Examination Invoice';
      }
    } else if (type === 'Task') {
      const task = tasks.find(t => t.id === id);
      if (task) {
        // Tasks are not a printable DocumentType; show notification instead
        notify('Task preview is not available', 'info');
        return;
      }
    } else {
      // If caller passed a valid DocumentType string, accept it
      const possible = type as DocumentType;
      const validTypes: DocumentType[] = ['Invoice', 'Quotation', 'Delivery Note', 'Statement', 'Receipt', 'Examination Invoice', 'Subscription Invoice', 'Work Order', 'Purchase Order'];
      if (validTypes.includes(possible)) {
        docType = possible;
        // attempt to find data in common collections
        data = invoices.find(i => i.id === id) || workOrders.find(w => w.id === id) || sales.find(s => s.id === id) || null;
      }
    }

    if (data && docType) {
      setPreviewData({ type: docType, data });
      setIsPreviewOpen(true);
    } else {
      notify("Document data not found", "error");
    }
  };

  if (!isInitialized) {
    return <DashboardSkeleton />;
  }
  const navigate = useNavigate();
  const currency = companyConfig?.currencySymbol || '$';

  const formatKPIValue = (val: number | undefined | null) => {
    if (val === undefined || val === null) return '0';
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : '';

    if (absVal >= 1000000) {
      const m = absVal / 1000000;
      return sign + (m % 1 === 0 ? m.toFixed(0) + 'M' : m.toFixed(1) + 'M');
    }
    if (absVal >= 1000) {
      const k = absVal / 1000;
      return sign + (k % 1 === 0 ? k.toFixed(0) + 'K' : k.toFixed(1) + 'K');
    }
    return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const [searchQuery, setSearchTerm] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState<string>('');
  const [examinationQueue, setExaminationQueue] = useState<any[]>([]);
  const [invoiceTimePeriod, setInvoiceTimePeriod] = useState<string>('Last week');
  const [posTimePeriod, setPosTimePeriod] = useState<string>('Last week');
  const [activeSubscriptionIndex, setActiveSubscriptionIndex] = useState(0);

  // Sub-account filtering state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [selectedSubAccountNames, setSelectedSubAccountNames] = useState<string[]>([]);

  // Add event handler for sub-account filtering (missing handler was causing controlled/uncontrolled warning)
  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCustomerId(e.target.value);
    setSelectedSubAccountNames([]); // Reset sub-accounts when customer changes
  };

  const selectedCustomerObj = useMemo(() => {
    if (selectedCustomerId === 'all') return null;
    return customers.find(c => c.id.toString() === selectedCustomerId);
  }, [selectedCustomerId, customers]);

  const customerSubAccounts = useMemo(() => {
    if (!selectedCustomerObj) return [];
    return selectedCustomerObj.subAccounts || [];
  }, [selectedCustomerObj]);

  const toggleSubAccount = (name: string) => {
    setSelectedSubAccountNames(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // --- FILTERED DATA ---
  const filteredInvoices = useMemo(() => {
    if (selectedCustomerId === 'all') return invoices;
    return (invoices || []).filter(inv => {
      const matchCustomer = inv.customerId?.toString() === selectedCustomerId;
      if (!matchCustomer) return false;
      if (selectedSubAccountNames.length === 0) return true;
      return selectedSubAccountNames.includes(inv.subAccountName || 'Main');
    });
  }, [invoices, selectedCustomerId, selectedSubAccountNames]);

  const filteredSales = useMemo(() => {
    if (selectedCustomerId === 'all') return sales;
    return (sales || []).filter(sale => {
      const matchCustomer = sale.customerId?.toString() === selectedCustomerId;
      if (!matchCustomer) return false;
      if (selectedSubAccountNames.length === 0) return true;
      return selectedSubAccountNames.includes(sale.subAccountName || 'Main');
    });
  }, [sales, selectedCustomerId, selectedSubAccountNames]);

  const filteredLedger = useMemo(() => {
    if (selectedCustomerId === 'all') return ledger;
    return (ledger || []).filter(entry => {
      const matchCustomer = entry.customerId?.toString() === selectedCustomerId;
      if (!matchCustomer) return false;
      if (selectedSubAccountNames.length === 0) return true;
      return selectedSubAccountNames.includes(entry.subAccountName || 'Main');
    });
  }, [ledger, selectedCustomerId, selectedSubAccountNames]);

  const filteredWorkOrders = useMemo(() => {
    if (selectedCustomerId === 'all') return workOrders;
    return (workOrders || []).filter((wo: any) => {
      const matchCustomer = selectedCustomerObj ? wo.customerName === selectedCustomerObj.name : true;
      if (!matchCustomer) return false;
      if (selectedSubAccountNames.length === 0) return true;
      return selectedSubAccountNames.some(sub => wo.notes?.includes(sub) || wo.tags?.includes(sub));
    });
  }, [workOrders, selectedCustomerId, selectedSubAccountNames, selectedCustomerObj]);

  const filteredRecurringInvoices = useMemo(() => {
    if (selectedCustomerId === 'all') return recurringInvoices;
    return (recurringInvoices || []).filter(ri => {
      const matchCustomer = ri.customerId?.toString() === selectedCustomerId;
      if (!matchCustomer) return false;
      if (selectedSubAccountNames.length === 0) return true;
      return selectedSubAccountNames.includes(ri.subAccountName || 'Main');
    });
  }, [recurringInvoices, selectedCustomerId, selectedSubAccountNames]);
  useEffect(() => {
    const fetchExaminationQueue = async () => {
      try {
        const data = await api.production.getExaminations();
        setExaminationQueue(data);
      } catch (err) {
        console.error('Failed to fetch examination queue:', err);
      }
    };
    fetchExaminationQueue();
  }, []);

  // Auto-rotate subscriptions carousel
  useEffect(() => {
    if (filteredRecurringInvoices.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSubscriptionIndex(prev => (prev + 1) % filteredRecurringInvoices.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [filteredRecurringInvoices.length]);

  const handleAddQuickTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    const newTask = {
      title: quickTaskTitle,
      status: 'Pending',
      priority: 'Medium',
      dueDate: new Date().toISOString().split('T')[0],
      assignedTo: user?.id || '',
      notes: 'Quick task from dashboard',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    addTask(newTask);
    setQuickTaskTitle('');
    notify("Task added successfully", "success");
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const verifiedDashboardMetrics = useMemo(() => (
    financialIntegrityService.buildVerifiedDashboardMetrics({
      accounts: accounts || [],
      ledger: filteredLedger || [],
      invoices: filteredInvoices || [],
      sales: filteredSales || [],
      customerPayments: customerPayments || [],
      purchases: purchases || [],
      expenses: expenses || []
    })
  ), [accounts, filteredLedger, filteredInvoices, filteredSales, customerPayments, purchases, expenses]);

  const getMonthlyRevenue = useCallback((month: number, year: number) => (
    financialIntegrityService.buildVerifiedDashboardMetrics({
      accounts: accounts || [],
      ledger: filteredLedger || [],
      invoices: filteredInvoices || [],
      sales: filteredSales || [],
      customerPayments: customerPayments || [],
      purchases: purchases || [],
      expenses: expenses || []
    }, new Date(year, month, 1)).currentMonth.revenue
  ), [accounts, filteredLedger, filteredInvoices, filteredSales, customerPayments, purchases, expenses]);

  const getMonthlyExpenses = useCallback((month: number, year: number) => (
    financialIntegrityService.buildVerifiedDashboardMetrics({
      accounts: accounts || [],
      ledger: filteredLedger || [],
      invoices: filteredInvoices || [],
      sales: filteredSales || [],
      customerPayments: customerPayments || [],
      purchases: purchases || [],
      expenses: expenses || []
    }, new Date(year, month, 1)).currentMonth.expenses
  ), [accounts, filteredLedger, filteredInvoices, filteredSales, customerPayments, purchases, expenses]);

  const getMonthlyExpenditure = useCallback((month: number, year: number) => {
    // Expenditure typically means Cash Outflow + Accrued Expenses.
    // For "Financial Performance", it usually compares Income (Revenue) vs Expenses (Accrual).
    // So we should return Total Expenses (including COGS) for the month.
    return getMonthlyExpenses(month, year);
  }, [getMonthlyExpenses]);

  const kpiData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const curRev = verifiedDashboardMetrics.currentMonth.revenue;
    const prevRev = verifiedDashboardMetrics.previousMonth.revenue;
    const curExp = verifiedDashboardMetrics.currentMonth.expenses;
    const netProfit = verifiedDashboardMetrics.currentMonth.netProfit;
    const prevExp = verifiedDashboardMetrics.previousMonth.expenses;
    const prevNetProfit = verifiedDashboardMetrics.previousMonth.netProfit;

    const netProfitChange = prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : (netProfit > 0 ? 100 : 0);
    const netProfitChangeStr = netProfitChange >= 0 ? `+${netProfitChange.toFixed(0)}%` : `${netProfitChange.toFixed(0)}%`;

    const revChange = prevRev > 0 ? ((curRev - prevRev) / prevRev) * 100 : 0;
    const revChangeStr = revChange >= 0 ? `+${revChange.toFixed(0)}%` : `${revChange.toFixed(0)}%`;

    const unpaidTotal = verifiedDashboardMetrics.receivables;
    const cashForecast = verifiedDashboardMetrics.cashForecast;

    // Calculate receivables percentage (against total invoices or a target)
    const totalInvoices = (filteredInvoices || []).reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const receivablesPercentage = totalInvoices > 0 ? Math.min(Math.round((unpaidTotal / totalInvoices) * 100), 100) : 0;

    // Calculate today's collection change compared to yesterday
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const todayCollection = verifiedDashboardMetrics.todayCollection;
    const yesterdayCollection = (customerPayments || [])
      .filter((p: any) => new Date(p.date).toISOString().split('T')[0] === yesterdayStr)
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    
    const collectionChange = yesterdayCollection > 0 
      ? ((todayCollection - yesterdayCollection) / yesterdayCollection) * 100 
      : (todayCollection > 0 ? 100 : 0);
    const collectionChangeStr = collectionChange >= 0 ? `+${collectionChange.toFixed(0)}%` : `${collectionChange.toFixed(0)}%`;

    // Calculate collection percentage against daily target (assuming 30-day month)
    const monthlyTarget = curRev > 0 ? curRev / 30 : 10000;
    const collectionPercentage = monthlyTarget > 0 ? Math.min(Math.round((todayCollection / monthlyTarget) * 100), 100) : 0;

    const pendingJobsCount = (filteredWorkOrders || [])
      .filter((wo: any) => ['Pending', 'Scheduled', 'In Progress', 'QA'].includes(wo.status))
      .length;

    const activeExamBatches = (examinationQueue || [])
      .filter((e: any) => ['Calculated', 'Approved'].includes(e.status))
      .length;

    const totalActiveJobs = pendingJobsCount + activeExamBatches;

    // Calculate active jobs change compared to last week
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastWeekJobs = (filteredWorkOrders || [])
      .filter((wo: any) => {
        const createdAt = new Date(wo.createdAt || wo.date);
        return createdAt <= lastWeek && ['Pending', 'Scheduled', 'In Progress', 'QA'].includes(wo.status);
      }).length;
    
    const jobsChange = lastWeekJobs > 0 
      ? ((totalActiveJobs - lastWeekJobs) / lastWeekJobs) * 100 
      : (totalActiveJobs > 0 ? 100 : 0);
    const jobsChangeStr = jobsChange >= 0 ? `+${jobsChange.toFixed(0)}%` : `${jobsChange.toFixed(0)}%`;

    // Calculate active jobs percentage against capacity (assuming 20 jobs capacity)
    const jobsCapacity = 20;
    const jobsPercentage = Math.min(Math.round((totalActiveJobs / jobsCapacity) * 100), 100);

    return [
      {
        label: 'Receivables',
        value: `${currency}${formatKPIValue(unpaidTotal)}`,
        change: revChangeStr,
        icon: <AlertCircle size={20} className="text-rose-500" />,
        path: '/sales-flow/invoices',
        percentage: receivablesPercentage || 0,
        color: '#f43f5e'
      },
      {
        label: "Today's Collection",
        value: `${currency}${formatKPIValue(todayCollection)}`,
        change: collectionChangeStr,
        icon: <Wallet size={20} className="text-emerald-500" />,
        path: '/sales-flow/payments',
        percentage: collectionPercentage || 0,
        color: '#10b981'
      },
      {
        label: 'Net Profit',
        value: `${currency}${formatKPIValue(netProfit)}`,
        change: netProfitChangeStr,
        icon: <TrendingUp size={20} className="text-purple-500" />,
        path: '/fiscal-reports/financials?type=IncomeStatement',
        percentage: Math.min(Math.max(Math.round((curRev > 0 ? (netProfit / curRev) * 100 : 0)), 0), 100),
        color: '#8b5cf6',
        period: 'This Month',
        valueColor: netProfit < 0 ? 'text-rose-600' : 'text-[#1E293B]'
      },
      {
        label: 'Active Jobs',
        value: (totalActiveJobs || 0).toString().padStart(2, '0'),
        change: jobsChangeStr,
        icon: <Timer size={20} className="text-amber-500" />,
        path: '/industrial/work-orders',
        percentage: jobsPercentage || 0,
        color: '#f59e0b'
      },
    ];
  }, [currency, filteredWorkOrders, examinationQueue, verifiedDashboardMetrics, filteredInvoices, customerPayments]);

  const performanceData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    return months.map((month, index) => {
      const monthIncome = getMonthlyRevenue(index, currentYear);
      const monthExpense = getMonthlyExpenditure(index, currentYear);

      return { name: month, income: monthIncome, expense: monthExpense, active: index === new Date().getMonth() };
    });
  }, [getMonthlyRevenue, getMonthlyExpenditure]);

  const timelineEvents = useMemo(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const now = new Date();

    const activeTasks = (tasks || [])
      .filter((t: any) => t.status !== 'Completed' && t.status !== 'Cancelled')
      .map((t: any) => ({
        id: t.id,
        rawType: 'Task',
        time: 'Task',
        title: t.title,
        desc: t.notes || 'No description',
        dueDate: t.dueDate,
        icon: <CheckSquare size={16} />,
        color: t.priority === 'High' || t.priority === 'Urgent' ? '#ef4444' : '#3b82f6',
        priority: t.priority,
        meta: `Assigned: ${t.assignedTo || 'Me'}`
      }));

    const pendingJobs = (filteredWorkOrders || [])
      .filter((w: any) => w.status === 'Pending')
      .map((w: any) => ({
        id: w.id,
        rawType: 'Job',
        time: 'Production',
        title: w.productName,
        desc: `${w.customerName}`,
        dueDate: w.dueDate,
        icon: <Briefcase size={16} />,
        color: '#f59e0b', // Amber for Pending
        status: w.status,
        meta: `Qty: ${w.quantityPlanned}`
      }));

    const activeJobs = (filteredWorkOrders || [])
      .filter((w: any) => ['Scheduled', 'In Progress', 'QA'].includes(w.status)) // Only non-pending active jobs
      .map((w: any) => ({
        id: w.id,
        rawType: 'Job',
        time: 'Production',
        title: w.productName,
        desc: `${w.customerName}`,
        dueDate: w.dueDate,
        icon: <Briefcase size={16} />,
        color: w.status === 'In Progress' ? '#3b82f6' : '#f59e0b',
        status: w.status,
        meta: `Qty: ${w.quantityPlanned}`
      }));

    const activeSubs = (filteredRecurringInvoices || [])
      .filter((s: any) => s.status === 'Active')
      .map((s: any) => ({
        id: s.id,
        rawType: 'Subscription',
        time: 'Recurring',
        title: s.customerName,
        desc: `Amount: ${currency}${(s.total || s.totalAmount || 0).toLocaleString()}`,
        dueDate: s.nextRunDate.split('T')[0],
        icon: <RefreshCw size={16} />,
        color: '#10b981',
        meta: `Freq: ${s.frequency}`
      }));

    const activeExams = Object.values(
      (examinationQueue || [])
        .filter((e: any) => e.status !== 'invoiced')
        .reduce((acc: any, curr: any) => {
          if (!acc[curr.batch_id]) {
            acc[curr.batch_id] = {
              id: curr.batch_id,
              rawType: 'Examination',
              time: 'Examination',
              title: curr.school_name,
              desc: `${curr.class} - ${curr.subject}`,
              dueDate: curr.created_at, // Use created_at as fallback
              icon: <School size={16} />,
              color: '#8b5cf6', // Purple for exams
              subjectCount: 1,
              meta: `${curr.class}`
            };
          } else {
            acc[curr.batch_id].subjectCount++;
            acc[curr.batch_id].desc = `${curr.class} (${acc[curr.batch_id].subjectCount} subjects)`;
          }
          return acc;
        }, {})
    ).map((e: any) => ({
      ...e,
      meta: `${e.meta} • ${e.subjectCount} subjects`
    }));

    return [...pendingJobs, ...activeJobs, ...activeTasks, ...activeSubs, ...activeExams]
      .filter(item => {
        const d = new Date(item.dueDate);
        return d >= now && d <= nextWeek;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [tasks, filteredWorkOrders, filteredRecurringInvoices, currency, examinationQueue]);



  // Calculations for Top Customer and Top Products
  const topStats = useMemo(() => {
    const customerSales: Record<string, number> = {};
    const productStats: Record<string, { qty: number, revenue: number, id: string }> = {};

    (filteredSales || []).forEach(sale => {
      const cName = sale.customerName || 'Walk-in';
      customerSales[cName] = (customerSales[cName] || 0) + (sale.total || sale.totalAmount || 0);

      (sale.items || []).forEach(item => {
        const pName = item.name || item.productName || 'Unknown Item';
        if (!productStats[pName]) {
          productStats[pName] = { qty: 0, revenue: 0, id: item.productId || item.sku || 'N/A' };
        }
        productStats[pName].qty += (item.quantity || 0);
        productStats[pName].revenue += ((item.quantity || 0) * (item.price || 0));
      });
    });

    const topCustomerName = Object.entries(customerSales).sort((a, b) => b[1] - a[1])[0];
    const sortedProducts = Object.entries(productStats)
      .sort((a, b) => b[1].qty - a[1].qty) // sorting by qty
      .map(([name, stats]) => ({
        name,
        ...stats,
        velocity: stats.qty > 100 ? 'Accelerated' : stats.qty > 50 ? 'High' : 'Stable'
      }));

    return {
      customer: topCustomerName ? { name: topCustomerName[0], value: topCustomerName[1] } : null,
      topProducts: sortedProducts.slice(0, 5)
    };
  }, [filteredSales]);

  // Cash flow Calculation (Invoices, POS, Examination)
  const logisticsData = useMemo(() => {
    const pending = (deliveryNotes || []).filter((dn: any) => dn.status === 'Pending').length;
    const active = (shipments || []).filter((s: any) => s.status !== 'Delivered' && s.status !== 'Cancelled').length;
    return { pending, active };
  }, [deliveryNotes, shipments]);

  const currentMonthIdx = new Date().getMonth();
  const currentMonthData = performanceData[currentMonthIdx];

  const cashFlowSummary = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;

    if (invoiceTimePeriod === 'Last week') startDate = subWeeks(now, 1);
    else if (invoiceTimePeriod === 'Last month') startDate = subMonths(now, 1);
    else if (invoiceTimePeriod === 'Last year') startDate = subYears(now, 1);

    // 1. Invoices (Standard Sales Invoices)
    const periodInvoices = startDate
      ? (filteredInvoices || []).filter(i => isAfter(new Date(i.date), startDate!))
      : (filteredInvoices || []);
    const invoicesTotal = periodInvoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    // 2. POS (Point of Sale Sales)
    const periodPOS = startDate
      ? (filteredSales || []).filter(s => isAfter(new Date(s.date), startDate!))
      : (filteredSales || []);
    const posTotal = periodPOS.reduce((sum, s) => sum + (s.total || s.totalAmount || 0), 0);

    // 3. Examination (Invoices specifically for Examinations)
    const periodExams = startDate
      ? (filteredInvoices || []).filter(i => {
        const isDateMatch = isAfter(new Date(i.date), startDate!);
        const isExam = i.type === 'Examination Invoice' ||
          i.category === 'Examination' ||
          (i.items || []).some((item: any) => item.category === 'Examination' || (item.name && item.name.toLowerCase().includes('exam')));
        return isDateMatch && isExam;
      })
      : (filteredInvoices || []).filter(i =>
        i.type === 'Examination Invoice' ||
        i.category === 'Examination' ||
        (i.items || []).some((item: any) => item.category === 'Examination' || (item.name && item.name.toLowerCase().includes('exam')))
      );
    const examsTotal = periodExams.reduce((sum, ri) => sum + (ri.totalAmount || 0), 0);

    // Adjust Invoices Total to exclude exams and POS to prevent double counting
    // Note: POS Sales create corresponding Invoice records, so they are included in invoicesTotal.
    // We subtract posTotal (calculated from Sales) from invoicesTotal to avoid counting them twice in the Grand Total
    // and to separate them in the breakdown.
    const adjustedInvoicesTotal = Math.max(0, invoicesTotal - examsTotal - posTotal);

    const grandTotal = adjustedInvoicesTotal + posTotal + examsTotal;

    const data = [
      { name: 'Invoices', value: adjustedInvoicesTotal, color: '#4F46E5', percentage: grandTotal > 0 ? (adjustedInvoicesTotal / grandTotal) * 100 : 0 },
      { name: 'POS', value: posTotal, color: '#F59E0B', percentage: grandTotal > 0 ? (posTotal / grandTotal) * 100 : 0 },
      { name: 'Examination', value: examsTotal, color: '#10B981', percentage: grandTotal > 0 ? (examsTotal / grandTotal) * 100 : 0 }
    ].filter(d => d.value > 0);

    if (data.length === 0) data.push({ name: 'No Data', value: 1, color: '#f1f5f9', percentage: 100 });

    return { data, total: grandTotal };
  }, [filteredInvoices, filteredSales, filteredRecurringInvoices, invoiceTimePeriod]);

  // POS Performance Calculation
  const posPerformanceData = useMemo(() => {
    const now = new Date();
    let chartData: { name: string, value: number }[] = [];
    let startDate: Date;
    let periodStr: string;
    let prevStartDate: Date;
    let prevEndDate: Date;

    if (posTimePeriod === 'Last week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const startOfWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      startDate = startOfWeek;

      chartData = days.map((dayName, index) => {
        const targetDate = new Date(startOfWeek);
        targetDate.setDate(startOfWeek.getDate() + index);
        const dateString = targetDate.toISOString().split('T')[0];

        const dailyTotal = (filteredSales || []).filter(sale => {
          const saleDate = new Date(sale.date).toISOString().split('T')[0];
          return saleDate === dateString;
        }).reduce((sum, sale) => sum + (sale.total || sale.totalAmount || 0), 0);

        return { name: dayName, value: dailyTotal };
      });
      periodStr = `${format(startOfWeek, 'MMM dd')} - ${format(new Date(startOfWeek.getTime() + 6 * 24 * 60 * 60 * 1000), 'MMM dd, yyyy')}`;

      prevStartDate = subWeeks(startOfWeek, 1);
      prevEndDate = startOfWeek;
    } else if (posTimePeriod === 'Last month') {
      const startOfPeriod = subMonths(now, 1);
      startDate = startOfPeriod;

      // Group into 4 weeks for the last 30 days
      chartData = [3, 2, 1, 0].map(weeksAgo => {
        const wStart = subWeeks(now, weeksAgo + 1);
        const wEnd = subWeeks(now, weeksAgo);

        const weeklyTotal = (filteredSales || []).filter(sale => {
          const d = new Date(sale.date);
          return d >= wStart && d < wEnd;
        }).reduce((sum, sale) => sum + (sale.total || sale.totalAmount || 0), 0);

        return { name: `W${4 - weeksAgo}`, value: weeklyTotal };
      });
      periodStr = `${format(startOfPeriod, 'MMM dd')} - ${format(now, 'MMM dd, yyyy')}`;

      prevStartDate = subMonths(startOfPeriod, 1);
      prevEndDate = startOfPeriod;
    } else { // Last year
      const startOfPeriod = subYears(now, 1);
      startDate = startOfPeriod;

      // Last 12 months
      chartData = Array.from({ length: 12 }).map((_, i) => {
        const d = subMonths(now, 11 - i);
        const monthName = format(d, 'MMM');
        const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

        const monthlyTotal = (filteredSales || []).filter(sale => {
          const sd = new Date(sale.date);
          return sd >= mStart && sd <= mEnd;
        }).reduce((sum, sale) => sum + (sale.total || sale.totalAmount || 0), 0);

        return { name: monthName, value: monthlyTotal };
      });
      periodStr = `${format(startOfPeriod, 'MMM yyyy')} - ${format(now, 'MMM yyyy')}`;

      prevStartDate = subYears(startOfPeriod, 1);
      prevEndDate = startOfPeriod;
    }

    const currentTotal = chartData.reduce((sum, d) => sum + d.value, 0);

    const prevTotal = (filteredSales || []).filter(sale => {
      const d = new Date(sale.date);
      return d >= prevStartDate && d < prevEndDate;
    }).reduce((sum, sale) => sum + (sale.total || sale.totalAmount || 0), 0);

    const change = prevTotal > 0
      ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100)
      : currentTotal > 0 ? 100 : 0;

    return {
      data: chartData,
      total: currentTotal,
      change,
      period: periodStr
    };
  }, [filteredSales, posTimePeriod]);

  const handleCompleteItem = (item: any) => {
    setCompletingId(item.id);

    // Slight delay to allow animation to play before logic updates the list
    setTimeout(() => {
      if (item.rawType === 'Job') {
        updateWorkOrderStatus(item.id, 'Completed');
        notify(`Work Order ${item.id} marked as Completed`, 'success');
      }
      else {
        const task = (tasks || []).find(t => t.id === item.id);
        if (task) {
          updateTask({ ...task, status: 'Completed' });
          notify(`Task marked as Completed`, 'success');
        }
      }
      setCompletingId(null);
    }, 600);
  };

  const handleViewItem = (item: any) => {
    if (item.rawType === 'Job') navigate('/production/work-orders', { state: { action: 'view', id: item.id } });
    else if (item.rawType === 'Examination') navigate('/production/examination-printing', { state: { batchId: item.id } });
    else navigate('/sales-flow/tasks');
  };

  const getCardBg = (idx: number) => {
    const backgrounds = ['bg-blue-50/70 border-blue-100', 'bg-emerald-50/70 border-emerald-100', 'bg-amber-50/70 border-amber-100', 'bg-purple-50/70 border-purple-100', 'bg-rose-50/70 border-rose-100', 'bg-indigo-50/70 border-indigo-100'];
    return backgrounds[idx % backgrounds.length];
  };

  // Fallback data for document preview when no data is available
  const fallbackReceiptData = {
    id: 'PREVIEW-000',
    date: new Date().toISOString(),
    customerName: 'No customer selected',
    customerAddress: 'N/A',
    amountPaid: 0,
    items: [],
    currencySymbol: currency
  };

  return (
    <div className="h-full flex overflow-hidden bg-[#F1F2F7] font-sans text-sm font-normal">
      <PrintPreview
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={`${previewData.type} Preview`}
      >
        <DocumentDispatcher type={previewData.type} data={previewData.data || fallbackReceiptData} />
      </PrintPreview>
      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar px-10 py-6">
        <header className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-bold text-[#1E293B]">Control Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">

            <div className="relative w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              <input type="text" placeholder="Global system search..." value={searchQuery || ''} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && navigate(`/search?q=${searchQuery}`)} className="w-full pl-12 pr-4 py-3 rounded-2xl border-none bg-white shadow-soft focus:ring-2 focus:ring-[#FF8A8A]/20 outline-none text-sm font-normal" />
            </div>
          </div>
        </header>

        <section className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-card border-2 border-white bg-slate-100 flex items-center justify-center">
              <OfflineImage src={user?.avatar} alt="Avatar" className="w-full h-full object-cover" fallback={<div className="w-full h-full flex items-center justify-center bg-blue-600 text-white text-xl font-black italic">{user?.name?.charAt(0) || 'U'}</div>} />
            </div>
            <div><h2 className="text-base font-bold text-[#1E293B]">Welcome back, {user?.name || 'Administrator'}</h2><p className="text-xs text-slate-400 font-normal mt-0.5">Secure local instance connected. Last check: {format(new Date(), 'HH:mm')}</p></div>
          </div>
          <div className="text-right flex items-center gap-3">
            <p className="text-sm font-bold text-[#1E293B]">{format(new Date(), 'EEEE, MMMM do, yyyy')}</p>
            <div className="flex items-center gap-2 relative">
              <button onClick={() => setIsPosModalOpen(true)} className="p-2.5 rounded-2xl text-blue-600 hover:bg-slate-200/50 transition-colors" title="Retail POS"><ShoppingCart size={24} /></button>
              <CalculatorButton />
              <button onClick={() => navigate('/sales-flow/tasks')} className="p-2.5 rounded-2xl text-emerald-600 hover:bg-slate-200/50 transition-colors" title="Task Management"><CheckSquare size={24} /></button>
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`relative p-2.5 rounded-2xl transition-all ${showNotifications ? 'bg-blue-600 text-white' : 'text-rose-500 hover:bg-slate-200/50'}`}
                  title="System Intelligence Alerts"
                >
                  <Bell size={24} />
                  {alerts?.length > 0 && <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-5 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Zap size={16} className="text-blue-600 fill-blue-600" />
                        System Intelligence
                      </h3>
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                        {alerts.length} Alerts
                      </span>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                      {alerts.length === 0 && (!batchNotifications || batchNotifications.length === 0) ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center px-6">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                            <ShieldCheck size={24} className="text-slate-200" />
                          </div>
                          <p className="text-xs font-bold text-slate-400">All systems optimal</p>
                          <p className="text-[10px] text-slate-300 mt-1">No pending intelligence alerts</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {batchNotifications && batchNotifications.length > 0 && (
                            <div className="mb-2">
                              <div className="px-2 py-1 flex items-center justify-between mb-1">
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${batchNotifications.filter(n => !n.is_read).length > 0 ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'}`} />
                                  Examination Updates
                                </h4>
                                <span className="text-[9px] font-medium text-slate-400">
                                  {batchNotifications.filter(n => !n.is_read).length} new
                                </span>
                              </div>
                              <div className="space-y-1">
                                {batchNotifications.slice(0, 3).map((notification) => (
                                  <ExaminationBatchNotificationCardCompact
                                    key={notification.id}
                                    notification={notification}
                                    onDismiss={() => {}}
                                  />
                                ))}
                              </div>
                              {batchNotifications.length > 3 && (
                                <button
                                  onClick={() => navigate('/examination/batches')}
                                  className="w-full mt-1 py-1.5 text-[10px] font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                >
                                  View All ({batchNotifications.length})
                                </button>
                              )}
                            </div>
                          )}

                          {alerts.map((alert: any) => (
                            <div
                              key={alert.id}
                              className="p-4 rounded-2xl hover:bg-slate-50 transition-colors group relative cursor-default"
                            >
                              <div className="flex gap-3">
                                <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${alert.type === 'Critical' ? 'bg-rose-50 text-rose-500' :
                                  alert.type === 'Warning' ? 'bg-amber-50 text-amber-500' :
                                    'bg-blue-50 text-blue-500'
                                  }`}>
                                  {alert.type === 'Critical' ? <AlertCircle size={16} /> :
                                    alert.type === 'Warning' ? <AlertTriangle size={16} /> :
                                      <Info size={16} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] font-bold text-slate-800 mb-0.5">{alert.title}</p>
                                  <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{alert.message}</p>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
                                      {format(new Date(alert.timestamp || new Date()), 'HH:mm')} • {alert.category || 'System'}
                                    </span>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        dismissAlert(alert.id);
                                      }}
                                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-all text-slate-300"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {alerts.length > 0 && (
                      <div className="p-3 bg-slate-50/50 border-t border-slate-50">
                        <button
                          onClick={() => navigate('/reports/health')}
                          className="w-full py-2 bg-white border border-slate-100 rounded-xl text-[10px] font-bold text-slate-500 hover:text-blue-600 hover:border-blue-100 transition-all flex items-center justify-center gap-2"
                        >
                          <Activity size={12} />
                          View Full Health Report
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-4 tablet-auto-fit-220 gap-6 mb-8 shrink-0">
          {kpiData.map((kpi, idx) => (
            <div
              key={idx}
              onClick={() => navigate(kpi.path)}
              className="bg-white p-5 rounded-[1.5rem] shadow-soft border border-white hover:shadow-lg transition-all cursor-pointer group flex flex-col"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-500 text-[13px] font-semibold mb-2">{kpi.label}</p>
                  <h3 className={`text-2xl font-bold ${kpi.valueColor || 'text-[#1E293B]'}`}>{kpi.value}</h3>
                </div>
                <div className="relative w-12 h-12 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="24"
                      cy="24"
                      r="18"
                      stroke="#f1f5f9"
                      strokeWidth="5"
                      fill="transparent"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="18"
                      stroke={kpi.color}
                      strokeWidth="5"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 18}
                      strokeDashoffset={2 * Math.PI * 18 * (1 - (kpi.percentage || 0) / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${kpi.change.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {kpi.change}
                </div>
                <span className="text-slate-400 text-[11px] font-medium">{kpi.period || 'From last Week'}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 min-[1025px]:grid-cols-4 gap-6 mb-10 shrink-0">
          {/* Financial Performance - 75% */}
          <div className="min-[1025px]:col-span-3 bg-white p-8 rounded-[2rem] shadow-soft border border-white/40">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-lg font-bold text-[#0f172a] tracking-tight">Financial Performance</h3>
                <p className="text-[10px] text-slate-400 font-bold tracking-[0.1em] mt-1.5 uppercase">Income vs Expenditure</p>
              </div>
              <div className="flex items-center gap-8 bg-slate-50/50 p-2 rounded-2xl border border-slate-100/50">
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all hover:bg-white hover:shadow-sm group cursor-pointer">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-transform"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Income</span>
                </div>
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl transition-all hover:bg-white hover:shadow-sm group cursor-pointer">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.5)] group-hover:scale-110 transition-transform"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expenditure</span>
                </div>
              </div>
            </div>
            
            <div className="h-[420px] relative mt-4 bg-[#0f172a] rounded-[1.5rem] p-8 overflow-hidden shadow-2xl">
              {/* Decorative Background Elements to mimic neon feel */}
              <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-emerald-500 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-rose-500 rounded-full blur-[120px]"></div>
              </div>

              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="incomeGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                    </linearGradient>
                    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>
                  
                  <CartesianGrid 
                    vertical={false} 
                    strokeDasharray="0" 
                    stroke="rgba(255,255,255,0.05)" 
                  />
                  
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={(props) => {
                      const { x, y, payload } = props;
                      const isActiveMonth = payload.value === format(new Date(), 'MMM');
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text 
                            x={0} 
                            y={0} 
                            dy={20} 
                            textAnchor="middle" 
                            fill={isActiveMonth ? "#fff" : "rgba(255,255,255,0.3)"}
                            className={`text-[11px] font-bold tracking-tight ${isActiveMonth ? 'opacity-100' : 'opacity-60'}`}
                          >
                            {payload.value}
                          </text>
                          {isActiveMonth && (
                            <rect x={-15} y={28} width={30} height={2} fill="#10B981" rx={1} />
                          )}
                        </g>
                      );
                    }}
                    interval={0}
                  />
                  
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10, fontWeight: 700 }}
                    tickFormatter={(value) => `${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                  />
                  
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-[#1e293b]/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl min-w-[160px] animate-in zoom-in-95 duration-200">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-3">{label} Performance</p>
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                  <span className="text-xs font-bold text-white/90">Income</span>
                                </div>
                                <span className="text-xs font-black text-emerald-400 tabular-nums">{currency}{payload[0].value?.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></div>
                                  <span className="text-xs font-bold text-white/90">Expenditure</span>
                                </div>
                                <span className="text-xs font-black text-rose-400 tabular-nums">{currency}{payload[1].value?.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="#10B981"
                    strokeWidth={4}
                    fill="url(#incomeGlow)"
                    animationDuration={2000}
                    filter="url(#neonGlow)"
                    activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2, shadow: '0 0 15px rgba(16,185,129,0.8)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke="#F43F5E"
                    strokeWidth={4}
                    fill="url(#expenseGlow)"
                    animationDuration={2000}
                    filter="url(#neonGlow)"
                    activeDot={{ r: 6, fill: '#F43F5E', stroke: '#fff', strokeWidth: 2, shadow: '0 0 15px rgba(244,63,94,0.8)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recurring Invoices Card - 25% */}
          <div className="min-[1025px]:col-span-1 bg-white p-6 rounded-[1.75rem] shadow-soft border border-white flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                  <RefreshCw size={16} className="text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#1E293B]">Subscriptions</h3>
                  <p className="text-[10px] text-slate-400">Recurring invoices</p>
                </div>
              </div>
              {filteredRecurringInvoices.length > 1 && (
                <div className="flex items-center gap-1">
                  {filteredRecurringInvoices.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSubscriptionIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === activeSubscriptionIndex ? 'bg-violet-500 w-3' : 'bg-slate-200'}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {filteredRecurringInvoices.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                  <RefreshCw size={24} className="text-slate-300" />
                </div>
                <p className="text-xs font-semibold text-slate-400">No active subscriptions</p>
                <p className="text-[10px] text-slate-300 mt-1">Recurring invoices will appear here</p>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden relative">
                <div
                  className="transition-transform duration-1000 ease-in-out h-full"
                  style={{ transform: `translateX(-${activeSubscriptionIndex * 100}%)` }}
                >
                  {filteredRecurringInvoices.map((sub: any, idx: number) => (
                    <div
                      key={sub.id || idx}
                      className="h-full flex flex-col"
                      style={{ minHeight: idx === 0 ? '100%' : 0 }}
                    >
                      {/* Premium Badge */}
                      <div className="flex items-center gap-2 mb-4">
                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-100 to-amber-50 text-amber-700 text-[9px] font-bold uppercase tracking-wider border border-amber-200/50">
                          Premium
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                          sub.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                            : 'bg-slate-50 text-slate-500 border border-slate-100'
                        }`}>
                          {sub.status || 'Active'}
                        </span>
                      </div>

                      {/* Customer Info */}
                      <div className="mb-4">
                        <p className="text-base font-bold text-[#1E293B] truncate">{sub.customerName || 'Unknown Customer'}</p>
                        {sub.customerEmail && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{sub.customerEmail}</p>
                        )}
                      </div>

                      {/* Details Grid */}
                      <div className="space-y-3 flex-1">
                        <div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-violet-500" />
                            <span className="text-[11px] text-slate-500 font-medium">Frequency</span>
                          </div>
                          <span className="text-[11px] font-bold text-[#1E293B]">{sub.frequency || 'Monthly'}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-blue-500" />
                            <span className="text-[11px] text-slate-500 font-medium">Next Invoice</span>
                          </div>
                          <span className="text-[11px] font-bold text-[#1E293B]">
                            {sub.nextRunDate ? format(new Date(sub.nextRunDate), 'MMM dd, yyyy') : 'N/A'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50/80 rounded-xl">
                          <div className="flex items-center gap-2">
                            <DollarSign size={14} className="text-emerald-500" />
                            <span className="text-[11px] text-slate-500 font-medium">Amount</span>
                          </div>
                          <span className="text-[11px] font-bold text-[#1E293B]">{currency}{(sub.total || sub.totalAmount || 0).toLocaleString()}</span>
                        </div>

                        {sub.description && (
                          <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-100/50">
                            <p className="text-[10px] text-slate-400 font-medium mb-1">Description</p>
                            <p className="text-[11px] text-slate-600 line-clamp-2">{sub.description}</p>
                          </div>
                        )}
                      </div>

                      {/* View Full Details */}
                      <button
                        onClick={() => navigate('/sales-flow/recurring-invoices', { state: { id: sub.id } })}
                        className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[11px] font-bold hover:shadow-lg hover:shadow-violet-500/25 transition-all flex items-center justify-center gap-2"
                      >
                        <Eye size={14} />
                        View Full Details
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Auto-slide indicator */}
            {filteredRecurringInvoices.length > 1 && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-medium">
                  {activeSubscriptionIndex + 1} of {filteredRecurringInvoices.length}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveSubscriptionIndex(prev => prev === 0 ? filteredRecurringInvoices.length - 1 : prev - 1)}
                    className="w-6 h-6 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400"
                  >
                    <ChevronRight size={12} className="rotate-180" />
                  </button>
                  <button
                    onClick={() => setActiveSubscriptionIndex(prev => (prev + 1) % filteredRecurringInvoices.length)}
                    className="w-6 h-6 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 min-[1025px]:grid-cols-2 gap-8 mb-10 shrink-0">
          {/* Redesigned Cash flow Card - Mimicking Conversion Rate Style */}
          <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-white/40">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                  <Activity size={16} className="text-slate-900" />
                </div>
                <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">Cash flow</h3>
              </div>
              <button 
                onClick={() => navigate('/revenue/intel')}
                className="text-[13px] font-bold text-[#8b5cf6] hover:text-[#7c3aed] transition-colors"
              >
                See More
              </button>
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
              {/* Left: Donut Chart */}
              <div className="relative w-48 h-48 flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cashFlowSummary.data}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={10}
                      startAngle={90}
                      endAngle={450}
                    >
                      {cashFlowSummary.data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">100%</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Breakdown</span>
                </div>
              </div>

              {/* Right: Detailed List */}
              <div className="flex-1 w-full space-y-5">
                {cashFlowSummary.data.map((item, idx) => (
                  <div key={idx} className="group">
                    <div className="flex items-center justify-between py-1">
                      <div className="flex items-start gap-4">
                        {/* Bullet */}
                        <div className="mt-1.5 w-3 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        
                        <div>
                          <p className="text-[14px] font-bold text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                            {item.name}
                          </p>
                          <p className="text-[11px] font-bold text-slate-400 mt-0.5 tracking-tight uppercase">
                            {currency}{formatKPIValue(item.value)} Volume
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-lg font-black text-slate-900 tabular-nums">
                          {Math.round(item.percentage)}%
                        </span>
                      </div>
                    </div>
                    {/* Divider */}
                    {idx < cashFlowSummary.data.length - 1 && (
                      <div className="mt-4 border-b border-slate-100/80" />
                    )}
                  </div>
                ))}
                
                {/* Total Summary Footer */}
                <div className="pt-4 mt-2 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Grand Total</span>
                  <span className="text-lg font-black text-indigo-600">{currency}{formatKPIValue(cashFlowSummary.total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Redesigned POS performance Card - Mimicking "Deals" Style */}
          <div className="bg-white p-8 rounded-[2rem] shadow-soft border border-white/40 flex flex-col h-full">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Deals</h3>
              <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-indigo-300 transition-all cursor-pointer group">
                <select
                  value={posTimePeriod || 'Last week'}
                  onChange={(e) => setPosTimePeriod(e.target.value)}
                  className="bg-transparent border-none text-[13px] font-bold text-slate-600 outline-none cursor-pointer appearance-none pr-2"
                >
                  <option value="Last week">Jan - Dec 2026</option>
                  <option value="Last month">This Month</option>
                  <option value="Last year">Full Year</option>
                </select>
                <Calendar size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
              </div>
            </div>

            <div className="mb-8">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Total:</p>
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-black text-slate-900 tabular-nums tracking-tighter">
                  {currency}{formatKPIValue(posPerformanceData.total)}
                </span>
                <span className={`text-[13px] font-black px-2 py-0.5 rounded-full ${posPerformanceData.change >= 0 ? 'text-emerald-500 bg-emerald-50/50' : 'text-rose-500 bg-rose-50/50'}`}>
                  {posPerformanceData.change >= 0 ? '+' : ''}{posPerformanceData.change}%
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-[220px] w-full mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={posPerformanceData.data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dealsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="0" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                    dy={15}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
                    tickFormatter={(value) => `${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="relative">
                            <div className="bg-[#4f46e5] px-4 py-2 rounded-xl shadow-xl border border-white/20 animate-in zoom-in-95 duration-200">
                              <p className="text-white text-[13px] font-black tabular-nums">
                                {currency}{payload[0].value?.toLocaleString()}
                              </p>
                            </div>
                            {/* Tooltip arrow/pointer */}
                            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#4f46e5] rotate-45" />
                          </div>
                        );
                      }
                      return null;
                    }}
                    cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                    offset={-40}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#4f46e5"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#dealsGradient)"
                    activeDot={{ r: 7, fill: '#4f46e5', stroke: '#fff', strokeWidth: 3, shadow: '0 0 10px rgba(79,70,229,0.5)' }}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>




      </div>
    </div>
  );
};

// Calculator button component
const CalculatorButton: React.FC = () => {
  const { setIsOpen } = usePricingCalculator();
  return (
    <button
      onClick={() => setIsOpen(true)}
      className="p-2.5 rounded-2xl text-violet-600 hover:bg-slate-200/50 transition-colors"
      title="Pricing Calculator"
    >
      <Calculator size={24} />
    </button>
  );
};

export default Dashboard;
