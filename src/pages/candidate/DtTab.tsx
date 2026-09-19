import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
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
  const [showExitModal, setShowExitModal] = useState(false);
  const [showRestartModal, setShowRestartModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [reviewInitialFilter, setReviewInitialFilter] = useState<string>('all');
  const [showDifficultyBreakdown, setShowDifficultyBreakdown] = useState(true);
  const [lastResultData, setLastResultData] = useState<any>(null);
  const [candidateRecord, setCandidateRecord] = useState<any>(candidate);
  const [attemptDifficultyStats, setAttemptDifficultyStats] = useState<
    Record<string, { correct: number; total: number }>
  >({
    beginner: { correct: 0, total: 3 },
    elementary: { correct: 0, total: 3 },
    intermediate: { correct: 0, total: 3 },
    upper_intermediate: { correct: 0, total: 6 },
  });

  // Timer states (30 minutes = 1800s)
  const [timerRemainingSeconds, setTimerRemainingSeconds] = useState<number | null>(null);
  const [timerExpiresAt, setTimerExpiresAt] = useState<string | null>(null);
  const [isTimeUpOverlayOpen, setIsTimeUpOverlayOpen] = useState(false);
  const [showFiveMinToast, setShowFiveMinToast] = useState(false);
  const [showOneMinModal, setShowOneMinModal] = useState(false);
  const [resumeToast, setResumeToast] = useState<string | null>(null);
  const [coolingExpiredToast, setCoolingExpiredToast] = useState<string | null>(null);

  const hasTriggeredFiveMinWarning = useRef(false);
  const hasTriggeredOneMinWarning = useRef(false);
  const autoSubmittingRef = useRef(false);

  // Format timer remaining as "MM:SS" (>= 60s) or "0:SS" (< 60s)
  const formatTimeRemaining = (seconds: number) => {
    const clamped = Math.max(0, seconds);
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    if (clamped >= 60) {
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `0:${secs.toString().padStart(2, '0')}`;
  };

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
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 border border-slate-200">
            {difficulty}
          </span>
        );
    }
  };

  const renderTimerDisplay = () => {
    if (timerRemainingSeconds === null) return null;
    const isCritical = timerRemainingSeconds <= 60;
    const isWarning = timerRemainingSeconds <= 300 && !isCritical;

    let bgClass = 'bg-[#F0F4FF] border-[#E2E8F4] text-[#1B3270]';
    let iconColor = 'text-[#1B3270]';
    let animStyle: React.CSSProperties = {};

    if (isCritical) {
      bgClass = 'bg-[#FEF2F2] border-[#FECACA] text-[#991B1B]';
      iconColor = 'text-[#EF4444]';
      animStyle = { animation: 'pulse-border-crit 0.8s infinite' };
    } else if (isWarning) {
      bgClass = 'bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]';
      iconColor = 'text-[#F59E0B]';
      animStyle = { animation: 'pulse-border-warn 1.5s infinite' };
    }

    return (
      <div
        style={animStyle}
        className={`px-3 py-1 rounded-[8px] border flex items-center gap-1.5 transition-colors ${bgClass}`}
      >
        <Clock size={14} className={`${iconColor} shrink-0`} />
        <span className="text-[13px] font-semibold font-mono leading-none">
          {formatTimeRemaining(timerRemainingSeconds)}
        </span>
      </div>
    );
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

      // CHECK 3: Cooling just expired?
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

        if (expiredCooling.cooling_trigger === 'round_exhausted') {
          // Fresh round begins — reset attempt count
          await supabase
            .from('candidates')
            .update({ dt_attempt_count: 0 })
            .eq('id', cand.id);

          cand.dt_attempt_count = 0;
          setCandidateRecord({ ...cand, dt_attempt_count: 0 });
          setCoolingExpiredToast('Your break has ended. 10 fresh attempts are available.');
        } else {
          const remainingAttempts = Math.max(0, 10 - (cand.dt_attempt_count ?? 0));
          setCoolingExpiredToast(`Your break has ended. ${remainingAttempts} attempts remaining.`);
        }

        setScreen('intro');
        return;
      }

      // CHECK 4: Attempt in progress?
      const inProgressAttempt = attemptsList.find((a) => a.status === 'in_progress');
      if (inProgressAttempt) {
        setCurrentAttempt(inProgressAttempt);
        const expiresStr = inProgressAttempt.timer_expires_at;
        const nowMs = Date.now();
        const expiresMs = expiresStr ? new Date(expiresStr).getTime() : nowMs + 1800000;
        const remaining = Math.floor((expiresMs - nowMs) / 1000);

        if (remaining <= 0) {
          // Timer expired while away
          await handleAutoSubmitExpiredAway(inProgressAttempt);
          return;
        }

        // Resume active attempt
        setTimerExpiresAt(expiresStr || new Date(nowMs + 1800000).toISOString());
        setTimerRemainingSeconds(remaining);
        if (remaining <= 300) hasTriggeredFiveMinWarning.current = true;
        if (remaining <= 60) hasTriggeredOneMinWarning.current = true;

        const timeStr = formatTimeRemaining(remaining);
        setResumeToast(`Resuming your test. ${timeStr} remaining.`);
        setTimeout(() => setResumeToast(null), 6000);

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
      // 1. Load questions assigned to this attempt via dt_attempt_questions
      const { data: daqData, error: daqErr } = await supabase
        .from('dt_attempt_questions')
        .select(`
          position,
          question_id,
          dt_questions (*)
        `)
        .eq('attempt_id', attemptId)
        .order('position', { ascending: true });

      let qList: DtQuestion[] = [];
      if (!daqErr && daqData && daqData.length > 0) {
        qList = daqData
          .map((d: any) => d.dt_questions as DtQuestion)
          .filter(Boolean);
      } else {
        // Fallback for legacy attempts created before dt_attempt_questions
        const { data: qData, error: qErr } = await supabase
          .from('dt_questions')
          .select('*')
          .eq('is_active', true)
          .order('question_order', { ascending: true });

        if (qErr) throw qErr;
        qList = qData || [];
      }

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
  // TIMER INTERVAL EFFECT
  // --------------------------------------------------------------------------
  useEffect(() => {
    if ((screen !== 'test' && screen !== 'review_before_submit') || !currentAttempt?.id || !timerExpiresAt) {
      return;
    }

    const intervalId = setInterval(() => {
      const expiresMs = new Date(timerExpiresAt).getTime();
      const nowMs = Date.now();
      const remaining = Math.floor((expiresMs - nowMs) / 1000);

      setTimerRemainingSeconds(remaining);

      // Warning at 5 minutes (300 seconds)
      if (remaining <= 300 && remaining > 60 && !hasTriggeredFiveMinWarning.current) {
        hasTriggeredFiveMinWarning.current = true;
        setShowFiveMinToast(true);
        setTimeout(() => setShowFiveMinToast(false), 8000);
      }

      // Warning at 1 minute (60 seconds)
      if (remaining <= 60 && remaining > 0 && !hasTriggeredOneMinWarning.current) {
        hasTriggeredOneMinWarning.current = true;
        setShowOneMinModal(true);
        setTimeout(() => setShowOneMinModal(false), 10000);
      }

      // Timer expired: trigger auto-submit
      if (remaining <= 0) {
        clearInterval(intervalId);
        handleSubmitTest(true);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [screen, currentAttempt?.id, timerExpiresAt, questions, selectedAnswers]);

  // Load performance breakdown by difficulty for completed attempts
  useEffect(() => {
    if (!lastResultData?.id) return;
    const fetchAttemptDifficultyStats = async () => {
      try {
        const { data, error } = await supabase
          .from('dt_answers')
          .select(`
            is_correct,
            dt_questions (
              difficulty_level
            )
          `)
          .eq('attempt_id', lastResultData.id);

        if (error) throw error;

        const counts: Record<string, { correct: number; total: number }> = {
          beginner: { correct: 0, total: 0 },
          elementary: { correct: 0, total: 0 },
          intermediate: { correct: 0, total: 0 },
          upper_intermediate: { correct: 0, total: 0 },
        };

        (data || []).forEach((row: any) => {
          const diff = row.dt_questions?.difficulty_level?.toLowerCase();
          if (diff && counts[diff]) {
            counts[diff].total += 1;
            if (row.is_correct) {
              counts[diff].correct += 1;
            }
          }
        });

        // Use standard quotas if totals are 0
        if (counts.beginner.total === 0) counts.beginner.total = 3;
        if (counts.elementary.total === 0) counts.elementary.total = 3;
        if (counts.intermediate.total === 0) counts.intermediate.total = 3;
        if (counts.upper_intermediate.total === 0) counts.upper_intermediate.total = 6;

        setAttemptDifficultyStats(counts);
      } catch (err) {
        console.error('Error fetching attempt difficulty stats:', err);
      }
    };

    fetchAttemptDifficultyStats();
  }, [lastResultData?.id]);

  // Re-sync client timer with server to prevent drift on question navigation
  const syncTimerWithServer = async () => {
    if (!currentAttempt?.id) return;
    try {
      const { data } = await supabase
        .from('dt_attempts')
        .select('timer_expires_at')
        .eq('id', currentAttempt.id)
        .maybeSingle();

      if (data?.timer_expires_at) {
        setTimerExpiresAt(data.timer_expires_at);
        const serverRemaining = Math.floor((new Date(data.timer_expires_at).getTime() - Date.now()) / 1000);
        setTimerRemainingSeconds(serverRemaining);
        if (serverRemaining <= 0) {
          handleSubmitTest(true);
        }
      }
    } catch (err) {
      console.warn('Failed to sync timer with server:', err);
    }
  };

  // Option select handler: updates local state and persists answer immediately to dt_answers
  const handleSelectOption = async (questionId: string, optionKey: 'a' | 'b' | 'c' | 'd') => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey,
    }));

    if (currentAttempt?.id) {
      try {
        const q = questions.find((item) => item.id === questionId);
        const isCorrect = q ? optionKey.toLowerCase() === q.correct_option.toLowerCase() : false;
        await supabase
          .from('dt_answers')
          .delete()
          .eq('attempt_id', currentAttempt.id)
          .eq('question_id', questionId);

        await supabase.from('dt_answers').insert({
          attempt_id: currentAttempt.id,
          question_id: questionId,
          selected_option: optionKey,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn('Note on auto-saving answer:', err);
      }
    }
  };

  // --------------------------------------------------------------------------
  // RM NOTIFICATION HELPER
  // --------------------------------------------------------------------------
  const notifyAssignedRm = async (title: string, message: string) => {
    try {
      let targetRmIds: string[] = [];
      if (candidateRecord?.assigned_rm_id) {
        targetRmIds.push(candidateRecord.assigned_rm_id);
      } else if (candidateRecord?.supplier_id) {
        const { data: rmAssign } = await supabase
          .from('rm_assignments')
          .select('rm_profile_id')
          .eq('entity_type', 'supplier')
          .eq('entity_id', candidateRecord.supplier_id)
          .eq('active', true)
          .maybeSingle();
        if (rmAssign?.rm_profile_id) {
          targetRmIds.push(rmAssign.rm_profile_id);
        }
      }

      if (targetRmIds.length === 0) {
        const { data: rmProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('internal_role', 'candidate_supplier_rm');
        if (rmProfiles) {
          targetRmIds = rmProfiles.map((p) => p.id);
        }
      }

      if (targetRmIds.length > 0) {
        const notifs = targetRmIds.map((uid) => ({
          user_id: uid,
          title,
          message,
          type: 'gate_result',
          read: false,
        }));
        await supabase.from('notifications').insert(notifs);
      }
    } catch (err) {
      console.error('Error sending RM notification:', err);
    }
  };

  // --------------------------------------------------------------------------
  // PUSH OFFERINGS (NON-BLOCKING)
  // --------------------------------------------------------------------------
  const pushDtOfferings = async () => {
    try {
      const { data: dtOfferings } = await supabase
        .from('offerings')
        .select('id')
        .eq('applicable_gate', 'dt')
        .eq('is_active', true);

      if (dtOfferings && dtOfferings.length > 0) {
        const { data: existingOff } = await supabase
          .from('candidate_offerings')
          .select('offering_id')
          .eq('candidate_id', candidateRecord.id)
          .eq('gate_type_failed', 'dt');

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
    } catch (err) {
      console.error('Error pushing DT offerings:', err);
    }
  };

  // --------------------------------------------------------------------------
  // COMPLETE TEST ATTEMPT (PASS / FAIL / COOLING TRIGGERS)
  // --------------------------------------------------------------------------
  const completeTestAttempt = async (
    resultData: any,
    passed: boolean,
    scorePct: number,
    isAutoSubmit: boolean,
    attemptId: string
  ) => {
    const nowIso = new Date().toISOString();
    setLastResultData(resultData);

    if (passed) {
      // 1. Insert gate_results: pass
      await supabase.from('gate_results').insert({
        candidate_id: candidateRecord.id,
        gate_type: 'dt',
        status: 'pass',
        score: scorePct,
        review_status: 'not_required',
        attempt_number: resultData.attempt_number || currentAttempt?.attempt_number || 1,
      });

      // 2. Update candidates: in_progress, dt_passed_at = now(), reset dt_consecutive_fails = 0
      // Note: dt_total_fails_in_window is NOT reset on pass (only on cooling)
      await supabase
        .from('candidates')
        .update({
          status: 'in_progress',
          dt_passed_at: nowIso,
          dt_consecutive_fails: 0,
        })
        .eq('id', candidateRecord.id);

      setCandidateRecord((prev: any) => ({
        ...prev,
        status: 'in_progress',
        dt_passed_at: nowIso,
        dt_consecutive_fails: 0,
      }));

      // 3. Notification for candidate
      if (candidateRecord.user_id) {
        await supabase.from('notifications').insert({
          user_id: candidateRecord.user_id,
          title: 'Diagnostic Test Passed',
          message: `You scored ${scorePct}% and passed the Diagnostic Test. Complete your profile and upload documents to continue.`,
          type: 'gate_result',
          read: false,
        });
      }

      // 4. Notification for assigned RM
      const candidateName = `${candidateRecord.first_name || ''} ${candidateRecord.last_name || ''}`.trim() || 'Candidate';
      await notifyAssignedRm(
        'Candidate Passed Diagnostic Test',
        `${candidateName} passed their Diagnostic Test with ${scorePct}%. Begin document review when ready.`
      );

      // 5. Notification for placement leads
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

      setShowConfirmModal(false);
      if (isAutoSubmit) {
        setTimeout(() => {
          setIsTimeUpOverlayOpen(false);
          setScreen('pass_result');
        }, 2000);
      } else {
        setScreen('pass_result');
      }
    } else {
      // --- FAILED FLOW ---
      // STEP 1: Record attempt in gate_results
      await supabase.from('gate_results').insert({
        candidate_id: candidateRecord.id,
        gate_type: 'dt',
        status: 'fail',
        score: scorePct,
        attempt_number: resultData.attempt_number || currentAttempt?.attempt_number || 1,
      });

      // STEP 2: Update fail counters
      const prevAttemptCount = candidateRecord.dt_attempt_count ?? 0;
      const prevConsecutive = candidateRecord.dt_consecutive_fails ?? 0;
      const prevTotalWindow = candidateRecord.dt_total_fails_in_window ?? 0;

      const newAttemptCount = prevAttemptCount + 1;
      const newConsecutive = prevConsecutive + 1;
      const newTotalWindow = prevTotalWindow + 1;

      await supabase
        .from('candidates')
        .update({
          dt_attempt_count: newAttemptCount,
          dt_consecutive_fails: newConsecutive,
          dt_total_fails_in_window: newTotalWindow,
        })
        .eq('id', candidateRecord.id);

      const candidateName = `${candidateRecord.first_name || ''} ${candidateRecord.last_name || ''}`.trim() || 'Candidate';

      // STEP 3: Check cooling triggers in order
      if (newAttemptCount >= 10) {
        // TRIGGER CHECK A: Round exhausted (all 10 attempts used)
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
            triggered_by_attempt_id: attemptId,
            cooling_trigger: 'round_exhausted',
          })
          .select()
          .single();

        // Reset fail counters for new round (attempt_count resets after cooling expires)
        await supabase
          .from('candidates')
          .update({
            dt_consecutive_fails: 0,
            dt_total_fails_in_window: 0,
          })
          .eq('id', candidateRecord.id);

        setCandidateRecord((prev: any) => ({
          ...prev,
          dt_attempt_count: newAttemptCount,
          dt_consecutive_fails: 0,
          dt_total_fails_in_window: 0,
        }));
        setActiveCoolingPeriod(coolingRow);

        await pushDtOfferings();

        if (candidateRecord.user_id) {
          await supabase.from('notifications').insert({
            user_id: candidateRecord.user_id,
            title: 'Diagnostic Test — All Attempts Used',
            message:
              'You have used all 10 attempts for this round. A 14-day break applies. Training options are available below. A fresh set of 10 attempts will be available once the break ends.',
            type: 'gate_result',
            read: false,
          });
        }

        await notifyAssignedRm(
          'Candidate DT Cooling — round_exhausted',
          `${candidateName} has used all 10 DT attempts without passing. 14-day cooling period applied.`
        );

        setShowConfirmModal(false);
        if (isAutoSubmit) {
          setTimeout(() => {
            setIsTimeUpOverlayOpen(false);
            setScreen('cooling_active');
          }, 2000);
        } else {
          setScreen('cooling_active');
        }
      } else if (newConsecutive >= 3) {
        // TRIGGER CHECK B: 3 consecutive fails
        const endsAtDate = new Date();
        endsAtDate.setDate(endsAtDate.getDate() + 10);

        const { data: coolingRow } = await supabase
          .from('cooling_periods')
          .insert({
            candidate_id: candidateRecord.id,
            gate_type: 'dt',
            started_at: nowIso,
            cooling_duration_days: 10,
            ends_at: endsAtDate.toISOString(),
            status: 'active',
            triggered_by_attempt_id: attemptId,
            cooling_trigger: '3_consecutive',
          })
          .select()
          .single();

        // Reset fail counters (dt_attempt_count is NOT reset here)
        await supabase
          .from('candidates')
          .update({
            dt_consecutive_fails: 0,
            dt_total_fails_in_window: 0,
          })
          .eq('id', candidateRecord.id);

        setCandidateRecord((prev: any) => ({
          ...prev,
          dt_attempt_count: newAttemptCount,
          dt_consecutive_fails: 0,
          dt_total_fails_in_window: 0,
        }));
        setActiveCoolingPeriod(coolingRow);

        await pushDtOfferings();

        if (candidateRecord.user_id) {
          await supabase.from('notifications').insert({
            user_id: candidateRecord.user_id,
            title: 'Diagnostic Test — Break Required',
            message:
              'You have not passed 3 attempts in a row. A 10-day break applies before your next attempt. Training options are available to help you prepare.',
            type: 'gate_result',
            read: false,
          });
        }

        await notifyAssignedRm(
          'Candidate DT Cooling — 3_consecutive',
          `${candidateName} failed the DT 3 times consecutively. 10-day cooling period applied.`
        );

        setShowConfirmModal(false);
        if (isAutoSubmit) {
          setTimeout(() => {
            setIsTimeUpOverlayOpen(false);
            setScreen('cooling_active');
          }, 2000);
        } else {
          setScreen('cooling_active');
        }
      } else if (newTotalWindow >= 5) {
        // TRIGGER CHECK C: 5 total fails in window
        const endsAtDate = new Date();
        endsAtDate.setDate(endsAtDate.getDate() + 10);

        const { data: coolingRow } = await supabase
          .from('cooling_periods')
          .insert({
            candidate_id: candidateRecord.id,
            gate_type: 'dt',
            started_at: nowIso,
            cooling_duration_days: 10,
            ends_at: endsAtDate.toISOString(),
            status: 'active',
            triggered_by_attempt_id: attemptId,
            cooling_trigger: '5_total',
          })
          .select()
          .single();

        // Reset fail counters
        await supabase
          .from('candidates')
          .update({
            dt_consecutive_fails: 0,
            dt_total_fails_in_window: 0,
          })
          .eq('id', candidateRecord.id);

        setCandidateRecord((prev: any) => ({
          ...prev,
          dt_attempt_count: newAttemptCount,
          dt_consecutive_fails: 0,
          dt_total_fails_in_window: 0,
        }));
        setActiveCoolingPeriod(coolingRow);

        await pushDtOfferings();

        if (candidateRecord.user_id) {
          await supabase.from('notifications').insert({
            user_id: candidateRecord.user_id,
            title: 'Diagnostic Test — Break Required',
            message:
              'You have used 5 attempts without passing. A 10-day break applies before your next attempt. Training options are available below.',
            type: 'gate_result',
            read: false,
          });
        }

        await notifyAssignedRm(
          'Candidate DT Cooling — 5_total',
          `${candidateName} has failed the DT 5 times in total. 10-day cooling period applied.`
        );

        setShowConfirmModal(false);
        if (isAutoSubmit) {
          setTimeout(() => {
            setIsTimeUpOverlayOpen(false);
            setScreen('cooling_active');
          }, 2000);
        } else {
          setScreen('cooling_active');
        }
      } else {
        // TRIGGER CHECK D: No trigger -> Normal fail screen
        setCandidateRecord((prev: any) => ({
          ...prev,
          dt_attempt_count: newAttemptCount,
          dt_consecutive_fails: newConsecutive,
          dt_total_fails_in_window: newTotalWindow,
        }));

        await pushDtOfferings();

        if (candidateRecord.user_id) {
          await supabase.from('notifications').insert({
            user_id: candidateRecord.user_id,
            title: `Diagnostic Test — Attempt ${newAttemptCount}`,
            message: `You scored ${scorePct}%. You need 33% to pass. You have ${10 - newAttemptCount} attempts remaining before a preparation period applies. You can retake now or use the recommended training to prepare.`,
            type: 'gate_result',
            read: false,
          });
        }

        setShowConfirmModal(false);
        if (isAutoSubmit) {
          setTimeout(() => {
            setIsTimeUpOverlayOpen(false);
            setScreen('fail_result');
          }, 2000);
        } else {
          setScreen('fail_result');
        }
      }
    }
  };

  // Handle in-progress attempt that expired while the candidate was away
  const handleAutoSubmitExpiredAway = async (inProgressAttempt: any) => {
    try {
      setIsTimeUpOverlayOpen(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 1. Load questions assigned to this attempt via dt_attempt_questions (with legacy fallback)
      const { data: daqData } = await supabase
        .from('dt_attempt_questions')
        .select(`
          position,
          question_id,
          dt_questions (*)
        `)
        .eq('attempt_id', inProgressAttempt.id)
        .order('position', { ascending: true });

      let qList: DtQuestion[] = [];
      if (daqData && daqData.length > 0) {
        qList = daqData
          .map((d: any) => d.dt_questions as DtQuestion)
          .filter(Boolean);
      } else {
        const { data: qData } = await supabase
          .from('dt_questions')
          .select('*')
          .eq('is_active', true)
          .order('question_order', { ascending: true });
        qList = qData || [];
      }
      setQuestions(qList);

      const { data: ansData } = await supabase
        .from('dt_answers')
        .select('question_id, selected_option')
        .eq('attempt_id', inProgressAttempt.id);

      const ansMap: Record<string, 'a' | 'b' | 'c' | 'd'> = {};
      (ansData || []).forEach((a) => {
        if (a.selected_option) {
          ansMap[a.question_id] = a.selected_option as any;
        }
      });
      setSelectedAnswers(ansMap);
      setCurrentAttempt(inProgressAttempt);

      let correctAnswersCount = 0;
      const answersToInsert = qList.map((q) => {
        const selected = ansMap[q.id] || null;
        const isCorrect = selected !== null && selected.toLowerCase() === q.correct_option.toLowerCase();
        if (isCorrect) correctAnswersCount++;
        return {
          attempt_id: inProgressAttempt.id,
          question_id: q.id,
          selected_option: selected,
          is_correct: isCorrect,
          answered_at: new Date().toISOString(),
        };
      });

      await supabase.from('dt_answers').delete().eq('attempt_id', inProgressAttempt.id);
      await supabase.from('dt_answers').insert(answersToInsert);

      const totalQuestions = qList.length || 15;
      const scorePct = Math.round((correctAnswersCount / totalQuestions) * 10000) / 100;
      const passed = correctAnswersCount >= 5;
      const nowIso = new Date().toISOString();

      const { data: updatedAttempt } = await supabase
        .from('dt_attempts')
        .update({
          correct_answers: correctAnswersCount,
          score_pct: scorePct,
          passed: passed,
          status: 'completed',
          completed_at: nowIso,
          auto_submitted: true,
        })
        .eq('id', inProgressAttempt.id)
        .select()
        .single();

      const resultData = updatedAttempt || {
        ...inProgressAttempt,
        correct_answers: correctAnswersCount,
        score_pct: scorePct,
        passed,
        auto_submitted: true,
      };

      // Record seen questions for this candidate
      try {
        await supabase.rpc('record_candidate_seen_questions', {
          p_candidate_id: inProgressAttempt.candidate_id,
          p_question_ids: qList.map((q) => q.id),
        });
      } catch (seenErr) {
        console.error('Error recording seen questions:', seenErr);
      }

      await completeTestAttempt(resultData, passed, scorePct, true, inProgressAttempt.id);
    } catch (err) {
      console.error('Error in handleAutoSubmitExpiredAway:', err);
      setIsTimeUpOverlayOpen(false);
      setScreen('intro');
    }
  };

  // --------------------------------------------------------------------------
  // DYNAMIC NON-REPEATING QUESTION SELECTION ALGORITHM
  // --------------------------------------------------------------------------
  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const selectDTQuestions = async (candidateId: string): Promise<DtQuestion[]> => {
    // Strict progressive difficulty order:
    // Q1-3: Beginner, Q4-6: Elementary, Q7-9: Intermediate, Q10-15: Upper Intermediate
    const tierOrder: Array<{ level: string; count: number }> = [
      { level: 'beginner', count: 3 },
      { level: 'elementary', count: 3 },
      { level: 'intermediate', count: 3 },
      { level: 'upper_intermediate', count: 6 },
    ];

    const selectedQuestions: DtQuestion[] = [];

    for (const { level, count } of tierOrder) {
      // Step 1: Get all active questions at this difficulty level
      const { data: allActive, error: qErr } = await supabase
        .from('dt_questions')
        .select('*')
        .eq('difficulty_level', level)
        .eq('is_active', true)
        .order('question_order', { ascending: true });

      if (qErr) {
        console.error(`Error fetching ${level} questions:`, qErr);
        throw qErr;
      }

      const activeList: DtQuestion[] = (allActive || []) as DtQuestion[];
      if (activeList.length === 0) continue;

      const activeIds = activeList.map((q) => q.id);

      // Step 2: Get questions this candidate has already seen at this level
      const { data: seen } = await supabase
        .from('dt_candidate_seen_questions')
        .select('question_id, last_seen_at')
        .eq('candidate_id', candidateId)
        .in('question_id', activeIds);

      const seenMap = new Map((seen || []).map((s) => [s.question_id, s.last_seen_at]));

      // Step 3: Split into unseen and seen
      const unseen = activeList.filter((q) => !seenMap.has(q.id));
      const seenQuestions = activeList
        .filter((q) => seenMap.has(q.id))
        .sort((a, b) => {
          const aTime = seenMap.get(a.id);
          const bTime = seenMap.get(b.id);
          return new Date(aTime || 0).getTime() - new Date(bTime || 0).getTime();
        });

      // Step 4: Select required count (unseen first, then least-recently-seen)
      let selected: DtQuestion[] = [];
      if (unseen.length >= count) {
        selected = shuffleArray(unseen).slice(0, count);
      } else {
        selected = [
          ...shuffleArray(unseen),
          ...seenQuestions.slice(0, count - unseen.length),
        ];
      }

      // Sort selected questions within this difficulty level by question_order
      selected.sort((a, b) => (a.question_order || 0) - (b.question_order || 0));

      selectedQuestions.push(...selected);
    }

    // Return the 15 questions in strict progressive difficulty order:
    // Positions 1-3: Beginner | Positions 4-6: Elementary | Positions 7-9: Intermediate | Positions 10-15: Upper Intermediate
    return selectedQuestions;
  };

  // --------------------------------------------------------------------------
  // START NEW TEST
  // --------------------------------------------------------------------------
  const handleStartTest = async () => {
    if (!candidateRecord?.id) return;
    try {
      setScreen('loading');

      // 1. Select dynamic non-repeating 15 questions BEFORE creating attempt
      const selectedQuestions = await selectDTQuestions(candidateRecord.id);

      // 2. Get total previous attempts count
      const { count } = await supabase
        .from('dt_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('candidate_id', candidateRecord.id);

      const nextAttemptNumber = (count ?? 0) + 1;

      // 3. Insert new attempt with 30-minute server timer
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 1800 * 1000).toISOString();

      const { data: newAttempt, error: attErr } = await supabase
        .from('dt_attempts')
        .insert({
          candidate_id: candidateRecord.id,
          attempt_number: nextAttemptNumber,
          status: 'in_progress',
          started_at: now.toISOString(),
          total_questions: 15,
          time_limit_seconds: 1800,
          timer_expires_at: expiresAt,
          auto_submitted: false,
        })
        .select()
        .single();

      if (attErr) throw attErr;

      // 4. Batch insert dt_attempt_questions
      const attemptQuestionsToInsert = selectedQuestions.map((q, idx) => ({
        attempt_id: newAttempt.id,
        question_id: q.id,
        position: idx + 1,
      }));

      const { error: daqErr } = await supabase
        .from('dt_attempt_questions')
        .insert(attemptQuestionsToInsert);

      if (daqErr) {
        console.error('Error inserting attempt questions:', daqErr);
      }

      setCurrentAttempt(newAttempt);
      setSelectedAnswers({});
      setCurrentQIndex(0);
      setTimerExpiresAt(expiresAt);
      setTimerRemainingSeconds(1800);
      hasTriggeredFiveMinWarning.current = false;
      hasTriggeredOneMinWarning.current = false;
      autoSubmittingRef.current = false;

      // 5. Load test interface using these assigned questions
      setQuestions(selectedQuestions);
      setScreen('test');
    } catch (err) {
      console.error('Error starting test:', err);
      setScreen('intro');
    }
  };

  // --------------------------------------------------------------------------
  // RESTART TEST (Always from start: Question 1, fresh 30-min timer)
  // --------------------------------------------------------------------------
  const handleRestartTest = async () => {
    setShowRestartModal(false);
    if (!candidateRecord?.id) return;
    try {
      setScreen('loading');

      if (currentAttempt?.id) {
        await supabase
          .from('dt_attempts')
          .update({
            status: 'abandoned',
            completed_at: new Date().toISOString(),
          })
          .eq('id', currentAttempt.id);
        await supabase.from('dt_answers').delete().eq('attempt_id', currentAttempt.id);
      }

      setSelectedAnswers({});
      setCurrentQIndex(0);
      setTimerRemainingSeconds(1800);
      hasTriggeredFiveMinWarning.current = false;
      hasTriggeredOneMinWarning.current = false;
      autoSubmittingRef.current = false;

      await handleStartTest();
    } catch (err) {
      console.error('Error restarting test:', err);
      setScreen('intro');
    }
  };

  // --------------------------------------------------------------------------
  // TEST SUBMISSION & AUTOMATED SCORING (Manual & Auto-Submit)
  // --------------------------------------------------------------------------
  const handleSubmitTest = async (isAutoSubmit = false) => {
    if (!currentAttempt?.id || !candidateRecord?.id) return;
    if (autoSubmittingRef.current && !isAutoSubmit) return;

    if (isAutoSubmit) {
      autoSubmittingRef.current = true;
      setIsTimeUpOverlayOpen(true);
      setShowOneMinModal(false);
      setShowConfirmModal(false);
    }

    try {
      setIsSubmitting(true);

      // Ensure questions are present
      let qList = questions;
      if (qList.length === 0) {
        const { data: qData } = await supabase
          .from('dt_questions')
          .select('*')
          .eq('is_active', true)
          .order('question_order', { ascending: true });
        qList = qData || [];
        setQuestions(qList);
      }

      // 1. Compare each question & prepare dt_answers rows
      let correctAnswersCount = 0;
      const answersToInsert = qList.map((q) => {
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

      // Clear any prior answers for attempt then insert fresh 15 answers
      await supabase.from('dt_answers').delete().eq('attempt_id', currentAttempt.id);
      const { error: insErr } = await supabase.from('dt_answers').insert(answersToInsert);
      if (insErr) {
        console.warn('Answers insertion note:', insErr);
      }

      // 2. Score Calculation
      const totalQuestions = qList.length || 15;
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
          auto_submitted: isAutoSubmit,
        })
        .eq('id', currentAttempt.id)
        .select()
        .single();

      if (updAttErr) throw updAttErr;
      const resultData = updatedAttempt || {
        ...currentAttempt,
        correct_answers: correctAnswersCount,
        score_pct: scorePct,
        passed,
        auto_submitted: isAutoSubmit,
      };

      // Immediately compute difficulty stats from current test questions
      const immediateStats: Record<string, { correct: number; total: number }> = {
        beginner: { correct: 0, total: 0 },
        elementary: { correct: 0, total: 0 },
        intermediate: { correct: 0, total: 0 },
        upper_intermediate: { correct: 0, total: 0 },
      };
      qList.forEach((q) => {
        const diff = q.difficulty_level?.toLowerCase();
        if (diff && immediateStats[diff]) {
          immediateStats[diff].total += 1;
          const selected = selectedAnswers[q.id] || null;
          const isCorrect = selected !== null && selected.toLowerCase() === q.correct_option.toLowerCase();
          if (isCorrect) {
            immediateStats[diff].correct += 1;
          }
        }
      });
      setAttemptDifficultyStats(immediateStats);

      setLastResultData(resultData);

      // Record seen questions for this candidate
      try {
        await supabase.rpc('record_candidate_seen_questions', {
          p_candidate_id: candidateRecord.id,
          p_question_ids: qList.map((q) => q.id),
        });
      } catch (seenErr) {
        console.error('Error recording seen questions:', seenErr);
      }

      await completeTestAttempt(resultData, passed, scorePct, isAutoSubmit, currentAttempt.id);

      // Re-fetch all attempts
      const { data: refreshedAttempts } = await supabase
        .from('dt_attempts')
        .select('*')
        .eq('candidate_id', candidateRecord.id)
        .order('attempt_number', { ascending: false });

      setAllAttempts(refreshedAttempts || []);
    } catch (err) {
      console.error('Error submitting diagnostic test:', err);
      setIsTimeUpOverlayOpen(false);
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


  // Helper: format countdown
  const getRemainingDaysAndHours = (endsAtStr?: string) => {
    if (!endsAtStr) return '0 days 0 hours remaining';
    const endsAt = new Date(endsAtStr).getTime();
    const now = new Date().getTime();
    const diff = Math.max(0, endsAt - now);
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days} days ${hours} hours remaining`;
  };

  // --------------------------------------------------------------------------
  // RENDER ATTEMPT CIRCLES COMPONENT
  // --------------------------------------------------------------------------
  const renderAttemptCircles = (usedCount: number, isTenFails = false) => {
    const total = 10;
    const clampedUsed = Math.min(total, Math.max(0, usedCount));
    return (
      <div className="flex items-center space-x-1.5 my-2">
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
                isUsed ? 'bg-slate-600' : 'border-2 border-slate-300 bg-white'
              }`}
              title={`Attempt ${idx + 1}: ${isUsed ? 'Used' : 'Remaining'}`}
            />
          );
        })}
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER FAIL INDICATORS (Consecutive fails & Total fails dots)
  // --------------------------------------------------------------------------
  const renderFailIndicators = (consecutive: number, totalInWindow: number) => {
    const isConsecutiveClose = consecutive === 2;
    const isTotalClose = totalInWindow === 4;

    let warningText: string | null = null;
    if (isConsecutiveClose && isTotalClose) {
      warningText = 'One more fail applies a 10-day break.';
    } else if (isConsecutiveClose) {
      warningText = 'One more consecutive fail applies a 10-day break.';
    } else if (isTotalClose) {
      warningText = 'One more fail applies a 10-day break.';
    }

    return (
      <div className="space-y-2 py-1">
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs">
          {/* Consecutive fails (3 max) */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-600 font-medium">Consecutive fails:</span>
            <div className="flex items-center space-x-1">
              {[0, 1, 2].map((idx) => {
                const filled = idx < consecutive;
                let dotColor = 'bg-slate-200 border-slate-300';
                if (filled) {
                  dotColor = consecutive >= 2 ? 'bg-amber-500 border-amber-600' : 'bg-slate-700 border-slate-800';
                }
                return (
                  <div
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-full border transition-colors ${dotColor}`}
                    title={`Consecutive fail ${idx + 1}`}
                  />
                );
              })}
            </div>
            <span className="text-[11px] text-slate-400 font-mono">({consecutive}/3)</span>
          </div>

          {/* Total fails in window (5 max) */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-600 font-medium">Total fails:</span>
            <div className="flex items-center space-x-1">
              {[0, 1, 2, 3, 4].map((idx) => {
                const filled = idx < totalInWindow;
                let dotColor = 'bg-slate-200 border-slate-300';
                if (filled) {
                  dotColor =
                    totalInWindow >= 4
                      ? 'bg-rose-500 border-rose-600'
                      : totalInWindow >= 3
                      ? 'bg-amber-500 border-amber-600'
                      : 'bg-slate-700 border-slate-800';
                }
                return (
                  <div
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-full border transition-colors ${dotColor}`}
                    title={`Total fail ${idx + 1}`}
                  />
                );
              })}
            </div>
            <span className="text-[11px] text-slate-400 font-mono">({totalInWindow}/5)</span>
          </div>
        </div>

        {warningText && (
          <div className="text-center pt-0.5">
            <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-[6px] px-3 py-1.5 inline-block">
              {warningText}
            </p>
          </div>
        )}
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

                <div className="flex items-center space-x-2">
                  {att.status === 'completed' ? (
                    <>
                      {att.passed ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Pass
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Fail
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setLastResultData(att);
                          if (att.passed) {
                            setScreen('pass_result');
                          } else {
                            setScreen('fail_result');
                          }
                        }}
                        className="px-2.5 py-1 rounded-[6px] bg-[#1B3270]/5 hover:bg-[#1B3270]/10 text-[#1B3270] text-xs font-semibold transition-colors cursor-pointer"
                        title="View score and difficulty breakdown"
                      >
                        Performance
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setReviewAttemptId(att.id);
                          setReviewInitialFilter('all');
                          setScreen('question_review');
                        }}
                        className="text-xs font-semibold text-[#2952A3] hover:underline cursor-pointer px-1 py-1"
                        title="Review questions and answers"
                      >
                        Review
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        In Progress
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await loadQuestionsAndResume(att.id);
                          setScreen('test');
                        }}
                        className="px-2.5 py-1 rounded-[6px] bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Resume
                      </button>
                    </>
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
    // Standard 4 tiers present in the Diagnostic Test
    const levels = [
      { key: 'beginner', label: 'Beginner' },
      { key: 'elementary', label: 'Elementary' },
      { key: 'intermediate', label: 'Intermediate' },
      { key: 'upper_intermediate', label: 'Upper Intermediate' },
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
          <button type="button" className="text-slate-400 hover:text-slate-600 cursor-pointer">
            {showDifficultyBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {showDifficultyBreakdown && (
          <div className="space-y-2.5 pt-1">
            {levels.map((lvl) => {
              const stat = attemptDifficultyStats[lvl.key] || {
                correct: 0,
                total: lvl.key === 'upper_intermediate' ? 6 : 3,
              };
              const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;

              return (
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
                        className="bg-[#1B3270] h-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-[#1B3270] min-w-[28px] text-right font-mono">
                      {stat.correct}/{stat.total}
                    </span>
                    <span className="text-[11px] text-[#94A3B8] group-hover:text-[#1B3270] font-medium shrink-0">
                      Filter →
                    </span>
                  </div>
                </div>
              );
            })}
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
    const completedList = allAttempts.filter((a) => a.status === 'completed');

    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150 pb-12">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setScreen('intro')}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] p-1.5 rounded-[6px] hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to Overview</span>
          </button>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 shadow-[0_1px_4px_rgba(27,50,112,0.08)] text-center space-y-5">
          {/* Attempt Selector Switcher */}
          {completedList.length > 1 && (
            <div className="p-2.5 bg-slate-50 border border-[#E2E8F4] rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
              <span className="text-xs text-[#4A5568] font-medium">
                Viewing Attempt {lastResultData?.attempt_number}
              </span>
              <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                {completedList.map((att) => {
                  const isSelected = lastResultData?.id === att.id;
                  return (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => {
                        setLastResultData(att);
                        if (att.passed) {
                          setScreen('pass_result');
                        } else {
                          setScreen('fail_result');
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-[6px] transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1B3270] text-white shadow-2xs'
                          : 'bg-white border border-[#E2E8F4] text-[#4A5568] hover:bg-slate-100'
                      }`}
                    >
                      Attempt {att.attempt_number} ({att.score_pct}%)
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
            {lastResultData?.auto_submitted && (
              <div className="mt-3 p-3 bg-[#F0F4FF] border border-[#CBD5E1] rounded-[8px] text-xs text-[#1B3270] flex items-center justify-center space-x-2">
                <Clock size={14} className="text-[#1B3270] shrink-0" />
                <span>This attempt was auto-submitted when the 30-minute time limit was reached.</span>
              </div>
            )}
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
  // SCREEN: FAIL RESULT (No cooling triggered)
  // --------------------------------------------------------------------------
  if (screen === 'fail_result') {
    const currentAttemptCount = candidateRecord?.dt_attempt_count ?? 1;
    const correctCount = lastResultData?.correct_answers ?? 0;
    const scorePct = lastResultData?.score_pct ?? Math.round((correctCount / 15) * 10000) / 100;
    const remainingAttempts = Math.max(0, 10 - currentAttemptCount);
    const completedList = allAttempts.filter((a) => a.status === 'completed');

    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150 pb-12">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setScreen('intro')}
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] p-1.5 rounded-[6px] hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft size={16} />
            <span>Back to Overview</span>
          </button>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-6">
          {/* Attempt Selector Switcher */}
          {completedList.length > 1 && (
            <div className="p-2.5 bg-slate-50 border border-[#E2E8F4] rounded-[8px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
              <span className="text-xs text-[#4A5568] font-medium">
                Viewing Attempt {lastResultData?.attempt_number}
              </span>
              <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                {completedList.map((att) => {
                  const isSelected = lastResultData?.id === att.id;
                  return (
                    <button
                      key={att.id}
                      type="button"
                      onClick={() => {
                        setLastResultData(att);
                        if (att.passed) {
                          setScreen('pass_result');
                        } else {
                          setScreen('fail_result');
                        }
                      }}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-[6px] transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1B3270] text-white shadow-2xs'
                          : 'bg-white border border-[#E2E8F4] text-[#4A5568] hover:bg-slate-100'
                      }`}
                    >
                      Attempt {att.attempt_number} ({att.score_pct}%)
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Header & Icon */}
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto ring-6 ring-amber-50/60">
              <XCircle size={40} />
            </div>

            <div className="text-4xl font-extrabold text-[#1B3270] my-2">
              {scorePct}%
            </div>

            <p className="text-xs text-[#94A3B8]">
              Pass mark: 33% (5 correct)
            </p>

            <p className="text-xs font-medium text-[#4A5568]">
              {correctCount} correct out of 15
            </p>

            {lastResultData?.auto_submitted && (
              <div className="p-3 bg-[#F0F4FF] border border-[#CBD5E1] rounded-[8px] text-xs text-[#1B3270] flex items-center justify-center space-x-2">
                <Clock size={14} className="text-[#1B3270] shrink-0" />
                <span>This attempt was auto-submitted when the 30-minute time limit was reached.</span>
              </div>
            )}

            {/* Attempt Circles & Remaining Attempts */}
            <div className="flex flex-col items-center pt-1 space-y-2">
              <span className="text-xs text-[#94A3B8]">
                {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining in this round
              </span>
              {renderAttemptCircles(currentAttemptCount, false)}
              {renderFailIndicators(
                candidateRecord?.dt_consecutive_fails ?? 0,
                candidateRecord?.dt_total_fails_in_window ?? 0
              )}
            </div>
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

          {/* OFFERINGS SECTION (optional, non-blocking) */}
          {recommendedOfferings.length > 0 && (
            <div className="border-t border-[#E2E8F4] pt-5 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-[#1B3270]">Training Options</h3>
              </div>

              <div className="space-y-3">
                {recommendedOfferings.map((item) => {
                  const off = item.offerings;
                  const isAvailed = item.status === 'availed';

                  return (
                    <div
                      key={item.id}
                      className="p-4 border border-[#E2E8F4] rounded-[8px] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
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
                            <Check size={14} className="mr-1 text-emerald-600" />
                            Enrolled ✓
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

          {/* RETAKE TEST BUTTON */}
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
        </div>

        {/* ATTEMPT HISTORY */}
        {renderAttemptHistory()}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // SCREEN: COOLING PERIOD ACTIVE (Triggered immediately or returning)
  // --------------------------------------------------------------------------
  if (screen === 'cooling_active') {
    const trigger = activeCoolingPeriod?.cooling_trigger;
    const isConsecutiveTrigger = trigger === '3_consecutive';
    const isTotalTrigger = trigger === '5_total';
    const isRoundExhausted = trigger === 'round_exhausted';

    // Distinguish immediate trigger screen vs returning candidate
    const isImmediate = Boolean(
      lastResultData &&
        activeCoolingPeriod?.triggered_by_attempt_id &&
        lastResultData.id === activeCoolingPeriod.triggered_by_attempt_id
    );

    let heading = 'Break Required';
    let subtitle = 'A preparation break now applies.';

    if (isConsecutiveTrigger) {
      heading = isImmediate
        ? '3 Consecutive Fails — Break Required'
        : 'Break active — consecutive fail limit reached';
      subtitle = 'You have not passed 3 attempts in a row. A 10-day preparation break now applies.';
    } else if (isTotalTrigger) {
      heading = isImmediate
        ? '5 Fails This Round — Break Required'
        : 'Break active — total fail limit reached';
      subtitle = 'You have used 5 attempts without passing. A 10-day preparation break now applies.';
    } else if (isRoundExhausted) {
      heading = isImmediate
        ? 'All 10 Attempts Used — Break Required'
        : 'Break active — all 10 attempts used';
      subtitle =
        'You have used all 10 attempts for this round. A 14-day preparation break now applies. A fresh set of 10 attempts will be available once the break ends.';
    }

    const currentAttemptsUsed = isRoundExhausted ? 10 : (candidateRecord?.dt_attempt_count ?? 0);
    const remainingAttemptsAfterBreak = Math.max(0, 10 - currentAttemptsUsed);

    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150 pb-12">
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-8 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-6 text-center">
          {/* Amber icon for mid-round; rose/alert icon for round exhausted */}
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ring-8 ${
              isRoundExhausted
                ? 'bg-rose-50 text-rose-600 ring-rose-50/60'
                : 'bg-amber-50 text-amber-600 ring-amber-50/60'
            }`}
          >
            <AlertCircle size={40} />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-[#1B3270]">{heading}</h2>
            <p className="text-xs text-[#4A5568] max-w-md mx-auto leading-relaxed">{subtitle}</p>

            {/* Last attempt score shown once (small, muted) */}
            {lastResultData && lastResultData.score_pct !== undefined && lastResultData.score_pct !== null && (
              <p className="text-xs text-slate-400 pt-1">
                Last attempt score: {lastResultData.score_pct}% ({lastResultData.correct_answers ?? 0}/15 correct)
              </p>
            )}
          </div>

          {/* BREAK COUNTDOWN CARD */}
          <div className="p-4 bg-slate-50 border border-[#E2E8F4] rounded-[8px] space-y-1">
            <div className="text-xs text-slate-500">
              Break ends on {activeCoolingPeriod?.ends_at ? formatDate(activeCoolingPeriod.ends_at) : 'scheduled date'}
            </div>
            <div className="text-base font-bold text-[#1B3270]">
              {getRemainingDaysAndHours(activeCoolingPeriod?.ends_at)}
            </div>
          </div>

          {/* ATTEMPTS STATUS */}
          <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-[8px] text-xs text-[#1B3270] font-medium text-center">
            {isRoundExhausted ? (
              <span>A fresh 10 attempts will be available after break ends.</span>
            ) : (
              <span>
                {currentAttemptsUsed} of 10 attempts used. {remainingAttemptsAfterBreak} remaining after break.
              </span>
            )}
          </div>

          {/* OFFERINGS (non-blocking) */}
          {recommendedOfferings.length > 0 && (
            <div className="border-t border-[#E2E8F4] pt-5 space-y-4 text-left">
              <div>
                <h3 className="text-sm font-bold text-[#1B3270]">Use this time to prepare</h3>
                <p className="text-xs text-[#4A5568] mt-0.5 leading-relaxed">
                  Training options are available. Availing them is optional — your next attempt unlocks automatically when the break ends.
                </p>
              </div>

              <div className="space-y-3">
                {recommendedOfferings.map((item) => {
                  const off = item.offerings;
                  const isAvailed = item.status === 'availed';

                  return (
                    <div
                      key={item.id}
                      className="p-4 border border-[#E2E8F4] rounded-[8px] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
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
                            <Check size={14} className="mr-1 text-emerald-600" />
                            Enrolled ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoadingId === item.id}
                            onClick={() => handleAvailOffering(item.id)}
                            className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-medium rounded-[6px] transition-colors cursor-pointer"
                          >
                            {actionLoadingId === item.id ? 'Registering...' : 'Avail'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Attempt History */}
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
        {/* Toast if cooling just expired */}
        {coolingExpiredToast && (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-[8px] flex items-center justify-between text-xs text-[#1B3270] shadow-xs">
            <div className="flex items-center space-x-2 font-medium">
              <Clock size={16} className="text-[#1B3270] shrink-0" />
              <span>{coolingExpiredToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setCoolingExpiredToast(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold ml-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

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
            <span className="px-3 py-1 bg-slate-100 border border-[#E2E8F4] text-[#1B3270] rounded-full text-xs font-medium inline-flex items-center gap-1.5">
              <Clock size={12} className="text-[#1B3270]" />
              <span>30 minutes</span>
            </span>
          </div>

          {/* Amber info line below pills */}
          <p className="text-xs text-[#92400E]">
            The test auto-submits when time runs out. Unanswered questions are marked incorrect.
          </p>

          {/* Attempt Counter (if previous attempts used in this round) */}
          {usedRoundCount > 0 && (
            <div className="space-y-2 text-center">
              <span className="text-xs font-semibold text-[#1B3270] block">
                Attempt {usedRoundCount + 1} of 10
              </span>
              {renderFailIndicators(
                candidateRecord?.dt_consecutive_fails ?? 0,
                candidateRecord?.dt_total_fails_in_window ?? 0
              )}
            </div>
          )}

          {/* Previous result if any: "Last score: [score_pct]%" (One line, no extra context) */}
          {previousCompletedAttempt && (
            <p className="text-xs text-[#4A5568] text-center">
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

        {/* ATTEMPT HISTORY */}
        {renderAttemptHistory()}
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
            <div className="flex items-center space-x-3 shrink-0">
              <span className="text-xs font-bold text-[#1B3270] bg-slate-100 px-3 py-1.5 rounded-full">
                {answeredCount}/15 Answered
              </span>
              {renderTimerDisplay()}
            </div>
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
                      Q{idx + 1}
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
                  onClick={() => handleSubmitTest(false)}
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
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-150 pb-16 relative">
      <style>{`
        @keyframes pulse-border-warn {
          0%, 100% { border-color: #FDE68A; }
          50% { border-color: #F59E0B; }
        }
        @keyframes pulse-border-crit {
          0%, 100% { border-color: #FECACA; }
          50% { border-color: #EF4444; }
        }
      `}</style>

      {/* TOP BAR: Left = Back & Restart, Center = Question info + progress bar, Right = Timer */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3.5 sm:p-4 shadow-[0_1px_4px_rgba(27,50,112,0.06)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowExitModal(true)}
            className="inline-flex items-center space-x-1 text-xs font-semibold text-[#4A5568] hover:text-[#1B3270] px-2.5 py-1.5 rounded-[6px] border border-[#E2E8F4] hover:bg-slate-50 transition-colors cursor-pointer"
            title="Return to Overview"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRestartModal(true)}
            className="inline-flex items-center space-x-1 text-xs font-semibold text-[#B91C1C] hover:text-[#991B1B] px-2.5 py-1.5 rounded-[6px] border border-[#FECACA] hover:bg-rose-50 transition-colors cursor-pointer"
            title="Restart test from start"
          >
            <RotateCcw size={13} />
            <span>Restart</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-xs font-semibold text-[#4A5568] whitespace-nowrap">
            Question {currentQIndex + 1} of {questions.length || 15}
          </span>
          <div className="w-20 sm:w-28 bg-[#E2E8F4] rounded-full h-2 overflow-hidden shrink-0">
            <div
              className="bg-[#1B3270] h-full transition-all duration-200"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="shrink-0">
          {renderTimerDisplay()}
        </div>
      </div>

      {/* QUESTION CARD */}
      {currentQ && (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.06)] space-y-6">
          {/* Header with difficulty badge */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#94A3B8]">
              Question {currentQIndex + 1}
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
                  onClick={() => handleSelectOption(currentQ.id, opt.key)}
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
              onClick={() => {
                syncTimerWithServer();
                setCurrentQIndex((prev) => Math.max(0, prev - 1));
              }}
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
                onClick={() => {
                  syncTimerWithServer();
                  setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1));
                }}
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

      {/* EXIT CONFIRMATION MODAL */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] p-6 max-w-md w-full shadow-xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-[#1B3270]">
              <AlertCircle size={22} className="text-[#F59E0B]" />
              <h3 className="text-base font-bold">Leave Test</h3>
            </div>

            <p className="text-xs text-[#4A5568] leading-relaxed">
              Your answered questions for this attempt are saved. The test timer continues running in the background and you can resume this attempt anytime before time expires.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-bold rounded-[6px] transition-colors shadow-2xs cursor-pointer"
              >
                Continue Test
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  setScreen('intro');
                  runStateChecks();
                }}
                className="px-4 py-2 border border-[#E2E8F4] hover:bg-slate-50 text-[#4A5568] text-xs font-medium rounded-[6px] transition-colors cursor-pointer"
              >
                Exit to Overview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTART CONFIRMATION MODAL */}
      {showRestartModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] p-6 max-w-md w-full shadow-xl space-y-4 animate-in zoom-in-95 duration-150 border border-rose-100">
            <div className="flex items-center space-x-3 text-[#B91C1C]">
              <RotateCcw size={22} className="text-[#EF4444]" />
              <h3 className="text-base font-bold text-[#1B3270]">Restart Test from Start</h3>
            </div>

            <p className="text-xs text-[#4A5568] leading-relaxed">
              This will abandon your current attempt and start a fresh attempt beginning at Question 1 with a new 30-minute timer. This will count toward your total attempts.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setShowRestartModal(false)}
                className="px-4 py-2 border border-[#E2E8F4] hover:bg-slate-50 text-[#4A5568] text-xs font-medium rounded-[6px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestartTest}
                className="px-5 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white text-xs font-bold rounded-[6px] transition-colors shadow-2xs flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Restart from Start</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5-MINUTE WARNING TOAST */}
      {showFiveMinToast && (
        <div className="fixed top-5 right-5 z-50 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] px-4 py-3 rounded-[8px] shadow-lg flex items-center space-x-2 animate-in slide-in-from-top duration-200">
          <Clock size={16} className="text-[#F59E0B] shrink-0" />
          <span className="text-xs font-semibold">5 minutes remaining.</span>
        </div>
      )}

      {/* 1-MINUTE REMAINING BLOCKING MODAL */}
      {showOneMinModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 border border-[#FECACA]">
            <div className="flex items-center space-x-3 text-[#991B1B]">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-[#EF4444]">
                <Clock size={22} />
              </div>
              <h3 className="text-base font-bold text-[#1B3270]">1 Minute Remaining</h3>
            </div>
            <p className="text-xs text-[#4A5568] leading-relaxed">
              You have 1 minute left. Any unanswered questions will be skipped on auto-submit.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowOneMinModal(false)}
                className="w-full py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-bold rounded-[6px] transition-colors shadow-2xs cursor-pointer"
              >
                Continue Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TIME'S UP OVERLAY (AUTO-SUBMIT ON EXPIRY) */}
      {isTimeUpOverlayOpen && (
        <div className="fixed inset-0 z-[9999] bg-[#1B3270]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] p-8 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto text-[#F59E0B]">
              <Clock size={40} />
            </div>
            <h3 className="text-xl font-bold text-[#1B3270]">Time&apos;s Up</h3>
            <p className="text-xs text-[#4A5568] leading-relaxed">
              Your test has been submitted automatically.
            </p>
          </div>
        </div>
      )}

      {/* RESUME IN-PROGRESS TEST TOAST */}
      {resumeToast && (
        <div className="fixed top-5 right-5 z-50 bg-[#F0F4FF] border border-[#CBD5E1] text-[#1B3270] px-4 py-3 rounded-[8px] shadow-lg flex items-center space-x-2 animate-in slide-in-from-top duration-200">
          <Clock size={16} className="text-[#1B3270] shrink-0" />
          <span className="text-xs font-semibold">{resumeToast}</span>
        </div>
      )}
    </div>
  );
};
