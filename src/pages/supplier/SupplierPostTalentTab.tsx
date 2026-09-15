import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  UserPlus,
  ListOrdered,
  Copy,
  Check,
  Bell,
  Clock,
  Users,
  FileSpreadsheet,
  ChevronDown,
  Edit3,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  Send,
} from 'lucide-react';
import { getGateLabel } from '../../utils/labels';
import { BulkCandidateUpload } from './BulkCandidateUpload';
import { notifyByRole } from '../../utils/notificationRouting';
import { CandidateProfileDetailView } from '../internal/components/CandidateProfileDetailView';
import { MultiSelectFilter } from '../../components/ui/MultiSelectFilter';

interface SupplierPostTalentTabProps {
  supplier: any;
}

export const SupplierPostTalentTab: React.FC<SupplierPostTalentTabProps> = ({
  supplier,
}) => {
  const [subTab, setSubTab] = useState<'add' | 'bulk' | 'tracking'>('tracking');

  // Add Candidate Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roleInterest, setRoleInterest] = useState('nursing');
  const [languageLevel, setLanguageLevel] = useState('B1');
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // In-Flow Tracking State
  const [inFlowCandidates, setInFlowCandidates] = useState<any[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [nudgeFeedback, setNudgeFeedback] = useState<string | null>(null);
  const [stageFilters, setStageFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);

  const stageOptions = useMemo(() => [
    { value: 'not_started', label: 'Not Started' },
    { value: 'dt', label: 'Diagnostic Test' },
    { value: 'doc_verification', label: 'Document Verification' },
    { value: 'speaking_test', label: 'Speaking Test' },
    { value: 'bootcamp', label: 'Interview Bootcamp' },
    { value: 'assessment', label: 'Final Assessment' },
  ], []);

  const statusOptions = useMemo(() => [
    { value: 'pending', label: 'Pending' },
    { value: 'pass', label: 'Pass' },
    { value: 'fail', label: 'Fail' },
  ], []);

  const filteredInFlowCandidates = useMemo(() => {
    return inFlowCandidates.filter((cand) => {
      if (stageFilters.length > 0) {
        const stage = cand.latestGate?.gate_type || 'not_started';
        if (!stageFilters.includes(stage)) return false;
      }
      if (statusFilters.length > 0) {
        const status = (cand.latestGate?.status || 'pending').toLowerCase();
        if (!statusFilters.includes(status)) return false;
      }
      return true;
    });
  }, [inFlowCandidates, stageFilters, statusFilters]);

  // Dropdown Action State
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectedCandidateForDetail, setSelectedCandidateForDetail] = useState<any | null>(null);

  // Edit Candidate Modal
  const [editCandidate, setEditCandidate] = useState<any | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState('nursing');
  const [editLanguageLevel, setEditLanguageLevel] = useState('B1');
  const [savingEdit, setSavingEdit] = useState(false);

  // Escalate Modal
  const [escalateCandidate, setEscalateCandidate] = useState<any | null>(null);
  const [escalateReason, setEscalateReason] = useState('unresponsive');
  const [escalatePriority, setEscalatePriority] = useState<'normal' | 'high' | 'urgent'>('high');
  const [escalateNotes, setEscalateNotes] = useState('');
  const [submittingEscalate, setSubmittingEscalate] = useState(false);

  // Delete Confirmation Modal
  const [deleteCandidateTarget, setDeleteCandidateTarget] = useState<any | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState(false);

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setFormError('Enter candidate first and last name.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);
      setGeneratedInviteUrl(null);

      // 1. Generate random UUID for invite_token
      const inviteToken = crypto.randomUUID();

      // 2. Insert into candidates
      const { error: insertErr } = await supabase.from('candidates').insert({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase() || null,
        phone: phone.trim() || null,
        supplier_id: supplier.id,
        status: 'onboarding',
        invite_token: inviteToken,
        target_role: roleInterest,
        language_level_self_reported: languageLevel,
      });

      if (insertErr) {
        throw insertErr;
      }

      // 3. Success message with invite link
      const inviteUrl = `${window.location.origin}/invite/${inviteToken}`;
      setGeneratedInviteUrl(inviteUrl);

      // 4. Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setRoleInterest('nursing');
      setLanguageLevel('B1');
      setSource('');
      setNotes('');
      fetchInFlowCandidates();
    } catch (err: any) {
      console.error('Error adding candidate:', err);
      setFormError(err.message || 'Failed to add candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteLink = () => {
    if (!generatedInviteUrl) return;
    navigator.clipboard.writeText(generatedInviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Fetch In-Flow Candidates
  const fetchInFlowCandidates = async () => {
    if (!supplier?.id) return;
    try {
      setTrackingLoading(true);

      // Pull candidates where supplier_id = current supplier AND status NOT IN ('interview_ready', 'placed')
      const { data: cands, error: candsErr } = await supabase
        .from('candidates')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          email,
          phone,
          target_role,
          language_level_self_reported,
          created_at,
          status,
          invite_token,
          profiles:user_id (
            email,
            phone
          )
        `)
        .eq('supplier_id', supplier.id)
        .not('status', 'in', '("interview_ready","placed")')
        .order('created_at', { ascending: false });

      if (candsErr) {
        console.error('Error fetching in-flow candidates:', candsErr);
        setInFlowCandidates([]);
        return;
      }

      const candList = cands || [];

      // Fetch gate results for these candidates to derive current stage
      if (candList.length > 0) {
        const candIds = candList.map((c) => c.id);
        const { data: gates } = await supabase
          .from('gate_results')
          .select('*')
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        // Map candidate to latest gate result
        const latestGateMap: Record<string, any> = {};
        (gates || []).forEach((g) => {
          if (!latestGateMap[g.candidate_id]) {
            latestGateMap[g.candidate_id] = g;
          }
        });

        const merged = candList.map((c: any) => ({
          ...c,
          email: c.email || c.profiles?.email || null,
          phone: c.phone || c.profiles?.phone || null,
          latestGate: latestGateMap[c.id] || null,
        }));

        setInFlowCandidates(merged);
      } else {
        setInFlowCandidates([]);
      }
    } catch (err) {
      console.error('Error in fetchInFlowCandidates:', err);
    } finally {
      setTrackingLoading(false);
    }
  };

  useEffect(() => {
    if (supplier?.id) {
      fetchInFlowCandidates();
    }
  }, [supplier?.id, subTab]);

  // Nudge / Send Reminder
  const handleNudge = async (cand: any) => {
    if (!cand.user_id) {
      if (cand.invite_token) {
        navigator.clipboard.writeText(`${window.location.origin}/invite/${cand.invite_token}`);
        setNudgeFeedback(`Candidate has not registered yet. Invite link copied to clipboard!`);
        setTimeout(() => setNudgeFeedback(null), 3500);
      } else {
        setNudgeFeedback(`Candidate registration pending.`);
        setTimeout(() => setNudgeFeedback(null), 3000);
      }
      return;
    }

    try {
      setNudgingId(cand.id);
      const { error } = await supabase.from('notifications').insert({
        user_id: cand.user_id,
        title: 'Action needed',
        message: 'Your supplier has sent a reminder to continue your qualification milestones.',
        type: 'general',
      });

      if (error) throw error;

      setNudgeFeedback(`Reminder notification sent to ${cand.first_name || 'candidate'}.`);
      setTimeout(() => setNudgeFeedback(null), 3500);
    } catch (err: any) {
      console.error('Nudge error:', err);
      setNudgeFeedback(`Failed to send reminder: ${err.message}`);
      setTimeout(() => setNudgeFeedback(null), 3500);
    } finally {
      setNudgingId(null);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (cand: any) => {
    setEditCandidate(cand);
    setEditFirstName(cand.first_name || '');
    setEditLastName(cand.last_name || '');
    setEditEmail(cand.email || '');
    setEditPhone(cand.phone || '');
    setEditRole(cand.target_role || 'nursing');
    setEditLanguageLevel(cand.language_level_self_reported || 'B1');
  };

  // Save Edit
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
          email: editEmail.trim().toLowerCase() || null,
          phone: editPhone.trim() || null,
          target_role: editRole,
          language_level_self_reported: editLanguageLevel,
        })
        .eq('id', editCandidate.id);

      if (error) throw error;

      setNudgeFeedback(`Candidate ${editFirstName} ${editLastName} updated successfully.`);
      setTimeout(() => setNudgeFeedback(null), 3500);
      setEditCandidate(null);
      fetchInFlowCandidates();
    } catch (err: any) {
      console.error('Error updating candidate:', err);
      alert(`Failed to update candidate: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Escalate Modal
  const handleOpenEscalate = (cand: any) => {
    setEscalateCandidate(cand);
    setEscalateReason('unresponsive');
    setEscalatePriority('high');
    setEscalateNotes('');
  };

  // Confirm Escalate to Lead / RM
  const handleConfirmEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateCandidate) return;

    try {
      setSubmittingEscalate(true);

      const candidateName = `${escalateCandidate.first_name} ${escalateCandidate.last_name}`.trim();
      const reasonLabels: Record<string, string> = {
        unresponsive: 'Candidate Unresponsive to Milestone Reminders',
        doc_stalled: 'Document Verification Stalled',
        speaking_request: 'Urgent Speaking Test Scheduling Required',
        visa_query: 'Visa / Relocation Blockers',
        other: 'General Stage Inquiry',
      };
      const reasonText = reasonLabels[escalateReason] || escalateReason;

      // 1. Check if an RM is assigned to this supplier
      const { data: rmAssignment } = await supabase
        .from('rm_assignments')
        .select('rm_profile_id')
        .eq('entity_type', 'supplier')
        .eq('entity_id', supplier.id)
        .eq('active', true)
        .maybeSingle();

      const notifMessage = `Supplier ${supplier?.company_name || 'Partner'} escalated candidate ${candidateName}.\n\nReason: ${reasonText}\nPriority: ${escalatePriority.toUpperCase()}${escalateNotes.trim() ? `\n\nNotes from Supplier: ${escalateNotes.trim()}` : ''}`;

      // 2. Notify assigned RM if exists
      if (rmAssignment?.rm_profile_id) {
        await supabase.from('notifications').insert({
          user_id: rmAssignment.rm_profile_id,
          title: `Supplier Escalation: ${candidateName}`,
          message: notifMessage,
          type: 'general',
          read: false,
        });
      }

      // 3. Notify Placement Leads
      await notifyByRole(
        supabase,
        'placement_lead',
        `Supplier Escalation: ${candidateName}`,
        notifMessage,
        'general'
      );

      setNudgeFeedback(`Escalation submitted for ${candidateName}. Account Manager and Placement Leads notified.`);
      setTimeout(() => setNudgeFeedback(null), 4000);
      setEscalateCandidate(null);
    } catch (err: any) {
      console.error('Error escalating candidate:', err);
      alert(`Failed to submit escalation: ${err.message}`);
    } finally {
      setSubmittingEscalate(false);
    }
  };

  // Confirm Delete Candidate
  const handleConfirmDelete = async () => {
    if (!deleteCandidateTarget) return;

    try {
      setDeletingCandidate(true);

      // Call secure delete_candidate RPC
      const { error } = await supabase.rpc('delete_candidate', {
        target_candidate_id: deleteCandidateTarget.id,
      });

      if (error) throw error;

      const candName = `${deleteCandidateTarget.first_name} ${deleteCandidateTarget.last_name}`.trim();
      setNudgeFeedback(`Candidate ${candName} has been permanently deleted.`);
      setTimeout(() => setNudgeFeedback(null), 3500);

      // Update state locally
      setInFlowCandidates((prev) => prev.filter((c) => c.id !== deleteCandidateTarget.id));
      setDeleteCandidateTarget(null);
    } catch (err: any) {
      console.error('Error deleting candidate:', err);
      alert(`Failed to delete candidate: ${err.message}`);
    } finally {
      setDeletingCandidate(false);
    }
  };

  const calculateDaysInStage = (cand: any) => {
    const d = cand.latestGate?.created_at || cand.created_at;
    if (!d) return 0;
    const diff = Date.now() - new Date(d).getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  };

  const formatStageName = (gateType?: string) => {
    if (!gateType) return 'Not Started';
    return getGateLabel(gateType);
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs header */}
      <div className="flex border-b border-[#E2E8F4]">
        <button
          type="button"
          onClick={() => setSubTab('tracking')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-colors cursor-pointer ${
            subTab === 'tracking'
              ? 'border-[#1B3270] text-[#1B3270]'
              : 'border-transparent text-[#94A3B8] hover:text-[#4A5568]'
          }`}
        >
          <ListOrdered size={14} />
          <span>In-Flow Candidates</span>
          {inFlowCandidates.length > 0 && (
            <span
              className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                subTab === 'tracking'
                  ? 'bg-[#1B3270]/10 text-[#1B3270]'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {inFlowCandidates.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSubTab('add')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-colors cursor-pointer ${
            subTab === 'add'
              ? 'border-[#1B3270] text-[#1B3270]'
              : 'border-transparent text-[#94A3B8] hover:text-[#4A5568]'
          }`}
        >
          <UserPlus size={14} />
          <span>Add Candidate</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('bulk')}
          className={`pb-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-colors cursor-pointer ${
            subTab === 'bulk'
              ? 'border-[#1B3270] text-[#1B3270]'
              : 'border-transparent text-[#94A3B8] hover:text-[#4A5568]'
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>Bulk Upload</span>
        </button>
      </div>

      {/* SUB-TAB 1: ADD SINGLE CANDIDATE */}
      {subTab === 'add' && (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
          <div className="mb-6">
            <h3 className="text-base font-bold text-[#1B3270]">Add New Candidate</h3>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              Register an individual candidate to your talent pipeline and generate their unique onboarding link.
            </p>
          </div>

          {generatedInviteUrl && (
            <div className="mb-6 p-4 bg-[#10B981]/10 border border-[#10B981]/25 rounded-[8px] space-y-2">
              <div className="flex items-center space-x-2 text-[#10B981] font-semibold text-xs">
                <Check size={14} />
                <span>Candidate profile created successfully!</span>
              </div>
              <p className="text-xs text-[#4A5568]">
                Share this dedicated onboarding link with the candidate so they can register and begin their Diagnostic Test:
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={generatedInviteUrl}
                  className="w-full bg-white border border-[#E2E8F4] rounded-[6px] px-3 py-1.5 text-xs text-[#1B3270] font-mono outline-none"
                />
                <button
                  type="button"
                  onClick={copyInviteLink}
                  className="px-3 py-1.5 bg-[#1B3270] text-white text-xs font-medium rounded-[6px] hover:bg-[#2952A3] transition-colors flex items-center space-x-1 whitespace-nowrap cursor-pointer"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {formError && (
            <div className="mb-6 p-3 bg-[#EF4444]/10 border border-[#EF4444]/25 rounded-[6px] text-xs text-[#EF4444]">
              {formError}
            </div>
          )}

          <form onSubmit={handleAddCandidate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Maria"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Santos"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="maria.santos@example.com"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+63 912 345 6789"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  Role Interest
                </label>
                <select
                  value={roleInterest}
                  onChange={(e) => setRoleInterest(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270] bg-white text-slate-700"
                >
                  <option value="nursing">Registered Nurse (General)</option>
                  <option value="icu">ICU / Critical Care Nurse</option>
                  <option value="pediatric">Pediatric Care</option>
                  <option value="geriatric">Geriatric / Elderly Care</option>
                  <option value="surgical">Operating Room / Surgical</option>
                  <option value="physiotherapy">Physiotherapist</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  Self-Reported German Level
                </label>
                <select
                  value={languageLevel}
                  onChange={(e) => setLanguageLevel(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270] bg-white text-slate-700"
                >
                  <option value="A1">A1 — Complete Beginner</option>
                  <option value="A2">A2 — Elementary</option>
                  <option value="B1">B1 — Intermediate</option>
                  <option value="B2">B2 — Professional Working</option>
                  <option value="C1">C1 — Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  Sourcing Channel / Region
                </label>
                <input
                  type="text"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. Manila University batch 2025"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  Internal Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Has 2 years clinical ICU experience"
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors cursor-pointer shadow-2xs"
              >
                {submitting ? 'Registering...' : 'Register Candidate & Generate Invite'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-TAB 2: BULK UPLOAD */}
      {subTab === 'bulk' && (
        <BulkCandidateUpload
          supplier={supplier}
          onCandidateAdded={fetchInFlowCandidates}
        />
      )}

      {/* SUB-TAB 3: QUALIFICATION PROGRESS */}
      {subTab === 'tracking' && (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#1B3270]">
                In-Flow Candidate Tracking
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Monitor qualification progress across Diagnostic Test, Verification, and Academy.
              </p>
            </div>
          </div>

          {nudgeFeedback && (
            <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/25 rounded-[6px] text-xs text-[#10B981] flex items-center space-x-2">
              <Check size={14} />
              <span>{nudgeFeedback}</span>
            </div>
          )}

          {/* Filters Bar */}
          <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3 flex flex-wrap items-center gap-3">
            <div className="w-full sm:w-56">
              <MultiSelectFilter
                label="Stage"
                options={stageOptions}
                selectedValues={stageFilters}
                onChange={setStageFilters}
              />
            </div>
            <div className="w-full sm:w-48">
              <MultiSelectFilter
                label="Status"
                options={statusOptions}
                selectedValues={statusFilters}
                onChange={setStatusFilters}
              />
            </div>
            <span className="text-xs text-slate-400 ml-auto font-medium">
              Showing {filteredInFlowCandidates.length} of {inFlowCandidates.length} candidate{inFlowCandidates.length === 1 ? '' : 's'}
            </span>
          </div>

          {trackingLoading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
            </div>
          ) : inFlowCandidates.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Users size={28} className="mx-auto text-[#94A3B8]" />
              <p className="text-xs text-[#4A5568]">
                No candidates currently in-flow. Add candidates using the Add Candidate form.
              </p>
            </div>
          ) : filteredInFlowCandidates.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Users size={28} className="mx-auto text-[#94A3B8]" />
              <p className="text-xs text-[#4A5568]">
                No candidates match the selected filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto min-h-[220px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E2E8F4] text-[#94A3B8] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">Name</th>
                    <th className="py-3 px-3">Current Stage</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Days in Stage</th>
                    <th className="py-3 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4]">
                  {filteredInFlowCandidates.map((cand) => {
                    const days = calculateDaysInStage(cand);
                    const stageLabel = formatStageName(cand.latestGate?.gate_type);
                    const statusLabel = cand.latestGate?.status || 'Pending';
                    const isDropdownOpen = openDropdownId === cand.id;

                    return (
                      <tr key={cand.id} className="hover:bg-[#F8FAFD] transition-colors">
                        <td className="py-3 px-3 font-semibold text-[#1B3270]">
                          <button
                            type="button"
                            onClick={() => setSelectedCandidateForDetail(cand)}
                            className="font-semibold text-[#1B3270] hover:text-[#2952A3] hover:underline text-left cursor-pointer"
                          >
                            {cand.first_name} {cand.last_name}
                          </button>
                          {cand.email && (
                            <div className="text-[11px] text-[#94A3B8] font-normal">
                              {cand.email}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#4A5568]">{stageLabel}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                              statusLabel === 'pass'
                                ? 'bg-[#10B981]/15 text-[#10B981]'
                                : statusLabel === 'fail'
                                ? 'bg-[#EF4444]/15 text-[#EF4444]'
                                : 'bg-gray-100 text-[#4A5568]'
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[#4A5568]">
                          <span className="flex items-center">
                            <Clock size={12} className="mr-1 text-[#94A3B8]" />
                            {days} day{days === 1 ? '' : 's'}
                          </span>
                        </td>

                        {/* ACTIONS DROPDOWN */}
                        <td className="py-3 px-3 text-right">
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={() => setOpenDropdownId(isDropdownOpen ? null : cand.id)}
                              className="py-1 px-3 bg-white hover:bg-slate-50 text-[#1B3270] border border-[#E2E8F4] text-[11px] font-semibold rounded-[6px] transition-colors inline-flex items-center space-x-1 shadow-2xs cursor-pointer"
                            >
                              <span>Actions</span>
                              <ChevronDown
                                size={12}
                                className={`transition-transform duration-150 ${
                                  isDropdownOpen ? 'rotate-180' : ''
                                }`}
                              />
                            </button>

                            {isDropdownOpen && (
                              <>
                                {/* Click-outside overlay */}
                                <div
                                  className="fixed inset-0 z-20"
                                  onClick={() => setOpenDropdownId(null)}
                                />

                                <div className="absolute right-0 mt-1 w-48 bg-white border border-[#E2E8F4] rounded-[8px] shadow-lg py-1 z-30 divide-y divide-[#E2E8F4] text-xs text-left animate-in fade-in zoom-in-95 duration-100">
                                  <div className="py-1">
                                    {/* View Full Profile */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        setSelectedCandidateForDetail(cand);
                                      }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-[#1B3270] font-medium cursor-pointer transition-colors"
                                    >
                                      <Users size={13} className="text-[#1B3270]" />
                                      <span>View Full Profile</span>
                                    </button>

                                    {/* Send Reminder */}
                                    <button
                                      type="button"
                                      disabled={nudgingId === cand.id}
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        handleNudge(cand);
                                      }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-[#1B3270] font-medium cursor-pointer transition-colors"
                                    >
                                      <Bell size={13} className="text-[#1B3270]" />
                                      <span>
                                        {nudgingId === cand.id
                                          ? 'Sending...'
                                          : cand.user_id
                                          ? 'Send Reminder'
                                          : 'Copy Invite Link'}
                                      </span>
                                    </button>

                                    {/* Edit Details */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        handleOpenEdit(cand);
                                      }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer transition-colors"
                                    >
                                      <Edit3 size={13} className="text-amber-600" />
                                      <span>Edit Details</span>
                                    </button>

                                    {/* Escalate to Lead / RM */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        handleOpenEscalate(cand);
                                      }}
                                      className="w-full px-3 py-1.5 hover:bg-slate-50 flex items-center space-x-2 text-slate-700 font-medium cursor-pointer transition-colors"
                                    >
                                      <AlertTriangle size={13} className="text-indigo-600" />
                                      <span>Escalate to Lead / RM</span>
                                    </button>
                                  </div>

                                  <div className="py-1">
                                    {/* Delete Candidate */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenDropdownId(null);
                                        setDeleteCandidateTarget(cand);
                                      }}
                                      className="w-full px-3 py-1.5 hover:bg-rose-50 flex items-center space-x-2 text-rose-600 font-semibold cursor-pointer transition-colors"
                                    >
                                      <Trash2 size={13} />
                                      <span>Delete Candidate</span>
                                    </button>
                                  </div>
                                </div>
                              </>
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
      )}

      {/* ==================================================== */}
      {/* EDIT CANDIDATE DETAILS MODAL */}
      {/* ==================================================== */}
      {editCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-lg w-full shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F4]">
              <div>
                <h3 className="text-base font-bold text-[#1B3270]">Edit Candidate Details</h3>
                <p className="text-xs text-slate-500">
                  Update candidate contact and qualification profile.
                </p>
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
                  <label className="block text-xs font-semibold text-[#1B3270] mb-1">
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
                  <label className="block text-xs font-semibold text-[#1B3270] mb-1">
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
                  <label className="block text-xs font-semibold text-[#1B3270] mb-1">
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
                  <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                    Target Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270] bg-white text-slate-700"
                  >
                    <option value="nursing">Registered Nurse (General)</option>
                    <option value="icu">ICU / Critical Care Nurse</option>
                    <option value="pediatric">Pediatric Care</option>
                    <option value="geriatric">Geriatric / Elderly Care</option>
                    <option value="surgical">Operating Room / Surgical</option>
                    <option value="physiotherapy">Physiotherapist</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1B3270] mb-1">
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

      {/* ==================================================== */}
      {/* ESCALATE CANDIDATE MODAL */}
      {/* ==================================================== */}
      {escalateCandidate && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-lg w-full shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F4]">
              <div>
                <h3 className="text-base font-bold text-[#1B3270]">
                  Escalate to Account Manager & Lead
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
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  Reason for Escalation *
                </label>
                <select
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270] bg-white text-slate-700"
                >
                  <option value="unresponsive">Candidate Unresponsive to Milestone Reminders</option>
                  <option value="doc_stalled">Document Verification Stalled</option>
                  <option value="speaking_request">Urgent Speaking Test Scheduling Required</option>
                  <option value="visa_query">Visa / Relocation Blockers</option>
                  <option value="other">General Stage Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  Urgency Level
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
                <label className="block text-xs font-semibold text-[#1B3270] mb-1">
                  Context / Notes for TerraTern Team
                </label>
                <textarea
                  rows={3}
                  value={escalateNotes}
                  onChange={(e) => setEscalateNotes(e.target.value)}
                  placeholder="Provide context regarding this candidate so our team can follow up effectively..."
                  className="w-full p-2.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270]"
                />
              </div>

              <div className="p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-[11px] text-slate-600">
                This will dispatch a high-priority alert to your assigned Account Manager and the TerraTern Placement Lead team.
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
                  <span>Submit Escalation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ==================================================== */}
      {deleteCandidateTarget && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-md w-full shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600 mb-3">
              <div className="p-2 bg-rose-50 rounded-full">
                <Trash2 size={20} />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Candidate</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete{' '}
              <strong className="text-slate-900">
                {deleteCandidateTarget.first_name} {deleteCandidateTarget.last_name}
              </strong>
              ? This will permanently remove the candidate and all their qualification records from the pipeline.
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

      {/* Candidate Profile Detail Modal */}
      {selectedCandidateForDetail && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-[#1B3270]/10 text-[#1B3270] flex items-center justify-center font-bold text-xs">
                  {selectedCandidateForDetail.first_name?.[0] || 'C'}
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#1B3270]">
                    {selectedCandidateForDetail.first_name} {selectedCandidateForDetail.last_name}
                  </h3>
                  <span className="text-[11px] text-[#94A3B8]">
                    {selectedCandidateForDetail.target_role || 'Healthcare Candidate'} • {selectedCandidateForDetail.email || 'No email registered'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidateForDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-[6px] hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <CandidateProfileDetailView candidateId={selectedCandidateForDetail.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
