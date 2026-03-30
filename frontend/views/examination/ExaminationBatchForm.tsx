import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExamination } from '../../context/ExaminationContext';
import { useAuth } from '../../context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/Dialog';
import { ArrowLeft, Save, Plus } from 'lucide-react';
import { Customer } from '../../types';
import { dbService } from '../../services/db';
import { toast } from '../../components/Toast';

const ExaminationBatchForm: React.FC = () => {
  const navigate = useNavigate();
  const { createBatch, loadAllData, customers, loading: contextLoading } = useExamination();
  const { companyConfig, addAuditLog } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    school_id: '',
    name: '',
    academic_year: new Date().getFullYear().toString(),
    term: '1',
    exam_type: 'Mid-Term',
    currency: companyConfig?.currencySymbol || 'MWK',
    sub_account_name: ''
  });

  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: ''
  });
  const [addingCustomer, setAddingCustomer] = useState(false);
  const CREATE_SUBMIT_TIMEOUT_MS = 30000;

  useEffect(() => {
    if (companyConfig?.currencySymbol) {
      setFormData((prev) => ({ ...prev, currency: companyConfig.currencySymbol }));
    }
  }, [companyConfig?.currencySymbol]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const sortedCustomers = React.useMemo(() => {
    if (!customers || customers.length === 0) {
      return [];
    }
    return [...customers].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [customers]);

  const selectedCustomerFull = React.useMemo(() => {
    if (!formData.school_id) return null;
    return customers.find((customer) => String(customer.id) === String(formData.school_id));
  }, [customers, formData.school_id]);

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name.trim()) return;

    setAddingCustomer(true);
    try {
      const customerId = `CUS-${Date.now()}`;
      const customer: Customer = {
        id: customerId,
        name: newCustomer.name.trim(),
        email: newCustomer.email.trim() || '',
        phone: newCustomer.phone.trim() || '',
        address: newCustomer.address.trim() || '',
        city: newCustomer.city.trim() || '',
        balance: 0,
        walletBalance: 0,
        creditLimit: 0,
        status: 'Active',
        category: 'School',
        segment: 'School Account',
        paymentTerms: 'Net 365'
      };

      await dbService.put('customers', customer);

      if (addAuditLog) {
        addAuditLog({
          action: 'CREATE',
          entityType: 'Customer',
          entityId: customerId,
          details: `Created new customer: ${customer.name}`,
          newValue: customer
        });
      }

      await loadAllData();
      setFormData((prev) => ({ ...prev, school_id: customer.id, sub_account_name: '' }));
      setNewCustomer({ name: '', email: '', phone: '', address: '', city: '' });
      setShowAddCustomer(false);
    } catch (error) {
      console.error('Failed to add customer:', error);
    } finally {
      setAddingCustomer(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();

    const schoolId = String(formData.school_id ?? '').trim();
    const batchName = String(formData.name ?? '').trim();
    const academicYear = String(formData.academic_year ?? '').trim();

    if (!schoolId) {
      if (contextLoading && sortedCustomers.length === 0) {
        toast.info('Customers are still loading. Please wait a moment and try again.');
        return;
      }
      toast.error('Please select a school or customer from the list');
      return;
    }
    if (!batchName) {
      toast.error('Please enter a batch name');
      return;
    }
    if (!academicYear) {
      toast.error('Please enter an academic year');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        school_id: schoolId,
        name: batchName,
        academic_year: academicYear,
        sub_account_name: formData.sub_account_name.trim(),
        rounding_method: companyConfig?.pricingSettings?.defaultMethod || 'ALWAYS_UP_50',
        rounding_value: Number(companyConfig?.pricingSettings?.customStep || 50)
      };

      console.log('Submitting batch payload:', payload);

      const newBatch = await Promise.race([
        createBatch(payload),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Create request timed out after ${CREATE_SUBMIT_TIMEOUT_MS}ms`)), CREATE_SUBMIT_TIMEOUT_MS)
        )
      ]);
      toast.success('Examination batch created successfully');
      navigate(`/examination/batches/${newBatch.id}`);
    } catch (error: any) {
      console.error('Failed to create batch:', error);
      const errorMessage = error?.message || 'Failed to create examination batch. Please try again.';
      toast.error(errorMessage);
      
      // Additional user guidance based on common errors
      if (errorMessage.includes('School ID') || errorMessage.includes('required')) {
        toast.info('Please ensure a valid school is selected.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 max-w-[1600px] mx-auto w-full font-normal overflow-y-auto custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-[22px] font-semibold text-slate-900 tracking-tight">Create Examination Batch</h1>
          <p className="text-xs text-slate-500 mt-0.5">Set school, term, exam type, and billing profile</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/examination/batches')}
          className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-4 py-2 rounded-xl font-medium hover:bg-slate-100 text-sm shadow-sm transition-all border border-slate-200"
        >
          <ArrowLeft size={16} />
          Back to Batches
        </button>
      </div>

      <div className="bg-white/70 backdrop-blur-xl p-5 md:p-6 rounded-2xl border border-white/60 shadow-sm">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900">Batch Details</h2>
          <p className="text-xs text-slate-500 mt-1">Create a new examination batch and assign it to a school account.</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">School / Client</label>
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  <Plus size={12} />
                  Add New
                </button>
              </div>
              <select
                value={formData.school_id}
                onChange={(event) => handleChange('school_id', event.target.value)}
                required
                disabled={contextLoading && sortedCustomers.length === 0}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              >
                <option value="">
                  {contextLoading && sortedCustomers.length === 0 ? 'Loading customers...' : 'Select customer'}
                </option>
                {sortedCustomers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCustomerFull && selectedCustomerFull.subAccounts && selectedCustomerFull.subAccounts.length > 0 ? (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                  Sub Account
                </label>
                <select
                  value={formData.sub_account_name}
                  onChange={(event) => handleChange('sub_account_name', event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                >
                  <option value="">Select sub-account (or leave for main account)</option>
                  {selectedCustomerFull.subAccounts.map((sub: any) => (
                    <option key={sub.id} value={sub.name}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Currency</label>
                <input
                  value={formData.currency}
                  onChange={(event) => handleChange('currency', event.target.value)}
                  disabled
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Batch Name</label>
              <input
                value={formData.name}
                onChange={(event) => handleChange('name', event.target.value)}
                placeholder="e.g. Term 1 Examinations 2026"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Academic Year</label>
              <input
                value={formData.academic_year}
                onChange={(event) => handleChange('academic_year', event.target.value)}
                placeholder="e.g. 2026"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Term</label>
              <select
                value={formData.term}
                onChange={(event) => handleChange('term', event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              >
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Exam Type</label>
              <select
                value={formData.exam_type}
                onChange={(event) => handleChange('exam_type', event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              >
                <option value="Mid-Term">Mid-Term</option>
                <option value="End-of-Term">End-of-Term</option>
                <option value="Mock">Mock</option>
                <option value="Assessment">Assessment</option>
              </select>
            </div>


          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 text-sm shadow-sm transition-all disabled:opacity-60"
            >
              <Save size={16} />
              {loading ? 'Creating...' : 'Create Batch'}
            </button>
          </div>
        </form>
      </div>

      <Dialog open={showAddCustomer} onOpenChange={setShowAddCustomer}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
          </DialogHeader>
          <div className="px-8 py-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                Customer Name <span className="text-red-500">*</span>
              </label>
              <input
                value={newCustomer.name}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Enter customer/school name"
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Email</label>
              <input
                type="email"
                value={newCustomer.email}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="customer@example.com"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Phone</label>
              <input
                value={newCustomer.phone}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="+265 999 123 456"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">Address</label>
              <input
                value={newCustomer.address}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, address: event.target.value }))}
                placeholder="Street address"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">City</label>
              <input
                value={newCustomer.city}
                onChange={(event) => setNewCustomer((prev) => ({ ...prev, city: event.target.value }))}
                placeholder="City"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setShowAddCustomer(false)}
              className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-700 px-4 py-2 rounded-xl font-medium hover:bg-slate-100 text-sm shadow-sm transition-all border border-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleAddNewCustomer}
              disabled={addingCustomer || !newCustomer.name.trim()}
              type="button"
              className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-700 text-sm shadow-sm transition-all disabled:opacity-60"
            >
              <Plus size={16} />
              {addingCustomer ? 'Adding...' : 'Add Customer'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExaminationBatchForm;
