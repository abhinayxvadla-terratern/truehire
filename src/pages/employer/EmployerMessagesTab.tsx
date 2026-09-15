import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  Send,
  UserCheck,
  Briefcase,
  AlertCircle,
  Check,
  CheckCheck,
  RefreshCw,
  MessageSquare,
  Shield,
  X,
} from 'lucide-react';

interface EmployerMessagesTabProps {
  employer: any;
  onUnreadCountChange?: () => void;
}

interface MessageItem {
  id: string;
  employer_id: string;
  sender_profile_id: string;
  sender_type: 'employer' | 'rm';
  message: string;
  related_job_id: string | null;
  related_application_id: string | null;
  read: boolean;
  created_at: string;
}

interface AssignedRmInfo {
  id: string; // profile_id
  name: string;
  email: string;
}

export const EmployerMessagesTab: React.FC<EmployerMessagesTabProps> = ({
  employer,
  onUnreadCountChange,
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assignedRm, setAssignedRm] = useState<AssignedRmInfo | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Requirement & application context maps
  const [jobOptions, setJobOptions] = useState<{ id: string; title: string }[]>([]);
  const [jobMap, setJobMap] = useState<Map<string, string>>(new Map());
  const [applicationMap, setApplicationMap] = useState<
    Map<string, { jobTitle: string; candidateAnonId: string }>
  >(new Map());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Mark all unread messages from RM as read
  const markRmMessagesAsRead = async (empId: string) => {
    try {
      const { error } = await supabase
        .from('employer_rm_messages')
        .update({ read: true })
        .eq('employer_id', empId)
        .eq('sender_type', 'rm')
        .eq('read', false);

      if (!error && onUnreadCountChange) {
        onUnreadCountChange();
      }
    } catch (err) {
      console.error('Error marking messages as read:', err);
    }
  };

  const loadData = async () => {
    if (!employer?.id) return;

    try {
      setLoading(true);
      setErrorMsg(null);

      // 1. Fetch assigned Account Manager (RM)
      const { data: rmAss } = await supabase
        .from('rm_assignments')
        .select(`
          rm_profile_id,
          profiles:rm_profile_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('entity_type', 'employer')
        .eq('entity_id', employer.id)
        .eq('active', true)
        .maybeSingle();

      let rmData: AssignedRmInfo | null = null;
      if (rmAss?.profiles) {
        const p: any = rmAss.profiles;
        rmData = {
          id: p.id,
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email,
          email: p.email,
        };
        setAssignedRm(rmData);
      } else {
        setAssignedRm(null);
      }

      // 2. Fetch jobs for context dropdown and tag mapping
      const { data: jobs } = await supabase
        .from('job_requirements')
        .select('id, title')
        .eq('employer_id', employer.id)
        .order('created_at', { ascending: false });

      const jMap = new Map<string, string>();
      const jList: { id: string; title: string }[] = [];
      (jobs || []).forEach((j) => {
        jMap.set(j.id, j.title || 'Untitled Requirement');
        jList.push({ id: j.id, title: j.title || 'Untitled Requirement' });
      });
      setJobMap(jMap);
      setJobOptions(jList);

      // 3. Fetch applications for context mapping
      if (jList.length > 0) {
        const { data: apps } = await supabase
          .from('job_applications')
          .select('id, job_id, candidate_id')
          .in('job_id', jList.map((j) => j.id));

        const aMap = new Map<string, { jobTitle: string; candidateAnonId: string }>();
        (apps || []).forEach((app) => {
          const jTitle = jMap.get(app.job_id) || 'Requirement';
          const candAnon = `Candidate #${app.candidate_id.slice(0, 6).toUpperCase()}`;
          aMap.set(app.id, { jobTitle: jTitle, candidateAnonId: candAnon });
        });
        setApplicationMap(aMap);
      }

      // 4. Fetch all messages
      const { data: msgList, error: msgErr } = await supabase
        .from('employer_rm_messages')
        .select(`
          *,
          sender_profile:sender_profile_id (
            id,
            first_name,
            last_name,
            internal_role
          )
        `)
        .eq('employer_id', employer.id)
        .order('created_at', { ascending: true });

      if (msgErr) throw msgErr;

      setMessages((msgList as any[]) || []);

      // 5. Mark RM unread messages as read
      await markRmMessagesAsRead(employer.id);
    } catch (err: any) {
      console.error('Error loading messages tab:', err);
      setErrorMsg(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [employer?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time subscription for employer_rm_messages
  useEffect(() => {
    if (!employer?.id) return;

    const channel = supabase
      .channel(`employer_messages_${employer.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employer_rm_messages',
          filter: `employer_id=eq.${employer.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as MessageItem;
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            if (newMsg.sender_type === 'rm') {
              // Mark as read immediately since user is actively on this tab
              supabase
                .from('employer_rm_messages')
                .update({ read: true })
                .eq('id', newMsg.id)
                .then(() => {
                  if (onUnreadCountChange) onUnreadCountChange();
                });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MessageItem;
            setMessages((prev) =>
              prev.map((m) => (m.id === updated.id ? updated : m))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employer?.id]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !employer?.id || !profile?.id || isSending) return;

    const trimmed = inputMessage.trim();
    setIsSending(true);
    setErrorMsg(null);

    try {
      // 1. Insert message
      const { data: inserted, error: insertErr } = await supabase
        .from('employer_rm_messages')
        .insert({
          employer_id: employer.id,
          sender_profile_id: profile.id,
          sender_type: 'employer',
          message: trimmed,
          related_job_id: selectedJobId || null,
          read: false,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Optimistic append if not received through realtime yet
      if (inserted) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === inserted.id)) return prev;
          return [...prev, inserted as MessageItem];
        });
      }

      setInputMessage('');
      setSelectedJobId('');

      // 2. Insert notification for assigned RM
      if (assignedRm?.id) {
        const companyName = employer.company_name || 'Employer Facility';
        await supabase.from('notifications').insert({
          user_id: assignedRm.id,
          title: `Message from ${companyName}`,
          message: trimmed.length > 100 ? `${trimmed.slice(0, 100)}...` : trimmed,
          type: 'general',
          read: false,
          sent_by: profile.id,
        });
      }
    } catch (err: any) {
      console.error('Error sending message:', err);
      setErrorMsg(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const lastMessage = messages[messages.length - 1];
  const unreadFromRmCount = messages.filter((m) => m.sender_type === 'rm' && !m.read).length;

  const formatMessageTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-2xs overflow-hidden flex flex-col md:flex-row min-h-[640px] max-h-[780px]">
      {/* LEFT PANEL: 280px fixed */}
      <div className="w-full md:w-[280px] border-b md:border-b-0 md:border-r border-[#E2E8F4] bg-[#F8FAFD] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#E2E8F4] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-[#1B3270]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Messages
            </h3>
          </div>
          <button
            type="button"
            onClick={loadData}
            title="Refresh messages"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {!assignedRm ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-[8px] text-xs text-amber-800">
              <div className="flex items-center space-x-1.5 font-bold mb-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Account Manager</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-700">
                No account manager assigned yet. Messages will be available once your account manager is assigned by TerraTern.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-[8px] border border-[#1B3270]/20 bg-white shadow-2xs cursor-pointer transition-all hover:border-[#1B3270]">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-[#1B3270] text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {assignedRm.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {assignedRm.name}
                    </h4>
                    <span className="text-[10px] text-[#10B981] font-medium flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                      <span>Your Account Manager</span>
                    </span>
                  </div>
                </div>
                {unreadFromRmCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                    {unreadFromRmCount}
                  </span>
                )}
              </div>

              <div className="mt-2.5 pt-2 border-t border-[#E2E8F4] flex items-center justify-between text-[11px] text-slate-500">
                <p className="truncate max-w-[170px] text-slate-600">
                  {lastMessage
                    ? lastMessage.message.length > 40
                      ? `${lastMessage.message.slice(0, 40)}...`
                      : lastMessage.message
                    : 'Start a conversation...'}
                </p>
                {lastMessage && (
                  <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                    {formatMessageTime(lastMessage.created_at)}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="p-3 rounded-[8px] bg-slate-100/70 border border-slate-200/80 text-[11px] text-slate-500 space-y-1 mt-4">
            <div className="flex items-center space-x-1 text-slate-700 font-semibold">
              <Shield className="w-3.5 h-3.5 text-[#1B3270]" />
              <span>Direct Support</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Use this channel to discuss custom candidate requirements, interview arrangements, and post-placement onboarding.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Active Conversation */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-[#E2E8F4] bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-[#1B3270]/10 text-[#1B3270] flex items-center justify-center font-bold text-sm">
              {assignedRm ? assignedRm.name.charAt(0).toUpperCase() : <UserCheck className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900">
                  {assignedRm?.name || 'Account Manager'}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20">
                  Your Account Manager
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                <span>{assignedRm?.email || 'placements@terratern.com'}</span>
                <span>•</span>
                <span>TerraTern Placement Operations</span>
              </div>
            </div>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-[#F8FAFD]/40">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin mx-auto"></div>
              <span className="text-xs text-slate-400">Loading conversation thread...</span>
            </div>
          ) : !assignedRm ? (
            <div className="py-20 text-center max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-3">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                No Account Manager Assigned
              </h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Your company profile is being reviewed by the TerraTern team. Once assigned, you will be able to message your dedicated Account Manager directly from here.
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-20 text-center max-w-sm mx-auto">
              <div className="w-12 h-12 rounded-full bg-[#1B3270]/5 border border-[#1B3270]/15 flex items-center justify-center text-[#1B3270] mx-auto mb-3">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                Direct Line with {assignedRm.name}
              </h4>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Send a message below to inquire about candidates, adjust requirement criteria, or coordinate interviews with your account manager.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isEmployer = msg.sender_type === 'employer';
                const relatedJobTitle = msg.related_job_id ? jobMap.get(msg.related_job_id) : null;
                const relatedApp = msg.related_application_id
                  ? applicationMap.get(msg.related_application_id)
                  : null;

                const isPlacementLead = (msg as any).sender_profile?.internal_role === 'placement_lead';
                const senderName = isEmployer
                  ? 'You'
                  : isPlacementLead
                  ? (msg as any).sender_profile?.first_name
                    ? `${(msg as any).sender_profile.first_name} (Placement Lead)`
                    : 'Placement Lead'
                  : assignedRm?.name || 'Account Manager';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isEmployer ? 'items-end' : 'items-start'}`}
                  >
                    {/* Sender label & time */}
                    <div className="flex items-center space-x-1.5 mb-1 px-1 text-[10px] text-slate-400">
                      <span className={`font-semibold ${isPlacementLead ? 'text-purple-700' : 'text-slate-600'}`}>
                        {senderName}
                      </span>
                      {isPlacementLead && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-purple-100 text-purple-800">
                          Placement Lead
                        </span>
                      )}
                      <span>•</span>
                      <span>{formatMessageTime(msg.created_at)}</span>
                    </div>

                    {/* Context tag if related to requirement or application */}
                    {(relatedJobTitle || relatedApp) && (
                      <div
                        className={`mb-1 px-2.5 py-0.5 rounded text-[10px] font-semibold flex items-center space-x-1 ${
                          isEmployer
                            ? 'bg-[#1B3270]/10 text-[#1B3270]'
                            : isPlacementLead
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        <Briefcase className="w-3 h-3" />
                        <span>
                          {relatedApp
                            ? `Re: ${relatedApp.jobTitle} — ${relatedApp.candidateAnonId}`
                            : `Re: ${relatedJobTitle}`}
                        </span>
                      </div>
                    )}

                    {/* Bubble */}
                    <div
                      className={`max-w-[78%] rounded-[12px] px-4 py-3 text-xs leading-relaxed break-words shadow-2xs ${
                        isEmployer
                          ? 'bg-[#1B3270] text-white rounded-tr-none'
                          : isPlacementLead
                          ? 'bg-purple-50/90 border border-purple-200 text-purple-950 rounded-tl-none'
                          : 'bg-white border border-[#E2E8F4] text-slate-800 rounded-tl-none'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.message}</p>
                    </div>

                    {/* Read indicator for employer messages */}
                    {isEmployer && (
                      <div className="flex items-center space-x-1 mt-0.5 px-1 text-[10px] text-slate-400">
                        {msg.read ? (
                          <span className="flex items-center text-[#10B981] space-x-0.5">
                            <CheckCheck className="w-3 h-3" />
                            <span>Read</span>
                          </span>
                        ) : (
                          <span className="flex items-center text-slate-400 space-x-0.5">
                            <Check className="w-3 h-3" />
                            <span>Sent</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Compose Bar */}
        {assignedRm && (
          <div className="p-4 border-t border-[#E2E8F4] bg-white shrink-0">
            {errorMsg && (
              <div className="mb-2 p-2 bg-rose-50 border border-rose-200 rounded text-rose-700 text-xs flex items-center justify-between">
                <span>{errorMsg}</span>
                <button
                  type="button"
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-500 font-bold ml-2 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Optional Context Selector: Related to a requirement? */}
            {jobOptions.length > 0 && (
              <div className="mb-2.5 flex items-center space-x-2 text-xs">
                <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                  Related to requirement (optional)
                </span>
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="py-1 px-2.5 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs text-slate-700 focus:outline-hidden focus:border-[#1B3270]"
                >
                  <option value="">None (General Inquiry)</option>
                  {jobOptions.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Input Row */}
            <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a message to your account manager... (Press Enter to send, Shift+Enter for new line)"
                  rows={2}
                  className="w-full p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#1B3270] focus:bg-white resize-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={!inputMessage.trim() || isSending}
                className="px-4 py-3 bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-40 disabled:hover:bg-[#1B3270] text-white rounded-[8px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors flex items-center space-x-1.5 h-[54px]"
              >
                <Send className="w-4 h-4" />
                <span>{isSending ? 'Sending...' : 'Send'}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
