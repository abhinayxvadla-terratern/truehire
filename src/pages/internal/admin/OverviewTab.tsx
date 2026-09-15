import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Users,
  CheckCircle2,
  Building2,
  Briefcase,
  Layers,
  FileText,
  AlertTriangle,
  Clock,
  ArrowRight,
  RefreshCw,
  Activity,
  ShieldAlert,
  Award,
  BookOpen,
  UploadCloud,
} from 'lucide-react';
import { getGateLabel } from '../../../utils/labels';

interface OverviewTabProps {
  onNavigateTab: (tabId: string) => void;
}

interface ActivityItem {
  id: string;
  timestamp: string;
  description: string;
  entityType: 'Gate Result' | 'Application' | 'Candidate';
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ onNavigateTab }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Platform Health Counts
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [interviewReady, setInterviewReady] = useState(0);
  const [totalSuppliers, setTotalSuppliers] = useState(0);
  const [totalEmployers, setTotalEmployers] = useState(0);
  const [activeJobs, setActiveJobs] = useState(0);
  const [pipelineApps, setPipelineApps] = useState(0);
  const [revealGatesActive, setRevealGatesActive] = useState(0);
  const [pendingGateReviews, setPendingGateReviews] = useState(0);

  // New Platform Stats Grid
  const [totalPlacements, setTotalPlacements] = useState(0);
  const [activeCohorts, setActiveCohorts] = useState(0);
  const [bulkUploadsThisMonth, setBulkUploadsThisMonth] = useState(0);

  // Needs Attention Counts
  const [openEscalations, setOpenEscalations] = useState(0);
  const [queriedGates, setQueriedGates] = useState(0);
  const [internalCreatedWeek, setInternalCreatedWeek] = useState(0);

  // New Needs Attention items
  const [coolingActiveCount, setCoolingActiveCount] = useState(0);
  const [finalTestLockedCount, setFinalTestLockedCount] = useState(0);
  const [suppliersWithoutRmCount, setSuppliersWithoutRmCount] = useState(0);
  const [employersWithoutRmCount, setEmployersWithoutRmCount] = useState(0);
  const [pendingMentorProposalsCount, setPendingMentorProposalsCount] = useState(0);
  const [pendingCohortProposalsCount, setPendingCohortProposalsCount] = useState(0);
  const [revealGatesInProgressCount, setRevealGatesInProgressCount] = useState(0);

  // Recent Activity Feed
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  const fetchOverviewData = async () => {
    try {
      const now = new Date();
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneWeekAgoISO = oneWeekAgo.toISOString();

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const nowISO = now.toISOString();

      const [
        totalCandRes,
        interviewReadyRes,
        suppliersRes,
        employersRes,
        activeJobsRes,
        pipelineAppsRes,
        revealGatesRes,
        pendingGatesRes,
        escalationsRes,
        queriedGatesRes,
        internalWeekRes,
        recentGatesRes,
        recentAppsRes,
        recentCandsRes,
        // New queries
        placementsRes,
        cohortsActiveRes,
        bulkUploadsRes,
        coolingRes,
        lockedCandidatesRes,
        mentorProposalsRes,
        cohortsProposedRes,
        revealGatesInProgressRes,
        allSuppliersWithUserRes,
        allEmployersWithUserRes,
        activeRmAssignmentsRes,
      ] = await Promise.all([
        supabase.from('candidates').select('id', { count: 'exact', head: true }),
        supabase
          .from('candidates')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'interview_ready'),
        supabase.from('suppliers').select('id', { count: 'exact', head: true }),
        supabase.from('employers').select('id', { count: 'exact', head: true }),
        supabase
          .from('job_requirements')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .not('status', 'in', '("placed","rejected")'),
        supabase
          .from('candidates')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'reveal_gate'),
        supabase
          .from('gate_results')
          .select('id', { count: 'exact', head: true })
          .eq('review_status', 'pending'),
        supabase
          .from('escalations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'open'),
        supabase
          .from('gate_results')
          .select('id', { count: 'exact', head: true })
          .eq('review_status', 'queried'),
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('is_internal', true)
          .gte('created_at', oneWeekAgoISO),
        supabase
          .from('gate_results')
          .select('id, gate_type, status, created_at, candidate_id, candidates(first_name, last_name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('job_applications')
          .select('id, status, created_at, job_id, job_requirements(title)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('candidates')
          .select('id, first_name, last_name, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
        // Placements
        supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'placed'),
        // Active cohorts
        supabase
          .from('cohorts')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        // Bulk uploads this month
        supabase
          .from('supplier_bulk_uploads')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfMonth),
        // Cooling periods active
        supabase
          .from('cooling_periods')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .gt('ends_at', nowISO),
        // Final test locked
        supabase
          .from('candidates')
          .select('id', { count: 'exact', head: true })
          .eq('final_test_locked', true),
        // Pending mentor proposals
        supabase
          .from('mentor_proposals')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        // Proposed cohorts
        supabase
          .from('cohorts')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'proposed'),
        // Reveal process active
        supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'reveal_gate'),
        // Suppliers with user_id
        supabase
          .from('suppliers')
          .select('id')
          .not('user_id', 'is', null),
        // Employers with user_id
        supabase
          .from('employers')
          .select('id')
          .not('user_id', 'is', null),
        // Active RM assignments
        supabase
          .from('rm_assignments')
          .select('entity_id, entity_type')
          .eq('active', true),
      ]);

      setTotalCandidates(totalCandRes.count || 0);
      setInterviewReady(interviewReadyRes.count || 0);
      setTotalSuppliers(suppliersRes.count || 0);
      setTotalEmployers(employersRes.count || 0);
      setActiveJobs(activeJobsRes.count || 0);
      setPipelineApps(pipelineAppsRes.count || 0);
      setRevealGatesActive(revealGatesRes.count || 0);
      setPendingGateReviews(pendingGatesRes.count || 0);

      setTotalPlacements(placementsRes.count || 0);
      setActiveCohorts(cohortsActiveRes.count || 0);
      setBulkUploadsThisMonth(bulkUploadsRes.count || 0);

      setOpenEscalations(escalationsRes.count || 0);
      setQueriedGates(queriedGatesRes.count || 0);
      setInternalCreatedWeek(internalWeekRes.count || 0);

      setCoolingActiveCount(coolingRes.count || 0);
      setFinalTestLockedCount(lockedCandidatesRes.count || 0);
      setPendingMentorProposalsCount(mentorProposalsRes.count || 0);
      setPendingCohortProposalsCount(cohortsProposedRes.count || 0);
      setRevealGatesInProgressCount(revealGatesInProgressRes.count || 0);

      // Compute suppliers & employers without RM
      const assignedSupplierIds = new Set(
        (activeRmAssignmentsRes.data || [])
          .filter((a: any) => a.entity_type === 'supplier')
          .map((a: any) => a.entity_id)
      );
      const suppliersWithoutRm = (allSuppliersWithUserRes.data || []).filter(
        (s: any) => !assignedSupplierIds.has(s.id)
      ).length;
      setSuppliersWithoutRmCount(suppliersWithoutRm);

      const assignedEmployerIds = new Set(
        (activeRmAssignmentsRes.data || [])
          .filter((a: any) => a.entity_type === 'employer')
          .map((a: any) => a.entity_id)
      );
      const employersWithoutRm = (allEmployersWithUserRes.data || []).filter(
        (e: any) => !assignedEmployerIds.has(e.id)
      ).length;
      setEmployersWithoutRmCount(employersWithoutRm);

      // Build Union Feed
      const activities: ActivityItem[] = [];

      if (recentGatesRes.data) {
        recentGatesRes.data.forEach((item: any) => {
          const candName = item.candidates
            ? `${item.candidates.first_name || ''} ${item.candidates.last_name || ''}`.trim()
            : `ID ${item.candidate_id?.slice(0, 8)}`;
          activities.push({
            id: `gate-${item.id}`,
            timestamp: item.created_at,
            description: `Gate result recorded — ${getGateLabel(item.gate_type)} (${item.status}) — Candidate: ${candName || 'Candidate'}`,
            entityType: 'Gate Result',
          });
        });
      }

      if (recentAppsRes.data) {
        recentAppsRes.data.forEach((item: any) => {
          const jobTitle = item.job_requirements?.title || 'Unknown Job';
          activities.push({
            id: `app-${item.id}`,
            timestamp: item.created_at,
            description: `Application moved to ${item.status} — Job: ${jobTitle}`,
            entityType: 'Application',
          });
        });
      }

      if (recentCandsRes.data) {
        recentCandsRes.data.forEach((item: any) => {
          const name = `${item.first_name || ''} ${item.last_name || ''}`.trim();
          activities.push({
            id: `cand-${item.id}`,
            timestamp: item.created_at,
            description: `New candidate registered: ${name || 'Unnamed candidate'}`,
            entityType: 'Candidate',
          });
        });
      }

      // Sort client-side by timestamp descending and take 10
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentActivities(activities.slice(0, 10));
    } catch (err) {
      console.error('Error fetching Super Admin overview data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOverviewData();
  };

  const statCards = [
    {
      title: 'Total Candidates',
      count: totalCandidates,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      tab: 'candidates',
    },
    {
      title: 'Interview Ready',
      count: interviewReady,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tab: 'candidates',
    },
    {
      title: 'Total Suppliers',
      count: totalSuppliers,
      icon: Building2,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tab: 'suppliers',
    },
    {
      title: 'Total Employers',
      count: totalEmployers,
      icon: Briefcase,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      tab: 'employers',
    },
    {
      title: 'Total Placements',
      count: totalPlacements,
      icon: Award,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tab: 'placements',
    },
    {
      title: 'Active Cohorts',
      count: activeCohorts,
      icon: BookOpen,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      tab: 'cohorts',
    },
    {
      title: 'Bulk Uploads This Month',
      count: bulkUploadsThisMonth,
      icon: UploadCloud,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tab: 'suppliers',
    },
    {
      title: 'Active Jobs',
      count: activeJobs,
      icon: Layers,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      tab: 'employers',
    },
    {
      title: 'Applications in Pipeline',
      count: pipelineApps,
      icon: FileText,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      tab: 'employers',
    },
    {
      title: 'Reveal Gates Active',
      count: revealGatesActive,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      tab: 'reveal_queue',
    },
    {
      title: 'Gate Results Pending Review',
      count: pendingGateReviews,
      icon: AlertTriangle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      tab: 'gates',
    },
  ];

  const hasNeedsAttention =
    openEscalations > 0 ||
    queriedGates > 0 ||
    internalCreatedWeek > 0 ||
    coolingActiveCount > 0 ||
    finalTestLockedCount > 0 ||
    suppliersWithoutRmCount > 0 ||
    employersWithoutRmCount > 0 ||
    pendingMentorProposalsCount > 0 ||
    pendingCohortProposalsCount > 0 ||
    revealGatesInProgressCount > 0;

  return (
    <div className="space-y-8">
      {/* Header bar with subtitle & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#E2E8F4]">
        <div>
          <p className="text-[13px] text-[#4A5568]">
            Real-time platform telemetry, operational queues, and live stakeholder activities.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[8px] hover:bg-slate-50 hover:text-[#1B3270] transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Data'}</span>
        </button>
      </div>

      {/* PLATFORM HEALTH — grid of stat cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-[#1B3270]">
            Platform Health and Operations
          </h2>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-24 bg-white border border-[#E2E8F4] rounded-[12px] animate-pulse p-5"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {statCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <div
                  key={idx}
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
                      {card.count.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-[#94A3B8] group-hover:text-[#2952A3] flex items-center font-medium">
                      View
                      <ArrowRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* NEEDS ATTENTION Card */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Operational Queue
        </h2>
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-[#E2E8F4]">
            <div className="flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-[#1B3270]" />
              <h3 className="font-semibold text-slate-800 text-base">Needs Attention</h3>
            </div>
            {hasNeedsAttention ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                Action Required
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Clear
              </span>
            )}
          </div>

          <div className="mt-4">
            {!hasNeedsAttention ? (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  All clear — nothing needs attention.
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  There are no pending escalations, cooling periods, locked candidates, or unassigned accounts.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F4]">
                {/* 1. Candidates with active cooling periods */}
                {coolingActiveCount > 0 && (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          DT or Assessment cooling active: {coolingActiveCount}
                        </p>
                        <p className="text-xs text-slate-500">
                          Candidates in cooling status following test attempts
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('candidates')}
                      className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center cursor-pointer px-2.5 py-1 rounded hover:bg-slate-50 border border-transparent hover:border-[#E2E8F4]"
                    >
                      <span>View Candidates</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}

                {/* 2. Final test locked candidates */}
                {finalTestLockedCount > 0 && (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Final Assessment locked: {finalTestLockedCount}
                        </p>
                        <p className="text-xs text-slate-500">
                          Candidates locked out after consecutive final test failures
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('candidates')}
                      className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center cursor-pointer px-2.5 py-1 rounded hover:bg-slate-50 border border-transparent hover:border-[#E2E8F4]"
                    >
                      <span>Review Locks</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}

                {/* 3. Suppliers without RM */}
                {suppliersWithoutRmCount > 0 && (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Suppliers without account manager: {suppliersWithoutRmCount}
                        </p>
                        <p className="text-xs text-slate-500">
                          Registered sourcing partners pending dedicated RM assignment
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('suppliers')}
                      className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center cursor-pointer px-2.5 py-1 rounded hover:bg-slate-50 border border-transparent hover:border-[#E2E8F4]"
                    >
                      <span>Assign RM</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}

                {/* 4. Employers without RM */}
                {employersWithoutRmCount > 0 && (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Employers without account manager: {employersWithoutRmCount}
                        </p>
                        <p className="text-xs text-slate-500">
                          Healthcare facilities pending dedicated Account Manager assignment
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('employers')}
                      className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center cursor-pointer px-2.5 py-1 rounded hover:bg-slate-50 border border-transparent hover:border-[#E2E8F4]"
                    >
                      <span>Assign RM</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}

                {/* 5. Pending mentor proposals */}
                {pendingMentorProposalsCount > 0 && (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Mentor proposals pending approval: {pendingMentorProposalsCount}
                        </p>
                        <p className="text-xs text-slate-500">
                          Proposals submitted by mentors awaiting lead or admin endorsement
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('cohorts')}
                      className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center cursor-pointer px-2.5 py-1 rounded hover:bg-slate-50 border border-transparent hover:border-[#E2E8F4]"
                    >
                      <span>Review Proposals</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}

                {/* 6. Pending cohort proposals */}
                {pendingCohortProposalsCount > 0 && (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Cohort proposals pending: {pendingCohortProposalsCount}
                        </p>
                        <p className="text-xs text-slate-500">
                          Training cohorts in proposed stage awaiting approval to launch
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('cohorts')}
                      className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center cursor-pointer px-2.5 py-1 rounded hover:bg-slate-50 border border-transparent hover:border-[#E2E8F4]"
                    >
                      <span>View Cohorts</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}

                {/* 7. Reveal gates in progress */}
                {revealGatesInProgressCount > 0 && (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          Reveal process active: {revealGatesInProgressCount}
                        </p>
                        <p className="text-xs text-slate-500">
                          Candidate-job placements undergoing 3-condition verification
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('reveal_queue')}
                      className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center cursor-pointer px-2.5 py-1 rounded hover:bg-slate-50 border border-transparent hover:border-[#E2E8F4]"
                    >
                      <span>Reveal Queue</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}

                {/* Existing escalations */}
                {openEscalations > 0 && (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-rose-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {openEscalations} Open Escalation{openEscalations > 1 ? 's' : ''}
                        </p>
                        <p className="text-xs text-slate-500">
                          Candidates or entities requiring immediate intervention
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('candidates')}
                      className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center cursor-pointer px-2.5 py-1 rounded hover:bg-slate-50 border border-transparent hover:border-[#E2E8F4]"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}

                {/* Existing queried gates */}
                {queriedGates > 0 && (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {queriedGates} Gate Override{queriedGates > 1 ? 's' : ''} Needed
                        </p>
                        <p className="text-xs text-slate-500">
                          Gate evaluations flagged with query status awaiting super admin review
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('gates')}
                      className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center cursor-pointer px-2.5 py-1 rounded hover:bg-slate-50 border border-transparent hover:border-[#E2E8F4]"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}

                {/* Existing internal created */}
                {internalCreatedWeek > 0 && (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {internalCreatedWeek} New Internal Account{internalCreatedWeek > 1 ? 's' : ''} This Week
                        </p>
                        <p className="text-xs text-slate-500">
                          Team members recently onboarded to the workspace
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('team')}
                      className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center cursor-pointer px-2.5 py-1 rounded hover:bg-slate-50 border border-transparent hover:border-[#E2E8F4]"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECENT ACTIVITY FEED */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Live Operational Activity Feed
        </h2>
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs">
          <div className="flex items-center space-x-2 pb-4 border-b border-[#E2E8F4]">
            <Activity className="w-5 h-5 text-[#1B3270]" />
            <h3 className="font-semibold text-slate-800 text-base">Recent Platform Events</h3>
          </div>

          <div className="mt-4">
            {recentActivities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent activity recorded across platform gates or applications.
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivities.map((act) => (
                  <div key={act.id} className="flex items-start space-x-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-[#1B3270] mt-1.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-slate-800 font-medium">{act.description}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(act.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {new Date(act.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                      {act.entityType}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
