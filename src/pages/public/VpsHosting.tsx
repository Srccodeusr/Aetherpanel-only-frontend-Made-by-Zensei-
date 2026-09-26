import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, ShieldCheck, Cpu, Zap, ArrowRight, Terminal } from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';
import { apiRequest } from '../../lib/api';
import { Plan } from '../../types';

interface VpsHostingProps {
  onNavigate: (page: string, params?: any) => void;
}

export const VpsHosting: React.FC<VpsHostingProps> = ({ onNavigate }) => {
  const { accentClasses } = useTheme();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const res = await apiRequest('/public/plans');
        if (res.success && Array.isArray(res.data)) {
          const vpsPlans = res.data.filter((p: Plan) => p.productId === 'prod_vps' || p.id.startsWith('plan_vps_'));
          setPlans(vpsPlans);
        }
      } catch (err) {
        console.error('Failed to load VPS plans:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPlans();
  }, []);

  return (
    <div className="space-y-16 py-8">
      {/* Hero */}
      <div className="text-center max-w-3xl mx-auto space-y-4 px-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400">
          <Server className="h-4 w-4" />
          <span>High-Performance VPS Hosting</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
          Full Root Access, Zero Compromise
        </h1>
        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed">
          Powered by high-clock compute hardware and Gen4 NVMe SSDs. Deploy sites, apps, bots, and services with full root access and low-latency networking.
        </p>

        {/* Toggle Billing */}
        <div className="pt-6 flex items-center justify-center gap-3">
          <span className={`text-xs font-medium ${billingCycle === 'monthly' ? 'text-white font-bold' : 'text-zinc-500'}`}>Monthly Billing</span>
          <button
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
            className="w-12 h-6 rounded-full bg-zinc-800 p-1 flex items-center transition-colors relative"
          >
            <div className={`h-4 w-4 rounded-full bg-amber-500 transition-transform ${billingCycle === 'yearly' ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          <span className={`text-xs font-medium flex items-center gap-1 ${billingCycle === 'yearly' ? 'text-white font-bold' : 'text-zinc-500'}`}>
            Yearly Billing
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              Save 17%
            </span>
          </span>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((p) => {
              const price = billingCycle === 'yearly' ? (p.priceYearly / 12).toFixed(2) : p.priceMonthly.toFixed(2);
              return (
                <div
                  key={p.id}
                  className={`rounded-3xl p-6 bg-zinc-900/80 border flex flex-col justify-between relative transition-all ${
                    p.isPopular ? 'border-amber-500 shadow-xl shadow-amber-500/10 bg-zinc-900' : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {p.isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold bg-amber-600 text-white uppercase tracking-wider shadow-md">
                      Most Popular
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{p.name}</h3>
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-white">${price}</span>
                        <span className="text-xs text-zinc-400">/mo</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
                      <div className="text-amber-400 font-semibold">{p.ramMB >= 1024 ? `${p.ramMB / 1024}GB RAM` : `${p.ramMB}MB RAM`}</div>
                      <div className="text-zinc-300">{p.cpuCores} vCPU Core{p.cpuCores > 1 ? 's' : ''}</div>
                      <div className="text-zinc-400">{p.diskGB}GB NVMe Storage</div>
                    </div>

                    <ul className="space-y-2 text-xs text-zinc-300 pt-2 border-t border-zinc-800">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>{p.backupLimit} Backup Slot{p.backupLimit > 1 ? 's' : ''}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>{p.databaseLimit} Database Instance{p.databaseLimit > 1 ? 's' : ''}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>Full Root Access</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>Free Subdomain & Port</span>
                      </li>
                      {p.features && p.features.slice(0, 2).map((f, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => onNavigate('register', { planId: p.id, productCategory: 'vps' })}
                    className={`w-full mt-6 py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-2 ${
                      p.isPopular
                        ? `bg-gradient-to-r ${accentClasses.gradient} text-white shadow-md hover:opacity-95`
                        : 'bg-zinc-800 text-white hover:bg-zinc-700'
                    }`}
                  >
                    <span>Get {p.name}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feature strip */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
            <Cpu className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">High-Clock Compute</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">Dedicated vCPU cores on high-clock hardware for consistent, predictable performance.</p>
          </div>
          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">DDoS Protected</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">Always-on network-level mitigation keeps your VPS online under attack traffic.</p>
          </div>
          <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-2">
            <Terminal className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Full Root Access</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">Install anything you need. Complete control over your environment, no restrictions.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
