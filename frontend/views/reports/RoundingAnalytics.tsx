import React, { useEffect, useMemo, useState } from 'react';
import {
  getProductPriceHistory,
  getRoundingDashboardData,
  getRoundingMethodPerformance,
  getRoundingPeriodReport,
  getRoundingProductPerformance,
  getRoundingProfitProjection,
  getRoundingProfitSummary,
  getRoundingSmartInsights,
  getTopProductsByRoundingProfit
} from '../../services/roundingAnalyticsService';
import {
  RoundingDashboardData,
  RoundingInsight,
  RoundingMethodPerformanceRow,
  RoundingPeriodReportRow,
  RoundingPriceHistoryEntry,
  RoundingProductPerformanceRow,
  RoundingProfitProjection,
  RoundingProfitSummary,
  RoundingTopProductRow
} from '../../types';
import { useData } from '../../context/DataContext';

const buildHistoryKey = (productId: string, variantId?: string) => `${productId}::${variantId || ''}`;

const parseHistoryKey = (value: string): { productId: string; variantId?: string } => {
  const [productId, variantId] = value.split('::');
  return {
    productId,
    variantId: variantId || undefined
  };
};

const RoundingAnalytics: React.FC = () => {
  const { companyConfig } = useData();
  const currency = companyConfig?.currencySymbol || '$';

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<RoundingProfitSummary | null>(null);
  const [dashboard, setDashboard] = useState<RoundingDashboardData | null>(null);
  const [productRows, setProductRows] = useState<RoundingProductPerformanceRow[]>([]);
  const [dailyRows, setDailyRows] = useState<RoundingPeriodReportRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<RoundingPeriodReportRow[]>([]);
  const [methodRows, setMethodRows] = useState<RoundingMethodPerformanceRow[]>([]);
  const [topProducts, setTopProducts] = useState<RoundingTopProductRow[]>([]);
  const [projection, setProjection] = useState<RoundingProfitProjection | null>(null);
  const [insights, setInsights] = useState<RoundingInsight[]>([]);
  const [selectedHistoryKey, setSelectedHistoryKey] = useState<string>('');
  const [priceHistory, setPriceHistory] = useState<RoundingPriceHistoryEntry[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const [
          summaryData,
          dashboardData,
          productPerformance,
          dailyReport,
          monthlyReport,
          methodPerformance,
          topProductRows,
          projectionData,
          insightsData
        ] = await Promise.all([
          getRoundingProfitSummary(),
          getRoundingDashboardData(),
          getRoundingProductPerformance(),
          getRoundingPeriodReport('day'),
          getRoundingPeriodReport('month'),
          getRoundingMethodPerformance(),
          getTopProductsByRoundingProfit(10),
          getRoundingProfitProjection(30, 30),
          getRoundingSmartInsights()
        ]);

        if (!active) return;
        setSummary(summaryData);
        setDashboard(dashboardData);
        setProductRows(productPerformance);
        setDailyRows(dailyReport.slice(-30));
        setMonthlyRows(monthlyReport.slice(-12));
        setMethodRows(methodPerformance);
        setTopProducts(topProductRows);
        setProjection(projectionData);
        setInsights(insightsData);

        if (!selectedHistoryKey && productPerformance.length > 0) {
          const first = productPerformance[0];
          setSelectedHistoryKey(buildHistoryKey(first.product_id, first.variant_id));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedHistoryKey) {
      setPriceHistory([]);
      return;
    }

    let active = true;
    const loadHistory = async () => {
      const selected = parseHistoryKey(selectedHistoryKey);
      const history = await getProductPriceHistory(selected.productId, selected.variantId);
      if (!active) return;
      setPriceHistory(history);
    };

    loadHistory();
    return () => {
      active = false;
    };
  }, [selectedHistoryKey]);

  const historyOptions = useMemo(() => {
    return productRows.map((row) => ({
      key: buildHistoryKey(row.product_id, row.variant_id),
      label: row.variant_id
        ? `${row.product_name} (${row.variant_id})`
        : row.product_name
    }));
  }, [productRows]);

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-slate-500">Loading rounding analytics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Dashboard Widgets</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Rounding Profit Today</p>
            <p className="font-semibold">{currency}{Number(dashboard?.rounding_profit_today || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-slate-500">Rounding Profit This Month</p>
            <p className="font-semibold">{currency}{Number(dashboard?.rounding_profit_this_month || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-slate-500">Top Product</p>
            <p className="font-semibold">{dashboard?.top_product_name || 'N/A'}</p>
            <p className="text-xs text-slate-500">{currency}{Number(dashboard?.top_product_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-slate-500">Avg Rounding Gain / Unit</p>
            <p className="font-semibold">{currency}{Number(dashboard?.avg_rounding_gain_per_unit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Total Rounding Profit</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Potential Rounding Profit</p>
            <p className="font-semibold">{currency}{Number(summary?.potential_rounding_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-slate-500">Realized Rounding Profit</p>
            <p className="font-semibold">{currency}{Number(summary?.realized_rounding_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-slate-500">Rounding Impact %</p>
            <p className="font-semibold">{Number(summary?.rounding_profit_percentage || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}%</p>
          </div>
          <div>
            <p className="text-slate-500">Products with Rounding</p>
            <p className="font-semibold">{Number(summary?.products_with_rounding || 0).toLocaleString()}</p>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Product Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2">Product</th>
                <th className="py-2">Rounded Diff / Unit</th>
                <th className="py-2">Qty Sold</th>
                <th className="py-2">Profit</th>
              </tr>
            </thead>
            <tbody>
              {productRows.map((row) => (
                <tr key={buildHistoryKey(row.product_id, row.variant_id)} className="border-b border-slate-100">
                  <td className="py-2">{row.product_name}</td>
                  <td className="py-2">{currency}{Number(row.rounded_diff_per_unit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-2">{Number(row.qty_sold || 0).toLocaleString()}</td>
                  <td className="py-2">{currency}{Number(row.realized_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {productRows.length === 0 && (
                <tr>
                  <td className="py-2 text-slate-500" colSpan={4}>No rounding product performance data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Daily Report</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2">Date</th>
                  <th className="py-2">Products Updated</th>
                  <th className="py-2">Potential Profit</th>
                  <th className="py-2">Realized Profit</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row) => (
                  <tr key={row.period} className="border-b border-slate-100">
                    <td className="py-2">{row.period}</td>
                    <td className="py-2">{Number(row.products_updated || 0).toLocaleString()}</td>
                    <td className="py-2">{currency}{Number(row.potential_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-2">{currency}{Number(row.realized_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Monthly Report</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2">Month</th>
                  <th className="py-2">Products Updated</th>
                  <th className="py-2">Potential Profit</th>
                  <th className="py-2">Realized Profit</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((row) => (
                  <tr key={row.period} className="border-b border-slate-100">
                    <td className="py-2">{row.period}</td>
                    <td className="py-2">{Number(row.products_updated || 0).toLocaleString()}</td>
                    <td className="py-2">{currency}{Number(row.potential_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-2">{currency}{Number(row.realized_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Method Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2">Method</th>
                  <th className="py-2">Potential Profit</th>
                  <th className="py-2">Realized Profit</th>
                </tr>
              </thead>
              <tbody>
                {methodRows.map((row) => (
                  <tr key={row.method} className="border-b border-slate-100">
                    <td className="py-2">{row.method}</td>
                    <td className="py-2">{currency}{Number(row.potential_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="py-2">{currency}{Number(row.realized_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Top Products by Rounding Profit</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-2">Product</th>
                  <th className="py-2">Qty Sold</th>
                  <th className="py-2">Profit</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((row) => (
                  <tr key={buildHistoryKey(row.product_id, row.variant_id)} className="border-b border-slate-100">
                    <td className="py-2">{row.product_name}</td>
                    <td className="py-2">{Number(row.qty_sold || 0).toLocaleString()}</td>
                    <td className="py-2">{currency}{Number(row.realized_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Profit Projection and Smart Insights</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-slate-600">Lookback: {projection?.lookback_days || 0} days</p>
            <p className="text-sm text-slate-600">Average Daily Realized Profit: {currency}{Number(projection?.average_daily_realized_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <p className="text-sm font-semibold">Projected {projection?.projected_days || 0} day profit: {currency}{Number(projection?.projected_realized_profit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <ul className="list-disc ml-5 space-y-2 text-sm">
              {insights.map((insight) => (
                <li key={insight.id}>
                  <span className="font-semibold">{insight.title}:</span> {insight.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Price History</h3>
        <div className="mb-3">
          <select
            value={selectedHistoryKey}
            onChange={(event) => setSelectedHistoryKey(event.target.value)}
            className="border border-slate-300 rounded px-2 py-1 text-sm"
          >
            {historyOptions.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
            {historyOptions.length === 0 && <option value="">No products</option>}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-200">
                <th className="py-2">Date</th>
                <th className="py-2">Version</th>
                <th className="py-2">Previous Price</th>
                <th className="py-2">New Price</th>
                <th className="py-2">Rounding Difference</th>
              </tr>
            </thead>
            <tbody>
              {priceHistory.map((entry) => (
                <tr key={entry.id} className="border-b border-slate-100">
                  <td className="py-2">{entry.date.slice(0, 10)}</td>
                  <td className="py-2">{entry.version}</td>
                  <td className="py-2">{entry.previous_rounded_price === null ? '-' : `${currency}${Number(entry.previous_rounded_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</td>
                  <td className="py-2">{currency}{Number(entry.rounded_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="py-2">{currency}{Number(entry.rounding_difference).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
              {priceHistory.length === 0 && (
                <tr>
                  <td className="py-2 text-slate-500" colSpan={5}>No price history found for the selected product.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default RoundingAnalytics;
