import React, { useState, useEffect } from 'react';
import { X, Save, User, MapPin, CreditCard, FileText, Building, Truck, Plus, Trash2, Wallet, Users, AlertTriangle, CheckCircle2, Factory } from 'lucide-react';
import { Customer } from '../../../types';
import { getDefaultPaymentTermsForSegment } from '../../../utils/helpers';
import { useData } from '../../../context/DataContext';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: Customer) => Promise<void>;
  customer?: Customer;
}

export const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, onSave, customer }) => {
  const [formData, setFormData] = useState<any>({
    name: '',
    phone: '',
    address: '',
    city: '',
    billingAddress: '',
    shippingAddress: '',
    balance: 0,
    walletBalance: 0,
    creditLimit: 0,
    notes: '',
    subAccounts: [],
    segment: 'Individual',
    paymentTerms: getDefaultPaymentTermsForSegment('Individual'),
    assignedSalesperson: '',
    creditHold: false,
    tags: [],
    avgPaymentDays: 0,
    leadSource: '',
    pipelineStage: 'New',
    leadScore: 0,
    nextFollowUpDate: '',
    estimatedDealValue: 0
  });

  const [useBillingForShipping, setUseBillingForShipping] = useState(true);
  const [activeTab, setActiveTab] = useState<'Address' | 'Payment' | 'Additional' | 'Branches'>('Address');

  useEffect(() => {
    if (customer) {
      setFormData({
        ...customer,
        name: customer.name || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        billingAddress: customer.billingAddress || '',
        shippingAddress: customer.shippingAddress || '',
        balance: customer.balance ?? 0,
        walletBalance: customer.walletBalance ?? 0,
        creditLimit: customer.creditLimit ?? 0,
        notes: customer.notes || '',
        subAccounts: customer.subAccounts || [],
        segment: (customer.segment as any) || 'Individual',
        paymentTerms: customer.paymentTerms || getDefaultPaymentTermsForSegment(customer.segment || 'Individual'),
        assignedSalesperson: customer.assignedSalesperson || '',
        creditHold: Boolean(customer.creditHold),
        tags: customer.tags || [],
        avgPaymentDays: customer.avgPaymentDays ?? 0,
        leadSource: (customer as any).leadSource || '',
        pipelineStage: (customer as any).pipelineStage || 'New',
        leadScore: (customer as any).leadScore ?? 0,
        nextFollowUpDate: (customer as any).nextFollowUpDate || '',
        estimatedDealValue: (customer as any).estimatedDealValue ?? 0
      });
      setUseBillingForShipping(customer.billingAddress === customer.shippingAddress);
    } else {
      setFormData({
        name: '', phone: '', address: '', city: '', billingAddress: '', shippingAddress: '',
        balance: 0, walletBalance: 0, creditLimit: 0, notes: '',
        paymentTerms: getDefaultPaymentTermsForSegment('Individual'), subAccounts: [], segment: 'Individual', assignedSalesperson: '',
        creditHold: false, tags: [], avgPaymentDays: 0, leadSource: '', pipelineStage: 'New', leadScore: 0, nextFollowUpDate: '', estimatedDealValue: 0
      });
      setUseBillingForShipping(true);
    }
  }, [customer, isOpen]);

  const { invoices, companyConfig } = useData();

  const calcOutstanding = (custName: string | undefined) => {
    if (!custName) return 0;
    const invs = (invoices || []).filter((inv: any) => inv.customerName === custName && inv.status !== 'Paid' && inv.status !== 'Cancelled');
    const outstanding = invs.reduce((sum: number, inv: any) => sum + ((inv.totalAmount || 0) - (inv.paidAmount || 0)), 0);
    return outstanding;
  };

  const outstandingBalance = calcOutstanding(formData.name || customer?.name);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave = { ...formData };
    if (useBillingForShipping) dataToSave.shippingAddress = dataToSave.billingAddress;
    
    // Ensure customers always get a policy-aligned default when terms are empty.
    if (!dataToSave.paymentTerms) {
      dataToSave.paymentTerms = getDefaultPaymentTermsForSegment(dataToSave.segment || 'Individual');
    }
    
    await onSave(dataToSave as Customer);
    onClose();
  };

  const handleAddSubAccount = () => {
    setFormData(prev => ({
      ...prev,
      subAccounts: [...(prev.subAccounts || []), { id: `SUB-${Date.now()}`, name: '', balance: 0, walletBalance: 0, status: 'Active' }]
    }));
  };

  const handleRemoveSubAccount = (id: string) => {
    setFormData(prev => ({ ...prev, subAccounts: (prev.subAccounts || []).filter(s => s.id !== id) }));
  };

  const handleSubAccountChange = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      subAccounts: (prev.subAccounts || []).map(s => s.id === id ? { ...s, [field]: value } : s)
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      if (name === 'segment') {
        // When segment changes, update payment terms based on the new segment
        const newSegment = value as 'Individual' | 'School Account' | 'Institution' | 'Government';
        const newPaymentTerms = getDefaultPaymentTermsForSegment(newSegment);

        setFormData(prev => ({
          ...prev,
          [name]: newSegment,
          paymentTerms: newPaymentTerms
        }));
      } else {
        setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) : value }));
      }
    }
  };

  const SidebarItem = ({ id, label, icon: Icon }: { id: typeof activeTab, label: string, icon: any }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold transition-all rounded-lg ${
        activeTab === id 
          ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[1.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden ring-1 ring-slate-200">
        
        {/* Header */}
        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/30">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                {customer ? `Customer: ${customer.name}` : 'New Customer'}
              </h2>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-slate-100 bg-slate-50/50 p-4 space-y-1 shrink-0 overflow-y-auto">
            <SidebarItem id="Address" label="Address Info" icon={MapPin} />
            <SidebarItem id="Payment" label="Payment & Billing" icon={CreditCard} />
            <SidebarItem id="Additional" label="Additional Info" icon={FileText} />
            <SidebarItem id="Branches" label="Branches" icon={Building} />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <form id="client-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {/* Top Section - Always Visible */}
              <div className="grid grid-cols-2 gap-6 mb-8 pb-8 border-b border-slate-100">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Customer Name / Company</label>
                  <input required type="text" name="name" value={formData.name} onChange={handleChange}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Enter full legal name" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Phone Number</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="+1 (000) 000-0000" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Segment</label>
                  <select name="segment" value={formData.segment} onChange={handleChange}
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer">
                    <option value="Individual">Individual</option>
                    <option value="School Account">School Account</option>
                    <option value="Institution">Institution</option>
                    <option value="Government">Government</option>
                  </select>
                </div>
              </div>

              {activeTab === 'Address' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Billing Address</label>
                      <textarea name="billingAddress" value={formData.billingAddress} onChange={handleChange} rows={3}
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        placeholder="Enter full billing address" />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2 px-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shipping Address</label>
                        <label className="flex items-center gap-2 text-[10px] font-bold text-indigo-600 cursor-pointer">
                          <input type="checkbox" checked={useBillingForShipping} onChange={(e) => setUseBillingForShipping(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                          Same as Billing
                        </label>
                      </div>
                      {!useBillingForShipping && (
                        <textarea name="shippingAddress" value={formData.shippingAddress} onChange={handleChange} rows={3}
                          className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                          placeholder="Enter shipping destination" />
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">City / Region</label>
                        <input type="text" name="city" value={formData.city} onChange={handleChange}
                          className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="City name" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Payment' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Opening Balance</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input type="number" name="balance" value={formData.balance} onChange={handleChange}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="0.00" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Wallet Balance</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold text-sm">$</span>
                        <input type="number" name="walletBalance" value={formData.walletBalance} onChange={handleChange}
                          className="w-full bg-emerald-50/30 border border-emerald-100 rounded-lg pl-8 pr-4 py-2.5 text-[13px] font-semibold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                          placeholder="0.00" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Payment Terms</label>
                      <select name="paymentTerms" value={formData.paymentTerms} onChange={handleChange}
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer">
                        <option value="Net 7">Net 7 Days</option>
                        <option value="Net 30">Net 30 Days</option>
                        <option value="Net 365">Net 365 Days</option>
                        <option value="Due on Receipt">Due on Receipt</option>
                        <option value="Net 15">Net 15 Days</option>
                        <option value="Net 60">Net 60 Days</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Credit Limit</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                        <input type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange}
                          className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="0.00" />
                      </div>
                    </div>

                    <div className="col-span-2 p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${formData.creditHold ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-500'}`}>
                          <AlertTriangle size={18} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-700">Credit Hold</div>
                          <div className="text-[10px] text-slate-500 font-medium">Temporarily suspend all credit transactions for this client</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" name="creditHold" checked={formData.creditHold} onChange={handleChange} className="sr-only peer" />
                          <div className="w-10 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                        </label>

                        <div className="text-right">
                          <div className="text-xs text-slate-500">Outstanding</div>
                          <div className="text-sm font-bold">{(companyConfig?.currencySymbol || '$')}{outstandingBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        </div>

                        <button type="button" onClick={async () => {
                          const dataToSave = { ...formData, creditHold: !formData.creditHold };
                          try {
                            await onSave(dataToSave as Customer);
                            onClose();
                          } catch (err: any) {
                            alert('Failed to apply hold: ' + (err?.message || err));
                          }
                        }} className={`ml-2 px-3 py-1 rounded ${formData.creditHold ? 'bg-rose-500 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                          {formData.creditHold ? 'Release Hold Now' : 'Place Hold Now'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Additional' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Lead Source</label>
                        <select name="leadSource" value={formData.leadSource || ''} onChange={handleChange}
                          className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer">
                          <option value="">Not Set</option>
                          <option value="Referral">Referral</option>
                          <option value="Website">Website</option>
                          <option value="Walk-in">Walk-in</option>
                          <option value="Social Media">Social Media</option>
                          <option value="Field Sales">Field Sales</option>
                          <option value="Email Campaign">Email Campaign</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Pipeline Stage</label>
                        <select name="pipelineStage" value={formData.pipelineStage || 'New'} onChange={handleChange}
                          className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all cursor-pointer">
                          <option value="New">New</option>
                          <option value="Qualified">Qualified</option>
                          <option value="Proposal">Proposal</option>
                          <option value="Negotiation">Negotiation</option>
                          <option value="Won">Won</option>
                          <option value="Lost">Lost</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Lead Score</label>
                        <input type="number" min={0} max={100} name="leadScore" value={formData.leadScore ?? 0} onChange={handleChange}
                          className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          placeholder="0 - 100" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Next Follow-Up</label>
                        <input type="date" name="nextFollowUpDate" value={formData.nextFollowUpDate || ''} onChange={handleChange}
                          className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Estimated Deal Value</label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">$</span>
                          <input type="number" min={0} name="estimatedDealValue" value={formData.estimatedDealValue ?? 0} onChange={handleChange}
                            className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="0.00" />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Tags</label>
                      <input type="text" name="tags" value={(formData.tags || []).join(', ')}
                        onChange={(e) => setFormData(p => ({ ...p, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) }))}
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="VIP, Retail, Urgent..." />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Internal Notes</label>
                      <textarea name="notes" value={formData.notes} onChange={handleChange} rows={4}
                        className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-[13px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        placeholder="Private internal remarks..." />
                    </div>
                  </div>
                </div>
              )}


              {activeTab === 'Branches' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-700">Branch Accounts</h3>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">Manage multiple locations or sub-entities</p>
                    </div>
                    <button type="button" onClick={handleAddSubAccount}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-bold border border-indigo-100">
                      <Plus size={16} />
                      Add Branch
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {(formData.subAccounts || []).length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                        <Building size={32} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm font-bold text-slate-400">No branch accounts added yet</p>
                      </div>
                    ) : (
                      (formData.subAccounts || []).map((sub) => (
                        <div key={sub.id} className="p-4 bg-white border border-slate-200 rounded-xl group hover:border-indigo-200 transition-all relative shadow-sm">
                          <button type="button" onClick={() => handleRemoveSubAccount(sub.id)}
                            className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                            <Trash2 size={16} />
                          </button>
                          <div className="grid grid-cols-12 gap-6">
                            <div className="col-span-12">
                              <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Branch Name</label>
                              <input type="text" value={sub.name} onChange={(e) => handleSubAccountChange(sub.id, 'name', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-100 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                                placeholder="Branch / Location Name" />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="px-8 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-200/50 rounded-lg transition-all text-xs uppercase tracking-widest"
              >
                Cancel
              </button>
              <button
                form="client-form"
                type="submit"
                className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-xs uppercase tracking-widest"
              >
                <Save size={16} />
                {customer ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
