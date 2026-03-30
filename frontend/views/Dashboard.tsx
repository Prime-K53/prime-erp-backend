import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, ReferenceLine, Cursor
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

// Recurring Invoices Card Component with Fixed Dimensions and Auto-Slide
const RecurringInvoicesCard: React.FC<{ recurringInvoices: any[], currency: string, navigate: any }> = ({ recurringInvoices, currency, navigate }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // Auto-slide every 4 seconds
  useEffect(() => {
    if (recurringInvoices.length <= 1) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % recurringInvoices.length);
        setIsAnimating(false);
      }, 300);
    }, 4000);

    return () => clearInterval(interval);
  }, [recurringInvoices.length]);

  // Manual navigation
  const goToSlide = (index: number) => {
    if (index === currentIndex || recurringInvoices.length <= 1) return;
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentIndex(index);
      setIsAnimating(false);
    }, 300);
  };

  if (!recurringInvoices || recurringInvoices.length === 0) {
    return (
      <div className="bg-white rounded-[1.5rem] shadow-soft border border-white p-6 h-[350px] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-[#1E293B]">Recurring Invoices</h3>
            <p className="text-xs text-slate-400 mt-0.5">Automated billing • Active</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <RefreshCw size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium">No recurring invoices</p>
            <p className="text-xs text-slate-400 mt-1">Set up automated billing</p>
          </div>
        </div>
      </div>
    );
  }

  const currentInvoice = recurringInvoices[currentIndex];

  return (
    <div className="bg-white rounded-[1.5rem] shadow-soft border border-white p-6 h-[350px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-[#1E293B]">Recurring Invoices</h3>
          <p className="text-xs text-slate-400 mt-0.5">Automated billing • Active</p>
        </div>
        <button
          onClick={() => navigate('/sales-flow/recurring-invoices')}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
        >
          Manage <ChevronRight size={14} />
        </button>
      </div>

      {/* Slide Container with Fixed Height */}
      <div className="flex-1 relative overflow-hidden">
        <div
          className={`transition-all duration-300 ease-in-out transform ${
            isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          {/* Invoice Content */}
          <div className="h-full flex flex-col">
            {/* Customer Info */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-[#1E293B] truncate">
                {currentInvoice.customerName || 'Unknown Customer'}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {currentInvoice.description || 'Recurring service'}
              </p>
            </div>

            {/* Amount and Frequency */}
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-[#1E293B]">
                  {currency}{(currentInvoice.totalAmount || currentInvoice.amount || 0).toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {currentInvoice.frequency || 'Monthly'} • {currentInvoice.interval || '30'} days
                </div>
              </div>

              {/* Next Due Date */}
              <div className="bg-blue-50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-600 font-medium">Next Due</span>
                  <span className="text-xs font-bold text-blue-700">
                    {currentInvoice.nextDueDate ? 
                      new Date(currentInvoice.nextDueDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      }) : 
                      'Not set'
                    }
                  </span>
                </div>
              </div>

              {/* Status Badge */}
              <div className="flex justify-center">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                  currentInvoice.status === 'Active' 
                    ? 'bg-green-100 text-green-700' 
                    : currentInvoice.status === 'Paused'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 text-slate-700'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    currentInvoice.status === 'Active' 
                      ? 'bg-green-500' 
                      : currentInvoice.status === 'Paused'
                      ? 'bg-amber-500'
                      : 'bg-slate-500'
                  }`}></div>
                  {currentInvoice.status || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide Indicators */}
      {recurringInvoices.length > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-4">
          {recurringInvoices.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`transition-all duration-300 ease-out ${
                index === currentIndex
                  ? 'w-8 h-2 bg-blue-600 rounded-full shadow-sm'
                  : 'w-2 h-2 bg-slate-300 rounded-full hover:bg-slate-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
        <button
          onClick={() => navigate(`/sales-flow/recurring-invoices?action=edit&id=${currentInvoice.id}`)}
          className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-2 px-3 rounded-lg transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => navigate(`/sales-flow/recurring-invoices?action=pause&id=${currentInvoice.id}`)}
          className="flex-1 text-xs font-medium text-slate-600 hover:text-slate-700 hover:bg-slate-50 py-2 px-3 rounded-lg transition-colors"
        >
          {currentInvoice.status === 'Active' ? 'Pause' : 'Resume'}
        </button>
      </div>
    </div>
  );
};

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

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [quickTaskTitle, setQuickTaskTitle] = useState<string>('');
  const [examinationQueue, setExaminationQueue] = useState<any[]>([]);

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

    return [...pendingJobs, ...activeJobs, ...activeTasks, ...activeExams]
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

  // Performance Chart Data - Monthly Income vs Expenditure
  const performanceData = useMemo(() => {
    const months = 6;
    const now = new Date();
    const data: { month: string; income: number; expenditure: number }[] = [];

    for (let i = months - 1; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

      // Calculate monthly income from sales and customer payments
      const monthlyIncome = (filteredSales || [])
        .filter((s: any) => {
          const d = new Date(s.date || s.createdAt);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((sum: number, s: any) => sum + (s.total || s.totalAmount || 0), 0)
        +
        (customerPayments || [])
          .filter((p: any) => {
            const d = new Date(p.date || p.createdAt);
            return d >= monthStart && d <= monthEnd;
          })
          .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      // Calculate monthly expenditure from expenses and supplier payments
      const monthlyExpenditure = (expenses || [])
        .filter((e: any) => {
          const d = new Date(e.date || e.createdAt);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
        +
        (supplierPayments || [])
          .filter((sp: any) => {
            const d = new Date(sp.date || sp.createdAt);
            return d >= monthStart && d <= monthEnd;
          })
          .reduce((sum: number, sp: any) => sum + (sp.amount || 0), 0);

      data.push({
        month: format(targetDate, 'MMM'),
        income: Math.round(monthlyIncome),
        expenditure: Math.round(monthlyExpenditure)
      });
    }

    return data;
  }, [filteredSales, customerPayments, expenses, supplierPayments]);

  // Cash Flow Breakdown - Invoices, POS, Examination
  const cashFlowData = useMemo(() => {
    // Invoices total from filtered invoices
    const invoicesTotal = (filteredInvoices || []).reduce((sum: number, inv: any) => sum + (inv.totalAmount || 0), 0);

    // POS total from sales (assuming sales are POS transactions)
    const posTotal = (filteredSales || []).reduce((sum: number, sale: any) => sum + (sale.total || sale.totalAmount || 0), 0);

    // Examination total from examination queue (if available)
    const examinationTotal = (examinationQueue || []).reduce((sum: number, exam: any) => {
      // Assuming examination has an amount or total field
      return sum + (exam.total_amount || exam.amount || 0);
    }, 0);

    const grandTotal = invoicesTotal + posTotal + examinationTotal;

    // Calculate percentages
    const invoicesPercent = grandTotal > 0 ? Math.round((invoicesTotal / grandTotal) * 100) : 0;
    const posPercent = grandTotal > 0 ? Math.round((posTotal / grandTotal) * 100) : 0;
    const examinationPercent = grandTotal > 0 ? Math.round((examinationTotal / grandTotal) * 100) : 0;

    return {
      invoices: { amount: invoicesTotal, percent: invoicesPercent },
      pos: { amount: posTotal, percent: posPercent },
      examination: { amount: examinationTotal, percent: examinationPercent },
      grandTotal
    };
  }, [filteredInvoices, filteredSales, examinationQueue]);

  // POS Performance Data - monthly POS sales for area chart
  const posPerformanceData = useMemo(() => {
    const now = new Date();
    const months = 6;
    const data: Array<{ month: string; sales: number }> = [];

    for (let i = months - 1; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

      const monthlySales = (filteredSales || [])
        .filter((s: any) => {
          const d = new Date(s.date || s.createdAt);
          return d >= monthStart && d <= monthEnd;
        })
        .reduce((sum: number, s: any) => sum + (s.total || s.totalAmount || 0), 0);

      data.push({
        month: format(targetDate, 'MMM'),
        sales: Math.round(monthlySales)
      });
    }

    const totalSales = data.reduce((sum, d) => sum + d.sales, 0);
    const half = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, half).reduce((s, d) => s + d.sales, 0);
    const secondHalf = data.slice(half).reduce((s, d) => s + d.sales, 0);
    const change = firstHalf > 0 ? ((secondHalf - firstHalf) / firstHalf) * 100 : (secondHalf > 0 ? 100 : 0);

    return { data, totalSales, change };
  }, [filteredSales]);

  const kpiData = useMemo(() => {
    const curRev = verifiedDashboardMetrics.currentMonth.revenue;
    const prevRev = verifiedDashboardMetrics.previousMonth.revenue;
    const netProfit = verifiedDashboardMetrics.currentMonth.netProfit;
    const prevNetProfit = verifiedDashboardMetrics.previousMonth.netProfit;

    const netProfitChange = prevNetProfit !== 0 ? ((netProfit - prevNetProfit) / Math.abs(prevNetProfit)) * 100 : (netProfit > 0 ? 100 : 0);
    const netProfitChangeStr = netProfitChange >= 0 ? `+${netProfitChange.toFixed(0)}%` : `${netProfitChange.toFixed(0)}%`;

    const revChange = prevRev > 0 ? ((curRev - prevRev) / prevRev) * 100 : 0;
    const revChangeStr = revChange >= 0 ? `+${revChange.toFixed(0)}%` : `${revChange.toFixed(0)}%`;

    const unpaidTotal = verifiedDashboardMetrics.receivables;
    const todayCollection = verifiedDashboardMetrics.todayCollection;
    const yesterdayCollection = verifiedDashboardMetrics.yesterdayCollection || 0;

    const totalInvoices = (filteredInvoices || []).reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const receivablesPercentage = totalInvoices > 0 ? Math.min(Math.round((unpaidTotal / totalInvoices) * 100), 100) : 0;

    // Dynamic monthly target based on current revenue trends
    const monthlyTarget = curRev > 0 ? curRev / 30 : 
      ((filteredSales || []).reduce((sum, s) => sum + (s.total || s.totalAmount || 0), 0) / 30) || 10000;
    const collectionPercentage = monthlyTarget > 0 ? Math.min(Math.round((todayCollection / monthlyTarget) * 100), 100) : 0;
    
    // Calculate today's collection change
    const todayCollectionChange = yesterdayCollection > 0 ? ((todayCollection - yesterdayCollection) / yesterdayCollection) * 100 : 0;
    const todayCollectionChangeStr = todayCollectionChange >= 0 ? `+${todayCollectionChange.toFixed(0)}%` : `${todayCollectionChange.toFixed(0)}%`;

    const totalActiveJobs = (filteredWorkOrders || [])
      .filter((wo: any) => ['Pending', 'Scheduled', 'In Progress', 'QA'].includes(wo.status))
      .length + (examinationQueue || []).filter((e: any) => ['Calculated', 'Approved'].includes(e.status)).length;

    // Calculate previous active jobs for change comparison (based on completed jobs trend)
    const completedJobsThisMonth = (filteredWorkOrders || [])
      .filter((wo: any) => wo.status === 'Completed' && new Date(wo.updatedAt || wo.createdAt) > new Date(new Date().getFullYear(), new Date().getMonth(), 1))
      .length;
    const previousActiveJobs = Math.max(1, totalActiveJobs - completedJobsThisMonth);
    const activeJobsChange = previousActiveJobs > 0 ? ((totalActiveJobs - previousActiveJobs) / previousActiveJobs) * 100 : 0;
    const activeJobsChangeStr = activeJobsChange >= 0 ? `+${activeJobsChange.toFixed(0)}%` : `${activeJobsChange.toFixed(0)}%`;

    // Dynamic jobs capacity based on historical data or company size
    const avgMonthlyJobs = (filteredWorkOrders || []).length > 0 ? 
      Math.ceil((filteredWorkOrders || []).length / 3) : 20; // Average over 3 months, default to 20
    const jobsCapacity = Math.max(20, avgMonthlyJobs); // Minimum capacity of 20
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
        change: todayCollectionChangeStr, 
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
        change: activeJobsChangeStr, 
        icon: <Timer size={20} className="text-amber-500" />, 
        path: '/industrial/work-orders', 
        percentage: jobsPercentage || 0, 
        color: '#f59e0b' 
      },
    ];
  }, [currency, filteredWorkOrders, examinationQueue, verifiedDashboardMetrics, filteredInvoices]);

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

        {/* Performance Chart Section - 75% width */}
        <div className="flex gap-6">
          <div className="w-3/4 bg-white rounded-[1.5rem] shadow-soft border border-white p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-[#1E293B]">Performance Overview</h3>
              <p className="text-xs text-slate-400 mt-0.5">Income vs Expenditure • Last 6 months</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></span>
                <span className="text-[11px] font-semibold text-slate-500">Income</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-gradient-to-r from-rose-400 to-red-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]"></span>
                <span className="text-[11px] font-semibold text-slate-500">Expenditure</span>
              </div>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  {/* Income Gradient - Emerald to Cyan */}
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                  </linearGradient>
                  {/* Expenditure Gradient - Rose to Red */}
                  <linearGradient id="expenditureGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="50%" stopColor="#fb7185" stopOpacity={0.12} />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity={0.02} />
                  </linearGradient>
                  {/* Glow filters */}
                  <filter id="incomeGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor="#10b981" floodOpacity="0.4" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <filter id="expenditureGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor="#f43f5e" floodOpacity="0.4" result="color" />
                    <feComposite in="color" in2="blur" operator="in" result="glow" />
                    <feMerge>
                      <feMergeNode in="glow" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 500 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                  tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}K` : val}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(12px)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
                    padding: '12px 16px'
                  }}
                  labelStyle={{ fontWeight: 700, color: '#1e293b', marginBottom: 6, fontSize: 13 }}
                  itemStyle={{ fontSize: 12, fontWeight: 600, padding: '2px 0' }}
                  formatter={(value: number, name: string) => [
                    `${currency}${value.toLocaleString()}`,
                    name === 'income' ? 'Income' : 'Expenditure'
                  ]}
                  labelFormatter={(label) => `${label} Overview`}
                />
                {/* Income Area - Emerald/Cyan glow */}
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#incomeGradient)"
                  filter="url(#incomeGlow)"
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: '#10b981',
                    stroke: '#fff',
                    strokeWidth: 3,
                    filter: 'url(#incomeGlow)'
                  }}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
                {/* Expenditure Area - Rose/Red glow */}
                <Area
                  type="monotone"
                  dataKey="expenditure"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  fill="url(#expenditureGradient)"
                  filter="url(#expenditureGlow)"
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: '#f43f5e',
                    stroke: '#fff',
                    strokeWidth: 3,
                    filter: 'url(#expenditureGlow)'
                  }}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

          {/* Recurring Invoices Card - 25% width */}
          <div className="w-1/4">
            <RecurringInvoicesCard recurringInvoices={filteredRecurringInvoices} currency={currency} navigate={navigate} />
          </div>
        </div>

