import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  Building2,
  Search,
  Eye,
  X,
  ShieldCheck,
  ExternalLink,
  Loader2,
  Check,
  Users,
  FileCheck,
  CheckSquare,
  ArrowLeft,
  UserCheck,
  Trash2,
} from 'lucide-react';
import { getGateLabel, getCandidateStatusLabel } from '../../../utils/labels';
import { CandidateProfileDetailView } from '../components/CandidateProfileDetailView';
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';
import { syncSupplierCandidatesRm } from '../../../utils/rmAssignmentUtils';

interface SupplierRow {
  id: string;
  user_id: string | null;
  company_name: string;
  company_type: string;
  tier: string;
  compliance_declared: boolean;
  no_fee_policy_confirmed: boolean;
  registration_number: string | null;
  country_of_operation?: string | null;
  website_url?: string | null;
  year_established?: number | null;
  primary_contact_name?: string | null;
  primary_contact_phone?: string | null;
  office_address?: string | null;
  created_at: string;
  contact_name?: string;
  contact_email?: string;
  rm_name?: string;
  rm_profile_id?: string;
  rm_assignment_id?: string;
  candidate_count: number;
  team_members_count: number;
  verified_docs_count: number;
  onboarding_completed_count: number;
  bulk_uploads_count: number;
  onboarding_checklist?: any;
}

interface RMOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  internal_role: string;
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
  document_label?: string;
  file_name: string;
  file_url: string | null;
  verification_status: 'verified' | 'rejected' | 'pending' | string;
  verified_at: string | null;
  uploaded_at: string | null;
  rejection_reason?: string | null;
}

interface ScopedCandidateItem {
  id: string;
  first_name: string;
  last_name: string;
  target_role: string | null;
  status: string;
  created_at: string;
  user_id: string | null;
  supplier_id: string | null;
  language_level_self_reported: string | null;
  dt_attempt_count: number | null;
  profile_completion_pct: number | null;
  profiles?: {
    email?: string | null;
    phone?: string | null;
  } | null;
}

interface OverviewStats {
  candidates: number;
  interviewReady: number;
  submissions: number;
  placements: number;
}

interface SuppliersTabProps {
  onNavigateCandidatesWithFilter?: (supplierName: string) => void;
}

const REQUIRED_DOC_TYPES = [
  { key: 'agency_license', label: 'Agency / Academy Accreditation License' },
  { key: 'no_fee_policy', label: 'Zero Placement Fee Policy Agreement' },
  { key: 'tax_certificate', label: 'Commercial Tax Registration Certificate' },
  { key: 'curriculum_proof', label: 'Nursing Curriculum / Training Proof' },
  { key: 'data_protection', label: 'Data Privacy & GDPR Agreement' },
];

