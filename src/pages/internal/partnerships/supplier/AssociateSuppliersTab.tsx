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
  Check,
  Loader2,
  Users,
  FileCheck,
  AlertTriangle,
  Bell,
  ExternalLink,
} from 'lucide-react';
import { notifyByRole } from '../../../../utils/notificationRouting';

interface SupplierRow {
  id: string;
  company_name: string;
  company_type: string;
  tier: string;
  compliance_declared: boolean;
  no_fee_policy_confirmed: boolean;
  registration_number: string | null;
  created_at: string;
  rm_name: string;
  has_rm: boolean;
  team_members_count: number;
  docs_uploaded_count: number;
  docs_verified_count: number;
}

interface TeamMemberItem {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
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

interface AssociateSuppliersTabProps {
  initialSelectedSupplierId?: string | null;
}

export const AssociateSuppliersTab: React.FC<AssociateSuppliersTabProps> = ({
  initialSelectedSupplierId,
}) => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Drawer
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRow | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMemberItem[]>([]);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocItem[]>([]);

  // Notifications
  const [notifying, setNotifying] = useState(false);
  const [notifiedSuppliers, setNotifiedSuppliers] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isNotifiedRecent = (supplierId: string) => {
    if (notifiedSuppliers.has(supplierId)) return true;
    try {
      const stored = localStorage.getItem(`rm_notified_sup_${supplierId}`);
      if (!stored) return false;
      const timeDiff = Date.now() - parseInt(stored, 10);
      return timeDiff < 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  };

  const fetchMySuppliers = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch suppliers created by this associate
      const { data: sups, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('created_by_internal', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const supList = sups || [];
      const supIds = supList.map((s) => s.id);

      // 2. Fetch RM names
      const rmMap: Record<string, string> = {};
      if (supIds.length > 0) {
        const { data: rmData } = await supabase
          .from('rm_assignments')
          .select(`
            entity_id,
            profiles:rm_profile_id(first_name, last_name, email)
          `)
          .eq('entity_type', 'supplier')
          .eq('active', true)
          .in('entity_id', supIds);

        (rmData || []).forEach((rm: any) => {
          const name = rm.profiles
            ? `${rm.profiles.first_name || ''} ${rm.profiles.last_name || ''}`.trim() || rm.profiles.email
            : 'Assigned RM';
          rmMap[rm.entity_id] = name;
        });
      }

      // 3. Team member counts
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

      // 4. Compliance docs uploaded and verified counts
      const uploadedCountMap: Record<string, number> = {};
      const verifiedCountMap: Record<string, number> = {};
      if (supIds.length > 0) {
        const { data: docsData } = await supabase
          .from('supplier_documents')
          .select('supplier_id, verification_status')
          .in('supplier_id', supIds);

        (docsData || []).forEach((doc) => {
          uploadedCountMap[doc.supplier_id] = (uploadedCountMap[doc.supplier_id] || 0) + 1;
          if (doc.verification_status === 'verified') {
            verifiedCountMap[doc.supplier_id] = (verifiedCountMap[doc.supplier_id] || 0) + 1;
          }
        });
      }

      const rows: SupplierRow[] = supList.map((s) => ({
        id: s.id,
        company_name: s.company_name,
        company_type: s.company_type || 'Agency',
        tier: s.tier || 'basic',
        compliance_declared: s.compliance_declared,
        no_fee_policy_confirmed: s.no_fee_policy_confirmed,
        registration_number: s.registration_number,
        created_at: s.created_at,
        rm_name: rmMap[s.id] || 'Not assigned',
        has_rm: Boolean(rmMap[s.id]),
        team_members_count: teamCountMap[s.id] || 0,
        docs_uploaded_count: uploadedCountMap[s.id] || 0,
        docs_verified_count: verifiedCountMap[s.id] || 0,
      }));

      setSuppliers(rows);

      if (initialSelectedSupplierId) {
        const target = rows.find((r) => r.id === initialSelectedSupplierId);
        if (target) {
          handleOpenDetail(target);
        }
      }
    } catch (err) {
      console.error('Error fetching my suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySuppliers();
  }, [user, initialSelectedSupplierId]);

  const handleOpenDetail = async (sup: SupplierRow) => {
    setSelectedSupplier(sup);
    setDrawerLoading(true);
    try {
      const [teamRes, docsRes] = await Promise.all([
        supabase
          .from('supplier_team_members')
          .select('id, full_name, email, role, status')
          .eq('supplier_id', sup.id),
        supabase
          .from('supplier_documents')
          .select('id, document_type, file_name, file_url, verification_status, verified_at, rejection_reason')
          .eq('supplier_id', sup.id),
      ]);

      setTeamMembers(teamRes.data || []);
      setComplianceDocs(docsRes.data || []);
    } catch (err) {
      console.error('Error loading supplier detail:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleNotifyPlacementTeam = async (supplierId: string, companyName: string) => {
    if (!user || notifying) return;
    setNotifying(true);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      const associateName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
        : 'Associate';

      await notifyByRole(
        supabase,
        'placement_lead',
        'RM Assignment Needed',
        `${companyName} (onboarded by ${associateName}) does not have an account manager assigned. Review and assign.`,
        'rm_assignment_request',
        user.id
      );

      try {
        localStorage.setItem(`rm_notified_sup_${supplierId}`, Date.now().toString());
      } catch {}

      setNotifiedSuppliers((prev) => new Set(prev).add(supplierId));
      showToast('Placement team has been notified.');
    } catch (err) {
      console.error('Error notifying placement team:', err);
      alert('Failed to send notification to placement team.');
    } finally {
      setNotifying(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    return !q || s.company_name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[6px] shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">My Sourced Suppliers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Agencies and vocational academies onboarded through your channel partnerships pipeline.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-white border border-[#E2E8F4] px-3 py-1.5 rounded-[6px] shadow-2xs">
          <Building2 className="w-3.5 h-3.5 text-[#1B3270]" />
          <span>Total Sourced: <strong className="text-slate-800">{suppliers.length}</strong></span>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search supplier company name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-[6px] border border-[#E2E8F4] focus:ring-1 focus:ring-[#1B3270] outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No suppliers found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Suppliers you onboard will be listed here with team size, compliance status, and RM assignments.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4 text-center">Team</th>
                  <th className="py-3 px-4 text-center">Compliance</th>
                  <th className="py-3 px-4 text-center">Verified</th>
                  <th className="py-3 px-4 text-center">RM Assigned</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{sup.company_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        Created {new Date(sup.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 capitalize text-slate-600">
                      {sup.company_type}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                        {sup.tier}
                      </span>
                    </td>
                    {/* Team Members */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium">
                      {sup.team_members_count} members
                    </td>
                    {/* Compliance Docs Uploaded */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {sup.docs_uploaded_count}/5 uploaded
                      </span>
                    </td>
                    {/* Compliance Docs Verified */}
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          sup.docs_verified_count === 5
                            ? 'bg-emerald-100 text-emerald-800'
                            : sup.docs_verified_count > 0
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {sup.docs_verified_count}/5 verified
                      </span>
                    </td>
                    {/* RM Assigned */}
                    <td className="py-3.5 px-4 text-center">
                      {sup.has_rm ? (
                        <span className="inline-flex items-center text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          {sup.rm_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                          Not assigned
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
                  {/* RM Assignment Status Card */}
                  <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 space-y-3">
                    <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                      <ShieldCheck className="w-4 h-4 text-[#2952A3]" />
                      <span>Account Manager Assignment</span>
                    </h3>

                    {selectedSupplier.has_rm ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-[6px] flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-emerald-800 font-semibold block">
                            Dedicated Account Manager
                          </span>
                          <span className="text-emerald-900 font-bold text-sm">
                            {selectedSupplier.rm_name}
                          </span>
                        </div>
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                    ) : (
                      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-[6px] space-y-2.5">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-amber-900">Not yet assigned</p>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              This supplier is awaiting dedicated Account Manager allocation by the Placement Lead.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleNotifyPlacementTeam(selectedSupplier.id, selectedSupplier.company_name)}
                          disabled={isNotifiedRecent(selectedSupplier.id) || notifying}
                          className="w-full py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] font-semibold text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
                        >
                          {notifying ? (
                            <span>Notifying...</span>
                          ) : isNotifiedRecent(selectedSupplier.id) ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Placement team notified</span>
                            </>
                          ) : (
                            <>
                              <Bell className="w-3.5 h-3.5" />
                              <span>Notify Placement Team</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
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
                        No team members registered under this agency yet.
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

                    <div className="p-2.5 rounded bg-blue-50 border border-blue-200 text-[11px] text-blue-800">
                      Verification is completed by the account manager.
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

export default AssociateSuppliersTab;
