import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  MessageSquare,
  Search,
  Clock,
  Loader2,
  RefreshCw,
  Send,
  Briefcase,
  User,
} from 'lucide-react';

interface EmployerThreadSummary {
  employer_id: string;
  company_name: string;
  message_count: number;
  last_message_at: string;
  last_message_text: string;
}

interface MessageItem {
  id: string;
  employer_id: string;
  sender_type: 'employer' | 'rm' | 'placement_lead' | 'super_admin' | string;
  sender_display_name: string | null;
  message: string;
  created_at: string;
  read: boolean;
  related_job_id?: string | null;
  related_application_id?: string | null;
}

interface JobRequirementOption {
  id: string;
  title: string;
}

interface PipelineCandidateOption {
  application_id: string;
  candidate_id: string;
  candidate_name: string;
  job_title: string;
}

export const MessagesAuditTab: React.FC = () => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<EmployerThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);

  // Messages in active thread
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Compose State
  const [composeText, setComposeText] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [sending, setSending] = useState(false);

  // Context Options
  const [jobOptions, setJobOptions] = useState<JobRequirementOption[]>([]);
  const [candidateOptions, setCandidateOptions] = useState<PipelineCandidateOption[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchThreads = async () => {
    try {
      setLoadingThreads(true);
      const { data: allMessages, error } = await supabase
        .from('employer_rm_messages')
        .select(`
          id,
          employer_id,
          message,
          created_at,
          employers:employer_id (id, company_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const threadMap: Record<string, EmployerThreadSummary> = {};

      (allMessages || []).forEach((m: any) => {
        const empId = m.employer_id;
        if (!empId) return;

        const compName = m.employers?.company_name || 'Hospital Client';

        if (!threadMap[empId]) {
          threadMap[empId] = {
            employer_id: empId,
            company_name: compName,
            message_count: 1,
            last_message_at: m.created_at,
            last_message_text: m.message,
          };
        } else {
          threadMap[empId].message_count += 1;
        }
      });

      const list = Object.values(threadMap);
      setThreads(list);

      if (!selectedEmployerId && list.length > 0) {
        setSelectedEmployerId(list[0].employer_id);
      }
    } catch (err) {
      console.error('Error fetching message audit threads:', err);
    } finally {
      setLoadingThreads(false);
      setRefreshing(false);
    }
  };

  const fetchMessagesForEmployer = async (employerId: string) => {
    try {
      setLoadingMessages(true);
      const { data, error } = await supabase
        .from('employer_rm_messages')
        .select(`
          id,
          employer_id,
          sender_type,
          sender_display_name,
          message,
          created_at,
          read,
          related_job_id,
          related_application_id
        `)
        .eq('employer_id', employerId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages((data as MessageItem[]) || []);
      setTimeout(scrollToBottom, 100);
    } catch (err) {
      console.error('Error fetching messages for employer:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Fetch contextual jobs & pipeline candidates for selected employer
  const fetchContextOptions = async (employerId: string) => {
    try {
      // 1. Fetch requirements
      const { data: jobs } = await supabase
        .from('job_requirements')
        .select('id, title')
        .eq('employer_id', employerId)
        .order('created_at', { ascending: false });

      setJobOptions(jobs || []);

      // 2. Fetch candidates from job_applications
      const { data: apps } = await supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          candidates (first_name, last_name),
          job_requirements (title)
        `)
        .eq('job_requirements.employer_id', employerId)
        .order('created_at', { ascending: false })
        .limit(30);

      const mappedCandidates: PipelineCandidateOption[] = (apps || [])
        .filter((a: any) => a.candidates)
        .map((a: any) => ({
          application_id: a.id,
          candidate_id: a.candidate_id,
          candidate_name: `${a.candidates.first_name || ''} ${a.candidates.last_name || ''}`.trim() || 'Candidate',
          job_title: a.job_requirements?.title || 'Job Opening',
        }));

      setCandidateOptions(mappedCandidates);
    } catch (err) {
      console.error('Error fetching contextual dropdown options:', err);
    }
  };

  useEffect(() => {
    fetchThreads();
  }, []);

  useEffect(() => {
    if (selectedEmployerId) {
      fetchMessagesForEmployer(selectedEmployerId);
      fetchContextOptions(selectedEmployerId);
      setSelectedJobId('');
      setSelectedAppId('');
    }
  }, [selectedEmployerId]);

  const activeThread = threads.find((t) => t.employer_id === selectedEmployerId);

  // Send message as Super Admin
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeText.trim() || !selectedEmployerId || !user) return;

    setSending(true);
    try {
      // 1. Get sender display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      const fullName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
        : 'Super Admin';
      const senderDisplayName = `${fullName} — TerraTern Admin`;

      const messageText = composeText.trim();
      const preview100 = messageText.length > 100 ? `${messageText.slice(0, 97)}...` : messageText;

      // 2. INSERT employer_rm_messages
      const { data: insertedMsg, error: insertErr } = await supabase
        .from('employer_rm_messages')
        .insert({
          employer_id: selectedEmployerId,
          sender_profile_id: user.id,
          sender_type: 'super_admin',
          sender_display_name: senderDisplayName,
          message: messageText,
          related_job_id: selectedJobId || null,
          related_application_id: selectedAppId || null,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Optimistically append message
      if (insertedMsg) {
        setMessages((prev) => [...prev, insertedMsg]);
      }
      setComposeText('');
      setSelectedJobId('');
      setSelectedAppId('');
      setTimeout(scrollToBottom, 100);

      // 3. Notifications
      // A. Employer team members
      const { data: employerTeam } = await supabase
        .from('employer_team_members')
        .select('profile_id')
        .eq('employer_id', selectedEmployerId);

      const { data: employerRow } = await supabase
        .from('employers')
        .select('user_id, company_name')
        .eq('id', selectedEmployerId)
        .single();

      const employerUserIds = new Set<string>();
      if (employerRow?.user_id) employerUserIds.add(employerRow.user_id);
      (employerTeam || []).forEach((m) => {
        if (m.profile_id) employerUserIds.add(m.profile_id);
      });

      const employerNotifications = Array.from(employerUserIds).map((uid) => ({
        user_id: uid,
        title: 'Message from TerraTern',
        message: preview100,
        type: 'general',
        link: '/employer?tab=messages',
      }));

      // B. Assigned RM
      const { data: rmAssign } = await supabase
        .from('rm_assignments')
        .select('rm_profile_id')
        .eq('entity_type', 'employer')
        .eq('entity_id', selectedEmployerId)
        .eq('active', true)
        .maybeSingle();

      const companyName = employerRow?.company_name || activeThread?.company_name || 'Employer';
      const rmNotice = rmAssign?.rm_profile_id
        ? [
            {
              user_id: rmAssign.rm_profile_id,
              title: `TerraTern Admin messaged ${companyName}`,
              message: `${preview100}. Please review.`,
              type: 'general',
              link: '/placement/employer-rm?tab=messages',
            },
          ]
        : [];

      // C. All placement leads
      const { data: plProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_internal', true)
        .eq('internal_role', 'placement_lead');

      const plNotices = (plProfiles || []).map((pl) => ({
        user_id: pl.id,
        title: `TerraTern Admin messaged ${companyName}`,
        message: `${preview100}. Please review.`,
        type: 'general',
        link: '/placement/lead?tab=employer_pipeline',
      }));

      const allNotices = [...employerNotifications, ...rmNotice, ...plNotices];
      if (allNotices.length > 0) {
        await supabase.from('notifications').insert(allNotices);
      }
    } catch (err: any) {
      console.error('Error sending super admin message:', err);
      alert(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (searchQuery.trim()) {
        return t.company_name.toLowerCase().includes(searchQuery.toLowerCase().trim());
      }
      return true;
    });
  }, [threads, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">Messages Audit</h1>
          <p className="text-sm text-slate-500 mt-1">
            Complete oversight and administrative messaging with employer-facing accounts and relationship managers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchThreads();
            if (selectedEmployerId) fetchMessagesForEmployer(selectedEmployerId);
          }}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2-PANEL AUDIT & MESSAGING INTERFACE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden flex flex-col md:flex-row min-h-[640px]">
        {/* LEFT PANEL: EMPLOYER LIST (260px) */}
        <div className="w-full md:w-[260px] border-r border-[#E2E8F4] flex flex-col bg-slate-50/50">
          <div className="p-3.5 border-b border-[#E2E8F4] bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search employers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#E2E8F4]">
            {loadingThreads ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 text-[#1B3270] animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading threads...</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">No message threads</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No communications recorded yet.</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isSelected = thread.employer_id === selectedEmployerId;
                return (
                  <button
                    key={thread.employer_id}
                    type="button"
                    onClick={() => setSelectedEmployerId(thread.employer_id)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer block ${
                      isSelected
                        ? 'bg-white border-l-4 border-l-[#1B3270] shadow-2xs'
                        : 'hover:bg-slate-100/70 border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 truncate">
                        {thread.company_name}
                      </h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-bold">
                        {thread.message_count}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-1">
                      {thread.last_message_text}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {new Date(thread.last_message_at).toLocaleDateString()}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANEL: THREAD VIEW & COMPOSE BAR */}
        <div className="flex-1 flex flex-col bg-white">
          {/* THREAD TOPBAR */}
          <div className="px-5 py-3 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#1B3270]">
                {activeThread ? activeThread.company_name : 'Select Thread'}
              </span>
              <p className="text-[11px] text-slate-500">
                Direct administrative oversight & intervention channel
              </p>
            </div>
            {activeThread && (
              <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-200/70 rounded text-slate-700">
                ID: {activeThread.employer_id.slice(0, 8)}...
              </span>
            )}
          </div>

          {/* MESSAGE FEED */}
          <div className="flex-1 p-6 overflow-y-auto space-y-4 max-h-[500px]">
            {loadingMessages ? (
              <div className="py-24 text-center">
                <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-400">Loading conversation thread...</p>
              </div>
            ) : !selectedEmployerId ? (
              <div className="py-24 text-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Select an employer thread</p>
                <p className="text-xs text-slate-400 mt-1">
                  Choose a company from the left sidebar to audit or send communications.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="py-24 text-center">
                <MessageSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No messages in thread</p>
                <p className="text-xs text-slate-400 mt-1">
                  Start the administrative conversation using the compose bar below.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isEmployer = m.sender_type === 'employer';
                const isPlacementLead = m.sender_type === 'placement_lead';
                const isSuperAdmin = m.sender_type === 'super_admin';

                const defaultSenderLabel = isEmployer
                  ? 'Employer Contact'
                  : isPlacementLead
                  ? 'Placement Lead'
                  : isSuperAdmin
                  ? 'TerraTern Admin'
                  : 'Relationship Manager';

                const displayName = m.sender_display_name || defaultSenderLabel;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isEmployer ? 'items-start' : 'items-end'}`}
                  >
                    {/* SENDER SIGNATURE */}
                    <span className="text-xs font-semibold text-slate-500 mb-1 px-1">
                      {displayName}
                    </span>

                    {/* MESSAGE BUBBLE - EXACT COLOR SPECIFICATION */}
                    <div
                      className={`max-w-md p-3.5 rounded-[12px] text-xs leading-relaxed shadow-2xs ${
                        isEmployer
                          ? 'bg-[#F9FAFB] text-slate-800 rounded-tl-xs border border-slate-200'
                          : isPlacementLead
                          ? 'bg-[#F3E8FF] text-purple-950 border border-purple-200 rounded-tr-xs'
                          : isSuperAdmin
                          ? 'bg-[#F3F4F6] text-slate-900 border border-slate-200 rounded-tr-xs'
                          : 'bg-[#1B3270] text-white rounded-tr-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.message}</p>
                    </div>

                    {/* TIMESTAMP */}
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {new Date(m.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      • {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* COMPOSE BAR (SUPER ADMIN ACTIVE) */}
          {selectedEmployerId && (
            <div className="p-4 border-t border-[#E2E8F4] bg-[#F8FAFD] space-y-3">
              {/* Optional Context Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Related to requirement? */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5 flex items-center space-x-1">
                    <Briefcase className="w-3 h-3 text-slate-400" />
                    <span>Related to requirement?</span>
                  </label>
                  <select
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs bg-white text-slate-700 outline-none focus:ring-1 focus:ring-[#1B3270] cursor-pointer"
                  >
                    <option value="">No requirement selected</option>
                    {jobOptions.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Related to candidate? */}
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-0.5 flex items-center space-x-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>Related to candidate?</span>
                  </label>
                  <select
                    value={selectedAppId}
                    onChange={(e) => setSelectedAppId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs bg-white text-slate-700 outline-none focus:ring-1 focus:ring-[#1B3270] cursor-pointer"
                  >
                    <option value="">No candidate selected</option>
                    {candidateOptions.map((cand) => (
                      <option key={cand.application_id} value={cand.application_id}>
                        {cand.candidate_name} ({cand.job_title})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Message Textarea & Send Button */}
              <form onSubmit={handleSendMessage} className="space-y-2">
                <textarea
                  rows={3}
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  placeholder="Write a message..."
                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs outline-none focus:ring-1 focus:ring-[#1B3270] bg-white resize-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    Sending as <strong>Super Admin</strong>. Notifications will be dispatched to employer, RM, and placement leads.
                  </span>
                  <button
                    type="submit"
                    disabled={!composeText.trim() || sending}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Message</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesAuditTab;
