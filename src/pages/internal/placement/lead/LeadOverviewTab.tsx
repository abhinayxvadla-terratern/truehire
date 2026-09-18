import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Users,
  Briefcase,
  Layers,
  Sparkles,
  HelpCircle,
  FileCheck2,
  Lock,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  UserCheck,
  X,
  Loader2,
  Check,
  Building2,
  GraduationCap,
  MessageSquare,
} from 'lucide-react';
import { syncSupplierCandidatesRm, assignDirectCandidateRm } from '../../../../utils/rmAssignmentUtils';
import { formatDate } from '../../../../utils/formatters';

interface RMWorkloadItem {
  id: string;
  name: string;
  email: string;
  role: 'candidate_supplier_rm' | 'employer_requirements_rm';
  assignedAccountsCount: number;
  secondaryCount: number; // in-flow candidates or open applications
  secondaryLabel: string;
}

interface EscalationItem {
  id: string;
  entity_type: string;
  entity_id: string;
  note: string;
  raised_by_id: string;
  raised_by_name: string;
  created_at: string;
}

interface RevealQueueItem {
  id: string;
  candidate_id: string;
  job_title: string;
  employer_name: string;
  days_in_offer: number;
  updated_at: string;
}

interface UnassignedSupplier {
  id: string;
  company_name: string;
  company_type: string;
  country_of_operation?: string | null;
  healthcare_roles_focus?: string[] | null;
  created_at: string;
  created_by_internal?: string | null;
  onboarded_by_name: string;
  days_without_rm: number;
  is_overdue: boolean;
  candidates_count: number;
  onboarding_checklist?: any;
  user_id?: string | null;
}

interface CandidateSupplierRmOption {
  id: string;
  name: string;
  email: string;
  activeSuppliersCount: number;
  totalCandidatesCount: number;
}

interface UnassignedEmployer {
  id: string;
  company_name: string;
  company_type: string;
  country: string;
  created_at: string;
  days_without_rm: number;
  is_overdue: boolean;
  jobs_count: number;
  onboarding_checklist?: any;
  user_id?: string | null;
  is_admin_profile_id?: string | null;
}

interface EmployerRmOption {
  id: string;
  name: string;
  email: string;
  activeEmployersCount: number;
  activeJobsCount: number;
}

interface LeadOverviewTabProps {
  onNavigateTab: (tabId: string) => void;
}

