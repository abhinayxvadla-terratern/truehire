import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Users,
  Building2,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { formatDate } from '../../../../utils/formatters';
import { syncSupplierCandidatesRm, assignDirectCandidateRm } from '../../../../utils/rmAssignmentUtils';

interface AssignmentRequestNotification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  sent_by_name: string;
  company_name: string;
}

interface UnassignedSupplier {
  id: string;
  company_name: string;
  company_type: string;
  country_of_operation: string;
  created_at: string;
  onboarded_by_name: string;
  days_waiting: number;
  user_id: string | null;
  onboarding_checklist: any;
}

interface UnassignedEmployer {
  id: string;
  company_name: string;
  location: string;
  industry: string;
  created_at: string;
  onboarded_by_name: string;
  days_waiting: number;
  user_id: string | null;
  is_admin_profile_id: string | null;
  onboarding_checklist: any;
}

export interface UnassignedDirectCandidate {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  status: string;
  dt_status: string;
  dt_passed: boolean;
  created_at: string;
  days_unassigned: number;
  user_id?: string | null;
}

interface RmOption {
  id: string;
  name: string;
  email: string;
  activeAccountsCount: number;
}

export const LeadRmAssignmentQueueTab: React.FC = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<'suppliers' | 'employers' | 'direct_candidates'>('suppliers');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Notification requests
  const [requests, setRequests] = useState<AssignmentRequestNotification[]>([]);

  // Suppliers & Employers data
  const [suppliers, setSuppliers] = useState<UnassignedSupplier[]>([]);
  const [employers, setEmployers] = useState<UnassignedEmployer[]>([]);
  const [directCandidates, setDirectCandidates] = useState<UnassignedDirectCandidate[]>([]);

  // RM options
  const [candidateRms, setCandidateRms] = useState<RmOption[]>([]);
  const [employerRms, setEmployerRms] = useState<RmOption[]>([]);

  // Supplier Assignment Modal
  const [assignSupplierModal, setAssignModalSupplier] = useState<UnassignedSupplier | null>(null);
  const [selectedSupplierRmId, setSelectedSupplierRmId] = useState('');
  const [supplierAssignNotes, setSupplierAssignNotes] = useState('');
  const [assigningSupplier, setAssigningSupplier] = useState(false);

  // Employer Assignment Modal
  const [assignEmployerModal, setAssignModalEmployer] = useState<UnassignedEmployer | null>(null);
  const [selectedEmployerRmId, setSelectedEmployerRmId] = useState('');
  const [employerAssignNotes, setEmployerAssignNotes] = useState('');
  const [assigningEmployer, setAssigningEmployer] = useState(false);

  // Direct Candidate Assignment Modal
  const [assignDirectCandidateModal, setAssignDirectCandidateModal] = useState<UnassignedDirectCandidate | null>(null);
  const [selectedDirectCandidateRmId, setSelectedDirectCandidateRmId] = useState('');
  const [assigningDirectCandidate, setAssigningDirectCandidate] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchQueueData = async () => {
    try {
      setLoading(true);

      // 1. Fetch Notification Requests from Partnerships team
      const { data: notifs } = await supabase
        .from('notifications')
        .select(`
          id,
          title,
          message,
          created_at,
          sent_by,
          profiles:sent_by (first_name, last_name, email)
        `)
        .eq('type', 'rm_assignment_request')
        .order('created_at', { ascending: false });

      const mappedRequests: AssignmentRequestNotification[] = (notifs || []).map((n: any) => {
        const sender = n.profiles
          ? `${n.profiles.first_name || ''} ${n.profiles.last_name || ''}`.trim() || n.profiles.email
          : 'Partnerships Associate';

        // Extract company name if included in message/title
        let company = 'Partner Organization';
        const msg = n.message || '';
        const match = msg.match(/^([^(]+)\s*\(/);
        if (match && match[1]) {
          company = match[1].trim();
        } else if (n.title && n.title.includes(':')) {
          company = n.title.split(':')[1].trim();
        }

        return {
          id: n.id,
          title: n.title,
          message: n.message,
          created_at: n.created_at,
          sent_by_name: sender,
          company_name: company,
        };
      });
      setRequests(mappedRequests);

      // 2. Fetch Suppliers with no active rm_assignments
      const [allSupsRes, activeSupAssignmentsRes] = await Promise.all([
        supabase
          .from('suppliers')
          .select(`
            id,
            company_name,
            company_type,
            country_of_operation,
            created_at,
            created_by_internal,
            user_id,
            onboarding_checklist,
            profiles:created_by_internal (first_name, last_name, email)
          `)
          .order('created_at', { ascending: true }),
        supabase
          .from('rm_assignments')
          .select('entity_id')
          .eq('entity_type', 'supplier')
          .eq('active', true),
      ]);

      const assignedSupIds = new Set((activeSupAssignmentsRes.data || []).map((a) => a.entity_id));
      const now = Date.now();

      const unassignedSups: UnassignedSupplier[] = (allSupsRes.data || [])
        .filter((s) => !assignedSupIds.has(s.id))
        .map((s: any) => {
          const days = Math.max(0, Math.floor((now - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24)));
          const onboarder = s.profiles
            ? `${s.profiles.first_name || ''} ${s.profiles.last_name || ''}`.trim() || s.profiles.email
            : 'Self-Registered';

          return {
            id: s.id,
            company_name: s.company_name || 'Unnamed Supplier',
            company_type: s.company_type || 'placement_agency',
            country_of_operation: s.country_of_operation || 'International',
            created_at: s.created_at,
            onboarded_by_name: onboarder,
            days_waiting: days,
            user_id: s.user_id,
            onboarding_checklist: s.onboarding_checklist,
          };
        });
      setSuppliers(unassignedSups);

      // 3. Fetch Employers with no active rm_assignments
      const [allEmpsRes, activeEmpAssignmentsRes] = await Promise.all([
        supabase
          .from('employers')
          .select(`
            id,
            company_name,
            location,
            country,
            industry,
            created_at,
            user_id,
            is_admin_profile_id,
            created_by_internal,
            onboarding_checklist,
            profiles:created_by_internal (first_name, last_name, email)
          `)
          .order('created_at', { ascending: true }),
        supabase
          .from('rm_assignments')
          .select('entity_id')
          .eq('entity_type', 'employer')
          .eq('active', true),
      ]);

      const assignedEmpIds = new Set((activeEmpAssignmentsRes.data || []).map((a) => a.entity_id));

      const unassignedEmps: UnassignedEmployer[] = (allEmpsRes.data || [])
        .filter((e) => !assignedEmpIds.has(e.id))
        .map((e: any) => {
          const days = Math.max(0, Math.floor((now - new Date(e.created_at).getTime()) / (1000 * 60 * 60 * 24)));
          const onboarder = e.profiles
            ? `${e.profiles.first_name || ''} ${e.profiles.last_name || ''}`.trim() || e.profiles.email
            : 'Self-Registered';

          return {
            id: e.id,
            company_name: e.company_name || 'Unnamed Facility',
            location: e.location || e.country || 'Germany',
            industry: e.industry || 'Healthcare Facility',
            created_at: e.created_at,
            onboarded_by_name: onboarder,
            days_waiting: days,
            user_id: e.user_id,
            is_admin_profile_id: e.is_admin_profile_id,
            onboarding_checklist: e.onboarding_checklist,
          };
        });
      setEmployers(unassignedEmps);

      // 4. Fetch Direct Candidates with no RM assigned
      const { data: directCandsRes } = await supabase
        .from('candidates')
        .select(`
          id,
          first_name,
          last_name,
          status,
          created_at,
          dt_passed_at,
          user_id,
          dt_attempts (id, passed)
        `)
        .is('supplier_id', null)
        .is('assigned_rm_id', null)
        .neq('status', 'placed')
        .order('created_at', { ascending: true });

      const mappedDirectCands: UnassignedDirectCandidate[] = (directCandsRes || []).map((c: any) => {
        const days = Math.max(0, Math.floor((now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)));
        const hasPassedDt = Boolean(c.dt_passed_at || (c.dt_attempts && c.dt_attempts.some((a: any) => a.passed)));
        return {
          id: c.id,
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Direct Candidate',
          first_name: c.first_name || '',
          last_name: c.last_name || '',
          status: c.status || 'onboarding',
          dt_status: hasPassedDt ? 'Passed' : 'Pending',
          dt_passed: hasPassedDt,
          created_at: c.created_at,
          days_unassigned: days,
          user_id: c.user_id,
        };
      });
      setDirectCandidates(mappedDirectCands);

      // 5. Fetch Candidate/Supplier RMs for assignment dropdown
      const { data: csRms } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'candidate_supplier_rm')
        .eq('is_internal', true);

      const { data: allAssignedCands } = await supabase
        .from('candidates')
        .select('assigned_rm_id')
        .not('assigned_rm_id', 'is', null);

      const candCountMap: Record<string, number> = {};
      (allAssignedCands || []).forEach((c) => {
        if (c.assigned_rm_id) {
          candCountMap[c.assigned_rm_id] = (candCountMap[c.assigned_rm_id] || 0) + 1;
        }
      });

      const formattedCsRms: RmOption[] = (csRms || []).map((r) => ({
        id: r.id,
        name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email,
        email: r.email,
        activeAccountsCount: candCountMap[r.id] || 0,
      }));
      setCandidateRms(formattedCsRms);

      // 5. Fetch Employer RMs for assignment dropdown
      let { data: empRms } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'employer_requirements_rm')
        .eq('is_internal', true);

      if (!empRms || empRms.length === 0) {
        const { data: fallbackProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('internal_role', ['employer_requirements_rm', 'placement_lead', 'super_admin'])
          .eq('is_internal', true);
        empRms = fallbackProfiles || [];
      }

      const { data: allEmpAssignments } = await supabase
        .from('rm_assignments')
        .select('rm_profile_id')
        .eq('entity_type', 'employer')
        .eq('active', true);

      const empCountMap: Record<string, number> = {};
      (allEmpAssignments || []).forEach((a) => {
        empCountMap[a.rm_profile_id] = (empCountMap[a.rm_profile_id] || 0) + 1;
      });

      const formattedEmpRms: RmOption[] = (empRms || []).map((r) => ({
        id: r.id,
        name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email,
        email: r.email,
        activeAccountsCount: empCountMap[r.id] || 0,
      }));
      setEmployerRms(formattedEmpRms);
    } catch (err) {
      console.error('Error fetching RM assignment queue data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  const handleAssignSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignSupplierModal || !selectedSupplierRmId || !user) return;

    try {
      setAssigningSupplier(true);

      // 1. Insert rm_assignments
      const { error: assignErr } = await supabase.from('rm_assignments').insert({
        rm_profile_id: selectedSupplierRmId,
        entity_type: 'supplier',
        entity_id: assignSupplierModal.id,
        assigned_by: user.id,
        active: true,
        notes: supplierAssignNotes.trim() || null,
      });
      if (assignErr) throw assignErr;

      // 2. Update suppliers onboarding_checklist
      const currentChecklist = assignSupplierModal.onboarding_checklist || {};
      await supabase
        .from('suppliers')
        .update({
          onboarding_checklist: {
            ...currentChecklist,
            rm_assigned: true,
          },
        })
        .eq('id', assignSupplierModal.id);

      const selectedRm = candidateRms.find((r) => r.id === selectedSupplierRmId);
      const rmName = selectedRm?.name || 'Account Manager';

      // 3. Notify assigned RM
      await supabase.from('notifications').insert({
        user_id: selectedSupplierRmId,
        title: 'New Supplier Assigned',
        message: `You have been assigned as account manager for ${assignSupplierModal.company_name} (${assignSupplierModal.company_type}). Introduce yourself and support their onboarding.${supplierAssignNotes.trim() ? '\n\nNotes: ' + supplierAssignNotes.trim() : ''}`,
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      // 4. Notify supplier team members
      const { data: teamMembers } = await supabase
        .from('supplier_team_members')
        .select('profile_id')
        .eq('supplier_id', assignSupplierModal.id)
        .eq('invite_status', 'accepted');

      const recipientIds = new Set<string>();
      (teamMembers || []).forEach((tm) => {
        if (tm.profile_id) recipientIds.add(tm.profile_id);
      });
      if (assignSupplierModal.user_id) {
        recipientIds.add(assignSupplierModal.user_id);
      }

      if (recipientIds.size > 0) {
        const notifPayload = Array.from(recipientIds).map((pId) => ({
          user_id: pId,
          title: 'Your Account Manager Has Been Assigned',
          message: `Your TerraTern account manager is ${rmName}. They will be in touch to support your onboarding and candidate pipeline. You can see their contact details in your Company Profile.`,
          type: 'general',
          read: false,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifPayload);
      }

      // 5. Auto-assign existing unassigned candidates of this supplier to the new RM
      await syncSupplierCandidatesRm(
        supabase,
        assignSupplierModal.id,
        selectedSupplierRmId,
        false,
        user.id
      );

      showToast(`${assignSupplierModal.company_name} assigned to ${rmName}.`);
      setSuppliers((prev) => prev.filter((s) => s.id !== assignSupplierModal.id));
      setAssignModalSupplier(null);
      setSelectedSupplierRmId('');
      setSupplierAssignNotes('');
    } catch (err: any) {
      console.error('Error assigning supplier RM:', err);
      showToast(err.message || 'Failed to assign account manager.', 'error');
    } finally {
      setAssigningSupplier(false);
    }
  };

  const handleAssignDirectCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignDirectCandidateModal || !selectedDirectCandidateRmId || !user) return;

    try {
      setAssigningDirectCandidate(true);
      const { rmName, candidateName } = await assignDirectCandidateRm(
        supabase,
        assignDirectCandidateModal.id,
        selectedDirectCandidateRmId,
        user.id
      );

      showToast(`${candidateName} assigned to ${rmName}.`);
      setDirectCandidates((prev) => prev.filter((c) => c.id !== assignDirectCandidateModal.id));
      setAssignDirectCandidateModal(null);
      setSelectedDirectCandidateRmId('');
    } catch (err: any) {
      console.error('Error assigning direct candidate RM:', err);
      showToast(err.message || 'Failed to assign account manager.', 'error');
    } finally {
      setAssigningDirectCandidate(false);
    }
  };

  const handleAssignEmployer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmployerModal || !selectedEmployerRmId || !user) return;

    try {
      setAssigningEmployer(true);

      // 1. Insert rm_assignments
      const { error: assignErr } = await supabase.from('rm_assignments').insert({
        rm_profile_id: selectedEmployerRmId,
        entity_type: 'employer',
        entity_id: assignEmployerModal.id,
        assigned_by: user.id,
        active: true,
        notes: employerAssignNotes.trim() || null,
      });
      if (assignErr) throw assignErr;

      // 2. Update employer onboarding_checklist
      const currentChecklist = assignEmployerModal.onboarding_checklist || {};
      await supabase
        .from('employers')
        .update({
          onboarding_checklist: {
            ...currentChecklist,
            rm_assigned: true,
          },
        })
        .eq('id', assignEmployerModal.id);

      const selectedRm = employerRms.find((r) => r.id === selectedEmployerRmId);
      const rmName = selectedRm?.name || 'Account Manager';

      // 3. Notify assigned RM
      await supabase.from('notifications').insert({
        user_id: selectedEmployerRmId,
        title: 'New Employer Assigned',
        message: `You have been assigned as account manager for ${assignEmployerModal.company_name} (${assignEmployerModal.industry}). Introduce yourself and assist with requirement posting.${employerAssignNotes.trim() ? '\n\nNotes: ' + employerAssignNotes.trim() : ''}`,
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      // 4. Notify employer team members
      const { data: teamMembers } = await supabase
        .from('employer_team_members')
        .select('profile_id')
        .eq('employer_id', assignEmployerModal.id)
        .eq('invite_status', 'accepted');

      const recipientIds = new Set<string>();
      (teamMembers || []).forEach((tm) => {
        if (tm.profile_id) recipientIds.add(tm.profile_id);
      });
      if (assignEmployerModal.user_id) {
        recipientIds.add(assignEmployerModal.user_id);
      }
      if (assignEmployerModal.is_admin_profile_id) {
        recipientIds.add(assignEmployerModal.is_admin_profile_id);
      }

      if (recipientIds.size > 0) {
        const notifPayload = Array.from(recipientIds).map((pId) => ({
          user_id: pId,
          title: 'Your Account Manager Has Been Assigned',
          message: `Your TerraTern account manager is ${rmName}. They will support your hiring pipeline and candidate selection. You can reach out directly via your Messages tab.`,
          type: 'general',
          read: false,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifPayload);
      }

      showToast(`${assignEmployerModal.company_name} assigned to ${rmName}.`);
      setEmployers((prev) => prev.filter((e) => e.id !== assignEmployerModal.id));
      setAssignModalEmployer(null);
      setSelectedEmployerRmId('');
      setEmployerAssignNotes('');
    } catch (err: any) {
      console.error('Error assigning employer RM:', err);
      showToast(err.message || 'Failed to assign account manager.', 'error');
    } finally {
      setAssigningEmployer(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.company_name.toLowerCase().includes(q) ||
      s.country_of_operation.toLowerCase().includes(q) ||
      s.onboarded_by_name.toLowerCase().includes(q)
    );
  });

  const filteredEmployers = employers.filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.company_name.toLowerCase().includes(q) ||
      e.location.toLowerCase().includes(q) ||
      e.industry.toLowerCase().includes(q) ||
      e.onboarded_by_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center space-x-2 animate-in fade-in duration-200 ${
            toastMessage.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          )}
          <span>{toastMessage.msg}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            RM Assignment Queue
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assign dedicated Relationship Managers to newly onboarded suppliers and employers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchQueueData();
          }}
          disabled={refreshing}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#1B3270]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* PARTNERSHIPS TEAM REQUESTS BANNER */}
      {requests.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 shadow-2xs">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-amber-900">
                {requests.length} assignment request{requests.length > 1 ? 's' : ''} from Partnerships team
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                The partnerships team has flagged the following accounts awaiting relationship managers:
              </p>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {requests.slice(0, 6).map((req) => (
                  <div
                    key={req.id}
                    className="bg-white/90 border border-amber-200/60 rounded-lg p-2.5 text-xs text-slate-700 flex flex-col justify-between"
                  >
                    <div className="font-semibold text-slate-900 truncate">
                      {req.company_name}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>Requested by <strong className="text-slate-700 font-medium">{req.sent_by_name}</strong></span>
                      <span>{formatDate(req.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABS & SEARCH CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        {/* Section switcher */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveSection('suppliers')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2 cursor-pointer ${
              activeSection === 'suppliers'
                ? 'bg-[#1B3270] text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Suppliers ({suppliers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('employers')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2 cursor-pointer ${
              activeSection === 'employers'
                ? 'bg-[#1B3270] text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Employers ({employers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('direct_candidates')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2 cursor-pointer ${
              activeSection === 'direct_candidates'
                ? 'bg-[#1B3270] text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Direct Candidates ({directCandidates.length})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeSection === 'suppliers'
                ? 'Search suppliers...'
                : activeSection === 'employers'
                ? 'Search employers...'
                : 'Search direct candidates...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:border-[#1B3270]"
          />
        </div>
      </div>

      {/* CONTENT: SUPPLIERS */}
      {activeSection === 'suppliers' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-xs">Loading unassigned suppliers...</p>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h4 className="text-sm font-semibold text-slate-800">All suppliers are assigned</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                There are currently no registered suppliers awaiting a Relationship Manager.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Country</th>
                    <th className="py-3 px-4">Onboarded By</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4">Days Waiting</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSuppliers.map((sup) => {
                    const isUrgent = sup.days_waiting > 7;
                    const isOverdue = sup.days_waiting > 3 && !isUrgent;

                    return (
                      <tr key={sup.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {sup.company_name}
                        </td>
                        <td className="py-3.5 px-4 capitalize">
                          {sup.company_type.replace(/_/g, ' ')}
                        </td>
                        <td className="py-3.5 px-4">{sup.country_of_operation}</td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {sup.onboarded_by_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {formatDate(sup.created_at)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span>{sup.days_waiting} day{sup.days_waiting === 1 ? '' : 's'}</span>
                            {isUrgent ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Urgent
                              </span>
                            ) : isOverdue ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Overdue
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setAssignModalSupplier(sup);
                              if (candidateRms.length > 0) {
                                setSelectedSupplierRmId(candidateRms[0].id);
                              }
                            }}
                            className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#152758] text-white font-medium rounded-lg text-xs shadow-2xs transition-colors cursor-pointer"
                          >
                            Assign Account Manager
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
      )}

      {/* CONTENT: EMPLOYERS */}
      {activeSection === 'employers' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-xs">Loading unassigned employers...</p>
            </div>
          ) : filteredEmployers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-80" />
              <h4 className="text-sm font-semibold text-slate-800">All employers are assigned</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                There are currently no active employers awaiting an Account Manager.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Industry</th>
                    <th className="py-3 px-4">Onboarded By</th>
                    <th className="py-3 px-4">Created</th>
                    <th className="py-3 px-4">Days Waiting</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployers.map((emp) => {
                    const isUrgent = emp.days_waiting > 7;
                    const isOverdue = emp.days_waiting > 3 && !isUrgent;

                    return (
                      <tr key={emp.id} className="hover:bg-slate-50/75 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {emp.company_name}
                        </td>
                        <td className="py-3.5 px-4">{emp.location}</td>
                        <td className="py-3.5 px-4">{emp.industry}</td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {emp.onboarded_by_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                          {formatDate(emp.created_at)}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
                            <span>{emp.days_waiting} day{emp.days_waiting === 1 ? '' : 's'}</span>
                            {isUrgent ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Urgent
                              </span>
                            ) : isOverdue ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Overdue
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setAssignModalEmployer(emp);
                              if (employerRms.length > 0) {
                                setSelectedEmployerRmId(employerRms[0].id);
                              }
                            }}
                            className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#152758] text-white font-medium rounded-lg text-xs shadow-2xs transition-colors cursor-pointer"
                          >
                            Assign Account Manager
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
      )}

      {/* CONTENT: DIRECT CANDIDATES */}
      {activeSection === 'direct_candidates' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mb-2" />
              <p className="text-xs">Loading direct candidates queue...</p>
            </div>
          ) : directCandidates.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <h3 className="text-sm font-semibold text-slate-800">
                All direct candidates assigned
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No direct candidates are currently awaiting an account manager.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Name</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">DT Status</th>
                    <th className="py-3.5 px-4">Created</th>
                    <th className="py-3.5 px-4">Days Unassigned</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {directCandidates
                    .filter((c) =>
                      searchQuery.trim()
                        ? c.name.toLowerCase().includes(searchQuery.toLowerCase())
                        : true
                    )
                    .map((cand) => {
                      const isOverdue = cand.days_unassigned > 3 && cand.dt_passed;
                      const isUrgent = cand.days_unassigned > 7;

                      return (
                        <tr key={cand.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            <div>{cand.name}</div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {cand.id.slice(0, 8)}...
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 capitalize">
                              {cand.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {cand.dt_passed ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Passed
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                            {formatDate(cand.created_at)}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <span>{cand.days_unassigned} day{cand.days_unassigned === 1 ? '' : 's'}</span>
                              {isUrgent ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  Urgent
                                </span>
                              ) : isOverdue ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Overdue
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setAssignDirectCandidateModal(cand);
                                if (candidateRms.length > 0) {
                                  setSelectedDirectCandidateRmId(candidateRms[0].id);
                                }
                              }}
                              className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#152758] text-white font-medium rounded-lg text-xs shadow-2xs transition-colors cursor-pointer"
                            >
                              Assign RM
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
      )}

      {/* ASSIGN DIRECT CANDIDATE RM MODAL */}
      {assignDirectCandidateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Assign Account Manager
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {assignDirectCandidateModal.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignDirectCandidateModal(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignDirectCandidate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Account Manager *
                </label>
                {candidateRms.length === 0 ? (
                  <p className="text-xs text-rose-600">
                    No active Candidate / Supplier RMs found. Ensure staff profiles exist.
                  </p>
                ) : (
                  <select
                    value={selectedDirectCandidateRmId}
                    onChange={(e) => setSelectedDirectCandidateRmId(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  >
                    {candidateRms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} — {rm.activeAccountsCount} active candidates
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAssignDirectCandidateModal(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningDirectCandidate || !selectedDirectCandidateRmId}
                  className="px-4 py-2 bg-[#1B3270] hover:bg-[#152758] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {assigningDirectCandidate ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <span>Assign & Notify</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN SUPPLIER RM MODAL */}
      {assignSupplierModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Assign Account Manager
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {assignSupplierModal.company_name} ({assignSupplierModal.country_of_operation})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalSupplier(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignSupplier} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Candidate / Supplier RM *
                </label>
                {candidateRms.length === 0 ? (
                  <p className="text-xs text-rose-600">
                    No active Candidate / Supplier RMs found. Ensure staff profiles exist.
                  </p>
                ) : (
                  <select
                    value={selectedSupplierRmId}
                    onChange={(e) => setSelectedSupplierRmId(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  >
                    {candidateRms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.activeAccountsCount} active candidates)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Internal Handover Notes (Optional)
                </label>
                <textarea
                  value={supplierAssignNotes}
                  onChange={(e) => setSupplierAssignNotes(e.target.value)}
                  placeholder="Notes on supplier focus, key contact, or onboarding priority..."
                  rows={3}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAssignModalSupplier(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningSupplier || !selectedSupplierRmId}
                  className="px-4 py-2 bg-[#1B3270] hover:bg-[#152758] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {assigningSupplier ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <span>Confirm Assignment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN EMPLOYER RM MODAL */}
      {assignEmployerModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Assign Employer Account Manager
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {assignEmployerModal.company_name} ({assignEmployerModal.location})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalEmployer(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignEmployer} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Employer RM *
                </label>
                {employerRms.length === 0 ? (
                  <p className="text-xs text-rose-600">
                    No active Employer RMs found. Ensure staff profiles exist.
                  </p>
                ) : (
                  <select
                    value={selectedEmployerRmId}
                    onChange={(e) => setSelectedEmployerRmId(e.target.value)}
                    required
                    className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  >
                    {employerRms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.activeAccountsCount} active employers)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Internal Handover Notes (Optional)
                </label>
                <textarea
                  value={employerAssignNotes}
                  onChange={(e) => setEmployerAssignNotes(e.target.value)}
                  placeholder="Notes on hiring timeline, specialties required, or hospital profile..."
                  rows={3}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setAssignModalEmployer(null)}
                  className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningEmployer || !selectedEmployerRmId}
                  className="px-4 py-2 bg-[#1B3270] hover:bg-[#152758] disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {assigningEmployer ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <span>Confirm Assignment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadRmAssignmentQueueTab;
