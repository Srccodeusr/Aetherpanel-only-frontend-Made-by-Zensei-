import React, { useState, useEffect } from 'react';
import { Mail as MailIcon, Inbox, Trash2, ShieldCheck, ShieldAlert, LifeBuoy, CheckCheck, Megaphone } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Mail as MailItem, UserRole } from '../../types';
import { useTheme } from '../../lib/ThemeContext';

interface MailProps {
  onNavigate: (page: string, params?: any) => void;
}

function senderBadge(role: UserRole) {
  if (role === 'super_admin') {
    return { label: 'Owner', icon: ShieldCheck, className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  }
  if (role === 'admin') {
    return { label: 'System Admin', icon: ShieldAlert, className: 'bg-violet-500/10 text-violet-400 border-violet-500/20' };
  }
  return { label: 'Staff', icon: LifeBuoy, className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };
}

export const Mail: React.FC<MailProps> = () => {
  const { accentClasses } = useTheme();

  const [mail, setMail] = useState<MailItem[]>([]);
  const [selected, setSelected] = useState<MailItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchMail = async () => {
    const res = await apiRequest('/mail');
    if (res.success && res.data) {
      setMail(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMail();
  }, []);

  const handleSelect = async (m: MailItem) => {
    setSelected(m);
    if (!m.isRead) {
      const res = await apiRequest(`/mail/${m.id}/read`, { method: 'PATCH' });
      if (res.success) {
        setMail(prev => prev.map(item => item.id === m.id ? { ...item, isRead: true } : item));
        setSelected(prev => prev && prev.id === m.id ? { ...prev, isRead: true } : prev);
      }
    }
  };

  const handleDelete = async (id: string) => {
    const res = await apiRequest(`/mail/${id}`, { method: 'DELETE' });
    if (res.success) {
      setMail(prev => prev.filter(m => m.id !== id));
      setSelected(prev => (prev?.id === id ? null : prev));
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    const res = await apiRequest('/mail/mark-all-read', { method: 'POST' });
    if (res.success) {
      setMail(prev => prev.map(m => ({ ...m, isRead: true })));
      setSelected(prev => (prev ? { ...prev, isRead: true } : prev));
    }
    setMarkingAll(false);
  };

  const unreadCount = mail.filter(m => !m.isRead).length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MailIcon className="h-6 w-6" /> Mailbox
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Messages sent to you by platform staff, system admins, and the owner.</p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="px-4 py-2.5 rounded-xl font-semibold text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 hover:text-white hover:bg-zinc-850 flex items-center gap-2 transition-all disabled:opacity-60"
          >
            <CheckCheck className="h-4 w-4" /> {markingAll ? 'Marking...' : `Mark all ${unreadCount} as read`}
          </button>
        )}
      </div>

      {/* Main Grid: Mail List + Message Body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Mail List (Left Column) */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Inbox {unreadCount > 0 && <span className={accentClasses.text}>({unreadCount} unread)</span>}
          </h3>

          {loading ? (
            <div className="p-6 text-center bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-zinc-400">Loading mail...</div>
          ) : mail.length === 0 ? (
            <div className="p-6 text-center bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-zinc-400 space-y-2">
              <Inbox className="h-6 w-6 text-zinc-600 mx-auto" />
              <p>Your mailbox is empty.</p>
            </div>
          ) : (
            mail.map((m) => {
              const badge = senderBadge(m.senderRole);
              const BadgeIcon = badge.icon;
              return (
                <div
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                    selected?.id === m.id
                      ? 'bg-zinc-800/80 border-violet-500 shadow-lg shadow-violet-500/10'
                      : m.isRead
                      ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                      : 'bg-zinc-900 border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border flex items-center gap-1 ${badge.className}`}>
                      <BadgeIcon className="h-3 w-3" /> {badge.label}
                    </span>
                    {!m.isRead && <span className={`h-2 w-2 rounded-full mt-1 shrink-0 bg-gradient-to-r ${accentClasses.gradient}`} />}
                  </div>

                  <h4 className={`text-sm leading-tight ${m.isRead ? 'text-zinc-300 font-medium' : 'text-white font-bold'}`}>
                    {m.subject}
                  </h4>

                  <div className="flex justify-between items-center text-[11px] text-zinc-500 pt-1">
                    <span className="flex items-center gap-1">
                      {m.isBroadcast && <Megaphone className="h-3 w-3" />}
                      {m.senderName}
                    </span>
                    <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected Mail (Right Column) */}
        <div className="lg:col-span-2 space-y-4">
          {selected ? (
            <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
              <div className="border-b border-zinc-800 pb-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  {(() => {
                    const badge = senderBadge(selected.senderRole);
                    const BadgeIcon = badge.icon;
                    return (
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono border flex items-center gap-1.5 ${badge.className}`}>
                        <BadgeIcon className="h-3.5 w-3.5" /> {badge.label}
                      </span>
                    );
                  })()}
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="p-2 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-zinc-950/60 transition-colors"
                    title="Delete message"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <h2 className="text-xl font-bold text-white">{selected.subject}</h2>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                  <span>From: <strong className="text-white">{selected.senderName}</strong></span>
                  <span>{new Date(selected.createdAt).toLocaleString()}</span>
                  {selected.isBroadcast && (
                    <span className="text-violet-400 flex items-center gap-1"><Megaphone className="h-3 w-3" /> Sent to all users</span>
                  )}
                </div>
              </div>

              <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{selected.body}</p>
            </div>
          ) : (
            <div className="p-12 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl text-zinc-400 text-xs space-y-2">
              <MailIcon className="h-8 w-8 text-zinc-600 mx-auto" />
              <p>Select a message from your inbox to read it.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
