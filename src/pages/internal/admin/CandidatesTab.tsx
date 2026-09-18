import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  Search,
  Users,
  Eye,
  X,
  CheckCircle,
  ShieldAlert,
  Send,
  UserCheck,
  Award,
  Loader2,
  ChevronDown,
  Edit,
  Trash2,
  AlertTriangle,
  Clock,
  HelpCircle,
  GraduationCap,
} from 'lucide-react';
import { getGateLabel, getCandidateStatusLabel } from '../../../utils/labels';
import { CandidateProfileDetailView } from '../components/CandidateProfileDetailView';
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

interface CandidateRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  target_role: string | null;
  status: string;
  created_at: string;
  user_id: string | null;
  supplier_id: string | null;
  language_level_self_reported: string | null;
  nationality: string | null;
  supplier_name?: string;
  user_email?: string;
  user_phone?: string;
  current_gate?: string;
  // Updates
  dt_attempt_count: number;
  is_cooling: boolean;
  cooling_ends_at?: string;
  consecutive_final_test_fails: number;
  final_test_locked: boolean;
  cohort_id: string | null;
  cohort_name: string;
  can_apply_to_jobs: boolean;
  dt_passed_at: string | null;
}

interface GateResultRow {
  id: string;
  gate_type: string;
  status: string;
  score: number | null;
  review_status: string;
  notes: string | null;
  created_at: string;
  recorded_by_name?: string;
}

interface ApplicationRow {
  id: string;
  status: string;
  created_at: string;
  job_title?: string;
}

interface InternalNoteRow {
  id: string;
  note: string;
  note_type: string;
  is_escalation: boolean;
  created_at: string;
  author_name?: string;
}

interface MentorProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface CohortItem {
  id: string;
  name: string;
  track?: string;
}

interface DtAttemptItem {
  id: string;
  attempt_number: number;
  correct_answers: number | null;
  total_questions: number | null;
  score_pct: number | null;
  passed: boolean | null;
  started_at: string | null;
  completed_at: string | null;
  auto_submitted?: boolean | null;
  time_limit_seconds?: number | null;
}

interface DtAnswerItem {
  id: string;
  selected_option: string | null;
  is_correct: boolean | null;
  question_text?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_option?: string;
}

interface FinalTestAttemptItem {
  id: string;
  attempt_number: number;
  score_pct: number | null;
  outcome: string | null;
  review_status: string | null;
  mentor_notes: string | null;
  created_at: string;
}

const GATE_OPTIONS = [
  { value: 'dt', label: 'Diagnostic Test (DT)' },
  { value: 'documents', label: 'Document Verification' },
  { value: 'speaking_test', label: 'Speaking Test' },
  { value: 'bootcamp', label: 'Interview Bootcamp' },
  { value: 'assessment', label: 'Final Assessment' },
];

