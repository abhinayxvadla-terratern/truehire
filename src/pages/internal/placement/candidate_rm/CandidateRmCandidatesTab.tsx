import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Users,
  Search,
  Eye,
  Bell,
  Building2,
  Clock,
  X,
  Loader2,
  Check,
  Send,
  FileCheck2,
  ChevronDown,
  Edit3,
  Trash2,
  AlertTriangle,
  GraduationCap,
} from 'lucide-react';
import { getGateLabel, getCandidateStatusLabel } from '../../../../utils/labels';
import { formatDate } from '../../../../utils/formatters';
import { CandidateProfileDetailView } from '../../components/CandidateProfileDetailView';
import {
  DocumentReviewPanel,
  DocumentReviewCandidate,
} from './components/DocumentReviewPanel';
import { ALL_DOCUMENT_TYPES } from '../../../../utils/documentTypes';
import { notifyByRole } from '../../../../utils/notificationRouting';

interface CandidateItem {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  target_role: string | null;
  language_level: string | null;
  supplier_id: string | null;
  supplier_name: string;
  supplier_user_id: string | null;
  status: string;
  current_gate: string;
  gate_status: string;
  days_in_stage: number;
  created_at: string;
  updated_at: string;
  dt_passed_at?: string | null;
  profile_completion_pct?: number | null;
  cohort_id?: string | null;
  verified_docs_count: number;
  mandatory_docs_count: number;
  all_mandatory_verified: boolean;
  st_schedule?: {
    status: string;
    proposed_date: string;
    proposed_time: string;
  } | null;
  st_result?: {
    overall_outcome: string;
    review_status: string;
  } | null;
  dt_attempt_count: number;
  is_cooling_active: boolean;
  cooling_end_date?: string | null;
  cohort_name?: string | null;
  final_consecutive_fails: number;
  final_test_locked: boolean;
}

interface GateHistoryItem {
  id: string;
  gate_type: string;
  status: string;
  score: number | null;
  attempt_number: number;
  notes: string | null;
  created_at: string;
}

interface AcademicRequestItem {
  id: string;
  request_type: string;
  status: string;
  mentor_name: string;
  created_at: string;
}

interface SupplierNoteItem {
  id: string;
  note: string;
  author_name?: string | null;
  created_at: string;
}

interface CandidateInternalNoteItem {
  id: string;
  note: string;
  author_name: string;
  created_at: string;
}

interface CandidateCohortDetail {
  name: string;
  track: string;
  sessions_attended: number;
  total_sessions: number;
  next_session_date?: string | null;
  final_test_attempts: number;
  final_consecutive_fails: number;
}

