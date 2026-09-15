import React, { useState } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useAuth } from '../../../../../context/AuthContext';
import { notifyByRole } from '../../../../../utils/notificationRouting';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface FlagAtRiskModalProps {
  candidateId: string;
  candidateName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const FlagAtRiskModal: React.FC<FlagAtRiskModalProps> = ({
  candidateId,
  candidateName,
  onClose,
  onSuccess,
}) => {
  const { user, profile } = useAuth();
  const [concern, setConcern] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !concern.trim()) return;

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. INSERT internal_notes
      const { error: noteErr } = await supabase.from('internal_notes').insert({
        author_id: user.id,
        candidate_id: candidateId,
        note: concern.trim(),
        note_type: 'flag',
        is_escalation: true,
        resolved: false,
      });

      if (noteErr) throw noteErr;

      // 2. Notify Academic Lead(s)
      const mentorDisplayName =
        profile?.first_name && profile?.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : 'Mentor';

      await notifyByRole(
        supabase,
        'academic_lead',
        'At-risk flag raised',
        `Mentor ${mentorDisplayName} flagged ${candidateName}: ${concern.trim()}`,
        'academic',
        user.id
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error flagging candidate at risk:', err);
      setErrorMsg(err.message || 'Failed to raise flag');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F4] bg-rose-50/50">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h3 className="text-sm font-bold text-slate-800">
              Flag Candidate as At-Risk
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700">
              {errorMsg}
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-[#E2E8F4] rounded-[8px]">
            <span className="text-[11px] text-slate-400 block font-medium">Candidate</span>
            <span className="text-sm font-bold text-slate-800">{candidateName}</span>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Escalation Reason & Concern *
            </label>
            <textarea
              rows={4}
              required
              placeholder="Describe attendance irregularities, language barrier regression, clinical deficit, or motivation concerns..."
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              className="w-full p-2.5 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-rose-500 outline-none"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              This flag will appear prominently in the Academic Lead dashboard for priority review.
            </p>
          </div>

          <div className="flex items-center justify-end space-x-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !concern.trim()}
              className="px-4 py-1.5 font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] shadow-xs disabled:opacity-50 flex items-center"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
              Send Flag to Academic Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FlagAtRiskModal;
