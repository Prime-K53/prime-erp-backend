import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Landmark, Plus, Edit2, Trash2, Search, X, CheckCircle, FolderTree, AlertCircle, History, BarChart3, ArrowRight, ExternalLink } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { Account, AccountType, LedgerEntry } from '../../types';
import { format, parseISO } from 'date-fns';

const ChartOfAccounts: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { accounts, ledger, addAccount, updateAccount, deleteAccount, checkPermission, notify, companyConfig } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<AccountType | 'All'>('All');
  const currency = companyConfig?.currencySymbol || '$';
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<Account>>({
    code: '',
    name: '',
    type: 'Asset'
  });

  // Drilldown State
  const [drilldownAccount, setDrilldownAccount] = useState<Account | null>(null);

  // Handle incoming account drilldown from other modules
  useEffect(() => {
    if (location.state?.accountId && accounts.length > 0) {
      const account = accounts.find(a => a.id === location.state.accountId || a.code === location.state.accountId);
      if (account) {
        setDrilldownAccount(account);
        // Clear state so it doesn't reopen on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, accounts, navigate, location.pathname]);

  const canEdit = checkPermission('accounts.edit');

  const filteredAccounts = accounts.filter(a => 
    (filterType === 'All' || a.type === filterType) &&
    (a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.code.includes(searchTerm))
  ).sort((a, b) => a.code.localeCompare(b.code));

  const accountEntries = useMemo(() => {
    if (!drilldownAccount) return [];
    return (ledger || []).filter(e => 
      e.debitAccountId === drilldownAccount.id || 
      e.debitAccountId === drilldownAccount.code ||
      e.creditAccountId === drilldownAccount.id || 
      e.creditAccountId === drilldownAccount.code
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ledger, drilldownAccount]);

  const currentBalance = useMemo(() => {
    if (!drilldownAccount) return 0;
    const isAssetOrExpense = drilldownAccount.type === 'Asset' || drilldownAccount.type === 'Expense';
    
    return accountEntries.reduce((sum, entry) => {
        const isDebit = entry.debitAccountId === drilldownAccount.id || entry.debitAccountId === drilldownAccount.code;
        const isCredit = entry.creditAccountId === drilldownAccount.id || entry.creditAccountId === drilldownAccount.code;
        
        if (isAssetOrExpense) {
            if (isDebit) return sum + entry.amount;
            if (isCredit) return sum - entry.amount;
        } else {
            if (isCredit) return sum + entry.amount;
            if (isDebit) return sum - entry.amount;
        }
        return sum;
    }, 0);
  }, [accountEntries, drilldownAccount]);

  const handleOpenModal = (account?: Account) => {
    if (!canEdit) return;
    if (account) {
      setEditingId(account.id);
      setFormData({ code: account.code, name: account.name, type: account.type });
    } else {
      setEditingId(null);
      setFormData({ code: '', name: '', type: 'Asset' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isSubmitting) return;
    if (!formData.code || !formData.name) {
      notify("Please fill in both Code and Name", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        const accountData: Account = {
          id: editingId,
          code: formData.code,
          name: formData.name,
          type: formData.type as AccountType
        };
        await updateAccount(accountData);
        notify("Account updated successfully", "success");
      } else {
        // Check for duplicate code
        if (accounts.some(a => a.code === formData.code)) {
            notify("Account code already exists", "error");
            setIsSubmitting(false);
            return;
        }
        
        const accountData: Account = {
          id: `ACC-${Date.now()}`,
          code: formData.code,
          name: formData.name,
          type: formData.type as AccountType
        };
        await addAccount(accountData);
        notify("Account created successfully", "success");
      }
      
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      notify("Error saving account", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    if (!canEdit) return;
    if (window.confirm("Are you sure? Deleting an account with transaction history will cause reporting errors.")) {
      deleteAccount(id);
      notify("Account deleted", "info");
    }
  };

  const getTypeColor = (type: AccountType) => {
    switch (type) {
      case 'Asset': return 'bg-blue-100 text-blue-800';
      case 'Liability': return 'bg-red-100 text-red-800';
      case 'Equity': return 'bg-purple-100 text-purple-800';
      case 'Revenue': return 'bg-emerald-100 text-emerald-800';
      case 'Expense': return 'bg-amber-100 text-amber-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col relative">
      
      {/* Add/Edit Modal */}
      {isModalOpen && canEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fadeIn border border-slate-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-xl font-bold text-slate-900">
                {editingId ? 'Edit Account' : 'Add New Account'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Account Type</label>
                 <select 
                   className="w-full p-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                   value={formData.type}
                   onChange={e => setFormData({...formData, type: e.target.value as AccountType})}
                 >
                   <option value="Asset">Asset (1000s)</option>
                   <option value="Liability">Liability (2000s)</option>
                   <option value="Equity">Equity (3000s)</option>
                   <option value="Revenue">Revenue (4000s)</option>
                   <option value="Expense">Expense (5000-6000s)</option>
                 </select>
               </div>
               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Account Code</label>
                 <input 
                   type="text" required
                   className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-mono font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                   placeholder="e.g. 1050"
                   value={formData.code}
                   onChange={e => setFormData({...formData, code: e.target.value})}
                 />
                 <p className="text-[10px] text-slate-400 mt-1">Unique identifier for the ledger.</p>
               </div>
               <div>
                 <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Account Name</label>
                 <input 
                   type="text" required
                   className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                   placeholder="e.g. Office Supplies"
                   value={formData.name}
                   onChange={e => setFormData({...formData, name: e.target.value})}
                 />
               </div>
               <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 mt-4 flex items-center justify-center gap-2 shadow-lg shadow-blue-100 disabled:opacity-50"
               >
                 {isSubmitting ? "Saving..." : <><CheckCircle size={18} /> Save Account</>}
               </button>
            </form>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2 tracking-tight uppercase">
            <Landmark className="text-blue-600" size={24}/> Chart of Accounts
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage the structure of your financial records</p>
        </div>
        {canEdit && (
            <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold uppercase text-[11px] tracking-widest shadow-lg shadow-blue-100 transition-all active:scale-95">
              <Plus size={16}/> Add Account
            </button>
        )}
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-sm border border-white/60 flex flex-col min-h-0 flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-200/60 flex flex-col md:flex-row gap-4 justify-between bg-slate-50/30">
           <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
             {['All', 'Asset', 'Liability', 'Equity', 'Revenue', 'Expense'].map(type => (
               <button 
                 key={type}
                 onClick={() => setFilterType(type as any)}
                 className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full border transition-all whitespace-nowrap ${filterType === type ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
               >
                 {type}
               </button>
             ))}
           </div>
           <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search accounts..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/50"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
           </div>
        </div>

        <div className="overflow-y-auto flex-1 custom-scrollbar">
           <table className="w-full text-left text-xs">
             <thead className="bg-slate-50/80 backdrop-blur text-slate-500 font-bold border-b border-slate-200/60 sticky top-0 z-10">
               <tr>
                 <th className="px-6 py-4 w-32 uppercase tracking-widest text-[9px]">Code</th>
                 <th className="px-6 py-4 uppercase tracking-widest text-[9px]">Account Name</th>
                 <th className="px-6 py-4 uppercase tracking-widest text-[9px]">Type</th>
                 <th className="px-6 py-4 text-right uppercase tracking-widest text-[9px]">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-100/50">
               {filteredAccounts.map(acc => (
                 <tr key={acc.id} className="hover:bg-blue-50/30 transition-colors group">
                   <td className="px-6 py-4 font-mono font-bold text-slate-600">{acc.code}</td>
                   <td className="px-6 py-4 font-bold text-slate-900 flex items-center gap-3">
                      <div className="p-1.5 bg-slate-50 text-slate-400 rounded-lg group-hover:text-blue-500 group-hover:bg-white transition-colors">
                        <FolderTree size={14}/>
                      </div>
                      {acc.name}
                   </td>
                   <td className="px-6 py-4">
                     <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getTypeColor(acc.type)}`}>
                       {acc.type}
                     </span>
                   </td>
                   <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setDrilldownAccount(acc)}
                            className="p-2 text-slate-400 hover:text-emerald-600 bg-white border border-slate-100 rounded-lg shadow-sm transition-all"
                            title="View Ledger"
                          >
                            <History size={14}/>
                          </button>
                          {canEdit && (
                            <>
                              <button onClick={() => handleOpenModal(acc)} className="p-2 text-slate-400 hover:text-blue-600 bg-white border border-slate-100 rounded-lg shadow-sm transition-all">
                                <Edit2 size={14}/>
                              </button>
                              <button onClick={() => handleDelete(acc.id)} className="p-2 text-slate-400 hover:text-red-600 bg-white border border-slate-100 rounded-lg shadow-sm transition-all">
                                <Trash2 size={14}/>
                              </button>
                            </>
                          )}
                      </div>
                   </td>
                 </tr>
               ))}
               {filteredAccounts.length === 0 && (
                 <tr><td colSpan={4} className="p-12 text-center text-slate-400 italic">No accounts found.</td></tr>
               )}
             </tbody>
           </table>
        </div>
      </div>

      {/* Account Ledger Drilldown Slide-over */}
      {drilldownAccount && (
        <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setDrilldownAccount(null)} />
            <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 relative">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                    <div>
                        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter flex items-center gap-2">
                          <History className="text-emerald-500" size={20}/>
                          Account Ledger: {drilldownAccount.name}
                        </h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Source: General Ledger • Code: {drilldownAccount.code}</p>
                    </div>
                    <button onClick={() => setDrilldownAccount(null)} className="p-2 hover:bg-white rounded-full text-slate-400 transition-all border border-transparent hover:border-slate-200"><X size={24}/></button>
                </div>
                
                <div className="p-6 grid grid-cols-2 gap-4 bg-white border-b border-slate-100 shrink-0">
                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Current Balance</p>
                        <p className="text-2xl font-black text-blue-900 finance-nums">{currency}{currentBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Transactions</p>
                        <p className="text-2xl font-black text-slate-900 finance-nums">{accountEntries.length}</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="flex items-center justify-between mb-4">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 size={14} className="text-blue-500"/> Transaction History
                      </label>
                      <span className="text-[9px] font-black bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase">Live Data</span>
                    </div>

                    <div className="space-y-3">
                        {accountEntries.map(entry => (
                            <div key={entry.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-blue-200 transition-all group">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <div className="text-[11px] font-bold text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-2">
                                            {entry.description}
                                            {entry.referenceId && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const isPayment = entry.referenceId?.startsWith('RCP') || entry.referenceId?.startsWith('PAY');
                                                        const isInvoice = entry.referenceId?.startsWith('INV');
                                                        if (isPayment) navigate('/sales-flow/payments', { state: { paymentId: entry.referenceId } });
                                                        else if (isInvoice) navigate('/sales-flow/invoices', { state: { invoiceId: entry.referenceId } });
                                                    }}
                                                    className="p-1 hover:bg-blue-50 text-blue-400 hover:text-blue-600 rounded transition-colors"
                                                    title="View Source Transaction"
                                                >
                                                    <ExternalLink size={10} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                                            {format(parseISO(entry.date), 'MMM dd, yyyy')} • Ref: {entry.referenceId || 'N/A'}
                                            {entry.customerId && (
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate('/sales-flow/customers', { state: { customerId: entry.customerId } });
                                                    }}
                                                    className="px-1.5 py-0.5 bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-600 rounded text-[9px] font-bold uppercase transition-colors"
                                                >
                                                    View Customer
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-black text-slate-900 finance-nums">{currency}{entry.amount.toLocaleString()}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className={`p-2 rounded-xl border ${entry.debitAccountId === drilldownAccount.id || entry.debitAccountId === drilldownAccount.code ? 'bg-blue-50 border-blue-100' : 'bg-slate-50/50 border-slate-100/50'}`}>
                                        <div className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Debit</div>
                                        <div className={`text-[10px] font-black truncate ${entry.debitAccountId === drilldownAccount.id || entry.debitAccountId === drilldownAccount.code ? 'text-blue-700' : 'text-slate-400'}`}>
                                            {accounts.find(a => a.id === entry.debitAccountId || a.code === entry.debitAccountId)?.name || entry.debitAccountId}
                                        </div>
                                    </div>
                                    <div className={`p-2 rounded-xl border ${entry.creditAccountId === drilldownAccount.id || entry.creditAccountId === drilldownAccount.code ? 'bg-rose-50 border-rose-100' : 'bg-slate-50/50 border-slate-100/50'}`}>
                                        <div className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Credit</div>
                                        <div className={`text-[10px] font-black truncate ${entry.creditAccountId === drilldownAccount.id || entry.creditAccountId === drilldownAccount.code ? 'text-rose-700' : 'text-slate-400'}`}>
                                            {accounts.find(a => a.id === entry.creditAccountId || a.code === entry.creditAccountId)?.name || entry.creditAccountId}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {accountEntries.length === 0 && (
                            <div className="p-12 text-center text-slate-400 italic font-medium">No ledger entries found for this account.</div>
                        )}
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
                    <button className="w-full py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-center gap-2 text-[12px] uppercase tracking-widest">
                        <ExternalLink size={14}/> Export Full Report
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ChartOfAccounts;
