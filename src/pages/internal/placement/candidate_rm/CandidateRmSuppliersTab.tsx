import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Building2,
  Search,
  Eye,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  FileText,
  Check,
  Users,
  MapPin,
  ExternalLink,
  AlertCircle,
  Save,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { formatDate } from '../../../../utils/formatters';

interface SupplierData {
  id: string;
  company_name: string;
  company_type: string;
  tier: string;
  country_of_operation: string | null;
  registration_number: string | null;
  description: string | null;
  website_url: string | null;
  year_established: number | null;
  primary_contact_name: string | null;
  primary_contact_phone: string | null;
  office_address: string | null;
  healthcare_roles_focus: string[] | null;
  source_countries: string[] | null;
  compliance_declared: boolean;
  compliance_declared_at: string | null;
  no_fee_policy_confirmed: boolean;
  no_fee_policy_confirmed_at: string | null;
  onboarding_checklist: any;
  created_at: string;
  user_id: string | null;
  created_by_internal: string | null;
}

interface SupplierRow {
  assignmentId: string;
  rmSince: string;
  notes: string | null;
  supplier: SupplierData;
  teamMembersCount: number;
  totalCandidates: number;
  interviewReadyCount: number;
  verifiedDocsCount: number;
  hasRejectedDoc: boolean;
  hasActiveCoolingPeriod: boolean;
  hasStalledCandidates: boolean;
  health: 'good' | 'attention' | 'action_required';
}

interface SupplierDocumentItem {
  id: string;
  supplier_id: string;
  document_type: string;
  document_label: string;
  file_url: string | null;
  status: 'not_uploaded' | 'pending' | 'under_review' | 'verified' | 'rejected';
  is_mandatory: boolean;
  notes: string | null;
  verified_by: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  uploaded_at: string | null;
  created_at?: string;
}

interface TeamMemberItem {
  id: string;
  profile_id: string | null;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  invite_status: string;
  created_at: string;
}

interface CandidateItem {
  id: string;
  first_name: string;
  last_name: string;
  target_role: string | null;
  status: string;
  created_at: string;
}

const MANDATORY_DOC_TEMPLATES = [
  {
    type: 'business_registration_certificate',
    label: 'Business Registration Certificate',
    notes: 'Official commercial registry excerpt or certificate of incorporation.',
  },
  {
    type: 'recruitment_license',
    label: 'Recruitment License / Permit',
    notes: 'National or state overseas recruitment / staffing license.',
  },
  {
    type: 'ral_compliance_declaration',
    label: 'RAL Faire Anwerbung Pflege — Compliance Declaration',
    notes: 'Signed declaration of compliance with German ethical recruitment standards.',
  },
  {
    type: 'gdpr_data_protection_policy',
    label: 'GDPR Data Protection Policy',
    notes: 'Company privacy and data processing policy compliant with EU GDPR.',
  },
  {
    type: 'ethical_recruitment_policy',
    label: 'Ethical Recruitment Policy',
    notes: 'Institutional code of ethics covering employer-pays principles and zero candidate fees.',
  },
];

