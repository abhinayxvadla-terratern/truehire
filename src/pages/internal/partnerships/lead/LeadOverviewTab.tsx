import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Building2,
  Briefcase,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Activity,
  Check,
  Loader2,
  ShieldCheck,
  FileCheck,
  Bell,
  Users,
} from 'lucide-react';
import { notifyByRole } from '../../../../utils/notificationRouting';

interface AssociateWorkloadRow {
  id: string;
  name: string;
  role: 'supplier_partnerships_associate' | 'employer_partnerships_associate';
  accountsOnboarded: number;
  awaitingRm: number;
  thisMonthCount: number;
}

interface AssignmentActivity {
  id: string;
  entity_type: 'supplier' | 'employer';
  company_name: string;
  rm_name: string;
  assigned_by_name: string;
  created_at: string;
}

interface LeadOverviewTabProps {
  onNavigateTab: (tabId: string) => void;
}

export const LeadOverviewTab: React.FC<LeadOverviewTabProps> = ({ onNavigateTab }) => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Stats
  const [supplierAssociateCount, setSupplierAssociateCount] = useState(0);
  const [employerAssociateCount, setEmployerAssociateCount] = useState(0);
  const [suppliersAllDocsVerifiedCount, setSuppliersAllDocsVerifiedCount] = useState(0);
  const [employersCompleteProfileCount, setEmployersCompleteProfileCount] = useState(0);

  // Supplier RM Status
  const [supplierAssignedRmCount, setSupplierAssignedRmCount] = useState(0);
  const [supplierUnassignedRmCount, setSupplierUnassignedRmCount] = useState(0);
  const [notifyingSupplierTeam, setNotifyingSupplierTeam] = useState(false);
  const [supplierNotified, setSupplierNotified] = useState(false);

  // Employer RM Status
  const [employerAssignedRmCount, setEmployerAssignedRmCount] = useState(0);
  const [employerUnassignedRmCount, setEmployerUnassignedRmCount] = useState(0);
  const [notifyingEmployerTeam, setNotifyingEmployerTeam] = useState(false);
  const [employerNotified, setEmployerNotified] = useState(false);

  // Associate Workload & Activities
  const [associateWorkloads, setAssociateWorkloads] = useState<AssociateWorkloadRow[]>([]);
  const [recentActivities, setRecentActivities] = useState<AssignmentActivity[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchData = async () => {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const startOfMonthIso = startOfMonth.toISOString();

      // 1. Fetch associate profiles
      const { data: associates } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, internal_role')
        .in('internal_role', [
          'supplier_partnerships_associate',
          'employer_partnerships_associate',
        ])
        .eq('is_internal', true)
        .order('first_name', { ascending: true });

      const assocList = associates || [];
      const supAssocs = assocList.filter((a) => a.internal_role === 'supplier_partnerships_associate');
      const empAssocs = assocList.filter((a) => a.internal_role === 'employer_partnerships_associate');
      setSupplierAssociateCount(supAssocs.length);
      setEmployerAssociateCount(empAssocs.length);

      // 2. Active RM assignments
      const { data: activeAssignments } = await supabase
        .from('rm_assignments')
        .select('id, entity_id, entity_type')
        .eq('active', true);

      const assignedSupplierIds = new Set<string>();
      const assignedEmployerIds = new Set<string>();

      (activeAssignments || []).forEach((a) => {
        if (a.entity_type === 'supplier') assignedSupplierIds.add(a.entity_id);
        if (a.entity_type === 'employer') assignedEmployerIds.add(a.entity_id);
      });

      // 3. Fetch suppliers where user_id is not null (and also all for workload)
      const { data: allSuppliers } = await supabase
        .from('suppliers')
        .select('id, company_name, created_by_internal, created_at, user_id');

      const supList = allSuppliers || [];

      let supAssigned = 0;
      let supUnassigned = 0;
      supList.forEach((s) => {
        if (assignedSupplierIds.has(s.id)) {
          supAssigned++;
        } else {
          supUnassigned++;
        }
      });
      setSupplierAssignedRmCount(supAssigned);
      setSupplierUnassignedRmCount(supUnassigned);

      // 4. Fetch employers (and for workload & profile %)
      const { data: allEmployers } = await supabase
        .from('employers')
        .select(`
          id,
          company_name,
          company_size,
          primary_contact_name,
          country,
          location,
          office_address,
          healthcare_roles_hiring,
          annual_hiring_volume,
          onboarding_checklist,
          created_by_internal,
          created_at,
          user_id
        `);

      const empList = allEmployers || [];

      let empAssigned = 0;
      let empUnassigned = 0;
      empList.forEach((e) => {
        if (assignedEmployerIds.has(e.id)) {
          empAssigned++;
        } else {
          empUnassigned++;
        }
      });
      setEmployerAssignedRmCount(empAssigned);
      setEmployerUnassignedRmCount(empUnassigned);

      // 5. Suppliers with all 5 compliance docs verified
      const { data: verifiedDocs } = await supabase
        .from('supplier_documents')
        .select('supplier_id, verification_status')
        .eq('verification_status', 'verified');

      const verifiedCountBySupplier: Record<string, number> = {};
      (verifiedDocs || []).forEach((d) => {
        if (d.supplier_id) {
          verifiedCountBySupplier[d.supplier_id] = (verifiedCountBySupplier[d.supplier_id] || 0) + 1;
        }
      });

      let suppliers5VerifiedCount = 0;
      Object.values(verifiedCountBySupplier).forEach((count) => {
        if (count >= 5) suppliers5VerifiedCount++;
      });
      setSuppliersAllDocsVerifiedCount(suppliers5VerifiedCount);

      // 6. Employers with complete profile (profile_completion_pct = 100)
      let completeProfileCount = 0;
      empList.forEach((e) => {
        const checklist = (e.onboarding_checklist as any) || {};
        if (checklist.profile_completed === true) {
          completeProfileCount++;
        } else {
          // Check standard required profile fields
          const hasIdentity = Boolean(e.company_name && e.company_size);
          const hasContact = Boolean(e.primary_contact_name && (e.country || e.location || e.office_address));
          const hasNeeds = Boolean(
            Array.isArray(e.healthcare_roles_hiring) &&
            e.healthcare_roles_hiring.length > 0 &&
            e.annual_hiring_volume
          );
          if (hasIdentity && hasContact && hasNeeds) {
            completeProfileCount++;
          }
        }
      });
      setEmployersCompleteProfileCount(completeProfileCount);

      // 7. Associate Workload calculation
      const workloadRows: AssociateWorkloadRow[] = assocList.map((assoc) => {
        const isSupplierAssoc = assoc.internal_role === 'supplier_partnerships_associate';
        const name = `${assoc.first_name || ''} ${assoc.last_name || ''}`.trim() || assoc.email;

        if (isSupplierAssoc) {
          const accounts = supList.filter((s) => s.created_by_internal === assoc.id);
          const awaiting = accounts.filter((s) => !assignedSupplierIds.has(s.id)).length;
          const thisMonth = accounts.filter((s) => s.created_at >= startOfMonthIso).length;
          return {
            id: assoc.id,
            name,
            role: 'supplier_partnerships_associate',
            accountsOnboarded: accounts.length,
            awaitingRm: awaiting,
            thisMonthCount: thisMonth,
          };
        } else {
          const accounts = empList.filter((e) => e.created_by_internal === assoc.id);
          const awaiting = accounts.filter((e) => !assignedEmployerIds.has(e.id)).length;
          const thisMonth = accounts.filter((e) => e.created_at >= startOfMonthIso).length;
          return {
            id: assoc.id,
            name,
            role: 'employer_partnerships_associate',
            accountsOnboarded: accounts.length,
            awaitingRm: awaiting,
            thisMonthCount: thisMonth,
          };
        }
      });
      setAssociateWorkloads(workloadRows);

      // 8. Recent RM assignments activity (last 10)
      const { data: recentRms } = await supabase
        .from('rm_assignments')
        .select(`
          id,
          entity_id,
          entity_type,
          created_at,
          rm:rm_profile_id(first_name, last_name, email),
          assigner:assigned_by(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentRms && recentRms.length > 0) {
        const supMap: Record<string, string> = {};
        supList.forEach((s) => {
          supMap[s.id] = s.company_name;
        });
        const empMap: Record<string, string> = {};
        empList.forEach((e) => {
          empMap[e.id] = e.company_name;
        });

        const activities: AssignmentActivity[] = recentRms.map((r: any) => {
          const cName =
            r.entity_type === 'supplier'
              ? supMap[r.entity_id] || 'Supplier Partner'
              : empMap[r.entity_id] || 'Healthcare Employer';

          const rmName = r.rm
            ? `${r.rm.first_name || ''} ${r.rm.last_name || ''}`.trim() || r.rm.email
            : 'RM';
          const assignerName = r.assigner
            ? `${r.assigner.first_name || ''} ${r.assigner.last_name || ''}`.trim() || r.assigner.email
            : 'Placement Lead';

          return {
            id: r.id,
            entity_type: r.entity_type,
            company_name: cName,
            rm_name: rmName,
            assigned_by_name: assignerName,
            created_at: r.created_at,
          };
        });
        setRecentActivities(activities);
      } else {
        setRecentActivities([]);
      }
    } catch (err) {
      console.error('Error loading Partnerships Lead overview:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleNotifyPlacementTeamForSuppliers = async () => {
    if (supplierUnassignedRmCount === 0 || notifyingSupplierTeam || supplierNotified) return;
    setNotifyingSupplierTeam(true);
    try {
      await notifyByRole(
        supabase,
        'placement_lead',
        'RM Assignment Needed — Supplier Accounts',
        `${supplierUnassignedRmCount} supplier accounts lack an assigned account manager. Review and assign.`,
        'rm_assignment_request',
        user?.id
      );
      setSupplierNotified(true);
      showToast('Placement team notified for unassigned supplier accounts.');
    } catch (err: any) {
      console.error('Error notifying placement team for suppliers:', err);
      alert('Failed to dispatch notification to placement team.');
    } finally {
      setNotifyingSupplierTeam(false);
    }
  };

  const handleNotifyPlacementTeamForEmployers = async () => {
    if (employerUnassignedRmCount === 0 || notifyingEmployerTeam || employerNotified) return;
    setNotifyingEmployerTeam(true);
    try {
      await notifyByRole(
        supabase,
        'placement_lead',
        'RM Assignment Needed — Employer Accounts',
        `${employerUnassignedRmCount} employer accounts lack an assigned account manager. Review and assign.`,
        'rm_assignment_request',
        user?.id
      );
      setEmployerNotified(true);
      showToast('Placement team notified for unassigned employer accounts.');
    } catch (err: any) {
      console.error('Error notifying placement team for employers:', err);
      alert('Failed to dispatch notification to placement team.');
    } finally {
      setNotifyingEmployerTeam(false);
    }
  };

  const statCards = [
    {
      title: 'Supplier Associates',
      count: supplierAssociateCount,
      icon: Building2,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tab: 'team',
    },
    {
      title: 'Employer Associates',
      count: employerAssociateCount,
      icon: Briefcase,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      tab: 'team',
    },
    {
      title: 'Suppliers 5/5 Compliance Verified',
      count: suppliersAllDocsVerifiedCount,
      icon: ShieldCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tab: 'suppliers',
    },
    {
      title: 'Employers 100% Profile Complete',
      count: employersCompleteProfileCount,
      icon: FileCheck,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      tab: 'employers',
    },
    {
      title: 'Suppliers Awaiting RM',
      count: supplierUnassignedRmCount,
      icon: AlertTriangle,
      color: supplierUnassignedRmCount > 0 ? 'text-amber-600' : 'text-slate-500',
      bg: supplierUnassignedRmCount > 0 ? 'bg-amber-50' : 'bg-slate-50',
      tab: 'suppliers',
    },
    {
      title: 'Employers Awaiting RM',
      count: employerUnassignedRmCount,
      icon: AlertTriangle,
      color: employerUnassignedRmCount > 0 ? 'text-rose-600' : 'text-slate-500',
      bg: employerUnassignedRmCount > 0 ? 'bg-rose-50' : 'bg-slate-50',
      tab: 'employers',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[6px] shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Subheader & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <p className="text-sm text-slate-500">
            Executive oversight across agency networks, employer onboarding pipelines, and RM handoffs.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[8px] hover:bg-slate-50 hover:text-[#1B3270] transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Metrics'}</span>
        </button>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[104px] bg-white border border-[#E2E8F4] rounded-[12px] animate-pulse p-5"
            />
          ))
        ) : (
          statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                onClick={() => onNavigateTab(card.tab)}
                className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs hover:border-[#1B3270]/30 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors line-clamp-2">
                    {card.title}
                  </span>
                  <div className={`p-1.5 rounded-md ${card.bg} ${card.color} shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-[#1B3270]">
                    {card.count.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-[#94A3B8] group-hover:text-[#2952A3] flex items-center font-medium">
                    View
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* SECTION: RM ASSIGNMENT STATUS (INFORMATIONAL - NO ASSIGN ACTION) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-[#1B3270]" />
            <h2 className="text-base font-bold text-slate-800">
              RM Assignment Status
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Account managers are assigned by the Placement Team
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SUPPLIER RM STATUS */}
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-[#1B3270]">Supplier Account Managers</h3>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {supplierAssignedRmCount + supplierUnassignedRmCount} Registered Partners
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-[8px] bg-emerald-50 border border-emerald-200">
                <p className="text-[11px] font-semibold text-emerald-800">Have Account Managers</p>
                <p className="text-xl font-bold text-emerald-900 mt-1">{supplierAssignedRmCount}</p>
                <p className="text-[10px] text-emerald-700 mt-0.5">Active relationship management</p>
              </div>
              <div className="p-3 rounded-[8px] bg-amber-50 border border-amber-200">
                <p className="text-[11px] font-semibold text-amber-800">No Account Manager</p>
                <p className="text-xl font-bold text-amber-900 mt-1">{supplierUnassignedRmCount}</p>
                <p className="text-[10px] text-amber-700 mt-0.5">Awaiting assignment by Placement Lead</p>
              </div>
            </div>

            {supplierUnassignedRmCount > 0 ? (
              <div className="p-4 rounded-[8px] bg-amber-50/70 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 font-medium">
                    <strong className="font-bold">{supplierUnassignedRmCount}</strong> supplier{supplierUnassignedRmCount > 1 ? 's are' : ' is'} awaiting an account manager assignment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNotifyPlacementTeamForSuppliers}
                  disabled={notifyingSupplierTeam || supplierNotified}
                  className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] font-semibold text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-60 flex items-center space-x-1.5 shrink-0"
                >
                  {notifyingSupplierTeam ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Notifying...</span>
                    </>
                  ) : supplierNotified ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-300" />
                      <span>Notified</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3 h-3" />
                      <span>Notify Placement Team</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-[8px] bg-[#F8FAFD] border border-[#E2E8F4] text-center text-xs text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline-block mr-1.5" />
                All active supplier accounts have dedicated Account Managers assigned.
              </div>
            )}
          </div>

          {/* EMPLOYER RM STATUS */}
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <div className="flex items-center space-x-2">
                <Briefcase className="w-4 h-4 text-sky-600" />
                <h3 className="text-sm font-bold text-[#1B3270]">Employer Account Managers</h3>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {employerAssignedRmCount + employerUnassignedRmCount} Registered Facilities
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-[8px] bg-emerald-50 border border-emerald-200">
                <p className="text-[11px] font-semibold text-emerald-800">Have Account Managers</p>
                <p className="text-xl font-bold text-emerald-900 mt-1">{employerAssignedRmCount}</p>
                <p className="text-[10px] text-emerald-700 mt-0.5">Active pipeline coordination</p>
              </div>
              <div className="p-3 rounded-[8px] bg-amber-50 border border-amber-200">
                <p className="text-[11px] font-semibold text-amber-800">No Account Manager</p>
                <p className="text-xl font-bold text-amber-900 mt-1">{employerUnassignedRmCount}</p>
                <p className="text-[10px] text-amber-700 mt-0.5">Awaiting assignment by Placement Lead</p>
              </div>
            </div>

            {employerUnassignedRmCount > 0 ? (
              <div className="p-4 rounded-[8px] bg-amber-50/70 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900 font-medium">
                    <strong className="font-bold">{employerUnassignedRmCount}</strong> employer{employerUnassignedRmCount > 1 ? 's are' : ' is'} awaiting an account manager assignment.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleNotifyPlacementTeamForEmployers}
                  disabled={notifyingEmployerTeam || employerNotified}
                  className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] font-semibold text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-60 flex items-center space-x-1.5 shrink-0"
                >
                  {notifyingEmployerTeam ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Notifying...</span>
                    </>
                  ) : employerNotified ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-300" />
                      <span>Notified</span>
                    </>
                  ) : (
                    <>
                      <Bell className="w-3 h-3" />
                      <span>Notify Placement Team</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="p-3 rounded-[8px] bg-[#F8FAFD] border border-[#E2E8F4] text-center text-xs text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline-block mr-1.5" />
                All active employer facilities have dedicated Account Managers assigned.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION: ASSOCIATE WORKLOAD (NEW) */}
      <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-[#1B3270]" />
            <h2 className="text-base font-bold text-slate-800">
              Associate Workload
            </h2>
          </div>
          <button
            onClick={() => onNavigateTab('team')}
            className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1 cursor-pointer"
          >
            <span>Manage Team</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center">
            <Loader2 className="w-6 h-6 text-[#1B3270] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-400">Loading associate workload data...</p>
          </div>
        ) : associateWorkloads.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No partnerships associates currently registered on the platform.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#E2E8F4] rounded-[8px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Associate Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-center">Accounts Onboarded</th>
                  <th className="py-3 px-4 text-center">Awaiting RM</th>
                  <th className="py-3 px-4 text-center">This Month Count</th>
                  <th className="py-3 px-4 text-right">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {associateWorkloads.map((assoc) => (
                  <tr key={assoc.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {assoc.name}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          assoc.role === 'supplier_partnerships_associate'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'bg-sky-50 text-sky-700 border border-sky-200'
                        }`}
                      >
                        {assoc.role === 'supplier_partnerships_associate'
                          ? 'Supplier Associate'
                          : 'Employer Associate'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                      {assoc.accountsOnboarded}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          assoc.awaitingRm > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {assoc.awaitingRm}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-semibold text-[#1B3270]">
                      +{assoc.thisMonthCount}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      {assoc.awaitingRm === 0 ? (
                        <span className="text-emerald-600 font-semibold text-[11px] inline-flex items-center">
                          <Check className="w-3 h-3 mr-1" />
                          Handoffs Complete
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold text-[11px]">
                          {assoc.awaitingRm} Handoff Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TEAM ACTIVITY: LAST 10 RM ASSIGNMENTS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Recent RM Assignment Activity
          </h2>
          <span className="text-xs text-slate-400">Last 10 handoffs</span>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                No RM assignments recorded yet.
              </p>
              <p className="text-xs text-slate-400 mt-1">
                When Placement Leads assign Relationship Managers for suppliers or employers, they will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F4]">
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-[#F8FAFD] transition-colors text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        act.entity_type === 'supplier'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-sky-50 text-sky-700 border border-sky-200'
                      }`}
                    >
                      {act.entity_type}
                    </span>
                    <div>
                      <span className="font-bold text-slate-900">{act.company_name}</span>
                      <span className="text-slate-400 mx-1.5">assigned to</span>
                      <span className="font-semibold text-[#1B3270]">{act.rm_name}</span>
                      <span className="text-slate-400 text-[11px] ml-2">
                        (by {act.assigned_by_name})
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(act.created_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadOverviewTab;
