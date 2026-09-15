import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useAuth } from '../../../../../context/AuthContext';
import { notifyByRole } from '../../../../../utils/notificationRouting';
import { X, ClipboardCheck, AlertCircle, Loader2, Lock, History } from 'lucide-react';

interface RecordAssessmentModalProps {
  candidateId: string;
  candidateName: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface AttemptItem {
  attempt_number: number;
  created_at: string;
  score: number;
  outcome: string;
}

export const RecordAssessmentModal: React.FC<RecordAssessmentModalProps> = ({
  candidateId,
  candidateName,
  onClose,
  onSuccess,
}) => {
  const { user, profile } = useAuth();
  const [score, setScore] = useState('75');
  const [passFail, setPassFail] = useState<'pass' | 'fail'>('pass');
  const [notes, setNotes] = useState('');

  // Candidate state & history
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [consecutiveFails, setConsecutiveFails] = useState(0);
  const [cohortId, setCohortId] = useState<string | null>(null);
  const [attemptsHistory, setAttemptsHistory] = useState<AttemptItem[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchCandidateData = async () => {
      try {
        setLoadingInitial(true);

        const [candRes, histRes, cmRes] = await Promise.all([
          supabase
            .from('candidates')
            .select('final_test_locked, consecutive_final_test_fails')
            .eq('id', candidateId)
            .maybeSingle(),
          supabase
            .from('final_test_attempts')
            .select('attempt_number, created_at, score, outcome')
            .eq('candidate_id', candidateId)
            .order('attempt_number', { ascending: true }),
          supabase
            .from('cohort_members')
            .select('cohort_id')
            .eq('candidate_id', candidateId)
            .maybeSingle(),
        ]);

        if (candRes.data) {
          setIsLocked(Boolean(candRes.data.final_test_locked));
          setConsecutiveFails(candRes.data.consecutive_final_test_fails || 0);
        }

        setAttemptsHistory(histRes.data || []);
        if (cmRes.data?.cohort_id) {
          setCohortId(cmRes.data.cohort_id);
        }
      } catch (err) {
        console.error('Error loading candidate assessment data:', err);
      } finally {
        setLoadingInitial(false);
      }
    };

    fetchCandidateData();
  }, [candidateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isLocked) return;

    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 100) {
      setErrorMsg('Enter a valid assessment score between 0 and 100.');
      return;
    }

