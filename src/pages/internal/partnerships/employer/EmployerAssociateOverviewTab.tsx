import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Briefcase,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Check,
  ShieldAlert,
  Bell,
  FileCheck,
  ExternalLink,
} from 'lucide-react';
import { notifyByRole } from '../../../../utils/notificationRouting';

interface EmployerItem {
  id: string;
  company_name: string;
  location: string | null;
  subscription_tier: string;
  created_at: string;
  has_rm: boolean;
  rm_name?: string;
  active_jobs_count: number;
  profile_pct: number;
}

interface ActionQueueItem {
  employerId: string;
  companyName: string;
  type: 'rm' | 'profile_incomplete';
  label: string;
  profilePct?: number;
}

interface EmployerAssociateOverviewTabProps {
  onNavigateTab: (tabId: string) => void;
  onSelectEmployerForDetail?: (employerId: string) => void;
}

export const EmployerAssociateOverviewTab: React.FC<
  EmployerAssociateOverviewTabProps
> = ({ onNavigateTab, onSelectEmployerForDetail }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Metrics
  const [myEmployersCount, setMyEmployersCount] = useState(0);
  const [profileCompleteCount, setProfileCompleteCount] = useState(0);
  const [awaitingRmCount, setAwaitingRmCount] = useState(0);
  const [jobsPostedCount, setJobsPostedCount] = useState(0);

  const [actionQueue, setActionQueue] = useState<ActionQueueItem[]>([]);
  const [recentlyOnboarded, setRecentlyOnboarded] = useState<EmployerItem[]>([]);

  // Notifications (24h cooldown)
  const [notifiedEmployers, setNotifiedEmployers] = useState<Set<string>>(new Set());
  const [notifyingEmployerId, setNotifyingEmployerId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isNotifiedRecent = (employerId: string) => {
    if (notifiedEmployers.has(employerId)) return true;
    try {
      const stored = localStorage.getItem(`rm_notified_emp_${employerId}`);
      if (!stored) return false;
      const timeDiff = Date.now() - parseInt(stored, 10);
      return timeDiff < 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  };

  const fetchAssociateOverview = async () => {
    if (!user) return;
    try {
      // 1. Fetch employers created by this associate
      const { data: myEmps, error } = await supabase
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
          subscription_tier,
          created_at
        `)
        .eq('created_by_internal', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const empList = myEmps || [];
      setMyEmployersCount(empList.length);
      const empIds = empList.map((e) => e.id);

      // 2. Fetch active RM assignments for these employers
      const rmMap: Record<string, string> = {};
      if (empIds.length > 0) {
        const { data: rmData } = await supabase
          .from('rm_assignments')
          .select(`
            entity_id,
            profiles:rm_profile_id(first_name, last_name, email)
          `)
          .eq('entity_type', 'employer')
          .eq('active', true)
          .in('entity_id', empIds);

        (rmData || []).forEach((r: any) => {
          const name = r.profiles
            ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() || r.profiles.email
            : 'Assigned RM';
          rmMap[r.entity_id] = name;
        });
      }

      // 3. Fetch jobs for these employers
      let totalJobs = 0;
      const jobCountMap: Record<string, number> = {};
      if (empIds.length > 0) {
        const { data: jobs } = await supabase
          .from('job_requirements')
          .select('id, employer_id')
          .in('employer_id', empIds);

        totalJobs = jobs?.length || 0;
        (jobs || []).forEach((j) => {
          jobCountMap[j.employer_id] = (jobCountMap[j.employer_id] || 0) + 1;
        });
      }
      setJobsPostedCount(totalJobs);

      // 4. Calculate queue & metrics
      let noRm = 0;
      let completedProfiles = 0;
      const queue: ActionQueueItem[] = [];

      const enriched: EmployerItem[] = empList.map((e: any) => {
        const hasRm = Boolean(rmMap[e.id]);
        const jCount = jobCountMap[e.id] || 0;

        // Profile completeness percentage
        let filledCount = 0;
        const totalTrackedFields = 6;
        if (e.company_name) filledCount++;
        if (e.company_size) filledCount++;
        if (e.primary_contact_name) filledCount++;
        if (e.country || e.location || e.office_address) filledCount++;
        if (Array.isArray(e.healthcare_roles_hiring) && e.healthcare_roles_hiring.length > 0) filledCount++;
        if (e.annual_hiring_volume) filledCount++;
        const pct = Math.round((filledCount / totalTrackedFields) * 100);

        if (pct === 100 || e.onboarding_checklist?.profile_completed) {
          completedProfiles++;
        } else {
          queue.push({
            employerId: e.id,
            companyName: e.company_name,
            type: 'profile_incomplete',
            label: `${e.company_name} — Profile ${pct}% complete`,
            profilePct: pct,
          });
        }

        if (!hasRm) {
          noRm++;
          queue.push({
            employerId: e.id,
            companyName: e.company_name,
            type: 'rm',
            label: `${e.company_name} — Account manager not yet assigned`,
          });
        }

        return {
          id: e.id,
          company_name: e.company_name,
          location: e.location,
          subscription_tier: e.subscription_tier || 'standard',
          created_at: e.created_at,
          has_rm: hasRm,
          rm_name: rmMap[e.id],
          active_jobs_count: jCount,
          profile_pct: pct,
        };
      });

      setProfileCompleteCount(completedProfiles);
      setAwaitingRmCount(noRm);
      setActionQueue(queue);
      setRecentlyOnboarded(enriched.slice(0, 5));
    } catch (err) {
      console.error('Error loading employer associate overview:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAssociateOverview();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAssociateOverview();
  };

  const handleNotifyPlacementTeam = async (employerId: string, companyName: string) => {
    if (!user || notifyingEmployerId) return;
    setNotifyingEmployerId(employerId);

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
        localStorage.setItem(`rm_notified_emp_${employerId}`, Date.now().toString());
      } catch {}

      setNotifiedEmployers((prev) => new Set(prev).add(employerId));
      showToast('Placement team has been notified.');
    } catch (err) {
      console.error('Error dispatching notification to placement team:', err);
      alert('Failed to send notification to placement team.');
    } finally {
      setNotifyingEmployerId(null);
    }
  };

  const handleViewEmployer = (employerId: string) => {
    onSelectEmployerForDetail?.(employerId);
    onNavigateTab('my_employers');
  };

  const statCards = [
    {
      title: 'My Employers',
      count: myEmployersCount,
      icon: Briefcase,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tab: 'my_employers',
    },
    {
      title: 'Profile Complete (100%)',
      count: profileCompleteCount,
      icon: FileCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tab: 'my_employers',
    },
    {
      title: 'RM Pending',
      count: awaitingRmCount,
      icon: AlertTriangle,
      color: awaitingRmCount > 0 ? 'text-amber-600' : 'text-slate-500',
      bg: awaitingRmCount > 0 ? 'bg-amber-50' : 'bg-slate-50',
      tab: 'my_employers',
    },
    {
      title: 'Requirements Posted',
      count: jobsPostedCount,
      icon: Layers,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      tab: 'my_employers',
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
            Monitor healthcare facility onboarding, profile readiness, and RM pipeline handoffs.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[8px] hover:bg-slate-50 hover:text-[#1B3270] transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* STATS ROW (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
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
                  <span className="text-xs font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">
                    {card.title}
                  </span>
                  <div className={`p-1.5 rounded-md ${card.bg} ${card.color}`}>
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

      {/* ACTION QUEUE CARD */}
      <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-[#1B3270]" />
            <h2 className="text-base font-bold text-slate-800">Action Queue</h2>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              actionQueue.length > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {actionQueue.length > 0
              ? `${actionQueue.length} Action Items`
              : 'All Clear'}
          </span>
        </div>

        {actionQueue.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">
              All clear — your healthcare employers have complete profiles and assigned account managers.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F4]">
            {actionQueue.map((item, idx) => {
              const alreadyNotified = isNotifiedRecent(item.employerId);
              const isBusy = notifyingEmployerId === item.employerId;

              return (
                <div
                  key={`${item.employerId}-${item.type}-${idx}`}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        item.type === 'rm' ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.type === 'rm'
                          ? 'Awaiting dedicated Account Manager allocation by Placement Lead.'
                          : 'Facility profile incomplete — contact employer to finalize identity and hiring criteria.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    {item.type === 'rm' ? (
                      <button
                        type="button"
                        onClick={() => handleNotifyPlacementTeam(item.employerId, item.companyName)}
                        disabled={alreadyNotified || isBusy}
                        className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] font-semibold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 shrink-0"
                      >
                        {isBusy ? (
                          <span>Notifying...</span>
                        ) : alreadyNotified ? (
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
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleViewEmployer(item.employerId)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 text-xs font-semibold text-[#1B3270] bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-[#F0F4FF] hover:border-[#2952A3]/30 transition-colors shadow-2xs cursor-pointer"
                      >
                        <span>View Employer</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENTLY ONBOARDED EMPLOYERS */}
      <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
          <h2 className="text-base font-bold text-slate-800">
            Recently Onboarded Facilities
          </h2>
          <button
            onClick={() => onNavigateTab('my_employers')}
            className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1 cursor-pointer"
          >
            <span>View All Employers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentlyOnboarded.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No healthcare facilities onboarded yet. Use the Onboard Employer tab to issue account invites.
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F4]">
            {recentlyOnboarded.map((e) => (
              <div
                key={e.id}
                className="py-3 flex items-center justify-between hover:bg-[#F8FAFD] transition-colors rounded px-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900 block">
                    {e.company_name}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {e.location || 'Germany'} • Profile {e.profile_pct}%
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div>
                    {e.has_rm ? (
                      <span className="text-emerald-700 font-medium text-[11px] flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                        {e.rm_name}
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium text-[11px] flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                        Awaiting RM
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleViewEmployer(e.id)}
                    className="text-[#1B3270] hover:underline font-semibold text-xs cursor-pointer"
                  >
                    Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployerAssociateOverviewTab;