export const CandidateRmCandidatesTab: React.FC = () => {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPill, setFilterPill] = useState<
    | 'all'
    | 'dt_passed'
    | 'docs_pending'
    | 'docs_verified'
    | 'st_scheduled'
    | 'in_bootcamp'
    | 'cooling_active'
    | 'final_test_locked'
    | 'interview_ready'
  >('all');
  const [stuckFilter, setStuckFilter] = useState(false);

  // Document Review Panel (Part 3 & 4)
  const [selectedReviewCandidate, setSelectedReviewCandidate] = useState<DocumentReviewCandidate | null>(null);
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState(false);

  // Detail Drawer
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [gateHistory, setGateHistory] = useState<GateHistoryItem[]>([]);
  const [academicRequests, setAcademicRequests] = useState<AcademicRequestItem[]>([]);
  const [supplierNotes, setSupplierNotes] = useState<SupplierNoteItem[]>([]);
  const [internalNotes, setInternalNotes] = useState<CandidateInternalNoteItem[]>([]);
  const [newInternalNote, setNewInternalNote] = useState('');
  const [savingInternalNote, setSavingInternalNote] = useState(false);
  const [cohortDetail, setCohortDetail] = useState<CandidateCohortDetail | null>(null);

  // Nudge / Notification Modal
  const [nudgeModal, setNudgeModal] = useState<{
    target: 'candidate' | 'supplier';
    candidate: CandidateItem;
  } | null>(null);
  const [nudgeTitle, setNudgeTitle] = useState('');
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [nudging, setNudging] = useState(false);

  // Actions Dropdown
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Edit Candidate Modal
  const [editCandidate, setEditCandidate] = useState<CandidateItem | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editTargetRole, setEditTargetRole] = useState('nursing');
  const [editLanguageLevel, setEditLanguageLevel] = useState('B1');
  const [editStatus, setEditStatus] = useState('onboarding');
  const [savingEdit, setSavingEdit] = useState(false);

  // Escalate to Placement Lead Modal
  const [escalateCandidate, setEscalateCandidate] = useState<CandidateItem | null>(null);
  const [escalateReason, setEscalateReason] = useState('stalled');
  const [escalatePriority, setEscalatePriority] = useState<'normal' | 'high' | 'urgent'>('high');
  const [escalateNotes, setEscalateNotes] = useState('');
  const [submittingEscalate, setSubmittingEscalate] = useState(false);

  // Delete Candidate Modal
  const [deleteCandidateTarget, setDeleteCandidateTarget] = useState<CandidateItem | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string, _type?: 'success' | 'error') => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenEdit = (cand: CandidateItem) => {
    setEditCandidate(cand);
    setEditFirstName(cand.first_name || '');
    setEditLastName(cand.last_name || '');
    setEditTargetRole(cand.target_role || 'nursing');
    setEditLanguageLevel(cand.language_level || 'B1');
    setEditStatus(cand.status || 'onboarding');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCandidate) return;

    if (!editFirstName.trim() || !editLastName.trim()) {
      alert('First name and last name are required.');
      return;
    }

    try {
      setSavingEdit(true);
      const { error } = await supabase
        .from('candidates')
        .update({
          first_name: editFirstName.trim(),
          last_name: editLastName.trim(),
          target_role: editTargetRole,
          language_level_self_reported: editLanguageLevel,
          status: editStatus,
        })
        .eq('id', editCandidate.id);

      if (error) throw error;

      showToast(`Candidate ${editFirstName} ${editLastName} updated successfully.`);
      setEditCandidate(null);
      fetchMyCandidates();
    } catch (err: any) {
      console.error('Error updating candidate:', err);
      alert(`Failed to update candidate: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleOpenEscalate = (cand: CandidateItem) => {
    setEscalateCandidate(cand);
    setEscalateReason('stalled');
    setEscalatePriority('high');
    setEscalateNotes('');
  };

  const handleConfirmEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateCandidate || !user) return;

    try {
      setSubmittingEscalate(true);
      const name = `${escalateCandidate.first_name} ${escalateCandidate.last_name}`;
      const reasonLabels: Record<string, string> = {
        stalled: 'Candidate Qualification Stalled > 7 Days',
        docs_delayed: 'Critical Document Verification Delayed',
        mentor_needed: 'Urgent Speaking Test / Mentor Assignment Required',
        employer_feedback: 'Employer Offer / Interview Stage Blocker',
        other: 'General Account Management Escalation',
      };
      const reasonText = reasonLabels[escalateReason] || escalateReason;

      await notifyByRole(
        supabase,
        'placement_lead',
        `RM Escalation: ${name}`,
        `Candidate/Supplier RM escalated candidate ${name} (${escalateCandidate.supplier_name}).\n\nReason: ${reasonText}\nPriority: ${escalatePriority.toUpperCase()}${escalateNotes.trim() ? `\n\nNotes: ${escalateNotes.trim()}` : ''}`,
        'general',
        user.id
      );

      showToast(`Escalation regarding ${name} sent to Placement Leads.`);
      setEscalateCandidate(null);
    } catch (err: any) {
      console.error('Error submitting escalation:', err);
      alert(`Failed to submit escalation: ${err.message}`);
    } finally {
      setSubmittingEscalate(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidateTarget) return;

    try {
      setDeletingCandidate(true);
      const { error } = await supabase.rpc('delete_candidate', {
        target_candidate_id: deleteCandidateTarget.id,
      });

      if (error) throw error;

      const name = `${deleteCandidateTarget.first_name} ${deleteCandidateTarget.last_name}`;
      showToast(`Candidate ${name} deleted successfully.`);
      setCandidates((prev) => prev.filter((c) => c.id !== deleteCandidateTarget.id));
      setDeleteCandidateTarget(null);
    } catch (err: any) {
      console.error('Error deleting candidate:', err);
      alert(`Failed to delete candidate: ${err.message}`);
    } finally {
      setDeletingCandidate(false);
    }
  };

  const fetchMyCandidates = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch assigned supplier and direct candidate assignments
      const { data: assignments } = await supabase
        .from('rm_assignments')
        .select('entity_id, entity_type')
        .eq('rm_profile_id', user.id)
        .eq('active', true);

      const supplierIds = (assignments || [])
        .filter((a) => a.entity_type === 'supplier')
        .map((a) => a.entity_id);

      // 2. Fetch candidates assigned directly to this RM or belonging to assigned suppliers
      let candQuery = supabase
        .from('candidates')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          target_role,
          language_level_self_reported,
          supplier_id,
          assigned_rm_id,
          status,
          profile_completion_pct,
          dt_passed_at,
          dt_attempt_count,
          final_consecutive_fails,
          final_test_locked,
          cohort_id,
          created_at,
          suppliers:supplier_id (id, company_name, user_id)
        `)
        .order('created_at', { ascending: false });

      if (supplierIds.length > 0) {
        candQuery = candQuery.or(`assigned_rm_id.eq.${user.id},supplier_id.in.(${supplierIds.join(',')})`);
      } else {
        candQuery = candQuery.eq('assigned_rm_id', user.id);
      }

      const { data: cands, error } = await candQuery;

      if (error) throw error;
      const candList = cands || [];
      const candIds = candList.map((c) => c.id);

      // 3. Fetch latest gate results
      const gateMap: Record<string, { gate_type: string; status: string; date: string }> = {};
      if (candIds.length > 0) {
        const { data: gates } = await supabase
          .from('gate_results')
          .select('candidate_id, gate_type, status, created_at')
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        (gates || []).forEach((g) => {
          if (!gateMap[g.candidate_id]) {
            gateMap[g.candidate_id] = {
              gate_type: g.gate_type,
              status: g.status,
              date: g.created_at,
            };
          }
        });
      }

      // 4. Fetch speaking test schedules
      const schedMap: Record<string, { status: string; proposed_date: string; proposed_time: string }> = {};
      if (candIds.length > 0) {
        const { data: schedules } = await supabase
          .from('speaking_test_schedules')
          .select('candidate_id, status, proposed_date, proposed_time')
          .in('candidate_id', candIds);

        (schedules || []).forEach((s) => {
          schedMap[s.candidate_id] = {
            status: s.status,
            proposed_date: s.proposed_date,
            proposed_time: s.proposed_time,
          };
        });
      }

      // 5. Fetch speaking test results (outcome only - RM cannot see score, rubric, or notes)
      const resultMap: Record<string, { overall_outcome: string; review_status: string }> = {};
      if (candIds.length > 0) {
        const { data: stResults } = await supabase
          .from('speaking_test_results')
          .select('candidate_id, overall_outcome, review_status, created_at')
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        (stResults || []).forEach((r) => {
          if (!resultMap[r.candidate_id]) {
            resultMap[r.candidate_id] = {
              overall_outcome: r.overall_outcome,
              review_status: r.review_status,
            };
          }
        });
      }

      // 6. Fetch documents to compute verified mandatory count
      const mandatoryTypesList = ALL_DOCUMENT_TYPES.filter((t) => t.is_mandatory);
      const mandatoryCount = mandatoryTypesList.length;
      const verifiedDocsCountMap: Record<string, number> = {};

      if (candIds.length > 0) {
        const { data: allDocs } = await supabase
          .from('documents')
          .select('candidate_id, document_type, status')
          .in('candidate_id', candIds);

        const candDocsMap: Record<string, Record<string, string>> = {};
        (allDocs || []).forEach((d) => {
          if (!candDocsMap[d.candidate_id]) {
            candDocsMap[d.candidate_id] = {};
          }
          candDocsMap[d.candidate_id][d.document_type] = d.status;
        });

        candIds.forEach((cId) => {
          const docMap = candDocsMap[cId] || {};
          const verified = mandatoryTypesList.filter((t) => docMap[t.document_type] === 'verified').length;
          verifiedDocsCountMap[cId] = verified;
        });
      }

      // 7. Fetch active DT cooling periods
      const coolingMap: Record<string, string> = {};
      if (candIds.length > 0) {
        const { data: coolingList } = await supabase
          .from('cooling_periods')
          .select('candidate_id, end_date')
          .in('candidate_id', candIds)
          .eq('gate_type', 'dt')
          .eq('status', 'active');

        (coolingList || []).forEach((cp) => {
          coolingMap[cp.candidate_id] = cp.end_date;
        });
      }

      // 8. Fetch cohort names
      const cohortNameMap: Record<string, string> = {};
      if (candIds.length > 0) {
        const { data: cMembers } = await supabase
          .from('cohort_members')
          .select('candidate_id, cohorts:cohort_id(name)')
          .in('candidate_id', candIds);

        (cMembers || []).forEach((cm: any) => {
          if (cm.cohorts?.name) {
            cohortNameMap[cm.candidate_id] = cm.cohorts.name;
          }
        });
      }

      const rows: CandidateItem[] = candList.map((c: any) => {
        const sup = c.suppliers;
        const gate = gateMap[c.id];
        const sched = schedMap[c.id] || null;
        const res = resultMap[c.id] || null;
        const verifiedCount = verifiedDocsCountMap[c.id] || 0;
        const allMandatoryVerified = verifiedCount >= mandatoryCount;

        const updatedDate = new Date(gate?.date || c.created_at || Date.now());
        const daysDiff = Math.max(
          0,
          Math.floor((Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        return {
          id: c.id,
          user_id: c.user_id,
          first_name: c.first_name || 'Candidate',
          last_name: c.last_name || `#${c.id.slice(0, 6)}`,
          target_role: c.target_role,
          language_level: c.language_level_self_reported || 'B1 German',
          supplier_id: c.supplier_id,
          supplier_name: sup?.company_name || (c.supplier_id ? 'Supplier Partner' : 'Direct'),
          supplier_user_id: sup?.user_id || null,
          status: c.status,
          current_gate: gate ? gate.gate_type.toUpperCase() : 'Not Started',
          gate_status: gate ? gate.status : 'pending',
          days_in_stage: daysDiff,
          created_at: c.created_at,
          updated_at: gate?.date || c.created_at,
          dt_passed_at: c.dt_passed_at,
          profile_completion_pct: c.profile_completion_pct,
          cohort_id: c.cohort_id,
          verified_docs_count: verifiedCount,
          mandatory_docs_count: mandatoryCount,
          all_mandatory_verified: allMandatoryVerified,
          st_schedule: sched,
          st_result: res,
          dt_attempt_count: c.dt_attempt_count || 0,
          is_cooling_active: Boolean(coolingMap[c.id]),
          cooling_end_date: coolingMap[c.id] || null,
          cohort_name: cohortNameMap[c.id] || null,
          final_consecutive_fails: c.final_consecutive_fails || 0,
          final_test_locked: Boolean(c.final_test_locked),
        };
      });

      setCandidates(rows);
    } catch (err) {
      console.error('Error fetching my candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyCandidates();
  }, [user]);

  const handleOpenDetail = async (candidate: CandidateItem) => {
    setSelectedCandidate(candidate);
    setDrawerLoading(true);
    setSupplierNotes([]);
    setInternalNotes([]);
    setCohortDetail(null);

    try {
      // 1. Fetch gate history
      const { data: gates } = await supabase
        .from('gate_results')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false });

      setGateHistory(gates || []);

      // 2. Fetch academic requests
      const { data: acReqs } = await supabase
        .from('academic_requests')
        .select(`
          id,
          request_type,
          status,
          created_at,
          profiles:assigned_mentor_id (first_name, last_name, email)
        `)
        .eq('candidate_id', candidate.id);

      const formattedAc: AcademicRequestItem[] = (acReqs || []).map((r: any) => ({
        id: r.id,
        request_type: r.request_type,
        status: r.status,
        mentor_name: r.profiles
          ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() ||
            r.profiles.email
          : 'Pending Assignment',
        created_at: r.created_at,
      }));

      setAcademicRequests(formattedAc);

      // 3. Fetch supplier notes (read-only for RM)
      if (candidate.supplier_id) {
        const { data: sNotes } = await supabase
          .from('supplier_notes')
          .select(`
            id,
            note,
            created_at,
            author_profile_id,
            profiles:author_profile_id (first_name, last_name, email)
          `)
          .eq('candidate_id', candidate.id)
          .eq('supplier_id', candidate.supplier_id)
          .order('created_at', { ascending: true });

        const mappedSNotes: SupplierNoteItem[] = (sNotes || []).map((n: any) => {
          const author = n.profiles;
          const authorName = author
            ? `${author.first_name || ''} ${author.last_name || ''}`.trim() || author.email
            : 'Supplier';
          return {
            id: n.id,
            note: n.note,
            author_name: authorName,
            created_at: n.created_at,
          };
        });
        setSupplierNotes(mappedSNotes);
      }

      // 4. Fetch internal notes for RM
      const { data: iNotes } = await supabase
        .from('internal_notes')
        .select(`
          id,
          note,
          created_at,
          author_id,
          profiles:author_id (first_name, last_name, email)
        `)
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: true });

      const mappedINotes: CandidateInternalNoteItem[] = (iNotes || []).map((n: any) => {
        const author = n.profiles;
        const authorName = author
          ? `${author.first_name || ''} ${author.last_name || ''}`.trim() || author.email
          : 'Relationship Manager';
        return {
          id: n.id,
          note: n.note,
          author_name: authorName,
          created_at: n.created_at,
        };
      });
      setInternalNotes(mappedINotes);

      // 5. Fetch cohort section info
      const { data: cMem } = await supabase
        .from('cohort_members')
        .select(`
          cohort_id,
          cohorts:cohort_id (
            id,
            name,
            track
          )
        `)
        .eq('candidate_id', candidate.id)
        .maybeSingle();

      if (cMem?.cohorts) {
        const cohortInfo: any = cMem.cohorts;
        const cohortId = cohortInfo.id;

        const { data: sessions } = await supabase
          .from('bootcamp_sessions')
          .select('id, session_date, session_time')
          .eq('cohort_id', cohortId)
          .order('session_date', { ascending: true });

        const totalSessions = (sessions || []).length;
        const todayIso = new Date().toISOString().split('T')[0];
        const nextSess = (sessions || []).find((s) => s.session_date >= todayIso);
        const nextSessionStr = nextSess
          ? `${nextSess.session_date} ${nextSess.session_time || ''}`.trim()
          : null;

        const { data: attendance } = await supabase
          .from('bootcamp_attendance')
          .select('id')
          .eq('candidate_id', candidate.id)
          .eq('attended', true);

        const attendedCount = (attendance || []).length;

        const { data: finalAttempts } = await supabase
          .from('final_test_attempts')
          .select('id, consecutive_fail_count')
          .eq('candidate_id', candidate.id)
          .order('attempt_number', { ascending: false });

        const attemptsCount = (finalAttempts || []).length;
        const latestFails =
          finalAttempts && finalAttempts.length > 0
            ? finalAttempts[0].consecutive_fail_count || 0
            : candidate.final_consecutive_fails || 0;

        setCohortDetail({
          name: cohortInfo.name,
          track: cohortInfo.track,
          sessions_attended: attendedCount,
          total_sessions: totalSessions,
          next_session_date: nextSessionStr,
          final_test_attempts: attemptsCount,
          final_consecutive_fails: latestFails,
        });
      }
    } catch (err) {
      console.error('Error fetching candidate detail:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleAddInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidate || !user || !newInternalNote.trim()) return;

    try {
      setSavingInternalNote(true);
      const { data: noteRecord, error } = await supabase
        .from('internal_notes')
        .insert({
          candidate_id: selectedCandidate.id,
          author_id: user.id,
          note: newInternalNote.trim(),
          note_type: 'rm_note',
          is_escalation: false,
        })
        .select(`
          id,
          note,
          created_at,
          author_id,
          profiles:author_id (first_name, last_name, email)
        `)
        .single();

      if (error) throw error;

      const author = (noteRecord as any).profiles;
      const authorName = author
        ? `${author.first_name || ''} ${author.last_name || ''}`.trim() || author.email
        : 'Relationship Manager';

      setInternalNotes((prev) => [
        ...prev,
        {
          id: noteRecord.id,
          note: noteRecord.note,
          author_name: authorName,
          created_at: noteRecord.created_at,
        },
      ]);
      setNewInternalNote('');
      showToast('Internal note saved.');
    } catch (err: any) {
      console.error('Error adding internal note:', err);
      showToast(err.message || 'Failed to save note', 'error');
    } finally {
      setSavingInternalNote(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nudgeModal || !user) return;

    try {
      setNudging(true);
      const targetUserId =
        nudgeModal.target === 'candidate'
          ? nudgeModal.candidate.user_id
          : nudgeModal.candidate.supplier_user_id;

      if (!targetUserId) {
        alert(
          `Cannot notify ${nudgeModal.target}: User account has not yet registered an authentication profile.`
        );
        return;
      }

      const { error } = await supabase.from('notifications').insert({
        user_id: targetUserId,
        title: nudgeTitle || 'Notification from your Relationship Manager',
        message: nudgeMessage,
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      if (error) throw error;

      showToast(
        `Notification sent to ${
          nudgeModal.target === 'candidate' ? 'Candidate' : 'Supplier Partner'
        }`
      );
      setNudgeModal(null);
      setNudgeTitle('');
      setNudgeMessage('');
    } catch (err: any) {
      alert(`Failed to send notification: ${err.message}`);
    } finally {
      setNudging(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (filterPill === 'dt_passed' && !c.dt_passed_at) return false;
    if (filterPill === 'docs_pending' && (!c.dt_passed_at || c.all_mandatory_verified)) return false;
    if (filterPill === 'docs_verified' && (!c.all_mandatory_verified || c.st_schedule)) return false;
    if (
      filterPill === 'st_scheduled' &&
      (!c.st_schedule || !['approved', 'scheduled', 'proposed', 'completed'].includes(c.st_schedule.status))
    )
      return false;
    if (
      filterPill === 'in_bootcamp' &&
      !(c.status === 'in_progress' && (c.current_gate.toLowerCase().includes('bootcamp') || Boolean(c.cohort_id)))
    )
      return false;
    if (filterPill === 'cooling_active' && !c.is_cooling_active) return false;
    if (filterPill === 'final_test_locked' && !c.final_test_locked) return false;
    if (filterPill === 'interview_ready' && c.status !== 'interview_ready') return false;

    if (stuckFilter && c.days_in_stage <= 7) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = `${c.first_name} ${c.last_name}`.toLowerCase().includes(q);
      const matchSup = c.supplier_name.toLowerCase().includes(q);
      const matchRole = (c.target_role || '').toLowerCase().includes(q);
      if (!matchName && !matchSup && !matchRole) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          My Talent Roster & Qualification Gates
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Review candidates submitted by your assigned supplier partners, audit gate telemetry, and trigger direct notifications.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate name, role, supplier..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          {/* Stuck > 7 days Toggle */}
          <button
            type="button"
            onClick={() => setStuckFilter(!stuckFilter)}
            className={`py-1.5 px-3 text-xs font-semibold rounded-[6px] border flex items-center justify-center space-x-2 transition-colors cursor-pointer shrink-0 ${
              stuckFilter
                ? 'bg-rose-50 border-rose-300 text-rose-700'
                : 'bg-white border-[#E2E8F4] text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Stuck &gt; 7 Days Only</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pt-1 pb-0.5 scrollbar-none">
          {[
            { id: 'all', label: 'All' },
            { id: 'dt_passed', label: 'DT Passed' },
            { id: 'docs_pending', label: 'Docs Pending' },
            { id: 'docs_verified', label: 'Docs Verified' },
            { id: 'st_scheduled', label: 'ST Scheduled' },
            { id: 'in_bootcamp', label: 'In Bootcamp' },
            { id: 'cooling_active', label: 'Cooling Active' },
            { id: 'final_test_locked', label: 'Final Test Locked' },
            { id: 'interview_ready', label: 'Interview Ready' },
          ].map((pill) => {
            const isActive = filterPill === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setFilterPill(pill.id as any)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-[#1B3270] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">
              No candidates in your pipeline
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              No candidates matching the active filter criteria.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Target Role</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-center">DT</th>
                  <th className="py-3 px-4 text-center">Cooling</th>
                  <th className="py-3 px-4 text-center">Profile</th>
                  <th className="py-3 px-4">Cohort</th>
                  <th className="py-3 px-4 text-center">Final Fails</th>
                  <th className="py-3 px-4">Current Gate / Stage</th>
                  <th className="py-3 px-4 text-center">Days in Stage</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8FAFD] transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>
                        {c.first_name} {c.last_name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono font-normal">
                        #{c.id.slice(0, 6).toUpperCase()}
                      </div>
                    </td>

                    {/* Target Role */}
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                        {c.target_role || 'Healthcare'}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-4">
                      {c.supplier_id ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {c.supplier_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          Direct
                        </span>
                      )}
                    </td>

                    {/* DT */}
                    <td className="py-3.5 px-4 text-center">
                      {c.dt_passed_at ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Passed
                        </span>
                      ) : (
                        <span className="text-slate-700 font-semibold text-xs">
                          {c.dt_attempt_count}/10
                        </span>
                      )}
                    </td>

                    {/* Cooling */}
                    <td className="py-3.5 px-4 text-center">
                      {c.is_cooling_active ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Active
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Profile % */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-semibold text-slate-700 text-xs">
                        {c.profile_completion_pct || 0}%
                      </span>
                    </td>

                    {/* Cohort */}
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {c.cohort_name ? (
                        <span className="truncate max-w-[120px] inline-block font-semibold text-slate-900" title={c.cohort_name}>
                          {c.cohort_name}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Final Fails */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`font-bold text-xs ${
                          c.final_consecutive_fails >= 2 ? 'text-rose-600' : 'text-slate-700'
                        }`}
                      >
                        {c.final_consecutive_fails}
                      </span>
                    </td>

                    {/* Current Gate / Speaking Test Status */}
                    <td className="py-3.5 px-4">
                      {c.st_result?.review_status === 'approved' ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.st_result.overall_outcome === 'pass'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {c.st_result.overall_outcome === 'pass'
                            ? 'Speaking Test: Pass'
                            : 'Speaking Test: Did Not Pass'}
                        </span>
                      ) : c.st_schedule && ['approved', 'scheduled'].includes(c.st_schedule.status) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          Speaking Test: {c.st_schedule.proposed_date} — Scheduled
                        </span>
                      ) : c.st_schedule?.status === 'proposed' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          Speaking Test: Proposed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {c.current_gate}
                        </span>
                      )}
                    </td>

                    {/* Days in Stage */}
                    <td className="py-3.5 px-4 text-center font-bold">
                      <span
                        className={
                          c.days_in_stage > 7 ? 'text-rose-600' : 'text-slate-600'
                        }
                      >
                        {c.days_in_stage}d
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          c.status === 'placed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : c.status === 'interview_ready'
                            ? 'bg-blue-100 text-blue-800'
                            : c.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {getCandidateStatusLabel(c.status)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        {/* Part 2: Review Documents button for DT Passed candidates */}
                        {c.dt_passed_at && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedReviewCandidate({
                                id: c.id,
                                first_name: c.first_name,
                                last_name: c.last_name,
                                target_role: c.target_role,
                                language_level_self_reported: c.language_level,
                                user_id: c.user_id,
                                supplier_name: c.supplier_name,
                                profile_completion_pct: c.profile_completion_pct,
                                dt_passed_at: c.dt_passed_at,
                              });
                              setIsReviewPanelOpen(true);
                            }}
                            className="px-2.5 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs flex items-center space-x-1 transition-colors"
                          >
                            <FileCheck2 className="w-3.5 h-3.5" />
                            <span>Review Documents</span>
                          </button>
                        )}

                        {/* Actions Dropdown */}
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={() => setOpenDropdownId(openDropdownId === c.id ? null : c.id)}
                            className="py-1 px-3 bg-white hover:bg-slate-50 text-[#1B3270] border border-[#E2E8F4] text-[11px] font-semibold rounded-[6px] transition-colors inline-flex items-center space-x-1 shadow-2xs cursor-pointer"
                          >
                            <span>Actions</span>
                            <ChevronDown
                              size={12}
                              className={`transition-transform duration-150 ${
                                openDropdownId === c.id ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {openDropdownId === c.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20"
                                onClick={() => setOpenDropdownId(null)}
                              />

                              <div className="absolute right-0 mt-1 w-52 bg-white border border-[#E2E8F4] rounded-[8px] shadow-lg py-1 z-30 divide-y divide-[#E2E8F4] text-xs text-left animate-in fade-in zoom-in-95 duration-100">
                                <div className="py-1">
                                  {/* View Details */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      handleOpenDetail(c);
                                    }}
                                    className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer"
                                  >
                                    <Eye size={13} className="text-[#1B3270]" />
                                    <span>View Details</span>
                                  </button>

                                  {/* Edit Details */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      handleOpenEdit(c);
                                    }}
                                    className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer"
                                  >
                                    <Edit3 size={13} className="text-amber-600" />
                                    <span>Edit Details</span>
                                  </button>

                                  {/* Remind Candidate */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      setNudgeModal({ target: 'candidate', candidate: c });
                                      setNudgeTitle('Action Required on Portal');
                                      setNudgeMessage(
                                        `Dear ${c.first_name}, check your TerraTern account to complete pending qualifications.`
                                      );
                                    }}
                                    className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer"
                                  >
                                    <Bell size={13} className="text-indigo-600" />
                                    <span>Remind Candidate</span>
                                  </button>

                                  {/* Remind Supplier (supplier candidates only) */}
                                  {c.supplier_id && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        setNudgeModal({ target: 'supplier', candidate: c });
                                        setNudgeTitle(`Candidate Follow-Up: ${c.first_name}`);
                                        setNudgeMessage(
                                          `Candidate ${c.first_name} ${c.last_name}: Follow up with document verification.`
                                        );
                                      }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer"
                                    >
                                      <Building2 size={13} className="text-sky-600" />
                                      <span>Remind Supplier</span>
                                    </button>
                                  )}

                                  {/* Escalate to Placement Lead */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      handleOpenEscalate(c);
                                    }}
                                    className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer"
                                  >
                                    <AlertTriangle size={13} className="text-purple-600" />
                                    <span>Escalate to Lead</span>
                                  </button>
                                </div>

                                <div className="py-1">
                                  {/* Delete Candidate */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      setDeleteCandidateTarget(c);
                                    }}
                                    className="w-full px-3 py-1.5 hover:bg-rose-50 flex items-center space-x-2 text-rose-600 font-semibold cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                    <span>Delete Candidate</span>
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedCandidate.first_name} {selectedCandidate.last_name}
                </h3>
                <p className="text-xs text-slate-500">
                  #{selectedCandidate.id.slice(0, 6).toUpperCase()} •{' '}
                  {selectedCandidate.supplier_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {drawerLoading ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1B3270] mx-auto" />
                  <p className="text-slate-500">Loading candidate records...</p>
                </div>
              ) : (
                <>
                  {/* Overview Grid */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-[8px] border border-[#E2E8F4]">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Target Role</span>
                      <span className="font-bold text-slate-800">
                        {selectedCandidate.target_role || 'General Nursing'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Language Level</span>
                      <span className="font-bold text-slate-800">
                        {selectedCandidate.language_level}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Current Stage</span>
                      <span className="font-bold text-slate-800">
                        {selectedCandidate.current_gate}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[11px] block">Stage Duration</span>
                      <span className="font-bold text-slate-800">
                        {selectedCandidate.days_in_stage} days
                      </span>
                    </div>
                  </div>

                  {/* Gate Results History */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Qualification Gate Milestones
                    </h4>
                    {gateHistory.length === 0 ? (
                      <p className="text-slate-400 italic py-2">
                        No gate assessments recorded yet.
                      </p>
                    ) : (
                      <div className="border border-[#E2E8F4] rounded-[8px] overflow-hidden divide-y divide-[#E2E8F4]">
                        {gateHistory.map((g) => (
                          <div
                            key={g.id}
                            className="p-3 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-slate-900">
                                {getGateLabel(g.gate_type)}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Attempt #{g.attempt_number} •{' '}
                                {new Date(g.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                g.status === 'pass'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {g.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Profile & 18 Documents View */}
                  <CandidateProfileDetailView
                    candidateId={selectedCandidate.id}
                    showAttentionAlert={true}
                  />

                  {/* Academic Speaking Test Status */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Academic Assessments & Mentorship
                    </h4>
                    {academicRequests.length === 0 ? (
                      <p className="text-slate-400 italic py-2">
                        No speaking test requests recorded.
                      </p>
                    ) : (
                      <div className="border border-[#E2E8F4] rounded-[8px] overflow-hidden divide-y divide-[#E2E8F4]">
                        {academicRequests.map((a) => (
                          <div
                            key={a.id}
                            className="p-3 flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-slate-900">
                                {a.request_type.replace('_', ' ')}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Mentor: {a.mentor_name}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                a.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {a.status.replace('_', ' ')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Academic Cohort & Bootcamp Section */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-4 h-4 text-[#1B3270]" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                        Academic Cohort &amp; Bootcamp
                      </h4>
                    </div>
                    {!cohortDetail ? (
                      <p className="text-slate-400 italic text-xs py-2 bg-slate-50 p-3 rounded-lg border border-[#E2E8F4]">
                        Candidate is not currently enrolled in any academic training cohort.
                      </p>
                    ) : (
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-slate-900 text-sm">
                              {cohortDetail.name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium">
                              Track: {cohortDetail.track}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase">
                            Enrolled
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E2E8F4] text-xs">
                          <div className="p-2 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                            <span className="text-[10px] text-slate-500 block">Attendance</span>
                            <span className="font-bold text-slate-800">
                              {cohortDetail.sessions_attended} / {cohortDetail.total_sessions} sessions
                            </span>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                            <span className="text-[10px] text-slate-500 block">Next Session</span>
                            <span className="font-bold text-slate-800">
                              {cohortDetail.next_session_date
                                ? formatDate(cohortDetail.next_session_date)
                                : 'No upcoming sessions'}
                            </span>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                            <span className="text-[10px] text-slate-500 block">
                              Final Test Attempts
                            </span>
                            <span className="font-bold text-slate-800">
                              {cohortDetail.final_test_attempts}
                            </span>
                          </div>
                          <div className="p-2 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                            <span className="text-[10px] text-slate-500 block">
                              Consecutive Fails
                            </span>
                            <span
                              className={`font-bold ${
                                cohortDetail.final_consecutive_fails >= 2
                                  ? 'text-rose-600'
                                  : 'text-slate-800'
                              }`}
                            >
                              {cohortDetail.final_consecutive_fails}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Supplier Partner Notes (Read-Only) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-[#1B3270]" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          Supplier Partner Notes ({supplierNotes.length})
                        </h4>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400">
                        Supplier Owned • Read-Only
                      </span>
                    </div>

                    {supplierNotes.length === 0 ? (
                      <p className="text-slate-400 italic text-xs py-2 bg-slate-50 p-3 rounded-lg border border-[#E2E8F4]">
                        No notes submitted by the agency supplier for this candidate.
                      </p>
                    ) : (
                      <div className="border border-[#E2E8F4] rounded-[8px] overflow-hidden divide-y divide-[#E2E8F4]">
                        {supplierNotes.map((note) => (
                          <div key={note.id} className="p-3 bg-slate-50/50 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-slate-700">
                                {note.author_name}
                              </span>
                              <span className="text-slate-400 font-mono">
                                {formatDate(note.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 whitespace-pre-wrap">
                              {note.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* RM Internal Notes (Editable by RM) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Edit3 className="w-4 h-4 text-[#1B3270]" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          RM Internal Notes ({internalNotes.length})
                        </h4>
                      </div>
                      <span className="text-[10px] font-semibold text-purple-700">
                        Internal Only
                      </span>
                    </div>

                    {internalNotes.length === 0 ? (
                      <p className="text-slate-400 italic text-xs py-2 bg-slate-50 p-3 rounded-lg border border-[#E2E8F4]">
                        No internal RM notes recorded for this candidate.
                      </p>
                    ) : (
                      <div className="border border-[#E2E8F4] rounded-[8px] overflow-hidden divide-y divide-[#E2E8F4]">
                        {internalNotes.map((note) => (
                          <div key={note.id} className="p-3 bg-white space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-semibold text-[#1B3270]">
                                {note.author_name}
                              </span>
                              <span className="text-slate-400 font-mono">
                                {formatDate(note.created_at)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 whitespace-pre-wrap">
                              {note.note}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleAddInternalNote} className="space-y-2 pt-2">
                      <textarea
                        rows={2}
                        value={newInternalNote}
                        onChange={(e) => setNewInternalNote(e.target.value)}
                        placeholder="Add an internal RM note (visible to TerraTern internal team only)..."
                        className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={savingInternalNote || !newInternalNote.trim()}
                          className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-50 text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs flex items-center space-x-1.5"
                        >
                          {savingInternalNote ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Save RM Note</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-[#E2E8F4] bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="px-4 py-2 bg-white border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NUDGE MODAL */}
      {nudgeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Send Notification
              </h3>
              <button
                type="button"
                onClick={() => setNudgeModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Recipient:{' '}
              <span className="font-bold text-slate-900 capitalize">
                {nudgeModal.target === 'candidate'
                  ? `${nudgeModal.candidate.first_name} ${nudgeModal.candidate.last_name}`
                  : nudgeModal.candidate.supplier_name}
              </span>
            </div>

            <form onSubmit={handleSendNotification} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notification Title
                </label>
                <input
                  type="text"
                  required
                  value={nudgeTitle}
                  onChange={(e) => setNudgeTitle(e.target.value)}
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Message Content
                </label>
                <textarea
                  rows={3}
                  required
                  value={nudgeMessage}
                  onChange={(e) => setNudgeMessage(e.target.value)}
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setNudgeModal(null)}
                  className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={nudging}
                  className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs"
                >
                  {nudging ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Dispatch</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT REVIEW PANEL (Parts 3 & 4) */}
      <DocumentReviewPanel
        candidate={selectedReviewCandidate}
        isOpen={isReviewPanelOpen}
        onClose={() => {
          setIsReviewPanelOpen(false);
          setSelectedReviewCandidate(null);
        }}
        onSuccess={() => {
          fetchMyCandidates();
        }}
      />

      {/* EDIT CANDIDATE MODAL */}
      {editCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-md w-full shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F4]">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Candidate Details</h3>
                <p className="text-xs text-slate-500">Candidate/Supplier RM Administration</p>
              </div>
              <button
                type="button"
                onClick={() => setEditCandidate(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Role
                  </label>
                  <select
                    value={editTargetRole}
                    onChange={(e) => setEditTargetRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270] bg-white text-slate-700"
                  >
                    <option value="nursing">General Nursing</option>
                    <option value="icu">ICU Nurse</option>
                    <option value="pediatric">Pediatric Care</option>
                    <option value="geriatric">Geriatric Care</option>
                    <option value="surgical">Surgical Care</option>
                    <option value="physiotherapy">Physiotherapy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Language Level
                  </label>
                  <select
                    value={editLanguageLevel}
                    onChange={(e) => setEditLanguageLevel(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270] bg-white text-slate-700"
                  >
                    <option value="A1">A1 — Beginner</option>
                    <option value="A2">A2 — Elementary</option>
                    <option value="B1">B1 — Intermediate</option>
                    <option value="B2">B2 — Professional</option>
                    <option value="C1">C1 — Advanced</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pipeline Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270] bg-white text-slate-700"
                  >
                    <option value="onboarding">Onboarding</option>
                    <option value="in_progress">In Qualification</option>
                    <option value="interview_ready">Interview Ready</option>
                    <option value="placed">Placed</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditCandidate(null)}
                  className="px-4 py-2 bg-white border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs inline-flex items-center space-x-1"
                >
                  {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ESCALATE TO PLACEMENT LEAD MODAL */}
      {escalateCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-md w-full shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F4]">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Escalate to Placement Lead
                </h3>
                <p className="text-xs text-slate-500">
                  Candidate: {escalateCandidate.first_name} {escalateCandidate.last_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEscalateCandidate(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleConfirmEscalate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Escalation Issue *
                </label>
                <select
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270] bg-white text-slate-700"
                >
                  <option value="stalled">Candidate Qualification Stalled &gt; 7 Days</option>
                  <option value="docs_delayed">Critical Document Verification Delayed</option>
                  <option value="mentor_needed">Urgent Speaking Test / Mentor Assignment Required</option>
                  <option value="employer_feedback">Employer Offer / Interview Stage Blocker</option>
                  <option value="other">General Account Management Escalation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Urgency
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['normal', 'high', 'urgent'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setEscalatePriority(lvl)}
                      className={`py-1.5 text-xs font-semibold rounded-[6px] border capitalize cursor-pointer transition-colors ${
                        escalatePriority === lvl
                          ? lvl === 'urgent'
                            ? 'bg-rose-50 border-rose-300 text-rose-800'
                            : 'bg-indigo-50 border-indigo-300 text-indigo-800'
                          : 'bg-white border-[#E2E8F4] text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Detailed Notes for Placement Lead
                </label>
                <textarea
                  rows={3}
                  value={escalateNotes}
                  onChange={(e) => setEscalateNotes(e.target.value)}
                  placeholder="Explain the impediment, candidate background, and specific support needed..."
                  className="w-full p-2.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                />
              </div>

              <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEscalateCandidate(null)}
                  className="px-4 py-2 bg-white border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingEscalate}
                  className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs inline-flex items-center space-x-1"
                >
                  {submittingEscalate ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  <span>Submit to Lead</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteCandidateTarget && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-md w-full shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <div className="p-2 bg-rose-50 rounded-full">
                <Trash2 size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Candidate Record</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900">
                {deleteCandidateTarget.first_name} {deleteCandidateTarget.last_name}
              </strong>
              ? This will remove all associated submissions and records across the platform.
            </p>

            <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-[6px] text-[11px] text-rose-800">
              This action is irreversible.
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteCandidateTarget(null)}
                className="px-4 py-2 bg-white border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingCandidate}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs inline-flex items-center space-x-1"
              >
                {deletingCandidate ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateRmCandidatesTab;
