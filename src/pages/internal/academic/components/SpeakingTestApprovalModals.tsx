import React, { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import { notifyByRole } from '../../../../utils/notificationRouting';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';

export interface SpeakingTestApproveModalProps {
  isOpen: boolean;
  candidateName: string;
  candidateUserId: string | null;
  candidateId: string;
  stResultId: string;
  mentorId: string;
  score: number;
  scorePct: number;
  languageLevel: string;
  overallOutcome: 'pass' | 'fail';
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const SpeakingTestApproveModal: React.FC<SpeakingTestApproveModalProps> = ({
  isOpen,
  candidateName,
  candidateUserId,
  candidateId,
  stResultId,
  mentorId,
  score,
  scorePct,
  languageLevel,
  overallOutcome,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPass = overallOutcome === 'pass';
  const trackName = isPass ? 'pass_track' : 'fail_track';
  const trackLabel = isPass ? 'Pass Track' : 'Support Track';

  const handleConfirmApprove = async () => {
    if (!user) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. UPDATE speaking_test_results
      const { error: stErr } = await supabase
        .from('speaking_test_results')
        .update({
          review_status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', stResultId);

      if (stErr) throw stErr;

      // 2. UPDATE gate_results (speaking_test)
      const { error: gateErr } = await supabase
        .from('gate_results')
        .update({
          status: overallOutcome,
          review_status: 'approved',
        })
        .eq('candidate_id', candidateId)
        .eq('gate_type', 'speaking_test');

      if (gateErr) console.warn('Note updating gate_results:', gateErr);

      // 3. UPDATE academic_requests
      await supabase
        .from('academic_requests')
        .update({
          status: 'completed',
          approval_status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('candidate_id', candidateId)
        .eq('request_type', 'speaking_test');

      // 4. UPDATE candidates.speaking_test_track
      const { error: candErr } = await supabase
        .from('candidates')
        .update({
          speaking_test_track: trackName,
        })
        .eq('id', candidateId);

      if (candErr) console.warn('Note updating candidates track:', candErr);

      // 5. OFFERINGS (parallel, non-blocking for fail outcome)
      if (!isPass) {
        const { data: stOfferings } = await supabase
          .from('offerings')
          .select('id')
          .eq('applicable_gate', 'speaking_test')
          .eq('is_active', true);

        if (stOfferings && stOfferings.length > 0) {
          const { data: existingOffs } = await supabase
            .from('candidate_offerings')
            .select('offering_id')
            .eq('candidate_id', candidateId);

          const existingIds = new Set((existingOffs || []).map((o) => o.offering_id));
          const newOfferings = stOfferings
            .filter((o) => !existingIds.has(o.id))
            .map((o) => ({
              candidate_id: candidateId,
              offering_id: o.id,
              gate_type_failed: 'speaking_test',
              status: 'recommended',
            }));

          if (newOfferings.length > 0) {
            await supabase.from('candidate_offerings').insert(newOfferings);
          }
        }
      }

      // 6. Notify candidate
      if (candidateUserId) {
        const candidateMsg = isPass
          ? `Your Speaking Test result is ready. You have been assessed at ${languageLevel} level. You will now be enrolled in the Interview Bootcamp.`
          : `Your Speaking Test result is ready. You will still be enrolled in the Interview Bootcamp. The Speaking Test is a diagnostic step — you move forward regardless. Training options are also available to support you.`;

        await supabase.from('notifications').insert({
          user_id: candidateUserId,
          title: 'Speaking Test Result Ready',
          message: candidateMsg,
          type: 'academic',
          sent_by: user.id,
        });
      }

      // 7. Notify RM
      const rmMessage = `Speaking Test approved for ${candidateName}. Outcome: ${
        isPass ? 'Pass' : 'Did Not Pass'
      }. Level: ${languageLevel}. Track: ${
        isPass ? 'pass track' : 'fail track'
      }. Create or assign a cohort.`;

      // Find requesting RM from academic_requests or speaking_test_schedules
      let requestingRmId: string | null = null;
      const { data: acReq } = await supabase
        .from('academic_requests')
        .select('requested_by')
        .eq('candidate_id', candidateId)
        .eq('request_type', 'speaking_test')
        .maybeSingle();

      if (acReq?.requested_by) {
        requestingRmId = acReq.requested_by;
      } else {
        const { data: sched } = await supabase
          .from('speaking_test_schedules')
          .select('proposed_by')
          .eq('candidate_id', candidateId)
          .maybeSingle();
        if (sched?.proposed_by) requestingRmId = sched.proposed_by;
      }

      if (requestingRmId) {
        await supabase.from('notifications').insert({
          user_id: requestingRmId,
          title: 'Speaking Test Approved',
          message: rmMessage,
          type: 'academic',
          sent_by: user.id,
        });
      } else {
        await notifyByRole(
          supabase,
          'candidate_supplier_rm',
          'Speaking Test Approved',
          rmMessage,
          'academic',
          user.id
        );
      }

      // 8. Notify Mentor
      if (mentorId) {
        await supabase.from('notifications').insert({
          user_id: mentorId,
          title: 'Speaking Test Result Approved',
          message: `Result approved for ${candidateName}. Outcome: ${
            isPass ? 'Pass' : 'Did Not Pass'
          }.`,
          type: 'academic',
          sent_by: user.id,
        });
      }

      onSuccess(
        `Speaking Test result for ${candidateName} successfully approved (${isPass ? 'Pass' : 'Did Not Pass'}).`
      );
      onClose();
    } catch (err: any) {
      console.error('Error approving speaking test result:', err);
      setErrorMsg(err.message || 'Failed to approve result.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2
              className={`w-5 h-5 ${isPass ? 'text-emerald-600' : 'text-amber-600'}`}
            />
            <h3 className="text-sm font-bold text-slate-800">
              Confirm Speaking Test Approval
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <p className="text-slate-700 font-semibold text-sm">
            Confirm {isPass ? 'Pass' : 'Did Not Pass'} for {candidateName}?
          </p>

          <div className="p-3.5 bg-slate-50 border border-[#E2E8F4] rounded-[8px] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Evaluation Score:</span>
              <span className="font-bold text-slate-900">
                {score} / 100 ({scorePct}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Determined Language Level:</span>
              <span className="font-bold text-[#1B3270]">{languageLevel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Assigned Cohort Track:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  isPass
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {trackLabel}
              </span>
            </div>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-[8px] text-blue-900 space-y-1">
            <span className="font-bold flex items-center">
              <Sparkles className="w-3.5 h-3.5 mr-1 text-[#2952A3]" />
              Diagnostic Progression Note
            </span>
            <p className="text-[11px] leading-relaxed text-blue-800">
              The Speaking Test is diagnostic — the candidate proceeds directly to the
              Interview Bootcamp regardless of outcome.{' '}
              {!isPass &&
                'Targeted clinical speaking offerings will be recommended in their Academy portal.'}
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px] font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleConfirmApprove}
              className={`px-4 py-1.5 font-semibold text-white rounded-[6px] shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 ${
                isPass
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              <span>Confirm &amp; Approve</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface SpeakingTestClarifyModalProps {
  isOpen: boolean;
  candidateName: string;
  candidateId: string;
  stResultId: string;
  mentorId: string;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const SpeakingTestClarifyModal: React.FC<SpeakingTestClarifyModalProps> = ({
  isOpen,
  candidateName,
  candidateId,
  stResultId,
  mentorId,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmitClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !question.trim()) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. UPDATE speaking_test_results
      const { error: stErr } = await supabase
        .from('speaking_test_results')
        .update({
          review_status: 'queried',
          reviewer_notes: question.trim(),
        })
        .eq('id', stResultId);

      if (stErr) throw stErr;

      // 2. UPDATE gate_results
      await supabase
        .from('gate_results')
        .update({
          review_status: 'queried',
        })
        .eq('candidate_id', candidateId)
        .eq('gate_type', 'speaking_test');

      // 3. Notify Mentor
      if (mentorId) {
        await supabase.from('notifications').insert({
          user_id: mentorId,
          title: 'Speaking Test Clarification Requested',
          message: `Clarification requested for ${candidateName}: ${question.trim()}`,
          type: 'academic',
          sent_by: user.id,
        });
      }

      onSuccess(`Clarification requested from mentor for ${candidateName}.`);
      onClose();
    } catch (err: any) {
      console.error('Error requesting clarification:', err);
      setErrorMsg(err.message || 'Failed to request clarification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <HelpCircle className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Request Clarification from Mentor
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmitClarification} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              What clarification is needed for {candidateName}? *
            </label>
            <textarea
              rows={4}
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Clarify grammar assessment justification or provide details on patient simulation response..."
              className="w-full p-2.5 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px] font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !question.trim()}
              className="px-4 py-1.5 font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] shadow-xs flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
              <span>Send Clarification Query</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
