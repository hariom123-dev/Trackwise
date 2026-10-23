import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, Database, Lightbulb, CreditCard, Settings, FileText, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../utils/api';

interface CommandSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  id: string;
  category: 'Page' | 'Report' | 'Signal';
  title: string;
  subtitle: string;
  icon: React.ElementType;
  path: string;
}

export default function CommandSearch({ isOpen, onClose }: CommandSearchProps) {
  const [query, setQuery] = useState('');
  const [reports, setReports] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  // Load recent reports for search index
  useEffect(() => {
    if (isOpen) {
      apiFetch<{ reports: any[] }>('/api/data/timeseries')
        .then((res) => {
          if (res?.reports) {
            setReports(res.reports);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const staticItems: SearchItem[] = [
    {
      id: 'page_dashboard',
      category: 'Page',
      title: 'Executive Dashboard',
      subtitle: 'Real-time KPI telemetry and AI revenue trend forecasting',
      icon: LayoutDashboard,
      path: '/dashboard',
    },
    {
      id: 'page_data',
      category: 'Page',
      title: 'Data Lab & Model Ingestion',
      subtitle: 'Upload multi-row CSV/Excel sheets and run ML predictions',
      icon: Database,
      path: '/data',
    },
    {
      id: 'page_insights',
      category: 'Page',
      title: 'Market Intelligence Signals',
      subtitle: 'Strategic intelligence feeds, bookmarks, and action checklists',
      icon: Lightbulb,
      path: '/insights',
    },
    {
      id: 'page_subscription',
      category: 'Page',
      title: 'Subscription & Tier Management',
      subtitle: 'Manage Professional and Enterprise workspace plans',
      icon: CreditCard,
      path: '/subscription',
    },
    {
      id: 'page_settings',
      category: 'Page',
      title: 'Workspace Settings & Security',
      subtitle: 'Profile customization, password changes, and API credentials',
      icon: Settings,
      path: '/settings',
    },
    {
      id: 'sig_emea',
      category: 'Signal',
      title: 'EMEA Expansion Opportunity',
      subtitle: 'High unsaturated DACH region demand for GDPR analytics',
      icon: Lightbulb,
      path: '/insights',
    },
    {
      id: 'sig_retention',
      category: 'Signal',
      title: 'Retention & Onboarding Optimization',
      subtitle: 'Automated configuration wizards to reduce Day-30 churn',
      icon: Lightbulb,
      path: '/insights',
    },
    {
      id: 'sig_cloud',
      category: 'Signal',
      title: 'Infrastructure & Compute Efficiency',
      subtitle: 'ARM instance workload migration for $12k/mo cost reduction',
      icon: Lightbulb,
      path: '/insights',
    },
  ];

  const reportItems: SearchItem[] = reports.map((rep) => ({
    id: `rep_${rep.id}`,
    category: 'Report',
    title: `${rep.industry} Strategy Report (${new Date(rep.timestamp).toLocaleDateString()})`,
    subtitle: rep.summary?.slice(0, 80) + '...',
    icon: FileText,
    path: `/dashboard?reportId=${rep.id}`,
  }));

  const allItems = [...staticItems, ...reportItems];

  const filteredItems = allItems.filter((item) => {
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const handleSelect = (item: SearchItem) => {
    onClose();
    navigate(item.path);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          handleSelect(filteredItems[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 flex flex-col max-h-[80vh]"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 bg-slate-50/50">
              <Search className="text-slate-400 shrink-0" size={18} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search modules, analytics, models, or datasets..."
                autoFocus
                className="w-full bg-transparent text-sm font-semibold text-slate-800 placeholder-slate-400 outline-none"
              />
              {query && (
                <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                  <X size={16} />
                </button>
              )}
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded">
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <div className="overflow-y-auto p-2 divide-y divide-slate-100 flex-1">
              {filteredItems.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs font-bold text-slate-500">No results found for "{query}"</p>
                  <p className="text-[11px] text-slate-400 mt-1">Try searching for "Dashboard", "Data", "Retention", or "Report"</p>
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                        isSelected ? 'bg-indigo-50/80 border-l-4 border-indigo-600' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-xl shrink-0 ${
                            item.category === 'Page'
                              ? 'bg-indigo-100 text-indigo-700'
                              : item.category === 'Report'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate">{item.title}</span>
                            <span
                              className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                                item.category === 'Page'
                                  ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                  : item.category === 'Report'
                                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-600 border border-amber-200'
                              }`}
                            >
                              {item.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.subtitle}</p>
                        </div>
                      </div>
                      <ArrowRight size={14} className={`shrink-0 ml-2 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`} />
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Navigation Info */}
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] font-semibold text-slate-400">
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Open</span>
                <span>ESC Close</span>
              </div>
              <span>TrackWise Command Center</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
