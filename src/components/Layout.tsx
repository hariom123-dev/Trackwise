import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Database, 
  Lightbulb, 
  CreditCard, 
  Settings, 
  Bell, 
  Grid, 
  Search, 
  Menu, 
  X, 
  Briefcase, 
  BarChart, 
  TrendingUp, 
  FileText,
  ArrowRight,
  Sparkles,
  ChevronRight,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Info,
  Clock,
  History,
  ShieldCheck,
  CheckCheck,
  Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import CommandSearch from './CommandSearch';
import AICopilotDrawer from './AICopilotDrawer';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import { apiFetch } from '../utils/api';
import { toast } from 'sonner';

interface LayoutProps {
  children: React.ReactNode;
}

interface NotificationItem {
  id: string;
  title: string;
  text: string;
  type: 'success' | 'warning' | 'info';
  isRead: boolean;
  createdAt: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  details: string;
  createdAt: string;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGridOpen, setIsGridOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Live Notifications & Audit Logs State
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditSearch, setAuditSearch] = useState('');

  // Fetch live notifications and audit logs
  const fetchNotifications = async () => {
    try {
      const res = await apiFetch<{
        notifications: NotificationItem[];
        unreadCount: number;
        auditLogs: AuditLogItem[];
      }>('/api/notifications');

      if (res) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
        setAuditLogs(res.auditLogs || []);
      }
    } catch (err: any) {
      console.warn('Could not fetch notifications:', err.message);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const markNotificationRead = async (id?: string) => {
    try {
      await apiFetch('/api/notifications/mark-read', {
        method: 'POST',
        body: JSON.stringify({ id: id || 'all' }),
      });

      if (id && id !== 'all') {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } else {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err: any) {
      toast.error('Failed to update notification status.');
    }
  };

  // Global ⌘K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Database, label: 'Data Lab', path: '/data' },
    { icon: Lightbulb, label: 'Insights', path: '/insights' },
    { icon: CreditCard, label: 'Subscription', path: '/subscription' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const quickActions = [
    { icon: Database, label: 'Data Lab', desc: 'Manage datasets', color: 'bg-indigo-600', path: '/data' },
    { icon: TrendingUp, label: 'ML Models', desc: 'Predictive tools', color: 'bg-emerald-600', path: '/data' },
    { icon: FileText, label: 'Reports', desc: 'Executive analytics', color: 'bg-blue-600', path: '/dashboard' },
    { icon: BarChart, label: 'Visualizer', desc: 'Dynamic charts', color: 'bg-purple-600', path: '/dashboard' },
    { icon: Briefcase, label: 'Intelligence', desc: 'Market signals', color: 'bg-amber-600', path: '/insights' },
    { icon: Search, label: 'Discovery', desc: 'Explore trends', color: 'bg-rose-600', path: '/insights' },
  ];

  const planName = 
    user?.planId === 'enterprise' 
      ? 'Enterprise Plan Active' 
      : user?.planId === 'professional' 
      ? 'Professional Plan Active' 
      : 'Free Trial Active';

  const planBadgeColor = 
    user?.planId === 'enterprise' 
      ? 'text-emerald-400' 
      : user?.planId === 'professional' 
      ? 'text-indigo-300' 
      : 'text-amber-400';

  const userName = user?.name || 'Alex Sterling';
  const userRole = user?.role || 'Lead Strategist';
  const userAvatar = user?.avatar || 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80';

  const filteredAuditLogs = auditLogs.filter((log) =>
    log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
    log.details.toLowerCase().includes(auditSearch.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#f8fafc] font-sans text-slate-900 antialiased">
      {/* Command Palette */}
      <CommandSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* AI Financial Copilot Drawer */}
      <AICopilotDrawer isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />

      {/* Mobile Sidebar Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[60] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className={`fixed left-0 top-0 h-screen w-64 bg-white border-r border-slate-200/80 flex flex-col py-6 px-4 z-[70] transition-transform duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Brand Header */}
        <div className="mb-8 px-2 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-indigo-900 flex items-center justify-center text-white font-black shadow-md shadow-indigo-900/20 group-hover:bg-indigo-800 transition-colors">
              <Sparkles size={18} className="text-emerald-400" />
            </div>
            <div>
              <span className="text-lg font-extrabold text-slate-900 tracking-tight block leading-tight">TrackWise</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Intelligence Suite</span>
            </div>
          </Link>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Multi-Business Workspace Switcher */}
        <WorkspaceSwitcher />
        
        {/* Main Nav Links */}
        <div className="px-2 mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Navigation</span>
        </div>
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive 
                    ? 'text-indigo-950 font-bold bg-indigo-50/80 border-l-2 border-indigo-600 shadow-2xs' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight size={14} className="text-indigo-600" />}
              </Link>
            );
          })}
        </nav>

        {/* Dynamic Plan Banner */}
        <div className="mx-1 my-4 p-4 rounded-2xl bg-gradient-to-b from-slate-900 to-indigo-950 text-white relative overflow-hidden border border-indigo-900/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
          <div className={`flex items-center gap-1.5 text-xs font-bold ${planBadgeColor} uppercase tracking-wider mb-1`}>
            <Sparkles size={12} /> {planName}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-medium mb-3">
            {user?.planId === 'enterprise' 
              ? 'Dedicated ML throughput & unlimited ingestion enabled.' 
              : 'Continuous predictive business forecasting active.'}
          </p>
          <Link 
            to="/subscription" 
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-2xs transition-colors"
          >
            Manage Plan <ArrowRight size={12} />
          </Link>
        </div>

        {/* User Profile & Sign Out Footer */}
        <div className="pt-3 px-2 flex items-center justify-between border-t border-slate-100">
          <Link 
            to="/settings"
            className="flex items-center gap-2.5 hover:bg-slate-50 transition-colors p-1.5 rounded-xl flex-1 min-w-0"
          >
            <img 
              src={userAvatar} 
              alt={userName} 
              className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-100 shadow-2xs shrink-0"
              referrerPolicy="no-referrer"
            />
            <div className="overflow-hidden flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{userName}</p>
              <p className="text-[10px] text-slate-400 font-medium truncate">{userRole}</p>
            </div>
          </Link>

          <button
            onClick={() => {
              logout();
              navigate('/login');
            }}
            title="Sign Out"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors ml-1 shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 lg:ml-64 w-full flex flex-col min-w-0">
        {/* Header Bar */}
        <header className="sticky top-0 h-16 bg-white/80 backdrop-blur-md flex justify-between items-center px-4 lg:px-8 z-40 border-b border-slate-200/60">
          <div className="flex items-center gap-4 flex-1 max-w-xl">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>

            {/* Clickable Command Search Bar */}
            <div 
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:flex items-center flex-1 cursor-pointer"
            >
              <div className="relative w-full group">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-indigo-600 transition-colors" size={16} />
                <div 
                  className="w-full bg-slate-100/80 hover:bg-slate-100 border border-transparent hover:border-slate-300 rounded-xl pl-10 pr-12 py-2 text-xs font-medium text-slate-400 select-none flex items-center justify-between transition-all"
                >
                  <span>Search analytics, models, or datasets...</span>
                  <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
                    ⌘K
                  </kbd>
                </div>
              </div>
            </div>
            <span className="sm:hidden text-base font-extrabold text-slate-900">TrackWise</span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            {/* AI Financial Copilot Header Trigger Button */}
            <button
              onClick={() => setIsCopilotOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer"
              title="Open AI Analyst Copilot Drawer"
            >
              <Sparkles size={14} className="text-emerald-500" />
              <span className="hidden md:inline">AI Analyst</span>
            </button>

            {/* Notification Drawer Button */}
            <div className="relative">
              <button 
                onClick={() => { 
                  setIsNotifOpen(!isNotifOpen); 
                  setIsGridOpen(false); 
                  if (!isNotifOpen) fetchNotifications();
                }}
                className={`p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors relative ${isNotifOpen ? 'bg-slate-100 text-slate-900' : ''}`}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full ring-2 ring-white flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotifOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsNotifOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-4 z-20"
                    >
                      <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live Anomaly Alerts</h4>
                          {unreadCount > 0 && (
                            <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              {unreadCount} Unread
                            </span>
                          )}
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={() => markNotificationRead('all')}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                          >
                            <CheckCheck size={12} />
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {notifications.length === 0 ? (
                          <div className="py-6 text-center text-slate-400 text-xs">
                            No notifications yet.
                          </div>
                        ) : (
                          notifications.map((notif) => {
                            const isWarning = notif.type === 'warning';
                            const isSuccess = notif.type === 'success';
                            const IconComponent = isWarning ? AlertTriangle : isSuccess ? CheckCircle2 : Info;
                            const badgeColor = isWarning 
                              ? 'text-amber-600 bg-amber-50 border border-amber-200' 
                              : isSuccess 
                              ? 'text-emerald-600 bg-emerald-50 border border-emerald-200' 
                              : 'text-indigo-600 bg-indigo-50 border border-indigo-200';

                            return (
                              <div 
                                key={notif.id} 
                                onClick={() => !notif.isRead && markNotificationRead(notif.id)}
                                className={`flex gap-3 p-2.5 rounded-xl transition-all cursor-pointer border ${
                                  notif.isRead 
                                    ? 'bg-slate-50/70 border-slate-100 opacity-75' 
                                    : 'bg-white border-slate-200 shadow-2xs hover:border-indigo-200'
                                }`}
                              >
                                <div className={`p-2 rounded-lg ${badgeColor} shrink-0 self-start`}>
                                  <IconComponent size={15} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <p className={`text-xs font-bold truncate ${notif.isRead ? 'text-slate-700' : 'text-slate-900'}`}>
                                      {notif.title}
                                    </p>
                                    {!notif.isRead && (
                                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                                    {notif.text}
                                  </p>
                                  <p className="text-[9px] text-slate-400 mt-1 font-medium">
                                    {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <button 
                        onClick={() => { 
                          setIsNotifOpen(false); 
                          setIsAuditModalOpen(true); 
                        }}
                        className="w-full mt-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-indigo-100 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <History size={14} />
                        View Activity & Audit Log
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Quick Launch Module Grid */}
            <div className="relative">
              <button 
                onClick={() => { setIsGridOpen(!isGridOpen); setIsNotifOpen(false); }}
                className={`p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors ${isGridOpen ? 'bg-slate-100 text-slate-900' : ''}`}
                aria-label="Quick Modules"
              >
                <Grid size={18} />
              </button>

              <AnimatePresence>
                {isGridOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsGridOpen(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-200/80 p-5 z-20"
                    >
                      <div className="mb-4">
                        <h4 className="text-sm font-bold text-slate-900">Quick Modules</h4>
                        <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Fast Access Navigation</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2.5">
                        {quickActions.map((action, i) => (
                          <button 
                            key={i} 
                            onClick={() => {
                              setIsGridOpen(false);
                              navigate(action.path);
                            }}
                            className="group flex flex-col items-center p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-all text-center cursor-pointer"
                          >
                            <div className={`p-2.5 rounded-xl ${action.color} text-white shadow-2xs group-hover:scale-105 transition-transform`}>
                              <action.icon size={18} />
                            </div>
                            <span className="mt-2 text-xs font-bold text-slate-900">{action.label}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{action.desc}</span>
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                        <span>Workspace v3.4.0</span>
                        <Link to="/subscription" onClick={() => setIsGridOpen(false)} className="text-indigo-600 hover:underline">
                          Tiers
                        </Link>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="hidden sm:block h-5 w-px bg-slate-200 mx-1" />
            <Link 
              to="/settings" 
              className="flex items-center gap-2 hover:bg-slate-100 p-1.5 rounded-xl transition-colors"
              title="Profile Settings"
            >
              <img 
                src={userAvatar} 
                alt={userName} 
                className="w-7 h-7 rounded-full object-cover ring-1 ring-slate-200"
                referrerPolicy="no-referrer"
              />
              <span className="hidden md:inline-block text-xs font-bold text-slate-800">
                {userName.split(' ')[0] || 'User'}
              </span>
            </Link>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Floating "Ask AI Analyst" Copilot Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCopilotOpen(true)}
          className="group flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-xl shadow-indigo-950/25 hover:shadow-2xl hover:shadow-indigo-950/40 border border-indigo-700/50 transition-all cursor-pointer"
        >
          <div className="relative">
            <Sparkles size={18} className="text-emerald-400 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
          </div>
          <span className="text-xs font-bold tracking-tight">Ask AI Analyst</span>
          <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[9px] font-semibold text-indigo-200">
            CFO
          </span>
        </motion.button>
      </div>

      {/* Workspace Activity & Audit Log Modal */}
      <AnimatePresence>
        {isAuditModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuditModalOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] z-10"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-400 shadow-inner">
                    <History size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold tracking-tight">Workspace Audit & Activity Log</h3>
                    <p className="text-xs text-slate-300">
                      Cryptographically tracked activity log and telemetry anomalies
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Filter */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filter audit actions (e.g., ANOMALY, PREDICTION, IMPORT)..."
                    className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:border-indigo-600 transition-colors"
                  />
                </div>
                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                  {filteredAuditLogs.length} events logged
                </span>
              </div>

              {/* Modal Log List */}
              <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50/50">
                {filteredAuditLogs.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No matching audit records found.
                  </div>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const isAnomaly = log.action.includes('ANOMALY');
                    const isMilestone = log.action.includes('MILESTONE');
                    const isAi = log.action.includes('AI') || log.action.includes('PREDICTION');
                    const isSecurity = log.action.includes('SECURITY') || log.action.includes('AUTH');

                    const badgeStyle = isAnomaly
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : isMilestone
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : isAi
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : isSecurity
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200';

                    return (
                      <div
                        key={log.id}
                        className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badgeStyle}`}>
                              {log.action}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                              <Clock size={10} />
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 font-medium leading-relaxed">
                            {log.details}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <ShieldCheck size={13} className="text-emerald-600" />
                  SQLite Immutable Audit Log
                </span>
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Close Audit Viewer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