    if (!notes.trim()) {
      setErrorMsg('Assessment notes are required to document evaluation criteria.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const nextAttemptNumber = attemptsHistory.length + 1;
      const newConsecutiveFails = passFail === 'fail' ? consecutiveFails + 1 : 0;

      // 1. INSERT final_test_attempts
      const { error: ftErr } = await supabase.from('final_test_attempts').insert({
        candidate_id: candidateId,
        cohort_id: cohortId,
        mentor_id: user.id,
        attempt_number: nextAttemptNumber,
        score: numScore,
        score_pct: numScore,
        max_score: 100,
        pass_threshold_pct: 60,
        outcome: passFail,
        mentor_notes: notes.trim(),
        review_status: 'pending',
        consecutive_fail_count: newConsecutiveFails,
      });

      if (ftErr) throw ftErr;

      // 2. INSERT gate_results
      const { error: gateErr } = await supabase.from('gate_results').insert({
        candidate_id: candidateId,
        gate_type: 'assessment',
        status: passFail,
        score: numScore,
        notes: notes.trim(),
        recorded_by: user.id,
        review_status: 'pending',
      });

      if (gateErr) throw gateErr;

      // 3. INSERT internal_notes
      await supabase.from('internal_notes').insert({
        author_id: user.id,
        candidate_id: candidateId,
        note: `[Assessment Evaluation — Attempt #${nextAttemptNumber}] Score: ${numScore}/100 (${passFail.toUpperCase()})\n\n${notes.trim()}`,
        note_type: 'session',
        is_escalation: false,
        resolved: false,
      });

      // 4. Notify Academic Lead(s)
      const mentorDisplayName =
        profile?.first_name && profile?.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : 'Mentor';

      await notifyByRole(
        supabase,
        'academic_lead',
        'Assessment Result Recorded',
        `Final assessment result (Attempt #${nextAttemptNumber}: ${passFail.toUpperCase()}, ${numScore} pts) recorded for ${candidateName} by ${mentorDisplayName}. Review result.`,
        'academic',
        user.id
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error recording assessment:', err);
      setErrorMsg(err.message || 'Failed to record assessment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD]">
          <div className="flex items-center space-x-2">
            <ClipboardCheck className="w-4 h-4 text-purple-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Record Final Assessment Result
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadingInitial ? (
          <div className="p-12 text-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#1B3270] mb-2" />
            <p className="text-xs">Loading candidate assessment record...</p>
          </div>
        ) : isLocked ? (
          <div className="p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mx-auto text-rose-600">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900">Final Assessment Locked</h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                Candidate {candidateName} has reached 3 consecutive assessment attempts. Further testing is locked pending formal remedial training and RM intervention.
              </p>
            </div>

            {attemptsHistory.length > 0 && (
              <div className="bg-slate-50 border border-[#E2E8F4] rounded-[8px] p-3 text-left">
                <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 mb-2">
                  <History className="w-3.5 h-3.5 text-slate-500" />
                  <span>Attempt History</span>
                </div>
                <div className="space-y-1.5">
                  {attemptsHistory.map((att) => (
                    <div
                      key={att.attempt_number}
                      className="flex items-center justify-between p-2 bg-white rounded border border-[#E2E8F4] text-xs"
                    >
                      <span className="font-medium text-slate-700">
                        Attempt #{att.attempt_number}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">{att.score} pts</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            att.outcome === 'pass'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {att.outcome.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-[6px] text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-[#E2E8F4] rounded-[8px]">
              <span className="text-[11px] text-slate-400 block font-medium">Candidate</span>
              <span className="text-sm font-bold text-slate-800">{candidateName}</span>
            </div>

            {attemptsHistory.length > 0 && (
              <div className="bg-slate-50 border border-[#E2E8F4] rounded-[8px] p-3 text-left">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
                  <div className="flex items-center space-x-1.5">
                    <History className="w-3.5 h-3.5 text-slate-500" />
                    <span>Prior Attempts ({attemptsHistory.length})</span>
                  </div>
                  {consecutiveFails > 0 && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                      Consecutive Fails: {consecutiveFails}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {attemptsHistory.map((att) => (
                    <div
                      key={att.attempt_number}
                      className="flex items-center justify-between p-1.5 bg-white rounded border border-[#E2E8F4] text-[11px]"
                    >
                      <span className="font-medium text-slate-700">
                        Attempt #{att.attempt_number}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-500">{att.score} pts</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-semibold ${
                            att.outcome === 'pass'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {att.outcome.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Score (0 - 100) *
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  placeholder="e.g. 85"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Determination *
                </label>
                <div className="flex items-center space-x-4 pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="assessmentPassFail"
                      value="pass"
                      checked={passFail === 'pass'}
                      onChange={() => setPassFail('pass')}
                      className="text-[#1B3270] focus:ring-[#1B3270]"
                    />
                    <span className="font-semibold text-emerald-700">Pass</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="assessmentPassFail"
                      value="fail"
                      checked={passFail === 'fail'}
                      onChange={() => setPassFail('fail')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="font-semibold text-rose-700">Fail</span>
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Assessment Evaluation Notes *
              </label>
              <textarea
                rows={4}
                required
                placeholder="Detail the clinical case scenarios tested, Fachsprache proficiency, patient handling terminology, and exit readiness..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] shadow-xs disabled:opacity-50 flex items-center"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Submit Assessment for Review
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default RecordAssessmentModal;
