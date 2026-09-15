import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Lock,
  CheckCircle2,
  Info,
  Award,
  Mic,
  Users,
    Loader2,
  BookOpen,
} from 'lucide-react';

interface AcademyTabProps {
  candidate: any;
}

interface OfferingItem {
  id: string;
  offering_id: string;
  gate_type_failed: string;
  status: string;
  offerings: {
    name: string;
    description: string;
    type: string;
    price: number;
    applicable_gate: string;
  } | null;
}

export const AcademyTab: React.FC<AcademyTabProps> = ({ candidate }) => {
  const [gateResults, setGateResults] = useState<any[]>([]);
  const [speakingTestResult, setSpeakingTestResult] = useState<any | null>(null);
  const [speakingOfferings, setSpeakingOfferings] = useState<OfferingItem[]>([]);
  const [assessmentOfferings, setAssessmentOfferings] = useState<OfferingItem[]>([]);
  const [stSchedule, setStSchedule] = useState<any | null>(null);
  const [candidateData, setCandidateData] = useState<any | null>(candidate);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchAcademyData = async () => {
    if (!candidate?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // 1. Fetch latest candidate info (including speaking_test_track)
      const { data: candRow } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidate.id)
        .maybeSingle();

      if (candRow) setCandidateData(candRow);

      // 2. Fetch all gate results for candidate
      const { data: gates, error: gatesErr } = await supabase
        .from('gate_results')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false });

      if (gatesErr) console.error('Error fetching gates:', gatesErr);
      else setGateResults(gates || []);

      // 3. Fetch speaking_test_results (approved)
      const { data: stRes } = await supabase
        .from('speaking_test_results')
        .select('*')
        .eq('candidate_id', candidate.id)
        .eq('review_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setSpeakingTestResult(stRes || null);

      // 4. Fetch speaking_test_schedules
      const { data: schedData } = await supabase
        .from('speaking_test_schedules')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      setStSchedule(schedData || null);

      // 5. Fetch candidate_offerings for speaking_test
      const { data: stOffData } = await supabase
        .from('candidate_offerings')
        .select(`
          id,
          offering_id,
          gate_type_failed,
          status,
          offerings (
            name,
            description,
            type,
            price,
            applicable_gate
          )
        `)
        .eq('candidate_id', candidate.id)
        .eq('gate_type_failed', 'speaking_test')
        .eq('status', 'recommended');

      setSpeakingOfferings((stOffData as any[]) || []);

      // 6. Fetch candidate_offerings for assessment
      const { data: offData, error: offErr } = await supabase
        .from('candidate_offerings')
        .select(`
          id,
          offering_id,
          gate_type_failed,
          status,
          offerings (
            name,
            description,
            type,
            price,
            applicable_gate
          )
        `)
        .eq('candidate_id', candidate.id)
        .eq('gate_type_failed', 'assessment')
        .eq('status', 'recommended');

      if (offErr) {
        console.error('Error fetching assessment offerings:', offErr);
      } else {
        setAssessmentOfferings((offData as any[]) || []);
      }
    } catch (err) {
      console.error('Error loading academy data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (candidate?.id) {
      fetchAcademyData();
    } else {
      setLoading(false);
    }
  }, [candidate?.id]);

  const handleOfferingAction = async (
    offeringId: string,
    newStatus: 'availed' | 'declined',
    gateType: 'speaking_test' | 'assessment'
  ) => {
    try {
      setActionLoadingId(offeringId);
      const { error } = await supabase
        .from('candidate_offerings')
        .update({ status: newStatus })
        .eq('id', offeringId);

      if (error) throw error;

      if (gateType === 'speaking_test') {
        setSpeakingOfferings((prev) => prev.filter((o) => o.id !== offeringId));
      } else {
        setAssessmentOfferings((prev) => prev.filter((o) => o.id !== offeringId));
      }
    } catch (err) {
      console.error(`Error updating offering to ${newStatus}:`, err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Build gate results lookup
  const latestByGate: Record<string, any> = {};
  const assessmentAttempts = gateResults.filter((g) => g.gate_type === 'assessment');

  gateResults.forEach((g) => {
    if (
      !latestByGate[g.gate_type] ||
      new Date(g.created_at) > new Date(latestByGate[g.gate_type].created_at)
    ) {
      latestByGate[g.gate_type] = g;
    }
  });

  const docVerificationGate = latestByGate['doc_verification'];
  const speakingGate = latestByGate['speaking_test'];
  const bootcampGate = latestByGate['bootcamp'];
  const assessmentGate = latestByGate['assessment'];

  // Passed / Completed gates
  // Speaking test completed if approved (pass or diagnostic fail)
  const isSpeakingApproved =
    speakingTestResult !== null || speakingGate?.review_status === 'approved';
  const isSpeakingPassed =
    speakingTestResult?.overall_outcome === 'pass' ||
    (speakingGate?.review_status === 'approved' && speakingGate?.status === 'pass');
  const isSpeakingFailed =
    speakingTestResult?.overall_outcome === 'fail' ||
    (speakingGate?.review_status === 'approved' && speakingGate?.status === 'fail');

  const bootcampPassed = bootcampGate?.status === 'completed' || bootcampGate?.status === 'pass';
  const assessmentPassed = assessmentGate?.status === 'pass';

  let passedCount = 0;
  if (isSpeakingApproved) passedCount++;
  if (bootcampPassed) passedCount++;
  if (assessmentPassed) passedCount++;

  const progressPercent = Math.round((passedCount / 3) * 100);

  // Card unlock conditions:
  // Card 1: doc_verification status = 'pass' OR candidate has dt_passed_at / schedule
  const card1Unlocked =
    docVerificationGate?.status === 'pass' ||
    !!candidateData?.dt_passed_at ||
    !!stSchedule ||
    !!speakingGate;

  // Card 2: Interview Bootcamp unlocks after speaking test is completed/approved (either track)
  const card2Unlocked = isSpeakingApproved || !!bootcampGate;

  // Card 3: Final Assessment unlocks after bootcamp is completed or in progress
  const card3Unlocked =
    bootcampGate?.status === 'in_progress' ||
    bootcampGate?.status === 'completed' ||
    bootcampGate?.status === 'pass';

  const getCardBorderClass = (isUnlocked: boolean, isPassed: boolean, isDiagnosticCompleted = false) => {
    if (!isUnlocked) return 'border-l-[4px] border-l-[#E2E8F4] opacity-75';
    if (isPassed) return 'border-l-[4px] border-l-[#10B981]';
    if (isDiagnosticCompleted) return 'border-l-[4px] border-l-[#F59E0B]';
    return 'border-l-[4px] border-l-[#2952A3]';
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-7 h-7 animate-spin text-[#1B3270] mb-2" />
        <span className="text-xs font-medium">Loading academy roadmap...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-150 text-xs">
      {/* Progress Bar at Top */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-[#1B3270] uppercase tracking-wider">
            Progress toward Interview Ready
          </span>
          <span className="text-xs font-bold text-[#10B981]">
            {progressPercent}% Complete
          </span>
        </div>
        <div className="w-full h-2.5 bg-[#E2E8F4] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#10B981] transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-[11px] text-[#94A3B8] mt-2">
          Complete the diagnostic Speaking Test, Interview Bootcamp, and Assessment to unlock hiring opportunities.
        </p>
      </div>

      {/* THREE SEQUENTIAL CARDS */}
      <div className="space-y-4">
        {/* CARD 1: SPEAKING TEST */}
        <div
          className={`bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)] ${getCardBorderClass(
            card1Unlocked,
            isSpeakingPassed,
            isSpeakingFailed
          )}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-[6px] flex items-center justify-center ${
                  isSpeakingPassed
                    ? 'bg-[#10B981]/20 text-[#10B981]'
                    : isSpeakingFailed
                    ? 'bg-amber-100 text-amber-700'
                    : card1Unlocked
                    ? 'bg-[#7EB3E8]/20 text-[#1B3270]'
                    : 'bg-[#F8FAFD] text-[#94A3B8]'
                }`}
              >
                <Mic size={18} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#94A3B8] block">
                  STAGE 01
                </span>
                <h3 className="text-base font-bold text-[#1B3270]">Speaking Test</h3>
              </div>
            </div>

            <div>
              {!card1Unlocked ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#F8FAFD] text-[#94A3B8] border border-[#E2E8F4]">
                  <Lock size={12} className="mr-1.5" />
                  Available after your documents are verified
                </span>
              ) : isSpeakingPassed ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                  <CheckCircle2 size={12} className="mr-1.5" />
                  Passed
                </span>
              ) : isSpeakingFailed ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-300">
                  Completed (Diagnostic)
                </span>
              ) : speakingGate?.review_status === 'pending' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  Awaiting Lead Review
                </span>
              ) : stSchedule?.status === 'approved' || stSchedule?.status === 'scheduled' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#1B3270] border border-blue-200">
                  Scheduled: {stSchedule.proposed_date}
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#F8FAFD] text-[#4A5568] border border-[#E2E8F4]">
                  Not yet scheduled
                </span>
              )}
            </div>
          </div>

          {/* PART 3: SPEAKING TEST DETAILS AFTER APPROVAL */}
          {card1Unlocked && (
            <div className="space-y-4 pt-2">
              {isSpeakingPassed ? (
                /* PASS TRACK CARD */
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-[8px] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 text-sm flex items-center">
                      <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" />
                      Speaking Test — Passed
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-emerald-800 border border-emerald-200">
                      Score: {speakingTestResult?.total_score || speakingGate?.score || 0} / 100
                    </span>
                  </div>

                  <p className="text-emerald-800 leading-relaxed text-xs">
                    Level assessed:{' '}
                    <strong className="text-emerald-950 font-bold">
                      {speakingTestResult?.language_level_assessed || candidateData?.language_level_self_reported || 'B1'}
                    </strong>
                  </p>

                  <p className="text-emerald-900 font-medium text-xs">
                    You are enrolled in the Pass Track bootcamp. Session details will be shared by your mentor.
                  </p>
                </div>
              ) : isSpeakingFailed ? (
                /* FAIL / DIAGNOSTIC TRACK CARD */
                <div className="space-y-3">
                  <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-[8px] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 text-sm flex items-center">
                        <Award className="w-4 h-4 mr-1.5 text-amber-600" />
                        Speaking Test — Completed
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-white text-amber-800 border border-amber-200">
                        Score: {speakingTestResult?.total_score || speakingGate?.score || 0} / 100
                      </span>
                    </div>

                    <p className="text-amber-800 leading-relaxed text-xs">
                      Level assessed:{' '}
                      <strong className="text-amber-950 font-bold">
                        {speakingTestResult?.language_level_assessed || candidateData?.language_level_self_reported || 'B1'}
                      </strong>
                    </p>

                    <div className="p-3 bg-white/80 border border-amber-200/80 rounded-[6px] text-amber-900 text-xs leading-relaxed space-y-1">
                      <p className="font-semibold">
                        Note: You are proceeding to Interview Bootcamp regardless.
                      </p>
                      <p className="text-amber-800 text-[11px]">
                        The Speaking Test is a diagnostic step — you move forward regardless. Training options are also available below to support your communication.
                      </p>
                    </div>
                  </div>

                  {/* NON-BLOCKING OFFERINGS FOR SPEAKING TEST */}
                  {speakingOfferings.length > 0 && (
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 text-xs flex items-center">
                          <BookOpen className="w-3.5 h-3.5 mr-1.5 text-[#1B3270]" />
                          Recommended Language &amp; Clinical Modules
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Non-blocking — avail or decline freely
                        </span>
                      </div>

                      <div className="space-y-2">
                        {speakingOfferings.map((item) => (
                          <div
                            key={item.id}
                            className="p-3.5 border border-[#E2E8F4] rounded-[8px] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
                          >
                            <div className="space-y-0.5">
                              <h4 className="text-xs font-bold text-[#1B3270]">
                                {item.offerings?.name}
                              </h4>
                              <p className="text-[11px] text-slate-600 leading-relaxed">
                                {item.offerings?.description}
                              </p>
                              {item.offerings?.price ? (
                                <span className="text-[11px] font-semibold text-[#2952A3] block pt-0.5">
                                  Fee: €{item.offerings.price}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block pt-0.5">
                                  Complimentary Academy Offering
                                </span>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 shrink-0">
                              <button
                                type="button"
                                disabled={actionLoadingId === item.id}
                                onClick={() => handleOfferingAction(item.id, 'declined', 'speaking_test')}
                                className="px-3 py-1.5 text-xs text-slate-500 hover:text-rose-600 border border-[#E2E8F4] rounded-[6px] hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                Decline
                              </button>
                              <button
                                type="button"
                                disabled={actionLoadingId === item.id}
                                onClick={() => handleOfferingAction(item.id, 'availed', 'speaking_test')}
                                className="px-3.5 py-1.5 bg-[#1B3270] hover:bg-[#16285a] text-white text-xs font-semibold rounded-[6px] shadow-2xs transition-colors cursor-pointer"
                              >
                                Avail Offering
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* PRE-ASSESSMENT EXPLANATION */
                <div className="space-y-3">
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    A conversational evaluation with German healthcare educators to assess workplace vocabulary, listening comprehension, and patient interaction readiness.
                  </p>

                  <div className="p-3 bg-[#7EB3E8]/10 border border-[#7EB3E8]/30 rounded-[6px] text-xs text-[#2952A3]">
                    <strong>Note:</strong> The Speaking Test is a diagnostic step. Whether you pass or do not pass, you will proceed to Interview Bootcamp. Your result informs your training track.
                  </div>

                  <div className="flex items-center text-xs text-[#94A3B8]">
                    <Info size={14} className="mr-1.5 flex-shrink-0" />
                    <span>
                      {stSchedule
                        ? `Your Speaking Test is scheduled for ${stSchedule.proposed_date} at ${stSchedule.proposed_time || 'agreed time'}.`
                        : 'Your Speaking Test will be scheduled by the TerraTern Academic team. You will receive a notification before your test.'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CARD 2: INTERVIEW BOOTCAMP */}
        <div
          className={`bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)] ${getCardBorderClass(
            card2Unlocked,
            bootcampPassed
          )}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-[6px] flex items-center justify-center ${
                  bootcampPassed
                    ? 'bg-[#10B981]/20 text-[#10B981]'
                    : card2Unlocked
                    ? 'bg-[#7EB3E8]/20 text-[#1B3270]'
                    : 'bg-[#F8FAFD] text-[#94A3B8]'
                }`}
              >
                <Users size={18} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#94A3B8] block">
                  STAGE 02
                </span>
                <h3 className="text-base font-bold text-[#1B3270]">
                  Interview Bootcamp
                </h3>
              </div>
            </div>

            <div>
              {!card2Unlocked ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#F8FAFD] text-[#94A3B8] border border-[#E2E8F4]">
                  <Lock size={12} className="mr-1.5" />
                  Begins after your Speaking Test is completed
                </span>
              ) : bootcampPassed ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  <CheckCircle2 size={12} className="mr-1.5" />
                  Completed
                </span>
              ) : bootcampGate?.status === 'in_progress' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  In Progress
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Enrolled — Coordinating
                </span>
              )}
            </div>
          </div>

          {card2Unlocked && (
            <div className="space-y-3 pt-2">
              <p className="text-xs text-[#4A5568] leading-relaxed">
                Intensive clinical simulation and German healthcare interview etiquette workshop. You will practice mock interviews with German hospital panel scenarios.
              </p>

              {candidateData?.speaking_test_track && (
                <div className="p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs text-[#1B3270]">
                  Enrolled Track:{' '}
                  <strong>
                    {candidateData.speaking_test_track === 'pass_track'
                      ? 'Pass Track (Accelerated Clinical Interviewing)'
                      : 'Support Track (Integrated Speaking & Handover Intensive)'}
                  </strong>
                </div>
              )}

              <div className="p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs text-[#4A5568] flex items-center">
                <Info size={14} className="mr-2 text-[#2952A3] flex-shrink-0" />
                <span>
                  Your Interview Bootcamp is delivered by the TerraTern Academic team and your assigned mentor. Sessions will be coordinated and you will be notified.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* CARD 3: FINAL ASSESSMENT */}
        <div
          className={`bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)] ${getCardBorderClass(
            card3Unlocked,
            assessmentPassed
          )}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center space-x-3">
              <div
                className={`w-9 h-9 rounded-[6px] flex items-center justify-center ${
                  assessmentPassed
                    ? 'bg-[#10B981]/20 text-[#10B981]'
                    : card3Unlocked
                    ? 'bg-[#7EB3E8]/20 text-[#1B3270]'
                    : 'bg-[#F8FAFD] text-[#94A3B8]'
                }`}
              >
                <Award size={18} />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[#94A3B8] block">
                  STAGE 03 • FINAL GATE
                </span>
                <h3 className="text-base font-bold text-[#1B3270]">
                  Final Assessment
                </h3>
              </div>
            </div>

            <div>
              {!card3Unlocked ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#F8FAFD] text-[#94A3B8] border border-[#E2E8F4]">
                  <Lock size={12} className="mr-1.5" />
                  Available after Interview Bootcamp is completed
                </span>
              ) : assessmentPassed ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                  <CheckCircle2 size={12} className="mr-1.5" />
                  Passed
                </span>
              ) : assessmentGate?.status === 'fail' ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                  Failed
                </span>
              ) : assessmentGate ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#2952A3]/10 text-[#2952A3] border border-[#2952A3]/20 capitalize">
                  {assessmentGate.status}
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-[#F8FAFD] text-[#4A5568] border border-[#E2E8F4]">
                  Pending Scheduling
                </span>
              )}
            </div>
          </div>

          {card3Unlocked && (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-[#4A5568] leading-relaxed">
                The final hurdle before unlocking employer matchmaking. Passing this assessment qualifies you for direct hospital interviews and offer letters.
              </p>

              {/* Attempt Count & Details */}
              <div className="flex items-center space-x-4 text-xs">
                <span className="px-2.5 py-1 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] font-medium text-[#1B3270]">
                  Attempts Recorded: <strong>{assessmentAttempts.length}</strong> / 3
                </span>
                {assessmentGate?.score !== null && assessmentGate?.score !== undefined && (
                  <span className="px-2.5 py-1 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] font-medium text-[#1B3270]">
                    Score: <strong>{assessmentGate.score} / 100</strong>
                  </span>
                )}
              </div>

              {/* Retake Rule */}
              <div className="p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs text-[#4A5568]">
                <strong className="text-[#1B3270] block mb-0.5">How Retakes Work:</strong>
                If you do not pass: training options will be recommended. You may retake the assessment after completing the recommended training. Three consecutive unsuccessful attempts will require you to restart your qualification from the Diagnostic Test.
              </div>

              {/* If failed and attempt < 3: show candidate_offerings */}
              {assessmentGate?.status === 'fail' && assessmentAttempts.length < 3 && (
                <div className="space-y-3 pt-2">
                  <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-[6px] text-xs text-[#F59E0B]">
                    Recommended courses to prepare for your retake:
                  </div>

                  {assessmentOfferings.length > 0 && (
                    <div className="space-y-2">
                      {assessmentOfferings.map((item) => (
                        <div
                          key={item.id}
                          className="p-3.5 border border-[#E2E8F4] rounded-[6px] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-bold text-[#1B3270]">
                              {item.offerings?.name}
                            </h4>
                            <p className="text-[11px] text-[#4A5568]">
                              {item.offerings?.description}
                            </p>
                            {item.offerings?.price && (
                              <span className="text-[11px] font-semibold text-[#2952A3] block">
                                Price: €{item.offerings.price}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              type="button"
                              disabled={actionLoadingId === item.id}
                              onClick={() => handleOfferingAction(item.id, 'declined', 'assessment')}
                              className="px-3 py-1 text-xs text-[#4A5568] hover:text-[#EF4444] border border-[#E2E8F4] rounded-[6px] cursor-pointer"
                            >
                              Decline
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingId === item.id}
                              onClick={() => handleOfferingAction(item.id, 'availed', 'assessment')}
                              className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-medium rounded-[6px] cursor-pointer"
                            >
                              Avail
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AcademyTab;
