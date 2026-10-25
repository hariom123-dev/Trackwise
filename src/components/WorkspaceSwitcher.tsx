import React, { useState, useRef, useEffect } from 'react';
import { 
  Building2, 
  ChevronsUpDown, 
  Check, 
  Plus, 
  Briefcase, 
  ShoppingBag, 
  Landmark, 
  Activity, 
  GraduationCap, 
  Truck, 
  Layers, 
  X, 
  Sparkles,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useWorkspace, Workspace } from '../context/WorkspaceContext';

interface WorkspaceSwitcherProps {
  className?: string;
}

const getIndustryIcon = (industry: string) => {
  const norm = (industry || '').toLowerCase();
  if (norm.includes('kirana') || norm.includes('grocery')) return ShoppingBag;
  if (norm.includes('f&b') || norm.includes('restaurant')) return Activity;
  if (norm.includes('electronic') || norm.includes('mobile')) return Sparkles;
  if (norm.includes('apparel') || norm.includes('fashion')) return Layers;
  if (norm.includes('service')) return Briefcase;
  if (norm.includes('saas') || norm.includes('software')) return Briefcase;
  if (norm.includes('e-com') || norm.includes('retail')) return ShoppingBag;
  return Building2;
};

const INDUSTRY_OPTIONS = [
  { value: 'Kirana / Grocery', label: 'Kirana / Grocery Store' },
  { value: 'F&B / Restaurant', label: 'F&B / Restaurant & Cafe' },
  { value: 'Electronics / Mobile', label: 'Electronics & Mobile Retail' },
  { value: 'Apparel', label: 'Apparel & Fashion Boutique' },
  { value: 'Services', label: 'Services & Local Merchant' },
];

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR (₹) - Indian Rupee (Default)' },
  { value: 'USD', label: 'USD ($) - US Dollar' },
  { value: 'EUR', label: 'EUR (€) - Euro' },
  { value: 'GBP', label: 'GBP (£) - British Pound' },
  { value: 'CAD', label: 'CAD ($) - Canadian Dollar' },
];

export default function WorkspaceSwitcher({ className = '' }: WorkspaceSwitcherProps) {
  const { workspaces, activeWorkspace, switchWorkspace, createWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal form states
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('Kirana / Grocery');
  const [currency, setCurrency] = useState('INR');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectWorkspace = async (wsId: string) => {
    setIsOpen(false);
    if (activeWorkspace?.id !== wsId) {
      await switchWorkspace(wsId);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      await createWorkspace({
        name: name.trim(),
        industry,
        currency,
      });
      setName('');
      setIndustry('Kirana / Grocery');
      setCurrency('INR');
      setIsModalOpen(false);
      setIsOpen(false);
    } catch {
      // Error handled by context toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const ActiveIcon = activeWorkspace ? getIndustryIcon(activeWorkspace.industry) : Building2;

  return (
    <>
      <div className={`relative px-2 mb-4 ${className}`} ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/90 text-left transition-all group shadow-2xs hover:border-slate-300"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-200/40 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <ActiveIcon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
                <span className="truncate">{activeWorkspace?.name || 'Select Entity'}</span>
              </div>
              <div className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                <span>{activeWorkspace?.industry || 'Enterprise'}</span>
                <span>•</span>
                <span className="uppercase text-[9px] font-semibold text-slate-400">
                  {activeWorkspace?.currency || 'INR'}
                </span>
              </div>
            </div>
          </div>
          <ChevronsUpDown size={15} className="text-slate-400 group-hover:text-slate-600 shrink-0 ml-1 transition-transform" />
        </button>

        {/* Dropdown Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-2 right-2 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-slate-200/90 overflow-hidden"
            >
              <div className="p-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Business Profiles
                </span>
                <span className="text-[10px] font-semibold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200/80">
                  {workspaces.length} Total
                </span>
              </div>

              {/* Workspace List */}
              <div className="max-h-56 overflow-y-auto p-1.5 space-y-1">
                {workspaces.map((ws) => {
                  const Icon = getIndustryIcon(ws.industry);
                  const isSelected = activeWorkspace?.id === ws.id;

                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => handleSelectWorkspace(ws.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/80 text-indigo-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{ws.name}</p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span>{ws.industry}</span>
                            <span>•</span>
                            <span>{ws.currency}</span>
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <Check size={14} className="text-indigo-600 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Action Button */}
              <div className="p-1.5 border-t border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/80 border border-dashed border-indigo-200 transition-colors"
                >
                  <Plus size={14} />
                  <span>Create New Workspace</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Workspace Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsModalOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center border border-indigo-100">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Create Business Entity</h3>
                    <p className="text-xs text-slate-500">
                      Provision an isolated workspace with dedicated telemetry.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Company / Entity Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Aether Consumer Retail, Fintech Labs"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Industry Vertical <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  >
                    {INDUSTRY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Primary Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                  >
                    {CURRENCY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim()}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Creating...</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Create Entity</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
