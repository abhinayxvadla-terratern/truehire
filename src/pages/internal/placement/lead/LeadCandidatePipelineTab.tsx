import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import { notifyByRole } from '../../../../utils/notificationRouting';
import {
  Users,
  Search,
  Bell,
  AlertTriangle,
  UserCheck,
  Building2,
  X,
  Loader2,
  Check,
  Send,
  Sparkles,
  ChevronDown,
  Edit3,
  Trash2,
  GraduationCap,
  Award,
  Clock,
} from 'lucide-react';
import { getGateLabel, getCandidateStatusLabel } from '../../../../utils/labels';
import { formatDate } from '../../../../utils/formatters';
import { MultiSelectFilter } from '../../../../components/ui/MultiSelectFilter';

interface CandidateRow {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  supplier_id: string | null;
  supplier_name: string;
  supplier_user_id?: string | null;
  target_role: string | null;
  status: string;
  current_gate: string;
  gate_status: string;
  rm_name: string;
  rm_id: string | null;
  days_in_stage: number;
  created_at: string;
  updated_at: string;
  // Requested Telemetry Columns
  dt_attempt_count: number;
  dt_passed: boolean;
  is_cooling: boolean;
  cooling_ends_at?: string | null;
  consec_fails: number;
  cohort_name: string;
  profile_pct: number;
}

interface RMOption {
  id: string;
  name: string;
  email: string;
}

