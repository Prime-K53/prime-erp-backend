import React, { useState } from 'react';
import { ShieldCheck, Activity, TrendingUp, AlertTriangle, FileText, Sparkles, RefreshCw, Printer, Loader2 } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { generateBusinessHealthReport } from '../../services/geminiService';
import ReactMarkdown from 'react-markdown';

const BusinessHealthReport: React.FC = () => {
    const { invoices, expenses, income, accounts, sales, customers, inventory, notify, companyConfig } = useData();
    const [report, setReport] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleGenerateReport = async () => {
        setIsLoading(true);
        try {
            const result = await generateBusinessHealthReport(
                { invoices, expenses, income, accounts },
                { sales, customers },
                { inventory }
            );
            setReport(result);
            notify("AI Health Report generated successfully", "success");
        } catch (error) {
            console.error(error);
            notify("Failed to generate report", "error");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6 max-w-[1200px] mx-auto min-h-screen font-sans">
            <div className="flex flex-col gap-8">
            <div className="mb-8 flex justify-between items-start no-print">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tighter uppercase">
                        <ShieldCheck className="text-indigo-600" size={32} />
                        Business Health Intelligence
                    </h1>
                    <p className="text-slate-500 font-medium mt-1">AI-powered strategic analysis and financial diagnostic report.</p>
                </div>
                
                <button
                    onClick={handleGenerateReport}
                    disabled={isLoading}
                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg ${
                        isLoading 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                    }`}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin" size={18} />
                            Analyzing Enterprise Data...
                        </>
                    ) : (
                        <>
                            <Sparkles size={18} />
                            {report ? 'Regenerate Analysis' : 'Generate Strategic Report'}
                        </>
                    )}
                </button>
            </div>

            {!report && !isLoading && (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                        <Activity className="text-indigo-500" size={40} />
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2">Ready for Strategic Analysis</h2>
                    <p className="text-slate-500 max-w-md mb-8">
                        Our AI will analyze your financial statements, sales velocity, and inventory levels to provide a comprehensive health diagnostic.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                        <div className="bg-slate-50 p-4 rounded-2xl text-left border border-slate-100">
                            <TrendingUp className="text-emerald-500 mb-2" size={20} />
                            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight">Growth Trends</h3>
                            <p className="text-xs text-slate-500">Revenue and expense velocity analysis.</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl text-left border border-slate-100">
                            <AlertTriangle className="text-amber-500 mb-2" size={20} />
                            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight">Risk Mitigation</h3>
                            <p className="text-xs text-slate-500">Identify stockouts and cash flow gaps.</p>
                        </div>
                        <div className="bg-slate-50 p-4 rounded-2xl text-left border border-slate-100">
                            <FileText className="text-blue-500 mb-2" size={20} />
                            <h3 className="font-bold text-sm text-slate-800 uppercase tracking-tight">Action Plan</h3>
                            <p className="text-xs text-slate-500">3-5 strategic steps for improvement.</p>
                        </div>
                    </div>
                </div>
            )}

            {isLoading && (
                <div className="space-y-6">
                    <div className="h-12 bg-slate-100 rounded-2xl animate-pulse w-3/4"></div>
                    <div className="grid grid-cols-3 gap-6">
                        <div className="h-40 bg-slate-50 rounded-3xl animate-pulse"></div>
                        <div className="h-40 bg-slate-50 rounded-3xl animate-pulse"></div>
                        <div className="h-40 bg-slate-50 rounded-3xl animate-pulse"></div>
                    </div>
                    <div className="h-64 bg-slate-50 rounded-3xl animate-pulse"></div>
                    <div className="h-32 bg-slate-100 rounded-3xl animate-pulse"></div>
                </div>
            )}

            {report && !isLoading && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 print-container">
                    <style>{`
                        @media print {
                            body * { visibility: hidden; }
                            .print-container, .print-container * { visibility: visible; }
                            .print-container {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                                margin: 0;
                                padding: 20mm;
                                background: white !important;
                                color: black !important;
                            }
                            .no-print { display: none !important; }
                        }
                    `}</style>
                    <div className="bg-slate-900 p-6 flex justify-between items-center text-white no-print">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-500/20 p-2 rounded-xl border border-indigo-500/30">
                                <Sparkles className="text-indigo-300" size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-sm uppercase tracking-widest leading-none">AI Strategic Diagnostic</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mt-1">Report Generated on {new Date().toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={handlePrint}
                                className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl transition-colors shadow-lg flex items-center gap-2"
                            >
                                <Printer size={18} />
                                <span className="text-xs font-bold uppercase tracking-widest">Print Analysis</span>
                            </button>
                        </div>
                    </div>
                    
                    <div className="p-8 md:p-12 prose prose-slate max-w-none print-container">
                        <ReactMarkdown 
                            components={{
                                h1: ({node, ...props}) => <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-6" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-xl font-bold text-slate-800 border-b-2 border-slate-100 pb-2 mt-8 mb-4 flex items-center gap-2" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-lg font-bold text-slate-700 mt-6 mb-3" {...props} />,
                                p: ({node, ...props}) => <p className="text-slate-600 leading-relaxed mb-4" {...props} />,
                                ul: ({node, ...props}) => <ul className="space-y-2 mb-6" {...props} />,
                                li: ({node, ...props}) => (
                                    <li className="flex items-start gap-2 text-slate-600">
                                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                                        <span>{props.children}</span>
                                    </li>
                                ),
                                strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />,
                            }}
                        >
                            {report}
                        </ReactMarkdown>
                    </div>

                    <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ShieldCheck size={12} /> Prime ERP AI Intelligence • Confidential Enterprise Report
                        </p>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};

export default BusinessHealthReport;