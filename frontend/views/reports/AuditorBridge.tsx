
import React from 'react';
import { ShieldCheck, ArrowRight, Calculator, AlertTriangle } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { useFinance } from '../../context/FinanceContext';

export const AuditorBridge: React.FC<{ drift: number, physical: number, ledger: number }> = ({ drift, physical, ledger }) => {
    const { companyConfig, notify } = useData();
    const { postJournalEntry } = useFinance();
    const currency = companyConfig.currencySymbol;

    const handleFixDrift = async () => {
        const safeDrift = drift || 0;
        if (Math.abs(safeDrift) < 0.01) return;

        const isLedgerHigh = safeDrift > 0;
        const amount = Math.abs(safeDrift);

        // Use system mapping for Inventory Asset and Other Income/Loss
        const gl = companyConfig?.glMapping || {};
        const invAssetAcc = gl.defaultInventoryAccount || '1200';
        const correctionAcc = isLedgerHigh
            ? '6100' // Generic Maintenance/Expense if ledger too high
            : gl.otherIncomeAccount || '4900'; // Other Income if ledger too low (found stock)

        const entries = [{
            description: `Logical drift correction: Inventory vs Ledger audit`,
            debitAccountId: isLedgerHigh ? correctionAcc : invAssetAcc,
            creditAccountId: isLedgerHigh ? invAssetAcc : correctionAcc,
            amount: amount,
            referenceId: `AUDIT-SYNC-${Date.now()}`,
            reconciled: true
        }];

        await postJournalEntry(entries);
        notify("Accounting ledger reconciled with physical master list.", "success");
    };

    return (
        <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10"><ShieldCheck size={120} /></div>
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
                        <Calculator className="text-white" size={20} />
                    </div>
                    <h3 className="text-xl font-black tracking-tighter">Logical reconciliation</h3>
                </div>
                <p className="text-slate-400 text-sm mb-6 max-w-lg leading-relaxed">
                    Detected a valuation variance of <span className="text-white font-bold">{currency}{(drift || 0).toLocaleString()}</span>.
                    This occurs when manual inventory adjustments are committed without corresponding double-entry ledger postings.
                </p>

                <div className="flex flex-col md:flex-row gap-6 items-center">
                    <button
                        onClick={handleFixDrift}
                        disabled={Math.abs(drift || 0) < 0.01}
                        className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white rounded-2xl font-black text-[11px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 disabled:grayscale"
                    >
                        Sync ledger valuation
                        <ArrowRight size={16} />
                    </button>
                    {Math.abs(drift || 0) > 500 && (
                        <div className="flex items-center gap-2 text-rose-400 text-[10px] font-black tracking-widest bg-rose-900/20 px-3 py-1.5 rounded-xl border border-rose-500/30 animate-pulse">
                            <AlertTriangle size={14} /> High variance alert: Review logs
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
