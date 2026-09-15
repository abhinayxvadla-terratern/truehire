import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useAuth } from '../../../../../context/AuthContext';
import { notifyByRole } from '../../../../../utils/notificationRouting';
import {
  X,
  Mic,
  AlertCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface RubricCriterion {
  id: string;
  criterion_name: string;
  description: string;
  max_score: number;
  order_position: number;
}

interface RecordSpeakingTestModalProps {
  candidateId: string;
  candidateName: string;
  scheduleId?: string;
  academicRequestId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordSpeakingTestModal: React.FC<RecordSpeakingTestModalProps> = ({
  candidateId,
  candidateName,
  scheduleId,
  academicRequestId,
  onClose,
  onSuccess,
}) => {
  const { user, profile } = useAuth();

  // Criteria from database
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(true);

  // Scores and notes per criterion
  const [scores, setScores] = useState<Record<string, number>>({});
  const [criterionNotes, setCriterionNotes] = useState<Record<string, string>>({});

  // Additional Fields
  const [languageLevel, setLanguageLevel] = useState<'A1' | 'A2' | 'B1' | 'B2' | 'C1'>('B1');
  const [outcome, setOutcome] = useState<'pass' | 'fail'>('pass');
  const [isOutcomeManuallyOverridden, setIsOutcomeManuallyOverridden] = useState(false);
  const [mentorNotes, setMentorNotes] = useState('');

  // Resolved schedule & request IDs (in case not passed as props)
  const [resolvedScheduleId, setResolvedScheduleId] = useState<string | null>(scheduleId || null);
  const [resolvedAcademicRequestId, setResolvedAcademicRequestId] = useState<string | null>(academicRequestId || null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch criteria & schedule on mount
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoadingCriteria(true);

        // 1. Fetch active rubric criteria ordered by order_position
        const { data: criteriaData, error: critErr } = await supabase
          .from('speaking_test_rubric_criteria')
          .select('id, criterion_name, description, max_score, order_position')
          .eq('is_active', true)
          .order('order_position', { ascending: true });

        if (critErr) throw critErr;

        const fetchedCriteria = criteriaData || [];
        setCriteria(fetchedCriteria);

        // Initialize scores with 12 for each criterion (total = 60 / pass threshold)
        const initialScores: Record<string, number> = {};
        const initialNotes: Record<string, string> = {};
        fetchedCriteria.forEach((c) => {
          initialScores[c.id] = 12; // default moderate score
          initialNotes[c.id] = '';
        });
        setScores(initialScores);
        setCriterionNotes(initialNotes);

        // 2. Resolve schedule and academic request if not provided
        if (!scheduleId || !academicRequestId) {
          const { data: schedData } = await supabase
            .from('speaking_test_schedules')
            .select('id, academic_request_id')
            .eq('candidate_id', candidateId)
            .in('status', ['approved', 'scheduled'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (schedData) {
            if (!scheduleId) setResolvedScheduleId(schedData.id);
            if (!academicRequestId && schedData.academic_request_id) {
              setResolvedAcademicRequestId(schedData.academic_request_id);
            }
          }

          if (!academicRequestId && (!schedData || !schedData.academic_request_id)) {
            const { data: reqData } = await supabase
              .from('academic_requests')
              .select('id')
              .eq('candidate_id', candidateId)
              .eq('request_type', 'speaking_test')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (reqData) {
              setResolvedAcademicRequestId(reqData.id);
            }
          }
        }
      } catch (err: any) {
        console.error('Error loading rubric criteria:', err);
        setErrorMsg(err.message || 'Failed to load speaking test criteria.');
      } finally {
        setLoadingCriteria(false);
      }
    };

    fetchInitialData();
  }, [candidateId, scheduleId, academicRequestId]);

  // Compute Total Score and Percentage
  const totalScore = Object.values(scores).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
  const maxPossibleScore = 100;
  const scorePct = Math.round((totalScore / maxPossibleScore) * 100);
  const isPassing = scorePct >= 60;

  // Real-time auto-suggest outcome unless mentor manually toggled it
  useEffect(() => {
    if (!isOutcomeManuallyOverridden) {
      setOutcome(isPassing ? 'pass' : 'fail');
    }
  }, [isPassing, isOutcomeManuallyOverridden]);

  const handleScoreChange = (criterionId: string, val: number) => {
    const clamped = Math.max(0, Math.min(20, isNaN(val) ? 0 : val));
    setScores((prev) => ({ ...prev, [criterionId]: clamped }));
  };

  const handleNoteChange = (criterionId: string, val: string) => {
    setCriterionNotes((prev) => ({ ...prev, [criterionId]: val }));
  };

  const getScoreColorClass = (val: number) => {
    if (val <= 7) return 'text-rose-600 bg-rose-50 border-rose-300';
    if (val <= 13) return 'text-amber-600 bg-amber-50 border-amber-300';
    return 'text-emerald-700 bg-emerald-50 border-emerald-300';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (mentorNotes.trim().length < 50) {
      setErrorMsg(`Mentor Notes must be at least 50 characters (currently ${mentorNotes.trim().length} characters).`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. INSERT speaking_test_results
      const { data: stResult, error: stErr } = await supabase
        .from('speaking_test_results')
        .insert({
          candidate_id: candidateId,
          mentor_id: user.id,
          schedule_id: resolvedScheduleId,
          academic_request_id: resolvedAcademicRequestId,
          total_score: totalScore,
          max_possible_score: maxPossibleScore,
          score_pct: scorePct,
          pass_threshold_pct: 60,
          language_level_assessed: languageLevel,
          overall_outcome: outcome,
          mentor_notes: mentorNotes.trim(),
          review_status: 'pending',
        })
        .select('id')
        .single();

      if (stErr) throw stErr;
      const resultId = stResult.id;

      // 2. INSERT speaking_test_rubric_scores (one row per criterion)
      const rubricScoresToInsert = criteria.map((c) => ({
        result_id: resultId,
        criterion_id: c.id,
        score: scores[c.id] ?? 0,
        notes: criterionNotes[c.id]?.trim() || null,
      }));

      if (rubricScoresToInsert.length > 0) {
        const { error: rubricErr } = await supabase
          .from('speaking_test_rubric_scores')
          .insert(rubricScoresToInsert);

        if (rubricErr) throw rubricErr;
      }

      // 3. UPDATE speaking_test_schedules SET status = 'completed'
      if (resolvedScheduleId) {
        await supabase
          .from('speaking_test_schedules')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', resolvedScheduleId);
      } else {
        await supabase
          .from('speaking_test_schedules')
          .update({
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('candidate_id', candidateId)
          .in('status', ['approved', 'scheduled']);
      }

      // 4. UPDATE academic_requests SET status = 'pending_review'
      if (resolvedAcademicRequestId) {
        await supabase
          .from('academic_requests')
          .update({
            status: 'pending_review',
            updated_at: new Date().toISOString(),
          })
          .eq('id', resolvedAcademicRequestId);
      } else {
        await supabase
          .from('academic_requests')
          .update({
            status: 'pending_review',
            updated_at: new Date().toISOString(),
          })
          .eq('candidate_id', candidateId)
          .eq('request_type', 'speaking_test');
      }

      // 5. INSERT gate_results (gate_type = 'speaking_test', status = 'pending_review')
      const { error: gateErr } = await supabase.from('gate_results').insert({
        candidate_id: candidateId,
        gate_type: 'speaking_test',
        status: 'pending_review',
        score: totalScore,
        notes: mentorNotes.trim(),
        recorded_by: user.id,
        review_status: 'pending',
      });

      if (gateErr) throw gateErr;

      // 6. Notify Academic Lead(s)
      const mentorDisplayName =
        profile?.first_name && profile?.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : 'Mentor';

      const outcomeText = outcome === 'pass' ? 'Pass' : 'Did Not Pass';

      await notifyByRole(
        supabase,
        'academic_lead',
        'Speaking Test Result Ready',
        `Mentor ${mentorDisplayName} submitted result for ${candidateName}. Score: ${totalScore}/100 (${scorePct}%). Outcome: ${outcomeText} — review and approve.`,
        'academic',
        user.id
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting speaking test result:', err);
      setErrorMsg(err.message || 'Failed to submit speaking test result.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-2xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-4 max-h-[92vh] flex flex-col">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-[#1B3270]/10 flex items-center justify-center text-[#1B3270]">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#1B3270]">
                Speaking Test — {candidateName}
              </h2>
              <p className="text-xs text-[#4A5568] mt-0.5">
                Score each criterion out of 20. Total: 100. Pass threshold: 60%.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SCROLLABLE FORM BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {loadingCriteria ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1B3270]" />
              Loading 5-criterion rubric parameters...
            </div>
          ) : (
            <>
              {/* RUBRIC CRITERIA LIST */}
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-1 border-b border-[#E2E8F4]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#1B3270]">
                    Evaluation Criteria (5 Criteria × 20 Pts)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Pass Benchmark: 12+ per criterion
                  </span>
                </div>

                {criteria.map((c, index) => {
                  const val = scores[c.id] ?? 0;
                  const scoreBadgeStyle = getScoreColorClass(val);

                  return (
                    <div
                      key={c.id}
                      className="p-4 rounded-[10px] border border-[#E2E8F4] bg-[#F8FAFD]/60 hover:bg-[#F8FAFD] transition-colors space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-[#1B3270] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <h4 className="text-sm font-bold text-[#1B3270]">
                              {c.criterion_name}
                            </h4>
                          </div>
                          <p className="text-[12px] text-[#4A5568] mt-1 pl-7 leading-relaxed">
                            {c.description}
                          </p>
                        </div>

                        {/* Current Score Tag */}
                        <div className="shrink-0 pl-7 sm:pl-0">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${scoreBadgeStyle}`}
                          >
                            {val} / 20
                          </span>
                        </div>
                      </div>

                      {/* Slider + Number Input */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3 pt-1">
                        <div className="sm:col-span-3 flex items-center space-x-3">
                          <span className="text-[10px] font-bold text-slate-400 w-3">0</span>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            step="1"
                            value={val}
                            onChange={(e) =>
                              handleScoreChange(c.id, parseInt(e.target.value, 10))
                            }
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1B3270]"
                          />
                          <span className="text-[10px] font-bold text-slate-400 w-4">20</span>
                        </div>

                        <div className="sm:col-span-1 flex items-center space-x-2">
                          <label className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                            Score:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={val}
                            onChange={(e) =>
                              handleScoreChange(c.id, parseInt(e.target.value, 10))
                            }
                            className="w-20 px-2.5 py-1 text-center font-bold text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                          />
                        </div>
                      </div>

                      {/* Criterion Notes (Optional) */}
                      <div>
                        <textarea
                          rows={2}
                          value={criterionNotes[c.id] || ''}
                          onChange={(e) => handleNoteChange(c.id, e.target.value)}
                          placeholder={`Add specific notes on ${c.criterion_name.toLowerCase()} (optional)...`}
                          className="w-full p-2 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ADDITIONAL FIELDS */}
              <div className="p-4 bg-slate-50 border border-[#E2E8F4] rounded-[10px] space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Assessment Finalization
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Language Level Assessed */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Language Level Assessed *
                    </label>
                    <select
                      value={languageLevel}
                      onChange={(e) =>
                        setLanguageLevel(e.target.value as 'A1' | 'A2' | 'B1' | 'B2' | 'C1')
                      }
                      className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                    >
                      <option value="A1">A1 — Beginner</option>
                      <option value="A2">A2 — Elementary</option>
                      <option value="B1">B1 — Intermediate (Pass Standard)</option>
                      <option value="B2">B2 — Upper Intermediate</option>
                      <option value="C1">C1 — Advanced Clinical</option>
                    </select>
                  </div>

                  {/* Outcome */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Outcome * {isPassing ? '(Auto-suggested Pass)' : '(Auto-suggested Did Not Pass)'}
                    </label>
                    <div className="flex items-center space-x-6 pt-1.5">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="outcome"
                          value="pass"
                          checked={outcome === 'pass'}
                          onChange={() => {
                            setOutcome('pass');
                            setIsOutcomeManuallyOverridden(true);
                          }}
                          className="text-[#10B981] focus:ring-[#10B981] w-4 h-4 cursor-pointer"
                        />
                        <span className="font-bold text-emerald-700 text-xs">Pass</span>
                      </label>

                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="outcome"
                          value="fail"
                          checked={outcome === 'fail'}
                          onChange={() => {
                            setOutcome('fail');
                            setIsOutcomeManuallyOverridden(true);
                          }}
                          className="text-rose-600 focus:ring-rose-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-bold text-rose-700 text-xs">Did Not Pass</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Mentor Notes (min 50 chars) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-semibold">
                      Mentor Notes * (min 50 chars)
                    </label>
                    <span
                      className={`text-[11px] font-semibold ${
                        mentorNotes.trim().length >= 50
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {mentorNotes.trim().length} / 50 characters min
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    required
                    value={mentorNotes}
                    onChange={(e) => setMentorNotes(e.target.value)}
                    placeholder="Describe overall performance, strengths, and areas to improve in detail..."
                    className="w-full p-2.5 border border-[#E2E8F4] rounded-[6px] bg-white text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                  {mentorNotes.trim().length < 50 && (
                    <p className="text-[11px] text-amber-600 mt-1 flex items-center">
                      <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />
                      Please enter at least {50 - mentorNotes.trim().length} more characters before submitting.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* STICKY BOTTOM RUNNING TOTAL & ACTIONS */}
        <div className="px-6 py-4 bg-[#F8FAFD] border-t border-[#E2E8F4] shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Running Total & Percentage */}
          <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-start">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Total Score
              </span>
              <span className="text-lg font-extrabold text-[#1B3270]">
                {totalScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
              </span>
            </div>

            <div className="h-8 w-px bg-[#E2E8F4]" />

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Percentage
              </span>
              <span
                className={`text-lg font-extrabold ${
                  isPassing ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {scorePct}%
              </span>
            </div>

            <div className="h-8 w-px bg-[#E2E8F4]" />

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Threshold: 60%
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                  isPassing
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {isPassing ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                    Passing
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 mr-1 text-rose-600" />
                    Did Not Pass
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-[6px] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || loadingCriteria || mentorNotes.trim().length < 50}
              className="px-5 py-2 text-xs font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] shadow-sm disabled:opacity-50 flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              <span>Submit for Review</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecordSpeakingTestModal;
