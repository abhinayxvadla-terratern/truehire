import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  GraduationCap,
  Search,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react';
import { formatDate } from '../../../../utils/formatters';

interface ProposalItem {
  cohort_id: string;
  proposal_id: string | null;
  cohort_name: string;
  track: string;
  mentor_id: string;
  mentor_name: string;
  mentor_active_candidates: number;
  start_date: string | null;
  end_date: string | null;
  proposed_by_id: string | null;
  proposed_by_name: string;
  capacity: number;
  notes: string | null;
  created_at: string;
}

interface CohortRow {
  id: string;
  name: string;
  track: string;
  status: string;
  mentor_id: string | null;
  mentor_name: string;
  bootcamp_start_date: string | null;
  bootcamp_end_date: string | null;
  max_capacity: number;
  member_count: number;
  sessions_completed: number;
  total_sessions: number;
  created_at: string;
}

interface CohortMember {
  id: string;
  candidate_id: string;
  name: string;
  email: string | null;
  st_outcome: string;
  level: string;
  sessions_attended: number;
  final_test_attempts: number;
  consecutive_fails: number;
  status: string;
}

interface SessionItem {
  id: string;
  session_number: number;
  title: string;
  date: string;
  time: string;
  status: string;
  attendance_rate: number;
  attendees_count: number;
}

interface FinalTestSummary {
  candidate_id: string;
  candidate_name: string;
  attempts_count: number;
  latest_outcome: string;
  consecutive_fails: number;
  review_status: string;
  latest_score: number | null;
}

