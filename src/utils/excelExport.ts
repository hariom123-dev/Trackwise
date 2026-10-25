import * as XLSX from 'xlsx';

export interface ScorecardMetrics {
  ruleOf40: number;
  ruleOf40Status: string;
  arpu: number;
  ltv: number;
  ltvCac: string;
  payback: string;
  netSurplus: number;
  runway: string;
  margin: number;
  churnRate: number;
}

export function exportMultiSheetExcel(
  records: any[],
  forecast: any[],
  scorecard: ScorecardMetrics
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Historical_TimeSeries
  const historyData = records.map((r) => {
    const rev = Number(r.revenue) || 0;
    const exp = Number(r.expenses) || 0;
    const churn = Number(r.churnRate ?? r.churn_rate) || 0;
    return {
      Period: r.period || 'Unknown',
      Monthly_Recurring_Revenue_INR: rev,
      Operating_Expenses_INR: exp,
      Active_Subscribers: Number(r.customers) || 0,
      Net_Monthly_Churn_Pct: churn,
      Net_Operating_Surplus_INR: rev - exp,
      Operating_Margin_Pct: rev > 0 ? Number((((rev - exp) / rev) * 100).toFixed(1)) : 0,
      Industry: r.industry || 'B2B SaaS',
    };
  });

  const wsHistory = XLSX.utils.json_to_sheet(
    historyData.length > 0
      ? historyData
      : [
          {
            Period: '2026-04',
            Monthly_Recurring_Revenue_INR: 8000000,
            Operating_Expenses_INR: 4500000,
            Active_Subscribers: 420,
            Net_Monthly_Churn_Pct: 1.8,
            Net_Operating_Surplus_INR: 3500000,
            Operating_Margin_Pct: 43.8,
            Industry: 'B2B SaaS',
          },
        ]
  );
  XLSX.utils.book_append_sheet(wb, wsHistory, 'Historical_TimeSeries');

  // Sheet 2: AI_6Month_Forecast
  const forecastData = forecast.map((f, i) => {
    const baseline = Number(f.baselineRevenue || f.revenue) || 0;
    const simulated = Number(f.simulatedRevenue || f.revenue) || baseline;
    const profit = Number(f.simulatedProfit) || Math.round(simulated * 0.43);
    return {
      Forecast_Month: f.month || `Month +${i + 1}`,
      Baseline_MRR_INR: baseline,
      Simulated_MRR_INR: simulated,
      Projected_Net_Surplus_INR: profit,
      MRR_Expansion_Delta_INR: simulated - baseline,
    };
  });

  const wsForecast = XLSX.utils.json_to_sheet(
    forecastData.length > 0
      ? forecastData
      : [
          {
            Forecast_Month: 'May 2026',
            Baseline_MRR_INR: 8400000,
            Simulated_MRR_INR: 8400000,
            Projected_Net_Surplus_INR: 3650000,
            MRR_Expansion_Delta_INR: 0,
          },
          {
            Forecast_Month: 'Jun 2026',
            Baseline_MRR_INR: 8820000,
            Simulated_MRR_INR: 8820000,
            Projected_Net_Surplus_INR: 3840000,
            MRR_Expansion_Delta_INR: 0,
          },
          {
            Forecast_Month: 'Jul 2026',
            Baseline_MRR_INR: 9260000,
            Simulated_MRR_INR: 9260000,
            Projected_Net_Surplus_INR: 4030000,
            MRR_Expansion_Delta_INR: 0,
          },
          {
            Forecast_Month: 'Aug 2026',
            Baseline_MRR_INR: 9720000,
            Simulated_MRR_INR: 9720000,
            Projected_Net_Surplus_INR: 4230000,
            MRR_Expansion_Delta_INR: 0,
          },
          {
            Forecast_Month: 'Sep 2026',
            Baseline_MRR_INR: 10210000,
            Simulated_MRR_INR: 10210000,
            Projected_Net_Surplus_INR: 4450000,
            MRR_Expansion_Delta_INR: 0,
          },
          {
            Forecast_Month: 'Oct 2026',
            Baseline_MRR_INR: 10720000,
            Simulated_MRR_INR: 10720000,
            Projected_Net_Surplus_INR: 4670000,
            MRR_Expansion_Delta_INR: 0,
          },
        ]
  );
  XLSX.utils.book_append_sheet(wb, wsForecast, 'AI_6Month_Forecast');

  // Sheet 3: Unit_Economics_Summary
  const summaryData = [
    {
      Metric: 'Rule of 40 Efficiency Score',
      Calculated_Value: `${scorecard.ruleOf40}%`,
      Industry_Benchmark: '> 40.0%',
      Evaluation: scorecard.ruleOf40Status,
    },
    {
      Metric: 'Operating Margin',
      Calculated_Value: `${scorecard.margin.toFixed(1)}%`,
      Industry_Benchmark: '> 25.0%',
      Evaluation: scorecard.margin > 35 ? 'High Operating Margin' : 'Healthy',
    },
    {
      Metric: 'Monthly Churn %',
      Calculated_Value: `${scorecard.churnRate.toFixed(1)}%`,
      Industry_Benchmark: '< 2.0%',
      Evaluation: scorecard.churnRate < 2.0 ? 'Top Tier SaaS Retention' : 'Focus Area',
    },
    {
      Metric: 'Average Revenue Per User (ARPU)',
      Calculated_Value: `₹${scorecard.arpu.toFixed(2)}/mo`,
      Industry_Benchmark: 'N/A',
      Evaluation: 'Monthly Blended ARPU',
    },
    {
      Metric: 'Customer Lifetime Value (LTV)',
      Calculated_Value: `₹${scorecard.ltv.toLocaleString()}`,
      Industry_Benchmark: '> ₹5,00,000',
      Evaluation: 'Strong Long-Term Value',
    },
    {
      Metric: 'LTV : CAC Multiple',
      Calculated_Value: scorecard.ltvCac,
      Industry_Benchmark: '> 3.0x',
      Evaluation: 'Efficient Go-To-Market Engine',
    },
    {
      Metric: 'CAC Payback Horizon',
      Calculated_Value: scorecard.payback,
      Industry_Benchmark: '< 12 Months',
      Evaluation: 'Rapid Capital Recovery',
    },
    {
      Metric: 'Monthly Net Cash Surplus',
      Calculated_Value: `₹${scorecard.netSurplus.toLocaleString()}/mo`,
      Industry_Benchmark: '> ₹0',
      Evaluation: 'Self-Funded Organic Growth',
    },
    {
      Metric: 'Operating Runway',
      Calculated_Value: scorecard.runway,
      Industry_Benchmark: '> 18 Months',
      Evaluation: 'Zero Cash Flow Stress',
    },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Unit_Economics_Summary');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `TrackWise_Executive_SaaS_Financial_Model_${dateStr}.xlsx`);
}
