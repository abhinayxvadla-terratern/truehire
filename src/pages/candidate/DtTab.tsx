import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle,
  HelpCircle,
  Loader2,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { QuestionReviewView } from '../../components/candidate/dt/QuestionReviewView';

interface DtTabProps {
  candidate: any;
  onNavigateTab?: (tab: string) => void;
}

type ScreenState =
  | 'loading'
  | 'intro'
  | 'test'
  | 'review_before_submit'
  | 'pass_result'
  | 'fail_result'
  | 'cooling_active'
  | 'complete_training_first'
  | 'question_review';

interface DtQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'a' | 'b' | 'c' | 'd';
  difficulty_level: string;
  topic: string | null;
  question_order: number;
}

export const DtTab: React.FC<DtTabProps> = ({ candidate, onNavigateTab }) => {
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [questions, setQuestions] = useState<DtQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, 'a' | 'b' | 'c' | 'd'>>({});
  const [currentAttempt, setCurrentAttempt] = useState<any>(null);
  const [allAttempts, setAllAttempts] = useState<any[]>([]);
  const [activeCoolingPeriod, setActiveCoolingPeriod] = useState<any>(null);
  const [recommendedOfferings, setRecommendedOfferings] = useState<any[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [reviewInitialFilter, setReviewInitialFilter] = useState<string>('all');
  const [showDifficultyBreakdown, setShowDifficultyBreakdown] = useState(true);
  const [lastResultData, setLastResultData] = useState<any>(null);
  const [candidateRecord, setCandidateRecord] = useState<any>(candidate);

  // Helper for difficulty badge styling
  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            Beginner
          </span>
        );
      case 'elementary':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-50 text-sky-700 border border-sky-200">
            Elementary
          </span>
        );
      case 'intermediate':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
            Intermediate
          </span>
        );
      case 'upper_intermediate':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-50 text-orange-700 border border-orange-200">
            Upper Intermediate
          </span>
        );
      case 'b2':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
            B2 Level
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            {difficulty}
          </span>
        );
    }
  };

  // --------------------------------------------------------------------------
  // INITIALIZATION CHECKS (Check Order 1 to 5)
  // --------------------------------------------------------------------------
  const runStateChecks = async () => {
    if (!candidate?.id) {
      setScreen('intro');
      return;
    }

    try {
      setScreen('loading');

      // Refetch candidate fresh data
      const { data: cData } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidate.id)
        .maybeSingle();

      const cand = cData || candidate;
      setCandidateRecord(cand);

      // Fetch all attempts for history
      const { data: attemptsData } = await supabase
        .from('dt_attempts')
        .select('*')
        .eq('candidate_id', cand.id)
        .order('attempt_number', { ascending: false });

      const attemptsList = attemptsData || [];
      setAllAttempts(attemptsList);

      // Fetch recommended offerings if any
      const { data: offData } = await supabase
        .from('candidate_offerings')
        .select(`
          id,
          offering_id,
          gate_type_failed,
          status,
          offerings (
            id,
            name,
            description,
            type,
            price,
            applicable_gate
          )
        `)
        .eq('candidate_id', cand.id)
        .eq('gate_type_failed', 'dt');

      setRecommendedOfferings(offData || []);

      // CHECK 1: Already passed?
      const { data: passedGate } = await supabase
        .from('gate_results')
        .select('*')
        .eq('candidate_id', cand.id)
        .eq('gate_type', 'dt')
        .eq('status', 'pass')
        .maybeSingle();

      if (passedGate) {
        // Find corresponding completed attempt
        const completedAtt = attemptsList.find((a) => a.passed) || attemptsList[0];
        setLastResultData(completedAtt);
        setScreen('pass_result');
        return;
      }

      // CHECK 2: Active cooling period?
      const nowIso = new Date().toISOString();
      const { data: activeCooling } = await supabase
        .from('cooling_periods')
        .select('*')
        .eq('candidate_id', cand.id)
        .eq('gate_type', 'dt')
        .eq('status', 'active')
        .gt('ends_at', nowIso)
        .maybeSingle();

      if (activeCooling) {
        setActiveCoolingPeriod(activeCooling);
        setLastResultData(attemptsList[0]);
        setScreen('cooling_active');
        return;
      }

      // CHECK 3: Cooling expired, check offerings.
      const { data: expiredCooling } = await supabase
        .from('cooling_periods')
        .select('*')
        .eq('candidate_id', cand.id)
        .eq('gate_type', 'dt')
        .eq('status', 'active')
        .lte('ends_at', nowIso)
        .maybeSingle();

      if (expiredCooling) {
        // Mark cooling period as expired
        await supabase
          .from('cooling_periods')
          .update({ status: 'expired' })
          .eq('id', expiredCooling.id);

        // Check if any offering availed
        const hasAvailed = (offData || []).some((o: any) => o.status === 'availed');

        if (!hasAvailed) {
          setActiveCoolingPeriod(expiredCooling);
          setScreen('complete_training_first');
          return;
        } else {
          // Reset attempt count and unlock fresh 10
          await supabase
            .from('candidates')
            .update({ dt_attempt_count: 0 })
            .eq('id', cand.id);

          cand.dt_attempt_count = 0;
          setCandidateRecord({ ...cand, dt_attempt_count: 0 });
          setScreen('intro');
          return;
        }
      }

      // CHECK 4: Attempt in progress?
      const inProgressAttempt = attemptsList.find((a) => a.status === 'in_progress');
      if (inProgressAttempt) {
        setCurrentAttempt(inProgressAttempt);
        await loadQuestionsAndResume(inProgressAttempt.id);
        return;
      }

      // CHECK 5: All clear -> Test Intro
      setScreen('intro');
    } catch (err) {
      console.error('Error running DT checks:', err);
      setScreen('intro');
    }
  };

  useEffect(() => {
    runStateChecks();
  }, [candidate?.id]);

  // --------------------------------------------------------------------------
  // RESUME ATTEMPT
  // --------------------------------------------------------------------------
  const loadQuestionsAndResume = async (attemptId: string) => {
    try {
      // 1. Load active questions
      const { data: qData, error: qErr } = await supabase
        .from('dt_questions')
        .select('*')
        .eq('is_active', true)
        .order('question_order', { ascending: true });

      if (qErr) throw qErr;
      const qList: DtQuestion[] = qData || [];
      setQuestions(qList);

      // 2. Load existing answers for this attempt
      const { data: ansData } = await supabase
        .from('dt_answers')
        .select('question_id, selected_option')
        .eq('attempt_id', attemptId);

      const ansMap: Record<string, 'a' | 'b' | 'c' | 'd'> = {};
      (ansData || []).forEach((a) => {
        if (a.selected_option) {
          ansMap[a.question_id] = a.selected_option as any;
        }
      });

      setSelectedAnswers(ansMap);

      // Resume on first unanswered question
      const firstUnansweredIndex = qList.findIndex((q) => !ansMap[q.id]);
      setCurrentQIndex(firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0);

      setScreen('test');
    } catch (err) {
      console.error('Error resuming test:', err);
      setScreen('intro');
    }
  };

  // --------------------------------------------------------------------------
  // START NEW TEST
  // --------------------------------------------------------------------------
  const handleStartTest = async () => {
    if (!candidateRecord?.id) return;
    try {
      setScreen('loading');

      // 1. Get total previous attempts count
      const { count } = await supabase
        .from('dt_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('candidate_id', candidateRecord.id);

      const nextAttemptNumber = (count ?? 0) + 1;

      // 2. Insert new attempt
      const { data: newAttempt, error: attErr } = await supabase
        .from('dt_attempts')
        .insert({
          candidate_id: candidateRecord.id,
          attempt_number: nextAttemptNumber,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          total_questions: 15,
        })
        .select()
        .single();

      if (attErr) throw attErr;

      setCurrentAttempt(newAttempt);
      setSelectedAnswers({});
      setCurrentQIndex(0);

      // 3. Load all 15 active questions
      const { data: qData, error: qErr } = await supabase
        .from('dt_questions')
        .select('*')
        .eq('is_active', true)
        .order('question_order', { ascending: true });

      if (qErr) throw qErr;
      setQuestions(qData || []);

      setScreen('test');
    } catch (err) {
      console.error('Error starting test:', err);
      setScreen('intro');
    }
  };

  // --------------------------------------------------------------------------
  // TEST SUBMISSION & AUTOMATED SCORING
  // --------------------------------------------------------------------------
  const handleSubmitTest = async () => {
    if (!currentAttempt?.id || !candidateRecord?.id || questions.length === 0) return;

    try {
      setIsSubmitting(true);

      // 1. Compare each question & prepare dt_answers rows
      let correctAnswersCount = 0;
      const answersToInsert = questions.map((q) => {
        const selected = selectedAnswers[q.id] || null;
        const isCorrect = selected !== null && selected.toLowerCase() === q.correct_option.toLowerCase();
        if (isCorrect) correctAnswersCount++;
        return {
          attempt_id: currentAttempt.id,
          question_id: q.id,
          selected_option: selected,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
        };
      });

      // Insert all answers
      const { error: insErr } = await supabase.from('dt_answers').insert(answersToInsert);
      if (insErr) {
        console.warn('Answers insertion note:', insErr);
      }

      // 2. Score Calculation
      const totalQuestions = questions.length || 15;
      const scorePct = Math.round((correctAnswersCount / totalQuestions) * 10000) / 100;
      const passed = correctAnswersCount >= 5;

      // 3. Update dt_attempts
      const nowIso = new Date().toISOString();
      const { data: updatedAttempt, error: updAttErr } = await supabase
        .from('dt_attempts')
        .update({
          correct_answers: correctAnswersCount,
          score_pct: scorePct,
          passed: passed,
          status: 'completed',
          completed_at: nowIso,
        })
        .eq('id', currentAttempt.id)
        .select()
        .single();

      if (updAttErr) throw updAttErr;
      setLastResultData(updatedAttempt || currentAttempt);

      // 4. Branch based on Passed vs Failed
      if (passed) {
        // a. Insert gate_results: pass
        await supabase.from('gate_results').insert({
          candidate_id: candidateRecord.id,
          gate_type: 'dt',
          status: 'pass',
          score: scorePct,
          review_status: 'not_required',
          attempt_number: updatedAttempt?.attempt_number || currentAttempt.attempt_number,
        });

        // b. Update candidates: in_progress, dt_passed_at = now()
        await supabase
          .from('candidates')
          .update({
            status: 'in_progress',
            dt_passed_at: nowIso,
          })
          .eq('id', candidateRecord.id);

        // c. Insert notification for candidate
        if (candidateRecord.user_id) {
          await supabase.from('notifications').insert({
            user_id: candidateRecord.user_id,
            title: 'Diagnostic Test Passed',
            message: `You scored ${scorePct}% and passed the Diagnostic Test. Complete your profile and upload documents to continue.`,
            type: 'gate_result',
            read: false,
          });
        }

        // d. Find assigned RM & send notification
        const candidateName = `${candidateRecord.first_name || ''} ${candidateRecord.last_name || ''}`.trim() || 'Candidate';
        if (candidateRecord.supplier_id) {
          const { data: rmAssign } = await supabase
            .from('rm_assignments')
            .select('rm_profile_id')
            .eq('entity_type', 'supplier')
            .eq('entity_id', candidateRecord.supplier_id)
            .eq('active', true)
            .maybeSingle();

          if (rmAssign?.rm_profile_id) {
            await supabase.from('notifications').insert({
              user_id: rmAssign.rm_profile_id,
              title: 'Candidate Passed Diagnostic Test',
              message: `${candidateName} passed their Diagnostic Test with ${scorePct}%. Begin document review when ready.`,
              type: 'gate_result',
              read: false,
            });
          }
        } else {
          // All profiles where internal_role = 'candidate_supplier_rm'
          const { data: rmProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('internal_role', 'candidate_supplier_rm');

          if (rmProfiles && rmProfiles.length > 0) {
            const notifs = rmProfiles.map((p) => ({
              user_id: p.id,
              title: 'Candidate Passed Diagnostic Test',
              message: `${candidateName} passed their Diagnostic Test with ${scorePct}%. Begin document review when ready.`,
              type: 'gate_result',
              read: false,
            }));
            await supabase.from('notifications').insert(notifs);
          }
        }

        // e. Insert notification for placement_lead(s)
        const { data: leadProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('internal_role', 'placement_lead');

        if (leadProfiles && leadProfiles.length > 0) {
          const leadNotifs = leadProfiles.map((p) => ({
            user_id: p.id,
            title: 'Candidate Passed Diagnostic Test',
            message: `${candidateName} passed their Diagnostic Test with ${scorePct}%. Begin document review when ready.`,
            type: 'gate_result',
            read: false,
          }));
          await supabase.from('notifications').insert(leadNotifs);
        }

        // Refresh state & show pass screen
        setShowConfirmModal(false);
        setScreen('pass_result');
      } else {
        // --- FAILED FLOW ---
        // a. Insert gate_results: fail
        await supabase.from('gate_results').insert({
          candidate_id: candidateRecord.id,
          gate_type: 'dt',
          status: 'fail',
          score: scorePct,
          attempt_number: updatedAttempt?.attempt_number || currentAttempt.attempt_number,
        });

        // b. Update candidates: dt_attempt_count + 1
        const currentCount = candidateRecord.dt_attempt_count ?? 0;
        const newCount = currentCount + 1;

        await supabase
          .from('candidates')
          .update({ dt_attempt_count: newCount })
          .eq('id', candidateRecord.id);

        setCandidateRecord({ ...candidateRecord, dt_attempt_count: newCount });

        // d. Push offerings for 'dt'
        const { data: dtOfferings } = await supabase
          .from('offerings')
          .select('id')
          .eq('applicable_gate', 'dt')
          .eq('is_active', true);

        if (dtOfferings && dtOfferings.length > 0) {
          const { data: existingOff } = await supabase
            .from('candidate_offerings')
            .select('offering_id')
            .eq('candidate_id', candidateRecord.id);

          const existingIds = new Set((existingOff || []).map((o) => o.offering_id));
          const newRecommendations = dtOfferings
            .filter((o) => !existingIds.has(o.id))
            .map((o) => ({
              candidate_id: candidateRecord.id,
              offering_id: o.id,
              gate_type_failed: 'dt',
              status: 'recommended',
            }));

          if (newRecommendations.length > 0) {
            await supabase.from('candidate_offerings').insert(newRecommendations);
          }
        }

        // e & f. Notification & screen routing based on attempt count
        const candidateName = `${candidateRecord.first_name || ''} ${candidateRecord.last_name || ''}`.trim() || 'Candidate';

        if (newCount < 10) {
          // Attempt 1-9
          if (candidateRecord.user_id) {
            await supabase.from('notifications').insert({
              user_id: candidateRecord.user_id,
              title: `Diagnostic Test — Attempt ${newCount}`,
              message: `You scored ${scorePct}%. You need 33% to pass. You have ${10 - newCount} attempts remaining before a preparation period applies. You can retake now or use the recommended training to prepare.`,
              type: 'gate_result',
              read: false,
            });
          }
          setShowConfirmModal(false);
          setScreen('fail_result');
        } else {
          // Attempt 10: Activate 14-day cooling period
          const endsAtDate = new Date();
          endsAtDate.setDate(endsAtDate.getDate() + 14);

          const { data: coolingRow } = await supabase
            .from('cooling_periods')
            .insert({
              candidate_id: candidateRecord.id,
              gate_type: 'dt',
              started_at: nowIso,
              cooling_duration_days: 14,
              ends_at: endsAtDate.toISOString(),
              status: 'active',
              triggered_by_attempt_id: currentAttempt.id,
            })
            .select()
            .single();

          setActiveCoolingPeriod(coolingRow);

          if (candidateRecord.user_id) {
            await supabase.from('notifications').insert({
              user_id: candidateRecord.user_id,
              title: 'Diagnostic Test — Preparation Period Activated',
              message: 'You have used all 10 attempts. A 14-day preparation period now applies. Complete the recommended training to prepare for your next round.',
              type: 'gate_result',
              read: false,
            });
          }

          // Insert notification for RM(s)
          const { data: rmProfiles } = await supabase
            .from('profiles')
            .select('id')
            .eq('internal_role', 'candidate_supplier_rm');

          if (rmProfiles && rmProfiles.length > 0) {
            const rmNotifs = rmProfiles.map((p) => ({
              user_id: p.id,
              title: 'Candidate Reached DT Attempt Limit',
              message: `${candidateName} has used all 10 Diagnostic Test attempts. A 14-day preparation period has been applied. Offerings have been recommended.`,
              type: 'gate_result',
              read: false,
            }));
            await supabase.from('notifications').insert(rmNotifs);
          }

          setShowConfirmModal(false);
          setScreen('fail_result');
        }
      }

      // Re-fetch fresh offerings list
      const { data: refOff } = await supabase
        .from('candidate_offerings')
        .select(`
          id,
          offering_id,
          gate_type_failed,
          status,
          offerings (
            id,
            name,
            description,
            type,
            price,
            applicable_gate
          )
        `)
        .eq('candidate_id', candidateRecord.id)
        .eq('gate_type_failed', 'dt');

      setRecommendedOfferings(refOff || []);

      // Re-fetch all attempts
      const { data: refreshedAttempts } = await supabase
        .from('dt_attempts')
        .select('*')
        .eq('candidate_id', candidateRecord.id)
        .order('attempt_number', { ascending: false });

      setAllAttempts(refreshedAttempts || []);
    } catch (err) {
      console.error('Error submitting diagnostic test:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // AVAIL OFFERING
  // --------------------------------------------------------------------------
  const handleAvailOffering = async (offeringCandidateId: string) => {
    try {
      setActionLoadingId(offeringCandidateId);
      const { error } = await supabase
        .from('candidate_offerings')
        .update({ status: 'availed' })
        .eq('id', offeringCandidateId);

      if (error) throw error;

      setRecommendedOfferings((prev) =>
        prev.map((o) => (o.id === offeringCandidateId ? { ...o, status: 'availed' } : o))
      );
    } catch (err) {
      console.error('Error availing offering:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  // --------------------------------------------------------------------------
  // UNLOCK NEXT ATTEMPTS (After cooling expired and offering availed)
  // --------------------------------------------------------------------------
  const handleUnlockNextRound = async () => {
    if (!candidateRecord?.id) return;
    try {
      setScreen('loading');
      await supabase
        .from('candidates')
        .update({ dt_attempt_count: 0 })
        .eq('id', candidateRecord.id);

      setCandidateRecord({ ...candidateRecord, dt_attempt_count: 0 });
      setScreen('intro');
    } catch (err) {
      console.error('Error unlocking next round:', err);
      setScreen('intro');
    }
  };

  // Helper: format countdown
  const getRemainingDaysAndHours = (endsAtStr?: string) => {
    if (!endsAtStr) return '14 days 0 hours';
    const endsAt = new Date(endsAtStr).getTime();
    const now = new Date().getTime();
    const diff = Math.max(0, endsAt - now);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days} days ${hours} hours`;
  };

  // --------------------------------------------------------------------------
  // RENDER ATTEMPT CIRCLES COMPONENT
  // --------------------------------------------------------------------------
  const renderAttemptCircles = (usedCount: number, isTenFails = false) => {
    const total = 10;
    const clampedUsed = Math.min(total, Math.max(0, usedCount));
    return (
      <div className="flex items-center space-x-1.5 my-3">
        {Array.from({ length: total }).map((_, idx) => {
          const isUsed = idx < clampedUsed;
          if (isTenFails) {
            return (
              <div
                key={idx}
                className="w-3.5 h-3.5 rounded-full bg-rose-500 shadow-2xs"
                title={`Attempt ${idx + 1}: Used (Failed)`}
              />
            );
          }
          return (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all ${
                isUsed
                  ? 'bg-slate-500'
                  : 'border-2 border-slate-300 bg-white'
              }`}
              title={`Attempt ${idx + 1}: ${isUsed ? 'Used' : 'Remaining'}`}
            />
          );
        })}
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER ATTEMPT HISTORY LIST COMPONENT
  // --------------------------------------------------------------------------
  const renderAttemptHistory = () => {
    const usedRoundCount = candidateRecord?.dt_attempt_count ?? 0;
    const isCooling = activeCoolingPeriod && new Date(activeCoolingPeriod.ends_at) > new Date();

    return (
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.06)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#E2E8F4] pb-3">
          <h3 className="text-sm font-bold text-[#1B3270]">Your Attempt History</h3>
          <span className="text-xs text-[#4A5568]">
            {isCooling
              ? `Preparation period active — next round begins ${formatDate(activeCoolingPeriod.ends_at)}`
              : `${usedRoundCount} of 10 attempts used this round`}
          </span>
        </div>

        {allAttempts.length === 0 ? (
          <p className="text-xs text-[#94A3B8] py-2">No attempts recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {allAttempts.map((att) => (
              <div
                key={att.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-semibold text-[#1B3270] min-w-[75px]">
                    Attempt {att.attempt_number}
                  </span>
                  <span className="text-[#94A3B8]">
                    {att.completed_at ? formatDate(att.completed_at) : formatDate(att.started_at)}
                  </span>
                  <span className="font-bold text-[#1B3270]">
                    {att.score_pct !== null ? `${att.score_pct}%` : 'In Progress'}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  {att.status === 'completed' ? (
                    att.passed ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Pass
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Fail
                      </span>
                    )
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      In Progress
                    </span>
                  )}

                  {att.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewAttemptId(att.id);
                        setReviewInitialFilter('all');
                        setScreen('question_review');
                      }}
                      className="text-xs font-semibold text-[#2952A3] hover:underline"
                    >
                      Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // DIFFICULTY BREAKDOWN WIDGET
  // --------------------------------------------------------------------------
  const renderDifficultyBreakdown = (attemptRecord: any) => {
    // Standard 3 questions per tier in the 15 questions set
    const levels = [
      { key: 'beginner', label: 'Beginner' },
      { key: 'elementary', label: 'Elementary' },
      { key: 'intermediate', label: 'Intermediate' },
      { key: 'upper_intermediate', label: 'Upper Intermediate' },
      { key: 'b2', label: 'B2 Level' },
    ];

    return (
      <div className="border border-[#E2E8F4] rounded-[8px] bg-slate-50/70 p-4 space-y-3">
        <div
          onClick={() => setShowDifficultyBreakdown(!showDifficultyBreakdown)}
          className="flex items-center justify-between cursor-pointer select-none"
        >
          <span className="text-xs font-bold text-[#1B3270]">
            Performance by Difficulty Level
          </span>
          <button type="button" className="text-slate-400 hover:text-slate-600">
            {showDifficultyBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showDifficultyBreakdown && (
          <div className="space-y-2.5 pt-1">
            {levels.map((lvl) => (
              <div
                key={lvl.key}
                onClick={() => {
                  if (attemptRecord?.id) {
                    setReviewAttemptId(attemptRecord.id);
                    setReviewInitialFilter(lvl.key);
                    setScreen('question_review');
                  }
                }}
                className="group p-2 rounded-[6px] hover:bg-white hover:border-[#CBD5E1] border border-transparent transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                title={`Click to review ${lvl.label} questions`}
              >
                <div className="flex items-center min-w-[140px]">
                  {getDifficultyBadge(lvl.key)}
                </div>

                <div className="flex items-center space-x-3 flex-1 sm:max-w-xs">
                  <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-[#1B3270] h-full"
                      style={{ width: '66%' }} // representative breakdown bar
                    />
                  </div>
                  <span className="text-[11px] text-[#94A3B8] group-hover:text-[#1B3270] font-medium">
                    Filter →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // SCREEN: LOADING
  // --------------------------------------------------------------------------
  if (screen === 'loading') {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B3270]" />
        <span className="text-xs text-[#94A3B8] font-medium">Loading Diagnostic Test...</span>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: QUESTION REVIEW
  // --------------------------------------------------------------------------
  if (screen === 'question_review' && reviewAttemptId) {
    return (
      <QuestionReviewView
        attemptId={reviewAttemptId}
        initialFilter={reviewInitialFilter}
        onBack={() => {
          // Return to previous screen without re-triggering logic
          if (lastResultData?.passed) {
            setScreen('pass_result');
          } else if (lastResultData) {
            setScreen('fail_result');
          } else {
            setScreen('intro');
          }
        }}
      />
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: PASS RESULT
  // --------------------------------------------------------------------------
  if (screen === 'pass_result') {
    const correctCount = lastResultData?.correct_answers ?? 5;
    const scorePct = lastResultData?.score_pct ?? Math.round((correctCount / 15) * 10000) / 100;

    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150 pb-12">
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 shadow-[0_1px_4px_rgba(27,50,112,0.08)] text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#10B981] flex items-center justify-center mx-auto ring-8 ring-emerald-50/60">
            <CheckCircle2 size={48} />
          </div>

          <div>
            <div className="text-5xl font-extrabold text-[#1B3270] my-3">
              {scorePct}%
            </div>
            <p className="text-sm font-medium text-emerald-700">
              {correctCount} correct out of 15
            </p>
          </div>

          {/* Difficulty breakdown */}
          <div className="text-left pt-2">
            {renderDifficultyBreakdown(lastResultData)}
          </div>

          {/* Review Answers Button */}
          <button
            type="button"
            onClick={() => {
              if (lastResultData?.id) {
                setReviewAttemptId(lastResultData.id);
                setReviewInitialFilter('all');
                setScreen('question_review');
              }
            }}
            className="w-full py-2.5 px-4 rounded-[6px] border border-[#E2E8F4] hover:bg-slate-50 text-[#1B3270] text-xs font-semibold transition-colors cursor-pointer"
          >
            Review My Answers →
          </button>

          {/* Next Steps Card: Light border, no fill */}
          <div className="p-4 border border-[#E2E8F4] rounded-[8px] text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-[#1B3270] font-medium">
              Next: upload your documents to continue.
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab?.('documentation')}
              className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs cursor-pointer shrink-0"
            >
              Go to My Documents
            </button>
          </div>
        </div>

        {/* ATTEMPT HISTORY */}
        {renderAttemptHistory()}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: FAIL RESULT (Attempts 1-9 or Attempt 10)
  // --------------------------------------------------------------------------
  if (screen === 'fail_result') {
    const currentAttemptCount = candidateRecord?.dt_attempt_count ?? 1;
    const isTenFails = currentAttemptCount >= 10;
    const correctCount = lastResultData?.correct_answers ?? 0;
    const scorePct = lastResultData?.score_pct ?? Math.round((correctCount / 15) * 10000) / 100;
    const remainingAttempts = Math.max(0, 10 - currentAttemptCount);
    const hasAvailedOffering = recommendedOfferings.some((o) => o.status === 'availed');

    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150 pb-12">
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-6">
          {/* Header & Icon */}
          <div className="text-center space-y-2">
            {isTenFails ? (
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto ring-8 ring-rose-50/60">
                <AlertCircle size={48} />
              </div>
            ) : (
              <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto ring-6 ring-amber-50/60">
                <XCircle size={40} />
              </div>
            )}

            <div className="text-4xl font-extrabold text-[#1B3270] my-2">
              {scorePct}%
            </div>

            <p className="text-xs text-[#94A3B8]">
              Pass mark: 33% (5 correct)
            </p>

            <p className="text-xs font-medium text-[#4A5568]">
              {correctCount} correct out of 15
            </p>

            {/* Attempt Circles & Remaining Attempts */}
            {!isTenFails ? (
              <div className="flex flex-col items-center pt-1 space-y-1">
                <span className="text-xs text-[#94A3B8]">
                  {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining
                </span>
                {renderAttemptCircles(currentAttemptCount, false)}
              </div>
            ) : (
              <div className="flex flex-col items-center pt-1 space-y-3">
                {renderAttemptCircles(10, true)}

                {/* ONE AMBER BANNER FOR ATTEMPT 10 */}
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-[8px] text-xs text-amber-900 leading-relaxed text-left w-full">
                  Preparation period active until {activeCoolingPeriod?.ends_at ? formatDate(activeCoolingPeriod.ends_at) : '14 days from now'}. Complete at least one training option to unlock your next round.
                </div>

                <div className="p-2.5 bg-slate-50 rounded border border-[#E2E8F4] text-xs font-semibold text-[#1B3270] inline-block">
                  Countdown: {getRemainingDaysAndHours(activeCoolingPeriod?.ends_at)}
                </div>
              </div>
            )}
          </div>

          {/* Difficulty breakdown */}
          {renderDifficultyBreakdown(lastResultData)}

          {/* Review My Answers Button */}
          <button
            type="button"
            onClick={() => {
              if (lastResultData?.id) {
                setReviewAttemptId(lastResultData.id);
                setReviewInitialFilter('all');
                setScreen('question_review');
              }
            }}
            className="w-full py-2.5 px-4 rounded-[6px] border border-[#E2E8F4] hover:bg-slate-50 text-[#1B3270] text-xs font-semibold transition-colors cursor-pointer"
          >
            Review My Answers →
          </button>

          {/* OFFERINGS SECTION */}
          {recommendedOfferings.length > 0 && (
            <div className="border-t border-[#E2E8F4] pt-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1B3270]">
                  {isTenFails
                    ? 'Complete Training to Unlock Your Next Round'
                    : 'Training Options'}
                </h3>
              </div>

              {hasAvailedOffering && isTenFails && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-[8px] flex items-center space-x-2 text-emerald-800 text-xs">
                  <Check size={16} className="text-emerald-600 shrink-0" />
                  <span>
                    Training registered. Your next round will unlock once the preparation period ends on{' '}
                    {activeCoolingPeriod?.ends_at ? formatDate(activeCoolingPeriod.ends_at) : 'the scheduled date'}.
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {recommendedOfferings.map((item) => {
                  const off = item.offerings;
                  const isAvailed = item.status === 'availed';

                  return (
                    <div
                      key={item.id}
                      className="p-4 border border-[#E2E8F4] rounded-[8px] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-[#1B3270]">
                            {off?.name || 'Training Course'}
                          </h4>
                          {off?.type && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 capitalize">
                              {off.type.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                        {off?.description && (
                          <p className="text-xs text-[#4A5568] leading-relaxed">
                            {off.description}
                          </p>
                        )}
                        {off?.price !== undefined && (
                          <span className="text-xs font-semibold text-[#2952A3] block">
                            {off.price === 0 ? 'Free Access' : `€${off.price}`}
                          </span>
                        )}
                      </div>

                      <div className="shrink-0">
                        {isAvailed ? (
                          <span className="inline-flex items-center text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-[6px] border border-emerald-200">
                            <Check size={14} className="mr-1" />
                            Registered
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoadingId === item.id}
                            onClick={() => handleAvailOffering(item.id)}
                            className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-medium rounded-[6px] transition-colors cursor-pointer"
                          >
                            {actionLoadingId === item.id ? 'Registering...' : 'Avail Offering'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* RETAKE TEST BUTTON (For attempts 1-9) */}
          {!isTenFails && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartTest}
                className="w-full py-3 px-4 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <RotateCcw size={15} />
                <span>Retake Test</span>
              </button>
            </div>
          )}
        </div>

        {/* ATTEMPT HISTORY */}
        {renderAttemptHistory()}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: COOLING PERIOD ACTIVE
  // --------------------------------------------------------------------------
  if (screen === 'cooling_active') {
    const hasAvailed = recommendedOfferings.some((o) => o.status === 'availed');

    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150 pb-12">
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto ring-8 ring-rose-50/60">
            <Clock size={40} />
          </div>

          <div>
            <p className="text-xs text-[#94A3B8] mb-1">Next attempt available in:</p>
            <div className="p-3 bg-slate-50 rounded-[8px] border border-[#E2E8F4] text-base font-bold text-[#1B3270] inline-block">
              {getRemainingDaysAndHours(activeCoolingPeriod?.ends_at)}
            </div>
          </div>

          {/* Training status */}
          <div className="text-left">
            {!hasAvailed ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-[8px] text-xs text-amber-900 leading-relaxed">
                Complete at least one training option to unlock your next round.
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-[8px] flex items-center space-x-2 text-emerald-800 text-xs font-medium">
                <Check size={16} className="text-emerald-600 shrink-0" />
                <span>Training registered. Attempts will unlock when the countdown ends.</span>
              </div>
            )}
          </div>

          {/* Offerings list */}
          {recommendedOfferings.length > 0 && (
            <div className="text-left space-y-3 pt-2">
              <h4 className="text-xs font-bold text-[#1B3270] uppercase tracking-wider">
                Training Options
              </h4>
            {recommendedOfferings.map((item) => (
              <div
                key={item.id}
                className="p-3.5 border border-[#E2E8F4] rounded-[8px] bg-slate-50 flex items-center justify-between gap-4 text-xs"
              >
                <div>
                  <span className="font-bold text-[#1B3270] block">
                    {item.offerings?.name}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {item.offerings?.description}
                  </span>
                </div>
                <div>
                  {item.status === 'availed' ? (
                    <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      Registered
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleAvailOffering(item.id)}
                      className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded text-xs font-medium cursor-pointer"
                    >
                      {actionLoadingId === item.id ? 'Registering...' : 'Avail'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>

        {renderAttemptHistory()}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: COMPLETE TRAINING FIRST
  // --------------------------------------------------------------------------
  if (screen === 'complete_training_first') {
    const hasAvailed = recommendedOfferings.some((o) => o.status === 'availed');

    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150 pb-12">
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto ring-8 ring-emerald-50/60">
            <CheckCircle2 size={44} />
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#1B3270]">
              14-Day Preparation Period Complete
            </h2>
            <p className="text-xs text-[#4A5568] mt-2 leading-relaxed max-w-md mx-auto">
              Your preparation period has ended. To unlock your next round of attempts, complete at least one recommended training option below.
            </p>
          </div>

          <div className="text-left space-y-3">
            <h4 className="text-xs font-bold text-[#1B3270] uppercase tracking-wider">
              Training Options
            </h4>
            {recommendedOfferings.map((item) => (
              <div
                key={item.id}
                className="p-4 border border-[#E2E8F4] rounded-[8px] bg-slate-50 flex items-center justify-between gap-4 text-xs"
              >
                <div>
                  <span className="font-bold text-[#1B3270] block">
                    {item.offerings?.name}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {item.offerings?.description}
                  </span>
                </div>
                <div>
                  {item.status === 'availed' ? (
                    <span className="px-3 py-1 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                      Registered
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleAvailOffering(item.id)}
                      className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded text-xs font-medium cursor-pointer"
                    >
                      {actionLoadingId === item.id ? 'Registering...' : 'Avail'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasAvailed && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleUnlockNextRound}
                className="w-full py-3 px-4 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Unlock My Next Attempts →</span>
              </button>
            </div>
          )}
        </div>

        {renderAttemptHistory()}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: TEST INTRODUCTION
  // --------------------------------------------------------------------------
  if (screen === 'intro') {
    const usedRoundCount = candidateRecord?.dt_attempt_count ?? 0;
    const previousCompletedAttempt = allAttempts.find((a) => a.status === 'completed');

    return (
      <div className="space-y-6 max-w-xl mx-auto animate-in fade-in duration-150 pb-12">
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-[8px] bg-[#1B3270]/10 flex items-center justify-center text-[#1B3270]">
              <Award size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1B3270]">Diagnostic Test</h2>
            </div>
          </div>

          {/* Info pills in a single row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 bg-slate-100 border border-[#E2E8F4] text-[#1B3270] rounded-full text-xs font-medium">
              15 questions
            </span>
            <span className="px-3 py-1 bg-slate-100 border border-[#E2E8F4] text-[#1B3270] rounded-full text-xs font-medium">
              Multiple choice
            </span>
            <span className="px-3 py-1 bg-slate-100 border border-[#E2E8F4] text-[#1B3270] rounded-full text-xs font-medium">
              No time limit
            </span>
          </div>

          {/* Attempt Counter (if previous attempts) */}
          {usedRoundCount > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#1B3270] block">
                Attempt {usedRoundCount} of 10 used
              </span>
              {renderAttemptCircles(usedRoundCount)}
            </div>
          )}

          {/* Previous result if any: "Last score: [score_pct]%" (One line, no extra context) */}
          {previousCompletedAttempt && (
            <p className="text-xs text-[#4A5568]">
              Last score: {previousCompletedAttempt.score_pct}%
            </p>
          )}

          {/* Start Test Button */}
          <button
            type="button"
            onClick={handleStartTest}
            className="w-full py-3 px-5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-bold rounded-[6px] transition-colors shadow-2xs flex items-center justify-center space-x-2 cursor-pointer"
          >
            <span>Start Test</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: REVIEW BEFORE SUBMIT
  // --------------------------------------------------------------------------
  if (screen === 'review_before_submit') {
    const answeredCount = Object.keys(selectedAnswers).length;

    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150 pb-20">
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#1B3270]">Review & Submit</h2>
              <p className="text-xs text-[#4A5568]">
                Review all your selected options. You can change any answer before final submission.
              </p>
            </div>
            <span className="text-xs font-bold text-[#1B3270] bg-slate-100 px-3 py-1.5 rounded-full">
              {answeredCount}/15 Answered
            </span>
          </div>

          {/* Questions list */}
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const selectedLetter = selectedAnswers[q.id]?.toUpperCase() || '-';
              const isAnswered = Boolean(selectedAnswers[q.id]);

              return (
                <div
                  key={q.id}
                  className="py-3.5 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-start space-x-3 flex-1 min-w-0">
                    <span className="font-bold text-[#1B3270] shrink-0 pt-0.5">
                      Q{q.question_order}
                    </span>
                    <div className="truncate">
                      <p className="text-[#1B3270] font-medium truncate">
                        {q.question_text}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        {getDifficultyBadge(q.difficulty_level)}
                        <span className="text-[11px] text-[#94A3B8]">
                          Selected: <strong className="text-[#1B3270]">{selectedLetter}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                        isAnswered
                          ? 'bg-[#1B3270] text-white'
                          : 'border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {selectedLetter}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentQIndex(idx);
                        setScreen('test');
                      }}
                      className="text-xs font-semibold text-[#2952A3] hover:underline cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#E2E8F4] flex flex-col sm:flex-row items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setScreen('test')}
              className="w-full sm:w-auto px-4 py-2.5 border border-[#E2E8F4] hover:bg-slate-50 text-[#4A5568] text-xs font-semibold rounded-[6px] transition-colors cursor-pointer"
            >
              Back to Questions
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-bold rounded-[6px] transition-colors shadow-2xs cursor-pointer"
            >
              Submit Test
            </button>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-[10px] p-6 max-w-md w-full shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center space-x-3 text-[#1B3270]">
                <HelpCircle size={22} className="text-[#2952A3]" />
                <h3 className="text-base font-bold">Confirm Test Submission</h3>
              </div>

              <p className="text-xs text-[#4A5568] leading-relaxed">
                Submit your answers? You cannot change them after submission. Your score and performance breakdown will be generated immediately.
              </p>

              <div className="flex items-center justify-end space-x-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 border border-[#E2E8F4] hover:bg-slate-50 text-[#4A5568] text-xs font-medium rounded-[6px] transition-colors cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitTest}
                  className="px-5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-bold rounded-[6px] transition-colors shadow-2xs flex items-center space-x-1.5 cursor-pointer"
                >
                  {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                  <span>{isSubmitting ? 'Scoring...' : 'Submit Test'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: TEST INTERFACE (Questions 1 to 15)
  // --------------------------------------------------------------------------
  const currentQ = questions[currentQIndex];
  const progressPct = questions.length > 0 ? ((currentQIndex + 1) / questions.length) * 100 : 0;
  const currentSelected = currentQ ? selectedAnswers[currentQ.id] : undefined;

  const options: Array<{ key: 'a' | 'b' | 'c' | 'd'; label: string; text: string }> = currentQ
    ? [
        { key: 'a', label: 'A', text: currentQ.option_a },
        { key: 'b', label: 'B', text: currentQ.option_b },
        { key: 'c', label: 'C', text: currentQ.option_c },
        { key: 'd', label: 'D', text: currentQ.option_d },
      ]
    : [];

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150 pb-16">
      {/* TOP BAR */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-[0_1px_4px_rgba(27,50,112,0.06)] flex items-center justify-between gap-4">
        <span className="text-xs font-bold text-[#1B3270] shrink-0">Diagnostic Test</span>

        <span className="text-xs font-semibold text-[#4A5568]">
          Question {currentQIndex + 1} of {questions.length || 15}
        </span>

        {/* Progress bar */}
        <div className="w-24 sm:w-36 bg-[#E2E8F4] rounded-full h-2 overflow-hidden shrink-0">
          <div
            className="bg-[#1B3270] h-full transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* QUESTION CARD */}
      {currentQ && (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.06)] space-y-6">
          {/* Header with difficulty badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#94A3B8]">
              Question {currentQ.question_order}
            </span>
            {getDifficultyBadge(currentQ.difficulty_level)}
          </div>

          {/* Question Text */}
          <p className="text-base font-medium text-[#1B3270] whitespace-pre-line leading-relaxed">
            {currentQ.question_text}
          </p>

          {/* 4 Options */}
          <div className="space-y-3">
            {options.map((opt) => {
              const isSelected = currentSelected === opt.key;

              return (
                <div
                  key={opt.key}
                  onClick={() => {
                    setSelectedAnswers((prev) => ({
                      ...prev,
                      [currentQ.id]: opt.key,
                    }));
                  }}
                  className={`p-4 rounded-[10px] border transition-all cursor-pointer flex items-center space-x-3.5 ${
                    isSelected
                      ? 'border-[#1B3270] bg-[#F0F4FF] shadow-xs'
                      : 'border-[#E2E8F4] bg-white hover:border-[#CBD5E1] hover:bg-slate-50/50'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[#1B3270] text-white'
                        : 'border-2 border-slate-300 text-slate-500 bg-white'
                    }`}
                  >
                    {opt.label}
                  </div>
                  <span
                    className={`text-sm ${
                      isSelected ? 'font-semibold text-[#1B3270]' : 'text-[#4A5568]'
                    }`}
                  >
                    {opt.text}
                  </span>
                </div>
              );
            })}
          </div>

          {/* NAVIGATION */}
          <div className="pt-4 border-t border-[#E2E8F4] flex items-center justify-between">
            <button
              type="button"
              disabled={currentQIndex === 0}
              onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
              className={`px-4 py-2 text-xs font-semibold rounded-[6px] transition-colors ${
                currentQIndex === 0
                  ? 'text-slate-300 cursor-not-allowed'
                  : 'text-[#1B3270] hover:bg-slate-100 cursor-pointer'
              }`}
            >
              Previous
            </button>

            {currentQIndex === questions.length - 1 ? (
              <button
                type="button"
                disabled={!currentSelected}
                onClick={() => setScreen('review_before_submit')}
                className={`px-5 py-2.5 text-xs font-bold rounded-[6px] transition-colors shadow-2xs ${
                  !currentSelected
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#1B3270] hover:bg-[#2952A3] text-white cursor-pointer'
                }`}
              >
                Review & Submit
              </button>
            ) : (
              <button
                type="button"
                disabled={!currentSelected}
                onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                className={`px-5 py-2.5 text-xs font-bold rounded-[6px] transition-colors shadow-2xs ${
                  !currentSelected
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#1B3270] hover:bg-[#2952A3] text-white cursor-pointer'
                }`}
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
