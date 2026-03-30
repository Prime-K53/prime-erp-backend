
import React, { useState, useMemo } from 'react';
import {
  X, CheckCircle, Clock, DollarSign, Printer, Edit2, Download,
  FileText, ArrowRight, History, Trash2,
  AlertTriangle, Send, Eye, Briefcase, Package, RefreshCw,
  TrendingUp, Percent
} from 'lucide-react';
import { Quotation } from '../../../types';
import { useData } from '../../../context/DataContext';
import { useDocumentPreview } from '../../../hooks/useDocumentPreview';

interface QuotationDetailsProps {
  quotation: Quotation;
  onClose: () => void;
  onEdit: (quote: Quotation) => void;
  onAction: (quote: Quotation, action: string) => void;
}

export const QuotationDetails: React.FC<QuotationDetailsProps> = ({ quotation: initialQuotation, onClose, onEdit, onAction }) => {
  const {
    companyConfig, quotations = [], notify
  } = useData();
  const { handlePreview } = useDocumentPreview();
  const currency = companyConfig?.currencySymbol || '$';

  const quotation = useMemo(() =>
    quotations.find(q => q.id === initialQuotation.id) || initialQuotation
    , [quotations, initialQuotation]);

  const [activeTab, setActiveTab] = useState<'Overview' | 'Activity'>('Overview');

  const isExpired = quotation.validUntil && new Date(quotation.validUntil) < new Date();
  const isConverted = quotation.status === 'Converted';
  const isExaminationQuotation = String((quotation as any).quotationType || '').toLowerCase() === 'examination';

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-slate-50 w-full max-w-5xl h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
        {/* Header */}
        <div className="p-8 border-b border-slate-200 bg-white flex justify-between items-start shrink-0">
          <div className="flex gap-6 items-center">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <FileText size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-tight">Quotation #{quotation.id}</h1>
                <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest ${quotation.status === 'Accepted' || quotation.status === 'Approved' || quotation.status === 'Converted' ? 'bg-emerald-100 text-emerald-700' :
                  quotation.status === 'Rejected' ? 'bg-rose-100 text-rose-700' :
                    isExpired ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                  {isExpired ? 'Expired' : quotation.status}
                </span>
                {isExaminationQuotation && (
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-violet-100 text-violet-700">
                    Examination
                  </span>
                )}
              </div>
              <div className="text-slate-500 text-sm flex items-center gap-4 font-medium">
                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">{quotation.customerName}</span>
                <span className="flex items-center gap-1.5"><Clock size={14} /> Issued {new Date(quotation.date).toLocaleDateString()}</span>
                {quotation.validUntil && (
                  <span className={`flex items-center gap-1.5 ${isExpired ? 'text-rose-600 font-bold' : ''}`}>
                    <AlertTriangle size={14} /> Valid until {new Date(quotation.validUntil).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => onEdit(quotation)}
              className="p-3 bg-white border border-slate-200 text-slate-600 rounded-2xl hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-bold text-xs uppercase tracking-tight"
            >
              <Edit2 size={16} /> Edit
            </button>
            <button
              onClick={onClose}
              className="p-3 bg-white border border-slate-200 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-all shadow-sm"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 bg-white border-b border-slate-200 shrink-0">
          <div className="flex gap-8">
            {(['Overview', 'Activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 text-[13px] font-bold uppercase tracking-widest transition-all relative ${activeTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full shadow-[0_-2px_10px_rgba(37,99,235,0.3)]"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50">
          {activeTab === 'Overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm text-slate-500">
                        <span>Subtotal</span>
                        <span className="font-bold">{currency}{((quotation.total || 0) - (quotation.tax || 0)).toLocaleString()}</span>
                      </div>
                      {quotation.tax && quotation.tax > 0 && (
                        <div className="flex justify-between text-sm text-slate-500">
                          <span>Tax ({quotation.taxRate}%)</span>
                          <span className="font-bold">{currency}{quotation.tax.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="h-px bg-slate-100 my-2"></div>
                      <div className="flex justify-between items-end">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Value</p>
                        <p className="text-3xl font-black text-slate-900 tabular-nums leading-none">
                          {currency}{quotation.total.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Items Count</p>
                    <p className="text-3xl font-black text-slate-900 tabular-nums">
                      {quotation.items?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Items Table */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest">Line Items</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/80 border-b border-slate-200">
                        <tr>
                          <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-wider">Item / Description</th>
                          <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-wider text-center">Qty</th>
                          <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-wider text-right">Unit Price</th>
                          <th className="px-6 py-4 font-bold text-slate-500 text-[10px] uppercase tracking-wider text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {quotation.items?.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-slate-800">{item.name}</p>
                              {item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-slate-700">{item.quantity}</td>
                            <td className="px-6 py-4 text-right font-bold text-slate-700">{currency}{item.price.toLocaleString()}</td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900">{currency}{(item.quantity * item.price).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Market Adjustments */}
                {((quotation as any).adjustmentSnapshots && (quotation as any).adjustmentSnapshots.length > 0) || ((quotation as any).adjustmentBreakdown && (quotation as any).adjustmentBreakdown.length > 0) ? (
                  <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 bg-indigo-50/30 flex justify-between items-center">
                      <h3 className="font-bold text-indigo-900 text-xs uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={16} /> Market Adjustments
                      </h3>
                      <span className="text-xs font-black text-indigo-600">Total: {currency}{((quotation as any).adjustmentTotal || 0).toLocaleString()}</span>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {((quotation as any).adjustmentSnapshots || []).map((snap: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-4 bg-indigo-50/30 border border-indigo-100/50 rounded-2xl">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                                {snap.type === 'PERCENTAGE' ? <Percent size={18} /> : <DollarSign size={18} />}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-700">{snap.name}</p>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {snap.type === 'PERCENTAGE' ? `${snap.value}% Adjustment` : `Fixed Amount`}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-900">+{currency}{snap.calculatedAmount.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                        {(!((quotation as any).adjustmentSnapshots) || (quotation as any).adjustmentSnapshots.length === 0) && ((quotation as any).adjustmentBreakdown || []).map((adj: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-4 bg-indigo-50/30 border border-indigo-100/50 rounded-2xl">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 shadow-sm">
                                <TrendingUp size={18} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-700">{adj.category}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-900">+{currency}{adj.amount.toLocaleString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Notes */}
                {quotation.notes && (
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-700 text-xs uppercase tracking-widest mb-3">Terms & Notes</h3>
                    <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{quotation.notes}</p>
                  </div>
                )}
              </div>

              {/* Sidebar Actions */}
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Document Actions</h3>

                  <button
                    onClick={() => handlePreview('QUOTATION', quotation)}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-2xl text-[13px] font-bold tracking-tight hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                  >
                    <Eye size={18} /> Preview Quotation
                  </button>

                  <button
                    onClick={() => onAction(quotation, 'download_pdf')}
                    className="w-full px-4 py-3 bg-white text-slate-700 border border-slate-200 rounded-2xl text-[13px] font-bold tracking-tight hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={18} /> Download PDF
                  </button>

                  {quotation.status === 'Draft' && (
                    <button
                      onClick={() => onAction(quotation, 'approve')}
                      className="w-full px-4 py-3 bg-emerald-600 text-white rounded-2xl text-[13px] font-bold tracking-tight hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                    >
                      <CheckCircle size={18} /> Approve Quotation
                    </button>
                  )}

                  <div className="h-px bg-slate-100 my-2"></div>

                  <button
                    onClick={() => onAction(quotation, 'convert_to_order')}
                    disabled={isConverted}
                    className="w-full px-4 py-3 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-2xl text-[13px] font-bold tracking-tight hover:bg-indigo-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Package size={18} /> Convert to Order
                  </button>

                  <button
                    onClick={() => onAction(quotation, 'convert_inv')}
                    disabled={isConverted}
                    className="w-full px-4 py-3 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-2xl text-[13px] font-bold tracking-tight hover:bg-emerald-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle size={18} /> Convert to Invoice
                  </button>

                  <button
                    onClick={() => onAction(quotation, 'convert_wo')}
                    disabled={isConverted}
                    className="w-full px-4 py-3 bg-purple-50 text-purple-700 border border-purple-100 rounded-2xl text-[13px] font-bold tracking-tight hover:bg-purple-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Briefcase size={18} /> Convert to Work Order
                  </button>

                  <button
                    onClick={() => onAction(quotation, 'convert_to_job_ticket')}
                    disabled={isConverted}
                    className="w-full px-4 py-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-2xl text-[13px] font-bold tracking-tight hover:bg-rose-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Printer size={18} /> Convert to Job Ticket
                  </button>
                </div>

                <div className="bg-rose-50 p-6 rounded-3xl border border-rose-100 space-y-3">
                  <h3 className="text-xs font-bold text-rose-400 uppercase tracking-widest">Danger Zone</h3>
                  <button
                    onClick={() => onAction(quotation, 'status_Rejected')}
                    className="w-full px-4 py-3 bg-white text-rose-600 border border-rose-100 rounded-2xl text-[13px] font-bold tracking-tight hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                  >
                    <X size={18} /> Reject Quotation
                  </button>
                  <button
                    onClick={() => onAction(quotation, 'delete')}
                    className="w-full px-4 py-3 bg-rose-600 text-white rounded-2xl text-[13px] font-bold tracking-tight hover:bg-rose-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-100"
                  >
                    <Trash2 size={18} /> Delete Record
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Activity' && (
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                <History size={48} strokeWidth={1} />
                <p className="text-sm font-bold uppercase tracking-widest">Activity history available in Audit Log</p>
                <p className="text-xs text-slate-400">Navigate to Security Log for detailed audit trail</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