export const CandidatesTab: React.FC = () => {
  const { user } = useAuth();

  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; company_name: string }[]>([]);
  const [cohortsList, setCohortsList] = useState<CohortItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (Multi-select)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [roleFilter, setRoleFilter] = useState<string[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<string[]>([]);
  const [cohortFilter, setCohortFilter] = useState('all');
  const [dtStatusFilter, setDtStatusFilter] = useState('all'); // all | passed | failed | cooling_active | attempt_limit_reached
  const [finalTestFilter, setFinalTestFilter] = useState('all'); // all | passed | failed | locked | not_started

  // Selected candidate detail panel
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  // Detail Sub-states
  const [gateResults, setGateResults] = useState<GateResultRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [notes, setNotes] = useState<InternalNoteRow[]>([]);
  const [mentorList, setMentorList] = useState<MentorProfile[]>([]);
  const [assignedMentorId, setAssignedMentorId] = useState<string>('');
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);

  // Detail DT History
  const [dtAttempts, setDtAttempts] = useState<DtAttemptItem[]>([]);
  const [activeCoolingPeriod, setActiveCoolingPeriod] = useState<any | null>(null);
  const [viewAnswersAttemptId, setViewAnswersAttemptId] = useState<string | null>(null);
  const [attemptAnswers, setAttemptAnswers] = useState<DtAnswerItem[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);

  // Detail Cohort Progress
  const [candidateCohortInfo, setCandidateCohortInfo] = useState<any | null>(null);
  const [sessionsAttendedCount, setSessionsAttendedCount] = useState<number>(0);
  const [totalCohortSessionsCount, setTotalCohortSessionsCount] = useState<number>(0);
  const [finalTestAttempts, setFinalTestAttempts] = useState<FinalTestAttemptItem[]>([]);

  // Editable Candidate Fields
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editTargetRole, setEditTargetRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editGermanLevel, setEditGermanLevel] = useState('');
  const [editNationality, setEditNationality] = useState('');
  const [savingCandidate, setSavingCandidate] = useState(false);

  // New Note
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteType, setNewNoteType] = useState('general');
  const [newNoteIsEscalation, setNewNoteIsEscalation] = useState(false);
  const [submittingNote, setSubmittingNote] = useState(false);

  // Gate Override Form
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideGateType, setOverrideGateType] = useState('dt');
  const [overrideStatus, setOverrideStatus] = useState<'pass' | 'fail'>('pass');
  const [overrideScore, setOverrideScore] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [resetConsecutiveFails, setResetConsecutiveFails] = useState(false);
  const [submittingOverride, setSubmittingOverride] = useState(false);
  const [overrideSuccessMessage, setOverrideSuccessMessage] = useState<string | null>(null);

  // Candidate Actions Dropdown & Modal States
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Quick Edit Modal
  const [quickEditCandidate, setQuickEditCandidate] = useState<CandidateRow | null>(null);
  const [quickEditFirstName, setQuickEditFirstName] = useState('');
  const [quickEditLastName, setQuickEditLastName] = useState('');
  const [quickEditTargetRole, setQuickEditTargetRole] = useState('');
  const [quickEditStatus, setQuickEditStatus] = useState('');
  const [quickEditGermanLevel, setQuickEditGermanLevel] = useState('');
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);

  // Delete Candidate Modal
  const [deleteTargetCandidate, setDeleteTargetCandidate] = useState<CandidateRow | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const handleDocClick = () => setOpenDropdownId(null);
    window.addEventListener('click', handleDocClick);
    return () => window.removeEventListener('click', handleDocClick);
  }, []);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      // 1. Fetch suppliers for filter
      const { data: sups } = await supabase
        .from('suppliers')
        .select('id, company_name')
        .order('company_name');
      if (sups) setSuppliers(sups);

      // 2. Fetch cohorts for filter
      const { data: cohs } = await supabase
        .from('cohorts')
        .select('id, name, track')
        .order('name');
      if (cohs) setCohortsList(cohs);

      // 3. Fetch active cooling periods
      const nowIso = new Date().toISOString();
      const { data: coolings } = await supabase
        .from('cooling_periods')
        .select('candidate_id, gate_type, ends_at, status')
        .eq('status', 'active')
        .gt('ends_at', nowIso);

      const coolingMap: Record<string, { ends_at: string; gate_type: string }> = {};
      (coolings || []).forEach((c) => {
        if (c.candidate_id) {
          coolingMap[c.candidate_id] = { ends_at: c.ends_at, gate_type: c.gate_type };
        }
      });

      // 4. Fetch candidates with supplier & profile joins
      const { data: cands, error } = await supabase
        .from('candidates')
        .select(`
          id,
          first_name,
          last_name,
          target_role,
          status,
          created_at,
          user_id,
          supplier_id,
          language_level_self_reported,
          nationality,
          dt_attempt_count,
          dt_passed_at,
          consecutive_final_test_fails,
          final_test_locked,
          cohort_id,
          can_apply_to_jobs,
          suppliers (company_name),
          cohorts:cohort_id (id, name),
          profiles:user_id (email, phone)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // 5. Fetch latest gate result for each candidate
      const { data: gates } = await supabase
        .from('gate_results')
        .select('candidate_id, gate_type, created_at')
        .order('created_at', { ascending: false });

      const latestGateMap: Record<string, string> = {};
      if (gates) {
        gates.forEach((g) => {
          if (!latestGateMap[g.candidate_id]) {
            latestGateMap[g.candidate_id] = g.gate_type;
          }
        });
      }

      const rows: CandidateRow[] = (cands || []).map((c: any) => {
        const cool = coolingMap[c.id];
        return {
          id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          target_role: c.target_role,
          status: c.status,
          created_at: c.created_at,
          user_id: c.user_id,
          supplier_id: c.supplier_id,
          language_level_self_reported: c.language_level_self_reported,
          nationality: c.nationality,
          dt_attempt_count: c.dt_attempt_count || 0,
          dt_passed_at: c.dt_passed_at || null,
          consecutive_final_test_fails: c.consecutive_final_test_fails || 0,
          final_test_locked: Boolean(c.final_test_locked),
          cohort_id: c.cohort_id || null,
          cohort_name: c.cohorts?.name || '—',
          can_apply_to_jobs: Boolean(c.can_apply_to_jobs),
          is_cooling: Boolean(cool),
          cooling_ends_at: cool?.ends_at,
          supplier_name: c.suppliers?.company_name || 'Direct Candidate',
          user_email: c.profiles?.email || 'No account yet',
          user_phone: c.profiles?.phone || '—',
          current_gate: latestGateMap[c.id] || 'Not started',
        };
      });

      setCandidates(rows);
    } catch (err) {
      console.error('Error fetching candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  // Filter logic
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Search
      const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
      const email = (c.user_email || '').toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      if (query && !fullName.includes(query) && !email.includes(query)) {
        return false;
      }

      // Status (Multi-select)
      if (statusFilter.length > 0 && !statusFilter.includes(c.status)) {
        return false;
      }

      // Role (Multi-select)
      if (roleFilter.length > 0) {
        const target = (c.target_role || '').toLowerCase();
        const matchesRole = roleFilter.some((rf) => {
          if (rf === 'nursing') return target.includes('nurs');
          if (rf === 'ausbildung') return target.includes('ausbild');
          if (rf === 'care') return target.includes('care');
          if (rf === 'other') {
            return !target.includes('nurs') && !target.includes('ausbild') && !target.includes('care');
          }
          return target.includes(rf.toLowerCase());
        });
        if (!matchesRole) return false;
      }

      // Supplier (Multi-select)
      if (supplierFilter.length > 0) {
        const matchesSupplier = supplierFilter.some((sf) => {
          if (sf === 'self') return c.supplier_id === null;
          return c.supplier_name === sf;
        });
        if (!matchesSupplier) return false;
      }

      // Cohort filter
      if (cohortFilter !== 'all' && c.cohort_id !== cohortFilter) {
        return false;
      }

      // DT Status filter
      if (dtStatusFilter !== 'all') {
        if (dtStatusFilter === 'passed' && !c.dt_passed_at) return false;
        if (dtStatusFilter === 'failed' && (c.dt_attempt_count === 0 || c.dt_passed_at)) return false;
        if (dtStatusFilter === 'cooling_active' && !c.is_cooling) return false;
        if (dtStatusFilter === 'attempt_limit_reached' && c.dt_attempt_count < 10) return false;
      }

      // Final Test filter
      if (finalTestFilter !== 'all') {
        if (finalTestFilter === 'passed' && c.status !== 'placed' && c.status !== 'interview_ready') {
          return false;
        }
        if (finalTestFilter === 'failed' && c.consecutive_final_test_fails === 0) return false;
        if (finalTestFilter === 'locked' && !c.final_test_locked) return false;
        if (finalTestFilter === 'not_started' && (c.consecutive_final_test_fails > 0 || c.final_test_locked)) {
          return false;
        }
      }

      return true;
    });
  }, [
    candidates,
    searchQuery,
    statusFilter,
    roleFilter,
    supplierFilter,
    cohortFilter,
    dtStatusFilter,
    finalTestFilter,
  ]);

  // Load full candidate detail panel
  const handleOpenDetail = async (cand: CandidateRow) => {
    setSelectedCandidate(cand);
    setEditFirstName(cand.first_name || '');
    setEditLastName(cand.last_name || '');
    setEditTargetRole(cand.target_role || '');
    setEditStatus(cand.status || 'onboarding');
    setEditGermanLevel(cand.language_level_self_reported || '');
    setEditNationality(cand.nationality || '');
    setOverrideSuccessMessage(null);
    setPanelLoading(true);

    try {
      const nowIso = new Date().toISOString();

      // Parallel queries for candidate details
      const [
        gatesRes,
        appsRes,
        notesRes,
        mentorListRes,
        assignmentRes,
        dtAttemptsRes,
        coolingRes,
        finalTestsRes,
      ] = await Promise.all([
        supabase
          .from('gate_results')
          .select(`
            id,
            gate_type,
            status,
            score,
            review_status,
            notes,
            created_at,
            profiles:recorded_by (first_name, last_name, email)
          `)
          .eq('candidate_id', cand.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('job_applications')
          .select(`
            id,
            status,
            created_at,
            job_requirements (title)
          `)
          .eq('candidate_id', cand.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('internal_notes')
          .select(`
            id,
            note,
            note_type,
            is_escalation,
            created_at,
            profiles:author_id (first_name, last_name, email)
          `)
          .eq('candidate_id', cand.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .eq('is_internal', true)
          .in('internal_role', ['academic_mentor', 'mentor', 'super_admin']),

        supabase
          .from('mentor_assignments')
          .select('id, mentor_profile_id')
          .eq('candidate_id', cand.id)
          .eq('active', true)
          .maybeSingle(),

        // DT attempts
        supabase
          .from('dt_attempts')
          .select('id, attempt_number, correct_answers, total_questions, score_pct, passed, started_at, completed_at, auto_submitted, time_limit_seconds')
          .eq('candidate_id', cand.id)
          .order('attempt_number', { ascending: false }),

        // Cooling
        supabase
          .from('cooling_periods')
          .select('*')
          .eq('candidate_id', cand.id)
          .eq('status', 'active')
          .gt('ends_at', nowIso)
          .maybeSingle(),

        // Final tests
        supabase
          .from('final_test_attempts')
          .select('id, attempt_number, score_pct, outcome, review_status, mentor_notes, created_at')
          .eq('candidate_id', cand.id)
          .order('created_at', { ascending: false }),
      ]);

      // Gates
      const gateRows: GateResultRow[] = (gatesRes.data || []).map((g: any) => ({
        id: g.id,
        gate_type: g.gate_type,
        status: g.status,
        score: g.score,
        review_status: g.review_status,
        notes: g.notes,
        created_at: g.created_at,
        recorded_by_name: g.profiles
          ? `${g.profiles.first_name || ''} ${g.profiles.last_name || ''}`.trim() || g.profiles.email
          : 'System / Automated',
      }));
      setGateResults(gateRows);

      // Apps
      const appRows: ApplicationRow[] = (appsRes.data || []).map((a: any) => ({
        id: a.id,
        status: a.status,
        created_at: a.created_at,
        job_title: a.job_requirements?.title || 'Job Position',
      }));
      setApplications(appRows);

      // Notes
      const noteRows: InternalNoteRow[] = (notesRes.data || []).map((n: any) => ({
        id: n.id,
        note: n.note,
        note_type: n.note_type,
        is_escalation: n.is_escalation,
        created_at: n.created_at,
        author_name: n.profiles
          ? `${n.profiles.first_name || ''} ${n.profiles.last_name || ''}`.trim() || n.profiles.email
          : 'Staff Member',
      }));
      setNotes(noteRows);

      // Mentors
      setMentorList(mentorListRes.data || []);
      if (assignmentRes.data) {
        setAssignedMentorId(assignmentRes.data.mentor_profile_id);
        setActiveAssignmentId(assignmentRes.data.id);
      } else {
        setAssignedMentorId('');
        setActiveAssignmentId(null);
      }

      // DT History
      setDtAttempts(dtAttemptsRes.data || []);
      setActiveCoolingPeriod(coolingRes.data || null);

      // Cohort & Attendance details
      if (cand.cohort_id) {
        const { data: cohortData } = await supabase
          .from('cohorts')
          .select('id, name, track, start_date, end_date')
          .eq('id', cand.cohort_id)
          .single();

        setCandidateCohortInfo(cohortData || null);

        // Fetch sessions and candidate attendance
        const { data: cohortSessions } = await supabase
          .from('bootcamp_sessions')
          .select('id')
          .eq('cohort_id', cand.cohort_id);

        const totalSess = cohortSessions?.length || 0;
        setTotalCohortSessionsCount(totalSess);

        if (totalSess > 0 && cohortSessions) {
          const sessionIds = cohortSessions.map((s) => s.id);
          const { count: attended } = await supabase
            .from('bootcamp_attendance')
            .select('id', { count: 'exact', head: true })
            .in('session_id', sessionIds)
            .eq('candidate_id', cand.id)
            .eq('attended', true);

          setSessionsAttendedCount(attended || 0);
        } else {
          setSessionsAttendedCount(0);
        }
      } else {
        setCandidateCohortInfo(null);
        setSessionsAttendedCount(0);
        setTotalCohortSessionsCount(0);
      }

      // Final tests
      setFinalTestAttempts(finalTestsRes.data || []);
    } catch (err) {
      console.error('Error fetching candidate detail data:', err);
    } finally {
      setPanelLoading(false);
    }
  };

  // View Answers for a DT Attempt
  const handleViewAttemptAnswers = async (attemptId: string) => {
    setViewAnswersAttemptId(attemptId);
    setLoadingAnswers(true);
    try {
      const { data, error } = await supabase
        .from('dt_answers')
        .select(`
          id,
          selected_option,
          is_correct,
          dt_questions:question_id (
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_option
          )
        `)
        .eq('attempt_id', attemptId);

      if (error) throw error;

      const mapped: DtAnswerItem[] = (data || []).map((a: any) => ({
        id: a.id,
        selected_option: a.selected_option,
        is_correct: a.is_correct,
        question_text: a.dt_questions?.question_text || 'Question text not available',
        option_a: a.dt_questions?.option_a || '—',
        option_b: a.dt_questions?.option_b || '—',
        option_c: a.dt_questions?.option_c || '—',
        option_d: a.dt_questions?.option_d || '—',
        correct_option: a.dt_questions?.correct_option || '—',
      }));

      setAttemptAnswers(mapped);
    } catch (err) {
      console.error('Error fetching attempt answers:', err);
    } finally {
      setLoadingAnswers(false);
    }
  };

  // Save Candidate Profile Fields
  const handleSaveCandidateProfile = async () => {
    if (!selectedCandidate) return;
    setSavingCandidate(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          target_role: editTargetRole.trim(),
          status: editStatus,
          language_level_self_reported: editGermanLevel.trim(),
          nationality: editNationality.trim(),
        })
        .eq('id', selectedCandidate.id);

      if (error) throw error;

      // Update local candidates list
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === selectedCandidate.id
            ? {
                ...c,
                first_name: editFirstName.trim(),
                last_name: editLastName.trim(),
                target_role: editTargetRole.trim(),
                status: editStatus,
                language_level_self_reported: editGermanLevel.trim(),
                nationality: editNationality.trim(),
              }
            : c
        )
      );

      setSelectedCandidate((prev) =>
        prev
          ? {
              ...prev,
              first_name: editFirstName.trim(),
              last_name: editLastName.trim(),
              target_role: editTargetRole.trim(),
              status: editStatus,
              language_level_self_reported: editGermanLevel.trim(),
              nationality: editNationality.trim(),
            }
          : null
      );
    } catch (err: any) {
      alert(`Failed to update candidate: ${err.message}`);
    } finally {
      setSavingCandidate(false);
    }
  };

  // Quick Edit Save
  const handleSaveQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEditCandidate) return;
    setSavingQuickEdit(true);
    try {
      const { error } = await supabase
        .from('candidates')
        .update({
          first_name: quickEditFirstName.trim(),
          last_name: quickEditLastName.trim(),
          target_role: quickEditTargetRole.trim(),
          status: quickEditStatus,
          language_level_self_reported: quickEditGermanLevel.trim(),
        })
        .eq('id', quickEditCandidate.id);

      if (error) throw error;

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === quickEditCandidate.id
            ? {
                ...c,
                first_name: quickEditFirstName.trim(),
                last_name: quickEditLastName.trim(),
                target_role: quickEditTargetRole.trim(),
                status: quickEditStatus,
                language_level_self_reported: quickEditGermanLevel.trim(),
              }
            : c
        )
      );

      setQuickEditCandidate(null);
    } catch (err: any) {
      alert(`Failed to update candidate: ${err.message}`);
    } finally {
      setSavingQuickEdit(false);
    }
  };

  // Candidate Deletion (Tier 1)
  const handleConfirmDelete = async () => {
    if (!deleteTargetCandidate) return;
    setDeletingCandidate(true);
    try {
      const { error } = await supabase.rpc('admin_delete_candidate', {
        p_candidate_id: deleteTargetCandidate.id,
      });
      if (error) throw error;

      showToast('Candidate deleted.');
      setCandidates((prev) => prev.filter((c) => c.id !== deleteTargetCandidate.id));
      if (selectedCandidate?.id === deleteTargetCandidate.id) {
        setSelectedCandidate(null);
      }
      setDeleteTargetCandidate(null);
    } catch (err: any) {
      console.error('Error deleting candidate:', err);
      alert(`Failed to delete candidate: ${err.message}`);
    } finally {
      setDeletingCandidate(false);
    }
  };

  // Assign or Reassign Mentor
  const handleAssignMentor = async (newMentorId: string) => {
    if (!selectedCandidate || !user) return;
    try {
      if (activeAssignmentId) {
        await supabase
          .from('mentor_assignments')
          .update({ active: false })
          .eq('id', activeAssignmentId);
      }

      if (newMentorId) {
        const { data, error } = await supabase
          .from('mentor_assignments')
          .insert({
            candidate_id: selectedCandidate.id,
            mentor_profile_id: newMentorId,
            active: true,
          })
          .select('id')
          .single();

        if (error) throw error;
        setActiveAssignmentId(data.id);
        setAssignedMentorId(newMentorId);
      } else {
        setAssignedMentorId('');
        setActiveAssignmentId(null);
      }
    } catch (err: any) {
      alert(`Failed to update mentor: ${err.message}`);
    }
  };

  // Submit Internal Note
  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate || !user || !newNoteText.trim()) return;

    setSubmittingNote(true);
    try {
      const { data, error } = await supabase
        .from('internal_notes')
        .insert({
          candidate_id: selectedCandidate.id,
          author_id: user.id,
          note: newNoteText.trim(),
          note_type: newNoteType,
          is_escalation: newNoteIsEscalation,
        })
        .select(`
          id,
          note,
          note_type,
          is_escalation,
          created_at,
          profiles:author_id (first_name, last_name, email)
        `)
        .single();

      if (error) throw error;

      if (newNoteIsEscalation) {
        await supabase.from('escalations').insert({
          entity_type: 'candidate',
          entity_id: selectedCandidate.id,
          raised_by: user.id,
          status: 'open',
          note: newNoteText.trim(),
        });
      }

      const addedNote: InternalNoteRow = {
        id: data.id,
        note: data.note,
        note_type: data.note_type,
        is_escalation: data.is_escalation,
        created_at: data.created_at,
        author_name: (data as any).profiles
          ? `${(data as any).profiles.first_name || ''} ${(data as any).profiles.last_name || ''}`.trim()
          : 'Super Admin',
      };

      setNotes((prev) => [addedNote, ...prev]);
      setNewNoteText('');
      setNewNoteIsEscalation(false);
    } catch (err: any) {
      alert(`Error creating note: ${err.message}`);
    } finally {
      setSubmittingNote(false);
    }
  };

  // Submit Gate Override
  const handleOverrideGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate || !user) return;
    if (!overrideReason.trim()) {
      alert('Provide a mandatory reason for this gate override.');
      return;
    }

    setSubmittingOverride(true);
    try {
      const parsedScore = overrideScore.trim() ? parseFloat(overrideScore) : null;

      // 1. Insert into gate_results
      const { data: newGate, error: gateError } = await supabase
        .from('gate_results')
        .insert({
          candidate_id: selectedCandidate.id,
          gate_type: overrideGateType,
          status: overrideStatus,
          score: parsedScore,
          recorded_by: user.id,
          review_status: 'approved',
          notes: `Gate overridden by Super Admin: ${overrideReason.trim()}`,
        })
        .select()
        .single();

      if (gateError) throw gateError;

      // 2. If overriding Final Assessment Pass or reset toggle is enabled:
      if (overrideGateType === 'assessment' && overrideStatus === 'pass') {
        await supabase
          .from('candidates')
          .update({
            status: 'interview_ready',
            can_apply_to_jobs: true,
            consecutive_final_test_fails: 0,
            final_test_locked: false,
          })
          .eq('id', selectedCandidate.id);

        await supabase
          .from('cooling_periods')
          .delete()
          .eq('candidate_id', selectedCandidate.id)
          .eq('gate_type', 'assessment')
          .eq('status', 'active');
      } else if (overrideGateType === 'assessment' && resetConsecutiveFails) {
        await supabase
          .from('candidates')
          .update({
            consecutive_final_test_fails: 0,
            final_test_locked: false,
          })
          .eq('id', selectedCandidate.id);

        await supabase
          .from('cooling_periods')
          .delete()
          .eq('candidate_id', selectedCandidate.id)
          .eq('gate_type', 'assessment')
          .eq('status', 'active');
      }

      // 3. Insert note into internal_notes
      await supabase.from('internal_notes').insert({
        candidate_id: selectedCandidate.id,
        author_id: user.id,
        note_type: 'general',
        is_escalation: false,
        note: `Gate overridden by Super Admin: ${overrideReason.trim()} (${overrideGateType} → ${overrideStatus})`,
      });

      // 4. Refresh gate list and notes
      const gateRow: GateResultRow = {
        id: newGate.id,
        gate_type: newGate.gate_type,
        status: newGate.status,
        score: newGate.score,
        review_status: newGate.review_status,
        notes: newGate.notes,
        created_at: newGate.created_at,
        recorded_by_name: 'Super Admin (You)',
      };
      setGateResults((prev) => [gateRow, ...prev]);

      const isAssessmentPass = overrideGateType === 'assessment' && overrideStatus === 'pass';

      // Update candidate row
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === selectedCandidate.id
            ? {
                ...c,
                status: isAssessmentPass ? 'interview_ready' : c.status,
                current_gate: overrideGateType,
                consecutive_final_test_fails: (isAssessmentPass || resetConsecutiveFails) ? 0 : c.consecutive_final_test_fails,
                final_test_locked: (isAssessmentPass || resetConsecutiveFails) ? false : c.final_test_locked,
              }
            : c
        )
      );

      setSelectedCandidate((prev) =>
        prev
          ? {
              ...prev,
              status: isAssessmentPass ? 'interview_ready' : prev.status,
              consecutive_final_test_fails: (isAssessmentPass || resetConsecutiveFails) ? 0 : prev.consecutive_final_test_fails,
              final_test_locked: (isAssessmentPass || resetConsecutiveFails) ? false : prev.final_test_locked,
            }
          : null
      );

      setShowOverrideModal(false);
      setOverrideReason('');
      setOverrideScore('');
      setResetConsecutiveFails(false);
      setOverrideSuccessMessage(`Successfully recorded gate override for ${overrideGateType}.`);
    } catch (err: any) {
      alert(`Failed to apply gate override: ${err.message}`);
    } finally {
      setSubmittingOverride(false);
    }
  };

  // Reset Consecutive Fails & Unlock Assessment
  const handleResetConsecutiveFails = async () => {
    if (!selectedCandidate || !user) return;
    try {
      await supabase
        .from('candidates')
        .update({
          consecutive_final_test_fails: 0,
          final_test_locked: false,
        })
        .eq('id', selectedCandidate.id);

      await supabase
        .from('cooling_periods')
        .delete()
        .eq('candidate_id', selectedCandidate.id)
        .eq('gate_type', 'assessment')
        .eq('status', 'active');

      await supabase.from('internal_notes').insert({
        candidate_id: selectedCandidate.id,
        author_id: user.id,
        note_type: 'general',
        is_escalation: false,
        note: 'Consecutive assessment fail count reset to 0, locked status removed, and cooling period deleted by Super Admin.',
      });

      setSelectedCandidate((prev) =>
        prev
          ? {
              ...prev,
              consecutive_final_test_fails: 0,
              final_test_locked: false,
            }
          : null
      );

      setCandidates((prev) =>
        prev.map((c) =>
          c.id === selectedCandidate.id
            ? { ...c, consecutive_final_test_fails: 0, final_test_locked: false }
            : c
        )
      );

      setOverrideSuccessMessage('Consecutive fail count reset to 0 and final assessment unlocked.');
      setTimeout(() => setOverrideSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(`Failed to reset fail count: ${err.message}`);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'interview_ready':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'placed':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'in_progress':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'reveal_gate':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'onboarding':
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[6px] shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">All Candidates</h1>
          <p className="text-sm text-slate-500 mt-1">
            Global talent pool directory with qualification telemetry, cooling status, and gate overrides.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Total: {filteredCandidates.length} of {candidates.length}
          </span>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search candidate name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-[6px] border border-[#E2E8F4] focus:ring-1 focus:ring-[#1B3270] outline-none"
            />
          </div>

          {/* Status filter (Multi-select) */}
          <MultiSelectFilter
            label="Workflow Statuses"
            options={[
              { value: 'onboarding', label: 'Getting Started' },
              { value: 'in_progress', label: 'In Qualification' },
              { value: 'reveal_gate', label: 'Reveal Gate' },
              { value: 'interview_ready', label: 'Interview Ready' },
              { value: 'placed', label: 'Placed' },
            ]}
            selectedValues={statusFilter}
            onChange={setStatusFilter}
          />

          {/* Target Role filter (Multi-select) */}
          <MultiSelectFilter
            label="Target Roles"
            options={[
              { value: 'nursing', label: 'Nursing' },
              { value: 'ausbildung', label: 'Ausbildung' },
              { value: 'care', label: 'Care Worker' },
              { value: 'other', label: 'Other Specialties' },
            ]}
            selectedValues={roleFilter}
            onChange={setRoleFilter}
          />

          {/* Supplier filter (Multi-select) */}
          <MultiSelectFilter
            label="Sourcing Partners"
            options={[
              { value: 'self', label: 'Direct Candidates' },
              ...suppliers.map((s) => ({ value: s.company_name, label: s.company_name })),
            ]}
            selectedValues={supplierFilter}
            onChange={setSupplierFilter}
          />
        </div>

        {/* SECOND ROW OF FILTERS: Cohort, DT Status, Final Test */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          {/* Cohort Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Cohort</label>
            <select
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs rounded-[6px] border border-[#E2E8F4] bg-white text-slate-700 outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All Cohorts</option>
              {cohortsList.map((coh) => (
                <option key={coh.id} value={coh.id}>
                  {coh.name}
                </option>
              ))}
            </select>
          </div>

          {/* DT Status Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">DT Status</label>
            <select
              value={dtStatusFilter}
              onChange={(e) => setDtStatusFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs rounded-[6px] border border-[#E2E8F4] bg-white text-slate-700 outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All DT Statuses</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="cooling_active">Cooling Active</option>
              <option value="attempt_limit_reached">Attempt Limit Reached</option>
            </select>
          </div>

          {/* Final Test Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">Final Test</label>
            <select
              value={finalTestFilter}
              onChange={(e) => setFinalTestFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 text-xs rounded-[6px] border border-[#E2E8F4] bg-white text-slate-700 outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All Final Test States</option>
              <option value="passed">Passed</option>
              <option value="failed">Failed</option>
              <option value="locked">Locked</option>
              <option value="not_started">Not Started</option>
            </select>
          </div>
        </div>
      </div>

      {/* CANDIDATES TABLE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No candidates found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Try adjusting your filters or search keywords.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Full Name</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">DT Attempts</th>
                  <th className="py-3.5 px-4 text-center">Cooling</th>
                  <th className="py-3.5 px-4 text-center">Consecutive Fails</th>
                  <th className="py-3.5 px-4">Cohort</th>
                  <th className="py-3.5 px-4 text-center">Can Apply</th>
                  <th className="py-3.5 px-4">Supplier</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredCandidates.map((cand) => {
                  const fullName = `${cand.first_name || ''} ${cand.last_name || ''}`.trim() || 'Unnamed';
                  const failCount = cand.consecutive_final_test_fails || 0;

                  return (
                    <tr key={cand.id} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{fullName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{cand.user_email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 capitalize">
                          {cand.target_role || 'General'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(
                            cand.status
                          )}`}
                        >
                          {getCandidateStatusLabel(cand.status)}
                        </span>
                      </td>
                      {/* DT Attempts Column */}
                      <td className="py-3.5 px-4 text-center font-mono font-medium">
                        {cand.dt_attempt_count} / 10
                      </td>
                      {/* Cooling Column */}
                      <td className="py-3.5 px-4 text-center">
                        {cand.is_cooling ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Yes
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      {/* Consecutive Fails Column */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            failCount >= 2
                              ? 'bg-rose-100 text-rose-800'
                              : 'text-slate-600'
                          }`}
                        >
                          {failCount}
                        </span>
                      </td>
                      {/* Cohort Column */}
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {cand.cohort_name}
                      </td>
                      {/* Can Apply Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {cand.can_apply_to_jobs ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Yes
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            No
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 truncate max-w-[120px]">
                        {cand.supplier_name}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === cand.id ? null : cand.id);
                            }}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                          >
                            <span>Actions</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                          </button>
                          {openDropdownId === cand.id && (
                            <div
                              className="origin-top-right absolute right-0 mt-1.5 w-44 rounded-[8px] shadow-lg bg-white ring-1 ring-black/5 border border-[#E2E8F4] divide-y divide-slate-100 z-30 focus:outline-none py-1 text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    handleOpenDetail(cand);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer font-medium"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                                  <span>View Details</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setQuickEditCandidate(cand);
                                    setQuickEditFirstName(cand.first_name || '');
                                    setQuickEditLastName(cand.last_name || '');
                                    setQuickEditTargetRole(cand.target_role || '');
                                    setQuickEditStatus(cand.status);
                                    setQuickEditGermanLevel(cand.language_level_self_reported || '');
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center space-x-2 cursor-pointer font-medium"
                                >
                                  <Edit className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Quick Edit</span>
                                </button>
                              </div>
                              <div className="py-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setDeleteTargetCandidate(cand);
                                  }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center space-x-2 cursor-pointer font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  <span>Delete Record</span>
                                </button>
                              </div>
                            </div>
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

      {/* CANDIDATE DETAIL PANEL (SLIDE-OVER) */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col">
            {/* Drawer Header */}
            <div className="p-6 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-[#1B3270] text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                  {(selectedCandidate.first_name?.[0] || 'C').toUpperCase()}
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1B3270]">
                    {selectedCandidate.first_name} {selectedCandidate.last_name}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {selectedCandidate.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
              {overrideSuccessMessage && (
                <div className="p-3 rounded-[6px] bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{overrideSuccessMessage}</span>
                </div>
              )}

              {/* SECTION: Super Admin Editable Profile Fields */}
              <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                    <UserCheck className="w-4 h-4 text-[#2952A3]" />
                    <span>Candidate Profile Information</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleSaveCandidateProfile}
                    disabled={savingCandidate}
                    className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                  >
                    {savingCandidate ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">First Name</label>
                    <input
                      type="text"
                      value={editFirstName}
                      onChange={(e) => setEditFirstName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editLastName}
                      onChange={(e) => setEditLastName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Target Role</label>
                    <input
                      type="text"
                      value={editTargetRole}
                      onChange={(e) => setEditTargetRole(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    >
                      <option value="onboarding">Getting Started</option>
                      <option value="in_progress">In Qualification</option>
                      <option value="reveal_gate">Reveal Gate</option>
                      <option value="interview_ready">Interview Ready</option>
                      <option value="placed">Placed</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">German Level</label>
                    <input
                      type="text"
                      placeholder="e.g. B1, B2"
                      value={editGermanLevel}
                      onChange={(e) => setEditGermanLevel(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nationality</label>
                    <input
                      type="text"
                      value={editNationality}
                      onChange={(e) => setEditNationality(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E2E8F4] grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                  <div>
                    <span className="font-semibold">Linked Email:</span> {selectedCandidate.user_email}
                  </div>
                  <div>
                    <span className="font-semibold">Supplier:</span> {selectedCandidate.supplier_name}
                  </div>
                </div>
              </div>

              {/* SECTION: DT HISTORY (NEW) */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <HelpCircle className="w-4 h-4 text-[#1B3270]" />
                    <h3 className="font-bold text-[#1B3270] text-sm">Diagnostic Test History</h3>
                  </div>
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                    {selectedCandidate.dt_attempt_count} / 10 attempts this round
                  </span>
                </div>

                {activeCoolingPeriod && (
                  <div className="p-2.5 rounded-[6px] bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-800">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Active Cooling Period until <strong>{new Date(activeCoolingPeriod.ends_at).toLocaleString()}</strong></span>
                    </div>
                  </div>
                )}

                {dtAttempts.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-2 text-xs">
                    No DT attempts recorded yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E2E8F4]">
                    {dtAttempts.map((att) => (
                      <div key={att.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">
                            Attempt #{att.attempt_number} • Score: {att.score_pct ?? 0}% ({att.correct_answers ?? 0}/{att.total_questions ?? 15})
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {att.completed_at ? new Date(att.completed_at).toLocaleString() : 'In progress'}
                          </p>
                          {att.started_at && (() => {
                            const startMs = new Date(att.started_at).getTime();
                            const endMs = att.completed_at ? new Date(att.completed_at).getTime() : Date.now();
                            const elapsedSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
                            const mins = Math.floor(elapsedSec / 60);
                            const secs = elapsedSec % 60;
                            const timerUsed = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} / 30:00`;

                            if (att.auto_submitted) {
                              return (
                                <p className="text-[11px] text-amber-600 font-medium">
                                  Auto-submitted (time expired) • <span className="font-mono text-slate-500">{timerUsed}</span>
                                </p>
                              );
                            }

                            if (att.completed_at) {
                              return (
                                <p className="text-[11px] text-slate-500 font-medium">
                                  Completed in {mins} min {secs} sec • <span className="font-mono text-slate-400">{timerUsed}</span>
                                </p>
                              );
                            }

                            return null;
                          })()}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              att.passed
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {att.passed ? 'PASSED' : 'FAILED'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleViewAttemptAnswers(att.id)}
                            className="px-2.5 py-1 text-xs font-semibold text-[#1B3270] hover:bg-slate-100 rounded border border-slate-200"
                          >
                            View Answers
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: COHORT & BOOTCAMP PROGRESS (NEW) */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <GraduationCap className="w-4 h-4 text-[#1B3270]" />
                  <h3 className="font-bold text-[#1B3270] text-sm">Cohort & Bootcamp Telemetry</h3>
                </div>

                {candidateCohortInfo ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-[6px] flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Enrolled Cohort</span>
                        <p className="font-bold text-slate-800 text-sm mt-0.5">{candidateCohortInfo.name}</p>
                        <p className="text-slate-500 capitalize">Track: {candidateCohortInfo.track}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Bootcamp Attendance</span>
                        <p className="font-bold text-[#1B3270] text-sm mt-0.5">
                          {sessionsAttendedCount} / {totalCohortSessionsCount} Sessions
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Final Assessment Attempts
                      </h4>
                      {finalTestAttempts.length === 0 ? (
                        <p className="text-slate-400 italic py-1">No final assessment attempts recorded yet.</p>
                      ) : (
                        <div className="divide-y divide-[#E2E8F4]">
                          {finalTestAttempts.map((ft) => (
                            <div key={ft.id} className="py-2 flex items-center justify-between text-xs">
                              <div>
                                <p className="font-semibold text-slate-800">
                                  Attempt #{ft.attempt_number} • Score: {ft.score_pct ?? 0}%
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  {new Date(ft.created_at).toLocaleDateString()} • {ft.review_status}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  ft.outcome === 'pass'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {ft.outcome ? ft.outcome.toUpperCase() : 'PENDING'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {(selectedCandidate.consecutive_final_test_fails > 0 || selectedCandidate.final_test_locked) && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] flex items-center justify-between text-xs mt-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5 font-bold text-rose-800">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>
                              {selectedCandidate.final_test_locked
                                ? 'Final Assessment Locked (3 Consecutive Fails)'
                                : `${selectedCandidate.consecutive_final_test_fails} Consecutive Fail(s)`}
                            </span>
                          </div>
                          <p className="text-[11px] text-rose-700">
                            Assessment cooling active. Candidate cannot record new attempts until reset.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetConsecutiveFails}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-[5px] text-xs transition-colors shrink-0 cursor-pointer ml-3"
                        >
                          Reset Fails &amp; Unlock
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-slate-400 italic text-center py-2 text-xs">
                      Candidate is not currently enrolled in an active bootcamp cohort.
                    </p>
                    {(selectedCandidate.consecutive_final_test_fails > 0 || selectedCandidate.final_test_locked) && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-[6px] flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5 font-bold text-rose-800">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>
                              {selectedCandidate.final_test_locked
                                ? 'Final Assessment Locked'
                                : `${selectedCandidate.consecutive_final_test_fails} Consecutive Fail(s)`}
                            </span>
                          </div>
                          <p className="text-[11px] text-rose-700">
                            Assessment locked or cooling active.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetConsecutiveFails}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-[5px] text-xs transition-colors shrink-0 cursor-pointer ml-3"
                        >
                          Reset Fails &amp; Unlock
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION: Mentor Assignment */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-2 shadow-2xs">
                <h3 className="font-bold text-[#1B3270] text-sm">Assigned Mentor</h3>
                <p className="text-slate-400 text-[11px]">
                  Select an academic/clinical mentor to guide this candidate through language preparation.
                </p>
                <div className="flex items-center space-x-3 pt-1">
                  <select
                    value={assignedMentorId}
                    onChange={(e) => handleAssignMentor(e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] bg-white outline-none"
                  >
                    <option value="">No Mentor Assigned</option>
                    {mentorList.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECTION: Gate History & Override Button */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                    <Award className="w-4 h-4 text-[#2952A3]" />
                    <span>Gate History</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideGateType('dt');
                      setOverrideStatus('pass');
                      setOverrideScore('');
                      setOverrideReason('');
                      setResetConsecutiveFails(false);
                      setShowOverrideModal(true);
                    }}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-[6px] text-xs shadow-2xs flex items-center space-x-1 cursor-pointer"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Override Gate Result</span>
                  </button>
                </div>

                {panelLoading ? (
                  <div className="py-4 text-center text-slate-400">Loading gates...</div>
                ) : gateResults.length === 0 ? (
                  <p className="text-slate-400 italic py-2 text-center text-xs">
                    No gate results recorded for this candidate yet.
                  </p>
                ) : (
                  <div className="divide-y divide-[#E2E8F4]">
                    {gateResults.map((g) => (
                      <div key={g.id} className="py-2.5 flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-800 tracking-wide">
                              {getGateLabel(g.gate_type)}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                g.status === 'pass'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {g.status}
                            </span>
                            {g.score !== null && (
                              <span className="font-mono text-slate-500 font-medium">
                                Score: {g.score}
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">
                            Recorded by: {g.recorded_by_name} •{' '}
                            {new Date(g.created_at).toLocaleDateString('en-GB')}
                          </p>
                          {g.notes && (
                            <p className="text-slate-600 text-[11px] mt-1 bg-slate-50 p-1.5 rounded border border-[#E2E8F4]">
                              {g.notes}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            g.review_status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700'
                              : g.review_status === 'queried'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {g.review_status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: Complete Profile & 18 Documents View */}
              <CandidateProfileDetailView
                candidateId={selectedCandidate.id}
                showAttentionAlert={true}
              />

              {/* Job Applications */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 shadow-2xs space-y-2">
                <h3 className="font-bold text-[#1B3270] text-sm">Job Applications</h3>
                {applications.length === 0 ? (
                  <p className="text-slate-400 italic py-2 text-center">No active applications.</p>
                ) : (
                  <div className="divide-y divide-[#E2E8F4]">
                    {applications.map((a) => (
                      <div key={a.id} className="py-2 flex items-center justify-between">
                        <span className="font-medium text-slate-700 truncate pr-2">
                          {a.job_title}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold uppercase shrink-0">
                          {a.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: Internal Notes */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                <h3 className="font-bold text-[#1B3270] text-sm">Internal Team Notes</h3>

                <form onSubmit={handleAddNote} className="space-y-2 pt-1">
                  <textarea
                    rows={2}
                    placeholder="Add an internal observation, interview note, or escalation reason..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    className="w-full p-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <select
                        value={newNoteType}
                        onChange={(e) => setNewNoteType(e.target.value)}
                        className="px-2 py-1 text-xs border border-[#E2E8F4] rounded-[6px] bg-white outline-none"
                      >
                        <option value="general">General</option>
                        <option value="academic">Academic</option>
                        <option value="interview">Interview</option>
                        <option value="ops">Operations</option>
                      </select>
                      <label className="flex items-center space-x-1.5 text-xs text-rose-700 cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={newNoteIsEscalation}
                          onChange={(e) => setNewNoteIsEscalation(e.target.checked)}
                          className="rounded text-rose-600 focus:ring-0"
                        />
                        <span>Flag as Escalation</span>
                      </label>
                    </div>
                    <button
                      type="submit"
                      disabled={submittingNote || !newNoteText.trim()}
                      className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                    >
                      <Send className="w-3 h-3" />
                      <span>{submittingNote ? 'Saving...' : 'Post Note'}</span>
                    </button>
                  </div>
                </form>

                <div className="space-y-2 pt-2">
                  {notes.length === 0 ? (
                    <p className="text-slate-400 italic text-center py-2">
                      No internal notes recorded yet.
                    </p>
                  ) : (
                    notes.map((n) => (
                      <div
                        key={n.id}
                        className={`p-2.5 rounded-[6px] border ${
                          n.is_escalation
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-slate-50 border-[#E2E8F4] text-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-[11px]">{n.author_name}</span>
                          <div className="flex items-center space-x-2">
                            {n.is_escalation && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-rose-600 text-white font-bold rounded uppercase">
                                Escalation
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(n.created_at).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{n.note}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW ANSWERS MODAL */}
      {viewAnswersAttemptId && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
              <h3 className="text-base font-bold text-[#1B3270]">Diagnostic Test Answer Review</h3>
              <button
                type="button"
                onClick={() => setViewAnswersAttemptId(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3">
              {loadingAnswers ? (
                <div className="py-16 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1B3270] mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Loading answer records...</p>
                </div>
              ) : attemptAnswers.length === 0 ? (
                <p className="text-slate-400 text-center py-8 text-xs">No answers recorded for this attempt.</p>
              ) : (
                attemptAnswers.map((ans, idx) => (
                  <div
                    key={ans.id}
                    className={`p-3.5 rounded-[8px] border text-xs space-y-2 ${
                      ans.is_correct
                        ? 'bg-emerald-50/50 border-emerald-200'
                        : 'bg-rose-50/50 border-rose-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p className="font-bold text-slate-800">
                        {idx + 1}. {ans.question_text}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ml-2 ${
                          ans.is_correct
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {ans.is_correct ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="font-bold text-slate-500">Selected Answer: </span>
                        <strong className={ans.is_correct ? 'text-emerald-700' : 'text-rose-700'}>
                          Option {ans.selected_option || 'None'}
                        </strong>
                      </div>
                      <div className="p-2 bg-white rounded border border-slate-200">
                        <span className="font-bold text-slate-500">Correct Answer: </span>
                        <strong className="text-emerald-700">Option {ans.correct_option}</strong>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK EDIT MODAL */}
      {quickEditCandidate && (
        <div className="fixed inset-0 z-60 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
              <h3 className="font-bold text-base text-slate-900">
                Quick Edit Candidate
              </h3>
              <button
                type="button"
                onClick={() => setQuickEditCandidate(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={quickEditFirstName}
                    onChange={(e) => setQuickEditFirstName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E2E8F4] rounded-[6px] outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={quickEditLastName}
                    onChange={(e) => setQuickEditLastName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#E2E8F4] rounded-[6px] outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Target Role</label>
                <input
                  type="text"
                  value={quickEditTargetRole}
                  onChange={(e) => setQuickEditTargetRole(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E2E8F4] rounded-[6px] outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Status</label>
                <select
                  value={quickEditStatus}
                  onChange={(e) => setQuickEditStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E2E8F4] rounded-[6px] outline-none focus:ring-1 focus:ring-[#1B3270] bg-white"
                >
                  <option value="onboarding">Getting Started</option>
                  <option value="in_progress">In Qualification</option>
                  <option value="reveal_gate">Reveal Gate</option>
                  <option value="interview_ready">Interview Ready</option>
                  <option value="placed">Placed</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">German Level</label>
                <input
                  type="text"
                  value={quickEditGermanLevel}
                  onChange={(e) => setQuickEditGermanLevel(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-[#E2E8F4] rounded-[6px] outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setQuickEditCandidate(null)}
                  className="px-3.5 py-1.5 border border-[#E2E8F4] rounded-[6px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingQuickEdit}
                  className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] font-semibold disabled:opacity-50"
                >
                  {savingQuickEdit ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CANDIDATE MODAL (Tier 1) */}
      <DeleteConfirmationModal
        isOpen={!!deleteTargetCandidate}
        onClose={() => setDeleteTargetCandidate(null)}
        onConfirm={handleConfirmDelete}
        tier="tier1"
        entityType="Candidate"
        entityName={
          deleteTargetCandidate
            ? `${deleteTargetCandidate.first_name || ''} ${deleteTargetCandidate.last_name || ''}`.trim()
            : ''
        }
        bodyText="This permanently deletes this candidate and all associated data. This cannot be undone."
        isDeleting={deletingCandidate}
      />

      {/* GATE OVERRIDE MODAL (UPDATED WITH 5 GATES AND RESET TOGGLE) */}
      {showOverrideModal && selectedCandidate && (
        <div className="fixed inset-0 z-60 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
              <div className="flex items-center space-x-2 text-amber-700">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-900">
                  Override Candidate Gate Result
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              This action manually approves or fails a qualification gate for candidate{' '}
              <strong>
                {selectedCandidate.first_name} {selectedCandidate.last_name}
              </strong>{' '}
              and logs an audit trail in internal notes.
            </p>

            <form onSubmit={handleOverrideGateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Select Overrideable Gate *
                </label>
                <select
                  value={overrideGateType}
                  onChange={(e) => setOverrideGateType(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white font-medium"
                >
                  {GATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Override Outcome *
                  </label>
                  <select
                    value={overrideStatus}
                    onChange={(e) => setOverrideStatus(e.target.value as 'pass' | 'fail')}
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white"
                  >
                    <option value="pass">Pass (Overridden to Pass)</option>
                    <option value="fail">Fail (Overridden to Fail)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Score (Optional Number)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 85"
                    value={overrideScore}
                    onChange={(e) => setOverrideScore(e.target.value)}
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white"
                  />
                </div>
              </div>

              {/* Reset consecutive fails toggle when overriding Final Assessment */}
              {overrideGateType === 'assessment' && ((selectedCandidate.consecutive_final_test_fails || 0) > 0 || selectedCandidate.final_test_locked) && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-[6px] space-y-1.5">
                  <label className="flex items-center space-x-2 text-xs font-bold text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resetConsecutiveFails}
                      onChange={(e) => setResetConsecutiveFails(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-0"
                    />
                    <span>Reset consecutive fail count?</span>
                  </label>
                  <p className="text-[11px] text-amber-700 leading-relaxed pl-5">
                    Resets failure counter to 0, unlocks final assessment, and removes active assessment cooling periods.
                  </p>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Override (Required audit record) *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="State the administrative or clinical justification for overriding this evaluation..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setShowOverrideModal(false)}
                  className="px-4 py-2 border border-[#E2E8F4] text-slate-600 rounded-[6px] font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride || !overrideReason.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-[6px] font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                >
                  {submittingOverride ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <span>Submit Gate Override</span>
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
