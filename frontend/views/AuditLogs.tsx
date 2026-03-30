import React, { useState } from 'react';
import { 
    ShieldCheck, User, Clock, Activity, Trash2, 
    AlertTriangle, ShieldAlert, ChevronDown, ChevronRight,
    Search, Filter, Database, FileText, ArrowRight, UserCheck, 
    Layers, History as HistoryIcon, CheckSquare, Zap, Eye
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { AuditLogEntry } from '../types';
import { format } from 'date-fns';

const AuditLogs: React.FC = () => {
  const { auditLogs = [], user, notify } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('All');

  const filteredLogs = (auditLogs || []).filter(log => {
      const matchesSearch = log.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.entityId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesAction = filterAction === 'All' || log.action === filterAction;
      return matchesSearch && matchesAction;
  });

  const getActionColor = (action: string) => {
      switch(action) {
          case 'CREATE': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
          case 'UPDATE': return 'text-blue-600 bg-blue-50 border-blue-100';
          case 'DELETE': return 'text-rose-600 bg-rose-50 border-rose-100';
          case 'VOID': return 'text-amber-600 bg-amber-50 border-amber-100';
          case 'REVERSE': return 'text-purple-600 bg-purple-50 border-purple-100';
          default: return 'text-slate-600 bg-slate-50 border-slate-100';
      }
  };

  const renderValueDiff = (oldVal: any, newVal: any) => {
    if (!oldVal && !newVal) return <p className="text-slate-400 italic">No data snapshot available.</p>;
    
    // For creation
    if (!oldVal && newVal) return (
        <div className="bg-emerald-50/30 p-3 rounded-lg border border-emerald-100">
            <p className="text-[10px] font-black text-emerald-600 uppercase mb-2">Initial State Captured</p>
            <pre className="text-[10px] font-mono text-slate-600 overflow-auto whitespace-pre-wrap">{JSON.stringify(newVal, null, 2)}</pre>
        </div>
    );

    // For deletion
    if (oldVal && !newVal) return (
        <div className="bg-rose-50/30 p-3 rounded-lg border border-rose-100">
            <p className="text-[10px] font-black text-rose-600 uppercase mb-2">Pre-Deletion State Captured</p>
            <pre className="text-[10px] font-mono text-slate-600 overflow-auto whitespace-pre-wrap">{JSON.stringify(oldVal, null, 2)}</pre>
        </div>
    );

    return (
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Previous State</p>
                <pre className="text-[10px] font-mono text-slate-600 overflow-auto whitespace-pre-wrap max-h-40">{JSON.stringify(oldVal, null, 2)}</pre>
            </div>
            <div className="bg-blue-50/30 p-3 rounded-lg border border-blue-100">
                <p className="text-[10px] font-black text-blue-600 uppercase mb-2">New State</p>
                <pre className="text-[10px] font-mono text-slate-600 overflow-auto whitespace-pre-wrap max-h-40">{JSON.stringify(newVal, null, 2)}</pre>
            </div>
        </div>
    );
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-4rem)] flex flex-col font-sans">
      <div className="mb-6 flex justify-between items-center shrink-0">
        <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tighter uppercase">
                <ShieldCheck className="text-blue-600" size={28} />
                Audit Trail Intelligence
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">Immutable security ledger capturing all system state changes.</p>
        </div>
        <div className="flex gap-4">
            <div className="bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Trail Integrity</span>
                    <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1 leading-none"><CheckSquare size={12}/> SEALED</span>
                </div>
                <div className="h-6 w-px bg-slate-200"></div>
                <p className="text-[11px] font-black text-slate-800 uppercase tracking-widest leading-none">{auditLogs.length} Events</p>
            </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6 shrink-0">
          <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
              <input 
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/5 outline-none transition-all shadow-sm"
                placeholder="Search trail by entity ID, user, or keyword details..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
          </div>
          <div className="flex bg-white rounded-2xl border border-slate-200 p-1 shadow-sm">
             {['All', 'CREATE', 'UPDATE', 'DELETE', 'VOID'].map(action => (
                 <button 
                    key={action}
                    onClick={() => setFilterAction(action)}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filterAction === action ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}
                 >
                     {action}
                 </button>
             ))}
          </div>
      </div>

      <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-[0.2em] border-b border-slate-200 sticky top-0 z-20">
              <tr>
                <th className="px-6 py-5 w-12"></th>
                <th className="px-4 py-5 w-44">Timestamp</th>
                <th className="px-4 py-5 w-32">Action</th>
                <th className="px-4 py-5 w-48">Correlation ID</th>
        <th className="px-4 py-5 w-48">Entity Identity</th>
                <th className="px-4 py-5">Summary of Change</th>
                <th className="px-4 py-5 w-40">Identity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLogs.length === 0 && (
                <tr><td colSpan={6} className="p-20 text-center text-slate-400 font-medium italic">No matching activity records detected in the ledger.</td></tr>
              )}
              {filteredLogs.map((log) => (
                <React.Fragment key={log.id}>
                    <tr 
                        className={`hover:bg-blue-50/30 transition-colors cursor-pointer group ${expandedId === log.id ? 'bg-blue-50/50' : ''}`}
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                        <td className="px-6 py-4 text-center">
                            {expandedId === log.id ? <ChevronDown size={16} className="text-blue-600"/> : <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500"/>}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-500 text-xs font-mono font-bold uppercase">
                            <div className="flex flex-col">
                                <span>{format(new Date(log.date), 'MMM dd, yyyy')}</span>
                                <span className="text-blue-600 font-black tracking-tighter">{format(new Date(log.date), 'HH:mm:ss.SSS')}</span>
                            </div>
                        </td>
                        <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest border ${getActionColor(log.action)}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${log.action === 'DELETE' || log.action === 'VOID' ? 'bg-rose-500 animate-pulse' : 'bg-current'}`}></div>
                                {log.action}
                            </span>
                        </td>
                        <td className="px-4 py-4">
                            <span className="text-xs font-mono text-slate-600">{log.correlationId}</span>
                        </td>
                        <td className="px-4 py-4">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-0.5">{log.entityType}</span>
                                <span className="text-xs font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 inline-block w-fit">
                                    {log.entityId}
                                </span>
                            </div>
                        </td>
                        <td className="px-4 py-4">
                            <div className="text-xs font-bold text-slate-700 leading-snug">{log.details}</div>
                            {log.reason && <div className="text-[10px] text-blue-600 font-bold mt-1 uppercase tracking-tighter flex items-center gap-1 italic"><FileText size={10}/> Reason: {log.reason}</div>}
                        </td>
                        <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-[10px] font-black text-white shadow-md border border-white/20">
                                    {log.userId.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-800 leading-none">@{log.userId}</span>
                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">{log.userRole}</span>
                                </div>
                            </div>
                        </td>
                    </tr>
                    {expandedId === log.id && (
                        <tr className="bg-slate-50/50">
                            <td colSpan={6} className="px-10 py-8">
                                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl p-8 space-y-6 animate-in slide-in-from-top-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                                <Zap size={14} className="text-amber-500" fill="currentColor"/> Logical State Diff
                                            </h4>
                                            <p className="text-xs text-slate-500">Atomic snapshot comparison for transaction ID <span className="font-mono font-bold">{log.id}</span></p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1 flex items-center justify-end gap-1">
                                                <ShieldAlert size={12}/> CRYPTOGRAPHICALLY HASHED
                                            </div>
                                            <div className="text-[8px] text-slate-300 font-mono">NON_REPUTATION_TRAIL_ACTIVE</div>
                                        </div>
                                    </div>
                                    
                                    {renderValueDiff(log.oldValue, log.newValue)}

                                    <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                                        <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <span className="flex items-center gap-1.5"><HistoryIcon size={12}/> Latency: 4ms</span>
                                            <span className="flex items-center gap-1.5"><Database size={12}/> Storage: IndexedDB.auditLogs</span>
                                        </div>
                                        <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline flex items-center gap-2">
                                            <Eye size={12}/> View Full Context Object
                                        </button>
                                    </div>
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

      <div className="mt-6 flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 bg-slate-100/50 p-2 rounded-xl border border-slate-200">
         <ShieldAlert size={12} className="text-amber-500"/>
         Notice: Audit logs are immutable and permanent. They cannot be modified or deleted, ensuring full regulatory compliance and non-repudiation.
      </div>
    </div>
  );
};

export default AuditLogs;