import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, Tag,
  Server, Copy, ExternalLink, DollarSign, Clock, Gamepad2, Bot as BotIcon
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { Plan, Product } from '../../types';

interface CheckoutProps {
  onNavigate: (page: string, params?: any) => void;
  params?: { planId?: string; billingCycle?: 'monthly' | 'yearly' };
}

type ProvisionStatus = 'pending' | 'creating_account' | 'creating_server' | 'completed' | 'awaiting_manual_setup' | 'failed';

interface ProvisionState {
  id: string;
  status: ProvisionStatus;
  message: string;
  planName?: string;
  productName?: string;
  panelUrl?: string;
  panelUsername?: string;
  panelPassword?: string;
  panelServerName?: string;
  errorMessage?: string;
}

const STEP_LABEL: Record<ProvisionStatus, string> = {
  pending: 'Verifying your order...',
  creating_account: 'Creating your hosting panel account...',
  creating_server: 'Provisioning your server...',
  completed: 'All done!',
  awaiting_manual_setup: 'Finishing up...',
  failed: 'Something went wrong'
};

export const Checkout: React.FC<CheckoutProps> = ({ onNavigate, params }) => {
  const { user, refreshUser } = useAuth();
  const { accentClasses } = useTheme();

  const planId = params?.planId;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>(params?.billingCycle === 'yearly' ? 'yearly' : 'monthly');
  const [loadingPlan, setLoadingPlan] = useState(true);

  const [couponCode, setCouponCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const [provision, setProvision] = useState<ProvisionState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!planId) { setLoadingPlan(false); return; }
      const [plansRes, productsRes] = await Promise.all([
        apiRequest('/public/plans'),
        apiRequest('/public/products')
      ]);
      const foundPlan = (plansRes.data || []).find((p: Plan) => p.id === planId) || null;
      setPlan(foundPlan);
      if (foundPlan) {
        const foundProduct = (productsRes.data || []).find((pr: Product) => pr.id === foundPlan.productId) || null;
        setProduct(foundProduct);
      }
      setLoadingPlan(false);
    };
    load();
  }, [planId]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const price = plan ? (billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly) : 0;
  const credits = user?.credits || 0;
  const canAfford = price <= credits;

  const startPolling = (provisionId: string) => {
    pollRef.current = setInterval(async () => {
      const res = await apiRequest(`/billing/provision/${provisionId}`);
      if (res.success && res.data) {
        setProvision(res.data);
        if (['completed', 'awaiting_manual_setup', 'failed'].includes(res.data.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }
    }, 1500);
  };

  const handleCheckout = async () => {
    if (!plan) return;
    setSubmitting(true);
    setCheckoutError(null);

    const res = await apiRequest('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: plan.id, billingCycle, couponCode: couponCode.trim() || undefined })
    });

    if (!res.success) {
      setCheckoutError(res.error?.message || 'Checkout failed. Please try again.');
      setSubmitting(false);
      return;
    }

    await refreshUser();
    const provisionId = res.data.provisionId;
    setProvision({ id: provisionId, status: 'pending', message: 'Verifying your order...' });
    startPolling(provisionId);
    setSubmitting(false);
  };

  const handleCopyPassword = () => {
    if (provision?.panelPassword) {
      navigator.clipboard.writeText(provision.panelPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // --- No plan selected / invalid plan ---
  if (!planId || (!loadingPlan && !plan)) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto text-center space-y-4 pt-16">
        <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
        <h1 className="text-xl font-bold text-white">No plan selected</h1>
        <p className="text-xs text-zinc-400">Head back to pricing and pick a plan to check out.</p>
        <button
          onClick={() => onNavigate('pricing')}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r ${accentClasses.gradient}`}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Pricing
        </button>
      </div>
    );
  }

  if (loadingPlan || !plan) {
    return (
      <div className="p-8 text-center text-xs text-zinc-400 space-y-2 pt-16">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400 mx-auto" />
        <p>Loading plan details...</p>
      </div>
    );
  }

  // --- Provisioning / loading screen (shown once checkout has been submitted) ---
  if (provision) {
    const isTerminal = ['completed', 'awaiting_manual_setup', 'failed'].includes(provision.status);
    const isFailed = provision.status === 'failed';
    const isManual = provision.status === 'awaiting_manual_setup';
    const hasCredentials = provision.status === 'completed' && provision.panelUsername;

    return (
      <div className="p-4 sm:p-6 max-w-xl mx-auto pt-10">
        <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-8 space-y-6 text-center">
          {!isTerminal && (
            <>
              <Loader2 className="h-10 w-10 text-violet-400 animate-spin mx-auto" />
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">{STEP_LABEL[provision.status] || 'Setting things up...'}</h2>
                <p className="text-xs text-zinc-400">This usually only takes a few seconds. Don't close this page.</p>
              </div>
              <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500 font-mono">
                {(['pending', 'creating_account', 'creating_server'] as ProvisionStatus[]).map((s, i) => (
                  <React.Fragment key={s}>
                    {i > 0 && <div className="w-6 h-px bg-zinc-700" />}
                    <div className={`h-2 w-2 rounded-full ${
                      provision.status === s ? 'bg-violet-400 animate-pulse' :
                      (['pending', 'creating_account', 'creating_server'].indexOf(provision.status) > i) ? 'bg-emerald-400' : 'bg-zinc-700'
                    }`} />
                  </React.Fragment>
                ))}
              </div>
            </>
          )}

          {provision.status === 'completed' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">You're all set!</h2>
                <p className="text-xs text-zinc-400">{provision.message}</p>
              </div>

              {hasCredentials && (
                <div className="text-left space-y-3 bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Server className="h-4 w-4 text-violet-400" /> Panel Login Details
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="flex justify-between items-center bg-zinc-900 rounded-xl px-3 py-2">
                      <span className="text-zinc-400">Username</span>
                      <span className="font-mono text-white">{provision.panelUsername}</span>
                    </div>
                    {provision.panelPassword && (
                      <div className="flex justify-between items-center bg-zinc-900 rounded-xl px-3 py-2">
                        <span className="text-zinc-400">Password</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-emerald-400">{provision.panelPassword}</span>
                          <button onClick={handleCopyPassword} className="text-zinc-400 hover:text-white">
                            {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    )}
                    {provision.panelServerName && (
                      <div className="flex justify-between items-center bg-zinc-900 rounded-xl px-3 py-2">
                        <span className="text-zinc-400">Server</span>
                        <span className="font-mono text-white">{provision.panelServerName}</span>
                      </div>
                    )}
                  </div>
                  {provision.panelPassword && (
                    <p className="text-[10px] text-amber-400">Save this password now — for your security it won't be shown again after you leave this page.</p>
                  )}
                  {provision.panelUrl && (
                    <a
                      href={provision.panelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r ${accentClasses.gradient}`}
                    >
                      Go to Panel <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              )}
            </>
          )}

          {isManual && (
            <>
              <Clock className="h-12 w-12 text-amber-400 mx-auto" />
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">Order confirmed</h2>
                <p className="text-xs text-zinc-400">{provision.message}</p>
              </div>
              {provision.panelUsername && (
                <div className="text-left space-y-2 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs">
                  <div className="flex justify-between items-center bg-zinc-900 rounded-xl px-3 py-2">
                    <span className="text-zinc-400">Panel Username</span>
                    <span className="font-mono text-white">{provision.panelUsername}</span>
                  </div>
                  {provision.panelPassword && (
                    <div className="flex justify-between items-center bg-zinc-900 rounded-xl px-3 py-2">
                      <span className="text-zinc-400">Panel Password</span>
                      <span className="font-mono text-emerald-400">{provision.panelPassword}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {isFailed && (
            <>
              <AlertTriangle className="h-12 w-12 text-rose-400 mx-auto" />
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-white">We hit a snag</h2>
                <p className="text-xs text-zinc-400">{provision.message}</p>
                <p className="text-[11px] text-zinc-500">Your payment was recorded — please contact support and we'll get this sorted out.</p>
              </div>
            </>
          )}

          <button
            onClick={() => onNavigate('dashboard')}
            className="w-full py-2.5 rounded-xl font-semibold text-xs text-zinc-300 bg-zinc-950 border border-zinc-800 hover:text-white hover:border-zinc-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // --- Review & confirm ---
  const cyclePrice = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6">
      <button onClick={() => onNavigate('pricing')} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Pricing
      </button>

      <div className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-6">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              {product?.category === 'bot' ? <BotIcon className="h-5 w-5 text-cyan-400" /> : <Gamepad2 className="h-5 w-5 text-violet-400" />}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{plan.name}</h1>
              <p className="text-[11px] text-zinc-400">{product?.name || 'Hosting Plan'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-zinc-950 rounded-xl p-1 border border-zinc-800 text-[11px]">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-lg font-semibold ${billingCycle === 'monthly' ? 'bg-violet-600 text-white' : 'text-zinc-400'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1.5 rounded-lg font-semibold ${billingCycle === 'yearly' ? 'bg-violet-600 text-white' : 'text-zinc-400'}`}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs text-zinc-300">
          <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">{plan.ramMB >= 1024 ? `${plan.ramMB / 1024}GB RAM` : `${plan.ramMB}MB RAM`}</div>
          <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">{plan.cpuCores} vCPU Core{plan.cpuCores > 1 ? 's' : ''}</div>
          <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">{plan.diskGB}GB NVMe Storage</div>
          <div className="bg-zinc-950 rounded-xl p-3 border border-zinc-800">{plan.backupLimit} Backup Slot{plan.backupLimit > 1 ? 's' : ''}</div>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 mb-2">
            <Tag className="h-3.5 w-3.5 text-violet-400" /> Promo Code (optional)
          </label>
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            placeholder="Enter a promo code..."
            className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white uppercase font-mono placeholder-zinc-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 p-4 space-y-2">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Plan price ({billingCycle})</span>
            <span className="font-mono text-white">${cyclePrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Your credit balance</span>
            <span className={`font-mono ${canAfford ? 'text-emerald-400' : 'text-rose-400'}`}>${credits.toFixed(2)}</span>
          </div>
          {!canAfford && cyclePrice > 0 && (
            <p className="text-[11px] text-rose-400 pt-1">
              You need ${(cyclePrice - credits).toFixed(2)} more in credits.{' '}
              <button onClick={() => onNavigate('billing')} className="underline hover:text-rose-300">Add credits</button>
            </p>
          )}
        </div>

        {checkoutError && (
          <p className="text-xs p-3 rounded-xl border font-semibold bg-rose-500/10 text-rose-400 border-rose-500/20">
            {checkoutError}
          </p>
        )}

        <button
          onClick={handleCheckout}
          disabled={submitting || (!canAfford && cyclePrice > 0)}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 disabled:opacity-50 bg-gradient-to-r ${accentClasses.gradient}`}
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
          ) : (
            <><ShieldCheck className="h-4 w-4" /> {cyclePrice > 0 ? `Confirm & Pay $${cyclePrice.toFixed(2)}` : 'Activate Free Plan'}</>
          )}
        </button>
      </div>
    </div>
  );
};
