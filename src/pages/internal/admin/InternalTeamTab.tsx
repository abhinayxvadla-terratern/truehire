import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth, InternalRole } from '../../../context/AuthContext';
import {
  UserPlus,
  Users,
  Copy,
  Check,
  Clock,
  AlertCircle,
  RotateCw,
  Loader2,
  Trash2,
} from 'lucide-react';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

interface TeamMemberRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  internal_role: InternalRole | null;
  is_internal: boolean;
  created_at: string;
}

interface PendingInviteRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  internal_role: string;
  token: string;
  expires_at: string;
  created_at: string;
  used: boolean;
}

const ALL_ROLES: { value: InternalRole; label: string; category: 'admin' | 'partnerships' | 'placement' | 'academic' }[] = [
  { value: 'super_admin', label: 'Super Admin', category: 'admin' },
  { value: 'partnerships_lead', label: 'Partnerships Lead', category: 'partnerships' },
  { value: 'supplier_partnerships_associate', label: 'Supplier Partnerships Associate', category: 'partnerships' },
  { value: 'employer_partnerships_associate', label: 'Employer Partnerships Associate', category: 'partnerships' },
  { value: 'placement_lead', label: 'Placement Lead', category: 'placement' },
  { value: 'candidate_supplier_rm', label: 'Candidate & Supplier RM', category: 'partnerships' },
  { value: 'employer_requirements_rm', label: 'Employer Requirements RM', category: 'placement' },
  { value: 'academic_lead', label: 'Academic Lead', category: 'academic' },
  { value: 'mentor', label: 'Clinical & Language Mentor', category: 'academic' },
];

