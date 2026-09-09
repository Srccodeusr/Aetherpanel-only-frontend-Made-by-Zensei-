import React, { useState, useEffect } from 'react';
import {
  Sliders, Save, Check, QrCode, CreditCard, Building, CheckCircle2,
  XCircle, Clock, AlertCircle, RefreshCw,
  ShieldCheck, Sparkles, Loader2, CheckCircle,
  AlertTriangle, HelpCircle, Key, Lock, Shield, Globe, Copy,
  Plus, Trash2, Edit3, X, Disc as DiscordIcon, Twitter, Github, Share2
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useBranding } from '../../lib/BrandingContext';
import { Order, PaymentGatewaySettings, AuthProviderSettings, SocialLinks } from '../../types';

export const AdminSettings: React.FC = () => {
  const {
    refreshBranding,
    updateBrandNameLocally,
    setPageAnimationsEnabledLocally,
    setSocialLinksLocally,
    setHomepageDescriptionsLocally
  } = useBranding();
  const [activeTab, setActiveTab] = useState<'general' | 'auth' | 'security' | 'payments' | 'pending'>('general');

  const DEFAULT_HERO_DESCRIPTION = 'High-performance Minecraft servers and 24/7 Discord bot hosting, backed by real support. Powered by AMD Ryzen 9 7950X compute hardware and enterprise NVMe storage.';
  const DEFAULT_FOOTER_DESCRIPTION = 'Premium Minecraft & Discord Bot hosting plans built on high-clock AMD Ryzen 9 hardware and NVMe enterprise storage.';

  const [brandName, setBrandName] = useState('AetherPanel');
  const [brandTagline, setBrandTagline] = useState('Premium Minecraft & Discord Bot Hosting');
  const [supportEmail, setSupportEmail] = useState('support@aetherpanel.com');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [pageAnimationsEnabled, setPageAnimationsEnabled] = useState(true);

  // Homepage Content Settings
  const [heroDescription, setHeroDescription] = useState(DEFAULT_HERO_DESCRIPTION);
  const [footerDescription, setFooterDescription] = useState(DEFAULT_FOOTER_DESCRIPTION);
  const [savingHomepageContent, setSavingHomepageContent] = useState(false);
  const [homepageContentSuccess, setHomepageContentSuccess] = useState<string | null>(null);
  const [homepageContentError, setHomepageContentError] = useState<string | null>(null);

  // Social Links Settings
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({
    discord: 'https://discord.gg/aetherpanel',
    twitter: 'https://twitter.com/aetherpanel',
    github: 'https://github.com/aetherpanel'
  });
  const [savingSocialLinks, setSavingSocialLinks] = useState(false);
  const [socialLinksSuccess, setSocialLinksSuccess] = useState<string | null>(null);
  const [socialLinksError, setSocialLinksError] = useState<string | null>(null);

  // Auth Provider Settings
  const [authProviders, setAuthProviders] = useState<AuthProviderSettings>({
    emailPassword: { enabled: true },
    google: {
      enabled: true,
      firebaseApiKey: '',
      firebaseAuthDomain: '',
      firebaseProjectId: '',
      firebaseStorageBucket: '',
      firebaseMessagingSenderId: '',
      firebaseAppId: ''
    },
    discord: {
      enabled: true,
      clientId: '',
      clientSecret: '',
      redirectUri: ''
    }
  });

  // Auth Test States
  const [testingGoogle, setTestingGoogle] = useState(false);
  const [googleTestResult, setGoogleTestResult] = useState<any>(null);
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [discordTestResult, setDiscordTestResult] = useState<any>(null);
  const [copiedDiscordUri, setCopiedDiscordUri] = useState(false);

  // Anti-Abuse & VPN Protection Settings
  const [antiAbuse, setAntiAbuse] = useState({
    enabled: false,
    provider: 'proxycheck' as 'proxycheck' | 'ipqualityscore' | 'custom',
    apiKey: '',
    blockVpn: true,
    blockProxy: true,
    blockTor: true,
    blockDatacenter: false,
    maxRiskScore: 65,
    maxRegistrationsPerIpPerDay: 2,
    loginLockoutMaxAttempts: 5,
    loginLockoutDurationSec: 300
  });
  const [testingAntiAbuse, setTestingAntiAbuse] = useState(false);
  const [antiAbuseTestResult, setAntiAbuseTestResult] = useState<any>(null);

  // System Version & Updates

  // Payment Gateway Settings
  const [gateways, setGateways] = useState<PaymentGatewaySettings>({
    upi: {
      enabled: true,
      upiId: 'aetherpay@upi',
      merchantName: 'AetherPanel Hosting',
      qrCodeUrl: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=400&q=80',
      instructions: 'Scan the QR code or send payment to the UPI ID. Enter the 12-digit UTR or Transaction Ref ID after payment.'
    },
    bank: {
      enabled: true,
      bankName: 'HDFC Bank / Global Web Bank',
      accountNumber: '918237192837',
      ifsc: 'HDFC0001234',
      accountHolder: 'Aether Cloud Infrastructure LLC',
      instructions: 'Transfer to Bank Account and submit your NEFT/IMPS/Wire Reference Number.'
    },
    crypto: {
      enabled: false,
      walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      network: 'USDT (TRC20 / ERC20)',
      instructions: 'Send USDT to the wallet address and submit TX Hash.'
    },
    stripe: {
      enabled: true,
      instructions: 'Instant automatic payment via Credit/Debit Card or Wallet.'
    }
  });

  // Pending Orders
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [saved, setSaved] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    const res = await apiRequest('/admin/settings');
    if (res.success && res.data) {
      setBrandName(res.data.brandName || 'AetherPanel');
      setBrandTagline(res.data.brandTagline || '');
      setSupportEmail(res.data.supportEmail || 'support@aetherpanel.com');
      setCurrencySymbol(res.data.currencySymbol || '$');
      setRegistrationEnabled(res.data.registrationEnabled ?? true);
      setMaintenanceMode(res.data.maintenanceMode ?? false);
      setPageAnimationsEnabled(res.data.pageAnimationsEnabled ?? true);
      if (res.data.heroDescription) {
        setHeroDescription(res.data.heroDescription);
      }
      if (res.data.footerDescription) {
        setFooterDescription(res.data.footerDescription);
      }
      if (res.data.socialLinks) {
        setSocialLinks({
          discord: res.data.socialLinks.discord ?? '',
          twitter: res.data.socialLinks.twitter ?? '',
          github: res.data.socialLinks.github ?? ''
        });
      }
      if (res.data.paymentGateways) {
        setGateways(res.data.paymentGateways);
      }
    }
  };

  const fetchAuthProviders = async () => {
    const res = await apiRequest('/admin/auth-providers');
    if (res.success && res.data) {
      setAuthProviders(res.data);
    }
  };

  const fetchAntiAbuse = async () => {
    const res = await apiRequest('/admin/anti-abuse');
    if (res.success && res.data) {
      setAntiAbuse(res.data);
    }
  };

  const handleTestGoogle = async () => {
    setTestingGoogle(true);
    setGoogleTestResult(null);
    const res = await apiRequest('/admin/auth-providers/test-google', { method: 'POST' });
    setTestingGoogle(false);
    if (res.success && res.data) {
      setGoogleTestResult(res.data);
    } else {
      setGoogleTestResult({ status: 'ERROR', message: res.error?.message || 'Failed to test Google config' });
    }
  };

  const handleTestDiscord = async () => {
    setTestingDiscord(true);
    setDiscordTestResult(null);
    const res = await apiRequest('/admin/auth-providers/test-discord', { method: 'POST' });
    setTestingDiscord(false);
    if (res.success && res.data) {
      setDiscordTestResult(res.data);
    } else {
      setDiscordTestResult({ status: 'ERROR', message: res.error?.message || 'Failed to test Discord config' });
    }
  };

  const handleTestAntiAbuse = async () => {
    setTestingAntiAbuse(true);
    setAntiAbuseTestResult(null);
    const res = await apiRequest('/admin/anti-abuse/test', { method: 'POST' });
    setTestingAntiAbuse(false);
    if (res.success && res.data) {
      setAntiAbuseTestResult(res.data);
    } else {
      setAntiAbuseTestResult({ status: 'ERROR', message: res.error?.message || 'Failed to test Anti-Abuse' });
    }
  };

  const handleSaveAntiAbuse = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/admin/anti-abuse', {
      method: 'PUT',
      body: JSON.stringify(antiAbuse)
    });
    if (res.success) {
      setSaved(true);
      if (res.data) setAntiAbuse(res.data);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setActionMsg(res.error?.message || 'Failed to save Anti-Abuse settings.');
    }
  };

  const fetchPendingOrders = async () => {
    setLoadingOrders(true);
    const res = await apiRequest('/admin/orders?status=pending');
    if (res.success && res.data) {
      setPendingOrders(res.data);
    }
    setLoadingOrders(false);
  };

  const handleSaveHomepageContent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingHomepageContent(true);
    setHomepageContentSuccess(null);
    setHomepageContentError(null);

    try {
      const res = await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          heroDescription,
          footerDescription
        })
      });

      if (res.success) {
        setHomepageContentSuccess('Homepage & Footer descriptions updated successfully.');
        setHomepageDescriptionsLocally(heroDescription, footerDescription);
        await refreshBranding();
        setTimeout(() => setHomepageContentSuccess(null), 4000);
      } else {
        setHomepageContentError(res.error?.message || 'Failed to update descriptions.');
      }
    } catch (err: any) {
      setHomepageContentError(err?.message || 'An error occurred while saving descriptions.');
    } finally {
      setSavingHomepageContent(false);
    }
  };

  const handleResetHomepageContent = async () => {
    if (!window.confirm('Are you sure you want to reset the Hero and Footer descriptions to default text?')) return;
    setSavingHomepageContent(true);
    setHomepageContentSuccess(null);
    setHomepageContentError(null);

    const defaultHero = DEFAULT_HERO_DESCRIPTION;
    const defaultFooter = DEFAULT_FOOTER_DESCRIPTION;

    setHeroDescription(defaultHero);
    setFooterDescription(defaultFooter);

    try {
      const res = await apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          heroDescription: defaultHero,
          footerDescription: defaultFooter
        })
      });

      if (res.success) {
        setHomepageContentSuccess('Homepage & Footer descriptions reset to default successfully.');
        setHomepageDescriptionsLocally(defaultHero, defaultFooter);
        await refreshBranding();
        setTimeout(() => setHomepageContentSuccess(null), 4000);
      } else {
        setHomepageContentError(res.error?.message || 'Failed to reset descriptions.');
      }
    } catch (err: any) {
      setHomepageContentError(err?.message || 'An error occurred while resetting descriptions.');
    } finally {
      setSavingHomepageContent(false);
    }
  };

  const handleSaveSocialLinks = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSavingSocialLinks(true);
    setSocialLinksSuccess(null);
    setSocialLinksError(null);

    try {
      const res = await apiRequest('/admin/settings/social-links', {
        method: 'PUT',
        body: JSON.stringify(socialLinks)
      });

      if (res.success) {
        setSocialLinksSuccess(res.message || 'Social links updated successfully.');
        setSocialLinksLocally(socialLinks);
        await refreshBranding();
        setTimeout(() => setSocialLinksSuccess(null), 4000);
      } else {
        setSocialLinksError(res.error?.message || 'Failed to update social links.');
      }
    } catch (err: any) {
      setSocialLinksError(err?.message || 'An error occurred while saving social links.');
    } finally {
      setSavingSocialLinks(false);
    }
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        brandName,
        brandTagline,
        supportEmail,
        currencySymbol,
        registrationEnabled,
        maintenanceMode,
        pageAnimationsEnabled,
        socialLinks,
        heroDescription,
        footerDescription
      })
    });
    if (res.success) {
      updateBrandNameLocally(brandName);
      setPageAnimationsEnabledLocally(pageAnimationsEnabled);
      setSocialLinksLocally(socialLinks);
      setHomepageDescriptionsLocally(heroDescription, footerDescription);
      await refreshBranding();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setActionMsg(res.error?.message || 'Failed to save settings');
    }
  };

  const handleSaveAuthProviders = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/admin/auth-providers', {
      method: 'PUT',
      body: JSON.stringify(authProviders)
    });
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setActionMsg(res.error?.message || 'Failed to save authentication settings.');
    }
  };

  const handleSavePayments = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/admin/payment-settings', {
      method: 'PUT',
      body: JSON.stringify(gateways)
    });
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    const res = await apiRequest(`/admin/orders/${orderId}/approve`, { method: 'POST' });
    if (res.success) {
      setActionMsg(res.message || 'Payment approved!');
      fetchPendingOrders();
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt('Reason for rejecting payment:');
    if (reason === null) return;

    const res = await apiRequest(`/admin/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    if (res.success) {
      setActionMsg(res.message || 'Payment rejected.');
      fetchPendingOrders();
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="border-b border-amber-500/20 pb-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sliders className="h-6 w-6 text-amber-400" /> Platform Configuration
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Manage global site settings, authentication methods, payment gateways, and pending orders.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap bg-zinc-900 border border-zinc-800 p-1 rounded-2xl gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-3.5 py-2 rounded-xl transition-all ${activeTab === 'general' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            General
          </button>
          <button
            onClick={() => { setActiveTab('auth'); fetchAuthProviders(); }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'auth' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <Shield className="h-3.5 w-3.5" /> Auth Providers
          </button>
          <button
            onClick={() => { setActiveTab('security'); fetchAntiAbuse(); }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'security' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <Lock className="h-3.5 w-3.5" /> Anti-Abuse & Security
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'payments' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <QrCode className="h-3.5 w-3.5" /> Payments & QR
          </button>
          <button
            onClick={() => { setActiveTab('pending'); fetchPendingOrders(); }}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 relative ${activeTab === 'pending' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <Clock className="h-3.5 w-3.5 text-amber-400" /> Pending Approvals
            {pendingOrders.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500 text-white font-bold">
                {pendingOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center gap-2">
          <Check className="h-4 w-4" /> Configuration saved successfully!
        </div>
      )}

      {actionMsg && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {actionMsg}
        </div>
      )}

      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-5">
          <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-3">Branding & System Toggles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Brand Name</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Support Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tagline</label>
            <input
              type="text"
              value={brandTagline}
              onChange={(e) => setBrandTagline(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
            <div>
              <div className="text-xs font-bold text-white">Public User Registration</div>
              <div className="text-[11px] text-zinc-400">Allow new customers to create accounts.</div>
            </div>
            <input
              type="checkbox"
              checked={registrationEnabled}
              onChange={(e) => setRegistrationEnabled(e.target.checked)}
              className="h-4 w-4 accent-amber-500 rounded"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
            <div>
              <div className="text-xs font-bold text-white">Platform Maintenance Mode</div>
              <div className="text-[11px] text-zinc-400">Display maintenance banner to non-admin users.</div>
            </div>
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              className="h-4 w-4 accent-rose-500 rounded"
            />
          </div>


          {/* Appearance & Experience — Page Animations */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h3 className="text-xs font-bold text-white">Appearance & Experience</h3>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    pageAnimationsEnabled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${pageAnimationsEnabled ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                    {pageAnimationsEnabled ? 'On' : 'Off'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-zinc-200">Enable Page Animations</div>
                <p className="text-[11px] text-zinc-400">
                  Control premium entrance animations for the Homepage, Login, and Signup pages.
                </p>
                <p className="text-[11px] text-zinc-500">
                  {pageAnimationsEnabled
                    ? 'Animations will run on initial public and auth page entrance.'
                    : 'Entrance animations are disabled globally for a faster feel.'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={pageAnimationsEnabled}
                  onChange={(e) => setPageAnimationsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* SOCIAL LINKS */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Share2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Social Links</h3>
                  <p className="text-[11px] text-zinc-400">Configure global Discord, X / Twitter, and GitHub profile links across the panel.</p>
                </div>
              </div>
            </div>

            {socialLinksSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" /> {socialLinksSuccess}
              </div>
            )}

            {socialLinksError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {socialLinksError}
              </div>
            )}

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <DiscordIcon className="w-3.5 h-3.5 text-amber-400" /> Discord URL
                </label>
                <input
                  type="url"
                  value={socialLinks.discord}
                  onChange={(e) => setSocialLinks(prev => ({ ...prev, discord: e.target.value }))}
                  placeholder="https://discord.gg/example"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Twitter className="w-3.5 h-3.5 text-amber-400" /> X / Twitter URL
                </label>
                <input
                  type="url"
                  value={socialLinks.twitter}
                  onChange={(e) => setSocialLinks(prev => ({ ...prev, twitter: e.target.value }))}
                  placeholder="https://x.com/example"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Github className="w-3.5 h-3.5 text-amber-400" /> GitHub URL
                </label>
                <input
                  type="url"
                  value={socialLinks.github}
                  onChange={(e) => setSocialLinks(prev => ({ ...prev, github: e.target.value }))}
                  placeholder="https://github.com/example"
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <p className="text-[11px] text-zinc-500">
                Leaving a link empty will automatically hide that icon in the public footer and navigation.
              </p>
              <button
                type="button"
                onClick={() => handleSaveSocialLinks()}
                disabled={savingSocialLinks}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors shrink-0"
              >
                {savingSocialLinks ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Social Links
              </button>
            </div>
          </div>

          {/* HOMEPAGE & FOOTER CONTENT */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Edit3 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Homepage & Footer Content</h3>
                  <p className="text-[11px] text-zinc-400">Configure descriptions displayed on the public homepage hero section and global footer.</p>
                </div>
              </div>
            </div>

            {homepageContentSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center gap-2">
                <Check className="h-4 w-4 shrink-0" /> {homepageContentSuccess}
              </div>
            )}

            {homepageContentError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-rose-400 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" /> {homepageContentError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>Homepage Hero Description</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Public Hero Section</span>
                </label>
                <textarea
                  rows={3}
                  value={heroDescription}
                  onChange={(e) => setHeroDescription(e.target.value)}
                  placeholder="Enter homepage hero description..."
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-sans leading-relaxed resize-y"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Used for the description text displayed below the primary headline on the public homepage.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>Footer Description</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Global Footer Branding</span>
                </label>
                <textarea
                  rows={2}
                  value={footerDescription}
                  onChange={(e) => setFooterDescription(e.target.value)}
                  placeholder="Enter footer description..."
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-sans leading-relaxed resize-y"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Used for the description displayed beside or below the platform logo in the global public footer.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={handleResetHomepageContent}
                disabled={savingHomepageContent}
                className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reset to Default
              </button>
              <button
                type="button"
                onClick={() => handleSaveHomepageContent()}
                disabled={savingHomepageContent}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors shrink-0"
              >
                {savingHomepageContent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save Homepage Content
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB: Authentication Providers */}
      {activeTab === 'auth' && (
        <form onSubmit={handleSaveAuthProviders} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">Authentication Providers & Social Logins</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Toggle sign-in methods and configure Firebase & Discord OAuth credentials.</p>
            </div>
          </div>

          {/* Email / Password Provider */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Email & Password Authentication</div>
                  <div className="text-[11px] text-zinc-400">Allow users to register and sign in with standard email credentials.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={authProviders.emailPassword?.enabled ?? true}
                  onChange={(e) => setAuthProviders(prev => ({
                    ...prev,
                    emailPassword: { enabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* Google Firebase Authentication */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Google Login (Firebase Authentication)</div>
                  <div className="text-[11px] text-zinc-400">One-click Google Sign-in and account creation powered by Firebase Auth.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={authProviders.google?.enabled ?? true}
                  onChange={(e) => setAuthProviders(prev => ({
                    ...prev,
                    google: { ...prev.google, enabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {authProviders.google?.enabled && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Firebase API Key</label>
                    <input
                      type="text"
                      value={authProviders.google?.firebaseApiKey || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        google: {
                          ...prev.google,
                          firebaseApiKey: e.target.value
                        }
                      }))}
                      placeholder="AIzaSy..."
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Firebase Auth Domain</label>
                    <input
                      type="text"
                      value={authProviders.google?.firebaseAuthDomain || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        google: {
                          ...prev.google,
                          firebaseAuthDomain: e.target.value
                        }
                      }))}
                      placeholder="project-id.firebaseapp.com"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Firebase Project ID</label>
                    <input
                      type="text"
                      value={authProviders.google?.firebaseProjectId || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        google: {
                          ...prev.google,
                          firebaseProjectId: e.target.value
                        }
                      }))}
                      placeholder="my-aetherpanel-app"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Firebase App ID</label>
                    <input
                      type="text"
                      value={authProviders.google?.firebaseAppId || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        google: {
                          ...prev.google,
                          firebaseAppId: e.target.value
                        }
                      }))}
                      placeholder="1:123456789:web:abcdef"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={testingGoogle}
                    onClick={handleTestGoogle}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingGoogle ? 'animate-spin text-amber-400' : ''}`} />
                    <span>{testingGoogle ? 'Verifying...' : 'Test Google Auth Configuration'}</span>
                  </button>

                  {googleTestResult && (
                    <div className={`text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 border font-mono ${
                      googleTestResult.status === 'CONFIGURED' || googleTestResult.status === 'PASS'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : googleTestResult.status === 'NOT_CONFIGURED'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {googleTestResult.status === 'CONFIGURED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>[{googleTestResult.status}] {googleTestResult.message || (googleTestResult.missingFields ? `Missing: ${googleTestResult.missingFields.join(', ')}` : '')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Discord OAuth2 */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#5865F2]/10 text-[#5865F2] border border-[#5865F2]/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Discord OAuth2 Login</div>
                  <div className="text-[11px] text-zinc-400">Allow users to log in directly with their Discord accounts.</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={authProviders.discord?.enabled ?? true}
                  onChange={(e) => setAuthProviders(prev => ({
                    ...prev,
                    discord: { ...prev.discord, enabled: e.target.checked }
                  }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {authProviders.discord?.enabled && (
              <div className="pt-2 border-t border-zinc-800/80 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Discord Client ID (Application ID)</label>
                    <input
                      type="text"
                      value={authProviders.discord?.clientId || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        discord: { ...prev.discord, clientId: e.target.value }
                      }))}
                      placeholder="123456789012345678"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 font-medium mb-1">Discord Client Secret</label>
                    <input
                      type="password"
                      value={authProviders.discord?.clientSecret || ''}
                      onChange={(e) => setAuthProviders(prev => ({
                        ...prev,
                        discord: { ...prev.discord, clientSecret: e.target.value }
                      }))}
                      placeholder="••••••••••••••••"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400 p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <strong className="text-zinc-200">Discord OAuth2 Redirect URI (Current Installation):</strong>
                    <button
                      type="button"
                      onClick={() => {
                        const uriToCopy = authProviders.discord?.redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}/api/v1/auth/discord/callback` : '');
                        if (uriToCopy) {
                          navigator.clipboard.writeText(uriToCopy);
                          setCopiedDiscordUri(true);
                          setTimeout(() => setCopiedDiscordUri(false), 2000);
                        }
                      }}
                      className="text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
                    >
                      {copiedDiscordUri ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedDiscordUri ? 'Copied' : 'Copy URI'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800/80">
                    <code className="text-amber-400 font-mono text-xs break-all">
                      {authProviders.discord?.redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}/api/v1/auth/discord/callback` : '/api/v1/auth/discord/callback')}
                    </code>
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Add this exact dynamic URI to your application inside Discord Developer Portal → OAuth2 → Redirects.
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={testingDiscord}
                    onClick={handleTestDiscord}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${testingDiscord ? 'animate-spin text-[#5865F2]' : ''}`} />
                    <span>{testingDiscord ? 'Verifying...' : 'Test Discord OAuth Configuration'}</span>
                  </button>

                  {discordTestResult && (
                    <div className={`text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 border font-mono ${
                      discordTestResult.status === 'CONFIGURED' || discordTestResult.status === 'PASS'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : discordTestResult.status === 'NOT_CONFIGURED'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    }`}>
                      {discordTestResult.status === 'CONFIGURED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>[{discordTestResult.status}] {discordTestResult.message || (discordTestResult.missingFields ? `Missing: ${discordTestResult.missingFields.join(', ')}` : '')}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Auth Provider Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB: Security & Anti-Abuse */}
      {activeTab === 'security' && (
        <form onSubmit={handleSaveAntiAbuse} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" /> Anti-Abuse, VPN/Proxy Detection & Account Security
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">Automated registration protection against VPNs, Proxies, Tor nodes, and brute-force credential stuffing.</p>
            </div>
          </div>

          {/* Master Toggle */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">Enable Real-Time IP Threat Intelligence</div>
                <div className="text-[11px] text-zinc-400">Evaluate connecting registration IP addresses against proxy/VPN detection databases.</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={antiAbuse.enabled}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>
          </div>

          {/* IP Risk Provider Settings */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">Threat Intelligence Provider</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Intelligence Provider</label>
                <select
                  value={antiAbuse.provider}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, provider: e.target.value as any }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="proxycheck">Proxycheck.io (Recommended)</option>
                  <option value="ipqualityscore">IPQualityScore (IPQS)</option>
                  <option value="custom">Custom / Fallback</option>
                </select>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1.5">Provider API Key</label>
                <input
                  type="password"
                  value={antiAbuse.apiKey || ''}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="Enter Proxycheck or IPQS API key..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Leave empty to use public evaluation limits if supported by the provider.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={testingAntiAbuse}
                onClick={handleTestAntiAbuse}
                className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingAntiAbuse ? 'animate-spin text-amber-400' : ''}`} />
                <span>{testingAntiAbuse ? 'Querying API...' : 'Test Intelligence API Connection'}</span>
              </button>

              {antiAbuseTestResult && (
                <div className={`text-xs px-3 py-1 rounded-xl flex items-center gap-1.5 border font-mono ${
                  antiAbuseTestResult.status === 'PASS' || antiAbuseTestResult.status === 'CONFIGURED'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : antiAbuseTestResult.status === 'NOT_CONFIGURED'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                }`}>
                  {antiAbuseTestResult.status === 'PASS' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  <span>[{antiAbuseTestResult.status}] {antiAbuseTestResult.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Blocking Rules */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">Blocking Rules & Thresholds</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                <span className="text-xs text-zinc-200 font-medium">Block VPNs</span>
                <input
                  type="checkbox"
                  checked={antiAbuse.blockVpn}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, blockVpn: e.target.checked }))}
                  className="h-4 w-4 accent-amber-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                <span className="text-xs text-zinc-200 font-medium">Block HTTP/SOCKS Proxies</span>
                <input
                  type="checkbox"
                  checked={antiAbuse.blockProxy}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, blockProxy: e.target.checked }))}
                  className="h-4 w-4 accent-amber-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                <span className="text-xs text-zinc-200 font-medium">Block Tor Exit Nodes</span>
                <input
                  type="checkbox"
                  checked={antiAbuse.blockTor}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, blockTor: e.target.checked }))}
                  className="h-4 w-4 accent-amber-500 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                <span className="text-xs text-zinc-200 font-medium">Block Datacenter/Hosting IPs</span>
                <input
                  type="checkbox"
                  checked={antiAbuse.blockDatacenter}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, blockDatacenter: e.target.checked }))}
                  className="h-4 w-4 accent-amber-500 rounded"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Max IP Risk Score (0-100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={antiAbuse.maxRiskScore}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, maxRiskScore: parseInt(e.target.value) || 65 }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Default 65. Lower is stricter.</p>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Max Registrations / IP / Day</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={antiAbuse.maxRegistrationsPerIpPerDay}
                  onChange={(e) => setAntiAbuse(prev => ({ ...prev, maxRegistrationsPerIpPerDay: parseInt(e.target.value) || 2 }))}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <p className="text-[10px] text-zinc-500 mt-1">Prevents bulk account creation spam.</p>
              </div>

              <div>
                <label className="block text-zinc-400 font-medium mb-1">Login Lockout Attempts / Duration</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={3}
                    max={20}
                    value={antiAbuse.loginLockoutMaxAttempts}
                    onChange={(e) => setAntiAbuse(prev => ({ ...prev, loginLockoutMaxAttempts: parseInt(e.target.value) || 5 }))}
                    className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white font-mono text-center focus:outline-none focus:border-amber-500"
                    title="Max failed attempts"
                  />
                  <input
                    type="number"
                    min={60}
                    max={3600}
                    value={antiAbuse.loginLockoutDurationSec}
                    onChange={(e) => setAntiAbuse(prev => ({ ...prev, loginLockoutDurationSec: parseInt(e.target.value) || 300 }))}
                    className="w-1/2 bg-zinc-900 border border-zinc-800 rounded-xl px-2 py-2 text-white font-mono text-center focus:outline-none focus:border-amber-500"
                    title="Lockout duration in seconds"
                  />
                </div>
                <p className="text-[10px] text-zinc-500 mt-1">Max attempts / seconds locked.</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10">
              <Save className="h-4 w-4" /> Save Security & Anti-Abuse Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Payment Gateways & QR Code Configuration */}
      {activeTab === 'payments' && (
        <form onSubmit={handleSavePayments} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">Payment Gateways & QR Code Billing</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Enable instant UPI QR codes, direct bank transfer info, or crypto deposit addresses.</p>
            </div>
            <button type="submit" className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Gateways
            </button>
          </div>

          {/* UPI Gateway */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">UPI QR Code Gateway (India & Instant)</h3>
              </div>
              <input
                type="checkbox"
                checked={gateways.upi.enabled}
                onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, enabled: e.target.checked } })}
                className="h-4 w-4 accent-amber-500 rounded"
              />
            </div>

            {gateways.upi.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">UPI VPA / ID</label>
                  <input
                    type="text"
                    value={gateways.upi.upiId}
                    onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, upiId: e.target.value } })}
                    placeholder="merchant@upi"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Merchant Display Name</label>
                  <input
                    type="text"
                    value={gateways.upi.merchantName}
                    onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, merchantName: e.target.value } })}
                    placeholder="AetherPanel Hosting"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-zinc-400 font-medium mb-1">Static QR Code Image URL (Direct PNG/JPG)</label>
                  <input
                    type="text"
                    value={gateways.upi.qrCodeUrl}
                    onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, qrCodeUrl: e.target.value } })}
                    placeholder="https://i.imgur.com/your-upi-qr.png"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bank Transfer Gateway */}
          <div className="p-5 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Bank Wire / IMPS / NEFT Details</h3>
              </div>
              <input
                type="checkbox"
                checked={gateways.bank.enabled}
                onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, enabled: e.target.checked } })}
                className="h-4 w-4 accent-amber-500 rounded"
              />
            </div>

            {gateways.bank.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={gateways.bank.bankName}
                    onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, bankName: e.target.value } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Account Holder</label>
                  <input
                    type="text"
                    value={gateways.bank.accountHolder}
                    onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, accountHolder: e.target.value } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Account Number / IBAN</label>
                  <input
                    type="text"
                    value={gateways.bank.accountNumber}
                    onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, accountNumber: e.target.value } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">IFSC / Swift / Routing Code</label>
                  <input
                    type="text"
                    value={gateways.bank.ifsc}
                    onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, ifsc: e.target.value } })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
            )}
          </div>
        </form>
      )}

      {/* TAB 3: Pending Approvals */}
      {activeTab === 'pending' && (
        <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">Manual Payment Proofs Pending Approval</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Verify user transaction reference numbers or UTRs and credit user balances.</p>
            </div>
            <button
              onClick={fetchPendingOrders}
              className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          {loadingOrders ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">Loading pending orders...</div>
          ) : pendingOrders.length === 0 ? (
            <div className="p-12 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
              No pending payment approvals at this time.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-mono">{order.id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-bold">
                        {order.paymentMethod || 'MANUAL'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-300">
                      Amount: <strong className="text-emerald-400 font-mono">${order.amount.toFixed(2)}</strong> ({order.planName})
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      Ref / UTR: <span className="text-white font-bold">{order.transactionRef || 'None provided'}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      Submitted: {new Date(order.createdAt).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleRejectOrder(order.id)}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                    <button
                      onClick={() => handleApproveOrder(order.id)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve & Credit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
