import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users,
  CheckCircle,
  Briefcase,
  AlertCircle,
  ArrowRight,
  Clock,
  CheckCircle2,
  Circle,
  Award,
  AlertTriangle,
  X,
  FileText,
  User,
  ShieldAlert,
} from 'lucide-react';
import { formatTimeAgo } from '../../utils/formatters';
import { getGateLabel } from '../../utils/labels';

interface SupplierHomeTabProps {
  supplier: any;
  onNavigateTab: (tab: string) => void;
}

interface CandidateAlert {
  id: string;
  candidateId: string;
  candidateName: string;
  type: 'cooling' | 'locked' | 'rejected_docs';
  alertText: string;
  candidate: any;
  coolingPeriod?: any;
  rejectedDocs?: any[];
}

export const SupplierHomeTab: React.FC<SupplierHomeTabProps> = ({
  supplier,
  onNavigateTab,
}) => {
  const [stats, setStats] = useState({
    inFlow: 0,
    interviewReady: 0,
    submittedToJobs: 0,
    pendingActions: 0,
    totalPlacements: 0,
  });
  const [checklist, setChecklist] = useState({
    profile_completed: false,
    compliance_declared: false,
    rm_assigned: false,
    first_candidate_added: false,
    first_interview_ready: false,
  });
  const [candidateAlerts, setCandidateAlerts] = useState<CandidateAlert[]>([]);
  const [selectedAlertCandidate, setSelectedAlertCandidate] = useState<CandidateAlert | null>(null);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [matchingJobsCount, setMatchingJobsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchHomeData = async () => {
    if (!supplier?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Pull all candidates for this supplier
      const { data: candList, error: candErr } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, email, target_role, language_level_self_reported, status, final_test_locked, dt_passed_at, profile_completion_pct, created_at')
        .eq('supplier_id', supplier.id);

      if (candErr) {
        console.error('Error fetching candidates for home tab:', candErr);
      }

      const cands = candList || [];
      const candMap = new Map(cands.map((c) => [c.id, c]));
      const ids = cands.map((c) => c.id);

      // In-flow candidates (not interview_ready and not placed)
      const inFlowCount = cands.filter(
        (c) => c.status !== 'interview_ready' && c.status !== 'placed'
      ).length;

      // Interview Ready candidates (status = 'interview_ready')
      const readyCount = cands.filter((c) => c.status === 'interview_ready').length;

      // 2. Job applications: submitted count and placed count
      let submittedCount = 0;
      let placementsCount = 0;

      if (ids.length > 0) {
        const { data: appsData } = await supabase
          .from('job_applications')
          .select('id, status')
          .in('candidate_id', ids);

        const apps = appsData || [];
        submittedCount = apps.length;
        placementsCount = apps.filter((a) => a.status === 'placed').length;
      }

      // 3. Candidate Alerts:
      // A. Candidates with active cooling_periods
      let coolingList: any[] = [];
      if (ids.length > 0) {
        const { data: cPeriods } = await supabase
          .from('cooling_periods')
          .select('id, candidate_id, gate_type, ends_at, status')
          .in('candidate_id', ids)
          .eq('status', 'active')
          .gt('ends_at', new Date().toISOString());

        coolingList = cPeriods || [];
      }

      // B. Candidates with final_test_locked = true
      const lockedCandidates = cands.filter((c) => c.final_test_locked === true);

      // C. Candidates with rejected documents
      let rejectedDocs: any[] = [];
      if (ids.length > 0) {
        const { data: rDocs } = await supabase
          .from('documents')
          .select('id, candidate_id, document_type, document_label, status, rejection_reason')
          .in('candidate_id', ids)
          .eq('status', 'rejected');

        rejectedDocs = rDocs || [];
      }

      const alerts: CandidateAlert[] = [];

      // Add cooling period alerts
      coolingList.forEach((cp) => {
        const cand = candMap.get(cp.candidate_id);
        if (cand) {
          const name = `${cand.first_name || ''} ${cand.last_name || ''}`.trim() || 'Candidate';
          const endDateFormatted = new Date(cp.ends_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          alerts.push({
            id: `cooling-${cp.id}`,
            candidateId: cand.id,
            candidateName: name,
            type: 'cooling',
            alertText: `DT cooling period active for ${name} — ends ${endDateFormatted}`,
            candidate: cand,
            coolingPeriod: cp,
          });
        }
      });

      // Add assessment lock alerts
      lockedCandidates.forEach((cand) => {
        const name = `${cand.first_name || ''} ${cand.last_name || ''}`.trim() || 'Candidate';
        alerts.push({
          id: `locked-${cand.id}`,
          candidateId: cand.id,
          candidateName: name,
          type: 'locked',
          alertText: `${name}'s Final Assessment is locked — training required before retake`,
          candidate: cand,
        });
      });

      // Add rejected documents alerts grouped by candidate
      const candRejectedMap: Record<string, any[]> = {};
      rejectedDocs.forEach((d) => {
        if (!candRejectedMap[d.candidate_id]) candRejectedMap[d.candidate_id] = [];
        candRejectedMap[d.candidate_id].push(d);
      });

      Object.entries(candRejectedMap).forEach(([candId, docs]) => {
        const cand = candMap.get(candId);
        if (cand) {
          const name = `${cand.first_name || ''} ${cand.last_name || ''}`.trim() || 'Candidate';
          const n = docs.length;
          alerts.push({
            id: `docs-${cand.id}`,
            candidateId: cand.id,
            candidateName: name,
            type: 'rejected_docs',
            alertText: `${name} has ${n} rejected document${n === 1 ? '' : 's'} — re-upload required`,
            candidate: cand,
            rejectedDocs: docs,
          });
        }
      });

      setCandidateAlerts(alerts);

      setStats({
        inFlow: inFlowCount,
        interviewReady: readyCount,
        submittedToJobs: submittedCount,
        pendingActions: alerts.length,
        totalPlacements: placementsCount,
      });

      // 4. Recent stage movements: gate_results for candidates belonging to this supplier
      const { data: movements } = await supabase
        .from('gate_results')
        .select(`
          id,
          gate_type,
          status,
          created_at,
          candidates!inner (
            id,
            first_name,
            last_name,
            supplier_id
          )
        `)
        .eq('candidates.supplier_id', supplier.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setRecentMovements(movements || []);

      // 5. Matching Requirements: active job_requirements matching target_roles of INTERVIEW READY candidates
      const interviewReadyRoles = Array.from(
        new Set(
          cands
            .filter((c) => c.status === 'interview_ready')
            .map((c) => c.target_role)
            .filter((r): r is string => !!r)
        )
      );

      if (interviewReadyRoles.length > 0) {
        const { count: matchCount } = await supabase
          .from('job_requirements')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active')
          .in('role_type', interviewReadyRoles);

        setMatchingJobsCount(matchCount || 0);
      } else {
        setMatchingJobsCount(0);
      }

      // 6. Onboarding Checklist Recomputation
      const profileCompleted = !!(
        supplier.company_name &&
        supplier.company_type &&
        (supplier.primary_contact_name || supplier.contact_person) &&
        supplier.country_of_operation
      );

      const complianceDeclared = !!(
        supplier.compliance_declared && supplier.no_fee_policy_confirmed
      );

      const { count: rmCount } = await supabase
        .from('rm_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('entity_type', 'supplier')
        .eq('entity_id', supplier.id)
        .eq('active', true);
      const rmAssigned = (rmCount || 0) > 0;

      const firstCandidateAdded = cands.length >= 1;
      const firstInterviewReady = readyCount >= 1;

      const newChecklist = {
        profile_completed: profileCompleted,
        compliance_declared: complianceDeclared,
        rm_assigned: rmAssigned,
        first_candidate_added: firstCandidateAdded,
        first_interview_ready: firstInterviewReady,
      };

      setChecklist(newChecklist);

      // Persist recomputed values to suppliers.onboarding_checklist
      await supabase
        .from('suppliers')
        .update({ onboarding_checklist: newChecklist })
        .eq('id', supplier.id);
    } catch (err) {
      console.error('Error fetching supplier home data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, [supplier?.id]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
      </div>
    );
  }

  const allChecklistComplete =
    checklist.profile_completed &&
    checklist.compliance_declared &&
    checklist.rm_assigned &&
    checklist.first_candidate_added &&
    checklist.first_interview_ready;

  const checklistCompletedCount = [
    checklist.profile_completed,
    checklist.compliance_declared,
    checklist.rm_assigned,
    checklist.first_candidate_added,
    checklist.first_interview_ready,
  ].filter(Boolean).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* ONBOARDING CHECKLIST CARD — shown until all 5 complete */}
      {!allChecklistComplete && (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                Get Started with TerraTern
              </h2>
              <p className="text-xs text-[#4A5568] mt-0.5">
                Complete these initial milestones to activate your candidate sourcing pipeline.
              </p>
            </div>
            <span className="text-xs font-bold text-[#1B3270] bg-[#1B3270]/10 px-3 py-1 rounded-full">
              {checklistCompletedCount} of 5 steps complete
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#E2E8F4] h-2 rounded-full overflow-hidden mb-6">
            <div
              className="bg-[#10B981] h-full transition-all duration-300 rounded-full"
              style={{ width: `${(checklistCompletedCount / 5) * 100}%` }}
            ></div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-3.5">
            {/* Step 1: Profile Completed */}
            <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] last:border-b-0">
              <div className="flex items-center space-x-3">
                {checklist.profile_completed ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    checklist.profile_completed ? 'text-[#0F172A]' : 'text-[#4A5568]'
                  }`}
                >
                  Company profile completed
                </span>
              </div>
              {!checklist.profile_completed && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('profile')}
                  className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1"
                >
                  <span>Complete Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Step 2: Compliance Declarations */}
            <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] last:border-b-0">
              <div className="flex items-center space-x-3">
                {checklist.compliance_declared ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    checklist.compliance_declared ? 'text-[#0F172A]' : 'text-[#4A5568]'
                  }`}
                >
                  Compliance declarations submitted
                </span>
              </div>
              {!checklist.compliance_declared && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('profile')}
                  className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1"
                >
                  <span>Complete in Company Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Step 3: Account Manager Assigned (Not Supplier-Controlled) */}
            <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] last:border-b-0">
              <div className="flex items-center space-x-3">
                {checklist.rm_assigned ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    checklist.rm_assigned ? 'text-[#0F172A]' : 'text-[#4A5568]'
                  }`}
                >
                  Account manager assigned
                </span>
              </div>
              {!checklist.rm_assigned && (
                <span className="text-[11px] text-[#94A3B8] italic">
                  Pending — TerraTern team action (Assigned shortly)
                </span>
              )}
            </div>

            {/* Step 4: First Candidate Added */}
            <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] last:border-b-0">
              <div className="flex items-center space-x-3">
                {checklist.first_candidate_added ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    checklist.first_candidate_added ? 'text-[#0F172A]' : 'text-[#4A5568]'
                  }`}
                >
                  First candidate added
                </span>
              </div>
              {!checklist.first_candidate_added && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('post_talent')}
                  className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1"
                >
                  <span>Add your first candidate</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Step 5: First Candidate Interview Ready */}
            <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] last:border-b-0">
              <div className="flex items-center space-x-3">
                {checklist.first_interview_ready ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    checklist.first_interview_ready ? 'text-[#0F172A]' : 'text-[#4A5568]'
                  }`}
                >
                  First candidate Interview Ready
                </span>
              </div>
              {!checklist.first_interview_ready && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('track_talent')}
                  className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1"
                >
                  <span>Track candidate progress</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STATS ROW — 5 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Card 1: Candidates in Qualification */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-[6px] bg-[#7EB3E8]/20 flex items-center justify-center text-[#1B3270] flex-shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
              Candidates in Qualification
            </span>
            <p className="text-2xl font-bold text-[#1B3270] mt-0.5">{stats.inFlow}</p>
          </div>
        </div>

        {/* Card 2: Interview Ready */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-[6px] bg-[#10B981]/15 flex items-center justify-center text-[#10B981] flex-shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
              Interview Ready
            </span>
            <p className="text-2xl font-bold text-[#1B3270] mt-0.5">
              {stats.interviewReady}
            </p>
          </div>
        </div>

        {/* Card 3: Submitted to Requirements */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-[6px] bg-[#2952A3]/10 flex items-center justify-center text-[#2952A3] flex-shrink-0">
            <Briefcase size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
              Submitted to Requirements
            </span>
            <p className="text-2xl font-bold text-[#1B3270] mt-0.5">
              {stats.submittedToJobs}
            </p>
          </div>
        </div>

        {/* Card 4: Needs Attention */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex items-start space-x-3.5">
          <div
            className={`w-10 h-10 rounded-[6px] flex items-center justify-center flex-shrink-0 ${
              stats.pendingActions > 0
                ? 'bg-[#EF4444]/15 text-[#EF4444]'
                : 'bg-gray-100 text-[#94A3B8]'
            }`}
          >
            <AlertCircle size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
              Needs Attention
            </span>
            <p
              className={`text-2xl font-bold mt-0.5 ${
                stats.pendingActions > 0 ? 'text-[#EF4444]' : 'text-[#1B3270]'
              }`}
            >
              {stats.pendingActions}
            </p>
          </div>
        </div>

        {/* Card 5: Total Placements (NEW) */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-[6px] bg-[#10B981]/15 flex items-center justify-center text-[#10B981] flex-shrink-0">
            <Award size={20} />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block">
              Total Placements
            </span>
            <p className="text-2xl font-bold text-[#10B981] mt-0.5">
              {stats.totalPlacements}
            </p>
          </div>
        </div>
      </div>

      {/* CANDIDATE ALERTS SECTION — Only shown if any alerts exist */}
      {candidateAlerts.length > 0 && (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
          <div className="flex items-center space-x-2.5 mb-3.5">
            <div className="w-8 h-8 rounded-[6px] bg-[#EF4444]/10 flex items-center justify-center text-[#EF4444]">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1B3270]">Candidate Alerts</h3>
              <p className="text-xs text-[#94A3B8]">
                {candidateAlerts.length} candidate alert{candidateAlerts.length === 1 ? '' : 's'} requiring attention or action
              </p>
            </div>
          </div>

          <div className="divide-y divide-[#F1F5F9]">
            {candidateAlerts.map((alert) => (
              <div
                key={alert.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-1 last:pb-1"
              >
                <div className="flex items-start space-x-3">
                  <span className="mt-0.5 w-2 h-2 rounded-full bg-[#EF4444] flex-shrink-0"></span>
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-[#0F172A]">
                      {alert.alertText}
                    </p>
                    <p className="text-[11px] text-[#94A3B8]">
                      Candidate: <span className="font-medium text-[#4A5568]">{alert.candidateName}</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedAlertCandidate(alert)}
                  className="px-3.5 py-1.5 bg-white border border-[#E2E8F4] hover:border-[#1B3270] text-[#1B3270] hover:text-[#1B3270] text-xs font-semibold rounded-[6px] transition-colors whitespace-nowrap self-start sm:self-auto shadow-2xs"
                >
                  View Candidate
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MATCHING REQUIREMENTS CARD (UPDATED) */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">
            New Matching Requirements
          </span>
          <h3 className="text-base font-bold text-[#1B3270]">
            {matchingJobsCount} Active Job Requirement{matchingJobsCount === 1 ? '' : 's'} Match Your Talent Pool
          </h3>
          <p className="text-xs text-[#4A5568] mt-0.5">
            {matchingJobsCount} requirement{matchingJobsCount === 1 ? '' : 's'} match your Interview Ready candidates.
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => onNavigateTab('job_pool')}
            className="text-xs font-semibold text-[#2952A3] hover:underline flex items-center whitespace-nowrap"
          >
            <span>Browse Requirements →</span>
            <ArrowRight size={13} className="ml-1" />
          </button>
        </div>
      </div>

      {/* Two columns: Recent Stage Movements & Action Required */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECENT QUALIFICATION ACTIVITY */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1B3270]">
              Recent Qualification Activity
            </h3>
            <span className="text-xs text-[#94A3B8]">Latest gate updates</span>
          </div>

          {recentMovements.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#4A5568]">
              No recent activity yet.
            </div>
          ) : (
            <div className="space-y-3">
              {recentMovements.map((move) => (
                <div
                  key={move.id}
                  className="p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-semibold text-[#1B3270] block truncate">
                      {move.candidates?.first_name} {move.candidates?.last_name}
                    </span>
                    <span className="text-[#4A5568] block truncate">
                      {getGateLabel(move.gate_type)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                        move.status === 'pass'
                          ? 'bg-[#10B981]/15 text-[#10B981]'
                          : move.status === 'fail'
                          ? 'bg-[#EF4444]/15 text-[#EF4444]'
                          : 'bg-gray-100 text-[#4A5568]'
                      }`}
                    >
                      {move.status}
                    </span>
                    <span className="text-[11px] text-[#94A3B8] whitespace-nowrap flex items-center">
                      <Clock size={11} className="mr-0.5" />
                      {formatTimeAgo(move.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ACTION REQUIRED */}
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#1B3270]">Action Required</h3>
            <span className="text-xs text-[#94A3B8]">Summary of alerts</span>
          </div>

          {candidateAlerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#10B981] flex flex-col items-center justify-center space-y-1">
              <CheckCircle size={20} />
              <span>No pending actions. All clear.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {candidateAlerts.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="p-3.5 bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-[6px] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-semibold text-[#1B3270] block truncate">
                      {alert.candidateName}
                    </span>
                    <span className="text-[#EF4444] font-medium block break-words">
                      {alert.alertText}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedAlertCandidate(alert)}
                    className="text-xs font-semibold text-[#2952A3] hover:underline whitespace-nowrap"
                  >
                    View Details →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CANDIDATE DETAIL MODAL */}
      {selectedAlertCandidate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => setSelectedAlertCandidate(null)}
              className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#1B3270]"
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div className="flex items-start space-x-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-[#1B3270]/10 flex items-center justify-center text-[#1B3270] font-bold text-sm">
                <User size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1B3270]">
                  {selectedAlertCandidate.candidateName}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#7EB3E8]/20 text-[#1B3270] capitalize">
                    {selectedAlertCandidate.candidate.target_role || 'General Role'}
                  </span>
                  <span className="text-xs text-[#94A3B8]">
                    Status: <strong className="text-[#4A5568] capitalize">{selectedAlertCandidate.candidate.status?.replace('_', ' ')}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Alert Context Banner */}
            <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/25 rounded-[8px] mb-5 space-y-1.5">
              <div className="flex items-center space-x-2 text-[#EF4444] font-semibold text-xs">
                <ShieldAlert size={16} />
                <span>Notice</span>
              </div>
              <p className="text-xs text-[#0F172A] leading-relaxed">
                {selectedAlertCandidate.alertText}
              </p>
            </div>

            {/* Detail Information */}
            <div className="space-y-3 mb-6 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 text-xs">
              <div className="flex justify-between py-1 border-b border-[#E2E8F4]/60">
                <span className="text-[#94A3B8]">Language Level:</span>
                <span className="font-semibold text-[#1B3270]">
                  {selectedAlertCandidate.candidate.language_level_self_reported || 'Not reported'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-[#E2E8F4]/60">
                <span className="text-[#94A3B8]">Profile Completion:</span>
                <span className="font-semibold text-[#1B3270]">
                  {selectedAlertCandidate.candidate.profile_completion_pct || 0}%
                </span>
              </div>
              {selectedAlertCandidate.candidate.email && (
                <div className="flex justify-between py-1 border-b border-[#E2E8F4]/60">
                  <span className="text-[#94A3B8]">Email:</span>
                  <span className="font-medium text-[#4A5568]">
                    {selectedAlertCandidate.candidate.email}
                  </span>
                </div>
              )}

              {/* If cooling period */}
              {selectedAlertCandidate.coolingPeriod && (
                <div className="flex justify-between py-1 border-b border-[#E2E8F4]/60">
                  <span className="text-[#94A3B8]">Cooling Ends:</span>
                  <span className="font-semibold text-[#EF4444]">
                    {new Date(selectedAlertCandidate.coolingPeriod.ends_at).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}

              {/* If rejected documents */}
              {selectedAlertCandidate.rejectedDocs && selectedAlertCandidate.rejectedDocs.length > 0 && (
                <div className="pt-2">
                  <span className="font-semibold text-[#0F172A] block mb-1.5">
                    Rejected Documents:
                  </span>
                  <div className="space-y-1.5">
                    {selectedAlertCandidate.rejectedDocs.map((doc: any) => (
                      <div
                        key={doc.id}
                        className="p-2 bg-white border border-[#E2E8F4] rounded-[6px] text-[11px]"
                      >
                        <div className="flex items-center justify-between text-[#1B3270] font-medium">
                          <span className="flex items-center space-x-1.5">
                            <FileText size={12} className="text-[#EF4444]" />
                            <span>{doc.document_label || doc.document_type}</span>
                          </span>
                          <span className="text-[#EF4444] font-semibold">Rejected</span>
                        </div>
                        {doc.rejection_reason && (
                          <p className="text-[#94A3B8] mt-1 pl-4 italic">
                            Reason: {doc.rejection_reason}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setSelectedAlertCandidate(null)}
                className="px-4 py-2 text-xs font-medium text-[#4A5568] hover:text-[#1B3270]"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedAlertCandidate(null);
                  onNavigateTab('post_talent');
                }}
                className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors"
              >
                View in Candidates Tab
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
