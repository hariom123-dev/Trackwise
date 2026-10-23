import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Lock, 
  Bell, 
  Globe, 
  Shield, 
  Key, 
  Save, 
  Trash2, 
  Camera, 
  Mail, 
  Phone, 
  CreditCard, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  X, 
  Loader2, 
  Briefcase, 
  Upload,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { useNavigate } from 'react-router-dom';

/**
 * Client-side HTML5 canvas image resize and compression
 */
function compressImage(file: File, maxDim = 256, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Settings() {
  const { user, updateUserState, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    name: user?.name || 'Alex Sterling',
    email: user?.email || 'alex@kinetic.com',
    phone: user?.phone || '+1 (555) 000-0000',
    role: user?.role || 'Lead Strategist at Kinetic Global',
    timezone: user?.timezone || 'Pacific Time (PT)',
    avatar: user?.avatar || 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=facearea&facepad=2.5&w=400&h=400&q=80',
  });

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Security & Preferences State
  const [apiKey, setApiKey] = useState(user?.apiKey || 'tw_live_9f83b2a1c0d4e5f6a7b8c9d0e1f2a3b4');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.twoFactorEnabled));
  const [notifications, setNotifications] = useState(
    user?.notifications || {
      email: true,
      push: true,
      weekly: true,
      predictive: true,
    }
  );

  const [integrations, setIntegrations] = useState(
    user?.integrations || [
      { id: 'ga', name: 'Google Analytics', status: 'Connected', icon: Globe },
      { id: 'stripe', name: 'Stripe', status: 'Connected', icon: CreditCard },
      { id: 'slack', name: 'Slack', status: 'Not Connected', icon: Bell },
      { id: 'salesforce', name: 'Salesforce', status: 'Not Connected', icon: Shield },
    ]
  );

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || '',
        timezone: user.timezone || 'Pacific Time (PT)',
        avatar: user.avatar || '',
      });
      if (user.apiKey) setApiKey(user.apiKey);
      if (user.notifications) setNotifications(user.notifications);
      if (user.integrations && user.integrations.length > 0) setIntegrations(user.integrations);
      setTwoFactorEnabled(Boolean(user.twoFactorEnabled));
    }
  }, [user]);

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  // Image Upload with Client-Side Canvas Compression
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select a valid image file');
        return;
      }

      try {
        const compressedBase64 = await compressImage(file, 256, 0.8);
        setProfileData((prev) => ({ ...prev, avatar: compressedBase64 }));
        toast.success('Profile avatar compressed & staged. Click "Save Changes" to persist.');
      } catch (err) {
        toast.error('Failed to process image');
      }
    }
  };

  // Save Profile to Backend
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileData.name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    if (!profileData.email.trim()) {
      toast.error('Email cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<{ user: any }>('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });

      if (res?.user) {
        updateUserState(res.user);
        toast.success('Profile saved to database successfully!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  // Password Change
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      await apiFetch('/api/user/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      toast.success('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Toggle Notification preferences and persist to SQLite
  const toggleNotification = async (key: keyof typeof notifications) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);

    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ notifications: updated }),
      });
      updateUserState({ notifications: updated });
      toast.success(`${key.toUpperCase()} notification preferences updated.`);
    } catch {
      toast.error('Failed to save notification preferences.');
    }
  };

  // Toggle Integration status and persist to SQLite
  const handleIntegrationToggle = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Connected' ? 'Not Connected' : 'Connected';
    const updated = integrations.map((item) =>
      item.id === id ? { ...item, status: newStatus } : item
    );
    setIntegrations(updated);

    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ integrations: updated }),
      });
      updateUserState({ integrations: updated });
      toast.success(`Integration updated.`);
    } catch {
      toast.error('Failed to update integration status.');
    }
  };

  // Regenerate API Key via Backend
  const handleRegenerateApiKey = async () => {
    try {
      const res = await apiFetch<{ apiKey: string }>('/api/user/api-key/regenerate', {
        method: 'POST',
      });
      setApiKey(res.apiKey);
      updateUserState({ apiKey: res.apiKey });
      toast.success('Generated new API Key.');
    } catch {
      toast.error('Failed to regenerate API Key.');
    }
  };

  // Toggle 2FA via Backend
  const handleToggle2FA = async () => {
    const nextVal = !twoFactorEnabled;
    setTwoFactorEnabled(nextVal);

    try {
      await apiFetch('/api/user/preferences', {
        method: 'PUT',
        body: JSON.stringify({ twoFactorEnabled: nextVal }),
      });
      updateUserState({ twoFactorEnabled: nextVal });
      toast.success(`Two-factor authentication ${nextVal ? 'enabled' : 'disabled'}.`);
    } catch {
      toast.error('Failed to update 2FA.');
    }
  };

  // Delete Account
  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await apiFetch('/api/user/account', { method: 'DELETE' });
      toast.success('Account and associated telemetry deleted.');
      logout();
      navigate('/login');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account.');
      setDeleting(false);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    toast.success('API Key copied to clipboard');
    setTimeout(() => setApiKeyCopied(false), 2000);
  };

  const tabs = [
    { id: 'profile', icon: User, label: 'Profile' },
    { id: 'security', icon: Lock, label: 'Security & Auth' },
    { id: 'notifications', icon: Bell, label: 'Notifications' },
    { id: 'integrations', icon: Globe, label: 'Integrations' },
  ];

  return (
    <div className="space-y-8 max-w-5xl mx-auto font-sans pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Workspace Settings</h1>
        <p className="text-slate-500 font-medium text-xs sm:text-sm mt-0.5">
          Manage your executive profile, authentication security, telemetry keys, and integrations.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Tabs */}
        <aside className="w-full md:w-60 space-y-1.5 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <tab.icon size={16} />
              <span>{tab.label}</span>
            </button>
          ))}
        </aside>

        {/* Tab Content Box */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 md:p-8">
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/*"
                className="hidden"
              />

              <div className="flex items-center gap-5">
                <div className="relative group cursor-pointer" onClick={handleFileClick}>
                  <img
                    src={profileData.avatar}
                    alt="Profile Avatar"
                    className="w-20 h-20 rounded-2xl object-cover ring-2 ring-slate-100 shadow-xs transition-transform group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity text-white font-medium text-xs gap-1">
                    <Camera size={18} />
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-slate-900">{profileData.name || 'Alex Sterling'}</h3>
                  <p className="text-xs text-slate-500 font-medium">{profileData.role || 'Member'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      type="button"
                      onClick={handleFileClick}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:underline"
                    >
                      <Upload size={13} /> Change Avatar
                    </button>
                  </div>
                </div>
              </div>

              <form onSubmit={handleProfileUpdate} className="space-y-4 pt-4 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Executive Role / Title
                    </label>
                    <input
                      type="text"
                      value={profileData.role}
                      onChange={(e) => setProfileData({ ...profileData, role: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Timezone
                    </label>
                    <select
                      value={profileData.timezone}
                      onChange={(e) => setProfileData({ ...profileData, timezone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                    >
                      <option value="Pacific Time (PT)">Pacific Time (PT)</option>
                      <option value="Eastern Time (ET)">Eastern Time (ET)</option>
                      <option value="Central European Time (CET)">Central European Time (CET)</option>
                      <option value="India Standard Time (IST)">India Standard Time (IST)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-950 transition-all shadow-xs active:scale-95 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    <span>Save Changes</span>
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
              {/* Password Change Form */}
              <form onSubmit={handlePasswordUpdate} className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Change Account Password</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                      required
                      minLength={6}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-900 outline-none focus:bg-white focus:border-indigo-600 transition-all"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-4 py-2 bg-indigo-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-950 transition-all shadow-xs disabled:opacity-50"
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>

              {/* Two-Factor Authentication */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Two-Factor Authentication (2FA)</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Add an extra layer of security using TOTP authenticator apps.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggle2FA}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    twoFactorEnabled
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {twoFactorEnabled ? 'Enabled' : 'Enable 2FA'}
                </button>
              </div>

              {/* Developer API Key */}
              <div className="pt-6 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Workspace API Key</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Use this key to programmatically ingest metrics into TrackWise.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenerateApiKey}
                    className="flex items-center gap-1 text-xs font-bold text-indigo-700 hover:underline"
                  >
                    <RefreshCw size={12} /> Regenerate
                  </button>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 overflow-hidden font-mono text-xs text-slate-700">
                    <Key size={14} className="text-indigo-600 shrink-0" />
                    <span>{apiKeyVisible ? apiKey : apiKey.slice(0, 10) + '••••••••••••••••••••••••'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setApiKeyVisible(!apiKeyVisible)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                    >
                      {apiKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={copyApiKey}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 rounded"
                    >
                      {apiKeyCopied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Danger Zone: Delete Account */}
              <div className="pt-6 border-t border-rose-100 space-y-3">
                <h4 className="text-xs font-bold text-rose-600 uppercase tracking-wider">Danger Zone</h4>
                <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-rose-900">Delete Account & Stored Telemetry</p>
                    <p className="text-[11px] text-rose-600">
                      Permanently delete your profile and all 12-month historical time-series records.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Notification Preferences</h3>
              {[
                {
                  id: 'email',
                  title: 'Email Digest Notifications',
                  desc: 'Receive critical monthly burn rate and revenue milestone summaries.',
                },
                {
                  id: 'push',
                  title: 'Real-Time Browser Signals',
                  desc: 'Notify when sudden churn rate deviations or model forecasts are calculated.',
                },
                {
                  id: 'weekly',
                  title: 'Weekly Executive Briefing',
                  desc: 'A Monday morning synthesized report of unit metrics and model adjustments.',
                },
                {
                  id: 'predictive',
                  title: 'Autonomous System Alerts',
                  desc: 'Proactive recommendations generated when margin dips below target benchmarks.',
                },
              ].map((item) => {
                const isEnabled = notifications[item.id as keyof typeof notifications];
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.title}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleNotification(item.id as any)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        isEnabled ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full bg-white shadow-xs" />
                    </button>
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* INTEGRATIONS TAB */}
          {activeTab === 'integrations' && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Connected Data Sources</h3>
              <div className="space-y-3">
                {integrations.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-xl border border-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Globe size={16} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{item.name}</p>
                        <p className="text-[11px] text-slate-500 font-medium">{item.status}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleIntegrationToggle(item.id, item.status)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        item.status === 'Connected'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {item.status === 'Connected' ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteModal(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-10 space-y-4"
            >
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-900">Confirm Account Deletion</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to permanently delete your TrackWise account? All recorded time-series and
                  forecasts will be erased from SQLite.
                </p>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
