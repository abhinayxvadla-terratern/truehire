import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  Search,
  UserCheck,
  CheckCircle,
  ChevronRight,
  X,
  AlertTriangle,
  Loader2,
  RefreshCw,
  BookOpen,
  Edit,
  GraduationCap,
  Trash2,
  UserX,
} from 'lucide-react';
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

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

export const CohortsTab: React.FC = () => {
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [trackFilters, setTrackFilters] = useState<string[]>([]);
  const [mentorFilter, setMentorFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cohortToDelete, setCohortToDelete] = useState<CohortRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Selected Cohort Detail
  const [selectedCohort, setSelectedCohort] = useState<CohortRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [members, setMembers] = useState<CohortMember[]>([]);
  const [sessions, setSessions] = useState<BootcampSession[]>([]);
  const [finalTests, setFinalTests] = useState<MemberFinalTest[]>([]);

  // Action Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedNewMentorId, setSelectedNewMentorId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideStatusVal, setOverrideStatusVal] = useState<string>('active');
  const [overriding, setOverriding] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchMentors = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('is_internal', true)
        .in('internal_role', ['academic_mentor', 'academic_lead', 'super_admin']);
      if (data) {
        setMentors(
          data.map((d: any) => ({
            id: d.id,
            first_name: d.first_name || '',
            last_name: d.last_name || '',
            email: d.email || '',
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching mentors:', err);
    }
  };

  const fetchCohorts = async () => {
    try {
      setLoading(true);
      const { data: cohortList, error } = await supabase
        .from('cohorts')
        .select(`
          id,
          name,
          track,
          status,
          start_date,
          end_date,
          created_at,
          mentor_id,
          created_by,
          mentor:mentor_id (first_name, last_name, email),
          creator:created_by (first_name, last_name, email),
          cohort_members (id),
          bootcamp_sessions (id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: CohortRow[] = (cohortList || []).map((c: any) => {
        const mentorName = c.mentor
          ? `${c.mentor.first_name || ''} ${c.mentor.last_name || ''}`.trim() || c.mentor.email
          : 'Unassigned';
        const creatorName = c.creator
          ? `${c.creator.first_name || ''} ${c.creator.last_name || ''}`.trim() || c.creator.email
          : '—';

        return {
          id: c.id,
          name: c.name,
          track: c.track || 'nursing',
          status: c.status || 'proposed',
          start_date: c.start_date,
          end_date: c.end_date,
          created_at: c.created_at,
          mentor_id: c.mentor_id,
          created_by: c.created_by,
          mentor_name: mentorName,
          creator_name: creatorName,
          member_count: c.cohort_members?.length || 0,
          session_count: c.bootcamp_sessions?.length || 0,
        };
      });

      setCohorts(mapped);
    } catch (err) {
      console.error('Error fetching cohorts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMentors();
    fetchCohorts();
  }, []);

  const fetchCohortDetails = async (cohort: CohortRow) => {
    setSelectedCohort(cohort);
    setDetailLoading(true);
    try {
      // 1. Members
      const { data: memberData } = await supabase
        .from('cohort_members')
        .select(`
          id,
          candidate_id,
          status,
          joined_at,
          candidates (first_name, last_name, user_id, profiles:user_id(email))
        `)
        .eq('cohort_id', cohort.id);

      const mappedMembers: CohortMember[] = (memberData || []).map((m: any) => {
        const c = m.candidates;
        const name = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : 'Candidate';
        const email = c?.profiles?.email || '—';
        return {
          id: m.id,
          candidate_id: m.candidate_id,
          candidate_name: name || `Candidate #${m.candidate_id.slice(0, 6)}`,
          candidate_email: email,
          status: m.status || 'active',
          joined_at: m.joined_at,
        };
      });
      setMembers(mappedMembers);

      // 2. Sessions & attendance
      const { data: sessionData } = await supabase
        .from('bootcamp_sessions')
        .select('id, session_number, session_title, session_date, session_time, status, duration_minutes')
        .eq('cohort_id', cohort.id)
        .order('session_number', { ascending: true });

      const totalMembersCount = mappedMembers.length;

      const sessionsWithAttendance: BootcampSession[] = await Promise.all(
        (sessionData || []).map(async (s: any) => {
          const { count } = await supabase
            .from('bootcamp_attendance')
            .select('id', { count: 'exact', head: true })
            .eq('session_id', s.id)
            .eq('attended', true);

          const attendedCount = count || 0;
          const pct = totalMembersCount > 0 ? Math.round((attendedCount / totalMembersCount) * 100) : 0;
          return {
            id: s.id,
            session_number: s.session_number,
            session_title: s.session_title,
            session_date: s.session_date,
            session_time: s.session_time,
            status: s.status || 'scheduled',
            duration_minutes: s.duration_minutes,
            attendance_pct: pct,
          };
        })
      );
      setSessions(sessionsWithAttendance);

      // 3. Final test attempts
      const { data: testData } = await supabase
        .from('final_test_attempts')
        .select(`
          id,
          candidate_id,
          attempt_number,
          score,
          score_pct,
          outcome,
          review_status,
          created_at,
          candidates (first_name, last_name)
        `)
        .eq('cohort_id', cohort.id)
        .order('created_at', { ascending: false });

      const mappedTests: MemberFinalTest[] = (testData || []).map((t: any) => {
        const c = t.candidates;
        const name = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : 'Candidate';
        return {
          id: t.id,
          candidate_id: t.candidate_id,
          candidate_name: name || `ID ${t.candidate_id?.slice(0, 6)}`,
          attempt_number: t.attempt_number,
          score: t.score,
          score_pct: t.score_pct,
          outcome: t.outcome,
          review_status: t.review_status,
          created_at: t.created_at,
        };
      });
      setFinalTests(mappedTests);
    } catch (err) {
      console.error('Error fetching cohort detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // SUPER ADMIN ACTIONS
  const handleCancelCohort = async () => {
    if (!selectedCohort || cancelling) return;
    setCancelling(true);
    try {
      const { error } = await supabase
        .from('cohorts')
        .update({ status: 'cancelled' })
        .eq('id', selectedCohort.id);

      if (error) throw error;

      // Dispatch notifications to members, mentor, RM
      const notificationsToInsert: any[] = [];

      // Enrolled members
      const { data: memberRows } = await supabase
        .from('cohort_members')
        .select('candidate_id, candidates(user_id)')
        .eq('cohort_id', selectedCohort.id);

      (memberRows || []).forEach((m: any) => {
        const uId = m.candidates?.user_id;
        if (uId) {
          notificationsToInsert.push({
            user_id: uId,
            type: 'general',
            title: 'Cohort Cancelled',
            message: `Your training cohort "${selectedCohort.name}" has been cancelled. Your Relationship Manager will coordinate your next steps.`,
          });
        }
      });

      // Mentor
      if (selectedCohort.mentor_id) {
        notificationsToInsert.push({
          user_id: selectedCohort.mentor_id,
          type: 'general',
          title: 'Cohort Cancelled',
          message: `Cohort "${selectedCohort.name}" has been cancelled by Super Admin.`,
        });
      }
      // Creator RM
      if (selectedCohort.created_by) {
        notificationsToInsert.push({
          user_id: selectedCohort.created_by,
          type: 'general',
          title: 'Cohort Cancelled',
          message: `Cohort "${selectedCohort.name}" has been cancelled by Super Admin.`,
        });
      }

      if (notificationsToInsert.length > 0) {
        await supabase.from('notifications').insert(notificationsToInsert);
      }

      showToast(`Cohort "${selectedCohort.name}" cancelled successfully.`);
      setShowCancelModal(false);
      fetchCohorts();
      setSelectedCohort({ ...selectedCohort, status: 'cancelled' });
    } catch (err: any) {
      console.error('Error cancelling cohort:', err);
      alert(err.message || 'Failed to cancel cohort.');
    } finally {
      setCancelling(false);
    }
  };

  const handleReassignMentor = async () => {
    if (!selectedCohort || !selectedNewMentorId || reassigning) return;
    setReassigning(true);
    try {
      const oldMentorId = selectedCohort.mentor_id;
      const { error } = await supabase
        .from('cohorts')
        .update({ mentor_id: selectedNewMentorId })
        .eq('id', selectedCohort.id);

      if (error) throw error;

      // Update mentor assignments for enrolled candidates
      const { data: memberCandidates } = await supabase
        .from('cohort_members')
        .select('candidate_id')
        .eq('cohort_id', selectedCohort.id);

      const candidateIds = (memberCandidates || []).map((m: any) => m.candidate_id);

      if (candidateIds.length > 0) {
        await supabase
          .from('mentor_assignments')
          .update({ active: false })
          .in('candidate_id', candidateIds)
          .eq('active', true);

        const newAssignments = candidateIds.map((cId: string) => ({
          candidate_id: cId,
          mentor_id: selectedNewMentorId,
          assigned_by: user?.id || selectedNewMentorId,
          active: true,
        }));

        await supabase.from('mentor_assignments').insert(newAssignments);
      }

      // Dispatch notifications
      const notifs: any[] = [
        {
          user_id: selectedNewMentorId,
          type: 'mentor_assignment',
          title: 'Assigned to Cohort',
          message: `You have been assigned as lead mentor for cohort "${selectedCohort.name}".`,
        },
      ];
      if (oldMentorId) {
        notifs.push({
          user_id: oldMentorId,
          type: 'general',
          title: 'Cohort Handover',
          message: `Your mentorship assignment for cohort "${selectedCohort.name}" was transferred.`,
        });
      }
      await supabase.from('notifications').insert(notifs);

      showToast('Mentor reassigned successfully.');
      setShowReassignModal(false);
      fetchCohorts();
      const newM = mentors.find((m) => m.id === selectedNewMentorId);
      setSelectedCohort({
        ...selectedCohort,
        mentor_id: selectedNewMentorId,
        mentor_name: newM ? `${newM.first_name} ${newM.last_name}`.trim() : 'Updated Mentor',
      });
    } catch (err: any) {
      console.error('Error reassigning mentor:', err);
      alert(err.message || 'Failed to reassign mentor.');
    } finally {
      setReassigning(false);
    }
  };

  const handleOverrideStatus = async () => {
    if (!selectedCohort || overriding) return;
    setOverriding(true);
    try {
      const { error } = await supabase
        .from('cohorts')
        .update({ status: overrideStatusVal })
        .eq('id', selectedCohort.id);

      if (error) throw error;

      showToast(`Cohort status updated to "${overrideStatusVal}".`);
      setShowOverrideModal(false);
      fetchCohorts();
      setSelectedCohort({ ...selectedCohort, status: overrideStatusVal });
    } catch (err: any) {
      console.error('Error overriding status:', err);
      alert(err.message || 'Failed to override cohort status.');
    } finally {
      setOverriding(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'proposed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Proposed</span>;
      case 'approved':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Approved</span>;
      case 'active':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span>;
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-white">Completed</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  const statusOptions = [
    { value: 'proposed', label: 'Proposed' },
    { value: 'approved', label: 'Approved' },
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ];

  const trackOptions = [
    { value: 'nursing', label: 'Nursing' },
    { value: 'allied_health', label: 'Allied Health' },
    { value: 'other', label: 'Other' },
  ];

  const handleDeleteCohortConfirm = async () => {
    if (!cohortToDelete) return;
    setIsDeleting(true);
    try {
      // 1. Drop members
      await supabase
        .from('cohort_members')
        .update({ status: 'dropped' })
        .eq('cohort_id', cohortToDelete.id);

      // 2. Delete sessions attendance and sessions
      const { data: sessData } = await supabase
        .from('bootcamp_sessions')
        .select('id')
        .eq('cohort_id', cohortToDelete.id);
      const sessionIds = (sessData || []).map((s: any) => s.id);
      if (sessionIds.length > 0) {
        await supabase
          .from('bootcamp_session_attendance')
          .delete()
          .in('session_id', sessionIds);
      }
      await supabase
        .from('bootcamp_sessions')
        .delete()
        .eq('cohort_id', cohortToDelete.id);

      // 3. Delete cohort
      const { error } = await supabase
        .from('cohorts')
        .delete()
        .eq('id', cohortToDelete.id);

      if (error) throw error;

      showToast('Cohort deleted.');
      setCohortToDelete(null);
      if (selectedCohort?.id === cohortToDelete.id) {
        setSelectedCohort(null);
      }
      fetchCohorts();
    } catch (err: any) {
      alert(`Failed to delete cohort: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredCohorts = cohorts.filter((c) => {
    if (statusFilters.length > 0 && !statusFilters.includes(c.status)) return false;
    if (trackFilters.length > 0 && !trackFilters.includes(c.track.toLowerCase())) return false;
    if (mentorFilter !== 'all' && c.mentor_id !== mentorFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchMentor = (c.mentor_name || '').toLowerCase().includes(q);
      if (!matchName && !matchMentor) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 text-sm">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">Cohorts Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Oversee all bootcamp training cohorts, review session progress, reassign mentors, and handle status overrides.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchCohorts();
          }}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search cohort or mentor name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3270] text-slate-800"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-44">
          <MultiSelectFilter
            label="Status"
            options={statusOptions}
            selectedValues={statusFilters}
            onChange={setStatusFilters}
          />
        </div>

        {/* Track Filter */}
        <div className="w-full sm:w-44">
          <MultiSelectFilter
            label="Track"
            options={trackOptions}
            selectedValues={trackFilters}
            onChange={setTrackFilters}
          />
        </div>

        {/* Mentor Filter */}
        <select
          value={mentorFilter}
          onChange={(e) => setMentorFilter(e.target.value)}
          className="border border-[#E2E8F4] rounded-[6px] px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
        >
          <option value="all">All Mentors</option>
          {mentors.map((m) => (
            <option key={m.id} value={m.id}>
              {m.first_name} {m.last_name}
            </option>
          ))}
        </select>
      </div>

      {/* Cohorts Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading cohorts...</p>
          </div>
        ) : filteredCohorts.length === 0 ? (
          <div className="py-16 text-center">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No cohorts found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No training cohorts match your filter criteria or have been created yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F4] text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Cohort Name</th>
                  <th className="px-4 py-3.5">Track</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Mentor</th>
                  <th className="px-4 py-3.5">Members</th>
                  <th className="px-4 py-3.5">Sessions</th>
                  <th className="px-4 py-3.5">Start Date</th>
                  <th className="px-4 py-3.5">End Date</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4]">
                {filteredCohorts.map((cohort) => (
                  <tr key={cohort.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {cohort.name}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 capitalize">
                        {cohort.track.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(cohort.status)}</td>
                    <td className="px-4 py-3.5 text-slate-700 font-medium">
                      {cohort.mentor_name}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {cohort.member_count}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-700">
                      {cohort.session_count}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {cohort.start_date ? new Date(cohort.start_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {cohort.end_date ? new Date(cohort.end_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => fetchCohortDetails(cohort)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] hover:bg-slate-100 rounded transition-colors"
                        >
                          <span>View</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCohortToDelete(cohort)}
                          className="inline-flex items-center space-x-1 h-7 px-2.5 text-xs font-semibold text-[#EF4444] border border-[#EF4444] rounded-[6px] hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete cohort"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* COHORT DETAIL PANEL (SLIDE-OVER) */}
      {selectedCohort && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#E2E8F4] flex items-start justify-between bg-slate-50">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-[#1B3270]">{selectedCohort.name}</h2>
                  {getStatusBadge(selectedCohort.status)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Track: <span className="font-semibold capitalize">{selectedCohort.track.replace('_', ' ')}</span> • Created by: {selectedCohort.creator_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCohort(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Super Admin Action Controls */}
            <div className="p-4 bg-slate-100/70 border-b border-[#E2E8F4] flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedNewMentorId(selectedCohort.mentor_id || '');
                  setShowReassignModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors shadow-2xs flex items-center space-x-1.5"
              >
                <UserCheck className="w-3.5 h-3.5 text-[#1B3270]" />
                <span>Reassign Mentor</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOverrideStatusVal(selectedCohort.status);
                  setShowOverrideModal(true);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors shadow-2xs flex items-center space-x-1.5"
              >
                <Edit className="w-3.5 h-3.5 text-amber-600" />
                <span>Override Status</span>
              </button>

              {selectedCohort.status !== 'cancelled' && (
                <button
                  type="button"
                  onClick={() => setShowCancelModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-[6px] hover:bg-rose-100 transition-colors shadow-2xs flex items-center space-x-1.5 ml-auto"
                >
                  <UserX className="w-3.5 h-3.5 text-rose-600" />
                  <span>Cancel Cohort</span>
                </button>
              )}
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {detailLoading ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">Loading cohort details...</p>
                </div>
              ) : (
                <>
                  {/* Lead Mentor Card */}
                  <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">Assigned Mentor</span>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedCohort.mentor_name}</p>
                    </div>
                    <GraduationCap className="w-6 h-6 text-[#1B3270]" />
                  </div>

                  {/* Section: Members Roster */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center justify-between">
                      <span>Cohort Members ({members.length})</span>
                    </h3>
                    <div className="bg-white border border-[#E2E8F4] rounded-[10px] overflow-hidden shadow-2xs">
                      {members.length === 0 ? (
                        <p className="p-4 text-xs text-slate-400 text-center">No candidates enrolled in this cohort.</p>
                      ) : (
                        <div className="divide-y divide-[#E2E8F4] max-h-48 overflow-y-auto">
                          {members.map((m) => (
                            <div key={m.id} className="p-3 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-semibold text-slate-800">{m.candidate_name}</p>
                                <p className="text-[11px] text-slate-400">{m.candidate_email}</p>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 capitalize">
                                {m.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section: Bootcamp Sessions & Attendance */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      Bootcamp Sessions & Attendance ({sessions.length})
                    </h3>
                    <div className="bg-white border border-[#E2E8F4] rounded-[10px] overflow-hidden shadow-2xs">
                      {sessions.length === 0 ? (
                        <p className="p-4 text-xs text-slate-400 text-center">No bootcamp sessions scheduled yet.</p>
                      ) : (
                        <div className="divide-y divide-[#E2E8F4] max-h-56 overflow-y-auto">
                          {sessions.map((s) => (
                            <div key={s.id} className="p-3 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-semibold text-slate-800">
                                  #{s.session_number}: {s.session_title}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {s.session_date} at {s.session_time} ({s.duration_minutes || 60}m) • {s.status}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  {s.attendance_pct}% Attended
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section: Final Test Attempts */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                      Final Assessment Attempts ({finalTests.length})
                    </h3>
                    <div className="bg-white border border-[#E2E8F4] rounded-[10px] overflow-hidden shadow-2xs">
                      {finalTests.length === 0 ? (
                        <p className="p-4 text-xs text-slate-400 text-center">No final assessment attempts recorded yet.</p>
                      ) : (
                        <div className="divide-y divide-[#E2E8F4] max-h-56 overflow-y-auto">
                          {finalTests.map((t) => (
                            <div key={t.id} className="p-3 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-semibold text-slate-800">{t.candidate_name}</p>
                                <p className="text-[11px] text-slate-400">
                                  Attempt #{t.attempt_number} • {new Date(t.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-slate-700">
                                  {t.score_pct ?? t.score ?? 0}%
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    t.outcome === 'pass'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-rose-50 text-rose-700'
                                  }`}
                                >
                                  {t.outcome ? t.outcome.toUpperCase() : 'PENDING'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CANCEL COHORT MODAL */}
      {showCancelModal && selectedCohort && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-slate-800">Cancel Cohort</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel <strong>"{selectedCohort.name}"</strong>? All enrolled members, assigned mentor ({selectedCohort.mentor_name}), and creating RM will be notified immediately.
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[6px]"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={handleCancelCohort}
                disabled={cancelling}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-[6px] disabled:opacity-50 flex items-center space-x-1.5"
              >
                {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Cancellation</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REASSIGN MENTOR MODAL */}
      {showReassignModal && selectedCohort && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Reassign Mentor</h3>
              <button onClick={() => setShowReassignModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Select an academic mentor to take over supervision of <strong>"{selectedCohort.name}"</strong>.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Lead Mentor</label>
              <select
                value={selectedNewMentorId}
                onChange={(e) => setSelectedNewMentorId(e.target.value)}
                className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              >
                <option value="">Select a mentor...</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.first_name} {m.last_name} ({m.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReassignModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[6px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReassignMentor}
                disabled={reassigning || !selectedNewMentorId}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] disabled:opacity-50 flex items-center space-x-1.5"
              >
                {reassigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Assign Mentor</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OVERRIDE STATUS MODAL */}
      {showOverrideModal && selectedCohort && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">Override Cohort Status</h3>
              <button onClick={() => setShowOverrideModal(false)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Manually change the workflow stage for <strong>"{selectedCohort.name}"</strong>.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Status</label>
              <select
                value={overrideStatusVal}
                onChange={(e) => setOverrideStatusVal(e.target.value)}
                className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              >
                <option value="proposed">Proposed</option>
                <option value="approved">Approved</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[6px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleOverrideStatus}
                disabled={overriding}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] disabled:opacity-50 flex items-center space-x-1.5"
              >
                {overriding && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Override</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {cohortToDelete && (
        <DeleteConfirmationModal
          isOpen={true}
          tier="tier2"
          entityType="Cohort"
          entityName={cohortToDelete.name}
          bodyText="Deleting this cohort removes all sessions and attendance records."
          onClose={() => setCohortToDelete(null)}
          onConfirm={handleDeleteCohortConfirm}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
