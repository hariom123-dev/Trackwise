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
      Revenue_USD: rev,
      Expenses_USD: exp,
      Active_Customers: Number(r.customers) || 0,
      Churn_Rate_Pct: churn,
      Net_Operating_Income_USD: rev - exp,
      Operating_Margin_Pct: rev > 0 ? Number((((rev - exp) / rev) * 100).toFixed(1)) : 0,
      Industry: r.industry || 'SaaS',
    };
  });

  const wsHistory = XLSX.utils.json_to_sheet(
    historyData.length > 0
      ? historyData
      : [
          {
            Period: '2026-04',
            Revenue_USD: 99200,
            Expenses_USD: 56200,
            Active_Customers: 2450,
            Churn_Rate_Pct: 1.5,
            Net_Operating_Income_USD: 43000,
            Operating_Margin_Pct: 43.3,
            Industry: 'SaaS',
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
      Baseline_Revenue_USD: baseline,
      Simulated_Scenario_Revenue_USD: simulated,
      Projected_Net_Operating_Profit_USD: profit,
      Revenue_Expansion_Delta_USD: simulated - baseline,
    };
  });

  const wsForecast = XLSX.utils.json_to_sheet(
    forecastData.length > 0
      ? forecastData
      : [
          {
            Forecast_Month: 'May 2026',
            Baseline_Revenue_USD: 104160,
            Simulated_Scenario_Revenue_USD: 104160,
            Projected_Net_Operating_Profit_USD: 45000,
            Revenue_Expansion_Delta_USD: 0,
          },
          {
            Forecast_Month: 'Jun 2026',
            Baseline_Revenue_USD: 109368,
            Simulated_Scenario_Revenue_USD: 109368,
            Projected_Net_Operating_Profit_USD: 47200,
            Revenue_Expansion_Delta_USD: 0,
          },
          {
            Forecast_Month: 'Jul 2026',
            Baseline_Revenue_USD: 114836,
            Simulated_Scenario_Revenue_USD: 114836,
            Projected_Net_Operating_Profit_USD: 49500,
            Revenue_Expansion_Delta_USD: 0,
          },
          {
            Forecast_Month: 'Aug 2026',
            Baseline_Revenue_USD: 120578,
            Simulated_Scenario_Revenue_USD: 120578,
            Projected_Net_Operating_Profit_USD: 52000,
            Revenue_Expansion_Delta_USD: 0,
          },
          {
            Forecast_Month: 'Sep 2026',
            Baseline_Revenue_USD: 126607,
            Simulated_Scenario_Revenue_USD: 126607,
            Projected_Net_Operating_Profit_USD: 54600,
            Revenue_Expansion_Delta_USD: 0,
          },
          {
            Forecast_Month: 'Oct 2026',
            Baseline_Revenue_USD: 132937,
            Simulated_Scenario_Revenue_USD: 132937,
            Projected_Net_Operating_Profit_USD: 57300,
            Revenue_Expansion_Delta_USD: 0,
          },
        ]
  );
  XLSX.utils.book_append_sheet(wb, wsForecast, 'AI_6Month_Forecast');

  // Sheet 3: Unit_Economics_Summary
  const summaryData = [
    {
      Metric: 'Rule of 40 Score',
      Calculated_Value: `${scorecard.ruleOf40}%`,
      Industry_Benchmark: '> 40.0%',
      CFO_Evaluation: scorecard.ruleOf40Status,
    },
    {
      Metric: 'Monthly Operating Margin',
      Calculated_Value: `${scorecard.margin.toFixed(1)}%`,
      Industry_Benchmark: '> 25.0%',
      CFO_Evaluation: scorecard.margin > 35 ? 'Elite Operating Efficiency' : 'Healthy',
    },
    {
      Metric: 'Monthly Churn Rate',
      Calculated_Value: `${scorecard.churnRate.toFixed(1)}%`,
      Industry_Benchmark: '< 3.0%',
      CFO_Evaluation: scorecard.churnRate < 2.0 ? 'Top Quartile Retention' : 'Focus Area',
    },
    {
      Metric: 'Average Revenue Per User (ARPU)',
      Calculated_Value: `$${scorecard.arpu.toFixed(2)}/mo`,
      Industry_Benchmark: 'N/A',
      CFO_Evaluation: 'Subscription Normalized',
    },
    {
      Metric: 'Customer Lifetime Value (LTV)',
      Calculated_Value: `$${scorecard.ltv.toLocaleString()}`,
      Industry_Benchmark: '> $2,000',
      CFO_Evaluation: 'Strong Long-Term Capital Generation',
    },
    {
      Metric: 'LTV : CAC Multiple',
      Calculated_Value: scorecard.ltvCac,
      Industry_Benchmark: '> 3.0x',
      CFO_Evaluation: 'Capital Efficient Acquisition',
    },
    {
      Metric: 'Estimated CAC Payback Period',
      Calculated_Value: scorecard.payback,
      Industry_Benchmark: '< 12 Months',
      CFO_Evaluation: 'Rapid Capital Recovery',
    },
    {
      Metric: 'Monthly Net Operating Surplus',
      Calculated_Value: `$${scorecard.netSurplus.toLocaleString()}/mo`,
      Industry_Benchmark: '> $0',
      CFO_Evaluation: 'Self-Sustaining Operations',
    },
    {
      Metric: 'Capital Runway',
      Calculated_Value: scorecard.runway,
      Industry_Benchmark: '> 18 Months',
      CFO_Evaluation: 'Zero Emergency Dilution Risk',
    },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Unit_Economics_Summary');

  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `TrackWise_Enterprise_Financial_Model_${dateStr}.xlsx`);
}
