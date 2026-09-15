import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Users,
  Search,
  Mic,
  GraduationCap,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Calendar,
  Check,
  Eye,
  X,
  HelpCircle,
} from 'lucide-react';
import { RecordSpeakingTestModal } from './components/RecordSpeakingTestModal';
import { ClarificationResubmitModal } from './components/ClarificationResubmitModal';
import { RecordAssessmentModal } from './components/RecordAssessmentModal';
import { FlagAtRiskModal } from './components/FlagAtRiskModal';
import { CandidateProfileDetailView } from '../../components/CandidateProfileDetailView';

interface CandidateCardItem {
  id: string;
  first_name: string;
  last_name: string;
  target_role: string | null;
  language_level: string | null;
  current_stage: string;
  created_at: string;
  speaking_test_track: string | null;
  cohort: {
    id: string;
    name: string;
    track?: string | null;
  } | null;
  coolingPeriod: {
    ends_at: string;
  } | null;
  final_test_locked: boolean;
  consecutive_final_test_fails: number;
  gatesCompleted: {
    dt: boolean;
    speaking_test: boolean;
    bootcamp: boolean;
    assessment: boolean;
    ready: boolean;
  };
  stSchedule: {
    id: string;
    proposed_date: string;
    proposed_time: string;
    status: string;
    academic_request_id?: string;
  } | null;
  stResult: {
    id: string;
    total_score: number;
    score_pct: number;
    overall_outcome: 'pass' | 'fail';
    language_level_assessed: string;
    review_status: 'pending' | 'approved' | 'queried';
    mentor_notes: string;
    reviewer_notes: string | null;
  } | null;
  stStatus: 'not_taken' | 'pending' | 'approved' | 'fail' | 'queried';
  bootcampStatus: 'not_started' | 'in_progress' | 'completed';
  assessmentStatus: 'not_taken' | 'pending' | 'approved' | 'fail';
}

interface MentorCandidatesTabProps {
  onNavigateTab?: (tabId: string, params?: Record<string, string>) => void;
}

