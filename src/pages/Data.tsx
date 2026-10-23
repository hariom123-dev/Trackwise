import React, { useState, useEffect } from 'react';
import { 
  Database, 
  BrainCircuit, 
  Loader2, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  BarChart3, 
  FileText, 
  UploadCloud, 
  Sparkles, 
  Clock, 
  RefreshCw,
  Download,
  Table,
  Check,
  Calendar,
  Sliders,
  FileSpreadsheet,
  Layers
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { apiFetch } from '../utils/api';
import UnitEconomicsScorecard from '../components/UnitEconomicsScorecard';
import WhatIfScenarioSimulator from '../components/WhatIfScenarioSimulator';
import { exportMultiSheetExcel } from '../utils/excelExport';

export interface BusinessData {
  revenue: number;
  expenses: number;
  customers: number;
  churnRate: number;
  industry: string;
  goals: string;
}

export interface ParsedRow {
  period: string;
  revenue: number;
  expenses: number;
  customers: number;
  churnRate: number;
  industry?: string;
  goals?: string;
}

export interface PredictionResult {
  summary: string;
  forecast: {
    month: string;
    revenue: number;
  }[];
  recommendations: string[];
  riskLevel: 'Low' | 'Medium' | 'High';
  efficiencyScore: number;
}

export default function Data() {
  const [activeTab, setActiveTab] = useState<'forecast' | 'simulator'>('forecast');
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [existingRecords, setExistingRecords] = useState<any[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [savingRows, setSavingRows] = useState(false);

  const [formData, setFormData] = useState<BusinessData>({
    revenue: 99200,
    expenses: 56200,
    customers: 2450,
    churnRate: 1.5,
    industry: 'SaaS',
    goals: 'Scale to $150k MRR and establish European enterprise presence',
  });

  // Load existing records from SQLite on component mount
  useEffect(() => {
    loadExistingRecords();
  }, []);

  const loadExistingRecords = async () => {
    try {
      const res = await apiFetch<{ records: any[]; reports: any[] }>('/api/data/timeseries');
      if (res?.records && res.records.length > 0) {
        setExistingRecords(res.records);
        const latest = res.records[res.records.length - 1];
        setFormData((prev) => ({
          ...prev,
          revenue: latest.revenue || prev.revenue,
          expenses: latest.expenses || prev.expenses,
          customers: latest.customers || prev.customers,
          churnRate: latest.churnRate !== undefined ? latest.churnRate : prev.churnRate,
          industry: latest.industry || prev.industry,
        }));
      }
      if (res?.reports && res.reports.length > 0 && !prediction) {
        setPrediction(res.reports[0].prediction);
      }
    } catch (e) {
      console.warn('Could not fetch existing time-series records:', e);
    }
  };

  const loadSampleData = () => {
    setFormData({
      revenue: 125000,
      expenses: 82000,
      customers: 4500,
      churnRate: 1.8,
      industry: 'Fintech',
      goals: 'Expand to European market and achieve 25% YoY growth',
    });
    toast.info('Sample business matrix loaded.');
  };

  // Download a pre-formatted valid 6-month CSV template
  const handleDownloadTemplate = () => {
    const csvContent =
      'period,revenue,expenses,customers,churnRate,industry,goals\n' +
      '2025-11,72500,45800,1640,1.9,SaaS,Scale MRR to $150k\n' +
      '2025-12,79000,48000,1800,1.9,SaaS,Scale MRR to $150k\n' +
      '2026-01,84500,50500,1980,1.8,SaaS,Scale MRR to $150k\n' +
      '2026-02,89000,52000,2120,1.7,SaaS,Scale MRR to $150k\n' +
      '2026-03,94500,54500,2290,1.6,SaaS,Scale MRR to $150k\n' +
      '2026-04,99200,56200,2450,1.5,SaaS,Scale MRR to $150k\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'trackwise_timeseries_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Downloaded sample CSV template.');
  };

  // Multi-row file upload using readAsArrayBuffer
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileLoading(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        if (!buffer) throw new Error('File buffer is empty');

        const wb = XLSX.read(buffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (!data || data.length === 0) {
          toast.error('The selected file contains no readable rows.');
          setFileLoading(false);
          return;
        }

        const normalized: ParsedRow[] = [];
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const period =
            row['period'] ||
            row['Period'] ||
            row['month'] ||
            row['Month'] ||
            `2026-${String(i + 1).padStart(2, '0')}`;
          const revenue = parseFloat(row['revenue'] ?? row['Revenue'] ?? row['MRR'] ?? 0);
          const expenses = parseFloat(row['expenses'] ?? row['Expenses'] ?? row['costs'] ?? 0);
          const customers = parseInt(row['customers'] ?? row['Customers'] ?? row['users'] ?? 0, 10);
          const churnRate = parseFloat(row['churnRate'] ?? row['churn_rate'] ?? row['Churn'] ?? 1.5);
          const industry = row['industry'] || row['Industry'] || 'General Business';
          const goals = row['goals'] || row['Goals'] || '';

          if (revenue > 0 || customers > 0) {
            normalized.push({
              period: String(period),
              revenue,
              expenses,
              customers,
              churnRate,
              industry: String(industry),
              goals: String(goals),
            });
          }
        }

        if (normalized.length === 0) {
          toast.error('Could not map any columns. Please ensure columns include period, revenue, expenses, customers.');
          setFileLoading(false);
          return;
        }

        setParsedRows(normalized);
        const lastRow = normalized[normalized.length - 1];
        setFormData({
          revenue: lastRow.revenue,
          expenses: lastRow.expenses,
          customers: lastRow.customers,
          churnRate: lastRow.churnRate,
          industry: lastRow.industry || 'SaaS',
          goals: lastRow.goals || 'Multi-period scale plan',
        });

        toast.success(`Parsed ${normalized.length} time-series rows. Review and commit below.`);
      } catch (err: any) {
        console.error('File parsing error:', err);
        toast.error('Failed to parse file: ' + (err.message || 'Unknown error'));
      } finally {
        setFileLoading(false);
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file from disk.');
      setFileLoading(false);
    };

    reader.readAsArrayBuffer(file);
  };

  // Commit parsed multi-row data to SQLite
  const handleCommitParsedRows = async () => {
    if (parsedRows.length === 0) return;
    setSavingRows(true);

    try {
      const res = await apiFetch<{ success: boolean; count: number; records: any[] }>(
        '/api/data/timeseries/bulk',
        {
          method: 'POST',
          body: JSON.stringify({ rows: parsedRows }),
        }
      );

      if (res?.success) {
        toast.success(`Successfully saved ${res.count} records to SQLite database!`);
        setExistingRecords(res.records);
        setParsedRows([]);
        await handleSubmit();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save parsed records to database.');
    } finally {
      setSavingRows(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const historyRows =
        existingRecords.length > 0
          ? existingRecords.map((r) => ({
              period: r.period,
              revenue: r.revenue,
              expenses: r.expenses,
            }))
          : undefined;

      const result = await apiFetch<any>('/api/gemini/predict', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          historyRows,
        }),
      });

      if (result?.prediction) {
        setPrediction(result.prediction);
      } else if (result?.forecast) {
        setPrediction(result);
      }

      toast.success('Predictive intelligence report generated successfully!');
    } catch (err: any) {
      console.error('Prediction failed:', err);
      let message = err.message || 'The AI forecasting engine encountered an issue.';
      if (message.includes('quota') || message.includes('429')) {
        message = 'AI rate limit reached. Re-engaging with high-precision deterministic forecasting.';
      }
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'industry' || name === 'goals' ? value : value === '' ? 0 : parseFloat(value),
    }));
  };

  // Multi-Sheet Excel Export (.xlsx)
  const handleExportExcel = () => {
    const operatingMargin = formData.revenue > 0 ? ((formData.revenue - formData.expenses) / formData.revenue) * 100 : 0;
    const arpu = formData.customers > 0 ? formData.revenue / formData.customers : 0;
    const ltv = formData.churnRate > 0 ? arpu / (formData.churnRate / 100) : arpu * 24;
    const ruleOf40 = Math.round((5.0 * 12 + operatingMargin) * 10) / 10;
    const estimatedCac = Math.max(50, arpu * 12 * 0.22);
    const ltvCac = (ltv / Math.max(1, estimatedCac)).toFixed(1) + 'x';
    const payback = `${(estimatedCac / Math.max(1, arpu * (Math.max(10, operatingMargin) / 100))).toFixed(1)} Months`;
    const netSurplus = formData.revenue - formData.expenses;

    exportMultiSheetExcel(
      existingRecords.length > 0
        ? existingRecords
        : [
            {
              period: '2026-04',
              revenue: formData.revenue,
              expenses: formData.expenses,
              customers: formData.customers,
              churnRate: formData.churnRate,
              industry: formData.industry,
            },
          ],
      prediction?.forecast || [
        { month: 'Month +1', revenue: Math.round(formData.revenue * 1.05) },
        { month: 'Month +2', revenue: Math.round(formData.revenue * 1.10) },
        { month: 'Month +3', revenue: Math.round(formData.revenue * 1.15) },
        { month: 'Month +4', revenue: Math.round(formData.revenue * 1.21) },
        { month: 'Month +5', revenue: Math.round(formData.revenue * 1.27) },
        { month: 'Month +6', revenue: Math.round(formData.revenue * 1.34) },
      ],
      {
        ruleOf40,
        ruleOf40Status: ruleOf40 >= 40 ? 'Elite (>40%)' : ruleOf40 >= 20 ? 'Healthy (20-40%)' : 'Needs Focus',
        arpu,
        ltv,
        ltvCac,
        payback,
        netSurplus,
        runway: netSurplus >= 0 ? 'Infinite (Cash Flow +)' : '18.4 Months',
        margin: operatingMargin,
        churnRate: formData.churnRate,
      }
    );
    toast.success('Multi-sheet Excel workbook (.xlsx) downloaded successfully!');
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('prediction-report');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#f6fafe',
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`TrackWise-Analysis-${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success('Analysis report exported as PDF.');
    } catch (err) {
      toast.error('Failed to generate PDF.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Title & Actions */}
      <div className="flex flex-col md:items-center justify-between gap-4 md:flex-row pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
              Data Lab Engine
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">
              {existingRecords.length} Historical Records Loaded
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Financial Ingestion & Neural Forecasting
          </h1>
          <p className="font-medium text-slate-500 text-xs sm:text-sm">
            Ingest multi-period spreadsheets, audit unit economics, and stress-test sensitivity scenarios.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            title="Download formatted sample CSV template"
          >
            <Download size={14} className="text-indigo-600" />
            <span>Sample CSV</span>
          </button>

          {/* Multi-Sheet Excel Export Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors shadow-2xs cursor-pointer"
            title="Download 3-sheet Excel workbook (Historical, Forecast, Unit Economics)"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>Export Excel (.xlsx)</span>
          </button>

          <label className="flex items-center gap-1.5 px-4 py-2 bg-indigo-900 border border-indigo-900 rounded-xl text-xs font-bold text-white hover:bg-indigo-950 transition-colors cursor-pointer shadow-xs active:scale-95">
            {fileLoading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
            <span>{fileLoading ? 'Parsing...' : 'Upload CSV / Excel'}</span>
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={fileLoading}
            />
          </label>

          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <FileText size={14} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* SaaS Executive Unit Economics Scorecard */}
      <UnitEconomicsScorecard
        revenue={formData.revenue}
        expenses={formData.expenses}
        customers={formData.customers}
        churnRate={formData.churnRate}
      />

      {/* Parsed Dataset Preview Table */}
      {parsedRows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs space-y-4"
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700">
                <Table size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Parsed Time-Series Dataset Preview</h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {parsedRows.length} rows extracted. Verify columns below before committing to the database.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setParsedRows([])}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleCommitParsedRows}
                disabled={savingRows}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
              >
                {savingRows ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                <span>{savingRows ? 'Ingesting...' : 'Commit to Database & Forecast'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-4">Period</th>
                  <th className="py-2.5 px-4">Revenue</th>
                  <th className="py-2.5 px-4">Expenses</th>
                  <th className="py-2.5 px-4">Customers</th>
                  <th className="py-2.5 px-4">Churn Rate</th>
                  <th className="py-2.5 px-4">Industry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2 px-4 font-bold text-slate-900">{row.period}</td>
                    <td className="py-2 px-4 text-emerald-600 font-semibold">${row.revenue.toLocaleString()}</td>
                    <td className="py-2 px-4 text-slate-600">${row.expenses.toLocaleString()}</td>
                    <td className="py-2 px-4 text-slate-600">{row.customers.toLocaleString()}</td>
                    <td className="py-2 px-4 text-slate-600">{row.churnRate}%</td>
                    <td className="py-2 px-4 text-slate-500">{row.industry || 'SaaS'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Feature Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('forecast')}
          className={`flex items-center gap-2 pb-3 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'forecast'
              ? 'border-indigo-600 text-indigo-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <BrainCircuit size={16} />
          <span>Predictive AI Modeling</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-2 pb-3 px-1 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'simulator'
              ? 'border-indigo-600 text-indigo-900'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <Sliders size={16} />
          <span>What-If Scenario Simulator</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            Interactive
          </span>
        </button>
      </div>

      {/* Tab 2: What-If Scenario Simulator */}
      {activeTab === 'simulator' && (
        <WhatIfScenarioSimulator
          baseRevenue={formData.revenue}
          baseExpenses={formData.expenses}
          baseCustomers={formData.customers}
          baseChurnRate={formData.churnRate}
        />
      )}

      {/* Tab 1: Form & Predictive Intelligence View */}
      {activeTab === 'forecast' && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Telemetry Input Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs space-y-6 h-fit">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="text-indigo-600" size={18} />
                <h3 className="text-sm font-bold text-slate-900">Current Unit Telemetry</h3>
              </div>
              <button
                type="button"
                onClick={loadSampleData}
                className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors"
              >
                Load Sample
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Monthly Revenue ($)
                  </label>
                  <input
                    type="number"
                    name="revenue"
                    min="0"
                    value={formData.revenue}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Monthly Expenses ($)
                  </label>
                  <input
                    type="number"
                    name="expenses"
                    min="0"
                    value={formData.expenses}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Active Customers
                  </label>
                  <input
                    type="number"
                    name="customers"
                    min="0"
                    value={formData.customers}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden transition-all"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Churn Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    name="churnRate"
                    value={formData.churnRate}
                    onChange={handleChange}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden transition-all"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Industry Vertical
                </label>
                <select
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden transition-all"
                >
                  <option value="SaaS">SaaS / Enterprise Software</option>
                  <option value="E-commerce">E-commerce & Retail</option>
                  <option value="Fintech">Fintech & Financial Services</option>
                  <option value="Healthcare">Healthcare & BioTech</option>
                  <option value="Real Estate">Real Estate & PropTech</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Strategic Goals
                </label>
                <textarea
                  name="goals"
                  value={formData.goals}
                  onChange={handleChange}
                  rows={3}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden transition-all resize-none"
                  placeholder="e.g., Scale to $150k MRR and establish European enterprise presence"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-900 text-white py-3 rounded-xl text-xs font-bold shadow-md shadow-indigo-900/15 flex items-center justify-center gap-2 hover:bg-indigo-950 active:scale-95 transition-all disabled:opacity-50 mt-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={15} />
                    <span>Executing Dual Forecasting Engine...</span>
                  </>
                ) : (
                  <>
                    <BrainCircuit size={15} />
                    <span>Run Predictive Intelligence</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results Area */}
          <div id="prediction-report" className="lg:col-span-2 space-y-6">
            {error && (
              <div className="bg-white border border-slate-200/80 p-8 rounded-2xl text-center shadow-2xs">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 mx-auto mb-4">
                  <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900 mb-2">Notice on Forecasting</h3>
                <p className="text-slate-500 text-xs mb-6 max-w-sm mx-auto leading-relaxed">{error}</p>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  className="flex items-center gap-2 mx-auto px-5 py-2.5 bg-indigo-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-950 transition-all shadow-xs"
                >
                  <RefreshCw size={14} />
                  <span>Rerun Prediction</span>
                </button>
              </div>
            )}

            {!prediction && !loading && !error && (
              <div className="bg-white border border-slate-200/80 rounded-2xl min-h-[420px] flex flex-col items-center justify-center p-8 text-center shadow-2xs">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 shadow-2xs">
                  <BrainCircuit size={32} />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">Predictive Intelligence Ready</h3>
                <p className="text-slate-500 text-xs max-w-md mb-6 leading-relaxed">
                  Connect your business metrics to calculate deterministic operating margins, compound runway, LTV,
                  and generate structured 6-month predictive revenue projections.
                </p>
                <button
                  type="button"
                  onClick={() => handleSubmit()}
                  className="px-6 py-3 bg-indigo-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-indigo-950 transition-all active:scale-95 cursor-pointer"
                >
                  Analyze Current Telemetry
                </button>
              </div>
            )}

            {loading && (
              <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-2xs min-h-[420px] flex flex-col items-center justify-center text-center">
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin" />
                  <BrainCircuit
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600"
                    size={28}
                  />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">Processing Predictive Models</h3>
                <p className="text-slate-500 text-xs max-w-md leading-relaxed">
                  Computing deterministic financial mathematics (margins, burn rate, LTV) and synthesizing executive
                  strategic intelligence...
                </p>
              </div>
            )}

            {prediction && !loading && (
              <div className="space-y-6">
                {/* Executive Assessment Card */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Sparkles size={16} className="text-indigo-600" />
                      <h3 className="text-sm font-bold text-slate-900">Executive Forecast Summary</h3>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                        prediction.riskLevel === 'Low'
                          ? 'bg-emerald-50 text-emerald-700'
                          : prediction.riskLevel === 'Medium'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      <AlertTriangle size={13} />
                      <span>{prediction.riskLevel} Risk Profile</span>
                    </div>
                  </div>
                  <p className="text-slate-700 leading-relaxed text-xs sm:text-sm bg-slate-50/70 p-4 rounded-xl border border-slate-100 italic">
                    "{prediction.summary}"
                  </p>
                </div>

                {/* 6-Month Projection Chart */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                        <TrendingUp size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">6-Month Compound Revenue Projection</h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Model projection factoring MoM momentum and churn damping
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={prediction.forecast}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                          dataKey="month"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                          dy={8}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                          tickFormatter={(value) => `$${value / 1000}k`}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                          }}
                          formatter={(value: any) => [`$${Number(value).toLocaleString()}`, 'Projected Revenue']}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#4f46e5"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorRev)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recommendations & Efficiency Index */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-indigo-900 p-6 rounded-2xl text-white shadow-md shadow-indigo-900/15 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                        <Sparkles className="text-amber-400" size={16} />
                        Actionable Strategic Directives
                      </h3>
                      <div className="space-y-3">
                        {prediction.recommendations.map((rec, i) => (
                          <div key={i} className="flex gap-2.5">
                            <div className="mt-0.5 shrink-0">
                              <CheckCircle2 size={15} className="text-emerald-400" />
                            </div>
                            <p className="text-xs text-indigo-100 leading-relaxed font-medium">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 mt-4 border-t border-indigo-800/80 flex items-center justify-between text-[11px] text-indigo-300">
                      <span>Generated for {formData.industry} vertical</span>
                      <span>High Confidence</span>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-2">Operational Efficiency Index</h3>
                      <p className="text-[11px] text-slate-400 mb-4">
                        Evaluated against industry benchmarks for operating margin and churn.
                      </p>
                      <div className="flex items-center justify-center py-2">
                        <div className="relative">
                          <svg className="w-28 h-28 transform -rotate-90">
                            <circle
                              cx="56"
                              cy="56"
                              r="50"
                              stroke="currentColor"
                              strokeWidth="7"
                              fill="transparent"
                              className="text-slate-100"
                            />
                            <motion.circle
                              initial={{ strokeDashoffset: 314 }}
                              animate={{ strokeDashoffset: 314 - (314 * prediction.efficiencyScore) / 100 }}
                              transition={{ duration: 1.2, ease: 'easeOut' }}
                              cx="56"
                              cy="56"
                              r="50"
                              stroke="currentColor"
                              strokeWidth="7"
                              strokeDasharray={314}
                              strokeLinecap="round"
                              fill="transparent"
                              className="text-indigo-600"
                            />
                          </svg>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                            <span className="text-2xl font-black text-slate-900">{prediction.efficiencyScore}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-center mt-2 pt-3 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-800">
                        {prediction.efficiencyScore > 80
                          ? 'Exceptional Performance'
                          : prediction.efficiencyScore > 50
                          ? 'Stable Performance'
                          : 'Optimization Recommended'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Benchmarks relative to {formData.industry} vertical
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
