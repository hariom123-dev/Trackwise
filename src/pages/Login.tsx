import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Mail, Lock, User, Briefcase, ArrowRight, Sparkles, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { IMAGES } from '../constants';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleFillDemo = () => {
    setIsSignUp(false);
    setEmail('alex@kinetic.com');
    setPassword('Password123!');
    toast.info('Demo credentials populated for Alex Sterling.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          toast.error('Please enter your full name');
          setSubmitting(false);
          return;
        }
        await register(name, email, password, role || 'Strategist');
        toast.success('Account created successfully! Welcome to TrackWise.');
      } else {
        await login(email, password);
        toast.success('Signed in successfully.');
      }
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans text-slate-900">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-6 md:px-16 lg:px-24 py-12">
        <div className="max-w-md w-full mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors mb-8 font-bold text-xs"
          >
            <ArrowLeft size={14} /> Back to Home
          </Link>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-900 flex items-center justify-center text-white font-black shadow-xs">
              <Sparkles size={14} className="text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-indigo-900 uppercase tracking-widest">TrackWise Intelligence</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-1 tracking-tight">
            {isSignUp ? 'Create Workspace Account' : 'Welcome Back'}
          </h1>
          <p className="text-slate-500 mb-6 text-xs font-medium">
            {isSignUp
              ? 'Start your 14-day full access enterprise analytics trial.'
              : 'Access your predictive business intelligence workspace.'}
          </p>

          {/* Quick 1-Click Demo Button */}
          <div className="mb-6 p-3 rounded-2xl bg-indigo-50/80 border border-indigo-200/70 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <KeyRound size={16} />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-950">Instant Demo Access</p>
                <p className="text-[10px] text-indigo-600 font-medium">Pre-loaded with 12 months rich telemetry</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-950 text-white rounded-lg text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              Fill Demo
            </button>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex p-1 bg-slate-200/70 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                !isSignUp ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                isSignUp ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Sterling"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role / Title (Optional)</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="VP of Strategy & Finance"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all outline-none"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Password</label>
                {!isSignUp && (
                  <span className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer">
                    Forgot?
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all outline-none"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-indigo-900 text-white py-3 rounded-xl text-xs font-bold shadow-md shadow-indigo-900/15 flex items-center justify-center gap-2 hover:bg-indigo-950 active:scale-95 transition-all mt-2 disabled:opacity-50"
            >
              <span>{submitting ? 'Authenticating...' : isSignUp ? 'Create Enterprise Account' : 'Sign In to TrackWise'}</span>
              <ArrowRight size={15} />
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-200/80 text-center">
            <p className="text-xs text-slate-500 font-medium">
              {isSignUp ? (
                <>
                  Already have an account?{' '}
                  <button onClick={() => setIsSignUp(false)} className="text-indigo-700 font-bold hover:underline">
                    Sign In
                  </button>
                </>
              ) : (
                <>
                  Need an enterprise license?{' '}
                  <button onClick={() => setIsSignUp(true)} className="text-indigo-700 font-bold hover:underline">
                    Start 14-day free trial
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Executive Testimonial Visual */}
      <div className="hidden md:flex flex-1 bg-slate-900 relative overflow-hidden items-center justify-center p-16 border-l border-slate-800">
        <div className="relative z-10 text-center max-w-md">
          <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 shadow-xl mb-8">
            <img
              src={IMAGES.HERO_DASHBOARD}
              alt="Dashboard Preview"
              className="w-full rounded-xl border border-slate-800"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-xl font-bold text-white mb-3 tracking-tight">
            "TrackWise has fundamentally changed how we forecast capital allocation and retention risk."
          </h2>
          <p className="text-slate-400 text-xs font-semibold">— Sarah Chen, CFO at Kinetic Global</p>
          <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-400" /> SOC2 Compliant
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-emerald-400" /> 256-bit Encryption
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
