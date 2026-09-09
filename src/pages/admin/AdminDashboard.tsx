import React, { useEffect, useState } from 'react';
import {
  Users, DollarSign, ShoppingBag, LifeBuoy, TrendingUp,
  ArrowRight, RefreshCw, Tag, UserCheck
} from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface AdminDashboardProps {
  onNavigate: (page: string) => void;
}

interface AdminStats {
  users: { total: number; active: number; suspended: number };
  revenue: { total: number; last30Days: number; ordersCount: number };
  orders: { pending: number; paid: number; failed: number };
  support: { open: number; pending: number; total: number };
  coupons: { active: number };
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AdminStats>('/admin/stats');
      if (res.success && res.data) setStats(res.data);
    } catch (e) {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  const cards = stats ? [
    {
      label: 'Total Users',
      value: stats.users.total.toLocaleString(),
      sub: `${stats.users.active.toLocaleString()} active`,
      icon: Users,
      color: 'text-cyan-400',
      onClick: () => onNavigate('admin-users')
    },
    {
      label: 'Total Revenue',
      value: `$${stats.revenue.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      sub: `$${stats.revenue.last30Days.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} last 30 days`,
      icon: DollarSign,
      color: 'text-emerald-400',
      onClick: () => onNavigate('admin-billing')
    },
    {
      label: 'Orders',
      value: (stats.orders.pending + stats.orders.paid + stats.orders.failed).toLocaleString(),
      sub: `${stats.orders.pending} pending approval`,
      icon: ShoppingBag,
      color: 'text-amber-400',
      onClick: () => onNavigate('admin-billing')
    },
    {
      label: 'Support Tickets',
      value: stats.support.total.toLocaleString(),
      sub: `${stats.support.open + stats.support.pending} awaiting reply`,
      icon: LifeBuoy,
      color: 'text-rose-400',
      onClick: () => onNavigate('admin-support')
    }
  ] : [];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">System Overview</h1>
          <p className="text-xs text-zinc-400 mt-1">Platform-wide business metrics at a glance.</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && !stats ? (
        <div className="p-12 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading platform stats...
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map(card => {
              const Icon = card.icon;
              return (
                <button
                  key={card.label}
                  onClick={card.onClick}
                  className="text-left p-5 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition-colors group"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Icon className={`h-5 w-5 ${card.color}`} />
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-white transition-colors" />
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">{card.value}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{card.label}</div>
                  <div className="text-[11px] text-zinc-500 mt-1.5">{card.sub}</div>
                </button>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <TrendingUp className="h-4 w-4 text-amber-400" /> Quick Actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => onNavigate('admin-billing')}
                className="flex items-center gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 transition-colors text-left"
              >
                <ShoppingBag className="h-4 w-4 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">Review Pending Orders</div>
                  <div className="text-[11px] text-zinc-500">{stats?.orders.pending || 0} awaiting approval</div>
                </div>
              </button>
              <button
                onClick={() => onNavigate('admin-support')}
                className="flex items-center gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 transition-colors text-left"
              >
                <LifeBuoy className="h-4 w-4 text-rose-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">Answer Support Tickets</div>
                  <div className="text-[11px] text-zinc-500">{(stats?.support.open || 0) + (stats?.support.pending || 0)} need a reply</div>
                </div>
              </button>
              <button
                onClick={() => onNavigate('admin-coupons')}
                className="flex items-center gap-3 p-4 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 transition-colors text-left"
              >
                <Tag className="h-4 w-4 text-cyan-400 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">Manage Coupons</div>
                  <div className="text-[11px] text-zinc-500">{stats?.coupons.active || 0} active codes</div>
                </div>
              </button>
            </div>
          </div>

          {/* User Snapshot */}
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <UserCheck className="h-4 w-4 text-cyan-400" /> User Snapshot
            </h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-white font-mono">{stats?.users.total || 0}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Total Accounts</div>
              </div>
              <div>
                <div className="text-xl font-bold text-emerald-400 font-mono">{stats?.users.active || 0}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Active</div>
              </div>
              <div>
                <div className="text-xl font-bold text-rose-400 font-mono">{stats?.users.suspended || 0}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Suspended</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
