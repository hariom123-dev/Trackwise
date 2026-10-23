import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  BrainCircuit, 
  Lightbulb, 
  ArrowRight, 
  Share2, 
  Bookmark, 
  FileText, 
  Heart, 
  X, 
  Search, 
  Calendar, 
  Download, 
  CheckCircle2,
  Check,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { apiFetch } from '../utils/api';
import { useWorkspace } from '../context/WorkspaceContext';
import { generateVectorPDF } from '../utils/vectorPdfGenerator';

export interface ActionItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Insight {
  id: string;
  title: string;
  desc: string;
  fullContent?: string;
  tag: string;
  image: string;
  author: string;
  avatar: string;
  confidence: number;
  date: string;
  likes: number;
  likedByUser: boolean;
  savedByUser: boolean;
  actionItems?: ActionItem[];
}

export default function Insights() {
  const { activeWorkspace } = useWorkspace();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [filterTag, setFilterTag] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  const tags = ['All', 'Market Entry', 'Product', 'Operations', 'Finance'];

  // Load insights from backend SQLite database scoped to active workspace
  useEffect(() => {
    loadInsights();
  }, [activeWorkspace?.id]);

  const loadInsights = async () => {
    try {
      const res = await apiFetch<{ insights: Insight[] }>('/api/insights');
      if (res?.insights) {
        setInsights(res.insights);
      }
    } catch (e) {
      console.warn('Failed to load insights from backend:', e);
    } finally {
      setLoading(false);
    }
  };

  const filteredInsights = useMemo(() => {
    return insights.filter((item) => {
      const matchesTag = filterTag === 'All' || item.tag.toLowerCase() === filterTag.toLowerCase();
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.tag.toLowerCase().includes(q);

      return matchesTag && matchesSearch;
    });
  }, [insights, filterTag, searchQuery]);

  // Toggle Save (Bookmark) via backend API
  const toggleSave = async (id: string) => {
    try {
      const res = await apiFetch<{ savedByUser: boolean }>(`/api/insights/${id}/toggle-save`, {
        method: 'POST',
      });

      setInsights((prev) =>
        prev.map((ins) => (ins.id === id ? { ...ins, savedByUser: res.savedByUser } : ins))
      );

      if (selectedInsight?.id === id) {
        setSelectedInsight((prev) => (prev ? { ...prev, savedByUser: res.savedByUser } : null));
      }

      toast.success(res.savedByUser ? 'Insight bookmarked to your workspace.' : 'Removed from saved insights.');
    } catch {
      toast.error('Failed to update bookmark.');
    }
  };

  // Toggle Like via backend API
  const toggleLike = async (id: string) => {
    try {
      const res = await apiFetch<{ likes: number; likedByUser: boolean }>(`/api/insights/${id}/toggle-like`, {
        method: 'POST',
      });

      setInsights((prev) =>
        prev.map((ins) =>
          ins.id === id ? { ...ins, likes: res.likes, likedByUser: res.likedByUser } : ins
        )
      );

      if (selectedInsight?.id === id) {
        setSelectedInsight((prev) =>
          prev ? { ...prev, likes: res.likes, likedByUser: res.likedByUser } : null
        );
      }
    } catch {
      toast.error('Failed to record reaction.');
    }
  };

  // Toggle Action Item Checkbox via backend API
  const toggleActionItem = async (actionId: string) => {
    if (!selectedInsight) return;

    const currentActions = selectedInsight.actionItems || [];
    const updatedActions = currentActions.map((act) =>
      act.id === actionId ? { ...act, done: !act.done } : act
    );

    // Optimistic UI update
    setSelectedInsight((prev) => (prev ? { ...prev, actionItems: updatedActions } : null));
    setInsights((prev) =>
      prev.map((ins) => (ins.id === selectedInsight.id ? { ...ins, actionItems: updatedActions } : ins))
    );

    try {
      await apiFetch(`/api/insights/${selectedInsight.id}/actions`, {
        method: 'PUT',
        body: JSON.stringify({ actionItems: updatedActions }),
      });
    } catch {
      toast.error('Failed to persist action item.');
    }
  };

  // Run Real Intelligence Scan calling backend
  const runIntelligenceScan = async () => {
    setIsScanning(true);
    const toastId = toast.loading('Executing multi-vector market telemetry scan...');

    try {
      const newInsight = await apiFetch<Insight>('/api/insights/scan', {
        method: 'POST',
      });

      setInsights((prev) => [newInsight, ...prev]);
      toast.success('New high-confidence market signal detected!', { id: toastId });
      setSelectedInsight(newInsight);
    } catch (err: any) {
      toast.error(err.message || 'Intelligence scan encountered a timeout.', { id: toastId });
    } finally {
      setIsScanning(false);
    }
  };

  const handleShare = (title: string) => {
    navigator.clipboard.writeText(`TrackWise Intelligence Signal: ${title}`);
    toast.success('Strategic signal brief copied to clipboard.');
  };

  const handleExportPDF = async () => {
    const loadingToast = toast.loading('Generating executive vector PDF report...');
    try {
      const topInsight = insights[0];
      const recs = insights.slice(0, 4).map((ins) => `${ins.title}: ${ins.desc}`);

      await generateVectorPDF({
        title: `Market Intelligence & Strategic Signals Brief`,
        workspaceName: activeWorkspace?.name || 'Kinetic Global Analytics',
        industry: activeWorkspace?.industry || 'SaaS',
        currency: activeWorkspace?.currency || 'USD',
        summary: topInsight
          ? `${topInsight.title} — ${topInsight.desc}. ${topInsight.fullContent || ''}`
          : `Executive market signals synthesize regional unit economics, operational leverage, and capital efficiency.`,
        recommendations: recs.length > 0 ? recs : undefined,
        metrics: {
          revenue: 99200,
          expenses: 56200,
          margin: 43.3,
          churnRate: 1.5,
          customers: 2450,
          ruleOf40: 48.3,
          ltv: 66133,
          efficiencyScore: 92,
          riskLevel: 'Low',
        },
      });

      toast.success('Strategic signals vector PDF exported successfully.', { id: loadingToast });
    } catch (err) {
      console.error('Vector PDF export error:', err);
      toast.error('Export failed. Please try again.', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="text-amber-500" size={15} />
            <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
              Autonomous Intelligence Feed
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Market Intelligence & Strategic Signals
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Automated trend detection, expansion opportunities, and competitive unit economics.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs active:scale-95"
          >
            <FileText size={14} className="text-slate-500" />
            <span>Export Report</span>
          </button>
          <button
            onClick={runIntelligenceScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-950 transition-all shadow-xs active:scale-95 disabled:opacity-50"
          >
            {isScanning ? <BrainCircuit size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span>{isScanning ? 'Synthesizing...' : 'Run Intelligence Scan'}</span>
          </button>
        </div>
      </div>

      <div id="insights-report" className="space-y-8">
        {/* Priority Hero Signal Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800 relative group"
        >
          <div className="flex flex-col lg:flex-row">
            <div className="flex-1 p-6 md:p-8 text-white z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-emerald-400 text-[10px] font-bold tracking-wider uppercase mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Verified Signal #042
              </div>
              <h2 className="text-xl md:text-3xl font-extrabold mb-3 leading-tight tracking-tight text-white">
                The Fatigue Shift: Strategic Pivot to Usage-Based Architecture
              </h2>
              <p className="text-slate-300 text-xs md:text-sm mb-6 leading-relaxed max-w-2xl font-normal">
                Analysis indicates a 15% increase in churn sensitivity across mid-market enterprise tiers. We
                recommend transitioning from flat-rate pricing to a tiered usage model by Q3 to optimize expansion
                revenue.
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    if (insights.length > 0) setSelectedInsight(insights[0]);
                  }}
                  className="bg-emerald-400 text-slate-950 px-5 py-2 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-emerald-300 active:scale-95 transition-all"
                >
                  <span>View Action Roadmap</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  onClick={handleExportPDF}
                  className="bg-slate-800 text-slate-200 border border-slate-700 px-4 py-2 rounded-xl font-bold text-xs hover:bg-slate-700 transition-all active:scale-95"
                >
                  Download Executive Brief
                </button>
              </div>
            </div>

            <div className="lg:w-[360px] bg-slate-950/80 p-6 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-slate-800 z-10">
              <div className="space-y-4">
                <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Signal Confidence Score
                  </p>
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-black text-emerald-400 tracking-tight">94%</span>
                    <div className="mb-0.5">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <div key={s} className="w-2.5 h-1 rounded-full bg-emerald-400" />
                        ))}
                      </div>
                      <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                        High Verification
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monitored Telemetry</p>
                  {[
                    { label: 'Macro Volatility Index', trend: '+12%' },
                    { label: 'Competitor Price Parity', trend: 'SaaS Vertical' },
                    { label: 'Churn Sensitivity Velocity', trend: 'Low Risk' },
                  ].map((driver, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 bg-slate-900/60 rounded-xl border border-slate-800/80"
                    >
                      <span className="text-slate-300 font-medium">{driver.label}</span>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded">
                        {driver.trend}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Live Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 w-full sm:w-auto">
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setFilterTag(tag)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  filterTag === tag
                    ? 'bg-indigo-900 text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter signals..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-1.5 text-xs font-medium outline-none focus:bg-white focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Insights Grid */}
        {loading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <Loader2 className="animate-spin text-indigo-600 mx-auto mb-3" size={24} />
            <p className="text-xs font-bold text-slate-600">Retrieving intelligence signals from database...</p>
          </div>
        ) : filteredInsights.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
            <p className="text-sm font-bold text-slate-700">No market signals match your criteria.</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting the search query or tag filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredInsights.map((insight) => (
                <motion.div
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  key={insight.id}
                  className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col group hover:border-slate-300 transition-all hover:-translate-y-0.5"
                >
                  <div
                    className="h-44 relative overflow-hidden cursor-pointer"
                    onClick={() => setSelectedInsight(insight)}
                  >
                    <img
                      src={insight.image}
                      alt={insight.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-3.5 left-3.5">
                      <div className="bg-white/95 backdrop-blur-md px-2.5 py-0.5 rounded-lg text-[10px] font-bold text-slate-900 uppercase tracking-wider shadow-2xs">
                        {insight.tag}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSave(insight.id);
                      }}
                      className={`absolute top-3.5 right-3.5 w-8 h-8 flex items-center justify-center rounded-lg backdrop-blur-md transition-all ${
                        insight.savedByUser
                          ? 'bg-amber-500 text-white shadow-2xs'
                          : 'bg-white/90 text-slate-600 hover:text-indigo-600'
                      }`}
                      title={insight.savedByUser ? 'Saved' : 'Save bookmark'}
                    >
                      <Bookmark size={14} fill={insight.savedByUser ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Calendar size={12} className="text-slate-400" />
                      <span className="text-[10px] font-semibold text-slate-400">{insight.date}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-[10px] font-bold text-emerald-600">{insight.confidence}% Match</span>
                    </div>
                    <h3
                      onClick={() => setSelectedInsight(insight)}
                      className="text-sm font-bold text-slate-900 mb-1.5 group-hover:text-indigo-600 transition-colors cursor-pointer leading-snug line-clamp-2"
                    >
                      {insight.title}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4 line-clamp-2">
                      {insight.desc}
                    </p>

                    <div className="mt-auto pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <img
                          src={insight.avatar}
                          alt={insight.author}
                          className="w-6 h-6 rounded-md object-cover border border-slate-200"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[100px]">
                          {insight.author}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleLike(insight.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-xs font-semibold ${
                            insight.likedByUser
                              ? 'bg-rose-50 text-rose-600'
                              : 'hover:bg-slate-50 text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Heart size={13} fill={insight.likedByUser ? 'currentColor' : 'none'} />
                          <span>{insight.likes}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleShare(insight.title)}
                          className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-all"
                          title="Copy Share Link"
                        >
                          <Share2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Strategic Insight Detail & Action Item Modal */}
      <AnimatePresence>
        {selectedInsight && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedInsight(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden relative shadow-2xl flex flex-col z-10"
            >
              <button
                onClick={() => setSelectedInsight(null)}
                className="absolute top-4 right-4 z-20 p-2 bg-black/40 hover:bg-black/60 text-white rounded-xl transition-all"
              >
                <X size={18} />
              </button>

              <div className="h-52 relative">
                <img
                  src={selectedInsight.image}
                  alt={selectedInsight.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-6 flex flex-col justify-end">
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-bold tracking-wider uppercase mb-2 border border-white/20 w-fit">
                    {selectedInsight.tag}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                    {selectedInsight.title}
                  </h2>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedInsight.avatar}
                      alt={selectedInsight.author}
                      className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{selectedInsight.author}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{selectedInsight.date}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-100">
                    <CheckCircle2 size={16} />
                    <span className="text-xs font-bold">Confidence Index: {selectedInsight.confidence}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-4">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Lightbulb size={14} className="text-amber-500" />
                      Strategic Briefing
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal bg-slate-50 p-4 rounded-xl border border-slate-100">
                      {selectedInsight.fullContent || selectedInsight.desc}
                    </p>
                  </div>

                  {/* Interactive Action Items Checklist */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Action Items</h4>
                    <div className="space-y-2">
                      {(selectedInsight.actionItems || []).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => toggleActionItem(item.id)}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            item.done
                              ? 'bg-emerald-50/70 border-emerald-200 text-slate-500 line-through'
                              : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-800'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              item.done
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {item.done && <Check size={11} />}
                          </div>
                          <span className="text-xs font-medium leading-snug">{item.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                <button
                  onClick={() => toggleLike(selectedInsight.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                    selectedInsight.likedByUser
                      ? 'bg-rose-50 border-rose-200 text-rose-600'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Heart size={14} fill={selectedInsight.likedByUser ? 'currentColor' : 'none'} />
                  <span>{selectedInsight.likedByUser ? 'Liked' : 'Like'} ({selectedInsight.likes})</span>
                </button>

                <button
                  onClick={() => setSelectedInsight(null)}
                  className="px-5 py-2 bg-indigo-900 text-white text-xs font-bold rounded-xl hover:bg-indigo-950 transition-colors"
                >
                  Close Brief
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