export const LeadOverviewTab: React.FC<LeadOverviewTabProps> = ({
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 8 Stat metrics
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [inGatesCount, setInGatesCount] = useState(0);
  const [interviewReadyCount, setInterviewReadyCount] = useState(0);
  const [pendingStRequestsCount, setPendingStRequestsCount] = useState(0);

  const [activeJobsCount, setActiveJobsCount] = useState(0);
  const [activeApplicationsCount, setActiveApplicationsCount] = useState(0);
  const [offerSentCount, setOfferSentCount] = useState(0);
  const [revealGateActiveCount, setRevealGateActiveCount] = useState(0);

  // New pipeline health metrics
  const [dtCoolingCount, setDtCoolingCount] = useState(0);
  const [finalTestLockedCount, setFinalTestLockedCount] = useState(0);
  const [activeCohortsCount, setActiveCohortsCount] = useState(0);
  const [placementsThisMonthCount, setPlacementsThisMonthCount] = useState(0);
  const [unreadEmployerMessagesCount, setUnreadEmployerMessagesCount] = useState(0);

  // Workload, Escalations, Reveal Queue
  const [rmWorkloads, setRmWorkloads] = useState<RMWorkloadItem[]>([]);
  const [escalations, setEscalations] = useState<EscalationItem[]>([]);
  const [revealQueue, setRevealQueue] = useState<RevealQueueItem[]>([]);

  // Suppliers without RM
  const [unassignedSuppliers, setUnassignedSuppliers] = useState<UnassignedSupplier[]>([]);
  const [candidateRms, setCandidateRms] = useState<CandidateSupplierRmOption[]>([]);
  const [assignModalSupplier, setAssignModalSupplier] = useState<UnassignedSupplier | null>(null);
  const [selectedRmId, setSelectedRmId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState<string>('');
  const [assigning, setAssigning] = useState(false);

  // Employers without RM
  const [unassignedEmployers, setUnassignedEmployers] = useState<UnassignedEmployer[]>([]);
  const [employerRms, setEmployerRms] = useState<EmployerRmOption[]>([]);
  const [assignModalEmployer, setAssignModalEmployer] = useState<UnassignedEmployer | null>(null);
  const [selectedEmployerRmId, setSelectedEmployerRmId] = useState<string>('');
  const [assignEmployerNotes, setAssignEmployerNotes] = useState<string>('');
  const [assigningEmployer, setAssigningEmployer] = useState(false);

  // Direct candidates without RM
  const [unassignedDirectCandidates, setUnassignedDirectCandidates] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    name: string;
    status: string;
    dt_passed: boolean;
    created_at: string;
  }[]>([]);
  const [assignDirectCandidateModal, setAssignDirectCandidateModal] = useState<any | null>(null);
  const [selectedDirectCandidateRmId, setSelectedDirectCandidateRmId] = useState('');
  const [assigningDirectCandidate, setAssigningDirectCandidate] = useState(false);

  // Resolution modal
  const [resolveModal, setResolveModal] = useState<EscalationItem | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolving, setResolving] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchOverviewData = async () => {
    try {
      setLoading(true);

      // 1. Supply side metrics
      const [
        candsTotalRes,
        candsInGatesRes,
        candsInterviewReadyRes,
        stPendingRes,
      ] = await Promise.all([
        supabase.from('candidates').select('id', { count: 'exact', head: true }),
        supabase
          .from('candidates')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'in_progress'),
        supabase
          .from('candidates')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'interview_ready'),
        supabase
          .from('academic_requests')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending_assignment'),
      ]);

      setTotalCandidates(candsTotalRes.count || 0);
      setInGatesCount(candsInGatesRes.count || 0);
      setInterviewReadyCount(candsInterviewReadyRes.count || 0);
      setPendingStRequestsCount(stPendingRes.count || 0);

      // 2. Demand side metrics
      const [
        activeJobsRes,
        activeAppsRes,
        offerSentRes,
        revealGateRes,
      ] = await Promise.all([
        supabase
          .from('job_requirements')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .not('status', 'in', '("placed","rejected")'),
        supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'offer_sent'),
        supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'reveal_gate'),
      ]);

      setActiveJobsCount(activeJobsRes.count || 0);
      setActiveApplicationsCount(activeAppsRes.count || 0);
      setOfferSentCount(offerSentRes.count || 0);
      setRevealGateActiveCount(revealGateRes.count || 0);

      // 2b. Additional Pipeline Health Metrics
      const nowObj = new Date();
      const startOfMonth = new Date(nowObj.getFullYear(), nowObj.getMonth(), 1).toISOString();

      const [
        coolingRes,
        lockedRes,
        cohortsRes,
        placedMonthRes,
      ] = await Promise.all([
        supabase
          .from('cooling_periods')
          .select('id', { count: 'exact', head: true })
          .eq('gate_type', 'dt')
          .eq('status', 'active'),
        supabase
          .from('candidates')
          .select('id', { count: 'exact', head: true })
          .eq('final_test_locked', true),
        supabase
          .from('cohorts')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'placed')
          .gte('updated_at', startOfMonth),
      ]);

      setDtCoolingCount(coolingRes.count || 0);
      setFinalTestLockedCount(lockedRes.count || 0);
      setActiveCohortsCount(cohortsRes.count || 0);
      setPlacementsThisMonthCount(placedMonthRes.count || 0);

      // Unread Employer Messages
      const { data: teamEmpRms } = await supabase
        .from('profiles')
        .select('id')
        .eq('internal_role', 'employer_requirements_rm')
        .eq('is_internal', true);

      const teamEmpRmIds = (teamEmpRms || []).map((r) => r.id);
      let teamEmployerIds: string[] = [];

      if (teamEmpRmIds.length > 0) {
        const { data: empAss } = await supabase
          .from('rm_assignments')
          .select('entity_id')
          .eq('entity_type', 'employer')
          .eq('active', true)
          .in('rm_profile_id', teamEmpRmIds);

        teamEmployerIds = (empAss || []).map((a) => a.entity_id);
      }

      if (teamEmployerIds.length > 0) {
        const { count: unreadCount } = await supabase
          .from('employer_rm_messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_type', 'employer')
          .eq('read', false)
          .in('employer_id', teamEmployerIds);

        setUnreadEmployerMessagesCount(unreadCount || 0);
      } else {
        const { count: unreadCount } = await supabase
          .from('employer_rm_messages')
          .select('id', { count: 'exact', head: true })
          .eq('sender_type', 'employer')
          .eq('read', false);

        setUnreadEmployerMessagesCount(unreadCount || 0);
      }

      // 3. RM Workload
      const { data: rmProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, internal_role')
        .in('internal_role', ['candidate_supplier_rm', 'employer_requirements_rm'])
        .eq('is_internal', true);

      if (rmProfiles && rmProfiles.length > 0) {
        const { data: assignments } = await supabase
          .from('rm_assignments')
          .select('rm_profile_id, entity_type, entity_id')
          .eq('active', true);

        const { data: allCandidates } = await supabase
          .from('candidates')
          .select('id, supplier_id, status');

        const { data: allJobs } = await supabase
          .from('job_requirements')
          .select('id, employer_id');

        const { data: allApplications } = await supabase
          .from('job_applications')
          .select('id, job_id, status');

        const workloadList: RMWorkloadItem[] = rmProfiles.map((rm) => {
          const rmAssigned = (assignments || []).filter(
            (a) => a.rm_profile_id === rm.id
          );

          if (rm.internal_role === 'candidate_supplier_rm') {
            const supplierIds = rmAssigned
              .filter((a) => a.entity_type === 'supplier')
              .map((a) => a.entity_id);

            const inFlowCandidates = (allCandidates || []).filter(
              (c) =>
                supplierIds.includes(c.supplier_id) &&
                c.status === 'in_progress'
            );

            return {
              id: rm.id,
              name: `${rm.first_name || ''} ${rm.last_name || ''}`.trim() || rm.email,
              email: rm.email,
              role: 'candidate_supplier_rm',
              assignedAccountsCount: supplierIds.length,
              secondaryCount: inFlowCandidates.length,
              secondaryLabel: 'In-flow Candidates',
            };
          } else {
            const employerIds = rmAssigned
              .filter((a) => a.entity_type === 'employer')
              .map((a) => a.entity_id);

            const jobIds = (allJobs || [])
              .filter((j) => employerIds.includes(j.employer_id))
              .map((j) => j.id);

            const openApps = (allApplications || []).filter(
              (app) =>
                jobIds.includes(app.job_id) &&
                !['placed', 'rejected'].includes(app.status)
            );

            return {
              id: rm.id,
              name: `${rm.first_name || ''} ${rm.last_name || ''}`.trim() || rm.email,
              email: rm.email,
              role: 'employer_requirements_rm',
              assignedAccountsCount: employerIds.length,
              secondaryCount: openApps.length,
              secondaryLabel: 'Open Applications',
            };
          }
        });

        setRmWorkloads(workloadList);
      } else {
        setRmWorkloads([]);
      }

      // 4. Escalations (status = 'open')
      const { data: openEscalations } = await supabase
        .from('escalations')
        .select(`
          id,
          entity_type,
          entity_id,
          note,
          created_at,
          raised_by,
          profiles:raised_by (first_name, last_name, email)
        `)
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (openEscalations) {
        const escList: EscalationItem[] = openEscalations.map((e: any) => ({
          id: e.id,
          entity_type: e.entity_type,
          entity_id: e.entity_id,
          note: e.note,
          raised_by_id: e.raised_by,
          raised_by_name: e.profiles
            ? `${e.profiles.first_name || ''} ${e.profiles.last_name || ''}`.trim() ||
              e.profiles.email
            : 'Internal Staff',
          created_at: e.created_at,
        }));
        setEscalations(escList);
      } else {
        setEscalations([]);
      }

      // 5. Reveal Gate Queue (job_applications where status = 'offer_sent')
      const { data: offerSentApps } = await supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          updated_at,
          job_requirements (
            title,
            employers (company_name)
          )
        `)
        .eq('status', 'offer_sent')
        .order('updated_at', { ascending: true });

      if (offerSentApps) {
        const queueList: RevealQueueItem[] = offerSentApps.map((a: any) => {
          const updatedDate = new Date(a.updated_at || Date.now());
          const diffDays = Math.floor(
            (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            id: a.id,
            candidate_id: a.candidate_id,
            job_title: a.job_requirements?.title || 'Healthcare Role',
            employer_name:
              a.job_requirements?.employers?.company_name || 'Partner Hospital',
            days_in_offer: Math.max(0, diffDays),
            updated_at: a.updated_at,
          };
        });
        setRevealQueue(queueList);
      } else {
        setRevealQueue([]);
      }

      // 6. Suppliers Without Account Manager (Queue & Modal Data)
      const { data: supsData, error: supsErr } = await supabase
        .from('suppliers')
        .select(`
          id,
          company_name,
          company_type,
          country_of_operation,
          healthcare_roles_focus,
          created_at,
          created_by_internal,
          onboarding_checklist,
          user_id,
          profiles:created_by_internal (
            id,
            first_name,
            last_name
          )
        `)
        .not('user_id', 'is', null)
        .order('created_at', { ascending: true });

      if (supsErr) console.error('Error fetching suppliers:', supsErr);

      const allRegisteredSups = supsData || [];

      // Get all active supplier rm assignments
      const { data: activeSupAssignments } = await supabase
        .from('rm_assignments')
        .select('entity_id')
        .eq('entity_type', 'supplier')
        .eq('active', true);

      const assignedSupIdSet = new Set((activeSupAssignments || []).map((a) => a.entity_id));
      const unassignedSups = allRegisteredSups.filter((s) => !assignedSupIdSet.has(s.id));

      if (unassignedSups.length > 0) {
        const unassignedIds = unassignedSups.map((s) => s.id);
        const { data: candCounts } = await supabase
          .from('candidates')
          .select('id, supplier_id')
          .in('supplier_id', unassignedIds);

        const candCountMap: Record<string, number> = {};
        (candCounts || []).forEach((c) => {
          if (c.supplier_id) {
            candCountMap[c.supplier_id] = (candCountMap[c.supplier_id] || 0) + 1;
          }
        });

        const now = Date.now();
        const mappedUnassigned: UnassignedSupplier[] = unassignedSups.map((s: any) => {
          const createdTime = new Date(s.created_at).getTime();
          const daysWithoutRm = Math.max(0, Math.floor((now - createdTime) / (1000 * 60 * 60 * 24)));
          const onboardedBy = s.profiles
            ? `${s.profiles.first_name || ''} ${s.profiles.last_name || ''}`.trim()
            : 'Self-Registered';

          return {
            id: s.id,
            company_name: s.company_name || 'Unnamed Supplier',
            company_type: s.company_type || 'placement_agency',
            country_of_operation: s.country_of_operation || 'International',
            healthcare_roles_focus: s.healthcare_roles_focus || [],
            created_at: s.created_at,
            created_by_internal: s.created_by_internal,
            onboarded_by_name: onboardedBy || 'Self-Registered',
            days_without_rm: daysWithoutRm,
            is_overdue: daysWithoutRm > 3,
            candidates_count: candCountMap[s.id] || 0,
            onboarding_checklist: s.onboarding_checklist,
            user_id: s.user_id,
          };
        });

        setUnassignedSuppliers(mappedUnassigned);
      } else {
        setUnassignedSuppliers([]);
      }

      // Fetch Candidate/Supplier RMs for assignment dropdown
      const { data: csRmProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'candidate_supplier_rm')
        .eq('is_internal', true);

      if (csRmProfiles && csRmProfiles.length > 0) {
        const { data: rmAssignments } = await supabase
          .from('rm_assignments')
          .select('rm_profile_id, entity_id')
          .eq('entity_type', 'supplier')
          .eq('active', true);

        const rmSuppliersMap: Record<string, string[]> = {};
        (rmAssignments || []).forEach((a) => {
          if (!rmSuppliersMap[a.rm_profile_id]) rmSuppliersMap[a.rm_profile_id] = [];
          rmSuppliersMap[a.rm_profile_id].push(a.entity_id);
        });

        const { data: allAssignedCandidates } = await supabase
          .from('candidates')
          .select('assigned_rm_id')
          .not('assigned_rm_id', 'is', null);

        const rmCandCountMap: Record<string, number> = {};
        (allAssignedCandidates || []).forEach((c) => {
          if (c.assigned_rm_id) {
            rmCandCountMap[c.assigned_rm_id] = (rmCandCountMap[c.assigned_rm_id] || 0) + 1;
          }
        });

        const rmOptions: CandidateSupplierRmOption[] = csRmProfiles.map((rm) => {
          const supIds = rmSuppliersMap[rm.id] || [];
          return {
            id: rm.id,
            name: `${rm.first_name || ''} ${rm.last_name || ''}`.trim() || rm.email,
            email: rm.email,
            activeSuppliersCount: supIds.length,
            totalCandidatesCount: rmCandCountMap[rm.id] || 0,
          };
        });

        setCandidateRms(rmOptions);
      } else {
        setCandidateRms([]);
      }

      // Fetch direct candidates with no RM assigned and status != 'placed'
      const { data: directCandsRes } = await supabase
        .from('candidates')
        .select(`
          id,
          first_name,
          last_name,
          status,
          created_at,
          dt_passed_at,
          dt_attempts (id, passed)
        `)
        .is('supplier_id', null)
        .is('assigned_rm_id', null)
        .neq('status', 'placed')
        .order('created_at', { ascending: true });

      const mappedDirectCands = (directCandsRes || []).map((c: any) => {
        const hasPassedDt = Boolean(c.dt_passed_at || (c.dt_attempts && c.dt_attempts.some((a: any) => a.passed)));
        return {
          id: c.id,
          first_name: c.first_name || '',
          last_name: c.last_name || '',
          name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Direct Candidate',
          status: c.status || 'onboarding',
          dt_passed: hasPassedDt,
          created_at: c.created_at,
        };
      });
      setUnassignedDirectCandidates(mappedDirectCands);

      // 5. Fetch Employers without Account Manager
      const { data: allEmployers } = await supabase
        .from('employers')
        .select('id, company_name, industry, country, location, created_at, user_id, is_admin_profile_id, onboarding_checklist')
        .or('user_id.not.is.null,is_admin_profile_id.not.is.null')
        .order('created_at', { ascending: true });

      const allRegisteredEmps = allEmployers || [];

      // Active employer rm assignments
      const { data: activeEmpAssignments } = await supabase
        .from('rm_assignments')
        .select('entity_id')
        .eq('entity_type', 'employer')
        .eq('active', true);

      const assignedEmpIdSet = new Set((activeEmpAssignments || []).map((a) => a.entity_id));
      const unassignedEmps = allRegisteredEmps.filter((e) => !assignedEmpIdSet.has(e.id));

      if (unassignedEmps.length > 0) {
        const unassignedIds = unassignedEmps.map((e) => e.id);
        const { data: jobCounts } = await supabase
          .from('job_requirements')
          .select('id, employer_id')
          .in('employer_id', unassignedIds);

        const jobCountMap: Record<string, number> = {};
        (jobCounts || []).forEach((j) => {
          if (j.employer_id) {
            jobCountMap[j.employer_id] = (jobCountMap[j.employer_id] || 0) + 1;
          }
        });

        const now = Date.now();
        const mappedUnassignedEmps: UnassignedEmployer[] = unassignedEmps.map((e: any) => {
          const createdTime = new Date(e.created_at).getTime();
          const daysWithoutRm = Math.max(0, Math.floor((now - createdTime) / (1000 * 60 * 60 * 24)));

          return {
            id: e.id,
            company_name: e.company_name || 'Unnamed Facility',
            company_type: e.industry || 'Healthcare Facility',
            country: e.country || e.location || 'Germany',
            created_at: e.created_at,
            days_without_rm: daysWithoutRm,
            is_overdue: daysWithoutRm > 3,
            jobs_count: jobCountMap[e.id] || 0,
            onboarding_checklist: e.onboarding_checklist,
            user_id: e.user_id,
            is_admin_profile_id: e.is_admin_profile_id,
          };
        });

        setUnassignedEmployers(mappedUnassignedEmps);
      } else {
        setUnassignedEmployers([]);
      }

      // Fetch Employer RMs for assignment dropdown (with fallback to internal placement team)
      let { data: empRmProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'employer_requirements_rm')
        .eq('is_internal', true);

      if (!empRmProfiles || empRmProfiles.length === 0) {
        const { data: fallbackProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('internal_role', ['employer_requirements_rm', 'placement_lead', 'super_admin'])
          .eq('is_internal', true);
        empRmProfiles = fallbackProfiles;
      }

      if (empRmProfiles && empRmProfiles.length > 0) {
        const { data: empRmAssignments } = await supabase
          .from('rm_assignments')
          .select('rm_profile_id, entity_id')
          .eq('entity_type', 'employer')
          .eq('active', true);

        const rmEmpsMap: Record<string, string[]> = {};
        (empRmAssignments || []).forEach((a) => {
          if (!rmEmpsMap[a.rm_profile_id]) rmEmpsMap[a.rm_profile_id] = [];
          rmEmpsMap[a.rm_profile_id].push(a.entity_id);
        });

        const empRmOptions: EmployerRmOption[] = empRmProfiles.map((rm) => {
          const empIds = rmEmpsMap[rm.id] || [];
          return {
            id: rm.id,
            name: `${rm.first_name || ''} ${rm.last_name || ''}`.trim() || rm.email,
            email: rm.email,
            activeEmployersCount: empIds.length,
            activeJobsCount: 0,
          };
        });

        setEmployerRms(empRmOptions);
      } else {
        setEmployerRms([]);
      }
    } catch (err) {
      console.error('Error fetching Lead overview data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const handleResolveEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveModal || !user) return;

    try {
      setResolving(true);
      const { error } = await supabase
        .from('escalations')
        .update({
          status: 'resolved',
          resolution_notes: resolutionNote.trim() || 'Resolved by Placement Lead',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
        })
        .eq('id', resolveModal.id);

      if (error) throw error;

      showToast('Escalation resolved successfully.');
      setResolveModal(null);
      setResolutionNote('');
      fetchOverviewData();
    } catch (err: any) {
      console.error('Error resolving escalation:', err);
      showToast(err.message || 'Failed to resolve escalation', 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleAssignRm = async () => {
    if (!assignModalSupplier || !selectedRmId || !user) return;

    try {
      setAssigning(true);

      // 1. INSERT rm_assignments
      const { error: assignErr } = await supabase.from('rm_assignments').insert({
        rm_profile_id: selectedRmId,
        entity_type: 'supplier',
        entity_id: assignModalSupplier.id,
        assigned_by: user.id,
        active: true,
        notes: assignNotes.trim() || null,
      });

      if (assignErr) throw assignErr;

      // 2. UPDATE suppliers.onboarding_checklist
      const currentChecklist = assignModalSupplier.onboarding_checklist || {};
      await supabase
        .from('suppliers')
        .update({
          onboarding_checklist: {
            ...currentChecklist,
            rm_assigned: true,
          },
        })
        .eq('id', assignModalSupplier.id);

      // 3. INSERT notification for assigned RM
      const selectedRm = candidateRms.find((r) => r.id === selectedRmId);
      const rmName = selectedRm?.name || 'Account Manager';
      const companyName = assignModalSupplier.company_name;

      await supabase.from('notifications').insert({
        user_id: selectedRmId,
        title: 'New Supplier Assigned',
        message: `You have been assigned as account manager for ${companyName} (${assignModalSupplier.company_type}, ${assignModalSupplier.country_of_operation}). Introduce yourself and support their onboarding.${assignNotes.trim() ? '\n\nNotes: ' + assignNotes.trim() : ''}`,
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      // 4. INSERT notification for supplier (all active team members of this supplier)
      const { data: teamMembers } = await supabase
        .from('supplier_team_members')
        .select('profile_id, email')
        .eq('supplier_id', assignModalSupplier.id)
        .eq('invite_status', 'accepted');

      const recipientProfileIds = new Set<string>();
      (teamMembers || []).forEach((tm) => {
        if (tm.profile_id) recipientProfileIds.add(tm.profile_id);
      });

      if (assignModalSupplier.user_id) {
        recipientProfileIds.add(assignModalSupplier.user_id);
      }

      if (recipientProfileIds.size > 0) {
        const notifications = Array.from(recipientProfileIds).map((pId) => ({
          user_id: pId,
          title: 'Your Account Manager Has Been Assigned',
          message: `Your TerraTern account manager is ${rmName}. They will be in touch to support your onboarding and candidate pipeline. You can see their contact details in your Company Profile.`,
          type: 'general',
          read: false,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifications);
      }

      // Auto-assign existing unassigned candidates of this supplier to the new RM
      await syncSupplierCandidatesRm(
        supabase,
        assignModalSupplier.id,
        selectedRmId,
        false,
        user.id
      );

      // 5. Close modal, show toast, remove supplier from queue
      showToast(`${companyName} assigned to ${rmName}.`);
      setUnassignedSuppliers((prev) => prev.filter((s) => s.id !== assignModalSupplier.id));
      setAssignModalSupplier(null);
      setSelectedRmId('');
      setAssignNotes('');
    } catch (err: any) {
      console.error('Error assigning RM to supplier:', err);
      showToast(err.message || 'Failed to assign Account Manager.', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const handleAssignDirectCandidateRm = async () => {
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
      setUnassignedDirectCandidates((prev) => prev.filter((c) => c.id !== assignDirectCandidateModal.id));
      setAssignDirectCandidateModal(null);
      setSelectedDirectCandidateRmId('');
    } catch (err: any) {
      console.error('Error assigning direct candidate RM:', err);
      showToast(err.message || 'Failed to assign Account Manager.', 'error');
    } finally {
      setAssigningDirectCandidate(false);
    }
  };

  const handleAssignEmployerRm = async () => {
    if (!assignModalEmployer || !selectedEmployerRmId || !user) return;

    try {
      setAssigningEmployer(true);

      // 1. INSERT rm_assignments
      const { error: assignErr } = await supabase.from('rm_assignments').insert({
        rm_profile_id: selectedEmployerRmId,
        entity_type: 'employer',
        entity_id: assignModalEmployer.id,
        assigned_by: user.id,
        active: true,
        notes: assignEmployerNotes.trim() || null,
      });

      if (assignErr) throw assignErr;

      // 2. UPDATE employers.onboarding_checklist
      const currentChecklist = assignModalEmployer.onboarding_checklist || {};
      await supabase
        .from('employers')
        .update({
          onboarding_checklist: {
            ...currentChecklist,
            rm_assigned: true,
          },
        })
        .eq('id', assignModalEmployer.id);

      // 3. INSERT notification for assigned RM
      const selectedRm = employerRms.find((r) => r.id === selectedEmployerRmId);
      const rmName = selectedRm?.name || 'Account Manager';
      const companyName = assignModalEmployer.company_name;

      await supabase.from('notifications').insert({
        user_id: selectedEmployerRmId,
        title: 'New Employer Assigned',
        message: `You have been assigned as account manager for ${companyName} (${assignModalEmployer.company_type}, ${assignModalEmployer.country}). Introduce yourself and support their candidate pipeline.${assignEmployerNotes.trim() ? '\n\nNotes: ' + assignEmployerNotes.trim() : ''}`,
        type: 'general',
        read: false,
        sent_by: user.id,
      });

      // 4. INSERT notification for employer (all active team members + owner)
      const { data: teamMembers } = await supabase
        .from('employer_team_members')
        .select('profile_id, email')
        .eq('employer_id', assignModalEmployer.id)
        .eq('invite_status', 'accepted');

      const recipientProfileIds = new Set<string>();
      (teamMembers || []).forEach((tm) => {
        if (tm.profile_id) recipientProfileIds.add(tm.profile_id);
      });

      if (assignModalEmployer.user_id) {
        recipientProfileIds.add(assignModalEmployer.user_id);
      }
      if (assignModalEmployer.is_admin_profile_id) {
        recipientProfileIds.add(assignModalEmployer.is_admin_profile_id);
      }

      if (recipientProfileIds.size > 0) {
        const notifications = Array.from(recipientProfileIds).map((pId) => ({
          user_id: pId,
          title: 'Your Account Manager Has Been Assigned',
          message: `Your TerraTern account manager is ${rmName}. They will be in touch to support your hiring pipeline. You can message them directly in the Messages tab.`,
          type: 'general',
          read: false,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifications);
      }

      // 5. Close modal, show toast, remove from local queue
      showToast(`${companyName} assigned to ${rmName}.`);
      setUnassignedEmployers((prev) => prev.filter((e) => e.id !== assignModalEmployer.id));
      setAssignModalEmployer(null);
      setSelectedEmployerRmId('');
      setAssignEmployerNotes('');
    } catch (err: any) {
      console.error('Error assigning Employer RM:', err);
      showToast(err.message || 'Failed to assign Account Manager.', 'error');
    } finally {
      setAssigningEmployer(false);
    }
  };

  const supplyCards = [
    {
      title: 'Total Candidates',
      count: totalCandidates,
      icon: Users,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tab: 'candidate_pipeline',
    },
    {
      title: 'In Qualification Gates',
      count: inGatesCount,
      icon: Layers,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      tab: 'candidate_pipeline',
    },
    {
      title: 'Interview Ready',
      count: interviewReadyCount,
      icon: Sparkles,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tab: 'candidate_pipeline',
    },
    {
      title: 'ST Requests Pending',
      count: pendingStRequestsCount,
      icon: HelpCircle,
      color: pendingStRequestsCount > 0 ? 'text-amber-600' : 'text-slate-500',
      bg: pendingStRequestsCount > 0 ? 'bg-amber-50' : 'bg-slate-50',
      tab: 'candidate_pipeline',
    },
  ];

  const demandCards = [
    {
      title: 'Active Jobs',
      count: activeJobsCount,
      icon: Briefcase,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      tab: 'employer_pipeline',
    },
    {
      title: 'Open Applications',
      count: activeApplicationsCount,
      icon: FileCheck2,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      tab: 'employer_pipeline',
    },
    {
      title: 'Offer Sent',
      count: offerSentCount,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      tab: 'reveal_gate',
    },
    {
      title: 'Reveal Gate Active',
      count: revealGateActiveCount,
      icon: Lock,
      color: revealGateActiveCount > 0 ? 'text-emerald-600' : 'text-slate-500',
      bg: revealGateActiveCount > 0 ? 'bg-emerald-50' : 'bg-slate-50',
      tab: 'reveal_gate',
    },
  ];

  const healthTelemetryCards = [
    {
      title: 'Candidates in DT Cooling',
      count: dtCoolingCount,
      icon: Clock,
      color: dtCoolingCount > 0 ? 'text-amber-600' : 'text-slate-500',
      bg: dtCoolingCount > 0 ? 'bg-amber-50' : 'bg-slate-50',
      tab: 'candidate_pipeline',
    },
    {
      title: 'Final Assessment Locked',
      count: finalTestLockedCount,
      icon: Lock,
      color: finalTestLockedCount > 0 ? 'text-rose-600' : 'text-slate-500',
      bg: finalTestLockedCount > 0 ? 'bg-rose-50' : 'bg-slate-50',
      tab: 'candidate_pipeline',
    },
    {
      title: 'Cohorts Active',
      count: activeCohortsCount,
      icon: GraduationCap,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tab: 'cohorts',
    },
    {
      title: 'Placements This Month',
      count: placementsThisMonthCount,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tab: 'placements',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
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

      {/* Header bar with subtitle & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#E2E8F4]">
        <div>
          <p className="text-[13px] text-[#4A5568]">
            Full-spectrum visibility over candidate qualification gates, employer demand, and reveal gate completions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchOverviewData();
          }}
          disabled={loading || refreshing}
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[8px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-slate-500 ${
              refreshing ? 'animate-spin' : ''
            }`}
          />
          <span>{refreshing ? 'Syncing...' : 'Sync Pipeline'}</span>
        </button>
      </div>

      {/* PIPELINE HEALTH: 2x4 Grid */}
      <div className="space-y-4">
        <h2 className="text-[14px] font-semibold text-[#1B3270]">
          Pipeline Health and Capacity
        </h2>

        {/* Row 1: Supply */}
        <div>
          <div className="text-[12px] font-medium text-slate-500 mb-2.5 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>Supply Side (Candidates & Academic Gates)</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {supplyCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  onClick={() => onNavigateTab(card.tab)}
                  className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">
                      {card.title}
                    </span>
                    <Icon className="w-4 h-4 text-[#2952A3] stroke-[1.5]" />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">
                      {loading ? '—' : card.count}
                    </span>
                    <span className="text-[11px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] flex items-center transition-colors">
                      View <ArrowRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 2: Demand */}
        <div className="pt-2">
          <div className="text-[12px] font-medium text-slate-500 mb-2.5 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500" />
            <span>Demand Side (Employers, Offers & Reveal Gate)</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {demandCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  onClick={() => onNavigateTab(card.tab)}
                  className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">
                      {card.title}
                    </span>
                    <Icon className="w-4 h-4 text-[#2952A3] stroke-[1.5]" />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">
                      {loading ? '—' : card.count}
                    </span>
                    <span className="text-[11px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] flex items-center transition-colors">
                      View <ArrowRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Row 3: Qualification & Placement Velocity */}
        <div className="pt-2">
          <div className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Velocity & Retention (Cooling, Locked Tests, Cohorts & Placements)</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {healthTelemetryCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  onClick={() => onNavigateTab(card.tab)}
                  className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs hover:border-slate-300 transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-500">
                      {card.title}
                    </span>
                    <div className={`p-2 rounded-[6px] ${card.bg}`}>
                      <Icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">
                      {loading ? '—' : card.count}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400 group-hover:text-[#1B3270] flex items-center transition-colors">
                      View <ArrowRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* UNREAD EMPLOYER MESSAGES SECTION */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
              unreadEmployerMessagesCount > 0
                ? 'bg-purple-100 text-purple-700'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                Unread Employer Messages
              </h3>
              {unreadEmployerMessagesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                  {unreadEmployerMessagesCount} unread
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {unreadEmployerMessagesCount > 0
                ? `${unreadEmployerMessagesCount} new unread message${unreadEmployerMessagesCount > 1 ? 's' : ''} from employer accounts assigned to your team's RMs.`
                : 'All employer-RM message threads are caught up. Zero unread messages.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('employer_pipeline')}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#1B3270] hover:bg-[#152758] text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
        >
          <span>View in Employer Pipeline</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* RM ASSIGNMENT QUEUE CALLOUT BANNER */}
      {(unassignedSuppliers.length > 0 || unassignedEmployers.length > 0) && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                {unassignedSuppliers.length + unassignedEmployers.length} Partner Accounts Awaiting RM Assignment
              </h4>
              <p className="text-[11px] text-amber-700 mt-0.5">
                {unassignedSuppliers.length} supplier{unassignedSuppliers.length === 1 ? '' : 's'} and {unassignedEmployers.length} employer{unassignedEmployers.length === 1 ? '' : 's'} need dedicated account managers assigned.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('rm_assignment_queue')}
            className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#152758] text-white text-xs font-semibold rounded-lg shadow-2xs shrink-0 cursor-pointer"
          >
            Open Assignment Queue
          </button>
        </div>
      )}

      {/* UNASSIGNED DIRECT CANDIDATES ALERT */}
      {unassignedDirectCandidates.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 shadow-2xs space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-amber-900">
                  {unassignedDirectCandidates.length} direct candidate{unassignedDirectCandidates.length === 1 ? '' : 's'} have no account manager assigned.
                </h4>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Direct candidates requiring dedicated qualification guidance and onboarding support.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-amber-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-amber-100/50 text-amber-900 font-semibold text-[11px] border-b border-amber-200/60">
                  <tr>
                    <th className="py-2.5 px-3.5">Candidate Name</th>
                    <th className="py-2.5 px-3.5">Status</th>
                    <th className="py-2.5 px-3.5">DT Passed?</th>
                    <th className="py-2.5 px-3.5">Created Date</th>
                    <th className="py-2.5 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100/60 text-slate-700">
                  {unassignedDirectCandidates.map((cand) => (
                    <tr key={cand.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="py-2.5 px-3.5 font-medium text-slate-900">
                        {cand.name}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                          {cand.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5">
                        {cand.dt_passed ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Passed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            No
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-500 whitespace-nowrap">
                        {formatDate(cand.created_at)}
                      </td>
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignDirectCandidateModal(cand);
                            if (candidateRms.length > 0) {
                              setSelectedDirectCandidateRmId(candidateRms[0].id);
                            }
                          }}
                          className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] shadow-2xs transition-colors cursor-pointer"
                        >
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIERS WITHOUT ACCOUNT MANAGER SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-[#1B3270]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Suppliers Without Account Manager
            </h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1B3270]/10 text-[#1B3270]">
            {unassignedSuppliers.length} Pending Assignment
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-[10px] animate-pulse" />
            ))}
          </div>
        ) : unassignedSuppliers.length === 0 ? (
          <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 text-center shadow-2xs">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-slate-800">All registered suppliers have an assigned Account Manager.</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Zero unassigned partners currently in the onboarding queue.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unassignedSuppliers.map((sup) => (
              <div
                key={sup.id}
                className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {sup.company_name}
                      </h4>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#7EB3E8]/20 text-[#1B3270] uppercase">
                        {sup.company_type.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {sup.is_overdue && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center space-x-1 flex-shrink-0 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Overdue</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600 border-t border-[#E2E8F4]/70 pt-2.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Country:</span>
                      <span className="font-medium text-slate-800">{sup.country_of_operation}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Onboarded by:</span>
                      <span className="font-medium text-slate-800">{sup.onboarded_by_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account created:</span>
                      <span className="text-slate-700">{new Date(sup.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Days without RM:</span>
                      <span className={`font-bold ${sup.is_overdue ? 'text-amber-700' : 'text-slate-800'}`}>
                        {sup.days_without_rm} day{sup.days_without_rm === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E2E8F4]">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalSupplier(sup);
                      setSelectedRmId(candidateRms[0]?.id || '');
                      setAssignNotes('');
                    }}
                    className="w-full py-2 px-3 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>Assign Account Manager</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EMPLOYERS WITHOUT ACCOUNT MANAGER SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-[#1B3270]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Employers Without Account Manager
            </h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#1B3270]/10 text-[#1B3270]">
            {unassignedEmployers.length} Pending Assignment
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 bg-slate-100 rounded-[10px] animate-pulse" />
            ))}
          </div>
        ) : unassignedEmployers.length === 0 ? (
          <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 text-center shadow-2xs">
            <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-slate-800">
              All registered employers have an assigned Account Manager.
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Zero unassigned healthcare partners currently in the queue.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {unassignedEmployers.map((emp) => (
              <div
                key={emp.id}
                className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {emp.company_name}
                      </h4>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#7EB3E8]/20 text-[#1B3270] uppercase">
                        {emp.company_type}
                      </span>
                    </div>

                    {emp.is_overdue && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 flex items-center space-x-1 flex-shrink-0 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Overdue</span>
                      </span>
                    )}
                  </div>

                  <div className="mt-3 space-y-1.5 text-xs text-slate-600 border-t border-[#E2E8F4]/70 pt-2.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Country:</span>
                      <span className="font-medium text-slate-800">{emp.country}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Jobs Posted:</span>
                      <span className="font-semibold text-slate-900">{emp.jobs_count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Account created:</span>
                      <span className="text-slate-700">{new Date(emp.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Days without RM:</span>
                      <span className={`font-bold ${emp.is_overdue ? 'text-amber-700' : 'text-slate-800'}`}>
                        {emp.days_without_rm} day{emp.days_without_rm === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E2E8F4]">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalEmployer(emp);
                      setSelectedEmployerRmId(employerRms[0]?.id || '');
                      setAssignEmployerNotes('');
                    }}
                    className="w-full py-2 px-3 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>Assign Account Manager</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RM WORKLOAD SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Relationship Manager Workload & Flow
          </h2>
          <span className="text-xs text-slate-400">
            {rmWorkloads.length} Relationship Managers active
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs p-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : rmWorkloads.length === 0 ? (
            <div className="py-8 text-center">
              <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                No Relationship Managers active yet.
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('my_team')}
                className="mt-3 px-3 py-1.5 bg-[#1B3270] text-white rounded-[6px] text-xs font-semibold cursor-pointer hover:bg-[#2952A3] transition-colors"
              >
                Provision RM Account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rmWorkloads.map((rm) => (
                <div
                  key={rm.id}
                  className="p-4 rounded-[8px] border border-[#E2E8F4] bg-[#F8FAFD] space-y-3 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">
                        {rm.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 truncate">
                        {rm.email}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rm.role === 'candidate_supplier_rm'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {rm.role === 'candidate_supplier_rm'
                        ? 'Candidate RM'
                        : 'Employer RM'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#E2E8F4] text-xs">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">
                        {rm.role === 'candidate_supplier_rm'
                          ? 'Suppliers'
                          : 'Employers'}
                      </span>
                      <div className="text-base font-bold text-slate-800">
                        {rm.assignedAccountsCount}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 uppercase">
                        {rm.secondaryLabel}
                      </span>
                      <div className="text-base font-bold text-slate-800">
                        {rm.secondaryCount}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* TWO COLUMN GRID: ESCALATIONS & REVEAL GATE QUEUE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ESCALATIONS CARD */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Open Operational Escalations
              </h3>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {escalations.length} Open
            </span>
          </div>

          <div className="p-5 flex-1">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : escalations.length === 0 ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">
                  All clear — zero unresolved operational escalations.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F4] -my-2">
                {escalations.map((esc) => (
                  <div
                    key={esc.id}
                    className="py-3 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                          {esc.entity_type}
                        </span>
                        <span className="text-slate-400 text-[11px]">
                          By {esc.raised_by_name} •{' '}
                          {new Date(esc.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-slate-800 font-medium leading-relaxed">
                        {esc.note}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setResolveModal(esc)}
                      className="px-2.5 py-1 bg-white border border-[#E2E8F4] hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 text-slate-700 rounded-[6px] font-semibold text-[11px] transition-colors cursor-pointer flex-shrink-0"
                    >
                      Mark Resolved
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* REVEAL GATE QUEUE */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-[#1B3270]" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Reveal Gate Queue (Offer Sent)
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('reveal_gate')}
              className="text-[11px] font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center"
            >
              View Full Queue <ArrowRight className="w-3 h-3 ml-1" />
            </button>
          </div>

          <div className="p-5 flex-1">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
                ))}
              </div>
            ) : revealQueue.length === 0 ? (
              <div className="py-12 text-center">
                <Check className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">
                  No applications in Reveal Gate stage.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F4] -my-2">
                {revealQueue.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900">{item.job_title}</h4>
                      <p className="text-slate-500 text-[11px]">
                        {item.employer_name} • Candidate ID: #{item.candidate_id.slice(0, 6)}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block uppercase font-semibold">
                          Days in Stage
                        </span>
                        <span
                          className={`font-bold ${
                            item.days_in_offer > 14
                              ? 'text-rose-600'
                              : item.days_in_offer > 7
                              ? 'text-amber-600'
                              : 'text-slate-700'
                          }`}
                        >
                          {item.days_in_offer} days
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onNavigateTab('reveal_gate')}
                        className="px-2.5 py-1 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[6px] font-semibold text-[11px] transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ASSIGN ACCOUNT MANAGER MODAL */}
      {assignModalSupplier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setAssignModalSupplier(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">
              Assign Account Manager to {assignModalSupplier.company_name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Allocate a dedicated Candidate / Supplier RM to lead this sourcing partner's onboarding.
            </p>

            {/* Supplier summary card */}
            <div className="p-3.5 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] space-y-2 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Company Type:</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {assignModalSupplier.company_type.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Country of Operation:</span>
                <span className="font-semibold text-slate-800">
                  {assignModalSupplier.country_of_operation}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Healthcare Roles Focus:</span>
                <span className="font-semibold text-slate-800">
                  {assignModalSupplier.healthcare_roles_focus && assignModalSupplier.healthcare_roles_focus.length > 0
                    ? assignModalSupplier.healthcare_roles_focus.join(', ')
                    : 'General Healthcare'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Candidates Added So Far:</span>
                <span className="font-bold text-[#1B3270]">
                  {assignModalSupplier.candidates_count}
                </span>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Account Manager (RM)
                </label>
                {candidateRms.length === 0 ? (
                  <p className="text-xs text-rose-600">
                    No active Candidate/Supplier RMs found in the organization.
                  </p>
                ) : (
                  <select
                    value={selectedRmId}
                    onChange={(e) => setSelectedRmId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-900 font-medium outline-none focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270]"
                  >
                    {candidateRms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} — {rm.activeSuppliersCount} active suppliers | {rm.totalCandidatesCount} total candidates
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notes for RM (Optional)
                </label>
                <textarea
                  rows={3}
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Any context to share with the RM regarding this partner..."
                  className="w-full p-2.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] text-slate-800 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalSupplier(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignRm}
                  disabled={assigning || !selectedRmId}
                  className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Assign & Notify</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN EMPLOYER RM MODAL */}
      {assignModalEmployer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setAssignModalEmployer(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Assign Account Manager (Employer RM)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Allocate a dedicated Employer/Requirements RM to oversee vacancy coordination, interview scheduling, and reveal gate fulfillment.
            </p>

            <div className="p-3 bg-slate-50 border border-[#E2E8F4] rounded-[6px] mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Employer Facility:</span>
                <span className="font-bold text-slate-900">{assignModalEmployer.company_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Country:</span>
                <span className="text-slate-700">{assignModalEmployer.country}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Active Jobs:</span>
                <span className="text-slate-700">{assignModalEmployer.jobs_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Days without RM:</span>
                <span className={`font-semibold ${assignModalEmployer.is_overdue ? 'text-amber-700' : 'text-slate-700'}`}>
                  {assignModalEmployer.days_without_rm} days
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Account Manager (Employer RM) *
                </label>
                {employerRms.length === 0 ? (
                  <p className="text-xs text-rose-600">
                    No active Employer RMs found in the organization.
                  </p>
                ) : (
                  <select
                    value={selectedEmployerRmId}
                    onChange={(e) => setSelectedEmployerRmId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-900 font-medium outline-none focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270]"
                  >
                    {employerRms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.activeEmployersCount} active employers)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Notes for RM (Optional)
                </label>
                <textarea
                  rows={3}
                  value={assignEmployerNotes}
                  onChange={(e) => setAssignEmployerNotes(e.target.value)}
                  placeholder="Any context to share with the RM regarding this employer partner..."
                  className="w-full p-2.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] text-slate-800 resize-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalEmployer(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignEmployerRm}
                  disabled={assigningEmployer || !selectedEmployerRmId}
                  className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  {assigningEmployer && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Assign & Notify</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN DIRECT CANDIDATE RM MODAL */}
      {assignDirectCandidateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setAssignDirectCandidateModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Assign Account Manager
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Allocate a dedicated Candidate/Supplier RM to support {assignDirectCandidateModal.name} through qualification and placement.
            </p>

            <div className="p-3 bg-slate-50 border border-[#E2E8F4] rounded-[6px] mb-4 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Candidate:</span>
                <span className="font-bold text-slate-900">{assignDirectCandidateModal.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-slate-700 capitalize">{assignDirectCandidateModal.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">DT Passed:</span>
                <span className={assignDirectCandidateModal.dt_passed ? 'text-emerald-600 font-semibold' : 'text-slate-600'}>
                  {assignDirectCandidateModal.dt_passed ? 'Yes' : 'No'}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Select Account Manager (Candidate/Supplier RM) *
                </label>
                {candidateRms.length === 0 ? (
                  <p className="text-xs text-rose-600">
                    No active Candidate/Supplier RMs found in the organization.
                  </p>
                ) : (
                  <select
                    value={selectedDirectCandidateRmId}
                    onChange={(e) => setSelectedDirectCandidateRmId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-900 font-medium outline-none focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270]"
                  >
                    {candidateRms.map((rm) => (
                      <option key={rm.id} value={rm.id}>
                        {rm.name} ({rm.totalCandidatesCount} active candidates)
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignDirectCandidateModal(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignDirectCandidateRm}
                  disabled={assigningDirectCandidate || !selectedDirectCandidateRmId}
                  className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  {assigningDirectCandidate && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Assign & Notify</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESOLUTION MODAL */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setResolveModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Resolve Escalation
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Document the resolution steps before marking this operational bottleneck as resolved.
            </p>

            <div className="p-3 bg-slate-50 border border-[#E2E8F4] rounded-[6px] mb-4 text-xs">
              <span className="font-semibold text-slate-700 block mb-1">
                Escalation Summary:
              </span>
              <p className="text-slate-600">{resolveModal.note}</p>
            </div>

            <form onSubmit={handleResolveEscalation} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Resolution Note / Action Taken
                </label>
                <textarea
                  rows={3}
                  required
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Detail how this escalation was resolved..."
                  className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setResolveModal(null)}
                  className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolving}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                >
                  {resolving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Resolving...</span>
                    </>
                  ) : (
                    <span>Mark Resolved</span>
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

export default LeadOverviewTab;