export const InternalTeamTab: React.FC = () => {
  const { user } = useAuth();

  // Create Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [internalRole, setInternalRole] = useState<InternalRole>('candidate_supplier_rm');
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Invite Link Modal / Card
  const [generatedInvite, setGeneratedInvite] = useState<{
    name: string;
    role: string;
    link: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<TeamMemberRow | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      const nowISO = new Date().toISOString();

      const [membersRes, invitesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, first_name, last_name, email, internal_role, is_internal, created_at')
          .eq('is_internal', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('pending_invites')
          .select('*')
          .eq('used', false)
          .gt('expires_at', nowISO)
          .order('created_at', { ascending: false }),
      ]);

      if (membersRes.data) {
        setMembers(membersRes.data as TeamMemberRow[]);
      }
      if (invitesRes.data) {
        setPendingInvites(invitesRes.data as PendingInviteRow[]);
      }
    } catch (err) {
      console.error('Error fetching team members and invites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
  }, []);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setGeneratedInvite(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();

    if (!cleanFirst || !cleanLast || !cleanEmail) {
      setFormError('First name, last name, and email are required.');
      return;
    }

    setGenerating(true);
    try {
      // 1. Validate email not already an internal profile
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, is_internal')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingProfile?.is_internal) {
        setFormError('A team member profile already exists with this email address.');
        setGenerating(false);
        return;
      }

      // 2. Validate email not already in valid pending_invites
      const nowISO = new Date().toISOString();
      const { data: existingInvite } = await supabase
        .from('pending_invites')
        .select('id')
        .eq('email', cleanEmail)
        .eq('used', false)
        .gt('expires_at', nowISO)
        .maybeSingle();

      if (existingInvite) {
        setFormError('An active, unexpired invite already exists for this email address.');
        setGenerating(false);
        return;
      }

      // 3. Generate token & 7 day expiry
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: newInvite, error: insertErr } = await supabase
        .from('pending_invites')
        .insert({
          first_name: cleanFirst,
          last_name: cleanLast,
          email: cleanEmail,
          internal_role: internalRole,
          created_by: user?.id,
          token,
          expires_at: expiresAt,
          used: false,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const fullUrl = `${window.location.origin}/internal/accept-invite?token=${token}`;

      setGeneratedInvite({
        name: `${cleanFirst} ${cleanLast}`,
        role: ALL_ROLES.find((r) => r.value === internalRole)?.label || internalRole,
        link: fullUrl,
      });

      // Clear form
      setFirstName('');
      setLastName('');
      setEmail('');

      // Refresh invites list
      if (newInvite) {
        setPendingInvites((prev) => [newInvite as PendingInviteRow, ...prev]);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to create internal invite.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = (linkToCopy: string) => {
    navigator.clipboard.writeText(linkToCopy);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleDeleteMemberConfirm = async () => {
    if (!memberToDelete) return;
    setIsDeletingMember(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_internal: false })
        .eq('id', memberToDelete.id);

      if (error) throw error;

      showToast('Team member removed.');
      setMemberToDelete(null);
      fetchTeamData();
    } catch (err: any) {
      alert(`Failed to remove team member: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeletingMember(false);
    }
  };

  const handleResendInvite = async (invite: PendingInviteRow) => {
    setActionLoadingId(invite.id);
    try {
      const newToken = crypto.randomUUID();
      const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('pending_invites')
        .update({ token: newToken, expires_at: newExpiry })
        .eq('id', invite.id);

      if (error) throw error;

      const fullUrl = `${window.location.origin}/internal/accept-invite?token=${newToken}`;
      setGeneratedInvite({
        name: `${invite.first_name} ${invite.last_name}`,
        role: ALL_ROLES.find((r) => r.value === invite.internal_role)?.label || invite.internal_role,
        link: fullUrl,
      });

      setPendingInvites((prev) =>
        prev.map((i) => (i.id === invite.id ? { ...i, token: newToken, expires_at: newExpiry } : i))
      );
    } catch (err: any) {
      alert(`Failed to refresh invite: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const getRoleBadgeClass = (role: string | null) => {
    const roleDef = ALL_ROLES.find((r) => r.value === role);
    switch (roleDef?.category) {
      case 'admin':
        return 'bg-[#1B3270] text-white';
      case 'partnerships':
        return 'bg-sky-50 text-sky-800 border border-sky-200';
      case 'placement':
        return 'bg-amber-50 text-amber-800 border border-amber-200';
      case 'academic':
        return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border border-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1B3270]">Internal Team Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Issue role invitations, grant staff authorizations, and manage workspace access permissions.
        </p>
      </div>

      {/* SECTION 1: CREATE INTERNAL ACCOUNT FORM */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-[#E2E8F4]">
          <UserPlus className="w-5 h-5 text-[#1B3270]" />
          <h2 className="text-base font-bold text-slate-800">
            Create Internal Account Invitation
          </h2>
        </div>

        {formError && (
          <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleGenerateInvite} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              First Name *
            </label>
            <input
              type="text"
              required
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              required
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Work Email *
            </label>
            <input
              type="email"
              required
              placeholder="name@terratern.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Internal Role *
            </label>
            <select
              value={internalRole}
              onChange={(e) => setInternalRole(e.target.value as InternalRole)}
              className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-800"
            >
              {ALL_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="submit"
              disabled={generating}
              className="w-full py-2 px-3 bg-[#1B3270] hover:bg-[#2952A3] text-white font-semibold text-xs rounded-[6px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
            >
              {generating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Send Invite</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Success Panel with Copyable Link */}
        {generatedInvite && (
          <div className="mt-4 p-4 rounded-[8px] bg-[#F0F4FF] border border-[#2952A3]/20 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1B3270] flex items-center space-x-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Invite link generated for {generatedInvite.name} ({generatedInvite.role})</span>
              </span>
              <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Expires in 7 days</span>
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={generatedInvite.link}
                className="flex-1 px-3 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] font-mono text-xs text-slate-700 select-all outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopyLink(generatedInvite.link)}
                className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
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
            <p className="text-[11px] text-slate-500">
              Share this secure registration URL with the team member. They will set their password and be assigned to the dashboard matching their role.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 2: INTERNAL TEAM MEMBERS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Active Team Members ({members.length})
          </h2>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No internal team members found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Internal Role</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Account Status</th>
                    <th className="py-3 px-4">Created Date</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                  {members.map((m) => {
                    const fullName =
                      m.first_name && m.last_name
                        ? `${m.first_name} ${m.last_name}`
                        : 'Staff User';
                    const roleLabel =
                      ALL_ROLES.find((r) => r.value === m.internal_role)?.label ||
                      m.internal_role ||
                      'Internal';
                    const isSelf = m.id === user?.id;

                    return (
                      <tr key={m.id} className="hover:bg-[#F8FAFD] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {fullName} {isSelf && <span className="text-[10px] text-blue-600 font-normal">(You)</span>}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold ${getRoleBadgeClass(
                              m.internal_role
                            )}`}
                          >
                            {roleLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                          {m.email}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold text-[11px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                          {new Date(m.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => setMemberToDelete(m)}
                              className="inline-flex items-center space-x-1 h-7 px-2.5 text-xs font-semibold text-[#EF4444] border border-[#EF4444] rounded-[6px] hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete team member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: PENDING INVITES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Pending Invitations ({pendingInvites.length})
          </h2>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : pendingInvites.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <p className="text-xs text-slate-400 italic">
                No active pending invites. All issued invitations have been claimed or expired.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                  {pendingInvites.map((inv) => {
                    const roleLabel =
                      ALL_ROLES.find((r) => r.value === inv.internal_role)?.label ||
                      inv.internal_role;
                    return (
                      <tr key={inv.id} className="hover:bg-[#F8FAFD] transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">
                            {inv.first_name} {inv.last_name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {inv.email}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-medium ${getRoleBadgeClass(
                              inv.internal_role
                            )}`}
                          >
                            {roleLabel}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                          {new Date(inv.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4 text-amber-700 font-mono text-[11px]">
                          {new Date(inv.expires_at).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button
                            type="button"
                            onClick={() => handleResendInvite(inv)}
                            disabled={actionLoadingId === inv.id}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#1B3270] bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-[#F0F4FF] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                          >
                            <RotateCw className="w-3 h-3" />
                            <span>Resend</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyLink(
                                `${window.location.origin}/internal/accept-invite?token=${inv.token}`
                              )
                            }
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="fixed top-18 right-6 z-60 bg-[#1B3270] text-white px-4 py-2.5 rounded-[6px] shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {memberToDelete && (
        <DeleteConfirmationModal
          isOpen={true}
          tier="tier2"
          entityType="Team Member"
          entityName={`${memberToDelete.first_name || ''} ${memberToDelete.last_name || ''}`.trim() || memberToDelete.email}
          bodyText={`This deactivates ${`${memberToDelete.first_name || ''} ${memberToDelete.last_name || ''}`.trim() || memberToDelete.email}'s account. Their historical data is retained.`}
          onClose={() => setMemberToDelete(null)}
          onConfirm={handleDeleteMemberConfirm}
          isDeleting={isDeletingMember}
        />
      )}
    </div>
  );
};
