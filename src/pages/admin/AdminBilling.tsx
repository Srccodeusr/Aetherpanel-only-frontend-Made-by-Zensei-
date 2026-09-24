import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag, RefreshCw, CheckCircle2, XCircle, Loader2, AlertCircle,
  X, Eye, Clock, Mail as MailIcon
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Order } from '../../types';

type StatusFilter = 'all' | 'pending' | 'paid' | 'failed' | 'refunded';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Accepted' },
  { key: 'failed', label: 'Declined' },
  { key: 'refunded', label: 'Refunded' }
];

function statusLabel(status: Order['status']) {
  if (status === 'failed') return 'declined';
  if (status === 'paid') return 'accepted';
  return status;
}

function statusClass(status: Order['status']) {
  if (status === 'paid') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'pending') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (status === 'refunded') return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
  return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
}

export const AdminBilling: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');

  // One order is processed at a time so a double-tap can never approve or
  // reject the same order twice.
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; isError: boolean } | null>(null);

  const [detail, setDetail] = useState<Order | null>(null);
  const [declineTarget, setDeclineTarget] = useState<Order | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const showFlash = (text: string, isError = false) => {
    setFlash({ text, isError });
    setTimeout(() => setFlash(null), isError ? 8000 : 6000);
  };

  const fetchOrders = async () => {
    const res = await apiRequest('/admin/orders');
    if (res.success && res.data) {
      setOrders(res.data);
    } else {
      showFlash(res.error?.message || 'Could not load orders.', true);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: orders.length, pending: 0, paid: 0, failed: 0, refunded: 0 };
    orders.forEach(o => { c[o.status as Exclude<StatusFilter, 'all'>] += 1; });
    return c;
  }, [orders]);

  const visible = useMemo(
    () => (filter === 'all' ? orders : orders.filter(o => o.status === filter)),
    [orders, filter]
  );

  const handleAccept = async (order: Order) => {
    if (processingId) return;
    setProcessingId(order.id);

    const res = await apiRequest(`/admin/orders/${order.id}/approve`, { method: 'POST', body: JSON.stringify({}) });
    if (res.success) {
      showFlash(res.message || 'Order accepted. The customer has been notified in their Mail inbox.');
      setDetail(null);
    } else {
      showFlash(res.error?.message || 'Failed to accept order.', true);
    }

    await fetchOrders();
    setProcessingId(null);
  };

  const openDecline = (order: Order) => {
    setDeclineReason('');
    setDeclineTarget(order);
  };

  const handleConfirmDecline = async () => {
    if (!declineTarget || processingId) return;
    const order = declineTarget;
    setProcessingId(order.id);

    const res = await apiRequest(`/admin/orders/${order.id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: declineReason.trim() })
    });
    if (res.success) {
      showFlash(res.message || 'Order declined. The customer has been notified in their Mail inbox.');
      setDeclineTarget(null);
      setDetail(null);
    } else {
      showFlash(res.error?.message || 'Failed to decline order.', true);
    }

    await fetchOrders();
    setProcessingId(null);
  };

  const isDeposit = (o: Order) => o.planId === 'credit_deposit';

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="border-b border-amber-500/20 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="h-6 w-6 text-amber-400" /> Platform Orders & Transactions
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Verify payments, then accept or decline each order. The customer is emailed to their Mail inbox automatically.
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchOrders(); }}
          className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {flash && (
        <div className={`flex items-start gap-2 text-xs p-3 rounded-xl border font-semibold ${
          flash.isError
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        }`}>
          {flash.isError ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
          <span>{flash.text}</span>
        </div>
      )}

      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5 bg-zinc-900 border border-zinc-800 p-1 rounded-2xl w-fit text-xs font-semibold">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
              filter === f.key ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {f.label}
            <span className={`px-1.5 rounded-full text-[10px] font-mono ${
              filter === f.key ? 'bg-zinc-950/20' : 'bg-zinc-800 text-zinc-400'
            } ${f.key === 'pending' && counts.pending > 0 && filter !== 'pending' ? '!bg-amber-500/20 !text-amber-400' : ''}`}>
              {counts[f.key]}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading order records...</div>
      ) : visible.length === 0 ? (
        <div className="p-10 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
          {filter === 'all' ? 'No orders yet.' : `No ${filter === 'paid' ? 'accepted' : filter === 'failed' ? 'declined' : filter} orders.`}
        </div>
      ) : (
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[860px]">
            <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
              <tr>
                <th className="p-3.5">Order ID</th>
                <th className="p-3.5">User Email</th>
                <th className="p-3.5">Plan / Service</th>
                <th className="p-3.5">Amount</th>
                <th className="p-3.5">Method</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {visible.map((o) => {
                const busy = processingId === o.id;
                return (
                  <tr key={o.id} className="hover:bg-zinc-900 transition-colors">
                    <td className="p-3.5 font-mono text-amber-400 font-semibold">#{o.id.slice(-8)}</td>
                    <td className="p-3.5 font-semibold text-white">{o.userEmail}</td>
                    <td className="p-3.5 text-zinc-300">
                      {o.planName}
                      <span className="block text-[10px] text-zinc-500">{isDeposit(o) ? 'Credit top-up' : 'Plan purchase'}</span>
                    </td>
                    <td className="p-3.5 font-mono text-emerald-400 font-bold">${o.amount.toFixed(2)}</td>
                    <td className="p-3.5 text-zinc-400">{o.paymentMethod}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border capitalize ${statusClass(o.status)}`}>
                        {statusLabel(o.status)}
                      </span>
                    </td>
                    <td className="p-3.5 text-zinc-500 font-mono whitespace-nowrap">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="p-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setDetail(o)}
                          title="View details"
                          className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {o.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => openDecline(o)}
                              disabled={!!processingId}
                              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold flex items-center gap-1 disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Decline
                            </button>
                            <button
                              onClick={() => handleAccept(o)}
                              disabled={!!processingId}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1 disabled:opacity-50"
                            >
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Accept
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-zinc-600 font-mono px-2">Final</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Order #{detail.id.slice(-8)}</h3>
              <button onClick={() => setDetail(null)} className="text-zinc-500 hover:text-zinc-300"><X className="h-4 w-4" /></button>
            </div>

            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono border capitalize ${statusClass(detail.status)}`}>
              {statusLabel(detail.status)}
            </span>

            <div className="space-y-2 text-xs">
              <Row label="Customer" value={detail.userEmail} />
              <Row label="Plan" value={`${detail.planName} (${isDeposit(detail) ? 'credit top-up' : detail.billingCycle})`} />
              <Row label="Amount" value={`$${detail.amount.toFixed(2)} ${detail.currency || ''}`} mono />
              <Row label="Method" value={detail.paymentMethod} />
              {detail.creditsHeld ? (
                <Row label="Payment" value="Account credits (held — refunded if declined)" />
              ) : (
                <Row label="Ref / UTR / Gift card code" value={detail.transactionRef || 'None provided'} mono highlight />
              )}
              {detail.serverName && <Row label="Server name" value={detail.serverName} />}
              {detail.couponCode && <Row label="Coupon" value={detail.couponCode} mono />}
              {detail.adminNote && <Row label="Staff note" value={detail.adminNote} />}
              <Row label="Submitted" value={new Date(detail.createdAt).toLocaleString()} />
            </div>

            {detail.status === 'pending' ? (
              <>
                <p className="text-[11px] text-zinc-500 flex items-start gap-1.5">
                  <MailIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  Accepting or declining sends the customer an automatic message in their Mail inbox.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => openDecline(detail)}
                    disabled={!!processingId}
                    className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Decline
                  </button>
                  <button
                    onClick={() => handleAccept(detail)}
                    disabled={!!processingId}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {processingId === detail.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Accept
                  </button>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> This order has already been {statusLabel(detail.status)} and can't be changed.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Decline dialog */}
      {declineTarget && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <XCircle className="h-4 w-4 text-rose-400" /> Decline order
              </h3>
              <button onClick={() => setDeclineTarget(null)} disabled={!!processingId} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              {declineTarget.planName} — <span className="font-mono text-white">${declineTarget.amount.toFixed(2)}</span> from {declineTarget.userEmail}.
              {declineTarget.creditsHeld && ' The held credits will be refunded to the customer automatically.'}
              {' '}They'll get a message in their Mail inbox with your reason.
            </p>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Reason (optional)</label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                rows={3}
                autoFocus
                placeholder="e.g. Gift card code was already redeemed"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeclineTarget(null)}
                disabled={!!processingId}
                className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDecline}
                disabled={!!processingId}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-xs text-white font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-60"
              >
                {processingId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Decline order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean; highlight?: boolean }> = ({ label, value, mono, highlight }) => (
  <div className="flex justify-between gap-4 bg-zinc-900 rounded-xl px-3 py-2">
    <span className="text-zinc-500 shrink-0">{label}</span>
    <span className={`text-right break-all ${mono ? 'font-mono' : ''} ${highlight ? 'text-amber-400 font-bold' : 'text-white'}`}>{value}</span>
  </div>
);
