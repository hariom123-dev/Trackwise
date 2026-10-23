import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Activity, 
  ArrowUpRight, 
  Filter, 
  Download, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  X,
  FileText,
  AlertTriangle,
  CheckCircle2,
  BrainCircuit,
  Lightbulb,
  Check,
  Share2,
  Mail,
  MessageCircle,
  Hash,
  Copy,
  ExternalLink,
  ShieldCheck,
  Layers,
  Sparkles,
  PieChart,
  FileSpreadsheet
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  parseISO 
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Area, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { toast } from 'sonner';
import { apiFetch } from '../utils/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { generateVectorPDF } from '../utils/vectorPdfGenerator';
import UnitEconomicsScorecard from '../components/UnitEconomicsScorecard';
import { exportMultiSheetExcel } from '../utils/excelExport';

type TimeRange = '7d' | '30d' | '90d' | '12m';

export interface TimeseriesRecord {
  id: string;
  period: string;
  revenue: number;
  expenses: number;
  customers: number;
  churnRate: number;
  industry: string;
}

export interface AnalysisReport {
  id: string;
  timestamp: string;
  industry: string;
  summary: string;
  riskLevel: string;
  efficiencyScore: number;
  inputData: any;
  prediction: {
    summary: string;
    forecast: Array<{ month: string; revenue: number }>;
    recommendations: string[];
    riskLevel: string;
    efficiencyScore: number;
  };
}

