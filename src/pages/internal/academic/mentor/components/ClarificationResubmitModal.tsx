import React, { useState } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useAuth } from '../../../../../context/AuthContext';
import { notifyByRole } from '../../../../../utils/notificationRouting';
import {
  X,
  HelpCircle,
  AlertCircle,
  Loader2,
  FileText,
  Send,
} from 'lucide-react';

interface ClarificationResubmitModalProps {
  candidateId: string;
  candidateName: string;
  speakingTestResultId: string;
  reviewerNotes: string | null;
  currentMentorNotes: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ClarificationResubmitModal: React.FC<ClarificationResubmitModalProps> = ({
  candidateId,
  candidateName,
  speakingTestResultId,
  reviewerNotes,
  currentMentorNotes,
  onClose,
  onSuccess,
}) => {
  const { user, profile } = useAuth();
  const [clarificationNotes, setClarificationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!clarificationNotes.trim()) {
      setErrorMsg('Enter clarification response before resubmitting.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const timestamp = new Date().toLocaleString();
      const updatedNotes = currentMentorNotes
        ? `${currentMentorNotes}\n\n[Clarification - ${timestamp}]:\n${clarificationNotes.trim()}`
        : `[Clarification - ${timestamp}]:\n${clarificationNotes.trim()}`;

      // 1. Update speaking_test_results
      const { error: stErr } = await supabase
        .from('speaking_test_results')
        .update({
          review_status: 'pending',
          mentor_notes: updatedNotes,
        })
        .eq('id', speakingTestResultId);

      if (stErr) throw stErr;

      // 2. Update gate_results
      await supabase
        .from('gate_results')
        .update({
          review_status: 'pending',
          notes: updatedNotes,
        })
        .eq('candidate_id', candidateId)
        .eq('gate_type', 'speaking_test');

      // 3. Notify Academic Lead
      const mentorDisplayName =
        profile?.first_name && profile?.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : 'Mentor';

      await notifyByRole(
        supabase,
        'academic_lead',
        'Speaking Test Clarification Resubmitted',
        `Mentor ${mentorDisplayName} submitted clarification response for ${candidateName}. Review result.`,
        'academic',
        user.id
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error resubmitting clarification:', err);
      setErrorMsg(err.message || 'Failed to resubmit clarification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Clarification Response — {candidateName}
              </h3>
              <p className="text-xs text-slate-500">
                Address Academic Lead query and resubmit evaluation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <form onSubmit={handleResubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Academic Lead Query Box */}
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-[8px] space-y-1">
            <span className="text-[11px] font-bold text-amber-900 block flex items-center">
              <HelpCircle className="w-3.5 h-3.5 mr-1 text-amber-700 shrink-0" />
              Academic Lead Query:
            </span>
            <p className="text-amber-950 font-medium leading-relaxed whitespace-pre-wrap pl-4">
              {reviewerNotes || 'Provide further justification or clarify criterion scoring.'}
            </p>
          </div>

          {/* Original Mentor Notes Preview */}
          {currentMentorNotes && (
            <div className="p-3 bg-slate-50 border border-[#E2E8F4] rounded-[8px] space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 block flex items-center">
                <FileText className="w-3.5 h-3.5 mr-1 text-slate-400" />
                Previously Submitted Mentor Notes:
              </span>
              <p className="text-slate-700 whitespace-pre-wrap max-h-32 overflow-y-auto leading-relaxed pl-4">
                {currentMentorNotes}
              </p>
            </div>
          )}

          {/* Additional Clarification Notes */}
          <div>
            <label className="block text-slate-800 font-bold mb-1">
              Additional Clarification / Notes *
            </label>
            <textarea
              rows={4}
              required
              value={clarificationNotes}
              onChange={(e) => setClarificationNotes(e.target.value)}
              placeholder="Provide requested details, context on pronunciation, grammar, or audio timestamps..."
              className="w-full p-2.5 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              These notes will be appended to your evaluation summary and sent back to the Academic Lead for final review.
            </p>
          </div>

          {/* FOOTER ACTIONS */}
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
              disabled={submitting || !clarificationNotes.trim()}
              className="px-4 py-1.5 font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1" />
              )}
              <span>Resubmit for Review</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClarificationResubmitModal;