export const AcademicCohortsTab: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Proposals
  const [proposals, setProposals] = useState<ProposalItem[]>([]);
  const [approvalModalProposal, setApprovalModalProposal] = useState<ProposalItem | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [processingDecision, setProcessingDecision] = useState(false);

  // Active Cohorts
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [mentorsList, setMentorsList] = useState<{ id: string; name: string }[]>([]);
  const [trackFilter, setTrackFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [mentorFilter, setMentorFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cohort Detail Drawer
  const [selectedCohort, setSelectedCohort] = useState<CohortRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [members, setMembers] = useState<CohortMember[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [finalTests, setFinalTests] = useState<FinalTestSummary[]>([]);
  const [activeDetailTab, setActiveDetailTab] = useState<'members' | 'sessions' | 'final_tests'>('members');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // 1. Fetch mentor profiles to build mentor map
      const { data: mentorProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'mentor');

      const mentorMap: Record<string, string> = {};
      const mentorOpts: { id: string; name: string }[] = [];
      (mentorProfiles || []).forEach((m) => {
        const name = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
        mentorMap[m.id] = name;
        mentorOpts.push({ id: m.id, name });
      });
      setMentorsList(mentorOpts);

      // Mentor active candidates workload
      const { data: mentorAssignments } = await supabase
        .from('mentor_assignments')
        .select('mentor_id')
        .eq('active', true);

      const workloadMap: Record<string, number> = {};
      (mentorAssignments || []).forEach((ma) => {
        workloadMap[ma.mentor_id] = (workloadMap[ma.mentor_id] || 0) + 1;
      });

      // 2. Fetch proposed cohorts
      const { data: proposedCohorts, error: propErr } = await supabase
        .from('cohorts')
        .select(`
          id,
          name,
          track,
          status,
          mentor_id,
          mentor_proposal_id,
          bootcamp_start_date,
          bootcamp_end_date,
          max_capacity,
          created_by,
          created_at
        `)
        .eq('status', 'proposed')
        .order('created_at', { ascending: false });

      if (propErr) throw propErr;

      // Also get mentor proposals for these cohorts
      const proposalIds = (proposedCohorts || [])
        .map((c) => c.mentor_proposal_id)
        .filter((id): id is string => Boolean(id));

      let propRecordMap: Record<string, any> = {};
      if (proposalIds.length > 0) {
        const { data: propRecords } = await supabase
          .from('mentor_proposals')
          .select('id, proposed_mentor_id, proposed_by, notes')
          .in('id', proposalIds);
        (propRecords || []).forEach((p) => {
          propRecordMap[p.id] = p;
        });
      }

      // Resolve creator names
      const creatorIds = Array.from(
        new Set((proposedCohorts || []).map((c) => c.created_by).filter((id): id is string => Boolean(id)))
      );
      const creatorMap: Record<string, string> = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', creatorIds);
        (creators || []).forEach((c) => {
          creatorMap[c.id] = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email;
        });
      }

      const proposalItems: ProposalItem[] = (proposedCohorts || []).map((c) => {
        const pRecord = c.mentor_proposal_id ? propRecordMap[c.mentor_proposal_id] : null;
        const mentorId = c.mentor_id || pRecord?.proposed_mentor_id || '';
        const proposedById = c.created_by || pRecord?.proposed_by || null;

        return {
          cohort_id: c.id,
          proposal_id: c.mentor_proposal_id || null,
          cohort_name: c.name,
          track: c.track || 'pass_track',
          mentor_id: mentorId,
          mentor_name: mentorMap[mentorId] || 'Unassigned Mentor',
          mentor_active_candidates: workloadMap[mentorId] || 0,
          start_date: c.bootcamp_start_date,
          end_date: c.bootcamp_end_date,
          proposed_by_id: proposedById,
          proposed_by_name: (proposedById && creatorMap[proposedById]) || 'Placement RM',
          capacity: c.max_capacity || 20,
          notes: pRecord?.notes || null,
          created_at: c.created_at || '',
        };
      });
      setProposals(proposalItems);

      // 3. Fetch approved, active, completed cohorts
      const { data: activeCohortList, error: cohortsErr } = await supabase
        .from('cohorts')
        .select(`
          id,
          name,
          track,
          status,
          mentor_id,
          bootcamp_start_date,
          bootcamp_end_date,
          max_capacity,
          created_at
        `)
        .in('status', ['approved', 'active', 'completed'])
        .order('bootcamp_start_date', { ascending: false });

      if (cohortsErr) throw cohortsErr;

      const cohortIds = (activeCohortList || []).map((c) => c.id);

      // Member counts
      const memberCountMap: Record<string, number> = {};
      if (cohortIds.length > 0) {
        const { data: membersData } = await supabase
          .from('cohort_members')
          .select('cohort_id')
          .in('cohort_id', cohortIds);
        (membersData || []).forEach((m) => {
          memberCountMap[m.cohort_id] = (memberCountMap[m.cohort_id] || 0) + 1;
        });
      }

      // Sessions counts
      const sessionsDoneMap: Record<string, number> = {};
      const sessionsTotalMap: Record<string, number> = {};
      if (cohortIds.length > 0) {
        const { data: sessionsData } = await supabase
          .from('bootcamp_sessions')
          .select('cohort_id, status')
          .in('cohort_id', cohortIds);
        (sessionsData || []).forEach((s) => {
          sessionsTotalMap[s.cohort_id] = (sessionsTotalMap[s.cohort_id] || 0) + 1;
          if (s.status === 'completed') {
            sessionsDoneMap[s.cohort_id] = (sessionsDoneMap[s.cohort_id] || 0) + 1;
          }
        });
      }

      const mappedCohorts: CohortRow[] = (activeCohortList || []).map((c) => ({
        id: c.id,
        name: c.name,
        track: c.track || 'pass_track',
        status: c.status || 'approved',
        mentor_id: c.mentor_id,
        mentor_name: c.mentor_id ? mentorMap[c.mentor_id] || 'Assigned Mentor' : 'Not assigned',
        bootcamp_start_date: c.bootcamp_start_date,
        bootcamp_end_date: c.bootcamp_end_date,
        max_capacity: c.max_capacity || 20,
        member_count: memberCountMap[c.id] || 0,
        sessions_completed: sessionsDoneMap[c.id] || 0,
        total_sessions: sessionsTotalMap[c.id] || 0,
        created_at: c.created_at || '',
      }));

      setCohorts(mappedCohorts);
    } catch (err) {
      console.error('Error loading academic cohorts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenDecisionModal = (prop: ProposalItem, action: 'approve' | 'reject') => {
    setApprovalModalProposal(prop);
    setApprovalAction(action);
    setDecisionNotes('');
  };

  const handleConfirmDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvalModalProposal || !user) return;

    try {
      setProcessingDecision(true);
      const now = new Date().toISOString();

      if (approvalAction === 'approve') {
        // 1. Update cohort status to approved
        const { error: cErr } = await supabase
          .from('cohorts')
          .update({
            status: 'approved',
            approved_by: user.id,
            updated_at: now,
          })
          .eq('id', approvalModalProposal.cohort_id);

        if (cErr) throw cErr;

        // 2. Update mentor_proposal if present
        if (approvalModalProposal.proposal_id) {
          await supabase
            .from('mentor_proposals')
            .update({
              status: 'approved',
              approved_by: user.id,
              approval_notes: decisionNotes.trim() || null,
              updated_at: now,
            })
            .eq('id', approvalModalProposal.proposal_id);
        }

        // 3. Notify proposed mentor
        if (approvalModalProposal.mentor_id) {
          await supabase.from('notifications').insert({
            user_id: approvalModalProposal.mentor_id,
            type: 'general',
            title: 'Cohort Proposal Approved',
            message: `You have been confirmed as the mentor for cohort "${approvalModalProposal.cohort_name}".`,
            sent_by: user.id,
          });
        }

        // 4. Notify proposing RM
        if (approvalModalProposal.proposed_by_id) {
          await supabase.from('notifications').insert({
            user_id: approvalModalProposal.proposed_by_id,
            type: 'general',
            title: 'Cohort Proposal Approved',
            message: `Your proposed cohort "${approvalModalProposal.cohort_name}" was approved by Academic Lead.`,
            sent_by: user.id,
          });
        }

        showToast(`Cohort "${approvalModalProposal.cohort_name}" approved successfully.`);
      } else {
        // Reject
        const { error: cErr } = await supabase
          .from('cohorts')
          .update({
            status: 'rejected',
            updated_at: now,
          })
          .eq('id', approvalModalProposal.cohort_id);

        if (cErr) throw cErr;

        if (approvalModalProposal.proposal_id) {
          await supabase
            .from('mentor_proposals')
            .update({
              status: 'rejected',
              approved_by: user.id,
              approval_notes: decisionNotes.trim() || null,
              updated_at: now,
            })
            .eq('id', approvalModalProposal.proposal_id);
        }

        if (approvalModalProposal.proposed_by_id) {
          await supabase.from('notifications').insert({
            user_id: approvalModalProposal.proposed_by_id,
            type: 'general',
            title: 'Cohort Proposal Rejected',
            message: `Proposal for "${approvalModalProposal.cohort_name}" was rejected: ${decisionNotes || 'Needs revision'}.`,
            sent_by: user.id,
          });
        }

        showToast(`Cohort proposal "${approvalModalProposal.cohort_name}" rejected.`);
      }

      setApprovalModalProposal(null);
      await loadData();
    } catch (err: any) {
      alert(`Action failed: ${err.message}`);
    } finally {
      setProcessingDecision(false);
    }
  };

  const handleOpenCohortDetail = async (cohort: CohortRow) => {
    setSelectedCohort(cohort);
    setDetailLoading(true);
    setActiveDetailTab('members');

    try {
      // 1. Fetch members
      const { data: memberRows, error: mErr } = await supabase
        .from('cohort_members')
        .select(`
          id,
          candidate_id,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            email,
            target_role,
            language_level_self_reported,
            status,
            consecutive_final_test_fails
          )
        `)
        .eq('cohort_id', cohort.id);

      if (mErr) throw mErr;

      const candIds = (memberRows || []).map((m: any) => m.candidate_id);

      // Attendance per candidate in this cohort
      const attendanceCountMap: Record<string, number> = {};
      if (candIds.length > 0) {
        const { data: attData } = await supabase
          .from('bootcamp_attendance')
          .select('candidate_id, session_id, attended, bootcamp_sessions!inner(cohort_id)')
          .in('candidate_id', candIds)
          .eq('bootcamp_sessions.cohort_id', cohort.id)
          .eq('attended', true);

        (attData || []).forEach((a) => {
          attendanceCountMap[a.candidate_id] = (attendanceCountMap[a.candidate_id] || 0) + 1;
        });
      }

      // ST outcome per candidate
      const stOutcomeMap: Record<string, string> = {};
      if (candIds.length > 0) {
        const { data: stData } = await supabase
          .from('speaking_test_results')
          .select('candidate_id, overall_outcome')
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        (stData || []).forEach((st) => {
          if (!stOutcomeMap[st.candidate_id]) {
            stOutcomeMap[st.candidate_id] = st.overall_outcome || 'pass';
          }
        });
      }

      // Final test attempts per candidate
      const ftAttemptsMap: Record<string, number> = {};
      const ftConsecFailsMap: Record<string, number> = {};
      if (candIds.length > 0) {
        const { data: ftData } = await supabase
          .from('final_test_attempts')
          .select('candidate_id, consecutive_fail_count')
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        (ftData || []).forEach((ft) => {
          ftAttemptsMap[ft.candidate_id!] = (ftAttemptsMap[ft.candidate_id!] || 0) + 1;
          if (ftConsecFailsMap[ft.candidate_id!] === undefined && ft.consecutive_fail_count !== null) {
            ftConsecFailsMap[ft.candidate_id!] = ft.consecutive_fail_count;
          }
        });
      }

      const mappedMembers: CohortMember[] = (memberRows || []).map((m: any) => {
        const c = m.candidates;
        const cName = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate' : 'Candidate';
        const fails = ftConsecFailsMap[m.candidate_id] ?? c?.consecutive_final_test_fails ?? 0;

        return {
          id: m.id,
          candidate_id: m.candidate_id,
          name: cName,
          email: c?.email || null,
          st_outcome: stOutcomeMap[m.candidate_id] || 'pass',
          level: c?.language_level_self_reported || 'B2',
          sessions_attended: attendanceCountMap[m.candidate_id] || 0,
          final_test_attempts: ftAttemptsMap[m.candidate_id] || 0,
          consecutive_fails: fails,
          status: c?.status || 'bootcamp',
        };
      });
      setMembers(mappedMembers);

      // 2. Fetch Sessions
      const { data: sessionRows } = await supabase
        .from('bootcamp_sessions')
        .select('*')
        .eq('cohort_id', cohort.id)
        .order('session_number', { ascending: true });

      const totalMembersCount = mappedMembers.length;
      const mappedSessions: SessionItem[] = [];

      for (const s of sessionRows || []) {
        const { count: attCount } = await supabase
          .from('bootcamp_attendance')
          .select('id', { count: 'exact', head: true })
          .eq('session_id', s.id)
          .eq('attended', true);

        const attended = attCount || 0;
        const rate = totalMembersCount > 0 ? Math.round((attended / totalMembersCount) * 100) : 0;

        mappedSessions.push({
          id: s.id,
          session_number: s.session_number || 1,
          title: s.title || `Session ${s.session_number}`,
          date: s.session_date || '',
          time: s.session_time || '',
          status: s.status || 'scheduled',
          attendance_rate: rate,
          attendees_count: attended,
        });
      }
      setSessions(mappedSessions);

      // 3. Fetch Final Test Attempts for Candidates in this Cohort
      if (candIds.length > 0) {
        const { data: ftList } = await supabase
          .from('final_test_attempts')
          .select(`
            id,
            candidate_id,
            score,
            outcome,
            review_status,
            consecutive_fail_count,
            created_at,
            candidates:candidate_id (first_name, last_name)
          `)
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        // Group by candidate
        const candGroup: Record<string, FinalTestSummary> = {};
        (ftList || []).forEach((ft: any) => {
          const cId = ft.candidate_id;
          const c = ft.candidates;
          const cName = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : 'Candidate';

          if (!candGroup[cId]) {
            candGroup[cId] = {
              candidate_id: cId,
              candidate_name: cName,
              attempts_count: 1,
              latest_outcome: ft.outcome || 'pending',
              consecutive_fails: ft.consecutive_fail_count || 0,
              review_status: ft.review_status || 'pending',
              latest_score: ft.score,
            };
          } else {
            candGroup[cId].attempts_count += 1;
          }
        });

        setFinalTests(Object.values(candGroup));
      } else {
        setFinalTests([]);
      }
    } catch (err) {
      console.error('Error loading cohort detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredCohorts = useMemo(() => {
    return cohorts.filter((c) => {
      if (trackFilter !== 'all' && c.track !== trackFilter) return false;
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (mentorFilter !== 'all' && c.mentor_id !== mentorFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchMentor = c.mentor_name.toLowerCase().includes(q);
        if (!matchName && !matchMentor) return false;
      }
      return true;
    });
  }, [cohorts, trackFilter, statusFilter, mentorFilter, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cohorts & Bootcamp Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review proposed cohort batches, monitor active clinical tracks, track attendance, and inspect candidate progress.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            loadData();
          }}
          disabled={loading || refreshing}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Syncing...' : 'Sync Cohorts'}</span>
        </button>
      </div>

      {/* SECTION 1: PROPOSAL APPROVAL SECTION */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-4 h-4 text-[#1B3270]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Cohort Proposals Awaiting Approval
            </h2>
          </div>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              proposals.length > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-slate-50 text-slate-600 border border-slate-200'
            }`}
          >
            {proposals.length} Pending
          </span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-40 bg-slate-100 rounded-[8px] animate-pulse" />
              ))}
            </div>
          ) : proposals.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No pending cohort proposals.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                New batch proposals created by Relationship Managers will appear here for academic review and assignment.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {proposals.map((prop) => (
                <div
                  key={prop.cohort_id}
                  className="p-4 rounded-[8px] border border-[#E2E8F4] bg-[#F8FAFD] space-y-3 hover:border-slate-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{prop.cohort_name}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                              prop.track === 'pass_track'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {prop.track.replace('_', ' ')}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Capacity: {prop.capacity}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {formatDate(prop.created_at)}
                      </span>
                    </div>

                    <div className="text-xs space-y-1.5 pt-1 text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Proposed Mentor:</span>
                        <span className="font-semibold text-slate-800">
                          {prop.mentor_name}{' '}
                          <span className="text-[10px] font-normal text-slate-400">
                            ({prop.mentor_active_candidates} active candidates)
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Proposed By:</span>
                        <span className="font-medium text-slate-700">{prop.proposed_by_name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Proposed Dates:</span>
                        <span className="font-medium text-slate-700">
                          {prop.start_date ? formatDate(prop.start_date) : 'TBD'} →{' '}
                          {prop.end_date ? formatDate(prop.end_date) : 'TBD'}
                        </span>
                      </div>
                      {prop.notes && (
                        <p className="text-[11px] text-slate-500 italic bg-white p-2 rounded border border-slate-200 mt-1">
                          "{prop.notes}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDecisionModal(prop, 'reject')}
                      className="px-3 py-1.5 border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-[6px] text-xs font-semibold cursor-pointer transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDecisionModal(prop, 'approve')}
                      className="px-3.5 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors flex items-center space-x-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Batch</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: ACTIVE COHORTS SECTION */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="p-5 border-b border-[#E2E8F4] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Active Cohorts Directory</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Monitor live curriculum delivery, enrolled candidate performance, and completion rates.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search cohort or mentor..."
                className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Track Filter */}
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-[#E2E8F4] rounded-[6px] text-slate-700 text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All Tracks</option>
              <option value="pass_track">Pass Track</option>
              <option value="fail_track">Fail Track</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-[#E2E8F4] rounded-[6px] text-slate-700 text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>

            {/* Mentor Filter */}
            <select
              value={mentorFilter}
              onChange={(e) => setMentorFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-[#E2E8F4] rounded-[6px] text-slate-700 text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All Mentors</option>
              {mentorsList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cohorts Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3">Cohort Name</th>
                <th className="px-4 py-3">Track</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned Mentor</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Sessions Done</th>
                <th className="px-4 py-3">Timeline</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F4]">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={8} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : filteredCohorts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                    No matching cohorts found.
                  </td>
                </tr>
              ) : (
                filteredCohorts.map((cohort) => (
                  <tr
                    key={cohort.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    onClick={() => handleOpenCohortDetail(cohort)}
                  >
                    <td className="px-5 py-3.5 font-bold text-slate-900 group-hover:text-[#1B3270]">
                      {cohort.name}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          cohort.track === 'pass_track'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {cohort.track.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-[11px] font-semibold capitalize px-2 py-0.5 rounded-full ${
                          cohort.status === 'active'
                            ? 'bg-sky-50 text-sky-700 border border-sky-200'
                            : cohort.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {cohort.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 font-medium">{cohort.mentor_name}</td>
                    <td className="px-4 py-3.5 text-slate-800 font-semibold">
                      {cohort.member_count} / {cohort.max_capacity}
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">
                      {cohort.sessions_completed} / {cohort.total_sessions}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-[11px]">
                      {cohort.bootcamp_start_date ? formatDate(cohort.bootcamp_start_date) : 'TBD'} →{' '}
                      {cohort.bootcamp_end_date ? formatDate(cohort.bootcamp_end_date) : 'TBD'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCohortDetail(cohort);
                        }}
                        className="inline-flex items-center space-x-1 text-[#1B3270] hover:text-[#2952A3] font-semibold text-xs cursor-pointer"
                      >
                        <span>View Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPROVAL / REJECTION MODAL */}
      {approvalModalProposal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#E2E8F4] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <h3 className="text-sm font-bold text-slate-900">
                {approvalAction === 'approve' ? 'Approve Cohort Proposal' : 'Reject Cohort Proposal'}
              </h3>
              <button
                type="button"
                onClick={() => setApprovalModalProposal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDecision} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-[8px] border border-slate-200 text-xs space-y-1">
                <p className="font-bold text-slate-900">{approvalModalProposal.cohort_name}</p>
                <p className="text-slate-600">
                  Mentor: <span className="font-medium text-slate-800">{approvalModalProposal.mentor_name}</span>
                </p>
                <p className="text-slate-600">
                  Track: <span className="font-medium uppercase text-slate-800">{approvalModalProposal.track.replace('_', ' ')}</span>
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  {approvalAction === 'approve' ? 'Academic Approval Notes (optional)' : 'Rejection Reason / Feedback'}
                </label>
                <textarea
                  value={decisionNotes}
                  onChange={(e) => setDecisionNotes(e.target.value)}
                  rows={3}
                  required={approvalAction === 'reject'}
                  placeholder={
                    approvalAction === 'approve'
                      ? 'Add any curriculum focus or mentor instructions...'
                      : 'Specify why this cohort proposal is rejected or needs rescheduling...'
                  }
                  className="w-full text-xs p-2.5 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApprovalModalProposal(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded-[6px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingDecision}
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-[6px] flex items-center space-x-1.5 cursor-pointer shadow-2xs ${
                    approvalAction === 'approve'
                      ? 'bg-[#1B3270] hover:bg-[#2952A3]'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {processingDecision && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{approvalAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COHORT DETAIL DRAWER / VIEW */}
      {selectedCohort && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-4xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-slate-900">{selectedCohort.name}</h2>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      selectedCohort.track === 'pass_track'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                    }`}
                  >
                    {selectedCohort.track.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">
                    Mentor: {selectedCohort.mentor_name}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Enrolled: {members.length} candidates • Timeline:{' '}
                  {selectedCohort.bootcamp_start_date ? formatDate(selectedCohort.bootcamp_start_date) : 'TBD'} →{' '}
                  {selectedCohort.bootcamp_end_date ? formatDate(selectedCohort.bootcamp_end_date) : 'TBD'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCohort(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Tabs */}
            <div className="px-5 border-b border-[#E2E8F4] flex space-x-4 bg-white text-xs">
              <button
                type="button"
                onClick={() => setActiveDetailTab('members')}
                className={`py-3 font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeDetailTab === 'members'
                    ? 'border-[#1B3270] text-[#1B3270]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Members ({members.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveDetailTab('sessions')}
                className={`py-3 font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeDetailTab === 'sessions'
                    ? 'border-[#1B3270] text-[#1B3270]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Sessions & Attendance ({sessions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveDetailTab('final_tests')}
                className={`py-3 font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeDetailTab === 'final_tests'
                    ? 'border-[#1B3270] text-[#1B3270]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Final Test Performance ({finalTests.length})
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {detailLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : activeDetailTab === 'members' ? (
                /* TAB 1: MEMBERS */
                <div className="space-y-4">
                  {members.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No candidates currently assigned to this cohort.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-[#E2E8F4] rounded-[8px]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                          <tr>
                            <th className="px-4 py-2.5">Candidate Name</th>
                            <th className="px-3 py-2.5">ST Outcome</th>
                            <th className="px-3 py-2.5">Level</th>
                            <th className="px-3 py-2.5">Sessions Attended</th>
                            <th className="px-3 py-2.5">Final Attempts</th>
                            <th className="px-3 py-2.5">Consecutive Fails</th>
                            <th className="px-4 py-2.5 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F4]">
                          {members.map((m) => {
                            const isAtRisk = m.consecutive_fails >= 2;
                            return (
                              <tr
                                key={m.id}
                                className={`transition-colors ${
                                  isAtRisk
                                    ? 'bg-amber-50/80 hover:bg-amber-100/70'
                                    : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="px-4 py-2.5 font-bold text-slate-900">
                                  <div className="flex items-center space-x-1.5">
                                    {isAtRisk && (
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    )}
                                    <span>{m.name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                                      m.st_outcome === 'pass'
                                        ? 'bg-emerald-50 text-emerald-700'
                                        : 'bg-rose-50 text-rose-700'
                                    }`}
                                  >
                                    {m.st_outcome}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 font-medium text-slate-700">{m.level}</td>
                                <td className="px-3 py-2.5 text-slate-800 font-semibold">
                                  {m.sessions_attended}
                                </td>
                                <td className="px-3 py-2.5 text-slate-700">{m.final_test_attempts}</td>
                                <td className="px-3 py-2.5">
                                  <span
                                    className={`text-xs font-bold ${
                                      m.consecutive_fails >= 2
                                        ? 'text-rose-600 font-extrabold'
                                        : 'text-slate-700'
                                    }`}
                                  >
                                    {m.consecutive_fails}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-right font-medium text-slate-600 capitalize text-[11px]">
                                  {m.status.replace('_', ' ')}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : activeDetailTab === 'sessions' ? (
                /* TAB 2: SESSIONS */
                <div className="space-y-4">
                  {sessions.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No curriculum sessions scheduled for this cohort yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-[#E2E8F4] rounded-[8px]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                          <tr>
                            <th className="px-4 py-2.5">#</th>
                            <th className="px-4 py-2.5">Session Title</th>
                            <th className="px-4 py-2.5">Date & Time</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5 text-right">Attendance Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F4]">
                          {sessions.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-bold text-slate-500">#{s.session_number}</td>
                              <td className="px-4 py-2.5 font-semibold text-slate-900">{s.title}</td>
                              <td className="px-4 py-2.5 text-slate-600 text-[11px]">
                                {s.date ? formatDate(s.date) : 'TBD'} {s.time}
                              </td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                                    s.status === 'completed'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {s.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">
                                <span className="font-bold text-slate-900">{s.attendance_rate}%</span>{' '}
                                <span className="text-[10px] text-slate-400">
                                  ({s.attendees_count} attended)
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                /* TAB 3: FINAL TEST PERFORMANCE */
                <div className="space-y-4">
                  {finalTests.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      No final assessment attempts recorded for members in this batch.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-[#E2E8F4] rounded-[8px]">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                          <tr>
                            <th className="px-4 py-2.5">Candidate Name</th>
                            <th className="px-3 py-2.5">Attempts</th>
                            <th className="px-3 py-2.5">Latest Outcome</th>
                            <th className="px-3 py-2.5">Consecutive Fails</th>
                            <th className="px-3 py-2.5">Review Status</th>
                            <th className="px-4 py-2.5 text-right">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E2E8F4]">
                          {finalTests.map((ft) => (
                            <tr key={ft.candidate_id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 font-bold text-slate-900">{ft.candidate_name}</td>
                              <td className="px-3 py-2.5 text-slate-700 font-semibold">{ft.attempts_count}</td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                                    ft.latest_outcome === 'pass'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}
                                >
                                  {ft.latest_outcome}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`font-bold ${
                                    ft.consecutive_fails >= 2 ? 'text-rose-600 font-extrabold' : 'text-slate-700'
                                  }`}
                                >
                                  {ft.consecutive_fails} / 3
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 capitalize text-[11px]">
                                {ft.review_status}
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                                {ft.latest_score !== null ? `${ft.latest_score}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AcademicCohortsTab;
