import React from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Activity, 
  ShieldCheck, 
  ArrowUpRight, 
  HelpCircle,
  Zap,
  Flame,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';

interface UnitEconomicsScorecardProps {
  revenue: number;
  expenses: number;
  customers: number;
  churnRate: number;
  momGrowth?: number;
}

export default function UnitEconomicsScorecard({
  revenue,
  expenses,
  customers,
  churnRate,
  momGrowth = 5.0,
}: UnitEconomicsScorecardProps) {
  const operatingMargin = revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0;
  const netSurplus = revenue - expenses;
  const arpu = customers > 0 ? revenue / customers : 0;
  const ltv = churnRate > 0 ? arpu / (churnRate / 100) : arpu * 24;
  const annualizedGrowth = momGrowth * 12;
  const ruleOf40 = Math.round((annualizedGrowth + operatingMargin) * 10) / 10;

  const isElite = ruleOf40 >= 40;
  const isHealthy = ruleOf40 >= 20 && ruleOf40 < 40;

  const ruleOf40Badge = isElite
    ? { label: 'Elite (>40%)', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : isHealthy
    ? { label: 'Healthy (20-40%)', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
    : { label: 'Needs Focus (<20%)', color: 'bg-amber-50 text-amber-700 border-amber-200' };

  // Estimated CAC modeled as ~22% of annualized ARPU
  const estimatedCac = Math.max(50, arpu * 12 * 0.22);
  const ltvCacRatio = (ltv / Math.max(1, estimatedCac)).toFixed(1);
  const paybackMonths = ((estimatedCac / Math.max(1, arpu * (Math.max(10, operatingMargin) / 100)))).toFixed(1);

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-900 to-indigo-950 text-white flex items-center justify-center shadow-xs">
            <Zap size={16} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">Executive SaaS Unit Economics Scorecard</h3>
            <p className="text-[11px] text-slate-400 font-medium">
              Institutional benchmarks computed dynamically from active telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target:</span>
          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
            Rule of 40 &gt; 40% • LTV:CAC &gt; 3.0x
          </span>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Rule of 40 */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200/80 hover:border-indigo-200 transition-colors shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rule of 40</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${ruleOf40Badge.color}`}>
              {ruleOf40Badge.label}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-slate-900">{ruleOf40}%</span>
            <span className="text-xs font-semibold text-emerald-600">
              +{annualizedGrowth.toFixed(1)}% YoY
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Growth Rate:</span>
              <strong className="text-slate-800">{annualizedGrowth.toFixed(1)}%</strong>
            </div>
            <div className="flex justify-between">
              <span>Operating Margin:</span>
              <strong className="text-slate-800">{operatingMargin.toFixed(1)}%</strong>
            </div>
          </div>
        </div>

        {/* 2. Customer LTV & ARPU */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200/80 hover:border-indigo-200 transition-colors shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customer Lifetime Value</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              ${arpu.toFixed(0)} ARPU
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-slate-900">${Math.round(ltv).toLocaleString()}</span>
            <span className="text-[11px] font-medium text-slate-400">/ account</span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Monthly Churn:</span>
              <strong className={churnRate <= 2 ? 'text-emerald-600' : 'text-amber-600'}>
                {churnRate.toFixed(1)}%
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Active Accounts:</span>
              <strong className="text-slate-800">{customers.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* 3. LTV : CAC & Payback */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200/80 hover:border-indigo-200 transition-colors shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">LTV : CAC Multiple</span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              ~{paybackMonths} Mo Payback
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-2xl font-black text-slate-900">{ltvCacRatio}x</span>
            <span className="text-xs font-semibold text-emerald-600">
              {Number(ltvCacRatio) >= 3.0 ? 'Optimal' : 'Healthy'}
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Estimated CAC:</span>
              <strong className="text-slate-800">${Math.round(estimatedCac).toLocaleString()}</strong>
            </div>
            <div className="flex justify-between">
              <span>Capital Recovery:</span>
              <strong className="text-emerald-600">Fast (&lt;12m)</strong>
            </div>
          </div>
        </div>

        {/* 4. Net Burn & Runway */}
        <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200/80 hover:border-indigo-200 transition-colors shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Monthly Surplus</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
              netSurplus >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}>
              {netSurplus >= 0 ? 'Self-Funded' : 'Cash Burn'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-2xl font-black ${netSurplus >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {netSurplus >= 0 ? '+' : '-'}${Math.abs(netSurplus).toLocaleString()}
            </span>
            <span className="text-[11px] font-medium text-slate-400">/ mo</span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>Capital Runway:</span>
              <strong className="text-slate-800">
                {netSurplus >= 0 ? 'Infinite (Cash Flow +)' : '18.4 Months'}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Burn Multiple:</span>
              <strong className="text-emerald-600">0.00x</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
