import React, { useEffect, useState } from 'react';
import {
  CreditCard, LifeBuoy, Activity, Settings, ArrowRight,
  ShoppingBag, Sparkles, Clock, CheckCircle2, XCircle, RefreshCw
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import type { Order, SupportTicket } from '../../types';

interface DashboardProps {
  onNavigate: (page: string, params?: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { accentClasses } = useTheme();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersRes, ticketsRes] = await Promise.all([
        apiRequest<Order[]>('/billing/orders'),
        apiRequest<SupportTicket[]>('/support/tickets')
      ]);
      if (ordersRes.success && ordersRes.data) setOrders(ordersRes.data);
      if (ticketsRes.success && ticketsRes.data) setTickets(ticketsRes.data);
    } catch (e) {
      // Silent — dashboard degrades gracefully
    } finally {
      setLoading(false);
    }
  };

  const recentOrders = [...orders]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'pending');

  const statusBadge = (status: Order['status']) => {
    switch (status) {
      case 'paid':
        return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><CheckCircle2 className="h-2.5 w-2.5" /> Paid</span>;
      case 'pending':
        return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20"><Clock className="h-2.5 w-2.5" /> Pending</span>;
      case 'failed':
        return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20"><XCircle className="h-2.5 w-2.5" /> Failed</span>;
      case 'refunded':
        return <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">Refunded</span>;
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome back, {user?.displayName || user?.username}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Here's a quick overview of your account.</p>
        </div>
        <button
          onClick={() => onNavigate('pricing')}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md hover:opacity-95 transition-all`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Browse Plans</span>
        </button>
      </div>

      {/* Quick Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate('billing')}
          className="text-left p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <CreditCard className="h-5 w-5 text-emerald-400" />
            <ArrowRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white transition-colors" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">${user?.credits?.toFixed(2) || '0.00'}</div>
          <div className="text-xs text-zinc-400 mt-0.5">Account Credits</div>
        </button>

        <button
          onClick={() => onNavigate('billing')}
          className="text-left p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <ShoppingBag className="h-5 w-5 text-amber-400" />
            <ArrowRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white transition-colors" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{orders.length}</div>
          <div className="text-xs text-zinc-400 mt-0.5">Total Orders</div>
        </button>

        <button
          onClick={() => onNavigate('support')}
          className="text-left p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition-colors group"
        >
          <div className="flex items-center justify-between mb-2">
            <LifeBuoy className="h-5 w-5 text-cyan-400" />
            <ArrowRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white transition-colors" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{openTickets.length}</div>
          <div className="text-xs text-zinc-400 mt-0.5">Open Support Tickets</div>
        </button>
      </div>

      {/* Recent Orders */}
      <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-amber-400" /> Recent Orders
          </h2>
          <button
            onClick={() => onNavigate('billing')}
            className="text-xs font-semibold text-amber-400 hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Loading orders...
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-500">
            No orders yet.{' '}
            <button onClick={() => onNavigate('pricing')} className="text-amber-400 hover:underline font-semibold">
              Browse plans
            </button>{' '}
            to get started.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {recentOrders.map(order => (
              <div key={order.id} className="flex items-center justify-between px-5 py-3.5">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{order.planName}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {new Date(order.createdAt).toLocaleDateString()} · {order.billingCycle}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono font-semibold text-zinc-300">
                    {order.currency} {order.amount.toFixed(2)}
                  </span>
                  {statusBadge(order.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate('activity')}
          className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition-colors text-left"
        >
          <Activity className="h-5 w-5 text-zinc-400" />
          <div>
            <div className="text-xs font-semibold text-white">Activity Log</div>
            <div className="text-[11px] text-zinc-500">Review recent account activity</div>
          </div>
        </button>
        <button
          onClick={() => onNavigate('support')}
          className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition-colors text-left"
        >
          <LifeBuoy className="h-5 w-5 text-zinc-400" />
          <div>
            <div className="text-xs font-semibold text-white">Support Tickets</div>
            <div className="text-[11px] text-zinc-500">Get help from our team</div>
          </div>
        </button>
        <button
          onClick={() => onNavigate('settings')}
          className="flex items-center gap-3 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition-colors text-left"
        >
          <Settings className="h-5 w-5 text-zinc-400" />
          <div>
            <div className="text-xs font-semibold text-white">Account Settings</div>
            <div className="text-[11px] text-zinc-500">Profile, password & webhooks</div>
          </div>
        </button>
      </div>
    </div>
  );
};
