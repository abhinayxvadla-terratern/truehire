import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Bell,
  Send,
  Radio,
  Search,
  AlertCircle,
  Check,
  Loader2,
  Trash2,
} from 'lucide-react';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

interface NotificationRow {
  id: string;
  user_id: string | null;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  recipient_name?: string;
  recipient_email?: string;
}

interface ProfileSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_internal: boolean;
}

export const NotificationsTab: React.FC = () => {
  const [history, setHistory] = useState<NotificationRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Send to Individual state
  const [individualSearch, setIndividualSearch] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<ProfileSearchResult | null>(null);
  const [indivTitle, setIndivTitle] = useState('');
  const [indivMessage, setIndivMessage] = useState('');
  const [indivType, setIndivType] = useState('general');
  const [sendingIndiv, setSendingIndiv] = useState(false);
  const [indivError, setIndivError] = useState<string | null>(null);

  // Broadcast state
  const [broadcastGroup, setBroadcastGroup] = useState('all_candidates');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [notificationToDelete, setNotificationToDelete] = useState<NotificationRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteNotificationConfirm = async () => {
    if (!notificationToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationToDelete.id);

      if (error) throw error;

      showToast('Notification deleted.');
      setNotificationToDelete(null);
      fetchHistory();
    } catch (err: any) {
      alert(`Failed to delete notification: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          title,
          message,
          type,
          read,
          created_at,
          profiles:user_id(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const rows: NotificationRow[] = (data || []).map((n: any) => ({
        id: n.id,
        user_id: n.user_id,
        title: n.title,
        message: n.message,
        type: n.type,
        read: n.read,
        created_at: n.created_at,
        recipient_name: n.profiles
          ? `${n.profiles.first_name || ''} ${n.profiles.last_name || ''}`.trim() || n.profiles.email
          : 'Broadcast / Unassigned',
        recipient_email: n.profiles?.email || '—',
      }));

      setHistory(rows);
    } catch (err) {
      console.error('Error fetching notification history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Search profiles when typing in individual search
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      const q = individualSearch.trim();
      if (!q || selectedUser) {
        setSearchResults([]);
        return;
      }

      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email, role, is_internal')
          .or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(6);

        setSearchResults((data as ProfileSearchResult[]) || []);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 300);

    return () => clearTimeout(searchTimer);
  }, [individualSearch, selectedUser]);

  // Handle Send Individual
  const handleSendIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    setIndivError(null);

    if (!selectedUser) {
      setIndivError('Select a recipient from the user search.');
      return;
    }
    if (!indivTitle.trim() || !indivMessage.trim()) {
      setIndivError('Title and message cannot be empty.');
      return;
    }

    setSendingIndiv(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedUser.id,
          title: indivTitle.trim(),
          message: indivMessage.trim(),
          type: indivType,
          read: false,
        })
        .select()
        .single();

      if (error) throw error;

      showToast(`Notification sent to ${selectedUser.first_name} ${selectedUser.last_name}`);
      setIndivTitle('');
      setIndivMessage('');
      setSelectedUser(null);
      setIndividualSearch('');
      fetchHistory();
    } catch (err: any) {
      setIndivError(err.message || 'Failed to send notification.');
    } finally {
      setSendingIndiv(false);
    }
  };

  // Handle Broadcast
  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setBroadcastError(null);

    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      setBroadcastError('Title and message are required.');
      return;
    }

    setBroadcasting(true);
    try {
      // 1. Query target profiles based on group
      let query = supabase.from('profiles').select('id');

      switch (broadcastGroup) {
        case 'all_candidates':
          query = query.eq('role', 'candidate');
          break;
        case 'all_suppliers':
          query = query.eq('role', 'supplier');
          break;
        case 'all_employers':
          query = query.eq('role', 'employer');
          break;
        case 'all_internal':
          query = query.eq('is_internal', true);
          break;
        case 'all_users':
        default:
          // all users
          break;
      }

      const { data: targetProfiles, error: queryErr } = await query;
      if (queryErr) throw queryErr;

      if (!targetProfiles || targetProfiles.length === 0) {
        setBroadcastError('No recipient profiles found in the selected target group.');
        setBroadcasting(false);
        return;
      }

      // 2. Batch insert notifications
      const notificationsToInsert = targetProfiles.map((p) => ({
        user_id: p.id,
        title: broadcastTitle.trim(),
        message: broadcastMessage.trim(),
        type: 'general',
        read: false,
      }));

      const { error: insertErr } = await supabase
        .from('notifications')
        .insert(notificationsToInsert);

      if (insertErr) throw insertErr;

      showToast(
        `Broadcast sent to ${targetProfiles.length} user(s) in group: ${broadcastGroup.replace(
          '_',
          ' '
        )}`
      );
      setBroadcastTitle('');
      setBroadcastMessage('');
      fetchHistory();
    } catch (err: any) {
      setBroadcastError(err.message || 'Failed to dispatch broadcast.');
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[6px] shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1B3270]">Notification Center</h1>
        <p className="text-sm text-slate-500 mt-1">
          Direct urgent platform notices, candidate updates, and system-wide broadcast alerts.
        </p>
      </div>

      {/* TWO COLUMN DISPATCH GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* COLUMN 1: SEND TO INDIVIDUAL */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-[#E2E8F4]">
            <Send className="w-5 h-5 text-[#1B3270]" />
            <h2 className="text-base font-bold text-slate-800">Direct Notification</h2>
          </div>

          {indivError && (
            <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{indivError}</span>
            </div>
          )}

          <form onSubmit={handleSendIndividual} className="space-y-3 text-xs">
            {/* User Search */}
            <div className="relative">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Recipient (Search Name or Email) *
              </label>

              {selectedUser ? (
                <div className="flex items-center justify-between p-2 rounded-[6px] bg-[#F0F4FF] border border-[#2952A3]/20">
                  <div>
                    <span className="font-bold text-[#1B3270]">
                      {selectedUser.first_name} {selectedUser.last_name}
                    </span>
                    <span className="text-[11px] text-slate-500 ml-2">
                      ({selectedUser.email}) — {selectedUser.role}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUser(null);
                      setIndividualSearch('');
                    }}
                    className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Type name or email to search..."
                      value={individualSearch}
                      onChange={(e) => setIndividualSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>

                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-[#E2E8F4] rounded-[6px] shadow-lg max-h-48 overflow-y-auto divide-y divide-[#E2E8F4]">
                      {searchResults.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setSelectedUser(p);
                            setSearchResults([]);
                          }}
                          className="p-2.5 hover:bg-[#F8FAFD] cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <p className="font-semibold text-slate-800">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="text-[11px] text-slate-400 font-mono">{p.email}</p>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                            {p.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Notification Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Notification Category *
              </label>
              <select
                value={indivType}
                onChange={(e) => setIndivType(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-800"
              >
                <option value="general">General Notice</option>
                <option value="gate_result">Gate Result / Milestone</option>
                <option value="application_update">Application Update</option>
                <option value="document">Document / Verification</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Notice Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Schedule update for German B2 exam"
                value={indivTitle}
                onChange={(e) => setIndivTitle(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Notice Message *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Write the full notification text..."
                value={indivMessage}
                onChange={(e) => setIndivMessage(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={sendingIndiv}
              className="w-full py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white font-semibold text-xs rounded-[6px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              {sendingIndiv ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Direct Notification</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* COLUMN 2: BROADCAST TO GROUP */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-[#E2E8F4]">
            <Radio className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-800">Broadcast Broadcast Alert</h2>
          </div>

          {broadcastError && (
            <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{broadcastError}</span>
            </div>
          )}

          <form onSubmit={handleBroadcast} className="space-y-3 text-xs">
            {/* Target Group */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Target Group Audience *
              </label>
              <select
                value={broadcastGroup}
                onChange={(e) => setBroadcastGroup(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-800"
              >
                <option value="all_candidates">All Registered Candidates</option>
                <option value="all_suppliers">All Channel Suppliers</option>
                <option value="all_employers">All Healthcare Employers</option>
                <option value="all_internal">All Internal Staff</option>
                <option value="all_users">All System Users (Global)</option>
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Broadcast Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Platform Scheduled Maintenance Notice"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Broadcast Message Content *
              </label>
              <textarea
                rows={5}
                required
                placeholder="Compose the announcement. Each active account matching the group criteria will receive this notification individually..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={broadcasting}
              className="w-full py-2 bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs rounded-[6px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              {broadcasting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching Broadcast...</span>
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5" />
                  <span>Send to All</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* SENT HISTORY TABLE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Recent Sent History (Last 50)
          </h2>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
          {historyLoading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">No sent notifications</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Notifications dispatched to candidates, employers, or team members will appear in this audit log.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Title & Message</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Read Status</th>
                    <th className="py-3 px-4">Dispatched At</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                  {history.map((n) => (
                    <tr key={n.id} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>{n.recipient_name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {n.recipient_email}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-bold text-slate-800">{n.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                          {n.message}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
                          {n.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 text-[11px] font-medium ${
                            n.read ? 'text-emerald-700' : 'text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              n.read ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          />
                          <span>{n.read ? 'Read' : 'Delivered'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(n.created_at).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setNotificationToDelete(n)}
                          className="inline-flex items-center space-x-1 h-7 px-2.5 text-xs font-semibold text-[#EF4444] border border-[#EF4444] rounded-[6px] hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete notification"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {notificationToDelete && (
        <DeleteConfirmationModal
          isOpen={true}
          tier="tier2"
          entityType="Notification"
          entityName={notificationToDelete.title}
          bodyText="This will permanently delete this notification from the history."
          onClose={() => setNotificationToDelete(null)}
          onConfirm={handleDeleteNotificationConfirm}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
