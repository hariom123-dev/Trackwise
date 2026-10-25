import React, { useState, useMemo } from 'react';
import { 
  Sliders, 
  TrendingUp, 
  RotateCcw, 
  Percent, 
  Activity,
  Layers
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { formatCurrency, formatCompactCurrency } from '../utils/currency';

interface WhatIfScenarioSimulatorProps {
  baseRevenue: number;
  baseExpenses: number;
  baseCustomers: number;
  baseChurnRate: number;
  baseGrowthRate?: number;
  currency?: string;
}

export default function WhatIfScenarioSimulator({
  baseRevenue,
  baseExpenses,
  baseCustomers,
  baseChurnRate,
  baseGrowthRate = 5.0,
  currency = 'INR',
}: WhatIfScenarioSimulatorProps) {
  // 4 Interactive Sliders for SaaS Financial Levers
  const [arpuAdjustment, setArpuAdjustment] = useState<number>(10); // +10% Pricing / ARPU expansion
  const [churnReduction, setChurnReduction] = useState<number>(0.5); // -0.5% Monthly Churn reduction
  const [growthBoost, setGrowthBoost] = useState<number>(8); // +8% New ARR growth
  const [expenseAdjustment, setExpenseAdjustment] = useState<number>(-5); // -5% OPEX reduction

  const handleReset = () => {
    setArpuAdjustment(0);
    setChurnReduction(0);
    setGrowthBoost(0);
    setExpenseAdjustment(0);
  };

  // 6-Month Projection Computation (Compounding Dual-Curve)
  const simulationData = useMemo(() => {
    const monthNames = ['Month +1', 'Month +2', 'Month +3', 'Month +4', 'Month +5', 'Month +6'];
    const data = [];

    const baseMonthlyNetRate = (baseGrowthRate / 100) - (baseChurnRate / 100) * 0.4;
    const effectiveChurn = Math.max(0.1, baseChurnRate - churnReduction);
    const simulatedMonthlyNetRate = ((baseGrowthRate + growthBoost) / 100) - (effectiveChurn / 100) * 0.4;

    const simulatedStartRev = baseRevenue * (1 + arpuAdjustment / 100);
    const simulatedStartExp = baseExpenses * (1 + expenseAdjustment / 100);

    let currBaseRev = baseRevenue;
    let currSimRev = simulatedStartRev;
    let currSimExp = simulatedStartExp;

    let totalBaseRev = 0;
    let totalSimRev = 0;
    let totalSimProfit = 0;

    for (let i = 0; i < 6; i++) {
      currBaseRev = currBaseRev * (1 + baseMonthlyNetRate);
      currSimRev = currSimRev * (1 + simulatedMonthlyNetRate);
      // OPEX scales slightly with enterprise account growth
      currSimExp = currSimExp * (1 + simulatedMonthlyNetRate * 0.25);

      const simProfit = currSimRev - currSimExp;

      totalBaseRev += currBaseRev;
      totalSimRev += currSimRev;
      totalSimProfit += simProfit;

      data.push({
        month: monthNames[i],
        baselineRevenue: Math.round(currBaseRev),
        simulatedRevenue: Math.round(currSimRev),
        simulatedProfit: Math.round(simProfit),
        revenueDelta: Math.round(currSimRev - currBaseRev),
      });
    }

    const cumulativeDelta = Math.round(totalSimRev - totalBaseRev);
    const endSimRev = data[data.length - 1].simulatedRevenue;
    const endSimExp = Math.round(currSimExp);
    const endMargin = endSimRev > 0 ? ((endSimRev - endSimExp) / endSimRev) * 100 : 0;

    return {
      chartData: data,
      cumulativeDelta,
      endSimRev,
      endMargin,
      totalSimProfit: Math.round(totalSimProfit),
      effectiveChurn,
    };
  }, [
    baseRevenue,
    baseExpenses,
    baseCustomers,
    baseChurnRate,
    baseGrowthRate,
    arpuAdjustment,
    churnReduction,
    growthBoost,
    expenseAdjustment,
  ]);

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/80 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
            <Sliders size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                What-If Scenario & Runway Simulator
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Live Dual-Curve
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Simulate sensitivity to price adjustments, churn suppression, new ARR growth, and OPEX cuts.
            </p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw size={12} />
          <span>Reset Sliders</span>
        </button>
      </div>

      {/* 4 Interactive Sliders Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80">
        {/* Slider 1: Pricing / ARPU Boost */}
        <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Pricing / ARPU Boost</span>
            <span className={`font-extrabold ${arpuAdjustment >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>
              {arpuAdjustment >= 0 ? '+' : ''}{arpuAdjustment}%
            </span>
          </div>
          <input
            type="range"
            min="-20"
            max="50"
            step="1"
            value={arpuAdjustment}
            onChange={(e) => setArpuAdjustment(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>-20% (Discount)</span>
            <span>+50% (Upsell / Tier Expansion)</span>
          </div>
        </div>

        {/* Slider 2: Churn Reduction */}
        <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Churn Reduction</span>
            <span className={`font-extrabold ${churnReduction >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {churnReduction >= 0 ? '-' : '+'}{Math.abs(churnReduction).toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min="-3"
            max="3"
            step="0.1"
            value={churnReduction}
            onChange={(e) => setChurnReduction(Number(e.target.value))}
            className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>+3.0% (Risk)</span>
            <span>-3.0% (Retention Pipeline)</span>
          </div>
        </div>

        {/* Slider 3: New Monthly Growth */}
        <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">New Monthly Growth</span>
            <span className={`font-extrabold ${growthBoost >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
              {growthBoost >= 0 ? '+' : ''}{growthBoost}%
            </span>
          </div>
          <input
            type="range"
            min="-10"
            max="30"
            step="1"
            value={growthBoost}
            onChange={(e) => setGrowthBoost(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>-10% (Market Headwind)</span>
            <span>+30% (Outbound Acceleration)</span>
          </div>
        </div>

        {/* Slider 4: Operating Expense Optimization */}
        <div className="space-y-2 bg-white p-3.5 rounded-xl border border-slate-100 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">Operating Expense Optimization</span>
            <span className={`font-extrabold ${expenseAdjustment <= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {expenseAdjustment >= 0 ? '+' : ''}{expenseAdjustment}%
            </span>
          </div>
          <input
            type="range"
            min="-30"
            max="50"
            step="1"
            value={expenseAdjustment}
            onChange={(e) => setExpenseAdjustment(Number(e.target.value))}
            className="w-full accent-purple-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>-30% (Cloud & G&A Cuts)</span>
            <span>+50% (Hiring Expansion)</span>
          </div>
        </div>
      </div>

      {/* Live Impact Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
            6-Month Cumulative Delta
          </span>
          <span className="text-xl font-black text-emerald-700 block mt-0.5">
            {simulationData.cumulativeDelta >= 0 ? '+' : ''}{formatCompactCurrency(simulationData.cumulativeDelta, currency)}
          </span>
          <span className="text-[10px] text-emerald-600 font-medium">vs. Unaltered Baseline</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/80">
          <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider block">
            Month 6 Ending MRR
          </span>
          <span className="text-xl font-black text-indigo-700 block mt-0.5">
            {formatCompactCurrency(simulationData.endSimRev, currency)}
          </span>
          <span className="text-[10px] text-indigo-600 font-medium">Simulated Run Rate</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200/80">
          <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
            Operating Margin
          </span>
          <span className="text-xl font-black text-purple-700 block mt-0.5">
            {simulationData.endMargin.toFixed(1)}%
          </span>
          <span className="text-[10px] text-purple-600 font-medium">Post-Expense Optimization</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
            6-Month Net Cash Generated
          </span>
          <span className="text-xl font-black text-blue-700 block mt-0.5">
            +{formatCompactCurrency(simulationData.totalSimProfit, currency)}
          </span>
          <span className="text-[10px] text-blue-600 font-medium">Cumulative Operating Cash</span>
        </div>
      </div>

      {/* Dual-Curve Live Recharts Visualization */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Dual-Curve Trajectory: Baseline vs. Simulated Scenario
            </h4>
          </div>
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
            Drag sliders to simulate business outcomes instantly
          </span>
        </div>

        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={simulationData.chartData}>
              <defs>
                <linearGradient id="simRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="baseRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                dy={6}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                tickFormatter={(val) => formatCompactCurrency(val, currency)}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '14px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  fontSize: '12px',
                }}
                formatter={(value: any, name: any) => [
                  formatCurrency(Number(value), currency),
                  name === 'simulatedRevenue'
                    ? 'Simulated MRR'
                    : name === 'baselineRevenue'
                    ? 'Baseline MRR'
                    : 'Simulated Net Operating Profit',
                ]}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '11px', fontWeight: 600 }}
                formatter={(val) =>
                  val === 'simulatedRevenue'
                    ? 'Simulated MRR'
                    : val === 'baselineRevenue'
                    ? 'Baseline MRR'
                    : 'Simulated Net Profit'
                }
              />
              <Area
                type="monotone"
                dataKey="baselineRevenue"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="4 4"
                fill="url(#baseRevGrad)"
              />
              <Area
                type="monotone"
                dataKey="simulatedRevenue"
                stroke="#10b981"
                strokeWidth={3}
                fill="url(#simRevGrad)"
              />
              <Line
                type="monotone"
                dataKey="simulatedProfit"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#8b5cf6' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