export const SuppliersTab: React.FC<SuppliersTabProps> = ({
  onNavigateCandidatesWithFilter: _onNavigateCandidatesWithFilter,
}) => {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [rmOptions, setRmOptions] = useState<RMOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilters, setTierFilters] = useState<string[]>([]);
  const [countryFilters, setCountryFilters] = useState<string[]>([]);
  const [rmFilter, setRmFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [supplierToDelete, setSupplierToDelete] = useState<SupplierRow | null>(null);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);

  // Side Panel / Detail state
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRow | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'candidates' | 'compliance' | 'team'>('overview');
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tab 1: Overview state
  const [overviewStats, setOverviewStats] = useState<OverviewStats>({
    candidates: 0,
    interviewReady: 0,
    submissions: 0,
    placements: 0,
  });

  // Tab 2: Candidates state
  const [tabCandidates, setTabCandidates] = useState<ScopedCandidateItem[]>([]);
  const [latestGateMap, setLatestGateMap] = useState<Record<string, string>>({});
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<
    'all' | 'onboarding' | 'in_progress' | 'interview_ready' | 'placed'
  >('all');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // Tab 3: Compliance state
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocItem[]>([]);
  const [rejectDocModal, setRejectDocModal] = useState<{
    open: boolean;
    doc: ComplianceDocItem | null;
    reason: string;
  }>({
    open: false,
    doc: null,
    reason: '',
  });
  const [rejectingDoc, setRejectingDoc] = useState(false);

  // Tab 4: Team state
  const [teamMembers, setTeamMembers] = useState<TeamMemberItem[]>([]);

  // Assign RM Modal state
  const [rmAssignModalOpen, setRmAssignModalOpen] = useState(false);
  const [selectedAssignRmId, setSelectedAssignRmId] = useState('');
  const [assigningRm, setAssigningRm] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      // 1. Fetch internal team eligible for RM assignment
      const { data: teamData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, internal_role')
        .eq('is_internal', true)
        .in('internal_role', [
          'candidate_supplier_rm',
          'supplier_partnerships_associate',
          'partnerships_lead',
          'super_admin',
        ]);
      if (teamData) {
        setRmOptions(teamData as RMOption[]);
      }

      // 2. Fetch suppliers joined with profile
      const { data: supData, error: supErr } = await supabase
        .from('suppliers')
        .select(`
          id,
          user_id,
          company_name,
          company_type,
          tier,
          compliance_declared,
          no_fee_policy_confirmed,
          registration_number,
          country_of_operation,
          website_url,
          year_established,
          primary_contact_name,
          primary_contact_phone,
          office_address,
          created_at,
          onboarding_checklist,
          profiles:user_id (first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (supErr) throw supErr;

      // 3. Fetch active RM assignments for suppliers
      const { data: rmData } = await supabase
        .from('rm_assignments')
        .select(`
          id,
          entity_id,
          rm_profile_id,
          profiles:rm_profile_id (first_name, last_name, email)
        `)
        .eq('entity_type', 'supplier')
        .eq('active', true);

      const rmMap: Record<string, { id: string; rm_id: string; name: string }> = {};
      if (rmData) {
        rmData.forEach((item: any) => {
          if (item.entity_id) {
            const p = item.profiles;
            const name = p
              ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email
              : 'Assigned RM';
            rmMap[item.entity_id] = {
              id: item.id,
              rm_id: item.rm_profile_id,
              name,
            };
          }
        });
      }

      // 4. Global counts for table overview
      const [allTeams, allDocs, allUploads, allCands] = await Promise.all([
        supabase.from('supplier_team_members').select('id, supplier_id'),
        supabase.from('supplier_documents').select('id, supplier_id, status, verification_status'),
        supabase.from('supplier_bulk_uploads').select('id, supplier_id'),
        supabase.from('candidates').select('id, supplier_id'),
      ]);

      const teamCountMap: Record<string, number> = {};
      (allTeams.data || []).forEach((t: any) => {
        teamCountMap[t.supplier_id] = (teamCountMap[t.supplier_id] || 0) + 1;
      });

      const docsCountMap: Record<string, number> = {};
      (allDocs.data || []).forEach((d: any) => {
        const isVerified = d.status === 'verified' || d.verification_status === 'verified';
        if (isVerified) {
          docsCountMap[d.supplier_id] = (docsCountMap[d.supplier_id] || 0) + 1;
        }
      });

      const uploadsCountMap: Record<string, number> = {};
      (allUploads.data || []).forEach((u: any) => {
        uploadsCountMap[u.supplier_id] = (uploadsCountMap[u.supplier_id] || 0) + 1;
      });

      const candCountMap: Record<string, number> = {};
      (allCands.data || []).forEach((c: any) => {
        if (c.supplier_id) {
          candCountMap[c.supplier_id] = (candCountMap[c.supplier_id] || 0) + 1;
        }
      });

      const rows: SupplierRow[] = (supData || []).map((s: any) => {
        const contact = s.profiles;
        const contactName = contact
          ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Supplier Contact'
          : '—';
        const contactEmail = contact?.email || '—';

        const rmInfo = rmMap[s.id];

        // Onboarding steps completed (out of 5)
        const checklist = s.onboarding_checklist || {};
        const steps = [
          Boolean(s.user_id),
          (docsCountMap[s.id] || 0) > 0,
          Boolean(s.compliance_declared),
          (teamCountMap[s.id] || 0) > 0 || Boolean(checklist.team_invited),
          Boolean(rmInfo),
        ];
        const completedSteps = steps.filter(Boolean).length;

        return {
          id: s.id,
          user_id: s.user_id,
          company_name: s.company_name,
          company_type: s.company_type || 'placement_agency',
          tier: s.tier || 'basic',
          compliance_declared: s.compliance_declared ?? false,
          no_fee_policy_confirmed: s.no_fee_policy_confirmed ?? false,
          registration_number: s.registration_number,
          country_of_operation: s.country_of_operation,
          website_url: s.website_url,
          year_established: s.year_established,
          primary_contact_name: s.primary_contact_name,
          primary_contact_phone: s.primary_contact_phone,
          office_address: s.office_address,
          created_at: s.created_at,
          contact_name: contactName,
          contact_email: contactEmail,
          rm_name: rmInfo?.name || 'Unassigned',
          rm_profile_id: rmInfo?.rm_id,
          rm_assignment_id: rmInfo?.id,
          candidate_count: candCountMap[s.id] || 0,
          team_members_count: teamCountMap[s.id] || 0,
          verified_docs_count: docsCountMap[s.id] || 0,
          onboarding_completed_count: completedSteps,
          bulk_uploads_count: uploadsCountMap[s.id] || 0,
          onboarding_checklist: s.onboarding_checklist,
        };
      });

      setSuppliers(rows);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Open side panel with scoped supplier data and preselected tab
  const handleOpenDetail = async (
    sup: SupplierRow,
    initialTab: 'overview' | 'candidates' | 'compliance' | 'team' = 'overview'
  ) => {
    setSelectedSupplier(sup);
    setActiveTab(initialTab);
    setSelectedCandidateId(null);
    setCandidateStatusFilter('all');
    setDrawerLoading(true);

    try {
      // Execute parallel queries STRICTLY SCOPED to this supplier id
      const [teamRes, docsRes, candRes, appRes, rmRes] = await Promise.all([
        // 1. Team members scoped to supplier_id
        supabase
          .from('supplier_team_members')
          .select('id, full_name, first_name, last_name, email, role, status, invite_status, created_at')
          .eq('supplier_id', sup.id)
          .order('created_at', { ascending: false }),

        // 2. Compliance documents scoped to supplier_id
        supabase
          .from('supplier_documents')
          .select('id, document_type, document_label, file_name, file_url, status, verification_status, verified_at, uploaded_at, created_at, rejection_reason')
          .eq('supplier_id', sup.id),

        // 3. Candidates strictly scoped to supplier_id
        supabase
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
            dt_attempt_count,
            profile_completion_pct,
            profiles:user_id (email, phone)
          `)
          .eq('supplier_id', sup.id)
          .order('created_at', { ascending: false }),

        // 4. Job applications strictly scoped to supplier_id
        supabase
          .from('job_applications')
          .select('id, status, candidate_id, supplier_id')
          .eq('supplier_id', sup.id),

        // 5. Active RM assignment joined with profiles
        supabase
          .from('rm_assignments')
          .select(`
            id,
            entity_id,
            rm_profile_id,
            profiles:rm_profile_id (id, first_name, last_name, email, internal_role)
          `)
          .eq('entity_type', 'supplier')
          .eq('entity_id', sup.id)
          .eq('active', true)
          .maybeSingle(),
      ]);

      // Set scoped candidates
      const rawCands = candRes.data || [];
      const mappedCands: ScopedCandidateItem[] = rawCands.map((c: any) => ({
        id: c.id,
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        target_role: c.target_role || null,
        status: c.status || 'onboarding',
        created_at: c.created_at,
        user_id: c.user_id,
        supplier_id: c.supplier_id,
        language_level_self_reported: c.language_level_self_reported,
        dt_attempt_count: c.dt_attempt_count ?? 0,
        profile_completion_pct: c.profile_completion_pct ?? 0,
        profiles: c.profiles,
      }));
      setTabCandidates(mappedCands);

      // Fetch latest gate results for these scoped candidates only
      const candIds = mappedCands.map((c) => c.id);
      const gateMap: Record<string, string> = {};
      if (candIds.length > 0) {
        const { data: gates } = await supabase
          .from('gate_results')
          .select('candidate_id, gate_type, status, created_at')
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        if (gates) {
          gates.forEach((g: any) => {
            if (!gateMap[g.candidate_id]) {
              gateMap[g.candidate_id] = g.gate_type;
            }
          });
        }
      }
      setLatestGateMap(gateMap);

      // Map scoped team members
      const mappedTeam: TeamMemberItem[] = (teamRes.data || []).map((m: any) => {
        const fullName =
          m.full_name ||
          `${m.first_name || ''} ${m.last_name || ''}`.trim() ||
          'Team Member';
        return {
          id: m.id,
          full_name: fullName,
          email: m.email || '—',
          role: m.role || 'member',
          status: m.status || m.invite_status || 'active',
          created_at: m.created_at || new Date().toISOString(),
        };
      });
      setTeamMembers(mappedTeam);

      // Map scoped compliance documents
      const mappedDocs: ComplianceDocItem[] = (docsRes.data || []).map((d: any) => ({
        id: d.id,
        document_type: d.document_type,
        document_label: d.document_label,
        file_name:
          d.file_name ||
          (d.file_url ? d.file_url.split('/').pop() || 'Uploaded Document' : 'Document File'),
        file_url: d.file_url,
        verification_status: d.status || d.verification_status || 'pending',
        verified_at: d.verified_at,
        uploaded_at: d.uploaded_at || d.created_at,
        rejection_reason: d.rejection_reason,
      }));
      setComplianceDocs(mappedDocs);

      // Scoped stats calculations
      const rawApps = appRes.data || [];
      const interviewReadyCount = mappedCands.filter((c) => c.status === 'interview_ready').length;
      const placedCandidatesCount = mappedCands.filter((c) => c.status === 'placed').length;
      const placedAppsCount = rawApps.filter((a: any) => a.status === 'placed').length;
      const finalPlacements = Math.max(placedCandidatesCount, placedAppsCount);

      setOverviewStats({
        candidates: mappedCands.length,
        interviewReady: interviewReadyCount,
        submissions: rawApps.length,
        placements: finalPlacements,
      });

      // Update active RM info
      if (rmRes.data && rmRes.data.profiles) {
        const activeRm = rmRes.data;
        const p = activeRm.profiles as any;
        const rmName = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
        const rmAssignmentId = activeRm.id;
        setSelectedSupplier((prev) =>
          prev
            ? {
                ...prev,
                rm_name: rmName,
                rm_profile_id: p.id,
                rm_assignment_id: rmAssignmentId,
              }
            : null
        );
      }
    } catch (err) {
      console.error('Error fetching supplier drawer detail:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  // Verify compliance document
  const handleVerifyDocument = async (docId: string) => {
    if (!user || !selectedSupplier) return;
    try {
      const { error } = await supabase
        .from('supplier_documents')
        .update({
          status: 'verified',
          verification_status: 'verified',
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', docId)
        .eq('supplier_id', selectedSupplier.id);

      if (error) throw error;

      setComplianceDocs((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                verification_status: 'verified',
                verified_at: new Date().toISOString(),
              }
            : d
        )
      );
      showToast('Document marked as verified.');
      fetchSuppliers();
    } catch (err: any) {
      console.error('Error verifying document:', err);
      alert(err.message || 'Failed to update document status.');
    }
  };

  // Reject compliance document with reason
  const handleConfirmReject = async () => {
    if (!user || !selectedSupplier || !rejectDocModal.doc) return;
    if (!rejectDocModal.reason.trim()) {
      alert('Please enter a rejection reason.');
      return;
    }
    setRejectingDoc(true);
    try {
      const { error } = await supabase
        .from('supplier_documents')
        .update({
          status: 'rejected',
          verification_status: 'rejected',
          rejection_reason: rejectDocModal.reason.trim(),
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        })
        .eq('id', rejectDocModal.doc.id)
        .eq('supplier_id', selectedSupplier.id);

      if (error) throw error;

      setComplianceDocs((prev) =>
        prev.map((d) =>
          d.id === rejectDocModal.doc!.id
            ? {
                ...d,
                verification_status: 'rejected',
                rejection_reason: rejectDocModal.reason.trim(),
                verified_at: new Date().toISOString(),
              }
            : d
        )
      );
      showToast('Document marked as rejected.');
      setRejectDocModal({ open: false, doc: null, reason: '' });
      fetchSuppliers();
    } catch (err: any) {
      console.error('Error rejecting document:', err);
      alert(err.message || 'Failed to reject document.');
    } finally {
      setRejectingDoc(false);
    }
  };

  // Tier update handler
  const handleTierChange = async (supplierId: string, newTier: string) => {
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({ tier: newTier })
        .eq('id', supplierId);

      if (error) throw error;

      setSuppliers((prev) =>
        prev.map((s) => (s.id === supplierId ? { ...s, tier: newTier } : s))
      );
      if (selectedSupplier?.id === supplierId) {
        setSelectedSupplier((prev) => (prev ? { ...prev, tier: newTier } : null));
      }
      showToast('Tier updated.');
    } catch (err: any) {
      alert(`Error updating tier: ${err.message}`);
    }
  };

  // Assign RM handler
  const handleAssignRm = async () => {
    if (!selectedSupplier || !user) return;
    setAssigningRm(true);
    try {
      // 1. Deactivate existing active assignment for this supplier
      if (selectedSupplier.rm_assignment_id) {
        await supabase
          .from('rm_assignments')
          .update({ active: false })
          .eq('id', selectedSupplier.rm_assignment_id);
      } else {
        await supabase
          .from('rm_assignments')
          .update({ active: false })
          .eq('entity_id', selectedSupplier.id)
          .eq('entity_type', 'supplier');
      }

      let updatedRmName = 'Unassigned';
      let updatedRmAssignmentId: string | undefined;

      if (selectedAssignRmId) {
        const { data: newAssign, error: assignErr } = await supabase
          .from('rm_assignments')
          .insert({
            entity_id: selectedSupplier.id,
            entity_type: 'supplier',
            rm_profile_id: selectedAssignRmId,
            assigned_by: user.id,
            active: true,
          })
          .select('id')
          .single();

        if (assignErr) throw assignErr;
        updatedRmAssignmentId = newAssign.id;
        const assignedRm = rmOptions.find((r) => r.id === selectedAssignRmId);
        updatedRmName = assignedRm
          ? `${assignedRm.first_name} ${assignedRm.last_name}`.trim() || assignedRm.email
          : 'Assigned RM';

        // Auto-assign or reassign supplier candidates
        const isReassignment = Boolean(selectedSupplier.rm_profile_id && selectedSupplier.rm_profile_id !== selectedAssignRmId);
        await syncSupplierCandidatesRm(
          supabase,
          selectedSupplier.id,
          selectedAssignRmId,
          isReassignment,
          user.id
        );
      }

      const updated = {
        ...selectedSupplier,
        rm_name: updatedRmName,
        rm_profile_id: selectedAssignRmId || undefined,
        rm_assignment_id: updatedRmAssignmentId,
      };

      setSuppliers((prev) => prev.map((s) => (s.id === selectedSupplier.id ? updated : s)));
      setSelectedSupplier(updated);
      setRmAssignModalOpen(false);
      showToast('Account Manager assigned.');
    } catch (err: any) {
      alert(`Error assigning RM: ${err.message}`);
    } finally {
      setAssigningRm(false);
    }
  };

  const tierOptions = useMemo(
    () => [
      { value: 'basic', label: 'Basic' },
      { value: 'verified', label: 'Verified' },
      { value: 'audited', label: 'Audited' },
    ],
    []
  );

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      if (s.country_of_operation && s.country_of_operation.trim()) {
        set.add(s.country_of_operation.trim());
      }
    });
    return Array.from(set)
      .sort()
      .map((c) => ({ value: c, label: c }));
  }, [suppliers]);

  const handleDeleteSupplierConfirm = async () => {
    if (!supplierToDelete) return;
    setIsDeletingSupplier(true);
    try {
      const { error } = await supabase.rpc('admin_delete_supplier', {
        p_supplier_id: supplierToDelete.id,
      });
      if (error) throw error;

      showToast('Supplier deleted.');
      setSupplierToDelete(null);
      if (selectedSupplier?.id === supplierToDelete.id) {
        setSelectedSupplier(null);
      }
      fetchSuppliers();
    } catch (err: any) {
      alert(`Failed to delete supplier: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeletingSupplier(false);
    }
  };

  // Filtered supplier rows in main table
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      if (
        q &&
        !s.company_name.toLowerCase().includes(q) &&
        !s.contact_name?.toLowerCase().includes(q) &&
        !s.contact_email?.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (tierFilters.length > 0 && !tierFilters.includes(s.tier)) {
        return false;
      }
      if (
        countryFilters.length > 0 &&
        (!s.country_of_operation || !countryFilters.includes(s.country_of_operation))
      ) {
        return false;
      }
      if (rmFilter === 'assigned' && (!s.rm_name || s.rm_name === 'Unassigned')) {
        return false;
      }
      if (rmFilter === 'unassigned' && s.rm_name && s.rm_name !== 'Unassigned') {
        return false;
      }
      return true;
    });
  }, [suppliers, searchQuery, tierFilters, countryFilters, rmFilter]);

  // Filtered candidates in Tab 2
  const filteredTabCandidates = useMemo(() => {
    if (candidateStatusFilter === 'all') return tabCandidates;
    return tabCandidates.filter((c) => c.status === candidateStatusFilter);
  }, [tabCandidates, candidateStatusFilter]);

  // Onboarding steps for selected supplier
  const onboardingSteps = useMemo(() => {
    if (!selectedSupplier) return [];
    const checklist = selectedSupplier.onboarding_checklist || {};
    return [
      {
        label: 'Platform Account Created',
        done: Boolean(selectedSupplier.user_id),
      },
      {
        label: 'Compliance Documents Submitted',
        done: complianceDocs.length > 0 || Boolean(checklist.documents_uploaded),
      },
      {
        label: 'Zero-Fee Recruitment Policy Declared',
        done: Boolean(selectedSupplier.compliance_declared),
      },
      {
        label: 'Team Members Added',
        done: teamMembers.length > 0 || Boolean(checklist.team_invited),
      },
      {
        label: 'Account Manager Assigned',
        done: Boolean(
          (selectedSupplier.rm_name && selectedSupplier.rm_name !== 'Unassigned') ||
            selectedSupplier.rm_assignment_id ||
            selectedSupplier.rm_profile_id
        ),
      },
    ];
  }, [selectedSupplier, complianceDocs, teamMembers]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-60 bg-[#1B3270] text-white px-4 py-2.5 rounded-[6px] shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">All Suppliers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Sourcing partner directory, verification tiers, compliance documents, and bulk upload telemetry.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-white border border-[#E2E8F4] px-3 py-1.5 rounded-[6px] shadow-2xs">
          <Building2 className="w-3.5 h-3.5 text-[#1B3270]" />
          <span>
            Total Partners: <strong className="text-slate-800">{suppliers.length}</strong>
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search company name, contact, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-[6px] border border-[#E2E8F4] focus:ring-1 focus:ring-[#1B3270] focus:border-[#1B3270] outline-none"
          />
        </div>
        <div className="w-full sm:w-44">
          <MultiSelectFilter
            label="Tier"
            options={tierOptions}
            selectedValues={tierFilters}
            onChange={setTierFilters}
          />
        </div>
        {countryOptions.length > 0 && (
          <div className="w-full sm:w-44">
            <MultiSelectFilter
              label="Country"
              options={countryOptions}
              selectedValues={countryFilters}
              onChange={setCountryFilters}
            />
          </div>
        )}
        <div className="w-full sm:w-44">
          <select
            value={rmFilter}
            onChange={(e) => setRmFilter(e.target.value as any)}
            className="w-full h-9 px-3 text-xs rounded-[6px] border border-[#E2E8F4] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-700 cursor-pointer"
          >
            <option value="all">All RM Status</option>
            <option value="assigned">RM Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No suppliers found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Suppliers will be listed here once registered or approved on TerraTern.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Company Name</th>
                  <th className="py-3.5 px-4">Tier</th>
                  <th className="py-3.5 px-4 text-center">Team</th>
                  <th className="py-3.5 px-4 text-center">Compliance</th>
                  <th className="py-3.5 px-4 text-center">Onboarding</th>
                  <th className="py-3.5 px-4 text-center">Bulk Uploads</th>
                  <th className="py-3.5 px-4">RM Assigned</th>
                  <th className="py-3.5 px-4 text-center">Candidates</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredSuppliers.map((sup) => (
                  <tr key={sup.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{sup.company_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {sup.contact_email}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <select
                        value={sup.tier}
                        onChange={(e) => handleTierChange(sup.id, e.target.value)}
                        className={`text-[11px] font-bold py-1 px-2 rounded border focus:ring-1 focus:ring-[#1B3270] outline-none cursor-pointer ${
                          sup.tier === 'audited'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : sup.tier === 'verified'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        <option value="basic">Basic</option>
                        <option value="verified">Verified</option>
                        <option value="audited">Audited</option>
                      </select>
                    </td>
                    {/* Team Members Column */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium">
                      {sup.team_members_count}
                    </td>
                    {/* Compliance Docs Column */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          sup.verified_docs_count >= 5
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {sup.verified_docs_count}/5
                      </span>
                    </td>
                    {/* Onboarding Column */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          sup.onboarding_completed_count === 5
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {sup.onboarding_completed_count}/5
                      </span>
                    </td>
                    {/* Bulk Uploads Column */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium">
                      {sup.bulk_uploads_count}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {sup.rm_name}
                    </td>
                    {/* CANDIDATES COLUMN SHORTCUT: CLICK NUMBER TO OPEN DIRECTLY ON CANDIDATES TAB */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(sup, 'candidates')}
                        className="font-mono font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 hover:bg-[#1B3270] hover:text-white transition-colors cursor-pointer text-xs"
                        title="View candidates from this supplier"
                      >
                        {sup.candidate_count}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(sup, 'overview')}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#1B3270] bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-[#F0F4FF] transition-colors shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSupplierToDelete(sup)}
                          className="inline-flex items-center space-x-1 h-7 px-2.5 text-xs font-semibold text-[#EF4444] border border-[#EF4444] rounded-[6px] hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete supplier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* SUPPLIER DETAIL SIDE PANEL: 560px, FIXED RIGHT, FULL HEIGHT */}
      {/* ─────────────────────────────────────────────────────────── */}
      {selectedSupplier && (
        <div
          className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/30 backdrop-blur-2xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSupplier(null);
              setSelectedCandidateId(null);
            }
          }}
        >
          <div className="w-full sm:w-[560px] bg-white h-full shadow-2xl flex flex-col border-l border-[#E2E8F4] animate-in slide-in-from-right duration-200 relative">
            {/* PANEL HEADER */}
            <div className="px-6 py-4 border-b border-[#E2E8F4] flex items-start justify-between bg-[#F8FAFD]">
              <div>
                <h2 className="text-[18px] text-[#1B3270] font-semibold leading-tight">
                  {selectedSupplier.company_name}
                </h2>
                <div className="flex items-center space-x-2 mt-1.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E8EEF8] text-[#1B3270] capitalize">
                    {selectedSupplier.company_type.replace(/_/g, ' ')}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedSupplier.tier === 'audited'
                        ? 'bg-purple-100 text-purple-800'
                        : selectedSupplier.tier === 'verified'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {selectedSupplier.tier}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSupplier(null);
                  setSelectedCandidateId(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                title="Close panel"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PANEL HORIZONTAL PILL TABS */}
            <div className="px-6 py-3 border-b border-[#E2E8F4] bg-white flex items-center space-x-2">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'candidates', label: 'Candidates' },
                { id: 'compliance', label: 'Compliance' },
                { id: 'team', label: 'Team' },
              ].map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id as any);
                      setSelectedCandidateId(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#1B3270] text-white'
                        : 'border border-[#E2E8F4] text-slate-600 bg-white hover:bg-slate-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* PANEL BODY CONTENT */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
              {drawerLoading ? (
                <div className="py-24 text-center">
                  <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading supplier data...</p>
                </div>
              ) : (
                <>
                  {/* ─────────────────────────────────────────────────────────── */}
                  {/* TAB 1: OVERVIEW */}
                  {/* ─────────────────────────────────────────────────────────── */}
                  {activeTab === 'overview' && (
                    <div className="space-y-5 animate-in fade-in duration-150">
                      {/* 4 Stat Mini-Cards in 2x2 Grid */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3.5">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Candidates
                          </div>
                          <div className="text-2xl font-bold text-[#1B3270] mt-1 font-mono">
                            {overviewStats.candidates}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Total registered candidates
                          </div>
                        </div>

                        <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3.5">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Interview Ready
                          </div>
                          <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                            {overviewStats.interviewReady}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Cleared qualification gates
                          </div>
                        </div>

                        <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3.5">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Submissions
                          </div>
                          <div className="text-2xl font-bold text-[#1B3270] mt-1 font-mono">
                            {overviewStats.submissions}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Applications to job openings
                          </div>
                        </div>

                        <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3.5">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Placements
                          </div>
                          <div className="text-2xl font-bold text-purple-600 mt-1 font-mono">
                            {overviewStats.placements}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Successfully placed candidates
                          </div>
                        </div>
                      </div>

                      {/* COMPANY DETAILS (READ-ONLY LIST) */}
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                        <h3 className="font-bold text-[#1B3270] text-sm">Company Details</h3>
                        <dl className="divide-y divide-[#E2E8F4] text-xs">
                          <div className="py-2 flex items-center justify-between">
                            <dt className="text-slate-500">Registration Number</dt>
                            <dd className="font-medium text-slate-800 font-mono">
                              {selectedSupplier.registration_number || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex items-center justify-between">
                            <dt className="text-slate-500">Country</dt>
                            <dd className="font-medium text-slate-800">
                              {selectedSupplier.country_of_operation || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex items-center justify-between">
                            <dt className="text-slate-500">Website</dt>
                            <dd className="font-medium text-[#1B3270]">
                              {selectedSupplier.website_url ? (
                                <a
                                  href={
                                    selectedSupplier.website_url.startsWith('http')
                                      ? selectedSupplier.website_url
                                      : `https://${selectedSupplier.website_url}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline inline-flex items-center space-x-1"
                                >
                                  <span>
                                    {selectedSupplier.website_url.replace(/^https?:\/\//, '')}
                                  </span>
                                  <ExternalLink className="w-3 h-3 ml-0.5" />
                                </a>
                              ) : (
                                '—'
                              )}
                            </dd>
                          </div>
                          <div className="py-2 flex items-center justify-between">
                            <dt className="text-slate-500">Year Established</dt>
                            <dd className="font-medium text-slate-800">
                              {selectedSupplier.year_established || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex items-center justify-between">
                            <dt className="text-slate-500">Primary Contact Name</dt>
                            <dd className="font-medium text-slate-800">
                              {selectedSupplier.primary_contact_name ||
                                selectedSupplier.contact_name ||
                                '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex items-center justify-between">
                            <dt className="text-slate-500">Phone</dt>
                            <dd className="font-medium text-slate-800 font-mono">
                              {selectedSupplier.primary_contact_phone || '—'}
                            </dd>
                          </div>
                          <div className="py-2 flex items-start justify-between gap-4">
                            <dt className="text-slate-500 shrink-0">Office Address</dt>
                            <dd className="font-medium text-slate-800 text-right">
                              {selectedSupplier.office_address || '—'}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      {/* ONBOARDING CHECKLIST */}
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <CheckSquare className="w-4 h-4 text-[#1B3270]" />
                            <h3 className="font-bold text-[#1B3270] text-sm">Onboarding Checklist</h3>
                          </div>
                          <span className="text-xs font-semibold text-slate-500 font-mono">
                            {onboardingSteps.filter((s) => s.done).length}/5 Completed
                          </span>
                        </div>
                        <div className="space-y-2">
                          {onboardingSteps.map((step, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2.5 rounded-[6px] bg-slate-50 border border-slate-200/80"
                            >
                              <div className="flex items-center space-x-2.5">
                                <span
                                  className={`text-sm font-bold ${
                                    step.done ? 'text-emerald-600' : 'text-slate-400'
                                  }`}
                                >
                                  {step.done ? '✓' : '○'}
                                </span>
                                <span
                                  className={`text-xs font-medium ${
                                    step.done ? 'text-slate-800' : 'text-slate-500'
                                  }`}
                                >
                                  {step.label}
                                </span>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  step.done
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {step.done ? 'Completed' : 'Pending'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* ACCOUNT MANAGER */}
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                              Account Manager
                            </span>
                            {selectedSupplier.rm_name && selectedSupplier.rm_name !== 'Unassigned' ? (
                              <div className="flex items-center space-x-2 mt-1">
                                <div className="w-6 h-6 rounded-full bg-[#1B3270] text-white flex items-center justify-center font-bold text-[10px]">
                                  {selectedSupplier.rm_name.charAt(0)}
                                </div>
                                <span className="font-semibold text-xs text-slate-800">
                                  {selectedSupplier.rm_name}
                                </span>
                              </div>
                            ) : (
                              <div className="mt-1">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Unassigned
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedAssignRmId(selectedSupplier.rm_profile_id || '');
                              setRmAssignModalOpen(true);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-[#1B3270] bg-white border border-[#E2E8F4] hover:bg-[#F0F4FF] rounded-[6px] transition-colors shadow-2xs cursor-pointer"
                          >
                            Assign RM
                          </button>
                        </div>
                      </div>

                      {/* TIER MANAGEMENT */}
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 shadow-2xs flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                            Tier Management
                          </span>
                          <span className="text-xs text-slate-500">
                            Partner accreditation level
                          </span>
                        </div>
                        <select
                          value={selectedSupplier.tier}
                          onChange={(e) => handleTierChange(selectedSupplier.id, e.target.value)}
                          className={`text-xs font-bold py-1.5 px-3 rounded-[6px] border outline-none cursor-pointer ${
                            selectedSupplier.tier === 'audited'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : selectedSupplier.tier === 'verified'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="basic">Basic</option>
                          <option value="verified">Verified</option>
                          <option value="audited">Audited</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────── */}
                  {/* TAB 2: CANDIDATES (CRITICAL FIX: STRICTLY SCOPED) */}
                  {/* ─────────────────────────────────────────────────────────── */}
                  {activeTab === 'candidates' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      {/* FILTER PILLS */}
                      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
                        {[
                          { key: 'all', label: 'All' },
                          { key: 'onboarding', label: 'Getting Started' },
                          { key: 'in_progress', label: 'In Qualification' },
                          { key: 'interview_ready', label: 'Interview Ready' },
                          { key: 'placed', label: 'Placed' },
                        ].map((filter) => {
                          const active = candidateStatusFilter === filter.key;
                          return (
                            <button
                              key={filter.key}
                              type="button"
                              onClick={() => setCandidateStatusFilter(filter.key as any)}
                              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                                active
                                  ? 'bg-[#1B3270] text-white'
                                  : 'border border-[#E2E8F4] text-slate-600 bg-white hover:bg-slate-50'
                              }`}
                            >
                              {filter.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* HEADER COUNT LABEL */}
                      <div className="flex items-center justify-between pt-1">
                        <h4 className="font-bold text-[#1B3270] text-xs">
                          {filteredTabCandidates.length} candidate
                          {filteredTabCandidates.length === 1 ? '' : 's'} from{' '}
                          {selectedSupplier.company_name}
                        </h4>
                      </div>

                      {/* CANDIDATES TABLE OR EMPTY STATE */}
                      {filteredTabCandidates.length === 0 ? (
                        <div className="py-14 px-4 text-center bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px]">
                          <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-xs font-semibold text-slate-600">
                            No candidates from {selectedSupplier.company_name} yet.
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {candidateStatusFilter !== 'all'
                              ? 'No candidates match the active status filter.'
                              : 'This sourcing partner has not registered candidates yet.'}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-[#E2E8F4] rounded-[8px]">
                          <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                              <tr>
                                <th className="py-2.5 px-3">Name</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Target Role</th>
                                <th className="py-2.5 px-3">Language</th>
                                <th className="py-2.5 px-3 text-center">DT Attempts</th>
                                <th className="py-2.5 px-3">Current Gate</th>
                                <th className="py-2.5 px-3 text-center">Profile %</th>
                                <th className="py-2.5 px-3 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                              {filteredTabCandidates.map((cand) => (
                                <tr key={cand.id} className="hover:bg-[#F8FAFD] transition-colors">
                                  <td className="py-2.5 px-3 font-semibold text-slate-900">
                                    <div>
                                      {cand.first_name} {cand.last_name}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-normal">
                                      {cand.profiles?.email || '—'}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                        cand.status === 'placed'
                                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                          : cand.status === 'interview_ready'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : cand.status === 'in_progress'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                                      }`}
                                    >
                                      {getCandidateStatusLabel(cand.status)}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 capitalize text-slate-800">
                                    {cand.target_role || '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-800 font-medium">
                                    {cand.language_level_self_reported || '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono font-medium">
                                    {cand.dt_attempt_count ?? 0}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-800">
                                    {latestGateMap[cand.id]
                                      ? getGateLabel(latestGateMap[cand.id])
                                      : 'Not started'}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">
                                    {cand.profile_completion_pct ?? 0}%
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCandidateId(cand.id)}
                                      className="inline-flex items-center space-x-1 px-2 py-1 text-[11px] font-semibold text-[#1B3270] bg-white border border-[#E2E8F4] rounded-[5px] hover:bg-[#F0F4FF] transition-colors shadow-2xs cursor-pointer"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>View Candidate</span>
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────── */}
                  {/* TAB 3: COMPLIANCE */}
                  {/* ─────────────────────────────────────────────────────────── */}
                  {activeTab === 'compliance' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      {/* Declarations (Read-only) */}
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                        <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-2">
                          <ShieldCheck className="w-4 h-4 text-[#1B3270]" />
                          <span>Partner Declarations</span>
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-slate-800">
                                Zero Placement Fee Policy
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Ethical recruitment covenant
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                selectedSupplier.compliance_declared
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {selectedSupplier.compliance_declared ? 'Declared' : 'Not Declared'}
                            </span>
                          </div>

                          <div className="p-3 rounded-[6px] bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-slate-800">
                                No Candidate Fee Policy
                              </p>
                              <p className="text-[10px] text-slate-400">
                                Confirmation of compliance
                              </p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                selectedSupplier.no_fee_policy_confirmed
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {selectedSupplier.no_fee_policy_confirmed
                                ? 'Confirmed'
                                : 'Not Confirmed'}
                            </span>
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-400 italic">
                          Both declarations are managed directly by the supplier. Super Admin can review and verify compliance documents.
                        </p>
                      </div>

                      {/* 5 Compliance Documents */}
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-2">
                            <FileCheck className="w-4 h-4 text-[#1B3270]" />
                            <span>Compliance Documents</span>
                          </h3>
                          <span className="text-xs font-semibold text-slate-500 font-mono">
                            {
                              complianceDocs.filter((d) => d.verification_status === 'verified')
                                .length
                            }
                            /5 Verified
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {REQUIRED_DOC_TYPES.map((req) => {
                            const uploadedDoc = complianceDocs.find(
                              (d) => d.document_type === req.key
                            );
                            const status = uploadedDoc?.verification_status || 'not_uploaded';

                            return (
                              <div
                                key={req.key}
                                className="p-3 bg-slate-50 border border-slate-200 rounded-[6px] space-y-2"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="font-semibold text-slate-800 text-xs">
                                      {req.label}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                      {uploadedDoc ? (
                                        <>
                                          <span>{uploadedDoc.file_name}</span>
                                          {uploadedDoc.uploaded_at && (
                                            <span className="ml-2 font-mono">
                                              Uploaded:{' '}
                                              {new Date(
                                                uploadedDoc.uploaded_at
                                              ).toLocaleDateString()}
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        'No document uploaded yet'
                                      )}
                                    </p>
                                    {uploadedDoc?.rejection_reason && status === 'rejected' && (
                                      <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded mt-1.5">
                                        <strong>Rejection reason:</strong>{' '}
                                        {uploadedDoc.rejection_reason}
                                      </p>
                                    )}
                                  </div>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                      status === 'verified'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : status === 'rejected'
                                        ? 'bg-rose-100 text-rose-800'
                                        : status === 'pending'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-200 text-slate-500'
                                    }`}
                                  >
                                    {status.replace('_', ' ')}
                                  </span>
                                </div>

                                {uploadedDoc && (
                                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
                                    {uploadedDoc.file_url && (
                                      <a
                                        href={uploadedDoc.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-[#1B3270] hover:underline flex items-center font-medium mr-auto"
                                      >
                                        <span>View File</span>
                                        <ExternalLink className="w-3 h-3 ml-1" />
                                      </a>
                                    )}
                                    {status !== 'verified' && (
                                      <button
                                        type="button"
                                        onClick={() => handleVerifyDocument(uploadedDoc.id)}
                                        className="px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-[5px] hover:bg-emerald-100 transition-colors cursor-pointer"
                                      >
                                        Verify
                                      </button>
                                    )}
                                    {status !== 'rejected' && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setRejectDocModal({
                                            open: true,
                                            doc: uploadedDoc,
                                            reason: '',
                                          })
                                        }
                                        className="px-2.5 py-1 text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-300 rounded-[5px] hover:bg-rose-100 transition-colors cursor-pointer"
                                      >
                                        Reject
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ─────────────────────────────────────────────────────────── */}
                  {/* TAB 4: TEAM */}
                  {/* ─────────────────────────────────────────────────────────── */}
                  {activeTab === 'team' && (
                    <div className="space-y-4 animate-in fade-in duration-150">
                      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Users className="w-4 h-4 text-[#1B3270]" />
                            <h3 className="font-bold text-[#1B3270] text-sm">Team Members</h3>
                          </div>
                          <span className="text-xs font-semibold text-slate-500 font-mono">
                            {teamMembers.length} member{teamMembers.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {teamMembers.length === 0 ? (
                          <div className="py-12 px-4 text-center bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px]">
                            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-semibold text-slate-600">
                              No team members added yet.
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              The partner has not registered additional staff accounts.
                            </p>
                          </div>
                        ) : (
                          <div className="overflow-x-auto border border-[#E2E8F4] rounded-[8px]">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                                <tr>
                                  <th className="py-2.5 px-3">Name</th>
                                  <th className="py-2.5 px-3">Role</th>
                                  <th className="py-2.5 px-3">Email</th>
                                  <th className="py-2.5 px-3">Status</th>
                                  <th className="py-2.5 px-3 text-right">Joined Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                                {teamMembers.map((m) => (
                                  <tr key={m.id} className="hover:bg-[#F8FAFD] transition-colors">
                                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                                      {m.full_name}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                                          m.role === 'admin'
                                            ? 'bg-blue-100 text-[#1B3270]'
                                            : 'bg-slate-100 text-slate-700'
                                        }`}
                                      >
                                        {m.role}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                      {m.email}
                                    </td>
                                    <td className="py-2.5 px-3">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold capitalize ${
                                          m.status === 'active'
                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}
                                      >
                                        {m.status}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right text-slate-500 font-mono text-[11px]">
                                      {new Date(m.created_at).toLocaleDateString()}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* PANEL FOOTER */}
            <div className="p-4 border-t border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedSupplier(null);
                  setSelectedCandidateId(null);
                }}
                className="px-4 py-2 border border-[#E2E8F4] text-slate-600 rounded-[6px] font-semibold hover:bg-white transition-colors cursor-pointer text-xs"
              >
                Close
              </button>
            </div>

            {/* ─────────────────────────────────────────────────────────── */}
            {/* NESTED DETAIL PANEL: INDIVIDUAL CANDIDATE PROFILE DETAIL */}
            {/* ─────────────────────────────────────────────────────────── */}
            {selectedCandidateId && (
              <div className="absolute inset-0 bg-white z-20 flex flex-col animate-in slide-in-from-right duration-200">
                <div className="px-5 py-3 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateId(null)}
                    className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Candidates</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateId(null)}
                    className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  <CandidateProfileDetailView
                    candidateId={selectedCandidateId}
                    showAttentionAlert={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* ASSIGN RELATIONSHIP MANAGER (RM) MODAL */}
      {/* ─────────────────────────────────────────────────────────── */}
      {rmAssignModalOpen && selectedSupplier && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[10px] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
              <div>
                <h3 className="text-sm font-bold text-[#1B3270]">Assign Relationship Manager</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Partner: <strong>{selectedSupplier.company_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRmAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">
                Select Account Manager
              </label>
              <select
                value={selectedAssignRmId}
                onChange={(e) => setSelectedAssignRmId(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs outline-none bg-white focus:ring-1 focus:ring-[#1B3270] cursor-pointer"
              >
                <option value="">Unassigned</option>
                {rmOptions.map((rm) => (
                  <option key={rm.id} value={rm.id}>
                    {rm.first_name} {rm.last_name} ({rm.internal_role.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Staff members qualified for partner management are listed above.
              </p>
            </div>

            <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRmAssignModalOpen(false)}
                className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignRm}
                disabled={assigningRm}
                className="px-3.5 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                {assigningRm ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Confirm Assignment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* REJECT COMPLIANCE DOCUMENT MODAL */}
      {/* ─────────────────────────────────────────────────────────── */}
      {rejectDocModal.open && rejectDocModal.doc && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-[10px] max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
              <div>
                <h3 className="text-sm font-bold text-rose-700">Reject Compliance Document</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Document: <strong>{rejectDocModal.doc.file_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectDocModal({ open: false, doc: null, reason: '' })}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-600">
                Reason for Rejection
              </label>
              <textarea
                rows={3}
                placeholder="Explain why this document was rejected so the partner can re-upload..."
                value={rejectDocModal.reason}
                onChange={(e) =>
                  setRejectDocModal((prev) => ({ ...prev, reason: e.target.value }))
                }
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs outline-none focus:ring-1 focus:ring-rose-500 resize-none"
              />
            </div>

            <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setRejectDocModal({ open: false, doc: null, reason: '' })}
                className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectingDoc || !rejectDocModal.reason.trim()}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                {rejectingDoc ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Confirm Rejection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {supplierToDelete && (
        <DeleteConfirmationModal
          isOpen={true}
          tier="tier1"
          entityType="Supplier"
          entityName={supplierToDelete.company_name}
          onClose={() => setSupplierToDelete(null)}
          onConfirm={handleDeleteSupplierConfirm}
          isDeleting={isDeletingSupplier}
        />
      )}
    </div>
  );
};

export default SuppliersTab;
