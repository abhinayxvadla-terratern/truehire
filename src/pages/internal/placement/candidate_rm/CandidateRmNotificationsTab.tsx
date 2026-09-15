import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Bell,
  Send,
  Search,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface RecipientOption {
  userId: string;
  label: string;
  type: 'candidate' | 'supplier';
  detail: string;
}

interface SentNotificationItem {
  id: string;
  user_id: string | null;
  recipient_name?: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

export const CandidateRmNotificationsTab: React.FC = () => {
  const { user } = useAuth();
  const [recipientOptions, setRecipientOptions] = useState<RecipientOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sent History
  const [sentHistory, setSentHistory] = useState<SentNotificationItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchRecipientsAndHistory = async () => {
    if (!user) return;

    try {
      setHistoryLoading(true);

      // 1. Fetch assigned suppliers
      const { data: assignments } = await supabase
        .from('rm_assignments')
        .select(`
          entity_id,
          suppliers:entity_id (id, company_name, user_id)
        `)
        .eq('rm_profile_id', user.id)
        .eq('entity_type', 'supplier')
        .eq('active', true);

      const supList = (assignments || []).map((a: any) => a.suppliers).filter(Boolean);
      const supplierIds = supList.map((s: any) => s.id);

      const options: RecipientOption[] = [];

      // Add suppliers with registered user_id
      supList.forEach((s: any) => {
        if (s.user_id) {
          options.push({
            userId: s.user_id,
            label: `${s.company_name} (Admin / Owner)`,
            type: 'supplier',
            detail: 'Sourcing Agency Primary Contact',
          });
        }
      });

      // 2. Fetch team members for these suppliers
      if (supplierIds.length > 0) {
        const { data: teamMembers } = await supabase
          .from('supplier_team_members')
          .select(`
            profile_id,
            role,
            supplier_id,
            suppliers:supplier_id (company_name),
            profiles:profile_id (first_name, last_name, email)
          `)
          .in('supplier_id', supplierIds)
          .eq('invite_status', 'accepted');

        (teamMembers || []).forEach((tm: any) => {
          if (tm.profile_id) {
            const p = tm.profiles;
            const name = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email : tm.role;
            const comp = tm.suppliers?.company_name || 'Supplier';
            options.push({
              userId: tm.profile_id,
              label: `${name} (${comp} — ${tm.role})`,
              type: 'supplier',
              detail: `Team Member at ${comp}`,
            });
          }
        });

        // 3. Fetch candidates for these suppliers with registered user_id
        const { data: cands } = await supabase
          .from('candidates')
          .select('id, user_id, first_name, last_name, target_role')
          .in('supplier_id', supplierIds);

        (cands || []).forEach((c) => {
          if (c.user_id) {
            options.push({
              userId: c.user_id,
              label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Candidate #${c.id.slice(0, 6)}`,
              type: 'candidate',
              detail: c.target_role || 'Healthcare Candidate',
            });
          }
        });
      }

      setRecipientOptions(options);

      // 3. Fetch sent notifications where sent_by = auth.uid() (limit 20)
      const { data: sentData } = await supabase
        .from('notifications')
        .select('*')
        .eq('sent_by', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Lookup recipient names
      const recipientUserIds = (sentData || [])
        .map((n) => n.user_id)
        .filter(Boolean) as string[];

      let nameMap: Record<string, string> = {};
      if (recipientUserIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', recipientUserIds);

        (profs || []).forEach((p) => {
          nameMap[p.id] =
            `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
        });
      }

      const formatted: SentNotificationItem[] = (sentData || []).map((n) => ({
        ...n,
        recipient_name: n.user_id ? nameMap[n.user_id] || 'Registered User' : 'System Broadcast',
      }));

      setSentHistory(formatted);
    } catch (err) {
      console.error('Error loading notifications tab data:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipientsAndHistory();
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!user || !selectedUserId || !title.trim() || !message.trim()) {
      setErrorMsg('Select a recipient and enter both a title and message.');
      return;
    }

    try {
      setSending(true);

      const { error } = await supabase.from('notifications').insert({
        user_id: selectedUserId,
        title: title.trim(),
        message: message.trim(),
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      if (error) throw error;

      showToast('Notification dispatched successfully');
      setTitle('');
      setMessage('');
      setSelectedUserId('');
      fetchRecipientsAndHistory();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch notification.');
    } finally {
      setSending(false);
    }
  };

  const filteredOptions = recipientOptions.filter((opt) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return opt.label.toLowerCase().includes(q) || opt.detail.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          RM Direct Communications & Notices
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Dispatch operational messages to your assigned suppliers and candidates, and review delivery history.
        </p>
      </div>

      {/* SEND NOTIFICATION FORM */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-4">
        <div className="flex items-center space-x-2 border-b border-[#E2E8F4] pb-3">
          <Send className="w-4 h-4 text-[#1B3270]" />
          <h2 className="text-sm font-bold text-slate-900">
            Compose Direct Notification
          </h2>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] text-xs text-rose-700 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Select Recipient (Candidates & Suppliers from Your Accounts) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter recipient options..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <select
                required
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full py-1.5 px-3 text-xs border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              >
                <option value="">Select Recipient...</option>
                {filteredOptions.map((opt) => (
                  <option key={opt.userId} value={opt.userId}>
                    [{opt.type.toUpperCase()}] {opt.label} — {opt.detail}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Notification Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Action Required: German B1 Certificate Verification"
              className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Message Content *
            </label>
            <textarea
              rows={4}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Provide specific instructions, document guidance, or milestone timeline..."
              className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              {sending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Notification</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* SENT HISTORY TABLE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Recent Sent Communications (Last 20)
          </h2>
          <span className="text-xs text-slate-400">
            {sentHistory.length} notices logged
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
          {historyLoading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : sentHistory.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                No outbound notifications sent yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Message Preview</th>
                    <th className="py-3 px-4 text-center">Read Status</th>
                    <th className="py-3 px-4">Sent At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                  {sentHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {item.recipient_name}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {item.title}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 truncate max-w-xs">
                        {item.message}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.read
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.read ? 'Read' : 'Delivered'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CandidateRmNotificationsTab;
