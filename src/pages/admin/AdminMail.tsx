import React, { useState, useEffect, useMemo } from 'react';
import { Mail as MailIcon, PlusCircle, Send, Megaphone, User as UserIcon, ShieldCheck, ShieldAlert, LifeBuoy } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Mail as MailItem, User, UserRole } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useToast } from '../../lib/ToastContext';

interface MailBatch {
  batchId: string;
  subject: string;
  body: string;
  createdAt: string;
  isBroadcast: boolean;
  recipientCount: number;
  readCount: number;
  recipientLabel: string;
}

function roleBadge(role: UserRole) {
  if (role === 'super_admin') return { label: 'Owner', icon: ShieldCheck, className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  if (role === 'admin') return { label: 'System Admin', icon: ShieldAlert, className: 'bg-violet-500/10 text-violet-400 border-violet-500/20' };
  return { label: 'Staff', icon: LifeBuoy, className: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };
}

export const AdminMail: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [sentMail, setSentMail] = useState<MailItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [showComposeModal, setShowComposeModal] = useState(false);
  const [recipientId, setRecipientId] = useState('all');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchData = async () => {
    const [sentRes, usersRes] = await Promise.all([
      apiRequest('/mail/sent'),
      apiRequest('/admin/users')
    ]);
    if (sentRes.success && sentRes.data) setSentMail(sentRes.data);
    if (usersRes.success && usersRes.data) {
      setUsers(usersRes.data);
    } else {
      // Without the user list the recipient dropdown is empty — say why
      // instead of leaving the admin to hit a confusing "no user" error later.
      toast.error(usersRes.error?.message || 'Could not load the user list for the recipient dropdown.');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const batches: MailBatch[] = useMemo(() => {
    const map = new Map<string, MailItem[]>();
    sentMail.forEach(m => {
      const group = map.get(m.batchId) || [];
      group.push(m);
      map.set(m.batchId, group);
    });

    return Array.from(map.values())
      .map(group => {
        const first = group[0];
        return {
          batchId: first.batchId,
          subject: first.subject,
          body: first.body,
          createdAt: first.createdAt,
          isBroadcast: first.isBroadcast,
          recipientCount: group.length,
          readCount: group.filter(m => m.isRead).length,
          recipientLabel: first.isBroadcast
            ? `All Users (${group.length})`
            : first.recipientName
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [sentMail]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !subject.trim() || !body.trim()) return;

    setIsSending(true);
    const res = await apiRequest('/mail/send', {
      method: 'POST',
      body: JSON.stringify({ recipientId, subject, body })
    });

    if (res.success) {
      toast.success(res.message || 'Mail sent.', 'Mail Delivered');
      setSubject('');
      setBody('');
      setRecipientId('all');
      setShowComposeModal(false);
      fetchData();
    } else {
      toast.error(res.error?.message || 'Failed to send mail.');
    }
    setIsSending(false);
  };

  const myBadge = user ? roleBadge(user.role) : null;
  const MyBadgeIcon = myBadge?.icon;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-amber-500/20 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MailIcon className="h-6 w-6 text-amber-400" /> Mail Center
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Send direct messages or broadcasts straight to users' platform mailboxes.</p>
        </div>

        <button
          onClick={() => setShowComposeModal(true)}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5"
        >
          <PlusCircle className="h-4 w-4" /> Compose Mail
        </button>
      </div>

      {/* Sent History */}
      {loading ? (
        <div className="p-12 text-center text-xs text-zinc-400">Loading sent mail...</div>
      ) : batches.length === 0 ? (
        <div className="p-8 text-center bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-zinc-400">
          No mail has been sent yet. Use "Compose Mail" to message a user or broadcast to everyone.
        </div>
      ) : (
        <div className="space-y-4">
          {batches.map((b) => (
            <div key={b.batchId} className="p-5 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-2">
              <div className="flex flex-wrap justify-between items-start gap-2">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono border flex items-center gap-1 ${
                    b.isBroadcast ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                  }`}>
                    {b.isBroadcast ? <Megaphone className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                    {b.recipientLabel}
                  </span>
                  <span className="text-[10px] text-zinc-500">{new Date(b.createdAt).toLocaleString()}</span>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono">{b.readCount}/{b.recipientCount} read</span>
              </div>

              <h3 className="text-base font-bold text-white">{b.subject}</h3>
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{b.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* Compose Modal */}
      {showComposeModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleSend} className="w-full max-w-lg bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Compose Mail</h3>
              {myBadge && MyBadgeIcon && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border flex items-center gap-1 ${myBadge.className}`}>
                  <MyBadgeIcon className="h-3 w-3" /> Sending as {myBadge.label}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Recipient</label>
              <select
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
              >
                <option value="all">📣 Broadcast to All Users ({users.length})</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {(u.displayName || u.username)} — {u.email} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Your server migration is complete"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="Write the message that will land in the recipient's mailbox..."
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs text-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowComposeModal(false)}
                className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-xs text-zinc-950 font-bold rounded-xl flex items-center gap-1.5 disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" /> {isSending ? 'Sending...' : 'Send Mail'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
