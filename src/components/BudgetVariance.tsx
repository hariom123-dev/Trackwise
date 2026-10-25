import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Sliders,
  X,
  ChevronDown,
  Calendar,
  Sparkles,
  DollarSign,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { apiFetch } from '../utils/api';
import { formatCompactCurrency, formatCurrency } from '../utils/currency';
import { toast } from 'sonner';

export interface BudgetRecord {
  id: string;
  workspaceId: string;
  period: string;
  revenueTarget: number;
  expenseBudget: number;
  createdAt: string;
}

interface BudgetVarianceProps {
  records: Array<{
    period: string;
    revenue: number;
    expenses: number;
    customers?: number;
    churnRate?: number;
  }>;
  currency?: string;
  workspaceId?: string;
}

export const BudgetVariance: React.FC<BudgetVarianceProps> = ({
  records,
  currency = 'INR',
  workspaceId,
}) => {
  const [budgets, setBudgets] = useState<BudgetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);

  // Form state for budget adjustment modal
  const [targetRevenueInput, setTargetRevenueInput] = useState<number>(0);
  const [expenseBudgetInput, setExpenseBudgetInput] = useState<number>(0);

  // Fetch budgets from backend
  const fetchBudgets = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ budgets: BudgetRecord[] }>('/api/budgets');
      if (res?.budgets) {
        setBudgets(res.budgets);
      }
    } catch (err) {
      console.warn('Could not load budgets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, [workspaceId]);

  // Set default selected period to latest record period
  useEffect(() => {
    if (records.length > 0 && !selectedPeriod) {
      setSelectedPeriod(records[records.length - 1].period);
    } else if (budgets.length > 0 && !selectedPeriod) {
      setSelectedPeriod(budgets[budgets.length - 1].period);
    }
  }, [records, budgets, selectedPeriod]);

  // Match actual and budget for the selected period
  const actual = records.find((r) => r.period === selectedPeriod) || records[records.length - 1] || {
    period: selectedPeriod || '2026-04',
    revenue: 7936000,
    expenses: 4496000,
  };

  const budget = budgets.find((b) => b.period === selectedPeriod) || {
    id: 'fallback',
    workspaceId: workspaceId || '',
    period: selectedPeriod || '2026-04',
    revenueTarget: 8000000,
    expenseBudget: 4400000,
    createdAt: new Date().toISOString(),
  };

  const actualRevenue = actual.revenue;
  const actualExpenses = actual.expenses;
  const revenueTarget = budget.revenueTarget || 1;
  const expenseBudget = budget.expenseBudget || 1;

  // Key variance calculations
  const revenueAttainment = Number(((actualRevenue / revenueTarget) * 100).toFixed(1));
  const expenseUtilization = Number(((actualExpenses / expenseBudget) * 100).toFixed(1));
  const isOverBudget = expenseUtilization > 100;

  const revenueVariance = actualRevenue - revenueTarget;
  const expenseVariance = expenseBudget - actualExpenses; // positive = budget savings, negative = over budget
  const netActual = actualRevenue - actualExpenses;
  const netTarget = revenueTarget - expenseBudget;
  const netVariance = netActual - netTarget;

  // Open adjustment modal pre-populated
  const handleOpenAdjustModal = () => {
    setTargetRevenueInput(revenueTarget);
    setExpenseBudgetInput(expenseBudget);
    setIsAdjustModalOpen(true);
  };

  // Submit updated budget target
  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBudget(true);
    try {
      const res = await apiFetch<{ success: boolean; budget: BudgetRecord }>('/api/budgets', {
        method: 'POST',
        body: JSON.stringify({
          period: selectedPeriod || actual.period,
          revenueTarget: Number(targetRevenueInput),
          expenseBudget: Number(expenseBudgetInput),
        }),
      });

      if (res?.budget) {
        toast.success(`Budget for ${res.budget.period} updated successfully!`);
        await fetchBudgets();
        setIsAdjustModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update budget targets');
    } finally {
      setSavingBudget(false);
    }
  };

  // Available periods list for selector dropdown
  const availablePeriods = Array.from(
    new Set([...records.map((r) => r.period), ...budgets.map((b) => b.period)])
  ).sort();

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
      {/* Header with Period Selector & Adjust Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wider">
              FP&A Engine
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">BvA Variance</span>
          </div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Target size={16} className="text-indigo-600" />
            <span>Budget vs. Actuals (BvA)</span>
          </h3>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Period Selector Dropdown */}
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl px-3 py-1.5 pr-8 text-xs font-bold text-slate-800 outline-none cursor-pointer transition-colors"
            >
              {availablePeriods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={handleOpenAdjustModal}
            className="p-1.5 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors border border-slate-200/80 cursor-pointer"
            title="Adjust Budget Targets"
          >
            <Sliders size={14} />
          </button>
        </div>
      </div>

      {/* Localized Anomaly Warning Banner on Over Budget (>100%) */}
      {isOverBudget && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-900"
        >
          <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-extrabold">Over Budget Alert: {expenseUtilization}% Utilization</p>
            <p className="text-[11px] text-rose-700 font-medium leading-relaxed mt-0.5">
              Operating expenses for {selectedPeriod} (₹{actualExpenses.toLocaleString('en-IN')}) exceed the approved budget of ₹{expenseBudget.toLocaleString('en-IN')} by ₹{Math.abs(expenseVariance).toLocaleString('en-IN')}. Corrective cost control recommended.
            </p>
          </div>
        </motion.div>
      )}

      {/* Target Progress Rows */}
      <div className="space-y-4">
        {/* 1. Revenue Target vs Actual */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>Revenue Target</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                  revenueAttainment >= 100
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-indigo-50 text-indigo-700'
                }`}
              >
                {revenueAttainment}%
              </span>
            </span>
            <div className="text-right">
              <span className="font-extrabold text-slate-900">
                {formatCompactCurrency(actualRevenue, currency)}
              </span>
              <span className="text-slate-400 font-normal"> / {formatCompactCurrency(revenueTarget, currency)}</span>
            </div>
          </div>

          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, revenueAttainment)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                revenueAttainment >= 100
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                  : 'bg-gradient-to-r from-indigo-500 to-indigo-700'
              }`}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>Variance: {revenueVariance >= 0 ? `+${formatCompactCurrency(revenueVariance, currency)}` : `-${formatCompactCurrency(Math.abs(revenueVariance), currency)}`}</span>
            <span>{revenueAttainment >= 100 ? 'Target Exceeded' : 'Pacing to Target'}</span>
          </div>
        </div>

        {/* 2. Expense Budget vs Actual */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>Operating Expense Budget</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                  isOverBudget
                    ? 'bg-rose-100 text-rose-700'
                    : expenseUtilization >= 90
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}
              >
                {expenseUtilization}%
              </span>
            </span>
            <div className="text-right">
              <span className={`font-extrabold ${isOverBudget ? 'text-rose-600' : 'text-slate-900'}`}>
                {formatCompactCurrency(actualExpenses, currency)}
              </span>
              <span className="text-slate-400 font-normal"> / {formatCompactCurrency(expenseBudget, currency)}</span>
            </div>
          </div>

          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, expenseUtilization)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${
                isOverBudget
                  ? 'bg-rose-500'
                  : expenseUtilization >= 90
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
            />
          </div>

          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span className={isOverBudget ? 'text-rose-600 font-bold' : ''}>
              {isOverBudget
                ? `Overrun: +${formatCompactCurrency(Math.abs(expenseVariance), currency)}`
                : `Remaining: ${formatCompactCurrency(expenseVariance, currency)}`}
            </span>
            <span className={isOverBudget ? 'text-rose-600 font-bold' : ''}>
              {isOverBudget ? 'Cap Breached' : 'Within Budget'}
            </span>
          </div>
        </div>
      </div>

      {/* Net Operating Surplus / Deficit vs Target */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/50 p-2.5 rounded-xl">
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Net Operating Surplus</p>
          <p className="font-extrabold text-slate-900">{formatCurrency(netActual, currency)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Variance</p>
          <div
            className={`font-black flex items-center gap-0.5 justify-end ${
              netVariance >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {netVariance >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>
              {netVariance >= 0 ? '+' : '-'}
              {formatCompactCurrency(Math.abs(netVariance), currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Adjust Budget Targets Modal */}
      <AnimatePresence>
        {isAdjustModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdjustModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-5"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                    <Target size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Set Budget Targets</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Period: {selectedPeriod}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveBudget} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Revenue Target (₹)
                  </label>
                  <input
                    type="number"
                    value={targetRevenueInput}
                    onChange={(e) => setTargetRevenueInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                    placeholder="e.g. 8000000"
                    required
                  />
                  <p className="text-[10px] text-slate-400 font-medium">
                    Current Actual: {formatCurrency(actualRevenue, currency)}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Expense Budget Cap (₹)
                  </label>
                  <input
                    type="number"
                    value={expenseBudgetInput}
                    onChange={(e) => setExpenseBudgetInput(parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                    placeholder="e.g. 4400000"
                    required
                  />
                  <p className="text-[10px] text-slate-400 font-medium">
                    Current Actual: {formatCurrency(actualExpenses, currency)}
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingBudget}
                    className="px-4 py-2 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {savingBudget ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Budget Target</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BudgetVariance;
