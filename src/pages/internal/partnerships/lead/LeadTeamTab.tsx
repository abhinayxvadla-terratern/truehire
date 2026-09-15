import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth, InternalRole } from '../../../../context/AuthContext';
import {
  UserPlus,
  Users,
  Copy,
  Check,
  Clock,
  AlertCircle,
  Loader2,
  Info,
  Building2,
  Briefcase,
  TrendingUp,
} from 'lucide-react';

interface TeamMemberRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  internal_role: InternalRole | null;
  is_internal: boolean;
  created_at: string;
}

interface AssociateWorkloadCard {
  id: string;
  name: string;
  role: InternalRole;
  totalLifetime: number;
  thisMonth: number;
  awaitingRm: number;
  avgDaysToRm: number;
}

const ALLOWED_ASSOCIATE_ROLES: { value: InternalRole; label: string }[] = [
  {
    value: 'supplier_partnerships_associate',
    label: 'Supplier Partnerships Associate',
  },
  {
    value: 'employer_partnerships_associate',
    label: 'Employer Partnerships Associate',
  },
];

export const LeadTeamTab: React.FC = () => {
  const { user } = useAuth();

  // Form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [internalRole, setInternalRole] = useState<InternalRole>(
    'supplier_partnerships_associate'
  );
  const [generating, setGenerating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Invite Link Card
  const [generatedInvite, setGeneratedInvite] = useState<{
    name: string;
    role: string;
    link: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Team List & Workload
  const [teamMembers, setTeamMembers] = useState<TeamMemberRow[]>([]);
  const [workloads, setWorkloads] = useState<AssociateWorkloadCard[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeamAndWorkloads = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const startOfMonthIso = startOfMonth.toISOString();
      const now = Date.now();

      // 1. Fetch team members
      const { data: members, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, internal_role, is_internal, created_at')
        .in('internal_role', [
          'supplier_partnerships_associate',
          'employer_partnerships_associate',
        ])
        .eq('is_internal', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const memList = (members as TeamMemberRow[]) || [];
      setTeamMembers(memList);

      // 2. Fetch suppliers & employers with created_by_internal
      const [supsRes, empsRes, rmRes] = await Promise.all([
        supabase.from('suppliers').select('id, created_by_internal, created_at'),
        supabase.from('employers').select('id, created_by_internal, created_at'),
        supabase.from('rm_assignments').select('entity_id, entity_type, created_at, active').eq('active', true),
      ]);

      const sups = supsRes.data || [];
      const emps = empsRes.data || [];
      const rms = rmRes.data || [];

      // Map entity_id to rm_assignment created_at
      const rmAssignmentDateMap: Record<string, string> = {};
      rms.forEach((r) => {
        rmAssignmentDateMap[r.entity_id] = r.created_at;
      });

      // Compute workload cards
      const computedCards: AssociateWorkloadCard[] = memList.map((m) => {
        const isSupplierAssoc = m.internal_role === 'supplier_partnerships_associate';
        const accounts = isSupplierAssoc
          ? sups.filter((s) => s.created_by_internal === m.id)
          : emps.filter((e) => e.created_by_internal === m.id);

        const totalLifetime = accounts.length;
        const thisMonth = accounts.filter((a) => a.created_at >= startOfMonthIso).length;
        const awaitingRm = accounts.filter((a) => !rmAssignmentDateMap[a.id]).length;

        // Calculate average time to RM assignment
        let totalDays = 0;
        accounts.forEach((a) => {
          const accountCreatedAt = new Date(a.created_at).getTime();
          const rmDateStr = rmAssignmentDateMap[a.id];
          if (rmDateStr) {
            const rmAssignedAt = new Date(rmDateStr).getTime();
            const days = Math.max(0, Math.round((rmAssignedAt - accountCreatedAt) / (1000 * 60 * 60 * 24)));
            totalDays += days;
          } else {
            // unassigned: today - created_at
            const days = Math.max(0, Math.round((now - accountCreatedAt) / (1000 * 60 * 60 * 24)));
            totalDays += days;
          }
        });

        const avgDaysToRm = totalLifetime > 0 ? Math.round((totalDays / totalLifetime) * 10) / 10 : 0;
        const name = m.first_name && m.last_name ? `${m.first_name} ${m.last_name}` : m.email;

        return {
          id: m.id,
          name,
          role: m.internal_role || 'supplier_partnerships_associate',
          totalLifetime,
          thisMonth,
          awaitingRm,
          avgDaysToRm,
        };
      });

      setWorkloads(computedCards);
    } catch (err) {
      console.error('Error fetching partnerships team:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamAndWorkloads();
  }, []);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setGeneratedInvite(null);

    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirst || !cleanLast || !cleanEmail) {
      setFormError('All fields are required.');
      return;
    }

    if (!user) {
      setFormError('Current user session missing.');
      return;
    }

    setGenerating(true);
    try {
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: inviteErr } = await supabase.from('pending_invites').insert({
        first_name: cleanFirst,
        last_name: cleanLast,
        email: cleanEmail,
        invite_type: 'internal',
        internal_role: internalRole,
        created_by: user.id,
        token,
        expires_at: expiresAt,
        used: false,
      });

      if (inviteErr) throw inviteErr;

      const fullUrl = `${window.location.origin}/internal/accept-invite?token=${token}`;

      setGeneratedInvite({
        name: `${cleanFirst} ${cleanLast}`,
        role:
          ALLOWED_ASSOCIATE_ROLES.find((r) => r.value === internalRole)?.label ||
          internalRole,
        link: fullUrl,
      });

      setFirstName('');
      setLastName('');
      setEmail('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to create associate invite.');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyLink = (linkToCopy: string) => {
    navigator.clipboard.writeText(linkToCopy);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1B3270]">Partnerships Team</h1>
        <p className="text-sm text-slate-500 mt-1">
          Direct your supplier and employer partnerships associates and authorize new team members.
        </p>
      </div>

      {/* SECTION 1: ASSOCIATE WORKLOAD CARDS (NEW) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-[#1B3270]" />
            <h2 className="text-base font-bold text-slate-800">
              Associate Workload & Performance
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Lifetime onboarding and handoff turnaround
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-44 bg-white border border-[#E2E8F4] rounded-[10px] animate-pulse p-5" />
            ))}
          </div>
        ) : workloads.length === 0 ? (
          <div className="p-8 text-center bg-white border border-[#E2E8F4] rounded-[10px] text-xs text-slate-400 shadow-2xs">
            No active partnerships associates found to measure workload.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workloads.map((card) => {
              const isSupplier = card.role === 'supplier_partnerships_associate';
              return (
                <div
                  key={card.id}
                  className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs space-y-4 hover:border-[#1B3270]/30 transition-all"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{card.name}</h3>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-1 border ${
                          isSupplier
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-sky-50 text-sky-700 border-sky-200'
                        }`}
                      >
                        {isSupplier ? 'Supplier Associate' : 'Employer Associate'}
                      </span>
                    </div>
                    <div
                      className={`p-2 rounded-lg ${
                        isSupplier ? 'bg-indigo-50 text-indigo-600' : 'bg-sky-50 text-sky-600'
                      }`}
                    >
                      {isSupplier ? <Building2 className="w-4 h-4" /> : <Briefcase className="w-4 h-4" />}
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E2E8F4]">
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Lifetime Onboarded</span>
                      <span className="text-lg font-bold text-slate-900 font-mono">
                        {card.totalLifetime}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">This Month</span>
                      <span className="text-lg font-bold text-[#1B3270] font-mono">
                        +{card.thisMonth}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Awaiting RM</span>
                      <span
                        className={`text-lg font-bold font-mono ${
                          card.awaitingRm > 0 ? 'text-amber-600' : 'text-slate-600'
                        }`}
                      >
                        {card.awaitingRm}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block font-medium">Avg Handoff Time</span>
                      <span className="text-lg font-bold text-slate-900 font-mono">
                        {card.avgDaysToRm} <span className="text-xs font-normal text-slate-500">days</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: CREATE ASSOCIATE ACCOUNT FORM */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-[#E2E8F4]">
          <UserPlus className="w-5 h-5 text-[#1B3270]" />
          <h2 className="text-base font-bold text-slate-800">
            Create Associate Account Invitation
          </h2>
        </div>

        {formError && (
          <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form
          onSubmit={handleGenerateInvite}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
        >
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
              placeholder="associate@terratern.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Designated Associate Role *
            </label>
            <select
              value={internalRole}
              onChange={(e) => setInternalRole(e.target.value as InternalRole)}
              className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-800"
            >
              {ALLOWED_ASSOCIATE_ROLES.map((r) => (
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

        {/* Generated Invite Card */}
        {generatedInvite && (
          <div className="mt-4 p-4 rounded-[8px] bg-[#F0F4FF] border border-[#2952A3]/20 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1B3270] flex items-center space-x-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>
                  Invite link created for {generatedInvite.name} ({generatedInvite.role})
                </span>
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
              Share this secure registration link with your associate to set up their internal password.
            </p>
          </div>
        )}
      </div>

      {/* SECTION 3: TEAM LIST (VIEW ONLY) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Active Partnerships Associates ({teamMembers.length})
          </h2>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : teamMembers.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                No active partnerships associates found.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Generate an invite above to add team members to your department.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Created Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                  {teamMembers.map((m) => {
                    const fullName =
                      m.first_name && m.last_name
                        ? `${m.first_name} ${m.last_name}`
                        : 'Associate Member';
                    const roleLabel =
                      ALLOWED_ASSOCIATE_ROLES.find((r) => r.value === m.internal_role)?.label ||
                      m.internal_role;

                    return (
                      <tr key={m.id} className="hover:bg-[#F8FAFD] transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {fullName}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded text-[11px] font-medium border ${
                              m.internal_role === 'supplier_partnerships_associate'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-sky-50 text-sky-700 border-sky-200'
                            }`}
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Lead notice regarding deactivations */}
        <div className="p-3.5 rounded-[6px] bg-slate-50 border border-[#E2E8F4] text-xs text-slate-600 flex items-center space-x-2.5">
          <Info className="w-4 h-4 text-[#1B3270] shrink-0" />
          <span>
            <strong>Governance Note:</strong> To deactivate an associate account, contact Super Admin. Partnerships Leads have view and onboarding invitation authorization.
          </span>
        </div>
      </div>
    </div>
  );
};

export default LeadTeamTab;
