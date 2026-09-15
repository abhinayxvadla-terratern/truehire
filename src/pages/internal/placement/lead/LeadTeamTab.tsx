import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Users,
  UserPlus,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ArrowRight,
  ChevronDown,
  Building2,
  X,
  AlertTriangle,
} from 'lucide-react';

interface AssignedSupplierItem {
  assignmentId: string;
  supplierId: string;
  companyName: string;
  companyType: string;
  countryOfOperation: string;
  healthcareRolesFocus: string[];
  assignedAt: string;
  candidatesCount: number;
}

interface TeamMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  internal_role: string;
  is_internal: boolean;
  created_at: string;
  assignedAccountsCount: number;
  assignedSuppliers: AssignedSupplierItem[];
}

export const LeadTeamTab: React.FC = () => {
  const { user } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded RMs set
  const [expandedRmIds, setExpandedRmIds] = useState<Set<string>>(new Set());

  // Reassign Modal State
  const [reassignModalData, setReassignModalData] = useState<{
    supplier: AssignedSupplierItem;
    currentRm: TeamMember;
  } | null>(null);
  const [selectedNewRmId, setSelectedNewRmId] = useState<string>('');
  const [reassignNotes, setReassignNotes] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);

  // Invite Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'candidate_supplier_rm' | 'employer_requirements_rm'>(
    'candidate_supplier_rm'
  );
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Generated Link State
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleExpandRm = (rmId: string) => {
    setExpandedRmIds((prev) => {
      const next = new Set(prev);
      if (next.has(rmId)) {
        next.delete(rmId);
      } else {
        next.add(rmId);
      }
      return next;
    });
  };

  const fetchTeamMembers = async () => {
    try {
      setLoading(true);

      // 1. Fetch team profiles
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .in('internal_role', ['candidate_supplier_rm', 'employer_requirements_rm'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      const memberList = profiles || [];

      // 2. Fetch active RM assignments with suppliers
      const { data: assignments, error: assErr } = await supabase
        .from('rm_assignments')
        .select(`
          id,
          rm_profile_id,
          entity_type,
          entity_id,
          created_at,
          suppliers:entity_id (
            id,
            company_name,
            company_type,
            country_of_operation,
            healthcare_roles_focus
          )
        `)
        .eq('active', true);

      if (assErr) console.error('Error fetching rm_assignments:', assErr);

      // 3. Fetch candidate counts per supplier
      const { data: candsData } = await supabase
        .from('candidates')
        .select('id, supplier_id');

      const candCountsBySupplier: Record<string, number> = {};
      (candsData || []).forEach((c) => {
        if (c.supplier_id) {
          candCountsBySupplier[c.supplier_id] = (candCountsBySupplier[c.supplier_id] || 0) + 1;
        }
      });

      // 4. Map assignments per RM
      const supplierAssignmentsByRm: Record<string, AssignedSupplierItem[]> = {};
      const totalAccountsCountByRm: Record<string, number> = {};

      (assignments || []).forEach((a: any) => {
        totalAccountsCountByRm[a.rm_profile_id] =
          (totalAccountsCountByRm[a.rm_profile_id] || 0) + 1;

        if (a.entity_type === 'supplier' && a.suppliers) {
          const s = a.suppliers;
          if (!supplierAssignmentsByRm[a.rm_profile_id]) {
            supplierAssignmentsByRm[a.rm_profile_id] = [];
          }
          supplierAssignmentsByRm[a.rm_profile_id].push({
            assignmentId: a.id,
            supplierId: s.id,
            companyName: s.company_name || 'Unnamed Supplier',
            companyType: s.company_type || 'placement_agency',
            countryOfOperation: s.country_of_operation || 'International',
            healthcareRolesFocus: s.healthcare_roles_focus || [],
            assignedAt: a.created_at,
            candidatesCount: candCountsBySupplier[s.id] || 0,
          });
        }
      });

      const formatted: TeamMember[] = memberList.map((m) => ({
        id: m.id,
        first_name: m.first_name || '',
        last_name: m.last_name || '',
        email: m.email,
        internal_role: m.internal_role || 'candidate_supplier_rm',
        is_internal: m.is_internal,
        created_at: m.created_at,
        assignedAccountsCount: totalAccountsCountByRm[m.id] || 0,
        assignedSuppliers: supplierAssignmentsByRm[m.id] || [],
      }));

      setTeamMembers(formatted);
    } catch (err) {
      console.error('Error fetching placement team members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setGeneratedInviteLink(null);

    if (!user) return;

    try {
      setCreating(true);

      // 1. Check if email exists in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        setFormError('A user profile with this email address already exists.');
        setCreating(false);
        return;
      }

      // 2. Check if active pending invite exists
      const { data: existingInvite } = await supabase
        .from('pending_invites')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingInvite) {
        setFormError('An active pending invitation already exists for this email address.');
        setCreating(false);
        return;
      }

      // 3. Generate token & expiration
      const token =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // 4. Insert into pending_invites
      const { error: insertErr } = await supabase.from('pending_invites').insert({
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: 'team_member',
        internal_role: role,
        token: token,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
      });

      if (insertErr) throw insertErr;

      const link = `${window.location.origin}/accept-invite?token=${token}`;
      setGeneratedInviteLink(link);

      // Reset form fields
      setFirstName('');
      setLastName('');
      setEmail('');
      showToast('Invitation link generated successfully.');
      fetchTeamMembers();
    } catch (err: any) {
      console.error('Error generating invite link:', err);
      setFormError(err.message || 'Failed to generate invitation link.');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedInviteLink) return;
    navigator.clipboard.writeText(generatedInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Reassignment Logic
  const handleOpenReassign = (supplier: AssignedSupplierItem, currentRm: TeamMember) => {
    setReassignModalData({ supplier, currentRm });
    // Find candidate RMs excluding current RM
    const candidateRms = teamMembers.filter(
      (m) => m.internal_role === 'candidate_supplier_rm' && m.id !== currentRm.id
    );
    setSelectedNewRmId(candidateRms[0]?.id || '');
    setReassignNotes('');
  };

  const handleConfirmReassign = async () => {
    if (!reassignModalData || !selectedNewRmId || !user) return;

    const { supplier, currentRm } = reassignModalData;
    const newRm = teamMembers.find((m) => m.id === selectedNewRmId);
    if (!newRm) return;

    try {
      setReassigning(true);

      // 1. UPDATE old rm_assignment: active = false
      const { error: deactivateErr } = await supabase
        .from('rm_assignments')
        .update({ active: false })
        .eq('id', supplier.assignmentId);

      if (deactivateErr) throw deactivateErr;

      // 2. INSERT new rm_assignment: active = true
      const { error: insertErr } = await supabase.from('rm_assignments').insert({
        rm_profile_id: selectedNewRmId,
        entity_type: 'supplier',
        entity_id: supplier.supplierId,
        assigned_by: user.id,
        active: true,
        notes: reassignNotes.trim() || null,
      });

      if (insertErr) throw insertErr;

      const newRmName = `${newRm.first_name} ${newRm.last_name}`.trim() || newRm.email;
      const oldRmName = `${currentRm.first_name} ${currentRm.last_name}`.trim() || currentRm.email;

      // 3. Notify old RM
      await supabase.from('notifications').insert({
        user_id: currentRm.id,
        title: 'Supplier Reassigned',
        message: `Supplier ${supplier.companyName} has been reassigned to ${newRmName}.`,
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      // 4. Notify new RM
      await supabase.from('notifications').insert({
        user_id: selectedNewRmId,
        title: 'New Supplier Assigned',
        message: `You have been assigned as account manager for ${supplier.companyName} (${supplier.companyType}, ${supplier.countryOfOperation}), reassigned from ${oldRmName}. Introduce yourself and support their onboarding.${reassignNotes.trim() ? '\n\nNotes: ' + reassignNotes.trim() : ''}`,
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      // 5. Notify supplier team members
      const { data: teamMembersData } = await supabase
        .from('supplier_team_members')
        .select('profile_id')
        .eq('supplier_id', supplier.supplierId)
        .eq('invite_status', 'accepted');

      const { data: supplierRecord } = await supabase
        .from('suppliers')
        .select('user_id')
        .eq('id', supplier.supplierId)
        .maybeSingle();

      const recipientProfileIds = new Set<string>();
      (teamMembersData || []).forEach((tm) => {
        if (tm.profile_id) recipientProfileIds.add(tm.profile_id);
      });
      if (supplierRecord?.user_id) {
        recipientProfileIds.add(supplierRecord.user_id);
      }

      if (recipientProfileIds.size > 0) {
        const notifications = Array.from(recipientProfileIds).map((pId) => ({
          user_id: pId,
          title: 'Your Account Manager Has Been Updated',
          message: `Your TerraTern account manager is now ${newRmName}. They will be in touch to support your onboarding and candidate pipeline. You can see their contact details in your Company Profile.`,
          type: 'general',
          read: false,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifications);
      }

      showToast(`${supplier.companyName} reassigned to ${newRmName}.`);
      setReassignModalData(null);
      setSelectedNewRmId('');
      setReassignNotes('');
      fetchTeamMembers();
    } catch (err: any) {
      console.error('Error reassigning supplier:', err);
      showToast(err.message || 'Failed to reassign supplier.', 'error');
    } finally {
      setReassigning(false);
    }
  };

  // Candidate/Supplier RMs available for reassignment
  const candidateRmOptions = teamMembers.filter(
    (m) =>
      m.internal_role === 'candidate_supplier_rm' &&
      (!reassignModalData || m.id !== reassignModalData.currentRm.id)
  );

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2 ${
            toastMessage.type === 'error' ? 'bg-rose-600' : 'bg-[#1B3270]'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-white" />
          ) : (
            <Check className="w-4 h-4 text-emerald-400" />
          )}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Placement Relationship Management Team
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Provision corporate accounts for Candidate and Employer Relationship Managers, audit workloads, and manage supplier account allocations.
        </p>
      </div>

      {/* INVITE FORM CARD */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs">
        <div className="flex items-center space-x-2.5 mb-4">
          <div className="p-2 rounded-[6px] bg-[#1B3270]/10 text-[#1B3270]">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Invite Relationship Manager
            </h2>
            <p className="text-xs text-slate-500">
              Send a secure one-time onboarding link to onboard internal placement staff.
            </p>
          </div>
        </div>

        {formError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-[6px] text-xs text-rose-700 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleGenerateInvite} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* First Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                First Name *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Liam"
                className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              />
            </div>

            {/* Last Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Last Name *
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Miller"
                className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Corporate Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="liam.miller@terratern.de"
                className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              />
            </div>

            {/* Internal Role */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Internal Specialisation *
              </label>
              <select
                value={role}
                onChange={(e: any) => setRole(e.target.value)}
                className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              >
                <option value="candidate_supplier_rm">
                  Candidate / Supplier RM
                </option>
                <option value="employer_requirements_rm">
                  Employer / Requirements RM
                </option>
              </select>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-2xs transition-colors disabled:opacity-50"
            >
              {creating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Invite...</span>
                </>
              ) : (
                <>
                  <span>Send Invite</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Copyable Link Preview */}
        {generatedInviteLink && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-[8px] space-y-2 animate-in fade-in">
            <div className="flex items-center space-x-2 text-xs font-bold text-emerald-800">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Invitation Link Created (Valid for 7 days)</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={generatedInviteLink}
                className="flex-1 text-xs bg-white border border-emerald-300 rounded-[6px] p-2 font-mono text-slate-800 select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* TEAM LIST WITH EXPANDABLE SUPPLIERS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Active Relationship Managers
          </h2>
          <span className="text-xs text-slate-400">
            {teamMembers.length} team members
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-700">
                No Relationship Managers active
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Use the form above to invite team members to the Placement department.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Role Badge</th>
                    <th className="py-3 px-4">Corporate Email</th>
                    <th className="py-3 px-4 text-center">Current Assignments</th>
                    <th className="py-3 px-4">Account Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                  {teamMembers.map((m) => {
                    const isCandidateRm = m.internal_role === 'candidate_supplier_rm';
                    const isExpanded = expandedRmIds.has(m.id);

                    return (
                      <React.Fragment key={m.id}>
                        <tr className="hover:bg-[#F8FAFD] transition-colors">
                          {/* Name */}
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {m.first_name} {m.last_name}
                          </td>

                          {/* Role Badge */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                isCandidateRm
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-sky-100 text-sky-800'
                              }`}
                            >
                              {isCandidateRm
                                ? 'Candidate / Supplier RM'
                                : 'Employer / Requirements RM'}
                            </span>
                          </td>

                          {/* Email */}
                          <td className="py-3.5 px-4 text-slate-600 font-mono">
                            {m.email}
                          </td>

                          {/* Assigned Accounts / Suppliers Toggle */}
                          <td className="py-3.5 px-4 text-center">
                            {isCandidateRm ? (
                              <button
                                type="button"
                                onClick={() => toggleExpandRm(m.id)}
                                className="font-bold text-[#1B3270] px-2.5 py-1 bg-[#1B3270]/10 hover:bg-[#1B3270]/20 rounded text-xs inline-flex items-center space-x-1.5 cursor-pointer transition-colors"
                              >
                                <span>
                                  {m.assignedSuppliers.length} active supplier{m.assignedSuppliers.length === 1 ? '' : 's'}
                                </span>
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                                    isExpanded ? 'rotate-180 text-[#1B3270]' : 'text-slate-500'
                                  }`}
                                />
                              </button>
                            ) : (
                              <span className="font-bold text-slate-900 px-2 py-0.5 bg-slate-100 rounded text-xs">
                                {m.assignedAccountsCount} accounts
                              </span>
                            )}
                          </td>

                          {/* Created */}
                          <td className="py-3.5 px-4 text-slate-500">
                            {new Date(m.created_at).toLocaleDateString()}
                          </td>
                        </tr>

                        {/* EXPANDED SUPPLIERS ACCORDION ROW */}
                        {isExpanded && isCandidateRm && (
                          <tr className="bg-[#F8FAFD] border-b border-[#E2E8F4]">
                            <td colSpan={5} className="p-4 pl-8">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    <Building2 className="w-3.5 h-3.5 text-[#1B3270]" />
                                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                      Active Supplier Assignments for {m.first_name} ({m.assignedSuppliers.length})
                                    </h5>
                                  </div>
                                  <span className="text-[11px] text-slate-400">
                                    Click reassign to transfer a supplier to another RM
                                  </span>
                                </div>

                                {m.assignedSuppliers.length === 0 ? (
                                  <div className="p-4 bg-white border border-[#E2E8F4] rounded-[8px] text-center text-xs text-slate-500">
                                    No suppliers currently assigned to this Relationship Manager.
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {m.assignedSuppliers.map((sup) => (
                                      <div
                                        key={sup.assignmentId}
                                        className="bg-white border border-[#E2E8F4] rounded-[8px] p-3 shadow-2xs flex flex-col justify-between space-y-2.5 hover:border-slate-300 transition-colors"
                                      >
                                        <div>
                                          <div className="flex items-start justify-between gap-1.5 mb-1">
                                            <span className="font-bold text-slate-900 text-xs leading-snug">
                                              {sup.companyName}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#7EB3E8]/20 text-[#1B3270] uppercase flex-shrink-0">
                                              {sup.companyType.replace(/_/g, ' ')}
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-slate-500">
                                            {sup.countryOfOperation} • {sup.candidatesCount} candidate{sup.candidatesCount === 1 ? '' : 's'}
                                          </p>
                                          <p className="text-[10px] text-slate-400 mt-0.5">
                                            Assigned: {new Date(sup.assignedAt).toLocaleDateString()}
                                          </p>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleOpenReassign(sup, m)}
                                          className="w-full py-1.5 px-2 bg-white border border-[#E2E8F4] hover:border-[#1B3270] text-[#1B3270] hover:bg-[#1B3270]/5 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors flex items-center justify-center space-x-1"
                                        >
                                          <span>Reassign Supplier</span>
                                          <ArrowRight className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
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
      </div>

      {/* REASSIGN SUPPLIER MODAL */}
      {reassignModalData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setReassignModalData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Reassign Account Manager for {reassignModalData.supplier.companyName}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Transfer relationship management ownership to another Candidate / Supplier RM.
            </p>

            {/* Supplier summary card */}
            <div className="p-3.5 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] space-y-2 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Current RM:</span>
                <span className="font-bold text-slate-800">
                  {reassignModalData.currentRm.first_name} {reassignModalData.currentRm.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Company Type:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {reassignModalData.supplier.companyType.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Country of Operation:</span>
                <span className="font-semibold text-slate-800">
                  {reassignModalData.supplier.countryOfOperation}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Candidates Added:</span>
                <span className="font-bold text-[#1B3270]">
                  {reassignModalData.supplier.candidatesCount}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select New Account Manager (RM)
                </label>
                {candidateRmOptions.length === 0 ? (
                  <p className="text-xs text-rose-600">
                    No alternative Candidate/Supplier RMs available to reassign.
                  </p>
                ) : (
                  <select
                    value={selectedNewRmId}
                    onChange={(e) => setSelectedNewRmId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-900 font-medium outline-none focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270]"
                  >
                    {candidateRmOptions.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.first_name} {rm.last_name} — {rm.assignedSuppliers.length} active suppliers |{' '}
                        {rm.assignedSuppliers.reduce((sum, s) => sum + s.candidatesCount, 0)} total candidates
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notes for New RM (Optional)
                </label>
                <textarea
                  rows={3}
                  value={reassignNotes}
                  onChange={(e) => setReassignNotes(e.target.value)}
                  placeholder="Context regarding this partner transition..."
                  className="w-full p-2.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] text-slate-800 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReassignModalData(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReassign}
                  disabled={reassigning || !selectedNewRmId}
                  className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  {reassigning && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Reassign & Notify</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadTeamTab;