{/* Two-column layout: Cash Flow + POS Performance */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
  {/* Cash Flow Breakdown - Invoices, POS, Examination */}
  <div className="bg-white rounded-[1.5rem] shadow-soft border border-white p-6">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h3 className="text-base font-bold text-[#1E293B]">Cash Flow Breakdown</h3>
        <p className="text-xs text-slate-400 mt-0.5">Revenue sources • Current period</p>
      </div>
      <button
        onClick={() => navigate('/fiscal-reports/financials?type=RevenueIntelligence')}
        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
      >
        See More <ChevronRight size={14} />
      </button>
    </div>
    <div className="flex items-center gap-8">
      {/* Donut Chart - Left */}
      <div className="relative w-[180px] h-[180px] flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { name: 'Invoices', value: cashFlowData.invoices.amount, color: '#3b82f6' },
                { name: 'POS', value: cashFlowData.pos.amount, color: '#10b981' },
                { name: 'Examination', value: cashFlowData.examination.amount, color: '#8b5cf6' },
              ]}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
              animationDuration={1000}
              animationEasing="ease-out"
            >
              <Cell fill="#3b82f6" />
              <Cell fill="#10b981" />
              <Cell fill="#8b5cf6" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] font-medium text-slate-400">Total</span>
          <span className="text-lg font-bold text-[#1E293B]">100%</span>
        </div>
      </div>

      {/* Detailed List - Right */}
      <div className="flex-1">
        {/* Invoices */}
        <div className="flex items-center justify-between py-3.5">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]"></span>
            <div>
              <p className="text-[13px] font-semibold text-[#1E293B]">Invoices</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                <span className="font-semibold text-slate-500">{currency}{cashFlowData.invoices.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> Volume
              </p>
            </div>
          </div>
          <span className="text-base font-bold text-[#1E293B]">{cashFlowData.invoices.percent}%</span>
        </div>
        <div className="border-t border-slate-100"></div>

        {/* POS */}
        <div className="flex items-center justify-between py-3.5">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"></span>
            <div>
              <p className="text-[13px] font-semibold text-[#1E293B]">POS</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                <span className="font-semibold text-slate-500">{currency}{cashFlowData.pos.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> Volume
              </p>
            </div>
          </div>
          <span className="text-base font-bold text-[#1E293B]">{cashFlowData.pos.percent}%</span>
        </div>
        <div className="border-t border-slate-100"></div>

        {/* Examination */}
        <div className="flex items-center justify-between py-3.5">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_6px_rgba(139,92,246,0.5)]"></span>
            <div>
              <p className="text-[13px] font-semibold text-[#1E293B]">Examination</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                <span className="font-semibold text-slate-500">{currency}{cashFlowData.examination.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> Volume
              </p>
            </div>
          </div>
          <span className="text-base font-bold text-[#1E293B]">{cashFlowData.examination.percent}%</span>
        </div>
        <div className="border-t border-slate-100"></div>

        {/* Grand Total Footer */}
        <div className="flex items-center justify-between pt-4 mt-1">
          <p className="text-[13px] font-bold text-slate-500">Grand Total</p>
          <span className="text-lg font-bold text-[#1E293B]">
            {currency}{cashFlowData.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </div>
  </div>

  {/* POS Performance Chart */}
  <div className="bg-white rounded-[1.5rem] shadow-soft border border-white p-6">
    <div className="flex items-center justify-between mb-6">
      <div>
        <h3 className="text-base font-bold text-[#1E293B]">Sales</h3>
        <p className="text-xs text-slate-400 mt-0.5">POS performance • Last 6 months</p>
      </div>
      <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-600 transition-colors">
        <Calendar size={13} />
        <span>Last 6 months</span>
        <ChevronRight size={12} className="rotate-90" />
      </button>
    </div>

    {/* Metrics */}
    <div className="mb-4">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total:</p>
      <div className="flex items-baseline gap-3 mt-1">
        <span className="text-3xl font-extrabold text-[#1E293B]">
          {currency}{posPerformanceData.totalSales.toLocaleString()}
        </span>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
          posPerformanceData.change >= 0
            ? 'bg-emerald-50 text-emerald-600'
            : 'bg-red-50 text-red-600'
        }`}
        >
          {posPerformanceData.change >= 0 ? '+' : ''}{posPerformanceData.change.toFixed(1)}%
        </span>
      </div>
    </div>

    {/* Area Chart */}
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={posPerformanceData.data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="posGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
            tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="relative">
                  <div className="bg-[#4f46e5] text-white rounded-xl px-4 py-2.5 shadow-lg shadow-indigo-500/30">
                    <p className="text-[10px] font-medium text-indigo-200 mb-0.5">{label}</p>
                    <p className="text-sm font-bold">{currency}{payload[0].value?.toLocaleString()}</p>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-[#4f46e5] rotate-45"></div>
                </div>
              );
            }}
            cursor={{ stroke: '#4f46e5', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="sales"
            stroke="#4f46e5"
            strokeWidth={2.5}
            fill="url(#posGradient)"
            dot={false}
            activeDot={{
              r: 6,
              fill: '#4f46e5',
              stroke: '#fff',
              strokeWidth: 3
            }}
            animationDuration={1200}
            animationEasing="ease-out"
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
