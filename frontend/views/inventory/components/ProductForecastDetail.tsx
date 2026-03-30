import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, Calendar, TrendingUp, AlertTriangle, DollarSign, 
  Package, Sliders, ShoppingCart, Download, Share2, Info, Activity, Sparkles, Printer, FileText
} from 'lucide-react';
import { 
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, BarChart, Bar, Legend 
} from 'recharts';
import { Item, Sale, Purchase } from '../../../types';
import { useData } from '../../../context/DataContext';
import { generateAIResponse } from '../../../services/geminiService';
import ReactMarkdown from 'react-markdown';
import { OfflineImage } from '../../../components/OfflineImage';

interface ProductForecastDetailProps {
  item: Item;
  salesHistory: Sale[];
  purchaseHistory: Purchase[];
  onBack: () => void;
  onCreatePO: (item: Item) => void;
}

const ProductForecastDetail: React.FC<ProductForecastDetailProps> = ({ 
  item, salesHistory, purchaseHistory, onBack, onCreatePO 
}) => {
  const { companyConfig, notify } = useData();
  const currency = companyConfig.currencySymbol;

  // --- 1. Scenario State (What-If) ---
  const [scenario, setScenario] = useState({
    priceChange: 0,   // % change
    costChange: 0,    // % change
    demandChange: 0,  // % change (e.g. seasonality)
    bufferStock: item.minStockLevel
  });

  const [aiStrategy, setAiStrategy] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  // --- 2. Historical Data Analysis ---
  const historicalStats = useMemo(() => {
    // Filter sales for this item
    const itemSales = salesHistory.filter(s => s.items.some(i => i.id === item.id));
    
    // Calculate Average Daily Usage (ADU) over last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const recentSales = itemSales.filter(s => new Date(s.date) >= ninetyDaysAgo);
    const totalQtySold = recentSales.reduce((sum, s) => {
        const line = s.items.find(i => i.id === item.id);
        return sum + (line ? line.quantity : 0);
    }, 0);
    
    const adu = totalQtySold / 90; // Average Daily Usage
    const growthRate = 1.05; // Mock: 5% organic growth trend derived from history

    return { adu: adu || 0.5, growthRate, totalQtySold }; // Fallback ADU if no history
  }, [salesHistory, item.id]);

  // --- 3. Projection Calculation (Based on Scenario) ---
  const projections = useMemo(() => {
    const baseADU = historicalStats.adu;
    
    // Apply Scenario Modifiers
    // Price elasticity: simplistic assumption that 1% price increase = 0.5% demand drop
    const elasticityFactor = 1 - (scenario.priceChange * 0.005); 
    const demandFactor = 1 + (scenario.demandChange / 100);
    
    const adjustedDailyDemand = baseADU * elasticityFactor * demandFactor;
    
    const daysUntilStockout = adjustedDailyDemand > 0 ? item.stock / adjustedDailyDemand : 365;
    const stockoutDate = new Date();
    stockoutDate.setDate(stockoutDate.getDate() + Math.floor(daysUntilStockout));

    // Financials
    const futurePrice = item.price * (1 + (scenario.priceChange / 100));
    const currentCost = item.cost || (item.price * 0.6); // Fallback cost
    const futureCost = currentCost * (1 + (scenario.costChange / 100));
    
    const futureMargin = futurePrice - futureCost;
    const marginPercent = (futureMargin / futurePrice) * 100;

    return {
      dailyDemand: adjustedDailyDemand,
      daysUntilStockout,
      stockoutDate,
      futurePrice,
      futureCost,
      futureMargin,
      marginPercent
    };
  }, [historicalStats, item, scenario]);

  // --- 4. Chart Data Generation ---
  const chartData = useMemo(() => {
    const data = [];
    const today = new Date();
    
    // Generate 30 days of History (Mocked based on ADU to look realistic)
    for (let i = 30; i > 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        // Random variance around ADU
        const variance = (Math.random() * 0.5) + 0.75; 
        data.push({
            date: d.toLocaleDateString(undefined, {month:'short', day:'numeric'}),
            type: 'History',
            sales: Math.floor(historicalStats.adu * variance),
            stock: null, // Don't show stock line for history to keep clean
            forecast: null
        });
    }

    // Generate 90 days of Forecast
    let currentStock = item.stock;
    for (let i = 0; i <= 90; i+=3) { // Every 3 days to smooth chart
        const d = new Date();
        d.setDate(today.getDate() + i);
        
        // Deplete stock
        currentStock -= (projections.dailyDemand * 3);
        
        data.push({
            date: d.toLocaleDateString(undefined, {month:'short', day:'numeric'}),
            type: 'Forecast',
            sales: null,
            stock: Math.max(0, currentStock),
            forecast: projections.dailyDemand,
            threshold: scenario.bufferStock
        });
    }
    return data;
  }, [historicalStats, item.stock, projections, scenario.bufferStock]);

  // --- 5. Period Forecasts ---
  const periodData = [
      { label: 'Next 7 Days', days: 7 },
      { label: 'Next 30 Days', days: 30 },
      { label: 'Next 90 Days', days: 90 },
      { label: 'Next Year', days: 365 },
  ].map(p => {
      const qty = Math.ceil(projections.dailyDemand * p.days);
      const rev = qty * projections.futurePrice;
      const profit = qty * projections.futureMargin;
      return { ...p, qty, rev, profit };
  });

  // --- AI Handler ---
  const handleGetStrategy = async () => {
      setIsAiLoading(true);
      const prompt = `
      Product: ${item.name}
      Current Stock: ${item.stock}
      Avg Daily Usage: ${historicalStats.adu.toFixed(1)}
      Days until Stockout: ${projections.daysUntilStockout.toFixed(0)}
      Current Margin: ${projections.marginPercent.toFixed(1)}%
      
      Analyze this inventory data. Suggest specific actions regarding pricing strategy, reorder timing, and potential risks. Keep it brief and strategic.
      `;
      const response = await generateAIResponse(prompt, "You are a Supply Chain Analyst.");
      setAiStrategy(response);
      setIsAiLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 animate-fadeIn">
      
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm z-10 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft size={20}/>
          </button>
          
          <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm shrink-0">
                  <OfflineImage 
                      src={item.image} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                      fallback={<div className="w-full h-full flex items-center justify-center text-slate-300"><Package size={20}/></div>}
                  />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    {item.name} <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Forecast View</span>
                </h1>
                <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                    <span className="font-mono">SKU: {item.sku}</span>
                    <span>•</span>
                    <span>Current Stock: <b>{item.stock}</b> {item.unit}</span>
                </div>
              </div>
          </div>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={handlePrint} 
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 bg-white text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50"
            >
              <Printer size={16}/> Print
            </button>
            <button 
              onClick={() => onCreatePO(item)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-all"
            >
              <ShoppingCart size={16}/> Restock Now
            </button>
        </div>
      </div>

      <div id="product-forecast-printable" className="flex-1 overflow-hidden flex flex-col lg:flex-row print:overflow-visible print:block">
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-0 print:overflow-visible">
              
              {/* 1. Top Impact Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
                  <div className={`p-5 rounded-xl border shadow-sm bg-white ${projections.daysUntilStockout < 30 ? 'border-red-200 ring-1 ring-red-100' : 'border-slate-200'}`}>
                      <div className="flex justify-between items-start mb-2">
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Depletion Date</div>
                          <Calendar size={16} className={projections.daysUntilStockout < 30 ? 'text-red-500' : 'text-slate-400'}/>
                      </div>
                      <div className={`text-2xl font-bold ${projections.daysUntilStockout < 30 ? 'text-red-600' : 'text-slate-800'}`}>
                          {projections.daysUntilStockout > 365 ? '> 1 Year' : projections.stockoutDate.toLocaleDateString()}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                          {projections.daysUntilStockout < 365 ? `${Math.floor(projections.daysUntilStockout)} days remaining` : 'Safe stock levels'}
                      </div>
                  </div>

                  <div className="p-5 rounded-xl border border-slate-200 shadow-sm bg-white">
                      <div className="flex justify-between items-start mb-2">
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Projected Margin</div>
                          <TrendingUp size={16} className={projections.marginPercent > 20 ? 'text-emerald-500' : 'text-amber-500'}/>
                      </div>
                      <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-slate-800">{projections.marginPercent.toFixed(1)}%</span>
                          <span className="text-xs text-slate-400">per unit</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                          New Profit: {currency}{projections.futureMargin.toFixed(2)}
                      </div>
                  </div>

                  <div className="p-5 rounded-xl border border-slate-200 shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50/50 print:bg-white print:border-slate-200 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-2">
                          <div className="text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-2">AI Strategy Advisor <Sparkles size={12}/></div>
                          <Info size={16} className="text-blue-500"/>
                      </div>
                      
                      {aiStrategy ? (
                          <div className="prose prose-sm text-slate-700 text-xs overflow-y-auto max-h-24 custom-scrollbar">
                              <ReactMarkdown>{aiStrategy}</ReactMarkdown>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center justify-center h-20">
                              <button 
                                onClick={handleGetStrategy} 
                                disabled={isAiLoading}
                                className="bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50 shadow-sm flex items-center gap-2"
                              >
                                  {isAiLoading ? <Loader2 size={14} className="animate-spin"/> : <Sparkles size={14}/>}
                                  Generate Strategy
                              </button>
                          </div>
                      )}
                  </div>
              </div>

              {/* 2. Main Chart */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm print:break-inside-avoid">
                  <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <Activity size={18} className="text-blue-600"/> Demand & Stock Trajectory
                  </h3>
                  <div style={{ width: '100%', height: 350, minHeight: 150 }}>
                      <ResponsiveContainer width="100%" height="100%" minHeight={150} minWidth={0}>
                          <ComposedChart data={chartData}>
                              <defs>
                                  <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                  </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                              <XAxis dataKey="date" tick={{fontSize: 11, fill:'#64748b'}} axisLine={false} tickLine={false}/>
                              <YAxis yAxisId="left" tick={{fontSize: 11, fill:'#64748b'}} axisLine={false} tickLine={false} label={{ value: 'Stock Level', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 10 }}/>
                              <YAxis yAxisId="right" orientation="right" tick={{fontSize: 11, fill:'#64748b'}} axisLine={false} tickLine={false} label={{ value: 'Daily Sales', angle: 90, position: 'insideRight', fill: '#94a3b8', fontSize: 10 }}/>
                              <Tooltip 
                                  contentStyle={{borderRadius:'8px', border:'none', boxShadow:'0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                                  labelStyle={{fontWeight:'bold', color:'#1e293b'}}
                              />
                              <Legend wrapperStyle={{paddingTop: '20px'}}/>
                              
                              {/* Historical Sales */}
                              <Bar yAxisId="right" dataKey="sales" name="Historical Sales" fill="#cbd5e1" barSize={10} radius={[4,4,0,0]}/>
                              
                              {/* Projected Stock */}
                              <Area yAxisId="left" type="monotone" dataKey="stock" name="Projected Stock" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorStock)"/>
                              
                              {/* Safety Stock Line */}
                              <ReferenceLine yAxisId="left" y={scenario.bufferStock} label="Safety Stock" stroke="red" strokeDasharray="3 3" />
                          </ComposedChart>
                      </ResponsiveContainer>
                  </div>
              </div>

              {/* 3. Forecast Grid */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:break-inside-avoid">
                  <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                      <h3 className="font-bold text-slate-800">Future Performance Outlook</h3>
                  </div>
                  <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                          <thead className="text-slate-500 bg-slate-50 border-b border-slate-100">
                              <tr>
                                  <th className="px-6 py-3 font-medium">Period</th>
                                  <th className="px-6 py-3 font-medium text-center">Forecast Demand</th>
                                  <th className="px-6 py-3 font-medium text-right">Exp. Revenue</th>
                                  <th className="px-6 py-3 font-medium text-right">Exp. COGS</th>
                                  <th className="px-6 py-3 font-medium text-right">Net Profit</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {periodData.map((p, i) => (
                                  <tr key={i} className="hover:bg-slate-50">
                                      <td className="px-6 py-4 font-bold text-slate-700">{p.label}</td>
                                      <td className="px-6 py-4 text-center">
                                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">{p.qty} units</span>
                                      </td>
                                      <td className="px-6 py-4 text-right text-slate-600">{currency}{p.rev.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                      <td className="px-6 py-4 text-right text-slate-400">{currency}{(p.qty * projections.futureCost).toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                                      <td className="px-6 py-4 text-right font-bold text-emerald-600">
                                          {currency}{p.profit.toLocaleString(undefined, {maximumFractionDigits: 0})}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>

          </div>

          {/* Scenario Sidebar (What-If) */}
          <div className="w-full lg:w-80 bg-white border-l border-slate-200 p-6 flex flex-col overflow-y-auto shadow-xl z-20 print:hidden">
              <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-100">
                  <Sliders size={20} className="text-purple-600"/>
                  <h3 className="font-bold text-slate-900">Scenario Builder</h3>
              </div>

              <div className="space-y-8 flex-1">
                  
                  {/* Price Scenario */}
                  <div>
                      <div className="flex justify-between mb-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Selling Price Change</label>
                          <span className={`text-xs font-bold ${scenario.priceChange > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>
                              {scenario.priceChange > 0 ? '+' : ''}{scenario.priceChange}%
                          </span>
                      </div>
                      <input 
                        type="range" min="-20" max="50" step="5"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        value={scenario.priceChange}
                        onChange={(e) => setScenario({...scenario, priceChange: parseInt(e.target.value)})}
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>New Price: {currency}{projections.futurePrice.toFixed(2)}</span>
                      </div>
                  </div>

                  {/* Cost Scenario */}
                  <div>
                      <div className="flex justify-between mb-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Supplier Cost Change</label>
                          <span className={`text-xs font-bold ${scenario.costChange > 0 ? 'text-red-600' : 'text-slate-600'}`}>
                              {scenario.costChange > 0 ? '+' : ''}{scenario.costChange}%
                          </span>
                      </div>
                      <input 
                        type="range" min="-10" max="50" step="1"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                        value={scenario.costChange}
                        onChange={(e) => setScenario({...scenario, costChange: parseInt(e.target.value)})}
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                          <span>New Cost: {currency}{projections.futureCost.toFixed(2)}</span>
                      </div>
                  </div>

                  {/* Demand Scenario */}
                  <div>
                      <div className="flex justify-between mb-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Demand Spike</label>
                          <span className="text-xs font-bold text-blue-600">{scenario.demandChange > 0 ? '+' : ''}{scenario.demandChange}%</span>
                      </div>
                      <input 
                        type="range" min="-50" max="100" step="10"
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        value={scenario.demandChange}
                        onChange={(e) => setScenario({...scenario, demandChange: parseInt(e.target.value)})}
                      />
                      <div className="text-[10px] text-slate-400 mt-1">
                          Simulate seasonality or campaigns
                      </div>
                  </div>

                  {/* Buffer Stock */}
                  <div>
                      <div className="flex justify-between mb-2">
                          <label className="text-xs font-bold text-slate-500 uppercase">Safety Stock Level</label>
                          <span className="text-xs font-bold text-slate-800">{scenario.bufferStock} units</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <button onClick={() => setScenario({...scenario, bufferStock: Math.max(0, scenario.bufferStock - 5)})} className="w-8 h-8 rounded border flex items-center justify-center hover:bg-slate-50 font-bold text-slate-500">-</button>
                          <input 
                            type="number" 
                            className="flex-1 p-1 border rounded text-center text-sm font-bold"
                            value={scenario.bufferStock}
                            onChange={(e) => setScenario({...scenario, bufferStock: parseInt(e.target.value)})}
                          />
                          <button onClick={() => setScenario({...scenario, bufferStock: scenario.bufferStock + 5})} className="w-8 h-8 rounded border flex items-center justify-center hover:bg-slate-50 font-bold text-slate-500">+</button>
                      </div>
                  </div>

                  {/* Summary Box */}
                  <div className="mt-auto p-4 bg-slate-100 rounded-xl text-sm space-y-2 border border-slate-200">
                      <h4 className="font-bold text-slate-800 text-xs uppercase mb-2">Scenario Outcome</h4>
                      <div className="flex justify-between">
                          <span className="text-slate-600">Forecast ADU</span>
                          <span className="font-mono font-bold">{projections.dailyDemand.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-slate-600">Margin Impact</span>
                          <span className={`font-mono font-bold ${projections.futureMargin >= item.price - (item.cost||0) ? 'text-emerald-600' : 'text-red-600'}`}>
                              {currency}{(projections.futureMargin - (item.price - (item.cost || (item.price * 0.6)))).toFixed(2)}
                          </span>
                      </div>
                  </div>

                  <button 
                    onClick={() => setScenario({ priceChange: 0, costChange: 0, demandChange: 0, bufferStock: item.minStockLevel })}
                    className="w-full py-2 border border-slate-300 rounded-lg text-slate-600 font-bold hover:bg-slate-50 text-xs"
                  >
                      Reset Default
                  </button>
              </div>
          </div>

      </div>
    </div>
  );
};

export default ProductForecastDetail;