import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Clock,
  Mic,
  GraduationCap,
  ClipboardCheck,
  AlertTriangle,
  UserCheck,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ShieldCheck,
  User,
} from 'lucide-react';
import {
  GateReviewModal,
  PendingGateResult,
} from '../components/GateReviewModal';
import {
  MentorProposalApprovalModal,
  MentorProposalItem,
} from './components/MentorProposalApprovalModal';

interface AcademicLeadOverviewTabProps {
  onNavigateTab: (tabId: string, filter?: string) => void;
}

interface AtRiskFlagItem {
  id: string;
  candidate_id: string;
  candidate_name: string;
  author_id: string;
  mentor_name: string;
  note: string;
  created_at: string;
  cohort_name?: string;
}

interface MentorWorkloadItem {
  mentor_id: string;
  mentor_name: string;
  mentor_email: string;
  activeCandidatesCount: number;
}

export const AcademicLeadOverviewTab: React.FC<AcademicLeadOverviewTabProps> = ({
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Stat counts
  const [awaitingStCount, setAwaitingStCount] = useState(0);
  const [stInProgressCount, setStInProgressCount] = useState(0);
  const [bootcampsActiveCount, setBootcampsActiveCount] = useState(0);
  const [assessmentsPendingCount, setAssessmentsPendingCount] = useState(0);
  const [cohortProposalsCount, setCohortProposalsCount] = useState(0);
  const [activeCohortsCount, setActiveCohortsCount] = useState(0);
  const [finalTestLockedCount, setFinalTestLockedCount] = useState(0);

  // Review Queue items
  const [reviewQueue, setReviewQueue] = useState<PendingGateResult[]>([]);
  const [selectedReview, setSelectedReview] = useState<PendingGateResult | null>(null);

  // Mentor Proposals Awaiting Approval (Part 5)
  const [pendingProposals, setPendingProposals] = useState<MentorProposalItem[]>([]);
  const [selectedProposalForApproval, setSelectedProposalForApproval] = useState<MentorProposalItem | null>(null);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);

  // At-risk flags
  const [atRiskFlags, setAtRiskFlags] = useState<AtRiskFlagItem[]>([]);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  // Mentor workload
  const [mentorWorkloads, setMentorWorkloads] = useState<MentorWorkloadItem[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadOverviewData = async () => {
    try {
      setLoading(true);

      // 1. Stats
      // Awaiting ST assignment: academic_requests where status = 'pending_assignment'
      const { count: awaitingSt } = await supabase
        .from('academic_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending_assignment');

      // Speaking Tests In Progress: academic_requests where status in ('assigned', 'in_progress')
      const { count: inProgressSt } = await supabase
        .from('academic_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', ['assigned', 'in_progress']);

      // Bootcamps Active: gate_results where gate_type = 'bootcamp' and status = 'in_progress'
      const { count: activeBootcamps } = await supabase
        .from('gate_results')
        .select('*', { count: 'exact', head: true })
        .eq('gate_type', 'bootcamp')
        .eq('status', 'in_progress');

      // Assessments Pending Review: gate_results where gate_type = 'assessment' and review_status = 'pending'
      const { count: pendingAssessments } = await supabase
        .from('gate_results')
        .select('*', { count: 'exact', head: true })
        .eq('gate_type', 'assessment')
        .eq('review_status', 'pending');

      // Cohort proposals pending approval: count cohorts where status='proposed'
      const { count: pendingCohortProps } = await supabase
        .from('cohorts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'proposed');

      // Active cohorts: count where status='active'
      const { count: actCohorts } = await supabase
        .from('cohorts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Final test locked candidates: count where final_test_locked=true
      const { count: ftLocked } = await supabase
        .from('candidates')
        .select('*', { count: 'exact', head: true })
        .eq('final_test_locked', true);

      setAwaitingStCount(awaitingSt || 0);
      setStInProgressCount(inProgressSt || 0);
      setBootcampsActiveCount(activeBootcamps || 0);
      setAssessmentsPendingCount(pendingAssessments || 0);
      setCohortProposalsCount(pendingCohortProps || 0);
      setActiveCohortsCount(actCohorts || 0);
      setFinalTestLockedCount(ftLocked || 0);

      // 2. Review Queue: gate_results where review_status = 'pending'
      const { data: pendingGates, error: gatesErr } = await supabase
        .from('gate_results')
        .select(`
          id,
          candidate_id,
          gate_type,
          status,
          score,
          recorded_by,
          notes,
          created_at,
          review_status,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            target_role,
            language_level_self_reported,
            user_id
          )
        `)
        .eq('review_status', 'pending')
        .order('created_at', { ascending: true });

      if (gatesErr) throw gatesErr;

      // Fetch mentor profiles for recorded_by
      const recorderIds = Array.from(
        new Set(
          (pendingGates || [])
            .map((g) => g.recorded_by)
            .filter((id): id is string => Boolean(id))
        )
      );

      const profileMap: Record<string, string> = {};
      if (recorderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', recorderIds);

        (profiles || []).forEach((p) => {
          profileMap[p.id] =
            `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
        });
      }

      const mappedReviewQueue: PendingGateResult[] = (pendingGates || []).map((g: any) => {
        const c = g.candidates;
        const candidateName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        return {
          id: g.id,
          candidate_id: g.candidate_id,
          candidate_name: candidateName,
          candidate_target_role: c?.target_role || null,
          candidate_language_level: c?.language_level_self_reported || null,
          candidate_user_id: c?.user_id || null,
          gate_type: g.gate_type,
          status: g.status,
          score: g.score,
          recorded_by: g.recorded_by,
          mentor_name: (g.recorded_by && profileMap[g.recorded_by]) || 'Mentor',
          notes: g.notes,
          created_at: g.created_at,
          review_status: g.review_status,
        };
      });

      setReviewQueue(mappedReviewQueue);

      // 3. At-Risk Flags: internal_notes where is_escalation = true and (resolved = false or resolved is null)
      const { data: flags, error: flagsErr } = await supabase
        .from('internal_notes')
        .select(`
          id,
          candidate_id,
          author_id,
          note,
          created_at,
          candidates:candidate_id (first_name, last_name)
        `)
        .eq('is_escalation', true)
        .or('resolved.is.null,resolved.eq.false')
        .order('created_at', { ascending: false });

      if (flagsErr) throw flagsErr;

      const flagAuthorIds = Array.from(
        new Set(
          (flags || [])
            .map((f) => f.author_id)
            .filter((id): id is string => Boolean(id))
        )
      );

      const flagAuthorMap: Record<string, string> = {};
      if (flagAuthorIds.length > 0) {
        const { data: aProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', flagAuthorIds);

        (aProfiles || []).forEach((p) => {
          flagAuthorMap[p.id] =
            `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
        });
      }

      // Look up cohort for each flagged candidate
      const flagCandIds = (flags || []).map((f: any) => f.candidate_id);
      const flagCohortMap: Record<string, string> = {};
      if (flagCandIds.length > 0) {
        const { data: memberData } = await supabase
          .from('cohort_members')
          .select(`
            candidate_id,
            cohorts:cohort_id (name)
          `)
          .in('candidate_id', flagCandIds);

        (memberData || []).forEach((m: any) => {
          if (m.cohorts?.name) {
            flagCohortMap[m.candidate_id] = m.cohorts.name;
          }
        });
      }

      const mappedFlags: AtRiskFlagItem[] = (flags || []).map((f: any) => {
        const c = f.candidates;
        const candidateName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        return {
          id: f.id,
          candidate_id: f.candidate_id,
          candidate_name: candidateName,
          cohort_name: flagCohortMap[f.candidate_id] || 'None',
          author_id: f.author_id,
          mentor_name: flagAuthorMap[f.author_id] || 'Mentor',
          note: f.note,
          created_at: f.created_at,
        };
      });

      setAtRiskFlags(mappedFlags);

      // 4. Mentor Workload Summary
      // Fetch all mentors
      const { data: mentors } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'mentor')
        .eq('is_internal', true);

      // Fetch active mentor assignments
      const { data: assignments } = await supabase
        .from('mentor_assignments')
        .select('mentor_id')
        .eq('active', true);

      const workloadCount: Record<string, number> = {};
      (assignments || []).forEach((a) => {
        workloadCount[a.mentor_id] = (workloadCount[a.mentor_id] || 0) + 1;
      });

      const mappedWorkloads: MentorWorkloadItem[] = (mentors || []).map((m) => ({
        mentor_id: m.id,
        mentor_name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
        mentor_email: m.email,
        activeCandidatesCount: workloadCount[m.id] || 0,
      }));

      // Sort by highest load first
      mappedWorkloads.sort(
        (a, b) => b.activeCandidatesCount - a.activeCandidatesCount
      );
      setMentorWorkloads(mappedWorkloads);

      // 5. Mentor Proposals Awaiting Approval (Part 5)
      const { data: propRows, error: propErr } = await supabase
        .from('mentor_proposals')
        .select(`
          id,
          candidate_id,
          proposed_mentor_id,
          proposed_by,
          proposal_type,
          status,
          notes,
          created_at,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            target_role,
            language_level_self_reported,
            user_id
          )
        `)
        .eq('status', 'pending')
        .eq('proposal_type', 'speaking_test')
        .order('created_at', { ascending: true });

      if (propErr) throw propErr;

      const propList = propRows || [];
      const propCandidateIds = propList.map((p: any) => p.candidate_id);
      const propIds = propList.map((p: any) => p.id);
      const propMentorIds = propList.map((p: any) => p.proposed_mentor_id).filter(Boolean);
      const propRmIds = propList.map((p: any) => p.proposed_by).filter(Boolean);

      // Fetch schedules for these proposals
      const { data: propScheds } = propIds.length > 0
        ? await supabase
            .from('speaking_test_schedules')
            .select('id, mentor_proposal_id, academic_request_id, proposed_date, proposed_time')
            .in('mentor_proposal_id', propIds)
        : { data: [] };

      const schedByProposalId = new Map(
        (propScheds || []).map((s: any) => [s.mentor_proposal_id, s])
      );

      // Fetch documents for candidate document counts
      const { data: propDocs } = propCandidateIds.length > 0
        ? await supabase
            .from('documents')
            .select('candidate_id, document_type, status')
            .in('candidate_id', propCandidateIds)
        : { data: [] };

      const docsByCandidateId: Record<string, { verified: number; pending: number }> = {};
      (propDocs || []).forEach((d: any) => {
        if (!docsByCandidateId[d.candidate_id]) {
          docsByCandidateId[d.candidate_id] = { verified: 0, pending: 0 };
        }
        if (d.status === 'verified') {
          docsByCandidateId[d.candidate_id].verified++;
        } else {
          docsByCandidateId[d.candidate_id].pending++;
        }
      });

      // Fetch mentor profiles and RM profiles
      const allProfileIds = Array.from(new Set([...propMentorIds, ...propRmIds]));
      const profileNameMap: Record<string, string> = {};
      if (allProfileIds.length > 0) {
        const { data: userProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', allProfileIds);

        (userProfiles || []).forEach((p: any) => {
          profileNameMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
        });
      }

      const mappedProposals: MentorProposalItem[] = propList.map((p: any) => {
        const c = p.candidates;
        const candidateName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        const sched = schedByProposalId.get(p.id);
        const docCounts = docsByCandidateId[p.candidate_id] || { verified: 0, pending: 0 };

        return {
          id: p.id,
          candidate_id: p.candidate_id,
          candidate_name: candidateName,
          candidate_role: c?.target_role || 'Healthcare Placement',
          candidate_language_level: c?.language_level_self_reported || 'Not specified',
          candidate_user_id: c?.user_id || null,
          verified_docs_count: docCounts.verified,
          pending_docs_count: docCounts.pending,
          proposed_mentor_id: p.proposed_mentor_id,
          proposed_mentor_name: profileNameMap[p.proposed_mentor_id] || 'Mentor',
          proposed_mentor_workload: workloadCount[p.proposed_mentor_id] || 0,
          proposed_date: sched?.proposed_date || 'Date pending',
          proposed_time: sched?.proposed_time || 'Time pending',
          proposed_by_id: p.proposed_by,
          proposed_by_name: profileNameMap[p.proposed_by] || 'Relationship Manager',
          rm_notes: p.notes,
          academic_request_id: sched?.academic_request_id || null,
          schedule_id: sched?.id || null,
          created_at: p.created_at,
        };
      });

      setPendingProposals(mappedProposals);
    } catch (err) {
      console.error('Error loading academic lead overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverviewData();
  }, []);

  // Handle Acknowledge At-Risk Flag
  const handleAcknowledgeFlag = async (flag: AtRiskFlagItem) => {
    if (!user) return;
    setAcknowledgingId(flag.id);
    try {
      // 1. Update internal_notes SET resolved = true
      const { error: updateErr } = await supabase
        .from('internal_notes')
        .update({ resolved: true })
        .eq('id', flag.id);

      if (updateErr) throw updateErr;

      // 2. Notify mentor
      await supabase.from('notifications').insert({
        user_id: flag.author_id,
        title: 'Flag Acknowledged',
        message: `Your flag for ${flag.candidate_name} has been acknowledged.`,
        type: 'academic',
        sent_by: user.id,
      });

      showToast(`Acknowledged flag for ${flag.candidate_name}.`);
      setAtRiskFlags((prev) => prev.filter((f) => f.id !== flag.id));
    } catch (err: any) {
      console.error('Error acknowledging flag:', err);
      showToast(err.message || 'Failed to acknowledge flag');
    } finally {
      setAcknowledgingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg flex items-center space-x-2 text-xs animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Review Modal */}
      {selectedReview && (
        <GateReviewModal
          gateResult={selectedReview}
          onClose={() => setSelectedReview(null)}
          onSuccess={(msg) => {
            showToast(msg);
            loadOverviewData();
          }}
        />
      )}

      {/* ACADEMY PIPELINE — 7 Stat Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Academy Pipeline Telemetry
          </h3>
          <span className="text-[11px] text-slate-400">Live curriculum & evaluation telemetry</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {/* Card 1: Cohort Proposals Pending */}
          <div
            onClick={() => onNavigateTab('cohorts')}
            className="bg-white border border-[#E2E8F4] rounded-[12px] p-4 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">Cohort Proposals</span>
              <GraduationCap className="w-4 h-4 text-[#2952A3] stroke-[1.5]" />
            </div>
            <div className="mt-2">
              <div className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">{loading ? '—' : cohortProposalsCount}</div>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Pending approval</p>
            </div>
          </div>

          {/* Card 2: Active Cohorts */}
          <div
            onClick={() => onNavigateTab('cohorts')}
            className="bg-white border border-[#E2E8F4] rounded-[12px] p-4 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">Active Cohorts</span>
              <GraduationCap className="w-4 h-4 text-[#2952A3] stroke-[1.5]" />
            </div>
            <div className="mt-2">
              <div className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">{loading ? '—' : activeCohortsCount}</div>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Live curriculum</p>
            </div>
          </div>

          {/* Card 3: Final Test Locked */}
          <div
            onClick={() => onNavigateTab('qualification_queue')}
            className="bg-white border border-[#E2E8F4] rounded-[12px] p-4 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">Test Locked</span>
              <AlertTriangle className="w-4 h-4 text-rose-500 stroke-[1.5]" />
            </div>
            <div className="mt-2">
              <div className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">{loading ? '—' : finalTestLockedCount}</div>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">3 consec. fails</p>
            </div>
          </div>

          {/* Card 4: Awaiting ST Assignment */}
          <div
            onClick={() => onNavigateTab('qualification_queue')}
            className="bg-white border border-[#E2E8F4] rounded-[12px] p-4 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">Awaiting ST</span>
              <Clock className="w-4 h-4 text-[#2952A3] stroke-[1.5]" />
            </div>
            <div className="mt-2">
              <div className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">{loading ? '—' : awaitingStCount}</div>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Pending mentor</p>
            </div>
          </div>

          {/* Card 5: Speaking Tests In Progress */}
          <div
            onClick={() => onNavigateTab('schedules')}
            className="bg-white border border-[#E2E8F4] rounded-[12px] p-4 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">ST In Progress</span>
              <Mic className="w-4 h-4 text-[#2952A3] stroke-[1.5]" />
            </div>
            <div className="mt-2">
              <div className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">{loading ? '—' : stInProgressCount}</div>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Scheduled / active</p>
            </div>
          </div>

          {/* Card 6: Bootcamps Active */}
          <div
            onClick={() => onNavigateTab('cohorts')}
            className="bg-white border border-[#E2E8F4] rounded-[12px] p-4 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">In Bootcamp</span>
              <GraduationCap className="w-4 h-4 text-[#2952A3] stroke-[1.5]" />
            </div>
            <div className="mt-2">
              <div className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">{loading ? '—' : bootcampsActiveCount}</div>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Enrolled candidates</p>
            </div>
          </div>

          {/* Card 7: Assessments Pending Review */}
          <div
            onClick={() => onNavigateTab('result_review')}
            className="bg-white border border-[#E2E8F4] rounded-[12px] p-4 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">Review Pending</span>
              <ClipboardCheck className="w-4 h-4 text-[#2952A3] stroke-[1.5]" />
            </div>
            <div className="mt-2">
              <div className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">{loading ? '—' : assessmentsPendingCount}</div>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">Awaiting sign-off</p>
            </div>
          </div>
        </div>
      </div>

      {/* MENTOR PROPOSALS AWAITING APPROVAL (Part 5) */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E2E8F4] flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1B3270] animate-pulse" />
              <h3 className="text-sm font-bold text-slate-800">
                Mentor Proposals Awaiting Approval ({pendingProposals.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Speaking test mentor proposals submitted by Relationship Managers requiring confirmation
            </p>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1B3270] border border-blue-200">
            {pendingProposals.length} Pending
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : pendingProposals.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-slate-600 font-medium">
                No mentor proposals awaiting approval.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All mentor and schedule proposals submitted by RMs have been evaluated.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4">Proposed Mentor + Workload</th>
                    <th className="py-3 px-4">Proposed Date & Time</th>
                    <th className="py-3 px-4">Proposed By</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                  {pendingProposals.map((prop) => (
                    <tr key={prop.id} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>{prop.candidate_name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          {prop.candidate_role} • {prop.candidate_language_level}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">
                          {prop.proposed_mentor_name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {prop.proposed_mentor_workload} active {prop.proposed_mentor_workload === 1 ? 'candidate' : 'candidates'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        <div>{prop.proposed_date}</div>
                        <div className="text-[11px] text-slate-400">{prop.proposed_time}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">
                        {prop.proposed_by_name}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProposalForApproval(prop);
                            setIsApprovalModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                        >
                          Review
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

      {/* REVIEW QUEUE — Split Card */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E2E8F4] flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-800">
                Gate Review Queue ({reviewQueue.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Speaking tests and exit assessments submitted by mentors requiring Academic Lead approval
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('result_review')}
            className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center"
          >
            Open Full Review Workspace
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1B3270]" />
            Loading pending gate reviews...
          </div>
        ) : reviewQueue.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <ShieldCheck className="w-9 h-9 text-slate-300 mx-auto mb-2" />
            <h4 className="text-xs font-semibold text-slate-700">
              No results currently awaiting review
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              When mentors conduct Speaking Tests or Assessment evaluations, they will appear here for verification.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F4]">
            {/* Section 1: Speaking Tests */}
            {(() => {
              const stItems = reviewQueue.filter((item) => item.gate_type === 'speaking_test');
              return (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Mic className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Speaking Test Results ({stItems.length} pending review)
                      </span>
                    </div>
                    <button
                      onClick={() => onNavigateTab('result_review', 'speaking_test')}
                      className="text-[11px] font-semibold text-[#1B3270] hover:underline"
                    >
                      View all speaking test results &rarr;
                    </button>
                  </div>

                  {stItems.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs bg-slate-50/50 rounded-[8px] border border-dashed border-slate-200">
                      No speaking test results awaiting review
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-slate-50/70 border border-[#E2E8F4] rounded-[8px] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-800 truncate">
                                {item.candidate_name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  item.status === 'pass'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {item.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                              <span>Mentor: <strong className="text-slate-700">{item.mentor_name}</strong></span>
                              <span>Score: <strong className="text-slate-800">{item.score !== null ? `${item.score}/100` : 'N/A'}</strong></span>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedReview(item)}
                            className="shrink-0 px-2.5 py-1 bg-[#1B3270] hover:bg-[#16285a] text-white font-semibold rounded-[5px] text-[11px] transition-colors shadow-2xs"
                          >
                            Review & Determine
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Section 2: Final Assessment Results */}
            {(() => {
              const faItems = reviewQueue.filter((item) => item.gate_type !== 'speaking_test');
              return (
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Final Assessment Results ({faItems.length} pending review)
                      </span>
                    </div>
                    <button
                      onClick={() => onNavigateTab('result_review', 'final_assessment')}
                      className="text-[11px] font-semibold text-[#1B3270] hover:underline"
                    >
                      View all assessment results &rarr;
                    </button>
                  </div>

                  {faItems.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs bg-slate-50/50 rounded-[8px] border border-dashed border-slate-200">
                      No final assessment results awaiting review
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {faItems.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-slate-50/70 border border-[#E2E8F4] rounded-[8px] flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-800 truncate">
                                {item.candidate_name}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  item.status === 'pass'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {item.status.toUpperCase()}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                              <span>Mentor: <strong className="text-slate-700">{item.mentor_name}</strong></span>
                              <span>Score: <strong className="text-slate-800">{item.score !== null ? `${item.score}/100` : 'N/A'}</strong></span>
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedReview(item)}
                            className="shrink-0 px-2.5 py-1 bg-[#1B3270] hover:bg-[#16285a] text-white font-semibold rounded-[5px] text-[11px] transition-colors shadow-2xs"
                          >
                            Review & Determine
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Grid: At-Risk Flags & Mentor Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* At-Risk Flags Card */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#E2E8F4] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                At-Risk Candidate Flags ({atRiskFlags.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Escalated by mentors</span>
          </div>

          <div className="p-4 flex-1">
            {loading ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                Loading flags...
              </div>
            ) : atRiskFlags.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-1.5" />
                <p className="font-semibold text-slate-600">No active escalations</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  All mentor concern flags are currently resolved.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {atRiskFlags.map((flag) => (
                  <div
                    key={flag.id}
                    className="p-3 bg-rose-50/40 border border-rose-200 rounded-[8px] text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800">
                          {flag.candidate_name}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          Cohort: {flag.cohort_name || 'None'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(flag.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {flag.note}
                    </p>

                    <div className="flex items-center justify-between pt-1 border-t border-rose-100">
                      <span className="text-[11px] text-slate-500">
                        Flagged by: <strong>{flag.mentor_name}</strong>
                      </span>
                      <button
                        onClick={() => handleAcknowledgeFlag(flag)}
                        disabled={acknowledgingId === flag.id}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-100/60 rounded-[5px] transition-colors disabled:opacity-50 flex items-center"
                      >
                        {acknowledgingId === flag.id && (
                          <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        )}
                        Acknowledge Flag
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mentor Workload Summary Card */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-[#E2E8F4] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-[#1B3270]" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Mentor Workload Distribution
              </h3>
            </div>
            <button
              onClick={() => onNavigateTab('mentors')}
              className="text-xs text-[#1B3270] font-semibold hover:underline"
            >
              Manage Mentors
            </button>
          </div>

          <div className="p-4 flex-1">
            {loading ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                Loading workload...
              </div>
            ) : mentorWorkloads.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <User className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="font-semibold text-slate-600">No active mentors found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Invite clinical & language mentors in the Mentor Management tab.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F4]">
                {mentorWorkloads.map((mw) => (
                  <div
                    key={mw.mentor_id}
                    className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">
                        {mw.mentor_name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {mw.mentor_email}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-700">
                        {mw.activeCandidatesCount}{' '}
                        {mw.activeCandidatesCount === 1 ? 'candidate' : 'candidates'}
                      </span>
                      {mw.activeCandidatesCount > 5 && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          High load
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MENTOR PROPOSAL APPROVAL MODAL (Part 5) */}
      <MentorProposalApprovalModal
        proposal={selectedProposalForApproval}
        isOpen={isApprovalModalOpen}
        onClose={() => {
          setIsApprovalModalOpen(false);
          setSelectedProposalForApproval(null);
        }}
        onSuccess={() => {
          showToast('Mentor proposal decision recorded.');
          loadOverviewData();
        }}
      />
    </div>
  );
};

export default AcademicLeadOverviewTab;
