import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Check, ArrowRight, Bell, Briefcase, MapPin, AlertTriangle } from 'lucide-react';
import { formatTimeAgo } from '../../utils/formatters';
import { getApplicationStatusLabel } from '../../utils/labels';

interface HomeTabProps {
  candidate: any;
  onNavigateTab: (tab: string, extraParams?: Record<string, string>) => void;
  onOpenProfileModal?: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  candidate,
  onNavigateTab,
  onOpenProfileModal: _onOpenProfileModal,
}) => {
  const { user } = useAuth();
  const [gateResults, setGateResults] = useState<any[]>([]);
  const [dtPassed, setDtPassed] = useState<boolean>(false);
  const [applications, setApplications] = useState<any[]>([]);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHomeData = async () => {
    if (!candidate?.id || !user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Fetch DT passed attempt
      const { data: dtAttemptsData } = await supabase
        .from('dt_attempts')
        .select('id, passed')
        .eq('candidate_id', candidate.id)
        .eq('passed', true);

      const isDtPassed =
        (dtAttemptsData && dtAttemptsData.length > 0) || Boolean(candidate?.dt_passed_at);
      setDtPassed(isDtPassed);

      // 2. Fetch gate results for this candidate
      const { data: gates, error: gatesErr } = await supabase
        .from('gate_results')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false });

      if (gatesErr) console.error('Error fetching gates:', gatesErr);
      else setGateResults(gates || []);

      // 3. Fetch candidate applications (with associated job requirement)
      const { data: appsData, error: appsErr } = await supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          job_id,
          status,
          created_at,
          updated_at,
          job_requirements (
            title,
            location,
            role_type
          )
        `)
        .eq('candidate_id', candidate.id)
        .order('updated_at', { ascending: false });

      if (appsErr) console.error('Error fetching applications:', appsErr);
      else setApplications(appsData || []);

      // 4. Fetch up to 3 active job requirements for preview
      const { data: jobs, error: jobsErr } = await supabase
        .from('job_requirements')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(3);

      if (jobsErr) console.error('Error fetching jobs:', jobsErr);
      else setActiveJobs(jobs || []);

      // 5. Fetch notifications for current user
      const { data: notifs, error: notifsErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (notifsErr) console.error('Error fetching notifications:', notifsErr);
      else setNotifications(notifs || []);
    } catch (err) {
      console.error('Error loading home tab data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (candidate?.id && user?.id) {
      fetchHomeData();
    } else {
      setLoading(false);
    }
  }, [candidate?.id, user?.id]);

  const handleNotificationClick = async (notifId: string, isRead: boolean) => {
    if (isRead) return;
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notifId);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Error marking notification read:', err);
    }
  };

  // Helper map for gate results by gate_type
  const gateMap: Record<string, any> = {};
  gateResults.forEach((g) => {
    if (!gateMap[g.gate_type] || new Date(g.created_at) > new Date(gateMap[g.gate_type].created_at)) {
      gateMap[g.gate_type] = g;
    }
  });

  // --------------------------------------------------------------------------
  // FIX 1: GATE STATE RESOLUTION
  // 1. Diagnostic Test: dt_attempts (passed = true)
  // 2. Document Verification: gate_results where gate_type='doc_verification' AND status='pass'
  // 3. Speaking Test: gate_results where gate_type='speaking_test' AND status='pass'
  // 4. Interview Bootcamp: gate_results where gate_type='bootcamp' AND status IN ('in_progress','pass')
  // 5. Final Assessment: gate_results where gate_type='assessment' AND status='pass'
  // --------------------------------------------------------------------------
  const gate1Done = dtPassed;
  const gate2Done = gateResults.some((g) => g.gate_type === 'doc_verification' && g.status === 'pass');
  const gate3Done = gateResults.some((g) => g.gate_type === 'speaking_test' && g.status === 'pass');
  const bootcampPass = gateResults.some((g) => g.gate_type === 'bootcamp' && g.status === 'pass');
  const bootcampInProgress = gateResults.some((g) => g.gate_type === 'bootcamp' && g.status === 'in_progress');
  const gate4Done = bootcampPass;
  const gate5Done = gateResults.some((g) => g.gate_type === 'assessment' && g.status === 'pass');

  const gatesSpec = [
    {
      id: 1,
      label: 'Diagnostic Test',
      tab: 'dt',
      isDone: gate1Done,
      isActive: !gate1Done,
      isLocked: false,
    },
    {
      id: 2,
      label: 'Document Verification',
      tab: 'documentation',
      isDone: gate2Done,
      isActive: gate1Done && !gate2Done,
      isLocked: !gate1Done && !gate2Done,
    },
    {
      id: 3,
      label: 'Speaking Test',
      tab: 'academy',
      isDone: gate3Done,
      isActive: gate2Done && !gate3Done,
      isLocked: !gate2Done && !gate3Done,
    },
    {
      id: 4,
      label: 'Interview Bootcamp',
      tab: 'academy',
      isDone: gate4Done,
      isActive: (gate3Done && !gate4Done) || bootcampInProgress,
      isLocked: !gate3Done && !bootcampInProgress && !gate4Done,
    },
    {
      id: 5,
      label: 'Final Assessment',
      tab: 'academy',
      isDone: gate5Done,
      isActive: gate4Done && !gate5Done,
      isLocked: !gate4Done && !gate5Done,
    },
  ];

  // Derive status label & action tab for State A
  let statusHeading = 'Begin your qualification with the Diagnostic Test';
  let statusActionTab = 'dt';
  let statusButtonLabel = 'Start Test';

  if (gate4Done) {
    statusHeading = 'Take your Final Assessment';
    statusActionTab = 'academy';
    statusButtonLabel = 'Go to Qualification';
  } else if (bootcampInProgress || gate3Done) {
    statusHeading = 'Prepare for your Interview Bootcamp';
    statusActionTab = 'academy';
    statusButtonLabel = 'View Bootcamp Details';
  } else if (gate2Done) {
    statusHeading = 'Your Speaking Test is next';
    statusActionTab = 'academy';
    statusButtonLabel = 'Go to Qualification';
  } else if (gate1Done) {
    statusHeading = 'Upload your verification documents';
    statusActionTab = 'documentation';
    statusButtonLabel = 'Upload Documents';
  }

  // Check cooling period
  const dtCoolingStr = gateMap['dt']?.cooling_until || gateMap['dt']?.cooldown_until;
  const dtCooling = dtCoolingStr ? new Date(dtCoolingStr) : null;
  const isCooling = dtCooling && dtCooling > new Date();
  const coolingDays = isCooling
    ? Math.ceil((dtCooling.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  // --------------------------------------------------------------------------
  // FIX 2: TWO STATES
  // STATE A: candidates.status IN ('onboarding','in_progress') OR candidates.can_apply_to_jobs = false
  // STATE B: candidates.can_apply_to_jobs = true AND at least 1 job_application exists
  // STATE C: candidates.can_apply_to_jobs = true AND zero job_applications exist
  // --------------------------------------------------------------------------
  const canApplyToJobs = Boolean(candidate?.can_apply_to_jobs);
  const isStateA =
    candidate?.status === 'onboarding' ||
    candidate?.status === 'in_progress' ||
    !canApplyToJobs;

  // Pipeline metrics for State B & C
  const appliedCount = applications.filter((a) => a.status === 'applied').length;
  const inReviewCount = applications.filter((a) =>
    ['shortlisted', 'interview_scheduled', 'interviewed', 'selected'].includes(a.status)
  ).length;
  const offerCount = applications.filter((a) => a.status === 'offer_sent').length;

  const renderApplicationStatusBadge = (status: string) => {
    const label = getApplicationStatusLabel(status);
    switch (status) {
      case 'applied':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {label}
          </span>
        );
      case 'shortlisted':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#7EB3E8]/20 text-[#2952A3] border border-[#7EB3E8]/30">
            {label}
          </span>
        );
      case 'interview_scheduled':
      case 'interviewed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
            {label}
          </span>
        );
      case 'selected':
      case 'offer_sent':
      case 'reveal_gate':
      case 'placed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
            {label}
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
            {label}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
            {label}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
      </div>
    );
  }

  // ==========================================================================
  // RENDER: STATE A (QUALIFICATION IN PROGRESS)
  // ==========================================================================
  if (isStateA) {
    return (
      <div className="space-y-6 animate-in fade-in duration-150">
        {/* 1. GATE PROGRESS BAR */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 sm:p-6 shadow-sm overflow-hidden">
          <div className="overflow-x-auto pb-1 -mb-1">
            <div className="flex items-start justify-between w-full min-w-[500px] max-w-3xl mx-auto px-2">
              {gatesSpec.map((gate, idx) => {
                const isPassed = gate.isDone;
                const isActive = gate.isActive;

                return (
                  <React.Fragment key={gate.id}>
                    <div
                      onClick={() => onNavigateTab(gate.tab)}
                      className="flex flex-col items-center cursor-pointer group select-none relative"
                    >
                      {/* Circle: Done (#10B981), Active (#1B3270), Locked (#E2E8F4) */}
                      <div
                        className={`w-[28px] h-[28px] rounded-full flex items-center justify-center text-[11px] font-semibold transition-all ${
                          isPassed
                            ? 'bg-[#10B981] text-white'
                            : isActive
                            ? 'bg-[#1B3270] text-white ring-4 ring-[#1B3270]/10'
                            : 'bg-[#E2E8F4] text-[#94A3B8]'
                        }`}
                      >
                        {isPassed ? (
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        ) : (
                          <span>{gate.id}</span>
                        )}
                      </div>

                      {/* Label below: 10px, #94A3B8 / Active: 10px, #1B3270, weight 500 */}
                      <span
                        className={`text-[10px] mt-2 text-center max-w-[85px] leading-tight transition-colors ${
                          isActive
                            ? 'text-[#1B3270] font-[500]'
                            : 'text-[#94A3B8]'
                        }`}
                      >
                        {gate.label}
                      </span>
                    </div>

                    {/* Connecting line: Done (#10B981), Pending (#E2E8F4) */}
                    {idx < gatesSpec.length - 1 && (
                      <div
                        className={`flex-1 h-[2px] mx-2 mt-3.5 transition-colors ${
                          isPassed ? 'bg-[#10B981]' : 'bg-[#E2E8F4]'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* COOLING PERIOD ALERT (if active) */}
        {isCooling && (
          <div className="p-4 bg-[#FEF2F2] border border-[#EF4444]/20 rounded-[12px] text-[#991b1b] text-[13px] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#EF4444]" />
            <span>
              Cooling period active: {coolingDays} day{coolingDays > 1 ? 's' : ''} remaining. Re-attempt available on {dtCooling?.toLocaleDateString()}.
            </span>
          </div>
        )}

        {/* 2. STATUS CARD (Next Action Prompt) */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-6 shadow-sm">
          <h2 className="text-[17px] font-bold text-[#1B3270] leading-snug">
            {statusHeading}
          </h2>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => onNavigateTab(statusActionTab)}
              className="h-[44px] px-6 bg-[#1B3270] hover:bg-[#2952A3] text-white text-[13px] font-semibold rounded-[8px] transition-colors cursor-pointer inline-flex items-center gap-2 shadow-xs"
            >
              <span>{statusButtonLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 3. OPEN ROLES PREVIEW & 4. NOTIFICATIONS */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* OPEN ROLES PREVIEW (3 jobs, apply locked) */}
          <div className="xl:col-span-2 space-y-4 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-[#1B3270]">
                  Open Roles
                </h3>
                <p className="text-[13px] text-[#94A3B8]">
                  You can browse all open roles now. The ability to apply unlocks once you reach Interview Ready status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('job_pool')}
                className="text-xs font-semibold text-[#2952A3] hover:underline self-start sm:self-auto shrink-0 cursor-pointer"
              >
                See all open roles →
              </button>
            </div>

            {/* Job Rows */}
            {activeJobs.length === 0 ? (
              <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 text-center shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
                <Briefcase size={28} className="mx-auto text-[#94A3B8] mb-2" />
                <p className="text-sm text-[#4A5568]">
                  No open roles right now. Check back soon.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#7EB3E8] transition-colors"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <h4 className="text-sm font-semibold text-[#1B3270] truncate">
                        {job.title}
                      </h4>
                      <div className="flex items-center space-x-2 text-xs text-[#4A5568] flex-wrap">
                        {job.location && (
                          <span className="flex items-center">
                            <MapPin size={12} className="mr-1 text-[#94A3B8] shrink-0" />
                            <span className="truncate">{job.location}</span>
                          </span>
                        )}
                        {job.role_type && (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#7EB3E8]/20 text-[#2952A3] capitalize shrink-0">
                            {job.role_type}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        type="button"
                        disabled
                        title="Available once you reach Interview Ready"
                        className="py-1.5 px-3 bg-[#F8FAFD] border border-[#E2E8F4] text-[#94A3B8] text-xs font-medium rounded-[6px] cursor-not-allowed"
                      >
                        Available at Interview Ready
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* NOTIFICATIONS */}
          <div className="space-y-4 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1B3270]">Notifications</h3>
              <span className="text-xs text-[#94A3B8]">Recent alerts</span>
            </div>

            {notifications.length === 0 ? (
              <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 text-center shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
                <Bell size={24} className="mx-auto text-[#94A3B8] mb-2" />
                <p className="text-sm text-[#4A5568]">No notifications yet.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif.id, notif.read)}
                    className={`bg-white border border-[#E2E8F4] rounded-[10px] p-3.5 shadow-xs cursor-pointer transition-all ${
                      !notif.read ? 'border-l-[3px] border-l-[#2952A3]' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <h5 className="text-[13px] font-semibold text-[#1B3270] leading-snug break-words flex-1 min-w-0">
                        {notif.title}
                      </h5>
                      <span className="text-[11px] text-[#94A3B8] shrink-0 whitespace-nowrap">
                        {formatTimeAgo(notif.created_at)}
                      </span>
                    </div>
                    <p className="text-[12px] text-[#4A5568] mt-1 leading-normal break-words">
                      {notif.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RENDER: STATE B & STATE C (IN EMPLOYER PIPELINE / INTERVIEW READY)
  // ==========================================================================
  const hasApplications = applications.length > 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* PIPELINE STATS ROW (4 stat cards in a grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Applied */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <span className="text-xs font-semibold text-[#94A3B8]">Applied</span>
          <p className="text-2xl font-bold text-[#1B3270] mt-2">
            {appliedCount}
          </p>
        </div>

        {/* Card 2: In Review */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <span className="text-xs font-semibold text-[#94A3B8]">In Review</span>
          <p className="text-2xl font-bold text-[#1B3270] mt-2">
            {inReviewCount}
          </p>
        </div>

        {/* Card 3: Offers */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <span className="text-xs font-semibold text-[#94A3B8]">Offer Sent</span>
          <p className="text-2xl font-bold text-[#1B3270] mt-2">
            {offerCount}
          </p>
        </div>

        {/* Card 4: Interview Ready badge */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <span className="text-xs font-semibold text-[#94A3B8]">Your Status</span>
          <div className="mt-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
              Interview Ready ✓
            </span>
          </div>
        </div>
      </div>

      {/* SINGLE GREEN BANNER */}
      <div className="p-4 bg-[#10B981]/10 border border-[#10B981]/25 rounded-[12px] text-xs text-[#065F46] flex items-center justify-between">
        <div>
          <span>Your profile is visible to employers. You can apply directly to open roles. </span>
          <button
            type="button"
            onClick={() => onNavigateTab('job_pool')}
            className="font-semibold text-[#047857] hover:underline inline-flex items-center ml-1 cursor-pointer"
          >
            Browse open roles →
          </button>
        </div>
      </div>

      {/* BOTTOM SECTION: MY APPLICATIONS (Left 2 cols) & NOTIFICATIONS (Right 1 col) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* MY APPLICATIONS */}
        <div className="xl:col-span-2 space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#1B3270]">My Applications</h3>
            {hasApplications && (
              <button
                type="button"
                onClick={() => onNavigateTab('job_pool', { view: 'applications' })}
                className="text-xs font-semibold text-[#2952A3] hover:underline cursor-pointer"
              >
                See all →
              </button>
            )}
          </div>

          {!hasApplications ? (
            /* STATE C: Empty state for applications */
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 text-center shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
              <Briefcase size={28} className="mx-auto text-[#94A3B8] mb-2" />
              <p className="text-sm text-[#4A5568] mb-4">No applications yet.</p>
              <button
                type="button"
                onClick={() => onNavigateTab('job_pool')}
                className="h-[38px] px-5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[8px] transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
              >
                <span>Browse Open Roles</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* STATE B: Applications list (limit 5) */
            <div className="space-y-3">
              {applications.slice(0, 5).map((app) => (
                <div
                  key={app.id}
                  className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#7EB3E8] transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-[#1B3270] truncate">
                      {app.job_requirements?.title || 'Open Role'}
                    </h4>
                    <div className="flex items-center space-x-2 text-xs text-[#4A5568] flex-wrap">
                      {app.job_requirements?.location && (
                        <span className="flex items-center">
                          <MapPin size={12} className="mr-1 text-[#94A3B8] shrink-0" />
                          <span className="truncate">{app.job_requirements.location}</span>
                        </span>
                      )}
                      {app.job_requirements?.role_type && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#7EB3E8]/20 text-[#2952A3] capitalize shrink-0">
                          {app.job_requirements.role_type}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    {renderApplicationStatusBadge(app.status)}
                    <span className="text-[11px] text-[#94A3B8] whitespace-nowrap">
                      {formatTimeAgo(app.updated_at || app.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NOTIFICATIONS */}
        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#1B3270]">Notifications</h3>
            <span className="text-xs text-[#94A3B8]">Recent alerts</span>
          </div>

          {notifications.length === 0 ? (
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 text-center shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
              <Bell size={24} className="mx-auto text-[#94A3B8] mb-2" />
              <p className="text-sm text-[#4A5568]">No notifications yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif.id, notif.read)}
                  className={`bg-white border border-[#E2E8F4] rounded-[10px] p-3.5 shadow-xs cursor-pointer transition-all ${
                    !notif.read ? 'border-l-[3px] border-l-[#2952A3]' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <h5 className="text-[13px] font-semibold text-[#1B3270] leading-snug break-words flex-1 min-w-0">
                      {notif.title}
                    </h5>
                    <span className="text-[11px] text-[#94A3B8] shrink-0 whitespace-nowrap">
                      {formatTimeAgo(notif.created_at)}
                    </span>
                  </div>
                  <p className="text-[12px] text-[#4A5568] mt-1 leading-normal break-words">
                    {notif.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
