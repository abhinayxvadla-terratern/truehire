import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Building2,
  Briefcase,
  Layers,
  Clock,
  Lock,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Send,
  Check,
  X,
  MessageSquare,
} from 'lucide-react';
import { formatDate } from '../../../../utils/formatters';

interface EmployerRmOverviewTabProps {
  onNavigateTab: (tabId: string, filterParam?: string) => void;
}

interface ActionQueueItem {
  id: string;
  type: 'offer_sent_aging' | 'cap_reached' | 'talent_available';
  title: string;
  detail: string;
  daysAgo?: number;
  employerId?: string;
  employerUserId?: string | null;
  jobId?: string;
  applicationId?: string;
}

export const EmployerRmOverviewTab: React.FC<EmployerRmOverviewTabProps> = ({
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 5 Stats
  const [myEmployersCount, setMyEmployersCount] = useState(0);
  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [applicationsTotalCount, setApplicationsTotalCount] = useState(0);
  const [offerSentCount, setOfferSentCount] = useState(0);
  const [revealGateCount, setRevealGateCount] = useState(0);

  // Pipeline Status Flow Counts
  const [flowCounts, setFlowCounts] = useState<{
    applied: number;
    shortlisted: number;
    interview_scheduled: number;
    interviewed: number;
    selected: number;
    offer_sent: number;
    reveal_gate: number;
  }>({
    applied: 0,
    shortlisted: 0,
    interview_scheduled: 0,
    interviewed: 0,
    selected: 0,
    offer_sent: 0,
    reveal_gate: 0,
  });

  // Action Queue
  const [actionQueue, setActionQueue] = useState<ActionQueueItem[]>([]);

  // Pending Interest Facilitation State
  const [pendingInterests, setPendingInterests] = useState<any[]>([]);
  const [facilitatingInterest, setFacilitatingInterest] = useState<any | null>(null);
  const [employerActiveJobs, setEmployerActiveJobs] = useState<any[]>([]);
  const [loadingEmployerJobs, setLoadingEmployerJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [calculatingFitScore, setCalculatingFitScore] = useState(false);
  const [calculatedFitScore, setCalculatedFitScore] = useState<number | null>(null);
  const [isSubmittingFacilitation, setIsSubmittingFacilitation] = useState(false);
  const [facilitationError, setFacilitationError] = useState<string | null>(null);

  // Employer Messages State
  const [unreadMessages, setUnreadMessages] = useState<any[]>([]);
  const [activeChatEmployer, setActiveChatEmployer] = useState<{
    id: string;
    company_name: string;
    user_id?: string | null;
  } | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatReplyText, setChatReplyText] = useState('');
  const [chatSelectedJobId, setChatSelectedJobId] = useState('');
  const [chatSelectedAppId, setChatSelectedAppId] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [chatEmployerJobs, setChatEmployerJobs] = useState<{ id: string; title: string }[]>([]);
  const [chatEmployerApps, setChatEmployerApps] = useState<{ id: string; label: string }[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchOverviewData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch assigned employers
      const { data: assignments, error: assErr } = await supabase
        .from('rm_assignments')
        .select(`
          entity_id,
          employers:entity_id (id, company_name, user_id)
        `)
        .eq('rm_profile_id', user.id)
        .eq('entity_type', 'employer')
        .eq('active', true);

      if (assErr) throw assErr;

      const empList = (assignments || []).map((a: any) => a.employers).filter(Boolean);
      const employerIds = empList.map((e: any) => e.id);
      setMyEmployersCount(employerIds.length);

      if (employerIds.length === 0) {
        setActiveJobsCount(0);
        setApplicationsTotalCount(0);
        setOfferSentCount(0);
        setRevealGateCount(0);
        setActionQueue([]);
        setPendingInterests([]);
        setUnreadMessages([]);
        return;
      }

      // 1b. Fetch pending interest expressions for these employers
      const { data: interests, error: intErr } = await supabase
        .from('employer_candidate_interests')
        .select(`
          id,
          employer_id,
          candidate_id,
          status,
          created_at,
          employers:employer_id (id, company_name, user_id),
          candidates:candidate_id (
            id,
            target_role,
            language_level_self_reported,
            total_years_experience,
            supplier_id,
            user_id
          )
        `)
        .eq('status', 'pending_facilitation')
        .in('employer_id', employerIds)
        .order('created_at', { ascending: false });

      if (!intErr && interests) {
        setPendingInterests(interests);
      } else {
        setPendingInterests([]);
      }

      // 1c. Fetch unread messages from my employers
      const { data: unreadMsgData } = await supabase
        .from('employer_rm_messages')
        .select(`
          id,
          employer_id,
          sender_profile_id,
          sender_type,
          message,
          related_job_id,
          related_application_id,
          read,
          created_at,
          employers:employer_id (id, company_name, user_id)
        `)
        .in('employer_id', employerIds)
        .eq('sender_type', 'employer')
        .eq('read', false)
        .order('created_at', { ascending: false });

      setUnreadMessages(unreadMsgData || []);

      // 2. Fetch jobs from my employers
      const { data: jobs, error: jobsErr } = await supabase
        .from('job_requirements')
        .select('*')
        .in('employer_id', employerIds);

      if (jobsErr) throw jobsErr;
      const jobList = jobs || [];

      const activeJobs = jobList.filter((j) => j.status === 'active');
      setActiveJobsCount(activeJobs.length);
      const jobIds = jobList.map((j) => j.id);

      // 3. Fetch applications for these jobs
      let appList: any[] = [];
      if (jobIds.length > 0) {
        const { data: apps, error: appsErr } = await supabase
          .from('job_applications')
          .select(`
            id,
            candidate_id,
            job_id,
            status,
            updated_at,
            job_requirements:job_id (title, employer_id)
          `)
          .in('job_id', jobIds);

        if (appsErr) throw appsErr;
        appList = apps || [];
      }

      const activeApps = appList.filter(
        (a) => !['placed', 'rejected'].includes(a.status)
      );
      setApplicationsTotalCount(activeApps.length);

      const osCount = appList.filter((a) => a.status === 'offer_sent').length;
      const rgCount = appList.filter((a) => a.status === 'reveal_gate').length;
      setOfferSentCount(osCount);
      setRevealGateCount(rgCount);

      // Status flow counts
      setFlowCounts({
        applied: appList.filter((a) => a.status === 'applied').length,
        shortlisted: appList.filter((a) => a.status === 'shortlisted').length,
        interview_scheduled: appList.filter((a) => a.status === 'interview_scheduled').length,
        interviewed: appList.filter((a) => a.status === 'interviewed').length,
        selected: appList.filter((a) => a.status === 'selected').length,
        offer_sent: osCount,
        reveal_gate: rgCount,
      });

      // 4. Build Today's Actions:
      const actions: ActionQueueItem[] = [];

      // ITEM TYPE 1: Applications at 'offer_sent' for > 2 days
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).getTime();
      appList.forEach((app) => {
        if (app.status === 'offer_sent') {
          const updatedTime = new Date(app.updated_at || Date.now()).getTime();
          if (updatedTime < twoDaysAgo) {
            const daysDiff = Math.floor((Date.now() - updatedTime) / (1000 * 60 * 60 * 24));
            actions.push({
              id: `offer-aging-${app.id}`,
              type: 'offer_sent_aging',
              title: `Candidate #${app.candidate_id.slice(0, 6).toUpperCase()} — ${
                app.job_requirements?.title || 'Position'
              }`,
              detail: `Offer sent ${daysDiff} days ago — Begin Reveal Process`,
              daysAgo: daysDiff,
              applicationId: app.id,
            });
          }
        }
      });

      // ITEM TYPE 2: Jobs at submission cap
      activeJobs.forEach((j) => {
        if (j.current_submissions >= j.submission_cap) {
          const emp = empList.find((e: any) => e.id === j.employer_id);
          actions.push({
            id: `cap-reached-${j.id}`,
            type: 'cap_reached',
            title: `${j.title} — Submission cap reached`,
            detail: `Reached ${j.current_submissions}/${j.submission_cap} candidates — Notify employer to review`,
            employerId: j.employer_id,
            employerUserId: emp?.user_id || null,
            jobId: j.id,
          });
        }
      });

      // ITEM TYPE 3: New Interview Ready candidates available in talent pool without application to my employers
      const { data: irCandidates } = await supabase
        .from('candidates')
        .select('id')
        .eq('status', 'interview_ready');

      const allAppliedCandIds = appList.map((a) => a.candidate_id);
      const unappliedIrCount = (irCandidates || []).filter(
        (c) => !allAppliedCandIds.includes(c.id)
      ).length;

      if (unappliedIrCount > 0) {
        actions.push({
          id: 'talent-available',
          type: 'talent_available',
          title: `${unappliedIrCount} new Interview Ready candidates available in the Talent Pool`,
          detail: 'Vetted international candidates meet German B2 requirements and are ready for direct hospital selection.',
        });
      }

      setActionQueue(actions);
    } catch (err) {
      console.error('Error loading Employer RM overview:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, [user]);

  const handleNotifyEmployer = async (item: ActionQueueItem) => {
    if (!user) return;

    if (!item.employerUserId) {
      alert(
        'Cannot dispatch notification: Employer facility account has not yet registered an authentication profile.'
      );
      return;
    }

    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: item.employerUserId,
        title: 'Job Requirement Submission Cap Reached',
        message: `${item.title}. Review shortlisted candidates in your Employer Portal or request an increased submission cap.`,
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      if (error) throw error;

      showToast('Hospital employer notified successfully.');
    } catch (err: any) {
      alert(`Failed to notify employer: ${err.message}`);
    }
  };

  const handleOpenFacilitation = async (interest: any) => {
    setFacilitatingInterest(interest);
    setSelectedJobId('');
    setCalculatedFitScore(null);
    setFacilitationError(null);
    setLoadingEmployerJobs(true);

    try {
      const { data: jobs, error } = await supabase
        .from('job_requirements')
        .select('*')
        .eq('employer_id', interest.employer_id)
        .eq('status', 'active')
        .order('title');

      if (error) throw error;
      setEmployerActiveJobs(jobs || []);
    } catch (err: any) {
      console.error('Error loading employer jobs for facilitation:', err);
      setFacilitationError('Could not load active requirements for this employer.');
    } finally {
      setLoadingEmployerJobs(false);
    }
  };

  const handleJobSelectionChange = async (jobId: string) => {
    setSelectedJobId(jobId);
    setCalculatedFitScore(null);
    setFacilitationError(null);

    if (!jobId || !facilitatingInterest) return;

    setCalculatingFitScore(true);
    try {
      const { data: score, error: rpcErr } = await supabase.rpc('compute_fit_score', {
        p_candidate_id: facilitatingInterest.candidate_id,
        p_job_id: jobId,
      });

      if (rpcErr) {
        console.error('Error computing fit score:', rpcErr);
      } else {
        setCalculatedFitScore(typeof score === 'number' ? Math.round(score) : Number(score) || 0);
      }
    } catch (err) {
      console.error('Fit score error:', err);
    } finally {
      setCalculatingFitScore(false);
    }
  };

  const handleConfirmFacilitation = async () => {
    if (!facilitatingInterest || !selectedJobId || !user) return;
    const targetJob = employerActiveJobs.find((j) => j.id === selectedJobId);
    if (!targetJob) return;

    if ((targetJob.current_submissions || 0) >= (targetJob.submission_cap || 10)) {
      setFacilitationError('This requirement has reached its submission cap.');
      return;
    }

    try {
      setIsSubmittingFacilitation(true);
      setFacilitationError(null);

      // 1. Insert into job_applications
      const { data: newApp, error: appErr } = await supabase
        .from('job_applications')
        .insert({
          candidate_id: facilitatingInterest.candidate_id,
          job_id: targetJob.id,
          supplier_id: facilitatingInterest.candidates?.supplier_id || null,
          submitted_by: 'employer',
          status: 'applied',
          fit_score: calculatedFitScore ?? 0,
        })
        .select('id')
        .single();

      if (appErr) throw appErr;

      // 2. Increment job_requirements.current_submissions
      const { error: incErr } = await supabase
        .from('job_requirements')
        .update({
          current_submissions: (targetJob.current_submissions || 0) + 1,
        })
        .eq('id', targetJob.id);

      if (incErr) console.warn('Could not increment submissions count:', incErr);

      // 3. Update employer_candidate_interests
      const { error: intUpdateErr } = await supabase
        .from('employer_candidate_interests')
        .update({
          status: 'in_pipeline',
          facilitating_rm: user.id,
          linked_application_id: newApp.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', facilitatingInterest.id);

      if (intUpdateErr) throw intUpdateErr;

      // 4. Notify employer & all employer team members
      const employerRecipients = new Set<string>();
      const empUserId = facilitatingInterest.employers?.user_id;
      if (empUserId) employerRecipients.add(empUserId);

      const { data: teamMembers } = await supabase
        .from('employer_team_members')
        .select('profile_id')
        .eq('employer_id', facilitatingInterest.employer_id)
        .eq('invite_status', 'accepted');

      (teamMembers || []).forEach((tm) => {
        if (tm.profile_id) employerRecipients.add(tm.profile_id);
      });

      const anonCandId = `Candidate #${facilitatingInterest.candidate_id.slice(0, 6).toUpperCase()}`;
      if (employerRecipients.size > 0) {
        const notifs = Array.from(employerRecipients).map((uId) => ({
          user_id: uId,
          type: 'general',
          title: 'Candidate Added to Pipeline',
          message: `${anonCandId} has been added to your Candidate Pipeline for ${targetJob.title}.`,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifs);
      }

      // 5. Notify candidate (if user_id present)
      const candUserId = facilitatingInterest.candidates?.user_id;
      if (candUserId) {
        await supabase.from('notifications').insert({
          user_id: candUserId,
          type: 'general',
          title: 'New Job Application Facilitated',
          message: `You have been submitted for ${targetJob.title} at ${
            facilitatingInterest.employers?.company_name || 'an employer partner'
          }.`,
          sent_by: user.id,
        });
      }

      // 6. Close modal & show toast & refresh
      setFacilitatingInterest(null);
      showToast(`${anonCandId} facilitated into pipeline for ${targetJob.title}.`);
      await fetchOverviewData();
    } catch (err: any) {
      console.error('Error facilitating interest:', err);
      setFacilitationError(err.message || 'Failed to facilitate candidate into pipeline.');
    } finally {
      setIsSubmittingFacilitation(false);
    }
  };

  const handleOpenChat = async (employerData: {
    id: string;
    company_name: string;
    user_id?: string | null;
  }) => {
    setActiveChatEmployer(employerData);
    setLoadingChat(true);
    setChatReplyText('');
    setChatSelectedJobId('');
    setChatSelectedAppId('');

    try {
      // 1. Fetch messages for this employer
      const { data: msgs } = await supabase
        .from('employer_rm_messages')
        .select('*')
        .eq('employer_id', employerData.id)
        .order('created_at', { ascending: true });

      setChatMessages(msgs || []);

      // 2. Mark employer messages as read
      await supabase
        .from('employer_rm_messages')
        .update({ read: true })
        .eq('employer_id', employerData.id)
        .eq('sender_type', 'employer')
        .eq('read', false);

      // Re-filter unread messages locally
      setUnreadMessages((prev) => prev.filter((m) => m.employer_id !== employerData.id));

      // 3. Fetch jobs for context
      const { data: empJobs } = await supabase
        .from('job_requirements')
        .select('id, title')
        .eq('employer_id', employerData.id)
        .order('created_at', { ascending: false });

      setChatEmployerJobs(empJobs || []);

      // 4. Fetch pipeline applications for context
      if (empJobs && empJobs.length > 0) {
        const jobIds = empJobs.map((j) => j.id);
        const { data: empApps } = await supabase
          .from('job_applications')
          .select(`
            id,
            job_id,
            candidate_id,
            job_requirements:job_id (title)
          `)
          .in('job_id', jobIds)
          .neq('status', 'rejected');

        const appOptions = (empApps || []).map((app: any) => {
          const jTitle = app.job_requirements?.title || 'Requirement';
          const anonId = `Candidate #${app.candidate_id.slice(0, 6).toUpperCase()}`;
          return {
            id: app.id,
            label: `${anonId} (${jTitle})`,
          };
        });
        setChatEmployerApps(appOptions);
      } else {
        setChatEmployerApps([]);
      }
    } catch (err) {
      console.error('Error opening chat with employer:', err);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleSendChatReply = async () => {
    if (!chatReplyText.trim() || !activeChatEmployer || !user || isSendingReply) return;

    const trimmed = chatReplyText.trim();
    setIsSendingReply(true);

    try {
      // Get RM display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      const rmName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
        : 'Relationship Manager';
      const displayName = `${rmName} — Account Manager`;

      // 1. Insert message
      const { data: newMsg, error: sendErr } = await supabase
        .from('employer_rm_messages')
        .insert({
          employer_id: activeChatEmployer.id,
          sender_profile_id: user.id,
          sender_type: 'rm',
          sender_display_name: displayName,
          message: trimmed,
          related_job_id: chatSelectedJobId || null,
          related_application_id: chatSelectedAppId || null,
          read: false,
        })
        .select()
        .single();

      if (sendErr) throw sendErr;

      if (newMsg) {
        setChatMessages((prev) => [...prev, newMsg]);
      }

      setChatReplyText('');
      setChatSelectedJobId('');
      setChatSelectedAppId('');

      // 2. Notify all active team members + employer user_id
      const { data: teamMembers } = await supabase
        .from('employer_team_members')
        .select('profile_id, email')
        .eq('employer_id', activeChatEmployer.id)
        .eq('invite_status', 'accepted');

      const recipientProfileIds = new Set<string>();
      (teamMembers || []).forEach((tm) => {
        if (tm.profile_id) recipientProfileIds.add(tm.profile_id);
      });

      if (activeChatEmployer.user_id) {
        recipientProfileIds.add(activeChatEmployer.user_id);
      }

      if (recipientProfileIds.size > 0) {
        const notifications = Array.from(recipientProfileIds).map((pId) => ({
          user_id: pId,
          title: 'Message from Your Account Manager',
          message: trimmed.length > 100 ? `${trimmed.slice(0, 100)}...` : trimmed,
          type: 'general',
          read: false,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifications);
      }

      showToast('Reply sent to employer');
    } catch (err: any) {
      console.error('Error sending reply:', err);
      showToast(err.message || 'Failed to send reply');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Real-time listener for active chat modal
  useEffect(() => {
    if (!activeChatEmployer?.id) return;

    const channel = supabase
      .channel(`rm_chat_${activeChatEmployer.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employer_rm_messages',
          filter: `employer_id=eq.${activeChatEmployer.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any;
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            if (newMsg.sender_type === 'employer') {
              supabase
                .from('employer_rm_messages')
                .update({ read: true })
                .eq('id', newMsg.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeChatEmployer?.id]);

  const statCards = [
    {
      title: 'My Employers',
      count: myEmployersCount,
      icon: Building2,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      tab: 'my_employers',
    },
    {
      title: 'Active Jobs',
      count: activeJobsCount,
      icon: Briefcase,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tab: 'jobs',
    },
    {
      title: 'Applications Total',
      count: applicationsTotalCount,
      icon: Layers,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      tab: 'pipeline',
    },
    {
      title: 'Offer Sent',
      count: offerSentCount,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      tab: 'reveal_gate',
    },
    {
      title: 'Reveal Gate',
      count: revealGateCount,
      icon: Lock,
      color: revealGateCount > 0 ? 'text-emerald-600' : 'text-slate-500',
      bg: revealGateCount > 0 ? 'bg-emerald-50' : 'bg-slate-50',
      tab: 'reveal_gate',
    },
  ];

  const pipelineStages = [
    { key: 'applied', label: 'Applied', count: flowCounts.applied, color: 'bg-slate-100 text-slate-700' },
    { key: 'shortlisted', label: 'Shortlisted', count: flowCounts.shortlisted, color: 'bg-amber-100 text-amber-800' },
    { key: 'interview_scheduled', label: 'Interview Scheduled', count: flowCounts.interview_scheduled, color: 'bg-blue-100 text-blue-800' },
    { key: 'interviewed', label: 'Interviewed', count: flowCounts.interviewed, color: 'bg-indigo-100 text-indigo-800' },
    { key: 'selected', label: 'Selected', count: flowCounts.selected, color: 'bg-emerald-100 text-emerald-800' },
    { key: 'offer_sent', label: 'Offer Sent', count: flowCounts.offer_sent, color: 'bg-purple-100 text-purple-800' },
    { key: 'reveal_gate', label: 'Reveal Gate', count: flowCounts.reveal_gate, color: 'bg-teal-100 text-teal-800' },
  ];

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar with subtitle & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#E2E8F4]">
        <div>
          <p className="text-[13px] text-[#4A5568]">
            Manage hospital partner vacancies, coordinate interview schedules, and facilitate reveal gate contractual confirmations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchOverviewData();
          }}
          disabled={loading || refreshing}
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[8px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-slate-500 ${
              refreshing ? 'animate-spin' : ''
            }`}
          />
          <span>{refreshing ? 'Syncing...' : 'Sync Pipeline'}</span>
        </button>
      </div>

      {/* 5 STATS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => onNavigateTab(card.tab)}
              className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">
                  {card.title}
                </span>
                <Icon className="w-4 h-4 text-[#2952A3] stroke-[1.5]" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">
                  {loading ? '—' : card.count}
                </span>
                <span className="text-[11px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] flex items-center transition-colors">
                  View <ArrowRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* PIPELINE SUMMARY: Horizontal Flow Status Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Live Application Status Flow
          </h2>
          <span className="text-xs text-slate-400">
            Click any stage to inspect matching applications
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {pipelineStages.map((stage, idx) => (
            <div
              key={stage.key}
              onClick={() => onNavigateTab('pipeline', stage.key)}
              className="p-3 rounded-[8px] border border-[#E2E8F4] bg-[#F8FAFD] hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold mb-1">
                <span>{stage.label}</span>
                {idx < pipelineStages.length - 1 && (
                  <ArrowRight className="w-3 h-3 text-slate-300 hidden lg:block" />
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-xl font-bold text-slate-900">
                  {loading ? '—' : stage.count}
                </span>
                <span className="text-[10px] text-slate-400 group-hover:text-[#1B3270] font-bold">
                  Inspect →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* UNREAD EMPLOYER MESSAGES QUEUE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-[#1B3270]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Employer Inquiries & Messages
            </h2>
          </div>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              unreadMessages.length > 0
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {unreadMessages.length} unread message{unreadMessages.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : unreadMessages.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                All employer communications are up to date.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                New messages from assigned healthcare partners will appear here for immediate review.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F4] -my-2">
              {unreadMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="font-bold text-slate-900">
                        {msg.employers?.company_name || 'Employer Facility'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        • {formatDate(msg.created_at)}
                      </span>
                    </div>
                    <p className="text-slate-600 line-clamp-2 pl-4 text-[11px] leading-relaxed">
                      "{msg.message}"
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleOpenChat({
                        id: msg.employer_id,
                        company_name: msg.employers?.company_name || 'Employer Facility',
                        user_id: msg.employers?.user_id,
                      })
                    }
                    className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-2xs transition-colors shrink-0 self-start sm:self-auto"
                  >
                    <Send className="w-3 h-3" />
                    <span>Reply</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PENDING INTEREST FACILITATION QUEUE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#1B3270]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Pending Interest Facilitation
            </h2>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#1B3270]/10 text-[#1B3270] border border-[#1B3270]/20">
            {pendingInterests.length} Pending
          </span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-16 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : pendingInterests.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">
                No pending interest expressions.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                When an employer expresses interest in a candidate from Browse Candidates, it will appear here for facilitation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pendingInterests.map((interest) => {
                const daysPending = Math.floor(
                  (Date.now() - new Date(interest.created_at).getTime()) / (1000 * 60 * 60 * 24)
                );
                const isOverdue = daysPending > 2;
                const anonId = `Candidate #${interest.candidate_id.slice(0, 6).toUpperCase()}`;

                return (
                  <div
                    key={interest.id}
                    className="p-4 rounded-[8px] border border-[#E2E8F4] bg-white hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-bold text-slate-900">
                          {interest.employers?.company_name || 'Employer Facility'}
                        </div>
                        <div className="text-xs font-semibold text-[#1B3270] mt-0.5">
                          {anonId}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Overdue
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#7EB3E8]/20 text-[#2952A3] capitalize">
                          {interest.candidates?.target_role || 'Healthcare'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-[#E2E8F4]">
                      <div>
                        <span>Expressed {formatDate(interest.created_at)}</span>
                        <span className="mx-1.5">•</span>
                        <span className={isOverdue ? 'font-bold text-amber-600' : ''}>
                          {daysPending === 0 ? 'Today' : `${daysPending} day${daysPending === 1 ? '' : 's'} ago`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenFacilitation(interest)}
                        className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                      >
                        Facilitate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* TODAY'S ACTIONS CARD */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Today's Actions — Healthcare Partner Demands
            </h2>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            {actionQueue.length} Attention Triggers
          </span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : actionQueue.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-slate-600 font-medium">
                No immediate blockers. All hospital applications and job requirements are running within SLA.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F4] -my-2">
              {actionQueue.map((item) => (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.type === 'offer_sent_aging'
                            ? 'bg-purple-500'
                            : item.type === 'cap_reached'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                      <span className="font-bold text-slate-900">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-slate-600 pl-4">{item.detail}</p>
                  </div>

                  <div className="pl-4 sm:pl-0 flex items-center">
                    {item.type === 'offer_sent_aging' && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('reveal_gate')}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs flex items-center space-x-1.5 transition-colors"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Go to Reveal Gate</span>
                      </button>
                    )}

                    {item.type === 'cap_reached' && (
                      <button
                        type="button"
                        onClick={() => handleNotifyEmployer(item)}
                        className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs flex items-center space-x-1.5 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Notify Employer</span>
                      </button>
                    )}

                    {item.type === 'talent_available' && (
                      <span className="text-[11px] text-slate-400 italic flex items-center">
                        <Sparkles className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                        Available for Employer Match
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* FACILITATION MODAL */}
      {facilitatingInterest && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E2E8F4] max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-start justify-between border-b border-[#E2E8F4] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#1B3270]">
                  Facilitate Employer Interest
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">
                    {facilitatingInterest.employers?.company_name || 'Employer'}
                  </span>{' '}
                  is interested in{' '}
                  <span className="font-semibold text-[#1B3270]">
                    Candidate #{facilitatingInterest.candidate_id.slice(0, 6).toUpperCase()}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFacilitatingInterest(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {facilitationError && (
              <div className="p-3 rounded-[6px] bg-red-50 border border-red-200 text-xs text-red-700">
                {facilitationError}
              </div>
            )}

            {/* Candidate Summary Card */}
            <div className="p-3.5 rounded-[8px] bg-[#F8FAFD] border border-[#E2E8F4] flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-[#1B3270]">
                  Candidate #{facilitatingInterest.candidate_id.slice(0, 6).toUpperCase()}
                </span>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Language Level:{' '}
                  <strong className="text-slate-700">
                    {facilitatingInterest.candidates?.language_level_self_reported || 'B2'}
                  </strong>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#7EB3E8]/20 text-[#2952A3] capitalize">
                {facilitatingInterest.candidates?.target_role || 'Healthcare'}
              </span>
            </div>

            {/* Step 1: Select Job Requirement */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Step 1: Select Active Job Requirement *
              </label>

              {loadingEmployerJobs ? (
                <div className="p-3 text-xs text-slate-400 flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin" />
                  <span>Loading active requirements...</span>
                </div>
              ) : employerActiveJobs.length === 0 ? (
                <div className="p-3 rounded-[6px] bg-amber-50 border border-amber-200 text-xs text-amber-800">
                  This employer currently has no active job requirements. Please activate a requirement before facilitating.
                </div>
              ) : (
                <select
                  value={selectedJobId}
                  onChange={(e) => handleJobSelectionChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-800 outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
                >
                  <option value="">-- Choose a requirement --</option>
                  {employerActiveJobs.map((job) => {
                    const remaining = (job.submission_cap || 10) - (job.current_submissions || 0);
                    const isFull = remaining <= 0;
                    return (
                      <option key={job.id} value={job.id} disabled={isFull}>
                        {job.title} — {job.location} — Slots remaining: {remaining} {isFull ? '(Cap Reached)' : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Live Fit Score Display */}
            {selectedJobId && (
              <div className="p-3.5 rounded-[8px] bg-white border border-[#E2E8F4] flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-700">Calculated Compatibility</span>
                  <div className="text-[11px] text-slate-400">
                    Live role matching based on qualifications & gate assessments
                  </div>
                </div>
                {calculatingFitScore ? (
                  <div className="flex items-center space-x-1.5 text-xs text-slate-400">
                    <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-[#1B3270] rounded-full animate-spin" />
                    <span>Scoring...</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-slate-500">Fit Score:</span>
                    <span
                      className={`text-sm font-extrabold px-2.5 py-0.5 rounded-[6px] ${
                        (calculatedFitScore ?? 0) >= 80
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : (calculatedFitScore ?? 0) >= 60
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {calculatedFitScore !== null ? `${calculatedFitScore}/100` : '—'}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Confirmation & Actions */}
            <div className="pt-2 flex items-center justify-end space-x-3 border-t border-[#E2E8F4]">
              <button
                type="button"
                onClick={() => setFacilitatingInterest(null)}
                disabled={isSubmittingFacilitation}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFacilitation}
                disabled={!selectedJobId || isSubmittingFacilitation || calculatingFitScore}
                className="px-5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] shadow-2xs transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
              >
                {isSubmittingFacilitation ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Facilitating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirm & Add to Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMPLOYER RM CONVERSATION MODAL */}
      {activeChatEmployer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E2E8F4] max-w-2xl w-full flex flex-col h-[650px] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#1B3270] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <Building2 className="w-5 h-5 text-sky-300" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    {activeChatEmployer.company_name}
                  </h3>
                  <span className="text-[10px] text-sky-200">
                    Employer Relationship Channel
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveChatEmployer(null)}
                className="text-white/80 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conversation Messages */}
            <div className="flex-1 p-5 overflow-y-auto space-y-3.5 bg-[#F8FAFD]/50 text-xs">
              {loadingChat ? (
                <div className="py-16 text-center space-y-2">
                  <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin mx-auto" />
                  <span className="text-xs text-slate-400">Loading conversation...</span>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <span>No message history with this employer.</span>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isRm = msg.sender_type === 'rm';
                  const isLead = msg.sender_type === 'placement_lead';
                  const senderTitle = isRm
                    ? 'You (Account Manager)'
                    : isLead
                    ? msg.sender_display_name || 'Placement Lead'
                    : activeChatEmployer.company_name;

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isRm ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center space-x-1.5 mb-1 px-1 text-[10px] text-slate-400">
                        <span className={`font-semibold ${isLead ? 'text-purple-700' : 'text-slate-600'}`}>
                          {senderTitle}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Bubble */}
                      <div
                        className={`max-w-[80%] rounded-[12px] px-4 py-2.5 leading-relaxed break-words shadow-2xs ${
                          isRm
                            ? 'bg-[#1B3270] text-white rounded-tr-none'
                            : isLead
                            ? 'bg-[#F3E8FF] border border-purple-200 text-purple-950 rounded-tl-none'
                            : 'bg-white border border-[#E2E8F4] text-slate-800 rounded-tl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Compose Footer */}
            <div className="p-4 border-t border-[#E2E8F4] bg-white shrink-0 space-y-2.5">
              {/* Optional Context Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                    Related Requirement (optional):
                  </label>
                  <select
                    value={chatSelectedJobId}
                    onChange={(e) => setChatSelectedJobId(e.target.value)}
                    className="w-full py-1 px-2 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs text-slate-700 focus:outline-hidden focus:border-[#1B3270]"
                  >
                    <option value="">None (General Message)</option>
                    {chatEmployerJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-0.5">
                    Related Candidate (optional):
                  </label>
                  <select
                    value={chatSelectedAppId}
                    onChange={(e) => setChatSelectedAppId(e.target.value)}
                    className="w-full py-1 px-2 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs text-slate-700 focus:outline-hidden focus:border-[#1B3270]"
                  >
                    <option value="">None (General Message)</option>
                    {chatEmployerApps.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Text Input Row */}
              <div className="flex items-end space-x-2">
                <textarea
                  value={chatReplyText}
                  onChange={(e) => setChatReplyText(e.target.value)}
                  placeholder="Write a message to the hospital partner..."
                  rows={2}
                  className="flex-1 p-2.5 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#1B3270] focus:bg-white resize-none transition-colors"
                />
                <button
                  type="button"
                  onClick={handleSendChatReply}
                  disabled={!chatReplyText.trim() || isSendingReply}
                  className="px-4 py-2.5 bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-40 text-white rounded-[8px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors flex items-center space-x-1.5 h-[50px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingReply ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerRmOverviewTab;
