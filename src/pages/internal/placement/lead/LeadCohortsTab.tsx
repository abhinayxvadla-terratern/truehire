import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import { notifyByRole } from '../../../../utils/notificationRouting';
import {
  Search,
  Users,
  CheckCircle,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  BookOpen,
  GraduationCap,
  Check,
} from 'lucide-react';
import { formatDate } from '../../../../utils/formatters';

interface CohortRow {
  id: string;
  name: string;
  track: string;
  status: 'proposed' | 'approved' | 'active' | 'completed' | 'cancelled' | string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  mentor_id: string | null;
  created_by: string | null;
  mentor_name?: string;
  creator_name?: string;
  member_count: number;
  session_count: number;
}

interface CohortMember {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  status: string;
  joined_at: string;
}

interface BootcampSession {
  id: string;
  session_number: number;
  session_title: string;
  session_date: string;
  session_time: string;
  status: string;
  duration_minutes: number | null;
  attendance_pct: number;
}

interface MemberFinalTest {
  id: string;
  candidate_id: string;
  candidate_name: string;
  attempt_number: number;
  score: number | null;
  score_pct: number | null;
  outcome: string | null;
  review_status: string | null;
  created_at: string;
}

interface MentorOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export const LeadCohortsTab: React.FC = () => {
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [mentorFilter, setMentorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Cohort Detail
  const [selectedCohort, setSelectedCohort] = useState<CohortRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [members, setMembers] = useState<CohortMember[]>([]);
  const [sessions, setSessions] = useState<BootcampSession[]>([]);
  const [finalTests, setFinalTests] = useState<MemberFinalTest[]>([]);

  // Proposal Approval / Rejection Modal
  const [approvalModalCohort, setApprovalModalCohort] = useState<CohortRow | null>(null);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [processingApproval, setProcessingApproval] = useState(false);

  // Reassign Mentor Modal
  const [reassignModalCohort, setReassignModalCohort] = useState<CohortRow | null>(null);
  const [selectedNewMentorId, setSelectedNewMentorId] = useState('');
  const [reassignNotes, setReassignNotes] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchCohortsData = async () => {
    try {
      setLoading(true);

      // 1. Find all Candidate/Supplier RMs in the placement lead's team
      const { data: rmProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'candidate_supplier_rm')
        .eq('is_internal', true);

      const rmIds = (rmProfiles || []).map((r) => r.id);
      const rmMap: Record<string, string> = {};
      (rmProfiles || []).forEach((r) => {
        rmMap[r.id] = `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email;
      });

      // Fetch mentors
      const { data: mentorProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'mentor')
        .eq('is_internal', true);

      setMentors(mentorProfiles || []);
      const mentorNameMap: Record<string, string> = {};
      (mentorProfiles || []).forEach((m) => {
        mentorNameMap[m.id] = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
      });

      // 2. Fetch cohorts where created_by in rmIds (or all cohorts if none explicitly tagged)
      let query = supabase
        .from('cohorts')
        .select('*')
        .order('created_at', { ascending: false });

      if (rmIds.length > 0) {
        // Scoped to candidate RMs
        query = query.in('created_by', rmIds);
      }

      const { data: cohortList, error: cErr } = await query;
      if (cErr) throw cErr;

      const cohortIds = (cohortList || []).map((c) => c.id);

      // Aggregate members count
      const memberCountMap: Record<string, number> = {};
      if (cohortIds.length > 0) {
        const { data: memberData } = await supabase
          .from('cohort_members')
          .select('cohort_id')
          .in('cohort_id', cohortIds);

        (memberData || []).forEach((m) => {
          memberCountMap[m.cohort_id] = (memberCountMap[m.cohort_id] || 0) + 1;
        });
      }

      // Aggregate sessions count
      const sessionCountMap: Record<string, number> = {};
      if (cohortIds.length > 0) {
        const { data: sessionData } = await supabase
          .from('bootcamp_sessions')
          .select('cohort_id')
          .in('cohort_id', cohortIds);

        (sessionData || []).forEach((s) => {
          sessionCountMap[s.cohort_id] = (sessionCountMap[s.cohort_id] || 0) + 1;
        });
      }

      const formatted: CohortRow[] = (cohortList || []).map((c) => ({
        id: c.id,
        name: c.name,
        track: c.track || 'General Healthcare',
        status: c.status || 'active',
        start_date: c.start_date,
        end_date: c.end_date,
        created_at: c.created_at,
        mentor_id: c.mentor_id,
        created_by: c.created_by,
        mentor_name: c.mentor_id ? mentorNameMap[c.mentor_id] || 'Assigned Mentor' : 'Unassigned',
        creator_name: c.created_by ? rmMap[c.created_by] || 'Placement RM' : 'Internal Staff',
        member_count: memberCountMap[c.id] || 0,
        session_count: sessionCountMap[c.id] || 0,
      }));

      setCohorts(formatted);
    } catch (err) {
      console.error('Error fetching Lead cohorts data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCohortsData();
  }, []);

  const handleOpenDetail = async (cohort: CohortRow) => {
    setSelectedCohort(cohort);
    setDetailLoading(true);

    try {
      // 1. Fetch members
      const { data: memberData } = await supabase
        .from('cohort_members')
        .select(`
          id,
          candidate_id,
          status,
          joined_at,
          candidates:candidate_id (
            first_name,
            last_name,
            user_id,
            profiles:user_id (email)
          )
        `)
        .eq('cohort_id', cohort.id);

      const mappedMembers: CohortMember[] = (memberData || []).map((m: any) => {
        const cand = m.candidates;
        const name = cand ? `${cand.first_name || ''} ${cand.last_name || ''}`.trim() : 'Candidate';
        const email = cand?.profiles?.email || '—';
        return {
          id: m.id,
          candidate_id: m.candidate_id,
          candidate_name: name,
          candidate_email: email,
          status: m.status || 'enrolled',
          joined_at: m.joined_at || cohort.created_at,
        };
      });
      setMembers(mappedMembers);

      // 2. Fetch bootcamp sessions & attendance
      const { data: sessionData } = await supabase
        .from('bootcamp_sessions')
        .select('*')
        .eq('cohort_id', cohort.id)
        .order('session_number', { ascending: true });

      const mappedSessions: BootcampSession[] = (sessionData || []).map((s) => ({
        id: s.id,
        session_number: s.session_number,
        session_title: s.session_title || `Session ${s.session_number}`,
        session_date: s.session_date,
        session_time: s.session_time,
        status: s.status,
        duration_minutes: s.duration_minutes,
        attendance_pct: 100,
      }));
      setSessions(mappedSessions);

      // 3. Fetch final assessments for members
      const memberCandidateIds = mappedMembers.map((m) => m.candidate_id);
      if (memberCandidateIds.length > 0) {
        const { data: testData } = await supabase
          .from('candidate_final_assessments')
          .select('*')
          .in('candidate_id', memberCandidateIds)
          .order('attempt_number', { ascending: false });

        const candNameMap: Record<string, string> = {};
        mappedMembers.forEach((m) => {
          candNameMap[m.candidate_id] = m.candidate_name;
        });

        const mappedTests: MemberFinalTest[] = (testData || []).map((t) => ({
          id: t.id,
          candidate_id: t.candidate_id,
          candidate_name: candNameMap[t.candidate_id] || 'Candidate',
          attempt_number: t.attempt_number,
          score: t.score,
          score_pct: t.score_pct,
          outcome: t.outcome,
          review_status: t.review_status,
          created_at: t.created_at,
        }));
        setFinalTests(mappedTests);
      } else {
        setFinalTests([]);
      }
    } catch (err) {
      console.error('Error fetching cohort detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleProcessApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvalModalCohort || !user) return;

    try {
      setProcessingApproval(true);
      const newStatus = approvalAction === 'approve' ? 'approved' : 'cancelled';

      const { error } = await supabase
        .from('cohorts')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalModalCohort.id);

      if (error) throw error;

      // Notify cohort creator (RM)
      if (approvalModalCohort.created_by) {
        await supabase.from('notifications').insert({
          user_id: approvalModalCohort.created_by,
          title: `Cohort Proposal ${approvalAction === 'approve' ? 'Approved' : 'Rejected'}`,
          message: `Placement Lead has ${approvalAction === 'approve' ? 'approved' : 'rejected'} cohort "${approvalModalCohort.name}".${approvalNotes.trim() ? '\n\nNotes: ' + approvalNotes.trim() : ''}`,
          type: 'general',
          read: false,
          sent_by: user.id,
        });
      }

      showToast(`Cohort "${approvalModalCohort.name}" marked as ${newStatus}.`);
      setApprovalModalCohort(null);
      setApprovalNotes('');
      fetchCohortsData();
    } catch (err: any) {
      console.error('Error updating cohort approval:', err);
      showToast(err.message || 'Failed to update cohort status', 'error');
    } finally {
      setProcessingApproval(false);
    }
  };

  const handleReassignMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModalCohort || !selectedNewMentorId || !user) return;

    try {
      setReassigning(true);

      const { error } = await supabase
        .from('cohorts')
        .update({
          mentor_id: selectedNewMentorId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reassignModalCohort.id);

      if (error) throw error;

      const newMentor = mentors.find((m) => m.id === selectedNewMentorId);
      const mentorName = newMentor
        ? `${newMentor.first_name} ${newMentor.last_name}`
        : 'Assigned Mentor';

      // Notify Academic Lead
      await notifyByRole(
        supabase,
        'academic_lead',
        'Cohort Mentor Reassigned',
        `Placement Lead reassigned mentor for cohort "${reassignModalCohort.name}" to ${mentorName}.${reassignNotes.trim() ? '\n\nReason: ' + reassignNotes.trim() : ''}`,
        'mentor_reassigned',
        user.id
      );

      // Notify new mentor
      await supabase.from('notifications').insert({
        user_id: selectedNewMentorId,
        title: 'Assigned to Cohort',
        message: `You have been assigned as mentor for cohort "${reassignModalCohort.name}".${reassignNotes.trim() ? '\n\nNotes: ' + reassignNotes.trim() : ''}`,
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      showToast(`Cohort reassigned to ${mentorName}.`);
      setReassignModalCohort(null);
      setSelectedNewMentorId('');
      setReassignNotes('');
      fetchCohortsData();
    } catch (err: any) {
      console.error('Error reassigning cohort mentor:', err);
      showToast(err.message || 'Failed to reassign mentor', 'error');
    } finally {
      setReassigning(false);
    }
  };

  const filteredCohorts = cohorts.filter((c) => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (trackFilter !== 'all' && c.track !== trackFilter) return false;
    if (mentorFilter !== 'all' && c.mentor_id !== mentorFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.track.toLowerCase().includes(q) ||
        (c.mentor_name || '').toLowerCase().includes(q) ||
        (c.creator_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center space-x-2 animate-in fade-in duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Team Cohorts
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Oversee active and proposed training cohorts managed by Relationship Managers in your team.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchCohortsData();
          }}
          disabled={refreshing}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#1B3270]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          >
            <option value="all">All Statuses</option>
            <option value="proposed">Proposed</option>
            <option value="approved">Approved</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Track filter */}
          <select
            value={trackFilter}
            onChange={(e) => setTrackFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          >
            <option value="all">All Tracks</option>
            <option value="pass_track">Pass Track</option>
            <option value="fail_track">Fail Track</option>
          </select>

          {/* Mentor filter */}
          <select
            value={mentorFilter}
            onChange={(e) => setMentorFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          >
            <option value="all">All Mentors</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>
                {m.first_name} {m.last_name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search cohort, track, or RM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-xs">Loading team cohorts...</p>
          </div>
        ) : filteredCohorts.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-800">No cohorts found</h4>
            <p className="text-xs text-slate-500 mt-1">
              No active or proposed cohorts match the selected filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Track</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Mentor</th>
                  <th className="py-3 px-4">Members</th>
                  <th className="py-3 px-4">Sessions</th>
                  <th className="py-3 px-4">RM</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCohorts.map((c) => {
                  const isProposed = c.status === 'proposed';

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/75 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {c.name}
                      </td>
                      <td className="py-3.5 px-4">{c.track}</td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                            c.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : c.status === 'proposed'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : c.status === 'approved'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : c.status === 'completed'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-800">{c.mentor_name}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">{c.member_count}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-900">{c.session_count}</td>
                      <td className="py-3.5 px-4 text-slate-700">{c.creator_name}</td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        {c.start_date ? formatDate(c.start_date) : 'TBD'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          {isProposed && (
                            <button
                              type="button"
                              onClick={() => {
                                setApprovalModalCohort(c);
                                setApprovalAction('approve');
                              }}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                            >
                              Review
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setReassignModalCohort(c);
                              setSelectedNewMentorId(c.mentor_id || (mentors[0]?.id || ''));
                            }}
                            className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            Reassign Mentor
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(c)}
                            className="px-2.5 py-1 bg-[#1B3270] hover:bg-[#152758] text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            View
                          </button>
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

      {/* COHORT DETAIL DRAWER (READ-ONLY) */}
      {selectedCohort && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <span>{selectedCohort.name}</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                      selectedCohort.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {selectedCohort.status}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track: {selectedCohort.track} • Mentor: {selectedCohort.mentor_name} • Managed by: {selectedCohort.creator_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCohort(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {detailLoading ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <p className="text-xs">Loading cohort details...</p>
                </div>
              ) : (
                <>
                  {/* COHORT MEMBERS SECTION */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                        <Users className="w-4 h-4 text-[#1B3270]" />
                        <span>Enrolled Candidates ({members.length})</span>
                      </h4>
                    </div>

                    {members.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-lg border border-slate-200">
                        No candidates currently enrolled in this cohort.
                      </p>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden text-xs">
                        {members.map((m) => (
                          <div key={m.id} className="p-3 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-slate-900">{m.candidate_name}</div>
                              <div className="text-[11px] text-slate-400">{m.candidate_email}</div>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium capitalize">
                                {m.status}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-1">Joined {formatDate(m.joined_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* BOOTCAMP SESSIONS SECTION */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                      <BookOpen className="w-4 h-4 text-[#1B3270]" />
                      <span>Bootcamp Sessions ({sessions.length})</span>
                    </h4>

                    {sessions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-lg border border-slate-200">
                        No scheduled sessions recorded for this cohort.
                      </p>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden text-xs">
                        {sessions.map((s) => (
                          <div key={s.id} className="p-3 flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-slate-900">
                                Session {s.session_number}: {s.session_title}
                              </span>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {s.session_date ? formatDate(s.session_date) : 'Date TBD'} • {s.session_time || 'Time TBD'}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium capitalize bg-blue-50 text-blue-700 border border-blue-200">
                              {s.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* FINAL TEST RESULTS */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                      <GraduationCap className="w-4 h-4 text-[#1B3270]" />
                      <span>Final Assessment Records ({finalTests.length})</span>
                    </h4>

                    {finalTests.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-lg border border-slate-200">
                        No final assessment attempts recorded for members yet.
                      </p>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 overflow-hidden text-xs">
                        {finalTests.map((t) => (
                          <div key={t.id} className="p-3 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-slate-900">{t.candidate_name}</div>
                              <div className="text-[11px] text-slate-400">
                                Attempt #{t.attempt_number} • {formatDate(t.created_at)}
                              </div>
                            </div>
                            <div className="text-right">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  t.outcome === 'pass'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                }`}
                              >
                                {t.score_pct != null ? `${t.score_pct}%` : ''} {t.outcome?.toUpperCase() || 'EVALUATED'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* APPROVE / REJECT PROPOSAL MODAL */}
      {approvalModalCohort && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Review Cohort Proposal
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {approvalModalCohort.name} ({approvalModalCohort.track})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApprovalModalCohort(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessApproval} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Decision *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setApprovalAction('approve')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center space-x-1.5 cursor-pointer ${
                      approvalAction === 'approve'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve Proposal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalAction('reject')}
                    className={`py-2 px-3 text-xs font-semibold rounded-lg border flex items-center justify-center space-x-1.5 cursor-pointer ${
                      approvalAction === 'reject'
                        ? 'bg-rose-50 border-rose-500 text-rose-800'
                        : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Reject Proposal</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Review Notes (Optional)
                </label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Notes for the RM and academic lead..."
                  rows={3}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setApprovalModalCohort(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingApproval}
                  className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center space-x-1.5 cursor-pointer ${
                    approvalAction === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {processingApproval ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Submit Decision</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASSIGN MENTOR MODAL */}
      {reassignModalCohort && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Reassign Cohort Mentor
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cohort: {reassignModalCohort.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReassignModalCohort(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReassignMentor} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select New Mentor *
                </label>
                <select
                  value={selectedNewMentorId}
                  onChange={(e) => setSelectedNewMentorId(e.target.value)}
                  required
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                >
                  {mentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.first_name} {m.last_name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Reason for Reassignment (Notified to Academic Lead)
                </label>
                <textarea
                  value={reassignNotes}
                  onChange={(e) => setReassignNotes(e.target.value)}
                  placeholder="Reason for mentor change, scheduling conflict, etc..."
                  rows={3}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setReassignModalCohort(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning || !selectedNewMentorId}
                  className="px-4 py-2 bg-[#1B3270] hover:bg-[#152758] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {reassigning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Reassigning...</span>
                    </>
                  ) : (
                    <span>Confirm Reassignment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadCohortsTab;
