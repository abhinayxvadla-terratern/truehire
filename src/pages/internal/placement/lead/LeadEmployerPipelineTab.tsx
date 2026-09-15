import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import { notifyByRole } from '../../../../utils/notificationRouting';
import { EmptyState } from '../../../../components/ui/EmptyState';
import {
  Briefcase,
  Search,
  Building2,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Loader2,
  Check,
  Layers,
  MessageSquare,
  Send,
} from 'lucide-react';
import { formatDate } from '../../../../utils/formatters';
import { MultiSelectFilter } from '../../../../components/ui/MultiSelectFilter';

interface EmployerPipelineRow {
  job_id: string;
  job_title: string;
  location: string;
  role_type: string;
  status: string;
  employer_id: string;
  employer_name: string;
  submission_cap: number;
  current_submissions: number;
  total_applications: number;
  shortlisted_count: number;
  interviews_count: number;
  offer_sent_count: number;
  rm_name: string;
  rm_id: string | null;
  unread_messages_count: number;
}

interface ApplicationItem {
  id: string;
  candidate_id: string;
  candidate_name: string;
  supplier_name: string;
  status: string;
  updated_at: string;
  days_in_stage: number;
  interview_date?: string | null;
  rejection_reason?: string | null;
  feedback?: string | null;
  fit_score?: number | null;
  employer_id: string;
  employer_name: string;
  job_id: string;
  job_title: string;
}

interface EmployerMessageRecord {
  id: string;
  employer_id: string;
  sender_profile_id: string;
  sender_type: 'employer' | 'rm' | 'placement_lead';
  sender_display_name?: string | null;
  message: string;
  related_job_id: string | null;
  read: boolean;
  created_at: string;
}

interface EmployerOption {
  id: string;
  company_name: string;
}

