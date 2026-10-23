import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Zap, ShieldCheck, Globe, Loader2, AlertCircle, Sparkles, Check } from 'lucide-react';
import { toast } from 'sonner';
import { loadRazorpay } from '../services/razorpay';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

type Interval = 'monthly' | 'halfyearly' | 'yearly';

export default function Subscription() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();

  const [interval, setInterval] = useState<Interval>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setShowSuccessBanner(true);
      toast.success('Your subscription was activated successfully!');
    }
  }, [searchParams]);

  const plans = [
    {
      id: 'professional',
      name: 'Professional',
      description: 'Perfect for individual strategists, quantitative analysts, and scaling ventures.',
      prices: {
        monthly: 9900,
        halfyearly: 55000,
        yearly: 99000,
      },
      usdEquiv: {
        monthly: '~$119 / mo',
        halfyearly: '~$110 / mo',
        yearly: '~$99 / mo',
      },
      features: [
        'Up to 10M Historical Data Rows',
        'Continuous ML Trend & Churn Analysis',
        'Custom Executive PDF Strategy Exports',
        'Developer API Access (10k calls/mo)',
        'Priority Email & Community Support',
      ],
      color: 'bg-white',
      textColor: 'text-indigo-950',
      buttonColor: 'bg-indigo-900 text-white hover:bg-indigo-950 shadow-md shadow-indigo-900/10',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Advanced features, dedicated modeling capacity, and SLA compliance for large operations.',
      prices: {
        monthly: 24900,
        halfyearly: 125000,
        yearly: 225000,
      },
      usdEquiv: {
        monthly: '~$299 / mo',
        halfyearly: '~$250 / mo',
        yearly: '~$225 / mo',
      },
      features: [
        'Unlimited Data Ingestion & Storage',
        'Real-Time Predictive Forecast Engine',
        'Priority Dedicated Financial Analyst',
        'White-Label Executive Dashboards',
        'SSO & SOC2 Enterprise Compliance',
        '24/7 Phone & Slack SLA Guarantee',
      ],
      color: 'bg-slate-900',
      textColor: 'text-white',
      buttonColor: 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-500/20',
      recommended: true,
    },
  ];

  const handleSubscribe = async (planId: string) => {
    setLoading(planId);
    setError(null);

    try {
      const order = await apiFetch<{
        id: string;
        amount: number;
        currency: string;
        key?: string;
        simulated?: boolean;
        error?: string;
      }>('/api/razorpay/create-order', {
        method: 'POST',
        body: JSON.stringify({ planId, interval }),
      });

      if (order.error) {
        throw new Error(order.error);
      }

      // 1. Simulated Verification Flow (For Development & Testing when keys are unconfigured)
      if (order.simulated) {
        const verifyRes = await apiFetch<{ success: boolean; user: any }>('/api/razorpay/verify', {
          method: 'POST',
          body: JSON.stringify({
            razorpay_order_id: order.id,
            razorpay_payment_id: `pay_sim_${Date.now()}`,
            simulated: true,
            planId,
            interval,
          }),
        });

        if (verifyRes.success) {
          await refreshUser();
          setShowSuccessBanner(true);
          toast.success(`Upgraded to ${planId.toUpperCase()} plan via simulated test checkout!`);
        }
        return;
      }

      // 2. Real Razorpay Checkout Flow
      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
        throw new Error('Razorpay SDK failed to load. Please check internet connection.');
      }

      const options = {
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: 'TrackWise Analytics',
        description: `${planId.toUpperCase()} - ${interval} Plan`,
        image: 'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png',
        order_id: order.id,
        handler: async (response: any) => {
          try {
            const verifyRes = await apiFetch<{ success: boolean; user: any }>('/api/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId,
                interval,
                simulated: false,
              }),
            });

            if (verifyRes.success) {
              await refreshUser();
              setShowSuccessBanner(true);
              toast.success(`Payment verified! Upgraded to ${planId.toUpperCase()} plan.`);
            }
          } catch (vErr: any) {
            toast.error(vErr.message || 'Payment verification failed.');
          }
        },
        prefill: {
          name: user?.name || 'Alex Sterling',
          email: user?.email || 'alex@kinetic.com',
          contact: user?.phone || '9999999999',
        },
        theme: {
          color: '#161c54',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error('Subscription error:', err);
      setError(err.message || 'Payment initialization encountered an issue.');
      toast.error(err.message || 'Failed to initiate payment.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12 font-sans">
      {/* Confirmation Banner */}
      {showSuccessBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
              <Check size={18} />
            </div>
            <div>
              <p className="text-xs font-bold">Subscription Activated!</p>
              <p className="text-[11px] text-emerald-700">
                Your workspace is now upgraded to the {user?.planId?.toUpperCase()} tier with full telemetry features.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSuccessBanner(false)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-950 p-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Title & Description */}
      <div className="text-center space-y-3 pb-2 border-b border-slate-200/60">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
          <Sparkles size={14} className="text-indigo-600" />
          <span>Unified Enterprise Billing</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          Flexible Workspace Subscriptions
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto font-medium">
          Transparent, predictable enterprise tiers tailored to scale your data strategy without unexpected surge costs.
        </p>

        {/* Interval Selector Tabs */}
        <div className="flex items-center justify-center mt-6 p-1 bg-slate-100 rounded-xl w-fit mx-auto border border-slate-200/80">
          {(['monthly', 'halfyearly', 'yearly'] as Interval[]).map((int) => (
            <button
              key={int}
              onClick={() => setInterval(int)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                interval === int
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {int === 'halfyearly' ? 'Half-Yearly' : int}
              {int === 'yearly' && (
                <span className="ml-1.5 text-[9px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-full font-extrabold">
                  SAVE 20%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2 text-xs font-bold">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto pt-4">
        {plans.map((plan) => {
          const isCurrentPlan = user?.planId?.toLowerCase() === plan.id.toLowerCase();
          const price = plan.prices[interval];

          return (
            <div
              key={plan.id}
              className={`rounded-2xl p-6 sm:p-8 flex flex-col justify-between border relative overflow-hidden transition-all shadow-2xs ${
                plan.id === 'enterprise'
                  ? 'bg-slate-900 text-white border-slate-800 shadow-xl'
                  : 'bg-white text-slate-900 border-slate-200/80'
              }`}
            >
              {plan.recommended && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-xs">
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-widest ${
                      plan.id === 'enterprise' ? 'text-indigo-300' : 'text-slate-400'
                    }`}
                  >
                    {plan.name}
                  </span>
                  {isCurrentPlan && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider">
                      Current Active Plan
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="text-3xl sm:text-4xl font-extrabold">
                    ₹{price.toLocaleString()}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      plan.id === 'enterprise' ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    / {interval === 'monthly' ? 'month' : interval === 'halfyearly' ? '6 months' : 'year'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mb-6 font-medium">
                  {plan.usdEquiv[interval]} • Includes full API access
                </p>

                <p
                  className={`text-xs mb-6 font-medium leading-relaxed ${
                    plan.id === 'enterprise' ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {plan.description}
                </p>

                <div className="space-y-3 mb-8">
                  <p
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      plan.id === 'enterprise' ? 'text-slate-400' : 'text-slate-400'
                    }`}
                  >
                    Included Features
                  </p>
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs font-medium">
                      <CheckCircle2
                        size={15}
                        className={plan.id === 'enterprise' ? 'text-emerald-400 shrink-0' : 'text-emerald-600 shrink-0'}
                      />
                      <span className={plan.id === 'enterprise' ? 'text-slate-200' : 'text-slate-700'}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id || isCurrentPlan}
                  className={`w-full py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    isCurrentPlan
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                      : plan.buttonColor
                  }`}
                >
                  {loading === plan.id ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Opening Checkout...</span>
                    </>
                  ) : isCurrentPlan ? (
                    <span>Active Subscription</span>
                  ) : (
                    <span>Subscribe to {plan.name}</span>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-8 text-center text-xs text-slate-400 flex items-center justify-center gap-6">
        <span className="flex items-center gap-1.5">
          <ShieldCheck size={14} className="text-emerald-500" /> Razorpay 256-Bit Encrypted
        </span>
        <span className="flex items-center gap-1.5">
          <Zap size={14} className="text-amber-500" /> Instant Activation
        </span>
      </div>
    </div>
  );
}