export const MentorCandidatesTab: React.FC<MentorCandidatesTabProps> = ({ onNavigateTab }) => {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState<CandidateCardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedCandidateDetail, setSelectedCandidateDetail] = useState<{ id: string; name: string } | null>(null);
  const [stCandidate, setStCandidate] = useState<{
    id: string;
    name: string;
    scheduleId?: string;
    academicRequestId?: string;
  } | null>(null);
  const [clarificationCandidate, setClarificationCandidate] = useState<{
    candidateId: string;
    candidateName: string;
    speakingTestResultId: string;
    reviewerNotes: string | null;
    currentMentorNotes: string | null;
  } | null>(null);

  const [assessmentCandidate, setAssessmentCandidate] = useState<{ id: string; name: string } | null>(null);
  const [flagCandidate, setFlagCandidate] = useState<{ id: string; name: string } | null>(null);
  const [startingBootcampId, setStartingBootcampId] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchMyCandidates = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch active mentor assignments
      const { data: assignments, error: assignErr } = await supabase
        .from('mentor_assignments')
        .select(`
          candidate_id,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            target_role,
            language_level_self_reported,
            created_at,
            status,
            speaking_test_track,
            cohort_id,
            final_test_locked,
            consecutive_final_test_fails
          )
        `)
        .eq('mentor_id', user.id)
        .eq('active', true);

      if (assignErr) throw assignErr;

      const candList = (assignments || [])
        .map((a: any) => a.candidates)
        .filter((c: any) => Boolean(c));

      if (candList.length === 0) {
        setCandidates([]);
        return;
      }

      const candIds = candList.map((c: any) => c.id);

      // Fetch cohort memberships for these candidates
      const { data: cohortMemberships } = await supabase
        .from('cohort_members')
        .select(`
          candidate_id,
          cohort_id,
          cohorts:cohort_id (
            id,
            name,
            track
          )
        `)
        .in('candidate_id', candIds);

      const cohortMap: Record<string, { id: string; name: string; track?: string | null }> = {};
      (cohortMemberships || []).forEach((cm: any) => {
        if (cm.cohorts) {
          cohortMap[cm.candidate_id] = {
            id: cm.cohorts.id,
            name: cm.cohorts.name,
            track: cm.cohorts.track,
          };
        }
      });

      // Also check c.cohort_id for any not in cohort_members
      const missingCohortIds = candList
        .filter((c: any) => c.cohort_id && !cohortMap[c.id])
        .map((c: any) => c.cohort_id);

      if (missingCohortIds.length > 0) {
        const { data: extraCohorts } = await supabase
          .from('cohorts')
          .select('id, name, track')
          .in('id', missingCohortIds);

        const extraMap = new Map((extraCohorts || []).map((co: any) => [co.id, co]));
        candList.forEach((c: any) => {
          if (c.cohort_id && !cohortMap[c.id] && extraMap.has(c.cohort_id)) {
            const co: any = extraMap.get(c.cohort_id);
            cohortMap[c.id] = {
              id: co.id,
              name: co.name,
              track: co.track,
            };
          }
        });
      }

      // Fetch active assessment cooling periods
      const nowIso = new Date().toISOString();
      const { data: coolingRows } = await supabase
        .from('cooling_periods')
        .select('candidate_id, gate_type, ends_at, status')
        .in('candidate_id', candIds)
        .eq('gate_type', 'assessment')
        .eq('status', 'active');

      const coolingMap: Record<string, { ends_at: string }> = {};
      (coolingRows || []).forEach((cr: any) => {
        if (cr.ends_at && cr.ends_at > nowIso) {
          coolingMap[cr.candidate_id] = { ends_at: cr.ends_at };
        }
      });

      // 2. Fetch gate_results for these candidates
      const { data: gateResults } = await supabase
        .from('gate_results')
        .select('candidate_id, gate_type, status, review_status, score')
        .in('candidate_id', candIds)
        .order('created_at', { ascending: false });

      const gateGroup: Record<string, any[]> = {};
      (gateResults || []).forEach((g) => {
        if (!gateGroup[g.candidate_id]) gateGroup[g.candidate_id] = [];
        gateGroup[g.candidate_id].push(g);
      });

      // 3. Fetch speaking_test_schedules for these candidates
      const { data: schedules } = await supabase
        .from('speaking_test_schedules')
        .select('id, candidate_id, proposed_date, proposed_time, status, academic_request_id')
        .in('candidate_id', candIds)
        .order('created_at', { ascending: false });

      const scheduleGroup: Record<string, any> = {};
      (schedules || []).forEach((s) => {
        if (!scheduleGroup[s.candidate_id]) {
          scheduleGroup[s.candidate_id] = s;
        }
      });

      // 4. Fetch speaking_test_results for these candidates
      const { data: stResults } = await supabase
        .from('speaking_test_results')
        .select('*')
        .in('candidate_id', candIds)
        .order('created_at', { ascending: false });

      const stResultGroup: Record<string, any> = {};
      (stResults || []).forEach((r) => {
        if (!stResultGroup[r.candidate_id]) {
          stResultGroup[r.candidate_id] = r;
        }
      });

      // 5. Assemble candidate card items
      const mapped: CandidateCardItem[] = candList.map((c: any) => {
        const gates = gateGroup[c.id] || [];
        const sched = scheduleGroup[c.id] || null;
        const res = stResultGroup[c.id] || null;

        const dtGate = gates.find((g) => g.gate_type === 'dt');
        const stGate = gates.find((g) => g.gate_type === 'speaking_test');
        const bootcampGate = gates.find((g) => g.gate_type === 'bootcamp');
        const assessmentGate = gates.find((g) => g.gate_type === 'assessment');

        const dtDone = dtGate ? dtGate.status === 'pass' : true;
        // Speaking test completed if approved (either pass track or diagnostic fail)
        const stDone = res ? res.review_status === 'approved' : (stGate?.review_status === 'approved');
        const bootcampDone = bootcampGate ? bootcampGate.status === 'completed' : false;
        const assessmentDone = assessmentGate ? assessmentGate.review_status === 'approved' && assessmentGate.status === 'pass' : false;
        const readyDone = c.status === 'interview_ready' || c.status === 'placed';

        let stStatus: CandidateCardItem['stStatus'] = 'not_taken';
        if (res) {
          if (res.review_status === 'queried') stStatus = 'queried';
          else if (res.review_status === 'pending') stStatus = 'pending';
          else if (res.review_status === 'approved') {
            stStatus = res.overall_outcome === 'pass' ? 'approved' : 'fail';
          }
        } else if (stGate) {
          if (stGate.review_status === 'queried') stStatus = 'queried';
          else if (stGate.review_status === 'pending') stStatus = 'pending';
          else if (stGate.review_status === 'approved' && stGate.status === 'pass') stStatus = 'approved';
          else if (stGate.review_status === 'approved') stStatus = 'fail';
        }

        let bootcampStatus: CandidateCardItem['bootcampStatus'] = 'not_started';
        if (bootcampGate) {
          if (bootcampGate.status === 'in_progress') bootcampStatus = 'in_progress';
          else if (bootcampGate.status === 'completed') bootcampStatus = 'completed';
        }

        let assessmentStatus: CandidateCardItem['assessmentStatus'] = 'not_taken';
        if (assessmentGate) {
          if (assessmentGate.review_status === 'pending') assessmentStatus = 'pending';
          else if (assessmentGate.review_status === 'approved' && assessmentGate.status === 'pass') assessmentStatus = 'approved';
          else assessmentStatus = 'fail';
        }

        let currentStage = 'Speaking Test Preparation';
        if (readyDone) currentStage = 'Interview Ready / Placed';
        else if (assessmentDone) currentStage = 'Assessment Passed';
        else if (assessmentGate && assessmentGate.review_status === 'pending') currentStage = 'Assessment Review';
        else if (bootcampStatus === 'in_progress') currentStage = 'Clinical & Language Bootcamp';
        else if (stDone) currentStage = 'Ready for Bootcamp';
        else if (stStatus === 'pending') currentStage = 'Speaking Test Under Review';
        else if (stStatus === 'queried') currentStage = 'Clarification Requested on Speaking Test';

        const cohort = cohortMap[c.id] || null;
        const coolingPeriod = coolingMap[c.id] || null;
        const final_test_locked = Boolean(c.final_test_locked);
        const consecutive_final_test_fails = c.consecutive_final_test_fails || 0;

        return {
          id: c.id,
          first_name: c.first_name || '',
          last_name: c.last_name || '',
          target_role: c.target_role || null,
          language_level: c.language_level_self_reported || null,
          current_stage: currentStage,
          created_at: c.created_at,
          speaking_test_track: c.speaking_test_track || null,
          cohort,
          coolingPeriod,
          final_test_locked,
          consecutive_final_test_fails,
          gatesCompleted: {
            dt: dtDone,
            speaking_test: stDone,
            bootcamp: bootcampDone || bootcampStatus === 'in_progress',
            assessment: assessmentDone,
            ready: readyDone,
          },
          stSchedule: sched,
          stResult: res,
          stStatus,
          bootcampStatus,
          assessmentStatus,
        };
      });

      setCandidates(mapped);
    } catch (err) {
      console.error('Error fetching my candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyCandidates();
  }, [user]);

  // Handle Begin Bootcamp
  const handleBeginBootcamp = async (candidateId: string, candidateName: string) => {
    if (!user) return;
    setStartingBootcampId(candidateId);

    try {
      // 1. INSERT gate_results for bootcamp
      const { error: gateErr } = await supabase.from('gate_results').insert({
        candidate_id: candidateId,
        gate_type: 'bootcamp',
        status: 'in_progress',
        recorded_by: user.id,
        review_status: 'not_required',
      });

      if (gateErr) throw gateErr;

      // 2. UPDATE academic_requests status = 'in_progress'
      await supabase
        .from('academic_requests')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('candidate_id', candidateId);

      // 3. Log session note
      await supabase.from('internal_notes').insert({
        candidate_id: candidateId,
        author_id: user.id,
        note: 'Clinical & Language Bootcamp commenced. Diagnostic milestones scheduled.',
        note_type: 'session',
        is_escalation: false,
        resolved: false,
      });

      showToast(`Bootcamp officially initiated for ${candidateName}.`);
      fetchMyCandidates();
    } catch (err: any) {
      console.error('Error starting bootcamp:', err);
      showToast(err.message || 'Failed to start bootcamp');
    } finally {
      setStartingBootcampId(null);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredCandidates = candidates.filter((c) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const fullName = `${c.first_name} ${c.last_name}`.toLowerCase();
      const role = (c.target_role || '').toLowerCase();
      if (!fullName.includes(q) && !role.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg flex items-center space-x-2 text-xs animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Speaking Test Modal */}
      {stCandidate && (
        <RecordSpeakingTestModal
          candidateId={stCandidate.id}
          candidateName={stCandidate.name}
          scheduleId={stCandidate.scheduleId}
          academicRequestId={stCandidate.academicRequestId}
          onClose={() => setStCandidate(null)}
          onSuccess={() => {
            showToast('Result submitted for Academic Lead review.');
            fetchMyCandidates();
          }}
        />
      )}

      {/* Clarification Resubmit Modal */}
      {clarificationCandidate && (
        <ClarificationResubmitModal
          candidateId={clarificationCandidate.candidateId}
          candidateName={clarificationCandidate.candidateName}
          speakingTestResultId={clarificationCandidate.speakingTestResultId}
          reviewerNotes={clarificationCandidate.reviewerNotes}
          currentMentorNotes={clarificationCandidate.currentMentorNotes}
          onClose={() => setClarificationCandidate(null)}
          onSuccess={() => {
            showToast('Clarification resubmitted to Academic Lead.');
            fetchMyCandidates();
          }}
        />
      )}

      {/* Assessment Modal */}
      {assessmentCandidate && (
        <RecordAssessmentModal
          candidateId={assessmentCandidate.id}
          candidateName={assessmentCandidate.name}
          onClose={() => setAssessmentCandidate(null)}
          onSuccess={() => {
            showToast('Assessment submitted for Academic Lead review.');
            fetchMyCandidates();
          }}
        />
      )}

      {/* Flag At Risk Modal */}
      {flagCandidate && (
        <FlagAtRiskModal
          candidateId={flagCandidate.id}
          candidateName={flagCandidate.name}
          onClose={() => setFlagCandidate(null)}
          onSuccess={() => {
            showToast('Flag sent to Academic Lead.');
            fetchMyCandidates();
          }}
        />
      )}

      {/* Search & Header */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-[#1B3270]" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            My Assigned Candidates ({candidates.length})
          </h3>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter candidates by name or role..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          />
        </div>
      </div>

      {/* CANDIDATE CARDS LIST */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1B3270]" />
          Loading assigned candidates...
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] py-16 px-4 text-center shadow-2xs">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">
            No assigned candidates found
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Candidates assigned to you by the Academic Lead will be listed here with step-by-step gate progress.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredCandidates.map((c) => {
            const fullName = `${c.first_name} ${c.last_name}`.trim() || 'Candidate';

            // Check speaking test schedule and due date
            const hasApprovedSchedule =
              c.stSchedule &&
              ['approved', 'scheduled'].includes(c.stSchedule.status);
            const isDueTodayOrPast =
              c.stSchedule && c.stSchedule.proposed_date <= todayStr;
            const hasNoResultYet = !c.stResult;

            return (
              <div
                key={c.id}
                className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 sm:p-5 shadow-2xs text-xs space-y-4 hover:border-slate-300 transition-colors"
              >
                {/* Top Row: Candidate Meta & Flag Button */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-[#E2E8F4] pb-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {fullName}
                      </span>
                      {c.target_role && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {c.target_role}
                        </span>
                      )}
                      {c.language_level && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#1B3270]">
                          Level: {c.language_level}
                        </span>
                      )}
                      {c.speaking_test_track && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            c.speaking_test_track === 'pass_track'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {c.speaking_test_track === 'pass_track'
                            ? 'Pass Track'
                            : 'Support Track'}
                        </span>
                      )}

                      {/* Cooling Badge */}
                      {c.coolingPeriod && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-semibold text-[10px] flex items-center">
                          <Clock className="w-3 h-3 mr-1 text-amber-600" />
                          Assessment cooling until {new Date(c.coolingPeriod.ends_at).toLocaleDateString()}
                        </span>
                      )}

                      {/* Locked Badge */}
                      {c.final_test_locked && (
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-full font-semibold text-[10px] flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
                          Assessment locked — training required
                        </span>
                      )}
                    </div>

                    {/* Cohort Info Row */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {c.cohort ? (
                        <div className="flex items-center space-x-1.5 text-slate-700">
                          <span className="font-medium text-slate-500">Cohort:</span>
                          <span className="font-semibold text-[#1B3270]">{c.cohort.name}</span>
                          {c.cohort.track && (
                            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {c.cohort.track === 'pass_track' ? 'Pass Track' : c.cohort.track === 'fail_track' ? 'Fail Track' : c.cohort.track}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">
                          No cohort assigned yet
                        </span>
                      )}
                      <span className="text-slate-300">•</span>
                      <span className="text-[11px] text-slate-500">
                        Current Stage: <strong className="text-slate-700 font-semibold">{c.current_stage}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setFlagCandidate({ id: c.id, name: fullName })}
                      className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-[5px] transition-colors flex items-center cursor-pointer"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-500" />
                      Flag as At-Risk
                    </button>
                  </div>
                </div>

                {/* 5-STEP MINI GATE PROGRESS BAR */}
                <div className="p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px]">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                    <span className="font-semibold text-slate-700">
                      Qualification Gate Progress
                    </span>
                    <span>5 Stage Verification</span>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { key: 'dt', label: 'Gate 1: DT', done: c.gatesCompleted.dt },
                      {
                        key: 'speaking_test',
                        label: 'Gate 2: ST',
                        done: c.gatesCompleted.speaking_test,
                      },
                      {
                        key: 'bootcamp',
                        label: 'Gate 3: Bootcamp',
                        done: c.gatesCompleted.bootcamp,
                      },
                      {
                        key: 'assessment',
                        label: 'Gate 4: Assess',
                        done: c.gatesCompleted.assessment,
                      },
                      {
                        key: 'ready',
                        label: 'Gate 5: Ready',
                        done: c.gatesCompleted.ready,
                      },
                    ].map((step, idx) => (
                      <div
                        key={step.key}
                        className={`p-2 rounded-[6px] border text-center transition-colors ${
                          step.done
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center justify-center mb-0.5">
                          {step.done ? (
                            <Check className="w-3 h-3 text-emerald-600 font-bold" />
                          ) : (
                            <span className="text-[10px] text-slate-400 font-bold">
                              {idx + 1}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-semibold block truncate">
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ST Clarification Requested Card */}
                {c.stStatus === 'queried' && c.stResult && (
                  <div className="bg-amber-50/80 border border-amber-300 rounded-[8px] p-3.5 text-xs text-amber-900 space-y-2">
                    <div className="flex items-center space-x-2 font-bold text-amber-900">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Clarification Requested by Academic Lead</span>
                    </div>
                    {c.stResult.reviewer_notes ? (
                      <div className="bg-white border border-amber-200 rounded p-2.5 text-amber-950 font-normal">
                        <span className="font-semibold text-amber-900 block text-[10px] uppercase tracking-wider mb-0.5">
                          Reviewer Notes:
                        </span>
                        <p className="whitespace-pre-line text-xs">{c.stResult.reviewer_notes}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-800">
                        The Academic Lead has queried this speaking test result and requested clarification on the scoring or evaluation notes.
                      </p>
                    )}
                    <div className="pt-0.5 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setClarificationCandidate({
                            candidateId: c.id,
                            candidateName: fullName,
                            speakingTestResultId: c.stResult!.id,
                            reviewerNotes: c.stResult!.reviewer_notes,
                            currentMentorNotes: c.stResult!.mentor_notes,
                          })
                        }
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-[6px] text-xs shadow-2xs flex items-center cursor-pointer transition-colors"
                      >
                        <HelpCircle className="w-3.5 h-3.5 mr-1.5 text-white" />
                        Add Clarification &amp; Resubmit
                      </button>
                    </div>
                  </div>
                )}

                {/* BOTTOM ACTION BAR */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-400 flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    Enrolled {new Date(c.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* 1. Speaking Test Actions */}
                    {hasApprovedSchedule && isDueTodayOrPast && hasNoResultYet && (
                      <button
                        type="button"
                        onClick={() =>
                          setStCandidate({
                            id: c.id,
                            name: fullName,
                            scheduleId: c.stSchedule?.id,
                            academicRequestId: c.stSchedule?.academic_request_id,
                          })
                        }
                        className="px-3.5 py-1.5 bg-[#1B3270] hover:bg-[#16285a] text-white font-semibold rounded-[6px] text-xs shadow-2xs flex items-center cursor-pointer transition-colors"
                      >
                        <Mic className="w-3.5 h-3.5 mr-1" />
                        Record Speaking Test Result
                      </button>
                    )}

                    {hasApprovedSchedule && !isDueTodayOrPast && hasNoResultYet && (
                      <span className="px-3 py-1.5 bg-blue-50 text-[#1B3270] border border-blue-200 rounded-[6px] font-semibold text-xs flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-[#2952A3]" />
                        Speaking Test: {c.stSchedule?.proposed_date} — Scheduled
                      </span>
                    )}

                    {c.stSchedule?.status === 'proposed' && hasNoResultYet && (
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-[6px] font-semibold text-xs flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-slate-500" />
                        Schedule Proposed ({c.stSchedule.proposed_date})
                      </span>
                    )}

                    {c.stStatus === 'pending' && (
                      <span className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-[6px] font-semibold text-xs flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                        ST Result Awaiting Review
                      </span>
                    )}

                    {(c.stStatus === 'approved' || c.stStatus === 'fail') && (
                      <span
                        className={`px-3 py-1.5 rounded-[6px] font-semibold text-xs flex items-center border ${
                          c.stStatus === 'approved'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 mr-1 ${
                            c.stStatus === 'approved'
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          }`}
                        />
                        {c.stStatus === 'approved'
                          ? 'Speaking Test: Pass'
                          : 'Speaking Test: Completed (Diagnostic)'}
                      </span>
                    )}

                    {/* 2. Bootcamp Actions */}
                    {(c.stStatus === 'approved' || c.stStatus === 'fail') && (
                      <>
                        {c.cohort ? (
                          <button
                            type="button"
                            onClick={() => onNavigateTab?.('my-cohorts', { cohortId: c.cohort!.id })}
                            className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#1B3270] border border-blue-200 font-semibold rounded-[6px] text-xs shadow-2xs flex items-center cursor-pointer transition-colors"
                          >
                            <GraduationCap className="w-3.5 h-3.5 mr-1.5 text-[#1B3270]" />
                            Mark attendance in {c.cohort.name} &rarr;
                          </button>
                        ) : c.bootcampStatus === 'not_started' ? (
                          <button
                            type="button"
                            disabled={startingBootcampId === c.id}
                            onClick={() => handleBeginBootcamp(c.id, fullName)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-[6px] text-xs shadow-2xs flex items-center disabled:opacity-50 cursor-pointer transition-colors"
                          >
                            {startingBootcampId === c.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                            ) : (
                              <GraduationCap className="w-3.5 h-3.5 mr-1" />
                            )}
                            Start Bootcamp
                          </button>
                        ) : null}
                      </>
                    )}

                    {/* 3. Assessment Actions */}
                    {c.final_test_locked ? (
                      <div className="px-3 py-1.5 bg-rose-50 border border-rose-200 rounded-[6px] text-rose-800 text-[11px] flex items-center space-x-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Assessment locked. Candidate must complete training and wait for preparation period to end before retaking.</span>
                      </div>
                    ) : c.coolingPeriod ? (
                      <span className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-[6px] font-semibold text-xs flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-amber-600" />
                        Cooling period active until {new Date(c.coolingPeriod.ends_at).toLocaleDateString()}. Test recording disabled.
                      </span>
                    ) : c.assessmentStatus === 'pending' ? (
                      <span className="px-3 py-1.5 bg-purple-50 text-purple-800 border border-purple-200 rounded-[6px] font-semibold text-xs flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-purple-600" />
                        Assessment Under Review
                      </span>
                    ) : c.assessmentStatus === 'approved' ? (
                      <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-[6px] font-semibold text-xs flex items-center">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                        Assessment Passed
                      </span>
                    ) : (c.bootcampStatus === 'in_progress' || c.gatesCompleted.bootcamp) ? (
                      <button
                        type="button"
                        onClick={() =>
                          setAssessmentCandidate({ id: c.id, name: fullName })
                        }
                        className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-[6px] text-xs shadow-2xs flex items-center cursor-pointer transition-colors"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5 mr-1" />
                        Record Assessment
                      </button>
                    ) : null}

                    {/* 4. View Details Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedCandidateDetail({ id: c.id, name: fullName })
                      }
                      className="px-3 py-1.5 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 font-semibold rounded-[6px] text-xs shadow-2xs flex items-center cursor-pointer transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1 text-[#1B3270]" />
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CANDIDATE DETAIL DRAWER */}
      {selectedCandidateDetail && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/30 backdrop-blur-2xs transition-all">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-[#E2E8F4] animate-in slide-in-from-right duration-200">
            <div className="px-6 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div>
                <h2 className="text-base font-bold text-[#1B3270]">
                  {selectedCandidateDetail.name}
                </h2>
                <p className="text-xs text-slate-400">
                  Assigned Mentee Details &amp; Qualification Verification
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidateDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <CandidateProfileDetailView candidateId={selectedCandidateDetail.id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorCandidatesTab;