export const LeadEmployerPipelineTab: React.FC = () => {
  const { user } = useAuth();
  const [pipelineRows, setPipelineRows] = useState<EmployerPipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [rmFilters, setRmFilters] = useState<string[]>([]);

  const statusOptions = useMemo(() => [
    { value: 'active', label: 'Active' },
    { value: 'paused', label: 'Paused' },
    { value: 'closed', label: 'Closed' },
  ], []);

  const rmOptions = useMemo(() => {
    const map = new Map<string, string>();
    pipelineRows.forEach((r) => {
      if (r.rm_id && r.rm_name) {
        map.set(r.rm_id, r.rm_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ value: id, label: name }));
  }, [pipelineRows]);

  // Expanded job row
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobApplications, setJobApplications] = useState<ApplicationItem[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);

  // Post Job modal
  const [postJobModalOpen, setPostJobModalOpen] = useState(false);
  const [employerOptions, setEmployerOptions] = useState<EmployerOption[]>([]);
  const [newJobEmployerId, setNewJobEmployerId] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobLocation, setNewJobLocation] = useState('');
  const [newJobRoleType, setNewJobRoleType] = useState('Registered Nurse (Krankenpfleger/in)');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [newJobSubmissionCap, setNewJobSubmissionCap] = useState(10);
  const [submittingJob, setSubmittingJob] = useState(false);

  // Updating application status
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);

  // Placement Lead Message Panel State
  const [activeMessageEmployer, setActiveMessageEmployer] = useState<{
    id: string;
    name: string;
    rmId: string | null;
  } | null>(null);
  const [threadMessages, setThreadMessages] = useState<EmployerMessageRecord[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [relatedJobId, setRelatedJobId] = useState('');
  const [employerJobs, setEmployerJobs] = useState<{ id: string; title: string }[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string, _type?: 'success' | 'error') => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenMessagePanel = async (
    employerId: string,
    employerName: string,
    rmId: string | null,
    preselectedJobId?: string
  ) => {
    setActiveMessageEmployer({ id: employerId, name: employerName, rmId });
    setRelatedJobId(preselectedJobId || '');
    setMessageInput('');
    setLoadingMessages(true);

    try {
      // 1. Fetch employer's jobs for requirement dropdown
      const { data: jobs } = await supabase
        .from('job_requirements')
        .select('id, title')
        .eq('employer_id', employerId);
      setEmployerJobs(jobs || []);

      // 2. Fetch thread messages
      const { data: msgs, error } = await supabase
        .from('employer_rm_messages')
        .select('*')
        .eq('employer_id', employerId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setThreadMessages(msgs || []);

      // 3. Mark unread employer messages as read
      await supabase
        .from('employer_rm_messages')
        .update({ read: true })
        .eq('employer_id', employerId)
        .eq('sender_type', 'employer')
        .eq('read', false);

      // Decrement unread count locally in pipelineRows
      setPipelineRows((prev) =>
        prev.map((r) =>
          r.employer_id === employerId ? { ...r, unread_messages_count: 0 } : r
        )
      );
    } catch (err) {
      console.error('Error loading employer message thread:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMessageEmployer || !messageInput.trim() || !user) return;

    try {
      setSendingMessage(true);

      // Get Placement Lead's display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      const leadName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
        : 'Placement Lead';

      const displayName = `${leadName} — Placement Lead`;
      const trimmedMsg = messageInput.trim();

      // 1. INSERT employer_rm_messages
      const { data: insertedMsg, error: insertErr } = await supabase
        .from('employer_rm_messages')
        .insert({
          employer_id: activeMessageEmployer.id,
          sender_profile_id: user.id,
          sender_type: 'placement_lead',
          sender_display_name: displayName,
          message: trimmedMsg,
          related_job_id: relatedJobId || null,
          read: false,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // 2. INSERT notification for employer team members
      const { data: empTeam } = await supabase
        .from('employer_team_members')
        .select('profile_id')
        .eq('employer_id', activeMessageEmployer.id)
        .eq('invite_status', 'accepted');

      const { data: empData } = await supabase
        .from('employers')
        .select('user_id, is_admin_profile_id')
        .eq('id', activeMessageEmployer.id)
        .single();

      const recipientIds = new Set<string>();
      (empTeam || []).forEach((tm) => {
        if (tm.profile_id) recipientIds.add(tm.profile_id);
      });
      if (empData?.user_id) recipientIds.add(empData.user_id);
      if (empData?.is_admin_profile_id) recipientIds.add(empData.is_admin_profile_id);

      if (recipientIds.size > 0) {
        const empNotifs = Array.from(recipientIds).map((pId) => ({
          user_id: pId,
          title: 'Message from TerraTern Placement Lead',
          message: trimmedMsg.slice(0, 100) + (trimmedMsg.length > 100 ? '...' : ''),
          type: 'general',
          read: false,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(empNotifs);
      }

      // 3. INSERT notification for assigned RM
      if (activeMessageEmployer.rmId) {
        await supabase.from('notifications').insert({
          user_id: activeMessageEmployer.rmId,
          title: `Placement Lead sent message to ${activeMessageEmployer.name}`,
          message: `${trimmedMsg.slice(0, 100)}${trimmedMsg.length > 100 ? '...' : ''}. Review and follow up if needed.`,
          type: 'general',
          read: false,
          sent_by: user.id,
        });
      }

      setThreadMessages((prev) => [...prev, insertedMsg]);
      setMessageInput('');
      showToast('Message sent to employer.');
    } catch (err: any) {
      console.error('Error sending message as Placement Lead:', err);
      showToast(err.message || 'Failed to send message', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const fetchEmployerPipeline = async () => {
    try {
      setLoading(true);

      // 1. Fetch all job requirements
      const { data: jobs, error: jobsErr } = await supabase
        .from('job_requirements')
        .select(`
          id,
          title,
          location,
          role_type,
          status,
          submission_cap,
          current_submissions,
          employer_id,
          employers:employer_id (id, company_name)
        `)
        .order('created_at', { ascending: false });

      if (jobsErr) throw jobsErr;
      const jobList = jobs || [];

      // 2. Fetch all employers for dropdown
      const { data: emps } = await supabase
        .from('employers')
        .select('id, company_name')
        .order('company_name');

      setEmployerOptions(emps || []);

      // 3. Fetch employer RM assignments
      const { data: assignments } = await supabase
        .from('rm_assignments')
        .select(`
          entity_id,
          rm_profile_id,
          profiles:rm_profile_id (first_name, last_name, email)
        `)
        .eq('entity_type', 'employer')
        .eq('active', true);

      const empRmMap: Record<string, { rmId: string; rmName: string }> = {};
      (assignments || []).forEach((a: any) => {
        const name = a.profiles
          ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}`.trim() ||
            a.profiles.email
          : 'Assigned RM';
        empRmMap[a.entity_id] = { rmId: a.rm_profile_id, rmName: name };
      });

      // 4. Fetch all job applications for aggregation
      const { data: apps } = await supabase
        .from('job_applications')
        .select('id, job_id, status');

      const appList = apps || [];

      // 5. Fetch unread employer messages count per employer
      const { data: unreadMsgs } = await supabase
        .from('employer_rm_messages')
        .select('employer_id')
        .eq('sender_type', 'employer')
        .eq('read', false);

      const unreadCountMap: Record<string, number> = {};
      (unreadMsgs || []).forEach((m: any) => {
        unreadCountMap[m.employer_id] = (unreadCountMap[m.employer_id] || 0) + 1;
      });

      const rows: EmployerPipelineRow[] = jobList.map((j: any) => {
        const emp = j.employers;
        const empId = emp ? emp.id : j.employer_id;
        const empName = emp ? emp.company_name : 'Healthcare Facility';
        const rmInfo = empRmMap[empId];

        const jApps = appList.filter((a) => a.job_id === j.id);
        const total = jApps.length;
        const shortlisted = jApps.filter((a) => a.status === 'shortlisted').length;
        const interviews = jApps.filter((a) =>
          ['interview_scheduled', 'interviewed'].includes(a.status)
        ).length;
        const offerSent = jApps.filter((a) => a.status === 'offer_sent').length;

        return {
          job_id: j.id,
          job_title: j.title,
          location: j.location,
          role_type: j.role_type,
          status: j.status || 'active',
          employer_id: empId,
          employer_name: empName,
          submission_cap: j.submission_cap,
          current_submissions: j.current_submissions,
          total_applications: total,
          shortlisted_count: shortlisted,
          interviews_count: interviews,
          offer_sent_count: offerSent,
          rm_name: rmInfo ? rmInfo.rmName : 'Unassigned',
          rm_id: rmInfo ? rmInfo.rmId : null,
          unread_messages_count: unreadCountMap[empId] || 0,
        };
      });

      setPipelineRows(rows);
    } catch (err) {
      console.error('Error fetching employer pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployerPipeline();
  }, []);

  const handleToggleExpandJob = async (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      setJobApplications([]);
      return;
    }

    try {
      setExpandedJobId(jobId);
      setLoadingApps(true);

      const { data: apps, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          status,
          updated_at,
          interview_scheduled_at,
          rejection_reason,
          feedback,
          fit_score,
          match_score,
          candidates:candidate_id (first_name, last_name, user_id),
          suppliers:supplier_id (company_name)
        `)
        .eq('job_id', jobId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const currentRow = pipelineRows.find((r) => r.job_id === jobId);

      const mapped: ApplicationItem[] = (apps || []).map((a: any) => {
        const c = a.candidates;
        const name = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() ||
            `Candidate #${a.candidate_id.slice(0, 6)}`
          : `Candidate #${a.candidate_id.slice(0, 6)}`;

        const updatedDate = new Date(a.updated_at || Date.now());
        const daysDiff = Math.max(
          0,
          Math.floor((Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        return {
          id: a.id,
          candidate_id: a.candidate_id,
          candidate_name: name,
          supplier_name: a.suppliers?.company_name || 'Direct Candidate',
          status: a.status,
          updated_at: a.updated_at,
          days_in_stage: daysDiff,
          interview_date: a.interview_scheduled_at,
          rejection_reason: a.rejection_reason,
          feedback: a.feedback,
          fit_score: a.fit_score ?? a.match_score ?? null,
          employer_id: currentRow?.employer_id || '',
          employer_name: currentRow?.employer_name || '',
          job_id: jobId,
          job_title: currentRow?.job_title || '',
        };
      });

      setJobApplications(mapped);
    } catch (err) {
      console.error('Error loading job applications:', err);
    } finally {
      setLoadingApps(false);
    }
  };

  const handleStatusChange = async (
    application: ApplicationItem,
    newStatus: string
  ) => {
    if (!user) return;

    try {
      setUpdatingAppId(application.id);

      // 1. Update status and timestamp
      const { error } = await supabase
        .from('job_applications')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', application.id);

      if (error) throw error;

      // 2. If interview_scheduled, send notification to candidate
      if (newStatus === 'interview_scheduled') {
        const { data: cand } = await supabase
          .from('candidates')
          .select('user_id')
          .eq('id', application.candidate_id)
          .single();

        if (cand?.user_id) {
          await supabase.from('notifications').insert({
            user_id: cand.user_id,
            title: 'Interview Scheduled',
            message: `You have been selected for an interview for your applied healthcare position.`,
            type: 'application_update',
            read: false,
            sent_by: user.id,
          });
        }
      }

      // 3. When candidate passes interview (selected)
      if (newStatus === 'selected') {
        await notifyByRole(
          supabase,
          'placement_lead',
          'Candidate Passed Interview',
          `Candidate for this position has passed their interview and been selected.`,
          'placement',
          user.id
        );
        await notifyByRole(
          supabase,
          'employer_requirements_rm',
          'Candidate Passed Interview',
          `Candidate for this position has passed their interview and been selected.`,
          'placement',
          user.id
        );
      }

      showToast(`Status updated to ${newStatus.replace('_', ' ')}`);

      // Update local application state
      setJobApplications((prev) =>
        prev.map((app) =>
          app.id === application.id
            ? { ...app, status: newStatus, days_in_stage: 0 }
            : app
        )
      );

      // Refresh pipeline counts
      fetchEmployerPipeline();
    } catch (err: any) {
      alert(`Failed to update application status: ${err.message}`);
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobEmployerId || !newJobTitle || !newJobLocation) return;

    try {
      setSubmittingJob(true);

      const { error } = await supabase.from('job_requirements').insert({
        employer_id: newJobEmployerId,
        title: newJobTitle,
        location: newJobLocation,
        role_type: newJobRoleType,
        description: newJobDesc || null,
        submission_cap: Number(newJobSubmissionCap) || 10,
        current_submissions: 0,
        status: 'active',
      });

      if (error) throw error;

      showToast('New clinical position posted successfully');
      setPostJobModalOpen(false);
      setNewJobEmployerId('');
      setNewJobTitle('');
      setNewJobLocation('');
      setNewJobDesc('');
      setNewJobSubmissionCap(10);
      fetchEmployerPipeline();
    } catch (err: any) {
      alert(`Failed to post job requirement: ${err.message}`);
    } finally {
      setSubmittingJob(false);
    }
  };

  const filteredRows = useMemo(() => {
    return pipelineRows.filter((row) => {
      if (statusFilters.length > 0 && !statusFilters.includes(row.status)) {
        return false;
      }
      if (rmFilters.length > 0 && (!row.rm_id || !rmFilters.includes(row.rm_id))) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        row.employer_name.toLowerCase().includes(q) ||
        row.job_title.toLowerCase().includes(q) ||
        row.location.toLowerCase().includes(q) ||
        row.rm_name.toLowerCase().includes(q)
      );
    });
  }, [pipelineRows, statusFilters, rmFilters, searchQuery]);

  const getValidNextStatuses = (current: string): string[] => {
    switch (current) {
      case 'applied':
        return ['shortlisted'];
      case 'shortlisted':
        return ['interview_scheduled', 'rejected'];
      case 'interview_scheduled':
        return ['interviewed'];
      case 'interviewed':
        return ['selected', 'rejected'];
      case 'selected':
        return ['offer_sent'];
      case 'offer_sent':
        return ['reveal_gate'];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Post Job Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Employer Pipeline & Position Telemetry
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Active healthcare job requirements, candidate application stages, and interview progress.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPostJobModalOpen(true)}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Post on Employer's Behalf</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employer, job, location..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          {/* Status Filter */}
          <div>
            <MultiSelectFilter
              label="Status"
              options={statusOptions}
              selectedValues={statusFilters}
              onChange={setStatusFilters}
            />
          </div>

          {/* RM Assigned Filter */}
          <div>
            <MultiSelectFilter
              label="RM Assigned"
              options={rmOptions}
              selectedValues={rmFilters}
              onChange={setRmFilters}
            />
          </div>

          <span className="text-xs text-slate-400 font-medium whitespace-nowrap ml-auto">
            Showing {filteredRows.length} of {pipelineRows.length} requirement{pipelineRows.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Employer Pipeline Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <EmptyState
            title="No hospital requirements found"
            subtitle='Click "Post on Employer&apos;s Behalf" to create the first clinical requirement.'
            icon={Briefcase}
            actionLabel="Post on Employer's Behalf"
            onAction={() => setPostJobModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-8"></th>
                  <th className="py-3 px-4">Healthcare Employer</th>
                  <th className="py-3 px-4">Job Requirement</th>
                  <th className="py-3 px-4 text-center">Applications</th>
                  <th className="py-3 px-4 text-center">Shortlisted</th>
                  <th className="py-3 px-4 text-center">Interviews</th>
                  <th className="py-3 px-4 text-center">Offer Sent</th>
                  <th className="py-3 px-4">Assigned RM</th>
                  <th className="py-3 px-4 text-center">Employer Messages</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredRows.map((row) => {
                  const isExpanded = expandedJobId === row.job_id;
                  return (
                    <React.Fragment key={row.job_id}>
                      <tr
                        onClick={() => handleToggleExpandJob(row.job_id)}
                        className={`hover:bg-[#F8FAFD] cursor-pointer transition-colors ${
                          isExpanded ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-[#1B3270]" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </td>

                        {/* Employer */}
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{row.employer_name}</span>
                          </div>
                        </td>

                        {/* Job Title */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {row.job_title}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center space-x-2">
                            <span>{row.location}</span>
                            <span>•</span>
                            <span>{row.role_type}</span>
                          </div>
                        </td>

                        {/* Applications Total */}
                        <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                          {row.total_applications}
                        </td>

                        {/* Shortlisted */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {row.shortlisted_count}
                          </span>
                        </td>

                        {/* Interviews */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            {row.interviews_count}
                          </span>
                        </td>

                        {/* Offer Sent */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            {row.offer_sent_count}
                          </span>
                        </td>

                        {/* RM Assigned */}
                        <td className="py-3.5 px-4 text-slate-800 font-medium">
                          {row.rm_name}
                        </td>

                        {/* Employer Messages */}
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenMessagePanel(
                                row.employer_id,
                                row.employer_name,
                                row.rm_id,
                                row.job_id
                              )
                            }
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-[6px] border border-[#E2E8F4] hover:bg-purple-50 hover:border-purple-200 text-slate-700 hover:text-purple-900 transition-colors text-xs font-semibold cursor-pointer shadow-2xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-purple-700" />
                            <span>Messages</span>
                            {row.unread_messages_count > 0 && (
                              <span className="ml-1 px-1.5 py-0.2 bg-rose-600 text-white text-[10px] font-bold rounded-full">
                                {row.unread_messages_count}
                              </span>
                            )}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Drawer: All Job Applications for this job */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="bg-[#F8FAFD] p-4 border-b border-[#E2E8F4]">
                            <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                              <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-2">
                                <div className="flex items-center space-x-2">
                                  <Layers className="w-4 h-4 text-[#1B3270]" />
                                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                                    Application Pipeline for {row.job_title} ({jobApplications.length})
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500">
                                  Cap: {row.current_submissions} / {row.submission_cap}
                                </span>
                              </div>

                              {loadingApps ? (
                                <div className="py-6 text-center space-y-2">
                                  <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
                                  <p className="text-xs text-slate-500">
                                    Loading candidate applications...
                                  </p>
                                </div>
                              ) : jobApplications.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-3 text-center">
                                  No candidates have applied to this requirement yet.
                                </p>
                              ) : (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead className="text-[11px] text-slate-400 uppercase font-semibold border-b border-[#E2E8F4]">
                                      <tr>
                                        <th className="py-2 px-3">Candidate</th>
                                        <th className="py-2 px-3">Supplier</th>
                                        <th className="py-2 px-3">Current Status</th>
                                        <th className="py-2 px-3">Days in Stage</th>
                                        <th className="py-2 px-3">Interview Date</th>
                                        <th className="py-2 px-3">Reason</th>
                                        <th className="py-2 px-3">Feedback</th>
                                        <th className="py-2 px-3 text-center">Fit Score</th>
                                        <th className="py-2 px-3 text-right">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E2E8F4]">
                                      {jobApplications.map((app) => {
                                        const validNext = getValidNextStatuses(app.status);
                                        return (
                                          <tr key={app.id} className="hover:bg-slate-50">
                                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                                              {app.candidate_name}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600">
                                              {app.supplier_name}
                                            </td>
                                            <td className="py-2.5 px-3">
                                              <span
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                  app.status === 'placed'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : app.status === 'offer_sent'
                                                    ? 'bg-purple-100 text-purple-800'
                                                    : app.status === 'interview_scheduled'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-slate-100 text-slate-700'
                                                }`}
                                              >
                                                {app.status.replace('_', ' ')}
                                              </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-500">
                                              {app.days_in_stage}d
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-700 font-mono text-[11px]">
                                              {app.interview_date ? formatDate(app.interview_date) : '—'}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 max-w-[130px] truncate" title={app.rejection_reason || ''}>
                                              {app.rejection_reason || '—'}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 max-w-[130px] truncate" title={app.feedback || ''}>
                                              {app.feedback || '—'}
                                            </td>
                                            <td className="py-2.5 px-3 text-center">
                                              {app.fit_score != null ? (
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                  {app.fit_score}%
                                                </span>
                                              ) : (
                                                <span className="text-slate-400">—</span>
                                              )}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                              <div className="flex items-center justify-end space-x-1.5">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleOpenMessagePanel(
                                                      app.employer_id,
                                                      app.employer_name,
                                                      row.rm_id,
                                                      app.job_id
                                                    )
                                                  }
                                                  className="px-2 py-1 bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200 rounded text-[10px] font-bold cursor-pointer transition-colors shadow-2xs flex items-center space-x-1"
                                                >
                                                  <MessageSquare className="w-3 h-3 text-purple-700" />
                                                  <span>Message Employer</span>
                                                </button>
                                                {validNext.length > 0 ? (
                                                  validNext.map((next) => (
                                                    <button
                                                      key={next}
                                                      type="button"
                                                      disabled={updatingAppId === app.id}
                                                      onClick={() => handleStatusChange(app, next)}
                                                      className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors shadow-2xs ${
                                                        next === 'rejected'
                                                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                                          : next === 'offer_sent'
                                                          ? 'bg-purple-600 text-white hover:bg-purple-700'
                                                          : 'bg-[#1B3270] text-white hover:bg-[#2952A3]'
                                                      }`}
                                                    >
                                                      {updatingAppId === app.id ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                      ) : (
                                                        `Move to ${next.replace('_', ' ')}`
                                                      )}
                                                    </button>
                                                  ))
                                                ) : (
                                                  <span className="text-[11px] text-slate-400 italic">
                                                    Terminal Stage
                                                  </span>
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
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POST JOB MODAL */}
      {postJobModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Post Job on Behalf of Healthcare Employer
              </h3>
              <button
                type="button"
                onClick={() => setPostJobModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Healthcare Employer *
                </label>
                <select
                  required
                  value={newJobEmployerId}
                  onChange={(e) => setNewJobEmployerId(e.target.value)}
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                >
                  <option value="">Select Hospital / Facility...</option>
                  {employerOptions.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Position Title *
                </label>
                <input
                  type="text"
                  required
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="e.g. ICU Clinical Nurse Specialist (Fachgesundheitspfleger/in)"
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={newJobLocation}
                    onChange={(e) => setNewJobLocation(e.target.value)}
                    placeholder="e.g. Berlin, Germany"
                    className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Submission Cap *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={newJobSubmissionCap}
                    onChange={(e) => setNewJobSubmissionCap(Number(e.target.value))}
                    className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clinical Role Type *
                </label>
                <select
                  value={newJobRoleType}
                  onChange={(e) => setNewJobRoleType(e.target.value)}
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                >
                  <option value="Registered Nurse (Krankenpfleger/in)">
                    Registered Nurse (Krankenpfleger/in)
                  </option>
                  <option value="ICU / Anesthesia Specialist (Anästhesie/Intensivpflege)">
                    ICU / Anesthesia Specialist (Anästhesie/Intensivpflege)
                  </option>
                  <option value="Surgical / OR Nurse (OTA / OP-Pflege)">
                    Surgical / OR Nurse (OTA / OP-Pflege)
                  </option>
                  <option value="Pediatric Nurse (Gesundheits- und Kinderkrankenpflege)">
                    Pediatric Nurse (Gesundheits- und Kinderkrankenpflege)
                  </option>
                  <option value="Geriatric Care Specialist (Altenpfleger/in)">
                    Geriatric Care Specialist (Altenpfleger/in)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Description & Department Requirements
                </label>
                <textarea
                  rows={3}
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                  placeholder="Ward protocols, shift rotation, B2 certification requirement..."
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setPostJobModalOpen(false)}
                  className="px-3.5 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingJob}
                  className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                >
                  {submittingJob ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Publish Position</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* PLACEMENT LEAD MESSAGE PANEL (DRAWER) */}
      {activeMessageEmployer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div>
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-[#1B3270]" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    {activeMessageEmployer.name}
                  </h3>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">
                    Placement Lead Comms
                  </span>
                  <span className="text-[11px] text-slate-500">
                    RM: {activeMessageEmployer.rmId ? 'Assigned' : 'Unassigned'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveMessageEmployer(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Related Job Requirement Picker */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-[#E2E8F4]">
              <label className="block text-[11px] font-medium text-slate-600 mb-1">
                Link to Job Requirement (optional)
              </label>
              <select
                value={relatedJobId}
                onChange={(e) => setRelatedJobId(e.target.value)}
                className="w-full text-xs p-1.5 border border-[#E2E8F4] rounded-[6px] bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              >
                <option value="">General inquiry (no specific job)</option>
                {employerJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Thread Message History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FCFDFE]">
              {loadingMessages ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading conversation history...</p>
                </div>
              ) : threadMessages.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-medium text-slate-700">
                    No messages with {activeMessageEmployer.name} yet
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Send a message below. Notifications will be dispatched to the employer and assigned RM.
                  </p>
                </div>
              ) : (
                threadMessages.map((msg) => {
                  const isLead = msg.sender_type === 'placement_lead';
                  const isRm = msg.sender_type === 'rm';

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isLead ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center space-x-1.5 mb-1 px-1">
                        <span className="text-[10px] font-semibold text-slate-500">
                          {msg.sender_display_name ||
                            (isLead
                              ? 'Placement Lead'
                              : isRm
                              ? 'Relationship Manager'
                              : activeMessageEmployer.name)}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <div
                        className={`p-3 rounded-xl max-w-[85%] text-xs shadow-2xs leading-relaxed ${
                          isLead
                            ? 'bg-[#F3E8FF] border border-purple-200 text-purple-950 rounded-br-none'
                            : isRm
                            ? 'bg-blue-50 border border-blue-200 text-blue-950 rounded-bl-none'
                            : 'bg-slate-100 border border-slate-200 text-slate-800 rounded-bl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Compose Bar */}
            <div className="p-4 border-t border-[#E2E8F4] bg-white">
              <form onSubmit={handleSendMessage} className="space-y-2">
                <div className="relative">
                  <textarea
                    rows={3}
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type an official Placement Lead message..."
                    className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] resize-none"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-slate-400">
                    Notifies employer team members &amp; assigned RM
                  </p>
                  <button
                    type="submit"
                    disabled={sendingMessage || !messageInput.trim()}
                    className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-[6px] flex items-center space-x-1.5 shadow-2xs cursor-pointer transition-colors"
                  >
                    {sendingMessage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Send Message</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadEmployerPipelineTab;