export const LeadCandidatePipelineTab: React.FC = () => {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [gateFilters, setGateFilters] = useState<string[]>([]);
  const [supplierFilters, setSupplierFilters] = useState<string[]>([]);
  const [rmFilters, setRmFilters] = useState<string[]>([]);

  // Dropdown options
  const [supplierOptions, setSupplierOptions] = useState<{ id: string; name: string }[]>([]);
  const [rmOptions, setRmOptions] = useState<RMOption[]>([]);

  const statusOptions = useMemo(() => [
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'in_progress', label: 'In Gates' },
    { value: 'interview_ready', label: 'Interview Ready' },
    { value: 'reveal_gate', label: 'Reveal Gate' },
    { value: 'placed', label: 'Placed' },
  ], []);

  const gateOptions = useMemo(() => [
    { value: 'dt', label: 'Gate 1: Diagnostic Test (DT)' },
    { value: 'doc_verification', label: 'Gate 2: Doc Verification' },
    { value: 'speaking_test', label: 'Gate 3: Speaking Test' },
    { value: 'bootcamp', label: 'Gate 4: Bootcamp' },
    { value: 'assessment', label: 'Gate 5: Final Assessment' },
  ], []);

  const supplierFilterOptions = useMemo(() => {
    return supplierOptions.map((s) => ({ value: s.id, label: s.name }));
  }, [supplierOptions]);

  const rmFilterOptions = useMemo(() => {
    return rmOptions.map((r) => ({ value: r.id, label: r.name }));
  }, [rmOptions]);

  // Action Modals
  const [nudgeModal, setNudgeModal] = useState<{
    target: 'candidate' | 'supplier';
    candidate: CandidateRow;
  } | null>(null);
  const [nudgeTitle, setNudgeTitle] = useState('');
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [nudging, setNudging] = useState(false);

  const [flagModal, setFlagModal] = useState<CandidateRow | null>(null);
  const [flagNote, setFlagNote] = useState('');
  const [flagging, setFlagging] = useState(false);

  const [speakingModal, setSpeakingModal] = useState<CandidateRow | null>(null);
  const [speakingNotes, setSpeakingNotes] = useState('');
  const [requestingSpeaking, setRequestingSpeaking] = useState(false);

  const [reassignModal, setReassignModal] = useState<CandidateRow | null>(null);
  const [selectedRmId, setSelectedRmId] = useState('');
  const [reassigning, setReassigning] = useState(false);

  // Actions Dropdown state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Edit Candidate Modal state
  const [editModalCandidate, setEditModalCandidate] = useState<CandidateRow | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editTargetRole, setEditTargetRole] = useState('nursing');
  const [editStatus, setEditStatus] = useState('onboarding');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Candidate Modal state
  const [deleteModalCandidate, setDeleteModalCandidate] = useState<CandidateRow | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState(false);

  // Candidate Detail Drawer State
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRow | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [candidateDtAttempts, setCandidateDtAttempts] = useState<any[]>([]);
  const [candidateCoolingPeriods, setCandidateCoolingPeriods] = useState<any[]>([]);
  const [candidateCohortInfo, setCandidateCohortInfo] = useState<any | null>(null);
  const [candidateFinalAssessments, setCandidateFinalAssessments] = useState<any[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleOpenCandidateDetail = async (cand: CandidateRow) => {
    setSelectedCandidate(cand);
    setDrawerLoading(true);

    try {
      const [dtRes, coolingRes, cohortMemRes, finalRes] = await Promise.all([
        supabase
          .from('dt_attempts')
          .select('*')
          .eq('candidate_id', cand.id)
          .order('attempt_number', { ascending: false }),
        supabase
          .from('cooling_periods')
          .select('*')
          .eq('candidate_id', cand.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('cohort_members')
          .select(`
            id,
            status,
            joined_at,
            cohorts:cohort_id (
              id,
              name,
              track,
              status,
              start_date,
              end_date,
              mentor_id,
              profiles:mentor_id (first_name, last_name, email)
            )
          `)
          .eq('candidate_id', cand.id)
          .maybeSingle(),
        supabase
          .from('candidate_final_assessments')
          .select('*')
          .eq('candidate_id', cand.id)
          .order('attempt_number', { ascending: false }),
      ]);

      setCandidateDtAttempts(dtRes.data || []);
      setCandidateCoolingPeriods(coolingRes.data || []);
      setCandidateCohortInfo(cohortMemRes.data || null);
      setCandidateFinalAssessments(finalRes.data || []);
    } catch (err) {
      console.error('Error fetching candidate telemetry details:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleOpenEdit = (cand: CandidateRow) => {
    setEditModalCandidate(cand);
    setEditFirstName(cand.first_name || '');
    setEditLastName(cand.last_name || '');
    setEditEmail(cand.email || '');
    setEditTargetRole(cand.target_role || 'nursing');
    setEditStatus(cand.status || 'onboarding');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalCandidate) return;

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
          email: editEmail.trim().toLowerCase() || null,
          target_role: editTargetRole,
          status: editStatus,
        })
        .eq('id', editModalCandidate.id);

      if (error) throw error;

      showToast(`Candidate ${editFirstName} ${editLastName} updated successfully.`);
      setEditModalCandidate(null);
      fetchCandidatePipeline();
    } catch (err: any) {
      console.error('Error updating candidate:', err);
      alert(`Failed to update candidate: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalCandidate) return;

    try {
      setDeletingCandidate(true);
      const { error } = await supabase.rpc('delete_candidate', {
        target_candidate_id: deleteModalCandidate.id,
      });

      if (error) throw error;

      const name = `${deleteModalCandidate.first_name} ${deleteModalCandidate.last_name}`;
      showToast(`Candidate ${name} deleted successfully.`);
      setCandidates((prev) => prev.filter((c) => c.id !== deleteModalCandidate.id));
      setDeleteModalCandidate(null);
    } catch (err: any) {
      console.error('Error deleting candidate:', err);
      alert(`Failed to delete candidate: ${err.message}`);
    } finally {
      setDeletingCandidate(false);
    }
  };

  const fetchCandidatePipeline = async () => {
    try {
      setLoading(true);

      // 1. Fetch all candidates
      const { data: cands, error: candsErr } = await supabase
        .from('candidates')
        .select('*')
        .order('created_at', { ascending: false });

      if (candsErr) throw candsErr;
      const candList = cands || [];

      // 2. Fetch suppliers
      const { data: sups } = await supabase
        .from('suppliers')
        .select('id, company_name, user_id');

      const supMap: Record<string, { name: string; userId: string | null }> = {};
      const supOpts: { id: string; name: string }[] = [];
      (sups || []).forEach((s) => {
        supMap[s.id] = { name: s.company_name, userId: s.user_id };
        supOpts.push({ id: s.id, name: s.company_name });
      });
      setSupplierOptions(supOpts);

      // 3. Fetch candidate RMs
      const { data: rms } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'candidate_supplier_rm')
        .eq('is_internal', true);

      const rmOpts: RMOption[] = (rms || []).map((r) => ({
        id: r.id,
        name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email,
        email: r.email,
      }));
      setRmOptions(rmOpts);

      // 4. Fetch supplier RM assignments
      const { data: assignments } = await supabase
        .from('rm_assignments')
        .select(`
          entity_id,
          rm_profile_id,
          profiles:rm_profile_id (first_name, last_name, email)
        `)
        .eq('entity_type', 'supplier')
        .eq('active', true);

      const supRmMap: Record<string, { rmId: string; rmName: string }> = {};
      (assignments || []).forEach((a: any) => {
        const name = a.profiles
          ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}`.trim() ||
            a.profiles.email
          : 'Assigned RM';
        supRmMap[a.entity_id] = { rmId: a.rm_profile_id, rmName: name };
      });

      // 5. Fetch latest gate results for each candidate
      const candIds = candList.map((c) => c.id);
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

      // 6. Fetch cohorts map
      const { data: allCohorts } = await supabase
        .from('cohorts')
        .select('id, name');

      const cohortNameMap: Record<string, string> = {};
      (allCohorts || []).forEach((ch) => {
        cohortNameMap[ch.id] = ch.name;
      });

      // 7. Fetch active cooling periods for candidates
      const { data: allCooling } = await supabase
        .from('cooling_periods')
        .select('candidate_id, ends_at, status')
        .eq('gate_type', 'dt')
        .eq('status', 'active');

      const activeCoolingMap: Record<string, string> = {};
      (allCooling || []).forEach((cl) => {
        activeCoolingMap[cl.candidate_id] = cl.ends_at;
      });

      // Assemble Candidate Rows
      const rows: CandidateRow[] = candList.map((c) => {
        const supInfo = c.supplier_id ? supMap[c.supplier_id] : null;
        const rmInfo = c.supplier_id ? supRmMap[c.supplier_id] : null;
        const gate = gateMap[c.id];

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
          email: 'N/A', // Email can be fetched from profiles if available or N/A
          supplier_id: c.supplier_id,
          supplier_name: supInfo ? supInfo.name : 'Direct Sourced',
          supplier_user_id: supInfo ? supInfo.userId : null,
          target_role: c.target_role,
          status: c.status,
          current_gate: gate ? getGateLabel(gate.gate_type) : 'Not Started',
          gate_status: gate ? gate.status : 'pending',
          rm_name: rmInfo ? rmInfo.rmName : 'Unassigned',
          rm_id: rmInfo ? rmInfo.rmId : null,
          days_in_stage: daysDiff,
          created_at: c.created_at,
          updated_at: gate?.date || c.created_at,
          // Telemetry fields
          dt_attempt_count: c.dt_attempt_count || 0,
          dt_passed: Boolean(c.dt_passed_at),
          is_cooling: Boolean(activeCoolingMap[c.id]),
          cooling_ends_at: activeCoolingMap[c.id] || null,
          consec_fails: c.consecutive_final_test_fails || c.consecutive_dt_fails || 0,
          cohort_name: (c.cohort_id && cohortNameMap[c.cohort_id]) || '—',
          profile_pct: c.profile_completion_pct || 0,
        };
      });

      // Fetch emails for candidates from profiles where user_id is present
      const userIds = rows.map((r) => r.user_id).filter(Boolean) as string[];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, email')
          .in('id', userIds);

        const emailMap: Record<string, string> = {};
        (profs || []).forEach((p) => {
          emailMap[p.id] = p.email;
        });

        rows.forEach((r) => {
          if (r.user_id && emailMap[r.user_id]) {
            r.email = emailMap[r.user_id];
          }
        });
      }

      setCandidates(rows);
    } catch (err) {
      console.error('Error loading candidate pipeline:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidatePipeline();
  }, []);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      if (statusFilters.length > 0 && !statusFilters.includes(c.status)) return false;
      if (gateFilters.length > 0) {
        const currentCode = (c.current_gate || '').toLowerCase();
        const match = gateFilters.some(
          (g) =>
            currentCode.includes(g) ||
            (g === 'dt' && currentCode.includes('diagnostic'))
        );
        if (!match) return false;
      }
      if (
        supplierFilters.length > 0 &&
        (!c.supplier_id || !supplierFilters.includes(c.supplier_id))
      )
        return false;
      if (rmFilters.length > 0 && (!c.rm_id || !rmFilters.includes(c.rm_id)))
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = `${c.first_name} ${c.last_name}`.toLowerCase().includes(q);
        const matchSup = c.supplier_name.toLowerCase().includes(q);
        const matchEmail = c.email.toLowerCase().includes(q);
        const matchId = c.id.toLowerCase().includes(q);
        if (!matchName && !matchSup && !matchEmail && !matchId) return false;
      }

      return true;
    });
  }, [candidates, statusFilters, gateFilters, supplierFilters, rmFilters, searchQuery]);

  // Action Handlers
  const handleSendNudge = async (e: React.FormEvent) => {
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
        title: nudgeTitle || `Action required regarding candidate progression`,
        message: nudgeMessage,
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      if (error) throw error;

      showToast(
        `Nudge sent successfully to ${
          nudgeModal.target === 'candidate' ? 'Candidate' : 'Supplier Partner'
        }`
      );
      setNudgeModal(null);
      setNudgeTitle('');
      setNudgeMessage('');
    } catch (err: any) {
      alert(`Failed to dispatch notification: ${err.message}`);
    } finally {
      setNudging(false);
    }
  };

  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagModal || !user) return;

    try {
      setFlagging(true);
      const { error } = await supabase.from('escalations').insert({
        entity_type: 'candidate',
        entity_id: flagModal.id,
        note: flagNote,
        raised_by: user.id,
        status: 'open',
      });

      if (error) throw error;

      showToast(`Flagged escalation for ${flagModal.first_name} ${flagModal.last_name}`);
      setFlagModal(null);
      setFlagNote('');
    } catch (err: any) {
      alert(`Failed to raise escalation: ${err.message}`);
    } finally {
      setFlagging(false);
    }
  };

  const handleRequestSpeakingTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!speakingModal || !user) return;

    try {
      setRequestingSpeaking(true);

      // 1. Insert into academic_requests
      const { error: reqErr } = await supabase.from('academic_requests').insert({
        candidate_id: speakingModal.id,
        request_type: 'speaking_test',
        requested_by: user.id,
        status: 'pending_assignment',
        notes: speakingNotes || null,
      });

      if (reqErr) throw reqErr;

      // 2. Notify Academic Lead
      await notifyByRole(
        supabase,
        'academic_lead',
        'Speaking Test Request (Placement Lead)',
        `Candidate ${speakingModal.first_name} ${speakingModal.last_name} from ${speakingModal.supplier_name} is ready for Speaking Test. Assign a mentor.`,
        'general',
        user.id
      );

      showToast('Speaking Test requested. Academic team has been notified.');
      setSpeakingModal(null);
      setSpeakingNotes('');
    } catch (err: any) {
      alert(`Failed to submit speaking test request: ${err.message}`);
    } finally {
      setRequestingSpeaking(false);
    }
  };

  const handleReassignRm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModal || !reassignModal.supplier_id || !selectedRmId || !user) return;

    try {
      setReassigning(true);

      // Deactivate existing
      await supabase
        .from('rm_assignments')
        .update({ active: false })
        .eq('entity_type', 'supplier')
        .eq('entity_id', reassignModal.supplier_id);

      // Insert new
      const { error } = await supabase.from('rm_assignments').insert({
        entity_type: 'supplier',
        entity_id: reassignModal.supplier_id,
        rm_profile_id: selectedRmId,
        assigned_by: user.id,
        active: true,
      });

      if (error) throw error;

      showToast(`Supplier reassigned to new Relationship Manager`);
      setReassignModal(null);
      fetchCandidatePipeline();
    } catch (err: any) {
      alert(`Failed to reassign RM: ${err.message}`);
    } finally {
      setReassigning(false);
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

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Candidate Pipeline Telemetry
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Comprehensive qualification flow across all international candidates, supplier channels, and assigned RMs.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate, email, supplier..."
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

          {/* Gate Filter */}
          <div>
            <MultiSelectFilter
              label="Gate Stage"
              options={gateOptions}
              selectedValues={gateFilters}
              onChange={setGateFilters}
            />
          </div>

          {/* Supplier Filter */}
          <div>
            <MultiSelectFilter
              label="Supplier"
              options={supplierFilterOptions}
              selectedValues={supplierFilters}
              onChange={setSupplierFilters}
            />
          </div>

          {/* RM Assigned Filter */}
          <div>
            <MultiSelectFilter
              label="RM Assigned"
              options={rmFilterOptions}
              selectedValues={rmFilters}
              onChange={setRmFilters}
            />
          </div>
        </div>
      </div>

      {/* Candidates Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">
              No candidates found
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Adjust your search filters or check back once candidates enter the qualification pipeline.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">DT</th>
                  <th className="py-3 px-4">Cooling</th>
                  <th className="py-3 px-4 text-center">Consec. Fails</th>
                  <th className="py-3 px-4">Cohort</th>
                  <th className="py-3 px-4">Profile</th>
                  <th className="py-3 px-4">Supplier Partner</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">RM Assigned</th>
                  <th className="py-3 px-4 text-right">Lead Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredCandidates.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F8FAFD] transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <button
                        type="button"
                        onClick={() => handleOpenCandidateDetail(c)}
                        className="text-left group cursor-pointer"
                      >
                        <div className="font-semibold text-slate-900 group-hover:text-[#1B3270] transition-colors">
                          {c.first_name} {c.last_name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">
                          {c.email !== 'N/A' ? c.email : `#${c.id.slice(0, 6).toUpperCase()}`}
                        </div>
                      </button>
                    </td>

                    {/* DT Column */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {c.dt_passed ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Passed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {c.dt_attempt_count}/10
                        </span>
                      )}
                    </td>

                    {/* Cooling Column */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {c.is_cooling ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1 w-fit">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">None</span>
                      )}
                    </td>

                    {/* Consec. Fails */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {c.consec_fails > 0 ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.consec_fails >= 2
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {c.consec_fails}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    {/* Cohort */}
                    <td className="py-3.5 px-4 text-slate-800 whitespace-nowrap">
                      {c.cohort_name !== '—' ? (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <GraduationCap className="w-3 h-3 text-indigo-600" />
                          <span className="truncate max-w-[110px]">{c.cohort_name}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Profile % */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <div className="w-12 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-[#1B3270] h-1.5 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(0, c.profile_pct))}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-slate-700">{c.profile_pct}%</span>
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5 text-slate-800">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-medium truncate max-w-[120px]">
                          {c.supplier_name}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
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

                    {/* RM Assigned */}
                    <td className="py-3.5 px-4">
                      <span className="text-slate-800 font-medium">
                        {c.rm_name}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenCandidateDetail(c)}
                          className="py-1 px-2.5 bg-[#1B3270] hover:bg-[#152758] text-white text-[11px] font-semibold rounded-[6px] shadow-2xs transition-colors cursor-pointer"
                        >
                          Telemetry
                        </button>
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={() => setOpenDropdownId(openDropdownId === c.id ? null : c.id)}
                            className="py-1 px-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-[#E2E8F4] text-[11px] font-semibold rounded-[6px] transition-colors inline-flex items-center space-x-1 shadow-2xs cursor-pointer"
                          >
                            <span>More</span>
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
                                    setNudgeTitle('Profile Completion Notice');
                                    setNudgeMessage(
                                      `Dear ${c.first_name}, log into TerraTern to complete outstanding qualification milestones.`
                                    );
                                  }}
                                  className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer"
                                >
                                  <Bell size={13} className="text-indigo-600" />
                                  <span>Remind Candidate</span>
                                </button>

                                {/* Remind Supplier */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setNudgeModal({ target: 'supplier', candidate: c });
                                    setNudgeTitle(`Candidate Follow-up: ${c.first_name}`);
                                    setNudgeMessage(
                                      `Assist candidate ${c.first_name} ${c.last_name} with stage documentation.`
                                    );
                                  }}
                                  className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer"
                                >
                                  <Building2 size={13} className="text-sky-600" />
                                  <span>Remind Supplier</span>
                                </button>

                                {/* Request Speaking Test */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setSpeakingModal(c);
                                    setSpeakingNotes('');
                                  }}
                                  className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer"
                                >
                                  <Sparkles size={13} className="text-emerald-600" />
                                  <span>Request Speaking Test</span>
                                </button>

                                {/* Flag as At-Risk */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setFlagModal(c);
                                    setFlagNote('');
                                  }}
                                  className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer"
                                >
                                  <AlertTriangle size={13} className="text-rose-600" />
                                  <span>Flag as At-Risk</span>
                                </button>

                                {/* Reassign RM */}
                                {c.supplier_id && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      setReassignModal(c);
                                      setSelectedRmId(c.rm_id || '');
                                    }}
                                    className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer"
                                  >
                                    <UserCheck size={13} className="text-[#1B3270]" />
                                    <span>Reassign RM</span>
                                  </button>
                                )}
                              </div>

                              <div className="py-1">
                                {/* Delete Candidate */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenDropdownId(null);
                                    setDeleteModalCandidate(c);
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

      {/* NUDGE MODAL */}
      {nudgeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Send Reminder
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
                  : `${nudgeModal.candidate.supplier_name}`}
              </span>
            </div>

            <form onSubmit={handleSendNudge} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Title
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
                  Message
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
                  <span>Send Reminder</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLAG ESCALATION MODAL */}
      {flagModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Flag as At-Risk
              </h3>
              <button
                type="button"
                onClick={() => setFlagModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Escalating candidate:{' '}
              <span className="font-bold text-slate-900">
                {flagModal.first_name} {flagModal.last_name}
              </span>
            </div>

            <form onSubmit={handleCreateFlag} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Escalation Detail / Issue Note
                </label>
                <textarea
                  rows={3}
                  required
                  value={flagNote}
                  onChange={(e) => setFlagNote(e.target.value)}
                  placeholder="Describe the blocker, missing document, or escalation rationale..."
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setFlagModal(null)}
                  className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={flagging}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs"
                >
                  {flagging ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  <span>Flag as At-Risk</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SPEAKING TEST REQUEST MODAL */}
      {speakingModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Request Speaking Test Assessment
              </h3>
              <button
                type="button"
                onClick={() => setSpeakingModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3 text-xs space-y-1">
              <div>
                Candidate:{' '}
                <span className="font-bold text-slate-900">
                  {speakingModal.first_name} {speakingModal.last_name}
                </span>
              </div>
              <div>
                Target Role:{' '}
                <span className="font-semibold text-slate-700 uppercase">
                  {speakingModal.target_role || 'Healthcare Placement'}
                </span>
              </div>
              <p className="text-slate-500 pt-1 text-[11px]">
                This will submit an academic assessment request for the Academic Lead to assign an accredited language mentor.
              </p>
            </div>

            <form onSubmit={handleRequestSpeakingTest} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional Assessment Notes for Mentor
                </label>
                <textarea
                  rows={2}
                  value={speakingNotes}
                  onChange={(e) => setSpeakingNotes(e.target.value)}
                  placeholder="Specific focus areas, German dialect exposure..."
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setSpeakingModal(null)}
                  className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestingSpeaking}
                  className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs"
                >
                  {requestingSpeaking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASSIGN RM MODAL */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Reassign Candidate / Supplier RM
              </h3>
              <button
                type="button"
                onClick={() => setReassignModal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Supplier Partner:{' '}
              <span className="font-bold text-slate-900">
                {reassignModal.supplier_name}
              </span>
            </div>

            <form onSubmit={handleReassignRm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Designate Relationship Manager
                </label>
                <select
                  required
                  value={selectedRmId}
                  onChange={(e) => setSelectedRmId(e.target.value)}
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                >
                  <option value="">Select Candidate RM...</option>
                  {rmOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setReassignModal(null)}
                  className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reassigning || !selectedRmId}
                  className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs disabled:opacity-50"
                >
                  {reassigning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <UserCheck className="w-3.5 h-3.5" />
                  )}
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CANDIDATE MODAL */}
      {editModalCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-md w-full shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F4]">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Edit Candidate Details</h3>
                <p className="text-xs text-slate-500">Placement Lead Administrative Edit</p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalCandidate(null)}
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

                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
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
                    <option value="pediatric">Pediatric</option>
                    <option value="geriatric">Geriatric Care</option>
                    <option value="surgical">Surgical Care</option>
                    <option value="physiotherapy">Physiotherapy</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270] bg-white text-slate-700"
                  >
                    <option value="onboarding">Onboarding</option>
                    <option value="in_progress">In Qualification</option>
                    <option value="interview_ready">Interview Ready</option>
                    <option value="reveal_gate">Reveal Gate</option>
                    <option value="placed">Placed</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditModalCandidate(null)}
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

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalCandidate && (
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
                {deleteModalCandidate.first_name} {deleteModalCandidate.last_name}
              </strong>
              ? This will remove all associated gate submissions, documents, and records from the platform.
            </p>

            <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-[6px] text-[11px] text-rose-800">
              This action is irreversible.
            </div>

            <div className="mt-6 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setDeleteModalCandidate(null)}
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

      {/* CANDIDATE DETAIL DRAWER (FULL TELEMETRY) */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex justify-end z-50 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <span>{selectedCandidate.first_name} {selectedCandidate.last_name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold uppercase bg-slate-100 text-slate-700">
                    {selectedCandidate.status.replace(/_/g, ' ')}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Role: {selectedCandidate.target_role || 'Healthcare'} • Supplier: {selectedCandidate.supplier_name} • RM: {selectedCandidate.rm_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidate(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {drawerLoading ? (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <p className="text-xs">Loading candidate telemetry...</p>
                </div>
              ) : (
                <>
                  {/* DT HISTORY & COOLING SECTION */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 text-[#1B3270]" />
                        <span>Diagnostic Test (DT) History & Cooling</span>
                      </h4>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {selectedCandidate.dt_passed ? 'Passed' : `${selectedCandidate.dt_attempt_count}/10 attempts`}
                      </span>
                    </div>

                    {/* Active Cooling Alert */}
                    {selectedCandidate.is_cooling && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5 text-xs text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="mr-1">Active DT Cooling Period</strong> Candidate is cooling down until{' '}
                          {selectedCandidate.cooling_ends_at ? formatDate(selectedCandidate.cooling_ends_at) : 'cooldown expires'}.
                        </div>
                      </div>
                    )}

                    {candidateDtAttempts.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-lg border border-slate-200">
                        No Diagnostic Test attempts recorded yet.
                      </p>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3">Attempt</th>
                              <th className="py-2.5 px-3">Score</th>
                              <th className="py-2.5 px-3">Correct / Total</th>
                              <th className="py-2.5 px-3">Result</th>
                              <th className="py-2.5 px-3">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {candidateDtAttempts.map((att) => (
                              <tr key={att.id} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  #{att.attempt_number}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900">
                                  {att.score_pct != null ? `${att.score_pct}%` : '—'}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {att.correct_answers ?? '—'} / {att.total_questions ?? '—'}
                                </td>
                                <td className="py-2 px-3">
                                  {att.passed ? (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      Passed
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                      Failed
                                    </span>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-slate-400 text-[11px]">
                                  {att.completed_at ? formatDate(att.completed_at) : 'In progress'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* COHORT MEMBERSHIP SECTION */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                      <GraduationCap className="w-4 h-4 text-[#1B3270]" />
                      <span>Cohort Membership</span>
                    </h4>

                    {candidateCohortInfo?.cohorts ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">
                            {candidateCohortInfo.cohorts.name}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            {candidateCohortInfo.cohorts.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1 border-t border-slate-200">
                          <div>Track: <strong className="text-slate-800">{candidateCohortInfo.cohorts.track}</strong></div>
                          <div>
                            Mentor:{' '}
                            <strong className="text-slate-800">
                              {candidateCohortInfo.cohorts.profiles
                                ? `${candidateCohortInfo.cohorts.profiles.first_name || ''} ${candidateCohortInfo.cohorts.profiles.last_name || ''}`.trim()
                                : 'Assigned Mentor'}
                            </strong>
                          </div>
                          <div>Start Date: <strong className="text-slate-800">{candidateCohortInfo.cohorts.start_date ? formatDate(candidateCohortInfo.cohorts.start_date) : 'TBD'}</strong></div>
                          <div>Member Status: <strong className="text-slate-800 capitalize">{candidateCohortInfo.status}</strong></div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-lg border border-slate-200">
                        Candidate is not currently assigned to any active training cohort.
                      </p>
                    )}
                  </div>

                  {/* COOLING PERIODS SECTION */}
                  {candidateCoolingPeriods.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span>Active Cooling Periods</span>
                      </h4>
                      <div className="space-y-1.5">
                        {candidateCoolingPeriods.map((cp) => (
                          <div key={cp.id} className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs flex items-center justify-between text-amber-900">
                            <span className="font-semibold uppercase text-[11px]">{cp.gate_type} Cooling</span>
                            <span>Ends: {formatDate(cp.ends_at)} ({cp.status})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* FINAL TEST HISTORY SECTION */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                        <Award className="w-4 h-4 text-[#1B3270]" />
                        <span>Final Assessment History</span>
                      </h4>
                      {selectedCandidate.consec_fails > 0 && (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          selectedCandidate.consec_fails >= 2 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'text-slate-500'
                        }`}>
                          {selectedCandidate.consec_fails} consecutive fail{selectedCandidate.consec_fails > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {candidateFinalAssessments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50 p-4 rounded-lg border border-slate-200">
                        No Final Assessment attempts recorded yet.
                      </p>
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs text-slate-600">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                            <tr>
                              <th className="py-2.5 px-3">Attempt</th>
                              <th className="py-2.5 px-3">Score</th>
                              <th className="py-2.5 px-3">Outcome</th>
                              <th className="py-2.5 px-3">Review Status</th>
                              <th className="py-2.5 px-3">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {candidateFinalAssessments.map((t) => (
                              <tr key={t.id} className="hover:bg-slate-50/50">
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  #{t.attempt_number}
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900">
                                  {t.score_pct != null ? `${t.score_pct}%` : `${t.score ?? '—'}`}
                                </td>
                                <td className="py-2 px-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      t.outcome === 'pass'
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}
                                  >
                                    {t.outcome || 'Evaluated'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-600 capitalize">
                                  {t.review_status?.replace(/_/g, ' ') || 'Submitted'}
                                </td>
                                <td className="py-2 px-3 text-slate-400 text-[11px]">
                                  {formatDate(t.created_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadCandidatePipelineTab;