export const CandidateRmSuppliersTab: React.FC = () => {
  const { user } = useAuth();
  const [, setSearchParams] = useSearchParams();

  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Detail Drawer State
  const [selectedSupplierRow, setSelectedSupplierRow] = useState<SupplierRow | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'compliance' | 'team' | 'candidates' | 'notes'>('overview');
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Drawer Sub-data
  const [panelDocs, setPanelDocs] = useState<SupplierDocumentItem[]>([]);
  const [panelTeam, setPanelTeam] = useState<TeamMemberItem[]>([]);
  const [panelCandidates, setPanelCandidates] = useState<CandidateItem[]>([]);
  const [rmNotes, setRmNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Reject Modal
  const [rejectingDoc, setRejectingDoc] = useState<SupplierDocumentItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Verifying Doc State
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);

  const fetchMySuppliers = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch active rm_assignments where rm_profile_id = user.id AND entity_type = 'supplier'
      const { data: assignments, error: assErr } = await supabase
        .from('rm_assignments')
        .select(`
          id,
          rm_profile_id,
          entity_type,
          entity_id,
          assigned_by,
          active,
          created_at,
          notes,
          suppliers:entity_id (*)
        `)
        .eq('rm_profile_id', user.id)
        .eq('entity_type', 'supplier')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (assErr) throw assErr;

      const validAssignments = (assignments || []).filter((a: any) => a.suppliers && a.suppliers.id);
      const supplierIds = validAssignments.map((a: any) => a.suppliers.id);

      if (supplierIds.length === 0) {
        setSuppliers([]);
        return;
      }

      // 2. Query team members count for each supplier
      const { data: teamData } = await supabase
        .from('supplier_team_members')
        .select('supplier_id')
        .in('supplier_id', supplierIds);

      const teamCountMap: Record<string, number> = {};
      (teamData || []).forEach((tm) => {
        if (tm.supplier_id) {
          teamCountMap[tm.supplier_id] = (teamCountMap[tm.supplier_id] || 0) + 1;
        }
      });

      // 3. Query supplier_documents for each supplier
      const { data: docsData } = await supabase
        .from('supplier_documents')
        .select('*')
        .in('supplier_id', supplierIds);

      const docsBySupplier: Record<string, any[]> = {};
      (docsData || []).forEach((d) => {
        if (d.supplier_id) {
          docsBySupplier[d.supplier_id] = docsBySupplier[d.supplier_id] || [];
          docsBySupplier[d.supplier_id].push(d);
        }
      });

      // 4. Query candidates for each supplier
      const { data: candsData } = await supabase
        .from('candidates')
        .select('id, supplier_id, status, created_at')
        .in('supplier_id', supplierIds);

      const candsBySupplier: Record<string, any[]> = {};
      const allCandIds: string[] = [];
      (candsData || []).forEach((c) => {
        if (c.supplier_id) {
          candsBySupplier[c.supplier_id] = candsBySupplier[c.supplier_id] || [];
          candsBySupplier[c.supplier_id].push(c);
          allCandIds.push(c.id);
        }
      });

      // 5. Query active cooling periods for these candidates
      const coolingMap: Record<string, boolean> = {};
      if (allCandIds.length > 0) {
        const { data: coolingData } = await supabase
          .from('cooling_periods')
          .select('candidate_id, status, ends_at')
          .in('candidate_id', allCandIds)
          .eq('status', 'active')
          .gt('ends_at', new Date().toISOString());

        (coolingData || []).forEach((cp) => {
          if (cp.candidate_id) {
            coolingMap[cp.candidate_id] = true;
          }
        });
      }

      const nowTime = Date.now();
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

      // 6. Build SupplierRow objects with computed Health
      const rows: SupplierRow[] = validAssignments.map((a: any) => {
        const s: SupplierData = a.suppliers;
        const supDocs = docsBySupplier[s.id] || [];
        const supCands = candsBySupplier[s.id] || [];

        const verifiedDocsCount = supDocs.filter((d) => d.status === 'verified').length;
        const hasRejectedDoc = supDocs.some((d) => d.status === 'rejected');

        // Check if any candidate of this supplier has active cooling period
        const hasActiveCoolingPeriod = supCands.some((c) => coolingMap[c.id]);

        // Check if candidates stalled > 7 days (status not interview_ready or placed, and created_at > 7 days ago)
        const hasStalledCandidates = supCands.some((c) => {
          const isFinished = c.status === 'interview_ready' || c.status === 'placed';
          if (isFinished) return false;
          const createdTime = new Date(c.created_at).getTime();
          return nowTime - createdTime > sevenDaysMs;
        });

        // Health calculation:
        // Red "Action Required": rejected docs OR DT cooling period active
        // Amber "Attention": missing compliance docs (< 5 verified) OR candidates stalled > 7 days
        // Green "Good": all 5 compliance docs verified AND no stalled candidates
        let health: 'good' | 'attention' | 'action_required' = 'good';
        if (hasRejectedDoc || hasActiveCoolingPeriod) {
          health = 'action_required';
        } else if (verifiedDocsCount < 5 || hasStalledCandidates) {
          health = 'attention';
        } else {
          health = 'good';
        }

        return {
          assignmentId: a.id,
          rmSince: a.created_at,
          notes: a.notes || '',
          supplier: s,
          teamMembersCount: teamCountMap[s.id] || 0,
          totalCandidates: supCands.length,
          interviewReadyCount: supCands.filter((c) => c.status === 'interview_ready').length,
          verifiedDocsCount,
          hasRejectedDoc,
          hasActiveCoolingPeriod,
          hasStalledCandidates,
          health,
        };
      });

      setSuppliers(rows);
    } catch (err: any) {
      console.error('Error fetching Candidate RM suppliers:', err);
      showToast(err.message || 'Failed to load assigned suppliers.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMySuppliers();
  }, [user]);

  // Open Drawer and load supplier's documents, team, and candidates
  const handleOpenDetail = async (row: SupplierRow, initialTab: 'overview' | 'compliance' | 'team' | 'candidates' | 'notes' = 'overview') => {
    setSelectedSupplierRow(row);
    setDrawerTab(initialTab);
    setRmNotes(row.notes || '');
    setDrawerLoading(true);

    try {
      const supplierId = row.supplier.id;

      // 1. Fetch compliance documents
      const { data: docs } = await supabase
        .from('supplier_documents')
        .select('*')
        .eq('supplier_id', supplierId);

      // Normalize with templates so all 5 documents always appear
      const existingDocs = docs || [];
      const normalizedDocs: SupplierDocumentItem[] = MANDATORY_DOC_TEMPLATES.map((tmpl) => {
        const found = existingDocs.find((d) => d.document_type === tmpl.type);
        if (found) {
          return {
            id: found.id,
            supplier_id: supplierId,
            document_type: tmpl.type,
            document_label: found.document_label || tmpl.label,
            file_url: found.file_url || null,
            status: found.status || 'not_uploaded',
            is_mandatory: true,
            notes: found.notes || tmpl.notes,
            verified_by: found.verified_by || null,
            verified_at: found.verified_at || null,
            rejection_reason: found.rejection_reason || null,
            uploaded_at: found.uploaded_at || null,
            created_at: found.created_at,
          };
        }
        return {
          id: `virtual-${tmpl.type}`,
          supplier_id: supplierId,
          document_type: tmpl.type,
          document_label: tmpl.label,
          file_url: null,
          status: 'not_uploaded',
          is_mandatory: true,
          notes: tmpl.notes,
          verified_by: null,
          verified_at: null,
          rejection_reason: null,
          uploaded_at: null,
        };
      });
      setPanelDocs(normalizedDocs);

      // 2. Fetch team members
      const { data: teamData } = await supabase
        .from('supplier_team_members')
        .select('id, profile_id, email, first_name, last_name, role, invite_status, created_at')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: true });

      setPanelTeam(teamData || []);

      // 3. Fetch candidates
      const { data: candsData } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, target_role, status, created_at')
        .eq('supplier_id', supplierId)
        .order('created_at', { ascending: false });

      setPanelCandidates(candsData || []);
    } catch (err: any) {
      console.error('Error opening supplier detail drawer:', err);
      showToast('Failed to load supplier details.', 'error');
    } finally {
      setDrawerLoading(false);
    }
  };

  // Document preview
  const handleViewDoc = async (fileUrl: string) => {
    try {
      if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
        window.open(fileUrl, '_blank');
        return;
      }
      const { data, error } = await supabase.storage
        .from('supplier-documents')
        .createSignedUrl(fileUrl, 300);

      if (error || !data?.signedUrl) {
        showToast('Could not generate document preview link.', 'error');
        return;
      }
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error('Error viewing document:', err);
      showToast('Failed to open document file.', 'error');
    }
  };

  // Helper to notify supplier team members
  const notifySupplier = async (supplierId: string, title: string, message: string) => {
    if (!user) return;
    try {
      const { data: teamMembers } = await supabase
        .from('supplier_team_members')
        .select('profile_id')
        .eq('supplier_id', supplierId)
        .eq('invite_status', 'accepted');

      const { data: supplierRecord } = await supabase
        .from('suppliers')
        .select('user_id')
        .eq('id', supplierId)
        .maybeSingle();

      const recipientIds = new Set<string>();
      (teamMembers || []).forEach((tm) => {
        if (tm.profile_id) recipientIds.add(tm.profile_id);
      });
      if (supplierRecord?.user_id) {
        recipientIds.add(supplierRecord.user_id);
      }

      if (recipientIds.size > 0) {
        const notifications = Array.from(recipientIds).map((pId) => ({
          user_id: pId,
          title,
          message,
          type: 'general',
          read: false,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifications);
      }
    } catch (err) {
      console.error('Error notifying supplier:', err);
    }
  };

  // Verify Document (Part 5)
  const handleVerifyDocument = async (doc: SupplierDocumentItem) => {
    if (!user || !selectedSupplierRow) return;

    try {
      setVerifyingDocId(doc.id);
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('supplier_documents')
        .update({
          status: 'verified',
          verified_by: user.id,
          verified_at: nowIso,
          rejection_reason: null,
        })
        .eq('id', doc.id);

      if (error) throw error;

      // Notify supplier
      await notifySupplier(
        selectedSupplierRow.supplier.id,
        'Compliance Document Verified',
        `${doc.document_label} has been verified by your account manager.`
      );

      showToast(`${doc.document_label} verified.`);

      // Update local state
      setPanelDocs((prev) =>
        prev.map((d) =>
          d.id === doc.id
            ? { ...d, status: 'verified', verified_by: user.id, verified_at: nowIso, rejection_reason: null }
            : d
        )
      );

      // Refresh parent table
      fetchMySuppliers();
    } catch (err: any) {
      console.error('Error verifying document:', err);
      showToast(err.message || 'Failed to verify document.', 'error');
    } finally {
      setVerifyingDocId(null);
    }
  };

  // Open Reject Modal (Part 5)
  const handleOpenRejectModal = (doc: SupplierDocumentItem) => {
    setRejectingDoc(doc);
    setRejectReason('');
  };

  // Confirm Reject Document (Part 5)
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedSupplierRow || !rejectingDoc) return;

    if (!rejectReason.trim()) {
      showToast('Provide a rejection reason.', 'error');
      return;
    }

    try {
      setRejectLoading(true);
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('supplier_documents')
        .update({
          status: 'rejected',
          rejection_reason: rejectReason.trim(),
          verified_by: user.id,
          verified_at: nowIso,
        })
        .eq('id', rejectingDoc.id);

      if (error) throw error;

      // Notify supplier
      await notifySupplier(
        selectedSupplierRow.supplier.id,
        'Compliance Document Rejected',
        `${rejectingDoc.document_label} was not accepted. Reason: ${rejectReason.trim()}. Re-upload the correct document.`
      );

      showToast(`${rejectingDoc.document_label} rejected. Supplier notified.`);

      // Update local state
      setPanelDocs((prev) =>
        prev.map((d) =>
          d.id === rejectingDoc.id
            ? {
                ...d,
                status: 'rejected',
                rejection_reason: rejectReason.trim(),
                verified_by: user.id,
                verified_at: nowIso,
              }
            : d
        )
      );

      setRejectingDoc(null);
      setRejectReason('');

      // Refresh parent table
      fetchMySuppliers();
    } catch (err: any) {
      console.error('Error rejecting document:', err);
      showToast(err.message || 'Failed to reject document.', 'error');
    } finally {
      setRejectLoading(false);
    }
  };

  // Save RM Notes (Part 3)
  const handleSaveNotes = async () => {
    if (!user || !selectedSupplierRow) return;

    try {
      setSavingNotes(true);
      const { error } = await supabase
        .from('rm_assignments')
        .update({
          notes: rmNotes.trim() || null,
        })
        .eq('id', selectedSupplierRow.assignmentId);

      if (error) throw error;

      showToast('Internal notes saved successfully.');
      setSelectedSupplierRow((prev) => (prev ? { ...prev, notes: rmNotes.trim() } : null));

      // Refresh parent table state
      setSuppliers((prev) =>
        prev.map((r) =>
          r.assignmentId === selectedSupplierRow.assignmentId
            ? { ...r, notes: rmNotes.trim() }
            : r
        )
      );
    } catch (err: any) {
      console.error('Error saving RM notes:', err);
      showToast(err.message || 'Failed to save notes.', 'error');
    } finally {
      setSavingNotes(false);
    }
  };

  // Filtered suppliers
  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.supplier.company_name.toLowerCase().includes(q) ||
      s.supplier.company_type.toLowerCase().includes(q) ||
      s.supplier.tier.toLowerCase().includes(q) ||
      (s.supplier.country_of_operation || '').toLowerCase().includes(q)
    );
  });

  const verifiedDocsInPanel = panelDocs.filter((d) => d.status === 'verified').length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-[8px] text-xs font-semibold shadow-lg transition-all flex items-center space-x-2 ${
            toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          ) : (
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">
          Assigned Suppliers & Sourcing Partners
        </h1>
        <p className="text-xs text-[#4A5568] mt-0.5">
          Manage relationship, audit pipeline yield, verify compliance documentation, and log internal account notes.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search supplier name, company type, tier, country..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270]"
          />
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">
              No suppliers assigned
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              You do not have any active supplier assignments. Placement Lead will assign suppliers to your account management queue.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-[#4A5568] font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Company Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4 text-center">Candidates</th>
                  <th className="py-3 px-4 text-center">Interview Ready</th>
                  <th className="py-3 px-4">Compliance</th>
                  <th className="py-3 px-4">RM Since</th>
                  <th className="py-3 px-4">Health</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredSuppliers.map((row) => {
                  const s = row.supplier;

                  return (
                    <tr key={row.assignmentId} className="hover:bg-[#F8FAFD] transition-colors">
                      {/* Company Name */}
                      <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                        <div>{s.company_name}</div>
                        {s.country_of_operation && (
                          <div className="text-[11px] text-[#4A5568] font-normal flex items-center mt-0.5">
                            <MapPin className="w-3 h-3 text-slate-400 mr-1" />
                            <span>{s.country_of_operation}</span>
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3.5 px-4 text-[#4A5568] capitalize">
                        {s.company_type?.replace(/_/g, ' ') || 'Placement Agency'}
                      </td>

                      {/* Tier */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            s.tier === 'audited'
                              ? 'bg-purple-100 text-purple-800'
                              : s.tier === 'verified'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {s.tier?.toUpperCase() || 'BASIC'}
                        </span>
                      </td>

                      {/* Candidates count */}
                      <td className="py-3.5 px-4 text-center font-bold text-[#0F172A]">
                        {row.totalCandidates}
                      </td>

                      {/* Interview Ready */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {row.interviewReadyCount}
                        </span>
                      </td>

                      {/* Compliance */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5">
                          {row.verifiedDocsCount === 5 ? (
                            <span className="inline-flex items-center text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                              5/5 Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-slate-600 text-[11px]">
                              <FileText className="w-3.5 h-3.5 mr-1 text-slate-400" />
                              {row.verifiedDocsCount} of 5 Verified
                            </span>
                          )}
                        </div>
                      </td>

                      {/* RM Since */}
                      <td className="py-3.5 px-4 text-[#4A5568]">
                        {formatDate(row.rmSince)}
                      </td>

                      {/* Health Column */}
                      <td className="py-3.5 px-4">
                        {row.health === 'action_required' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mr-1.5 animate-pulse" />
                            Action Required
                          </span>
                        )}
                        {row.health === 'attention' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 mr-1.5" />
                            Attention
                          </span>
                        )}
                        {row.health === 'good' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5" />
                            Good
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(row)}
                          className="px-3 py-1.5 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-[#1B3270] rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs inline-flex items-center space-x-1.5 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
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

      {/* ==================================================== */}
      {/* SUPPLIER DETAIL PANEL (RM VIEW) */}
      {/* ==================================================== */}
      {selectedSupplierRow && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-[#0F172A]">
                    {selectedSupplierRow.supplier.company_name}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedSupplierRow.supplier.tier === 'audited'
                        ? 'bg-purple-100 text-purple-800'
                        : selectedSupplierRow.supplier.tier === 'verified'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {selectedSupplierRow.supplier.tier?.toUpperCase() || 'BASIC'}
                  </span>
                </div>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  {selectedSupplierRow.supplier.company_type?.replace(/_/g, ' ')} • Account Manager since {formatDate(selectedSupplierRow.rmSince)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSupplierRow(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-[#E2E8F4] bg-white px-5 space-x-6 text-xs font-semibold overflow-x-auto">
              <button
                type="button"
                onClick={() => setDrawerTab('overview')}
                className={`py-3 border-b-2 cursor-pointer transition-colors whitespace-nowrap ${
                  drawerTab === 'overview'
                    ? 'border-[#1B3270] text-[#1B3270]'
                    : 'border-transparent text-[#4A5568] hover:text-[#0F172A]'
                }`}
              >
                Company Info
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('compliance')}
                className={`py-3 border-b-2 cursor-pointer transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                  drawerTab === 'compliance'
                    ? 'border-[#1B3270] text-[#1B3270]'
                    : 'border-transparent text-[#4A5568] hover:text-[#0F172A]'
                }`}
              >
                <span>Compliance & Documents</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                  {verifiedDocsInPanel}/5
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('candidates')}
                className={`py-3 border-b-2 cursor-pointer transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                  drawerTab === 'candidates'
                    ? 'border-[#1B3270] text-[#1B3270]'
                    : 'border-transparent text-[#4A5568] hover:text-[#0F172A]'
                }`}
              >
                <span>Candidates</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                  {panelCandidates.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('team')}
                className={`py-3 border-b-2 cursor-pointer transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                  drawerTab === 'team'
                    ? 'border-[#1B3270] text-[#1B3270]'
                    : 'border-transparent text-[#4A5568] hover:text-[#0F172A]'
                }`}
              >
                <span>Team</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-700 font-bold">
                  {panelTeam.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab('notes')}
                className={`py-3 border-b-2 cursor-pointer transition-colors whitespace-nowrap flex items-center space-x-1.5 ${
                  drawerTab === 'notes'
                    ? 'border-[#1B3270] text-[#1B3270]'
                    : 'border-transparent text-[#4A5568] hover:text-[#0F172A]'
                }`}
              >
                <span>Internal Notes</span>
                {selectedSupplierRow.notes && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1B3270]" />
                )}
              </button>
            </div>

            {/* Panel Body */}
            <div className="p-6 overflow-y-auto flex-1 text-xs space-y-6">
              {drawerLoading ? (
                <div className="py-16 text-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1B3270] mx-auto" />
                  <p className="text-slate-500">Loading supplier records...</p>
                </div>
              ) : (
                <>
                  {/* ==================================================== */}
                  {/* TAB 1: OVERVIEW & COMPANY INFO */}
                  {/* ==================================================== */}
                  {drawerTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Key Stats Summary */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] text-center">
                          <span className="text-[11px] text-[#4A5568] block">Total Sourced</span>
                          <span className="text-base font-bold text-[#0F172A] mt-0.5 block">
                            {panelCandidates.length}
                          </span>
                        </div>
                        <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-[8px] text-center">
                          <span className="text-[11px] text-emerald-800 block">Interview Ready</span>
                          <span className="text-base font-bold text-emerald-900 mt-0.5 block">
                            {selectedSupplierRow.interviewReadyCount}
                          </span>
                        </div>
                        <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-[8px] text-center">
                          <span className="text-[11px] text-blue-800 block">Compliance</span>
                          <span className="text-base font-bold text-blue-900 mt-0.5 block">
                            {verifiedDocsInPanel}/5 Verified
                          </span>
                        </div>
                      </div>

                      {/* Company Info Read-Only */}
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3.5">
                        <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                          Company Profile (Read-Only)
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[11px] text-[#4A5568] block">Registration Number</span>
                            <span className="font-semibold text-[#0F172A] mt-0.5 block">
                              {selectedSupplierRow.supplier.registration_number || '—'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] text-[#4A5568] block">Year Established</span>
                            <span className="font-semibold text-[#0F172A] mt-0.5 block">
                              {selectedSupplierRow.supplier.year_established || '—'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] text-[#4A5568] block">Country of Operation</span>
                            <span className="font-semibold text-[#0F172A] mt-0.5 block">
                              {selectedSupplierRow.supplier.country_of_operation || '—'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] text-[#4A5568] block">Website</span>
                            {selectedSupplierRow.supplier.website_url ? (
                              <a
                                href={
                                  selectedSupplierRow.supplier.website_url.startsWith('http')
                                    ? selectedSupplierRow.supplier.website_url
                                    : `https://${selectedSupplierRow.supplier.website_url}`
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-[#1B3270] hover:underline mt-0.5 inline-flex items-center space-x-1"
                              >
                                <span>{selectedSupplierRow.supplier.website_url}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="font-semibold text-[#0F172A] mt-0.5 block">—</span>
                            )}
                          </div>
                        </div>

                        {selectedSupplierRow.supplier.description && (
                          <div className="pt-2 border-t border-[#E2E8F4]">
                            <span className="text-[11px] text-[#4A5568] block mb-1">Company Description</span>
                            <p className="text-[#0F172A] leading-relaxed bg-[#F8FAFD] p-2.5 rounded-[6px]">
                              {selectedSupplierRow.supplier.description}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Contact & Address */}
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3.5">
                        <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                          Primary Contact & Office
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[11px] text-[#4A5568] block">Contact Person</span>
                            <span className="font-semibold text-[#0F172A] mt-0.5 block">
                              {selectedSupplierRow.supplier.primary_contact_name || '—'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[11px] text-[#4A5568] block">Phone</span>
                            <span className="font-semibold text-[#0F172A] mt-0.5 block">
                              {selectedSupplierRow.supplier.primary_contact_phone || '—'}
                            </span>
                          </div>

                          <div className="col-span-2">
                            <span className="text-[11px] text-[#4A5568] block">Office Address</span>
                            <span className="font-semibold text-[#0F172A] mt-0.5 block">
                              {selectedSupplierRow.supplier.office_address || '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Focus Roles & Source Countries */}
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3">
                        <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                          Sourcing Specialisation
                        </h4>

                        <div>
                          <span className="text-[11px] text-[#4A5568] block mb-1.5">Healthcare Roles Focus</span>
                          <div className="flex flex-wrap gap-1.5">
                            {(selectedSupplierRow.supplier.healthcare_roles_focus || []).length > 0 ? (
                              selectedSupplierRow.supplier.healthcare_roles_focus!.map((role, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-800"
                                >
                                  {role}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">No roles specified.</span>
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-[#E2E8F4]">
                          <span className="text-[11px] text-[#4A5568] block mb-1.5">Source Countries</span>
                          <div className="flex flex-wrap gap-1.5">
                            {(selectedSupplierRow.supplier.source_countries || []).length > 0 ? (
                              selectedSupplierRow.supplier.source_countries!.map((country, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#1B3270]/10 text-[#1B3270]"
                                >
                                  {country}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">No countries specified.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ==================================================== */}
                  {/* TAB 2: COMPLIANCE & DOCUMENTS (PART 3 & PART 5) */}
                  {/* ==================================================== */}
                  {drawerTab === 'compliance' && (
                    <div className="space-y-6">
                      {/* Statutory Declarations */}
                      <div className="p-4 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] space-y-3">
                        <span className="text-[11px] font-bold text-[#4A5568] uppercase tracking-wider block">
                          Compliance Declarations Status
                        </span>

                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between p-2.5 bg-white border border-[#E2E8F4] rounded-[6px]">
                            <div>
                              <span className="font-semibold text-[#0F172A] block">
                                Faire Anwerbung Pflege Deutschland Standard
                              </span>
                              <span className="text-[11px] text-[#4A5568]">
                                Statutory ethical German nursing recruitment code.
                              </span>
                              {selectedSupplierRow.supplier.compliance_declared_at && (
                                <span className="text-[10px] text-emerald-700 block mt-0.5">
                                  Declared on {formatDate(selectedSupplierRow.supplier.compliance_declared_at)}
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                selectedSupplierRow.supplier.compliance_declared
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {selectedSupplierRow.supplier.compliance_declared ? 'Declared' : 'Missing'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-white border border-[#E2E8F4] rounded-[6px]">
                            <div>
                              <span className="font-semibold text-[#0F172A] block">
                                Zero-Fee Candidate Policy (Employer-Pays)
                              </span>
                              <span className="text-[11px] text-[#4A5568]">
                                Candidate protection against placement or visa fees.
                              </span>
                              {selectedSupplierRow.supplier.no_fee_policy_confirmed_at && (
                                <span className="text-[10px] text-emerald-700 block mt-0.5">
                                  Confirmed on {formatDate(selectedSupplierRow.supplier.no_fee_policy_confirmed_at)}
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                selectedSupplierRow.supplier.no_fee_policy_confirmed
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {selectedSupplierRow.supplier.no_fee_policy_confirmed ? 'Confirmed' : 'Missing'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 5 Compliance Documents (Part 5) */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                              Compliance Documents (Audit & Verification)
                            </h4>
                            <p className="text-[11px] text-[#4A5568] mt-0.5">
                              {verifiedDocsInPanel} of 5 compliance documents verified.
                            </p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                              verifiedDocsInPanel === 5
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            {verifiedDocsInPanel === 5 ? 'Fully Compliant' : 'Audit In Progress'}
                          </span>
                        </div>

                        <div className="space-y-3">
                          {panelDocs.map((doc) => {
                            const isPending = doc.status === 'pending' || doc.status === 'under_review';
                            const isVerifying = verifyingDocId === doc.id;

                            return (
                              <div
                                key={doc.document_type}
                                className="p-4 bg-white border border-[#E2E8F4] rounded-[8px] space-y-3 hover:border-slate-300 transition-colors"
                              >
                                {/* Doc Header */}
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-bold text-[#0F172A] text-xs">
                                        {doc.document_label}
                                      </span>
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                        Mandatory
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-[#4A5568] mt-0.5">
                                      {doc.notes}
                                    </p>
                                  </div>

                                  {/* Status Badge */}
                                  <div>
                                    {doc.status === 'verified' && (
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center space-x-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Verified</span>
                                      </span>
                                    )}
                                    {isPending && (
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center space-x-1">
                                        <Clock className="w-3 h-3 text-amber-600" />
                                        <span>Pending Review</span>
                                      </span>
                                    )}
                                    {doc.status === 'rejected' && (
                                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center space-x-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                                        <span>Rejected</span>
                                      </span>
                                    )}
                                    {doc.status === 'not_uploaded' && (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500">
                                        Not uploaded yet
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Status Details / Timestamp */}
                                {doc.status === 'verified' && doc.verified_at && (
                                  <div className="text-[11px] text-emerald-700 font-medium bg-emerald-50/50 px-2.5 py-1 rounded">
                                    Verified on {formatDate(doc.verified_at)}
                                  </div>
                                )}

                                {doc.status === 'rejected' && doc.rejection_reason && (
                                  <div className="text-[11px] text-rose-700 font-medium bg-rose-50/60 p-2 rounded border border-rose-200">
                                    Rejected: {doc.rejection_reason}. Awaiting re-upload.
                                  </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F4]">
                                  <div>
                                    {doc.file_url ? (
                                      <button
                                        type="button"
                                        onClick={() => handleViewDoc(doc.file_url!)}
                                        className="text-xs font-semibold text-[#1B3270] hover:underline inline-flex items-center space-x-1 cursor-pointer"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        <span>View Document</span>
                                      </button>
                                    ) : (
                                      <span className="text-[11px] text-slate-400 italic">
                                        No file attached
                                      </span>
                                    )}
                                  </div>

                                  {/* Verify / Reject Buttons for Pending Docs */}
                                  {doc.file_url && isPending && (
                                    <div className="flex items-center space-x-2">
                                      <button
                                        type="button"
                                        disabled={isVerifying}
                                        onClick={() => handleVerifyDocument(doc)}
                                        className="px-3 py-1 bg-white border border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-[6px] text-xs font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center space-x-1"
                                      >
                                        {isVerifying ? (
                                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                          <Check className="w-3.5 h-3.5" />
                                        )}
                                        <span>Verify</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenRejectModal(doc)}
                                        className="px-3 py-1 bg-white border border-rose-600 text-rose-700 hover:bg-rose-50 rounded-[6px] text-xs font-semibold cursor-pointer transition-colors shadow-2xs inline-flex items-center space-x-1"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        <span>Reject</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ==================================================== */}
                  {/* TAB 3: CANDIDATES */}
                  {/* ==================================================== */}
                  {drawerTab === 'candidates' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                            Candidates Pipeline ({panelCandidates.length})
                          </h4>
                          <p className="text-[11px] text-[#4A5568] mt-0.5">
                            Direct recruitment pipeline sourced by {selectedSupplierRow.supplier.company_name}.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSearchParams({
                              tab: 'my_candidates',
                              search: selectedSupplierRow.supplier.company_name,
                            });
                          }}
                          className="px-3 py-1.5 bg-[#1B3270] text-white hover:bg-[#2952A3] rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs inline-flex items-center space-x-1.5 transition-colors"
                        >
                          <span>Open in My Candidates</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {panelCandidates.length === 0 ? (
                        <div className="p-8 text-center bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px]">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-semibold text-slate-700 text-xs">No candidates registered</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            This supplier has not submitted any candidates to the pipeline yet.
                          </p>
                        </div>
                      ) : (
                        <div className="border border-[#E2E8F4] rounded-[8px] overflow-hidden divide-y divide-[#E2E8F4] bg-white">
                          {panelCandidates.map((c) => (
                            <div
                              key={c.id}
                              className="p-3.5 flex items-center justify-between hover:bg-[#F8FAFD] transition-colors"
                            >
                              <div>
                                <span className="font-bold text-[#0F172A] text-xs block">
                                  {c.first_name} {c.last_name}
                                </span>
                                <span className="text-[11px] text-[#4A5568]">
                                  Role: {c.target_role || 'General Healthcare'} • Added {formatDate(c.created_at)}
                                </span>
                              </div>

                              <div className="flex items-center space-x-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    c.status === 'interview_ready'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : c.status === 'placed'
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {c.status.replace(/_/g, ' ').toUpperCase()}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSearchParams({
                                      tab: 'my_candidates',
                                      search: `${c.first_name} ${c.last_name}`.trim(),
                                    });
                                  }}
                                  className="text-xs font-semibold text-[#1B3270] hover:underline"
                                >
                                  View &rarr;
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ==================================================== */}
                  {/* TAB 4: TEAM MEMBERS */}
                  {/* ==================================================== */}
                  {drawerTab === 'team' && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                          Supplier Team Roster ({panelTeam.length})
                        </h4>
                        <p className="text-[11px] text-[#4A5568] mt-0.5">
                          Registered recruiters, admin coordinators, and account representatives.
                        </p>
                      </div>

                      {panelTeam.length === 0 ? (
                        <div className="p-8 text-center bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px]">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-semibold text-slate-700 text-xs">No team members</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            No team member invitations found for this supplier.
                          </p>
                        </div>
                      ) : (
                        <div className="border border-[#E2E8F4] rounded-[8px] overflow-hidden divide-y divide-[#E2E8F4] bg-white">
                          {panelTeam.map((tm) => (
                            <div
                              key={tm.id}
                              className="p-3.5 flex items-center justify-between hover:bg-[#F8FAFD] transition-colors"
                            >
                              <div>
                                <span className="font-bold text-[#0F172A] text-xs block">
                                  {tm.first_name} {tm.last_name}
                                </span>
                                <span className="text-[11px] text-[#4A5568]">
                                  {tm.email}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                                  {tm.role}
                                </span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    tm.invite_status === 'accepted'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {tm.invite_status === 'accepted' ? 'Active' : 'Pending Invite'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ==================================================== */}
                  {/* TAB 5: RM INTERNAL NOTES */}
                  {/* ==================================================== */}
                  {drawerTab === 'notes' && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                          Internal Relationship Notes (RM Only)
                        </h4>
                        <p className="text-[11px] text-[#4A5568] mt-0.5">
                          Confidential notes regarding relationship status, candidate quality, compliance blockers, and meeting minutes. Only visible to internal Placement and Partnerships teams.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <textarea
                          rows={8}
                          value={rmNotes}
                          onChange={(e) => setRmNotes(e.target.value)}
                          placeholder="Record notes about this supplier, e.g.:&#10;- Key contact person & availability&#10;- Candidate sourcing regions & bottlenecks&#10;- Compliance document status discussions&#10;- Action items from check-in calls..."
                          className="w-full p-3 text-xs border border-[#E2E8F4] rounded-[8px] focus:outline-none focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] text-[#0F172A] placeholder-slate-400 leading-relaxed resize-y"
                        />

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-[#4A5568]">
                            Stored on account manager assignment record.
                          </span>

                          <button
                            type="button"
                            disabled={savingNotes}
                            onClick={handleSaveNotes}
                            className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs inline-flex items-center space-x-1.5 transition-colors"
                          >
                            {savingNotes ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            <span>Save Notes</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Panel Footer */}
            <div className="p-4 border-t border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between">
              <span className="text-[11px] text-[#4A5568]">
                Supplier ID: {selectedSupplierRow.supplier.id.slice(0, 8)}...
              </span>
              <button
                type="button"
                onClick={() => setSelectedSupplierRow(null)}
                className="px-4 py-2 bg-white border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-[#0F172A] hover:bg-slate-100 cursor-pointer shadow-2xs"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* REJECT COMPLIANCE DOCUMENT MODAL (PART 5) */}
      {/* ==================================================== */}
      {rejectingDoc && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-md w-full shadow-2xl p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#0F172A]">
                  Reject Compliance Document
                </h3>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  {rejectingDoc.document_label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingDoc(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Rejection Reason *
                </label>
                <textarea
                  required
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this document is being rejected (e.g. expired license, illegible scan, missing stamp or signature) so the supplier can correct it..."
                  className="w-full p-2.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600 text-[#0F172A]"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-[6px] border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
                The supplier will be notified immediately of this rejection with your note and requested to re-upload the corrected document.
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingDoc(null)}
                  className="px-3.5 py-2 bg-white border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-[#4A5568] hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejectLoading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs inline-flex items-center space-x-1.5"
                >
                  {rejectLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  <span>Reject & Notify Supplier</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CandidateRmSuppliersTab;