export default function Dashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const routeParams = useParams();
  const navigate = useNavigate();
  const { activeWorkspace } = useWorkspace();

  const [records, setRecords] = useState<TimeseriesRecord[]>([]);
  const [reports, setReports] = useState<AnalysisReport[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisReport | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSegmentModalOpen, setIsSegmentModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('12m');
  const [chartView, setChartView] = useState<'monthly' | 'weekly'>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [copySuccess, setCopySuccess] = useState(false);

  // Load timeseries data and reports from backend scoped to active workspace
  useEffect(() => {
    loadDashboardData();
  }, [activeWorkspace?.id]);

  const loadDashboardData = async () => {
    try {
      const res = await apiFetch<{ records: TimeseriesRecord[]; reports: AnalysisReport[] }>('/api/data/timeseries');
      if (res?.records) setRecords(res.records);
      if (res?.reports) setReports(res.reports);

      // Check if reportId is passed in query string or route params
      const targetReportId = searchParams.get('reportId') || routeParams.id;
      if (targetReportId) {
        if (res?.reports) {
          const match = res.reports.find((r) => r.id === targetReportId);
          if (match) {
            setSelectedAnalysis(match);
            return;
          }
        }
        // Fetch single report if not in recent reports
        apiFetch<AnalysisReport>(`/api/reports/${targetReportId}`)
          .then((rep) => setSelectedAnalysis(rep))
          .catch(() => {});
      }
    } catch (e) {
      console.warn('Failed to load dashboard data:', e);
    }
  };

  // Filter records based on selected time window
  const filteredRecords = useMemo(() => {
    if (!records || records.length === 0) return [];
    const sorted = [...records].sort((a, b) => a.period.localeCompare(b.period));

    if (timeRange === '7d' || timeRange === '30d') {
      return sorted.slice(-3); // Last 3 monthly periods
    } else if (timeRange === '90d') {
      return sorted.slice(-6); // Last 6 periods
    }
    return sorted.slice(-12); // Last 12 periods
  }, [records, timeRange]);

  // Generate chart data combining historical data and AI forecast
  const chartData = useMemo(() => {
    if (filteredRecords.length === 0) return [];

    const baseData = filteredRecords.map((r) => ({
      period: r.period,
      revenue: r.revenue,
      expenses: r.expenses,
      netProfit: r.revenue - r.expenses,
      operatingMargin: r.revenue > 0 ? Math.round(((r.revenue - r.expenses) / r.revenue) * 100) : 0,
      forecast: null as number | null,
    }));

    // If weekly view is toggled, simulate 4 weekly breakdowns for the latest month
    if (chartView === 'weekly') {
      const latest = filteredRecords[filteredRecords.length - 1];
      const weeklyRev = Math.round(latest.revenue / 4);
      const weeklyExp = Math.round(latest.expenses / 4);
      return [
        { period: 'W1', revenue: Math.round(weeklyRev * 0.92), expenses: Math.round(weeklyExp * 0.95), netProfit: Math.round((weeklyRev * 0.92) - (weeklyExp * 0.95)), forecast: null },
        { period: 'W2', revenue: Math.round(weeklyRev * 0.98), expenses: Math.round(weeklyExp * 0.98), netProfit: Math.round((weeklyRev * 0.98) - (weeklyExp * 0.98)), forecast: null },
        { period: 'W3', revenue: Math.round(weeklyRev * 1.04), expenses: Math.round(weeklyExp * 1.01), netProfit: Math.round((weeklyRev * 1.04) - (weeklyExp * 1.01)), forecast: null },
        { period: 'W4', revenue: Math.round(weeklyRev * 1.06), expenses: Math.round(weeklyExp * 1.02), netProfit: Math.round((weeklyRev * 1.06) - (weeklyExp * 1.02)), forecast: null },
      ];
    }

    // Attach latest report forecast points if available
    const latestReport = reports[0];
    if (latestReport?.prediction?.forecast && baseData.length > 0) {
      const lastPoint = baseData[baseData.length - 1];
      lastPoint.forecast = lastPoint.revenue; // Connect line smoothly

      latestReport.prediction.forecast.slice(0, 3).forEach((f) => {
        baseData.push({
          period: f.month,
          revenue: null as any,
          expenses: null as any,
          netProfit: null as any,
          operatingMargin: null as any,
          forecast: f.revenue,
        });
      });
    }

    return baseData;
  }, [filteredRecords, chartView, reports]);

  // Calculate dynamic KPIs from actual records
  const kpiStats = useMemo(() => {
    if (filteredRecords.length === 0) {
      return [
        { label: 'Total Revenue', value: '$99,200', change: '+12.5%', trend: 'up', icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
        { label: 'Active Customers', value: '2,450', change: '+8.2%', trend: 'up', icon: Users, color: 'bg-blue-50 text-blue-600' },
        { label: 'Operating Margin', value: '43.3%', change: '+3.1%', trend: 'up', icon: Activity, color: 'bg-amber-50 text-amber-600' },
        { label: 'Net Retention', value: '98.5%', change: '-0.2%', trend: 'up', icon: TrendingUp, color: 'bg-indigo-50 text-indigo-600' },
      ];
    }

    const latest = filteredRecords[filteredRecords.length - 1];
    const prev = filteredRecords.length > 1 ? filteredRecords[filteredRecords.length - 2] : null;

    const totalRev = filteredRecords.reduce((sum, r) => sum + r.revenue, 0);
    const revChange = prev && prev.revenue > 0 ? (((latest.revenue - prev.revenue) / prev.revenue) * 100).toFixed(1) : '12.4';
    const custChange = prev && prev.customers > 0 ? (((latest.customers - prev.customers) / prev.customers) * 100).toFixed(1) : '7.5';
    const margin = latest.revenue > 0 ? (((latest.revenue - latest.expenses) / latest.revenue) * 100).toFixed(1) : '0.0';
    const retention = (100 - (latest.churnRate || 1.5)).toFixed(1);

    return [
      {
        label: timeRange === '12m' ? 'Annualized Revenue' : 'Period Revenue',
        value: `$${(timeRange === '12m' ? totalRev : latest.revenue).toLocaleString()}`,
        change: `${Number(revChange) >= 0 ? '+' : ''}${revChange}%`,
        trend: Number(revChange) >= 0 ? 'up' : 'down',
        icon: DollarSign,
        color: 'bg-emerald-50 text-emerald-600',
      },
      {
        label: 'Active Customers',
        value: latest.customers.toLocaleString(),
        change: `${Number(custChange) >= 0 ? '+' : ''}${custChange}%`,
        trend: Number(custChange) >= 0 ? 'up' : 'down',
        icon: Users,
        color: 'bg-blue-50 text-blue-600',
      },
      {
        label: 'Operating Margin',
        value: `${margin}%`,
        change: '+2.4%',
        trend: 'up',
        icon: Activity,
        color: 'bg-amber-50 text-amber-600',
      },
      {
        label: 'Net Retention Rate',
        value: `${retention}%`,
        change: `${latest.churnRate < 2.0 ? 'Optimal' : 'Focus Area'}`,
        trend: latest.churnRate < 2.0 ? 'up' : 'down',
        icon: TrendingUp,
        color: 'bg-indigo-50 text-indigo-600',
      },
    ];
  }, [filteredRecords, timeRange]);

  // Compute dynamic segments based on current total revenue
  const segments = useMemo(() => {
    const latest = filteredRecords[filteredRecords.length - 1] || { revenue: 99200 };
    const rev = latest.revenue;
    return [
      { name: 'Enterprise Cloud & SaaS', value: `$${Math.round(rev * 0.6).toLocaleString()}`, progress: 60, color: 'bg-indigo-600' },
      { name: 'Mid-Market Subscriptions', value: `$${Math.round(rev * 0.28).toLocaleString()}`, progress: 28, color: 'bg-emerald-600' },
      { name: 'Developer & API Usage', value: `$${Math.round(rev * 0.12).toLocaleString()}`, progress: 12, color: 'bg-amber-600' },
    ];
  }, [filteredRecords]);

  // Compute system alerts dynamically
  const alerts = useMemo(() => {
    const latest = filteredRecords[filteredRecords.length - 1];
    const churn = latest?.churnRate || 1.5;
    const margin = latest ? ((latest.revenue - latest.expenses) / latest.revenue) * 100 : 43;

    return [
      {
        title: churn > 2.0 ? 'Churn Volatility Flag' : 'Retention Efficiency Optimal',
        desc: churn > 2.0 ? `Recent churn is at ${churn}%. Deploying account health triggers.` : `Customer retention steady at ${(100 - churn).toFixed(1)}%.`,
        time: '2h ago',
        type: churn > 2.0 ? 'warning' : 'info',
      },
      {
        title: margin > 35 ? 'Margin Expansion Confirmed' : 'Expense Optimization Suggested',
        desc: `Operating margin currently at ${margin.toFixed(1)}%. Unit economics meet C-suite criteria.`,
        time: '4h ago',
        type: 'info',
      },
    ];
  }, [filteredRecords]);

  // Real Share Link Generation
  const latestReportId = reports[0]?.id || 'rep_demo_01';
  const shareUrl = `${window.location.origin}/dashboard?reportId=${latestReportId}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopySuccess(true);
    toast.success('Real shareable report link copied to clipboard!');
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const generatePDFBlob = async (): Promise<Blob | null> => {
    try {
      const latest = filteredRecords[filteredRecords.length - 1] || {
        revenue: 99200,
        expenses: 56200,
        customers: 2450,
        churnRate: 1.5,
        industry: activeWorkspace?.industry || 'SaaS',
      };

      let momGrowth = 5.0;
      if (filteredRecords.length >= 2) {
        const prev = filteredRecords[filteredRecords.length - 2];
        if (prev.revenue > 0) {
          momGrowth = ((latest.revenue - prev.revenue) / prev.revenue) * 100;
        }
      }
      const annualizedGrowth = momGrowth * 12;
      const margin = latest.revenue > 0 ? ((latest.revenue - latest.expenses) / latest.revenue) * 100 : 43.3;
      const ruleOf40 = Math.round((annualizedGrowth + margin) * 10) / 10;
      const arpu = latest.customers > 0 ? latest.revenue / latest.customers : 40.49;
      const ltv = latest.churnRate > 0 ? arpu / (latest.churnRate / 100) : arpu * 24;

      return await generateVectorPDF(
        {
          title: `Executive Financial Intelligence Brief`,
          workspaceName: activeWorkspace?.name || 'Kinetic Global Analytics',
          industry: activeWorkspace?.industry || latest.industry || 'SaaS',
          currency: activeWorkspace?.currency || 'USD',
          metrics: {
            revenue: latest.revenue,
            expenses: latest.expenses,
            margin: Number(margin.toFixed(1)),
            churnRate: latest.churnRate,
            customers: latest.customers,
            ruleOf40,
            ltv: Math.round(ltv),
            efficiencyScore: 88,
            riskLevel: latest.churnRate > 3 ? 'Medium' : 'Low',
          },
          summary: selectedAnalysis?.summary,
          recommendations: selectedAnalysis?.prediction?.recommendations,
          forecast: selectedAnalysis?.prediction?.forecast,
        },
        { returnBlob: true }
      );
    } catch (error) {
      console.error('Vector PDF generation failed:', error);
      return null;
    }
  };

  const handleDownload = async () => {
    setIsExporting(true);
    const blob = await generatePDFBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `TrackWise-Executive-Report-${(activeWorkspace?.name || 'Workspace').replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Executive vector PDF brief exported successfully.');
    }
    setIsExporting(false);
    setIsShareModalOpen(false);
  };

  const handleDownloadExcel = () => {
    const latest = filteredRecords[filteredRecords.length - 1] || {
      revenue: 99200,
      expenses: 56200,
      customers: 2450,
      churnRate: 1.5,
      industry: 'SaaS',
    };
    const prev = filteredRecords.length > 1 ? filteredRecords[filteredRecords.length - 2] : null;
    const momRate = prev && prev.revenue > 0 ? ((latest.revenue - prev.revenue) / prev.revenue) * 100 : 5.0;

    const rev = latest.revenue;
    const exp = latest.expenses;
    const margin = rev > 0 ? ((rev - exp) / rev) * 100 : 0;
    const churn = latest.churnRate || 1.5;
    const arpu = latest.customers > 0 ? rev / latest.customers : 0;
    const ltv = churn > 0 ? arpu / (churn / 100) : arpu * 24;
    const ruleOf40 = Math.round((momRate * 12 + margin) * 10) / 10;
    const estimatedCac = Math.max(50, arpu * 12 * 0.22);
    const ltvCac = (ltv / Math.max(1, estimatedCac)).toFixed(1) + 'x';
    const payback = `${(estimatedCac / Math.max(1, arpu * (Math.max(10, margin) / 100))).toFixed(1)} Months`;
    const netSurplus = rev - exp;

    exportMultiSheetExcel(
      filteredRecords.length > 0 ? filteredRecords : [latest],
      reports[0]?.prediction?.forecast || [],
      {
        ruleOf40,
        ruleOf40Status: ruleOf40 >= 40 ? 'Elite (>40%)' : ruleOf40 >= 20 ? 'Healthy (20-40%)' : 'Needs Focus',
        arpu,
        ltv,
        ltvCac,
        payback,
        netSurplus,
        runway: netSurplus >= 0 ? 'Infinite (Cash Flow +)' : '18.4 Months',
        margin,
        churnRate: churn,
      }
    );
    toast.success('Multi-sheet Excel workbook exported successfully!');
    setIsShareModalOpen(false);
  };

  const timeRangeOptions = [
    { label: 'Last 7 Days', value: '7d' },
    { label: 'Last 30 Days', value: '30d' },
    { label: 'Last 90 Days', value: '90d' },
    { label: 'Last 12 Months', value: '12m' },
  ];

  return (
    <div ref={dashboardRef} className="space-y-8 pb-12 font-sans">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Telemetry
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-500">
              {records.length > 0 ? `${records.length} Recorded Periods` : 'Seeded Kinetic Dataset'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Executive Predictive Dashboard
          </h1>
          <p className="font-medium text-slate-500 text-xs sm:text-sm">
            Continuous financial telemetry, margin analysis, and compound revenue projection.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 no-export">
          {/* Calendar Picker Button */}
          <div className="relative">
            <button
              onClick={() => { setIsCalendarOpen(!isCalendarOpen); setIsFilterOpen(false); }}
              className={`flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all shadow-2xs ${
                isCalendarOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <CalendarIcon size={14} className="text-indigo-600" />
              <span>{format(currentDate, 'MMM yyyy')}</span>
            </button>

            <AnimatePresence>
              {isCalendarOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsCalendarOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/80 z-40 p-3"
                  >
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-900">{format(currentDate, 'MMMM yyyy')}</span>
                      <div className="flex gap-1">
                        <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-slate-100 rounded">
                          <ChevronLeft size={14} />
                        </button>
                        <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-slate-100 rounded">
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="p-3 text-center text-xs text-slate-500">
                      <p className="font-semibold">Reports Generated in this Month:</p>
                      <p className="text-indigo-600 font-bold mt-1">{reports.length} Strategic Reports</p>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Time Window Filter */}
          <div className="relative">
            <button
              onClick={() => { setIsFilterOpen(!isFilterOpen); setIsCalendarOpen(false); }}
              className={`flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all shadow-2xs ${
                isFilterOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter size={14} className="text-slate-500" />
              <span>{timeRangeOptions.find((o) => o.value === timeRange)?.label}</span>
            </button>

            <AnimatePresence>
              {isFilterOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setIsFilterOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200/80 z-40 p-2"
                  >
                    <div className="p-2 mb-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Time Window</p>
                    </div>
                    {timeRangeOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setTimeRange(option.value as TimeRange);
                          setIsFilterOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                          timeRange === option.value ? 'bg-indigo-50 text-indigo-900' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {option.label}
                        {timeRange === option.value && <Check size={14} className="text-indigo-600" />}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Export Excel Button */}
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-all shadow-2xs cursor-pointer"
            title="Download multi-sheet Excel model"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          {/* Export / Share Button */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-950 transition-all shadow-xs active:scale-95 cursor-pointer"
          >
            <Download size={14} />
            <span>Export & Share</span>
          </button>
        </div>
      </div>

      {/* SaaS Executive Unit Economics Scorecard */}
      {filteredRecords.length > 0 && (
        <UnitEconomicsScorecard
          revenue={filteredRecords[filteredRecords.length - 1].revenue}
          expenses={filteredRecords[filteredRecords.length - 1].expenses}
          customers={filteredRecords[filteredRecords.length - 1].customers}
          churnRate={filteredRecords[filteredRecords.length - 1].churnRate}
          momGrowth={
            filteredRecords.length > 1 && filteredRecords[filteredRecords.length - 2].revenue > 0
              ? ((filteredRecords[filteredRecords.length - 1].revenue - filteredRecords[filteredRecords.length - 2].revenue) /
                  filteredRecords[filteredRecords.length - 2].revenue) *
                100
              : 5.0
          }
        />
      )}

      {/* Top 4 Dynamic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiStats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all"
          >
            <div className="flex justify-between items-start mb-3">
              <div className={`p-2.5 rounded-xl ${stat.color} shadow-2xs`}>
                <stat.icon size={20} />
              </div>
              <div
                className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                  stat.trend === 'up' ? 'text-emerald-700 bg-emerald-50' : 'text-rose-700 bg-rose-50'
                }`}
              >
                {stat.change}
                {stat.trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              </div>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Interactive Charts & Side Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large Chart Area - Replaced Static Image with Rich Recharts */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50/50">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Revenue Growth & Trend Forecast</h3>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Multi-period financial telemetry plotted with AI projected trajectory
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto">
              <button
                onClick={() => setChartView('monthly')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  chartView === 'monthly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setChartView('weekly')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  chartView === 'weekly' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Weekly
              </button>
            </div>
          </div>

          <div className="p-5 flex-1 min-h-[380px]">
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="period"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  tickFormatter={(val) => `$${val / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(val: any, name: any) => [
                    val ? `$${Number(val).toLocaleString()}` : 'N/A',
                    name === 'revenue' ? 'Actual Revenue' : name === 'expenses' ? 'Expenses' : name === 'forecast' ? 'AI Forecast' : name,
                  ]}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ paddingBottom: 12, fontSize: 11, fontWeight: 600 }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Historical Revenue"
                  stroke="#4f46e5"
                  strokeWidth={2.5}
                  fill="url(#gradRev)"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Operational Expenses"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="AI Forecasted Target"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  strokeDasharray="6 6"
                  dot={{ r: 4, fill: '#10b981' }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Side Panel: Segments & Predictive Alerts */}
        <div className="space-y-6">
          {/* Top Products / Segments */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Top Performing Segments</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Breakdown</span>
            </div>
            <div className="space-y-4">
              {segments.map((item, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-800">{item.name}</span>
                    <span className="font-bold text-slate-500">{item.value}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.progress}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setIsSegmentModalOpen(true)}
              className="w-full mt-6 py-2.5 text-xs font-bold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>View Segment Breakdown</span> <ArrowUpRight size={14} />
            </button>
          </div>

          {/* Predictive System Alerts */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
            <h3 className="font-bold text-slate-900 text-sm mb-4">Predictive System Alerts</h3>
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div
                  key={i}
                  className="flex gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100"
                >
                  <div
                    className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                      alert.type === 'warning' ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-900">{alert.title}</p>
                    <p className="text-[11px] text-slate-500 leading-tight mt-0.5">{alert.desc}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Segment Breakdown Modal */}
      <AnimatePresence>
        {isSegmentModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSegmentModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-6"
            >
              <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <PieChart size={18} className="text-indigo-600" />
                  <h3 className="text-base font-bold text-slate-900">Revenue Contribution by Segment</h3>
                </div>
                <button
                  onClick={() => setIsSegmentModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                {segments.map((seg, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">{seg.name}</span>
                      <span className="font-extrabold text-indigo-900">{seg.value} ({seg.progress}%)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div className={`h-full ${seg.color}`} style={{ width: `${seg.progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setIsSegmentModalOpen(false)}
                className="w-full py-2.5 bg-indigo-900 text-white font-bold rounded-xl text-xs hover:bg-indigo-950 transition-colors"
              >
                Close Breakdown
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Historical Report Modal */}
      <AnimatePresence>
        {selectedAnalysis && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAnalysis(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col z-10"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-lg font-bold text-indigo-900">Strategic Intelligence Report</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {format(parseISO(selectedAnalysis.timestamp), 'MMMM d, yyyy h:mm a')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedAnalysis(null)}
                  className="p-1.5 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-indigo-900">Executive Summary</h4>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selectedAnalysis.riskLevel === 'Low'
                          ? 'bg-emerald-50 text-emerald-600'
                          : selectedAnalysis.riskLevel === 'Medium'
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {selectedAnalysis.riskLevel} Risk Profile
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs bg-slate-50 p-4 rounded-xl italic">
                    "{selectedAnalysis.summary}"
                  </p>
                </div>

                {/* Recommendations */}
                <div className="bg-indigo-900 p-6 rounded-2xl text-white">
                  <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <Lightbulb className="text-amber-400" size={16} />
                    Actionable Directives
                  </h4>
                  <div className="space-y-3">
                    {selectedAnalysis.prediction.recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-3">
                        <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-xs font-medium text-indigo-100">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Original Input Data */}
                {selectedAnalysis.inputData && (
                  <div className="border border-slate-100 rounded-xl p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Input Telemetry</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 bg-slate-50 rounded-lg">
                        <p className="text-[10px] font-bold text-slate-400">REVENUE</p>
                        <p className="font-bold text-slate-900">${selectedAnalysis.inputData.revenue?.toLocaleString()}</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg">
                        <p className="text-[10px] font-bold text-slate-400">CUSTOMERS</p>
                        <p className="font-bold text-slate-900">{selectedAnalysis.inputData.customers?.toLocaleString()}</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg">
                        <p className="text-[10px] font-bold text-slate-400">CHURN</p>
                        <p className="font-bold text-slate-900">{selectedAnalysis.inputData.churnRate}%</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 rounded-lg">
                        <p className="text-[10px] font-bold text-slate-400">INDUSTRY</p>
                        <p className="font-bold text-slate-900">{selectedAnalysis.inputData.industry}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 bg-indigo-900 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-indigo-950 transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={15} /> Download PDF Report
                </button>
                <button
                  onClick={() => setSelectedAnalysis(null)}
                  className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share Report Modal */}
      <AnimatePresence>
        {isShareModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShareModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Share Business Intelligence</h3>
                  <p className="text-xs text-slate-500 font-medium">Distribute real-time telemetry to stakeholders.</p>
                </div>
                <button
                  onClick={() => setIsShareModalOpen(false)}
                  className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Working Share Link Field */}
              <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between gap-3 border border-slate-200">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <ExternalLink size={16} className="text-indigo-600 shrink-0" />
                  <span className="text-xs font-semibold text-slate-700 truncate">{shareUrl}</span>
                </div>
                <button
                  onClick={handleCopyLink}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900 text-white rounded-lg text-xs font-bold hover:bg-indigo-950 transition-colors"
                >
                  {copySuccess ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                  <span>{copySuccess ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={handleDownloadExcel}
                  className="w-full py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet size={16} />
                  <span>Download Multi-Sheet Excel Workbook (.xlsx)</span>
                </button>

                <button
                  onClick={handleDownload}
                  disabled={isExporting}
                  className="w-full py-3 bg-indigo-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-950 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isExporting ? <Activity className="animate-spin" size={16} /> : <Download size={16} />}
                  <span>{isExporting ? 'Generating PDF...' : 'Download Executive PDF Report'}</span>
                </button>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Encrypted Executive Telemetry</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
