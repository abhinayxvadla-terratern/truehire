import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Building2,
  Search,
  Eye,
  X,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Users,
  FileCheck,
  CheckSquare,
  AlertTriangle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

interface SupplierRow {
  id: string;
  company_name: string;
  company_type: string;
  tier: string;
  compliance_declared: boolean;
  no_fee_policy_confirmed: boolean;
  registration_number: string | null;
  created_at: string;
  onboarded_by_name: string;
  rm_name: string;
  has_rm: boolean;
  team_members_count: number;
  compliance_verified_count: number;
  checklist_completed_count: number;
  onboarding_checklist?: any;
}

interface TeamMemberItem {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

interface ComplianceDocItem {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  verification_status: 'verified' | 'pending_review' | 'rejected' | string;
  verified_at: string | null;
  rejection_reason: string | null;
}

const COMPLIANCE_DOC_TYPES = [
  { key: 'agency_license', label: 'Agency / Academy Accreditation License' },
  { key: 'no_fee_policy', label: 'Zero Placement Fee Policy Agreement' },
  { key: 'tax_certificate', label: 'Commercial Tax Registration Certificate' },
  { key: 'curriculum_proof', label: 'Nursing Curriculum / Training Proof' },
  { key: 'data_protection', label: 'Data Privacy & GDPR Agreement' },
];

const ONBOARDING_STEPS = [
  { key: 'profile_completed', label: 'Profile & registration details' },
  { key: 'rm_assigned', label: 'Account manager assigned' },
  { key: 'first_candidate_submitted', label: 'First candidate submitted' },
  { key: 'compliance_verified', label: 'Compliance documents verified' },
  { key: 'first_candidate_qualified', label: 'First candidate qualified' },
];

export const LeadSuppliersTab: React.FC = () => {
  const { user: _user } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  // Detail Drawer
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRow | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberItem[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocItem[]>([]);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      // 1. Fetch suppliers joined with onboarder profile
      const { data: sups, error: supErr } = await supabase
        .from('suppliers')
        .select(`
          id,
          company_name,
          company_type,
          tier,
          compliance_declared,
          no_fee_policy_confirmed,
          registration_number,
          created_at,
          created_by_internal,
          onboarding_checklist,
          profiles:created_by_internal(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (supErr) throw supErr;

      const supList = sups || [];
      const supIds = supList.map((s) => s.id);

      // 2. Active RM assignments for suppliers
      const rmMap: Record<string, string> = {};
      if (supIds.length > 0) {
        const { data: rmAssignments } = await supabase
          .from('rm_assignments')
          .select(`
            entity_id,
            profiles:rm_profile_id(first_name, last_name, email)
          `)
          .eq('entity_type', 'supplier')
          .eq('active', true)
          .in('entity_id', supIds);

        (rmAssignments || []).forEach((rm: any) => {
          const name = rm.profiles
            ? `${rm.profiles.first_name || ''} ${rm.profiles.last_name || ''}`.trim() || rm.profiles.email
            : 'Assigned RM';
          rmMap[rm.entity_id] = name;
        });
      }

      // 3. Team members count per supplier
      const teamCountMap: Record<string, number> = {};
      if (supIds.length > 0) {
        const { data: teamMembersData } = await supabase
          .from('supplier_team_members')
          .select('supplier_id')
          .in('supplier_id', supIds);

        (teamMembersData || []).forEach((tm) => {
          teamCountMap[tm.supplier_id] = (teamCountMap[tm.supplier_id] || 0) + 1;
        });
      }

      // 4. Compliance docs verified count per supplier
      const complianceCountMap: Record<string, number> = {};
      if (supIds.length > 0) {
        const { data: docsData } = await supabase
          .from('supplier_documents')
          .select('supplier_id, verification_status')
          .in('supplier_id', supIds)
          .eq('verification_status', 'verified');

        (docsData || []).forEach((doc) => {
          complianceCountMap[doc.supplier_id] = (complianceCountMap[doc.supplier_id] || 0) + 1;
        });
      }

      // 5. Build rows
      const rows: SupplierRow[] = supList.map((s: any) => {
        const onboarder = s.profiles
          ? `${s.profiles.first_name || ''} ${s.profiles.last_name || ''}`.trim() || s.profiles.email
          : 'Direct / External';

        const hasRm = Boolean(rmMap[s.id]);
        const teamCount = teamCountMap[s.id] || 0;
        const verifiedDocsCount = complianceCountMap[s.id] || 0;

        // Calculate checklist progress
        const checklist = s.onboarding_checklist || {};
        let checklistCompleted = 0;
        if (checklist.profile_completed || (s.company_name && s.company_type)) checklistCompleted++;
        if (checklist.rm_assigned || hasRm) checklistCompleted++;
        if (checklist.first_candidate_submitted) checklistCompleted++;
        if (checklist.compliance_verified || verifiedDocsCount >= 5) checklistCompleted++;
        if (checklist.first_candidate_qualified) checklistCompleted++;

        return {
          id: s.id,
          company_name: s.company_name,
          company_type: s.company_type || 'Agency',
          tier: s.tier || 'basic',
          compliance_declared: s.compliance_declared,
          no_fee_policy_confirmed: s.no_fee_policy_confirmed,
          registration_number: s.registration_number,
          created_at: s.created_at,
          onboarded_by_name: onboarder,
          rm_name: rmMap[s.id] || 'Not assigned',
          has_rm: hasRm,
          team_members_count: teamCount,
          compliance_verified_count: verifiedDocsCount,
          checklist_completed_count: checklistCompleted,
          onboarding_checklist: checklist,
        };
      });

      setSuppliers(rows);
    } catch (err) {
      console.error('Error fetching suppliers for lead:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenDetail = async (sup: SupplierRow) => {
    setSelectedSupplier(sup);
    setDrawerLoading(true);
    try {
      const [teamRes, docsRes] = await Promise.all([
        supabase
          .from('supplier_team_members')
          .select('id, full_name, email, role, status, created_at')
          .eq('supplier_id', sup.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('supplier_documents')
          .select('id, document_type, file_name, file_url, verification_status, verified_at, rejection_reason')
          .eq('supplier_id', sup.id),
      ]);

      setTeamMembers(teamRes.data || []);
      setComplianceDocs(docsRes.data || []);
    } catch (err) {
      console.error('Error loading supplier detail drawer:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (
      q &&
      !s.company_name.toLowerCase().includes(q) &&
      !s.onboarded_by_name.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (tierFilter !== 'all' && s.tier !== tierFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">Supplier Accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Oversee sourcing agency channels, associate onboarding provenance, and compliance readiness.
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by company name or onboarder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs outline-none focus:bg-white focus:ring-1 focus:ring-[#1B3270] transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Tier:</span>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs outline-none text-slate-700 font-medium focus:bg-white focus:ring-1 focus:ring-[#1B3270]"
          >
            <option value="all">All Tiers</option>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>

      {/* SUPPLIERS TABLE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <Building2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            No supplier partners found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4 text-center">Team Members</th>
                  <th className="py-3 px-4 text-center">Compliance</th>
                  <th className="py-3 px-4 text-center">Checklist</th>
                  <th className="py-3 px-4 text-center">RM Assigned</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{sup.company_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        Onboarded by: {sup.onboarded_by_name}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 capitalize">
                      {sup.company_type}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                        {sup.tier}
                      </span>
                    </td>
                    {/* Team Members */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium">
                      {sup.team_members_count}
                    </td>
                    {/* Compliance */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          sup.compliance_verified_count === 5
                            ? 'bg-emerald-100 text-emerald-800'
                            : sup.compliance_verified_count > 0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {sup.compliance_verified_count}/5 docs
                      </span>
                    </td>
                    {/* Checklist */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          sup.checklist_completed_count === 5
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {sup.checklist_completed_count}/5 steps
                      </span>
                    </td>
                    {/* RM Assigned */}
                    <td className="py-3.5 px-4 text-center">
                      {sup.has_rm ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                          No
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(sup)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#1B3270] bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-[#F0F4FF] hover:border-[#2952A3]/30 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* READ-ONLY SUPPLIER DETAIL DRAWER */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/30 backdrop-blur-2xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-[#E2E8F4] animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-[#1B3270] text-white flex items-center justify-center font-bold text-sm">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1B3270]">
                    {selectedSupplier.company_name}
                  </h2>
                  <p className="text-xs text-slate-400">Supplier Overview (Read-Only)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSupplier(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
              {drawerLoading ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Loading partner details...</p>
                </div>
              ) : (
                <>
                  {/* Partner Identity Card */}
                  <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 space-y-3">
                    <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#2952A3]" />
                      <span>Company Profile & Allocation</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Company Type</span>
                        <span className="font-semibold text-slate-800 capitalize">
                          {selectedSupplier.company_type}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Verification Tier</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200 inline-block mt-0.5">
                          {selectedSupplier.tier}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Registration No.</span>
                        <span className="font-mono text-slate-700">
                          {selectedSupplier.registration_number || 'Not provided'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Account Manager</span>
                        <span
                          className={`font-semibold ${
                            selectedSupplier.has_rm ? 'text-[#1B3270]' : 'text-amber-600'
                          }`}
                        >
                          {selectedSupplier.rm_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 1: TEAM MEMBERS (READ-ONLY) */}
                  <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                        <Users className="w-4 h-4 text-[#2952A3]" />
                        <span>Team Members ({teamMembers.length})</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Read-Only
                      </span>
                    </div>

                    {teamMembers.length === 0 ? (
                      <p className="text-slate-400 italic text-center py-2 text-xs">
                        No team members registered yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#E2E8F4]">
                        {teamMembers.map((m) => (
                          <div key={m.id} className="py-2 flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-slate-800">{m.full_name}</p>
                              <p className="text-[11px] text-slate-400">{m.email}</p>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                                {m.role}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{m.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: COMPLIANCE DOCUMENTS (READ-ONLY) */}
                  <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                        <FileCheck className="w-4 h-4 text-[#2952A3]" />
                        <span>Compliance Documents</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Managed by RM
                      </span>
                    </div>

                    <div className="space-y-2">
                      {COMPLIANCE_DOC_TYPES.map((typeDef) => {
                        const doc = complianceDocs.find((d) => d.document_type === typeDef.key);
                        const isVerified = doc?.verification_status === 'verified';
                        const isRejected = doc?.verification_status === 'rejected';
                        const isPending = doc && !isVerified && !isRejected;

                        return (
                          <div
                            key={typeDef.key}
                            className="p-2.5 rounded-[6px] border border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]"
                          >
                            <div className="pr-2">
                              <p className="font-medium text-slate-800">{typeDef.label}</p>
                              {doc?.file_name && (
                                <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                  {doc.file_name}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                              {isVerified ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Verified
                                </span>
                              ) : isRejected ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Rejected
                                </span>
                              ) : isPending ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Awaiting RM
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-600">
                                  Not Uploaded
                                </span>
                              )}

                              {doc?.file_url && (
                                <a
                                  href={doc.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded text-slate-400 hover:text-[#1B3270] hover:bg-slate-100"
                                  title="View document"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[11px] text-slate-400 italic pt-1">
                      Note: Document verification actions are exclusively handled by the assigned Relationship Manager.
                    </p>
                  </div>

                  {/* SECTION 3: ONBOARDING CHECKLIST (READ-ONLY) */}
                  <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                        <CheckSquare className="w-4 h-4 text-[#2952A3]" />
                        <span>Onboarding Progress</span>
                      </h3>
                      <span className="font-mono text-xs font-bold text-[#1B3270]">
                        {selectedSupplier.checklist_completed_count}/5 completed
                      </span>
                    </div>

                    <div className="space-y-2">
                      {ONBOARDING_STEPS.map((step) => {
                        const cl = selectedSupplier.onboarding_checklist || {};
                        let isDone = false;
                        if (step.key === 'profile_completed') {
                          isDone = Boolean(cl.profile_completed || (selectedSupplier.company_name && selectedSupplier.company_type));
                        } else if (step.key === 'rm_assigned') {
                          isDone = Boolean(cl.rm_assigned || selectedSupplier.has_rm);
                        } else if (step.key === 'first_candidate_submitted') {
                          isDone = Boolean(cl.first_candidate_submitted);
                        } else if (step.key === 'compliance_verified') {
                          isDone = Boolean(cl.compliance_verified || selectedSupplier.compliance_verified_count >= 5);
                        } else if (step.key === 'first_candidate_qualified') {
                          isDone = Boolean(cl.first_candidate_qualified);
                        }

                        return (
                          <div
                            key={step.key}
                            className="flex items-center justify-between p-2 rounded bg-[#F8FAFD] border border-[#E2E8F4]"
                          >
                            <span className="text-slate-700 font-medium">{step.label}</span>
                            {isDone ? (
                              <span className="text-emerald-700 font-bold text-[11px] flex items-center">
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                Complete
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Pending</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E2E8F4] bg-[#F8FAFD] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedSupplier(null)}
                className="px-4 py-2 border border-[#E2E8F4] text-slate-600 rounded-[6px] font-semibold hover:bg-white cursor-pointer text-xs"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadSuppliersTab;
