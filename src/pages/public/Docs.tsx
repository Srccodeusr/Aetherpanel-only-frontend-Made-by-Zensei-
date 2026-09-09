import React, { useState } from 'react';
import {
  BookOpen, Terminal, Code, Shield, HelpCircle,
  ChevronRight, Lock, Globe,
  Zap, CreditCard, LifeBuoy, AlertCircle, KeyRound
} from 'lucide-react';
import { useBranding } from '../../lib/BrandingContext';

type DocSection = 'getting-started' | 'billing' | 'account-security' | 'support' | 'api' | 'status';

export const Docs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DocSection>('getting-started');
  const { socialLinks, discordUrl, brandName } = useBranding();
  const currentDiscord = socialLinks?.discord || discordUrl || 'https://discord.gg';

  const categories = [
    { id: 'getting-started', name: 'Getting Started', icon: Zap },
    { id: 'billing', name: 'Billing & Payments', icon: CreditCard },
    { id: 'account-security', name: 'Account Security', icon: Shield },
    { id: 'support', name: 'Support Tickets', icon: LifeBuoy },
    { id: 'api', name: 'REST API', icon: Terminal },
    { id: 'status', name: 'System Status', icon: Globe },
  ];

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
          <div className="sticky top-8 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-violet-600 rounded-lg">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Documentation</h1>
              </div>
              <p className="text-xs text-zinc-500 mb-8 px-1 leading-relaxed">
                Guides and references for using your {brandName || 'account'}.
              </p>
            </div>

            <nav className="space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id as DocSection)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === cat.id
                      ? 'bg-violet-600/10 text-violet-400 border border-violet-600/20 shadow-[0_0_20px_-5px_rgba(139,92,246,0.1)]'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
                  }`}
                >
                  <cat.icon className={`h-4 w-4 ${activeTab === cat.id ? 'text-violet-400' : 'text-zinc-500'}`} />
                  {cat.name}
                </button>
              ))}
            </nav>

            <div className="pt-8 border-t border-zinc-800/50">
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Need Help?</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                  Our community Discord and support desk are available for questions.
                </p>
                <button
                  onClick={() => window.open(currentDiscord, '_blank')}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Join Discord
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 max-w-3xl">
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-8 sm:p-10 backdrop-blur-sm">
            {activeTab === 'getting-started' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white">Welcome</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    This guide covers creating an account, choosing a plan, and managing billing. It only takes a few minutes to get set up.
                  </p>
                </div>

                <div className="grid gap-6">
                  {[
                    { title: 'Create Account', desc: 'Register with your email and verify your details.' },
                    { title: 'Browse Plans', desc: 'Compare Minecraft and Discord Bot hosting tiers on the Pricing page.' },
                    { title: 'Add Credits', desc: 'Top up your account balance using your preferred payment method.' },
                    { title: 'Track Orders', desc: 'View order status and history any time from your Dashboard.' }
                  ].map((step, i) => (
                    <div key={i} className="flex gap-5 group">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors border border-zinc-700">
                        {i + 1}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white">{step.title}</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex gap-4">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-200/70 leading-relaxed italic">
                    <strong className="text-amber-500 not-italic uppercase font-bold tracking-wider mr-2">Note:</strong>
                    Manual payment methods (bank transfer, UPI, crypto) are reviewed by our team and typically approved within a few hours.
                  </p>
                </div>
              </section>
            )}

            {activeTab === 'billing' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Billing & Payments</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Manage your account balance, view past orders, and redeem promotional coupons from the Billing page.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-violet-400" />
                    Adding Credits
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Choose a payment method on the Billing page and follow the on-screen instructions. Instant methods credit your account immediately; manual transfers (bank, UPI, crypto) require a reference number and are reviewed by our team.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800/50">
                  <h3 className="text-sm font-bold text-white mb-4">Order Statuses</h3>
                  <ul className="space-y-3 text-xs text-zinc-400 leading-relaxed">
                    <li className="flex gap-3"><span className="text-emerald-400 font-bold">Paid</span><span>Payment confirmed and credits applied to your account.</span></li>
                    <li className="flex gap-3"><span className="text-amber-400 font-bold">Pending</span><span>Manual payment submitted and awaiting admin review.</span></li>
                    <li className="flex gap-3"><span className="text-rose-400 font-bold">Failed</span><span>Payment was rejected or could not be verified.</span></li>
                  </ul>
                </div>
              </section>
            )}

            {activeTab === 'account-security' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Account Security</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Keep your account secure with a strong password, an optional Discord link, and awareness of your recent activity.
                  </p>
                </div>

                <div className="space-y-6">
                  {[
                    { title: 'Strong Passwords', icon: Lock, desc: 'Use a unique password for your account and change it periodically from Account Settings.' },
                    { title: 'Discord Linking', icon: KeyRound, desc: 'Link your Discord account for faster sign-in and notification delivery.' },
                    { title: 'Activity Log', icon: Terminal, desc: 'Review recent account actions from the Activity Log page to spot anything unexpected.' }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-6 p-6 rounded-2xl bg-zinc-800/20 border border-zinc-800/50">
                      <div className="p-3 bg-zinc-800 rounded-xl flex-shrink-0 h-fit">
                        <item.icon className="h-5 w-5 text-violet-400" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white">{item.title}</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'support' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Support Tickets</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Reach our team directly through the Support page for billing questions, account issues, or general inquiries.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800/50">
                  <h3 className="text-sm font-bold text-white mb-4">Opening a Ticket</h3>
                  <ol className="space-y-4 text-xs text-zinc-400 leading-relaxed">
                    <li className="flex gap-3">
                      <span className="text-violet-400 font-bold">1.</span>
                      <span>Go to the Support page and choose a category and priority.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-violet-400 font-bold">2.</span>
                      <span>Describe your issue with as much detail as possible.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-violet-400 font-bold">3.</span>
                      <span>Track replies and respond directly from the same ticket thread.</span>
                    </li>
                  </ol>
                </div>
              </section>
            )}

            {activeTab === 'api' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">REST API Reference</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Administrators can generate scoped API keys to automate account, billing, and support workflows.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Lock className="h-4 w-4 text-violet-400" />
                    Authentication
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Include your API key in the `Authorization` header for all requests.
                  </p>
                  <div className="p-4 rounded-xl bg-zinc-950 font-mono text-[11px] text-zinc-400 border border-zinc-800/50">
                    <code>Authorization: Bearer aep_live_xxxxxxxxxxxx</code>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Code className="h-4 w-4 text-violet-400" />
                    Example: List Your Orders
                  </h3>
                  <div className="p-4 rounded-xl bg-zinc-950 font-mono text-[11px] text-zinc-400 border border-zinc-800/50">
                    <code>GET /api/v1/billing/orders</code>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Code className="h-4 w-4 text-violet-400" />
                    Example: Platform Stats (Admin)
                  </h3>
                  <div className="p-4 rounded-xl bg-zinc-950 font-mono text-[11px] text-zinc-400 border border-zinc-800/50">
                    <code>GET /api/v1/admin/stats</code>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'status' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">System Status</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Real-time uptime and incident history for the website, API, payments, and support systems are published on our public Status page.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">What We Monitor</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-xs text-zinc-400">
                      <ChevronRight className="h-4 w-4 text-violet-400 flex-shrink-0" />
                      <span><strong>Core Platform:</strong> Website, API, and database availability.</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-zinc-400">
                      <ChevronRight className="h-4 w-4 text-violet-400 flex-shrink-0" />
                      <span><strong>External Integrations:</strong> Payment processing and Discord notification delivery.</span>
                    </li>
                  </ul>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
