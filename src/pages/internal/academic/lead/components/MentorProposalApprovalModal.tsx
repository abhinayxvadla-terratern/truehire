import React, { useState } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useAuth } from '../../../../../context/AuthContext';
import {
  X,
  Loader2,
  Check,
} from 'lucide-react';

export interface MentorProposalItem {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_role: string;
  candidate_language_level: string;
  candidate_user_id: string | null;
  verified_docs_count: number;
  pending_docs_count: number;
  proposed_mentor_id: string;
  proposed_mentor_name: string;
  proposed_mentor_workload: number;
  proposed_date: string;
  proposed_time: string;
  proposed_by_id: string;
  proposed_by_name: string;
  rm_notes: string | null;
  academic_request_id: string | null;
  schedule_id: string | null;
  created_at: string;
}

interface MentorProposalApprovalModalProps {
  proposal: MentorProposalItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const MentorProposalApprovalModal: React.FC<MentorProposalApprovalModalProps> = ({
  proposal,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [activeAction, setActiveAction] = useState<'approve' | 'reject' | null>(null);
  const [leadNotes, setLeadNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !proposal) return null;

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setProcessing(true);
      setErrorMsg(null);
      const now = new Date().toISOString();

      // 1. Update mentor_proposals
      const { error: propErr } = await supabase
        .from('mentor_proposals')
        .update({
          status: 'approved',
          approved_by: user.id,
          approval_notes: leadNotes.trim() || null,
          updated_at: now,
        })
        .eq('id', proposal.id);

      if (propErr) throw propErr;

      // 2. Update academic_requests
      if (proposal.academic_request_id) {
        const { error: reqErr } = await supabase
          .from('academic_requests')
          .update({
            assigned_mentor_id: proposal.proposed_mentor_id,
            status: 'assigned',
            approval_status: 'approved',
            approved_by: user.id,
            updated_at: now,
          })
          .eq('id', proposal.academic_request_id);

        if (reqErr) throw reqErr;
      } else {
        await supabase
          .from('academic_requests')
          .update({
            assigned_mentor_id: proposal.proposed_mentor_id,
            status: 'assigned',
            approval_status: 'approved',
            approved_by: user.id,
            updated_at: now,
          })
          .eq('candidate_id', proposal.candidate_id)
          .eq('request_type', 'speaking_test');
      }

      // 3. Update speaking_test_schedules
      const schedQuery = proposal.schedule_id
        ? supabase.from('speaking_test_schedules').update({
            status: 'approved',
            approved_by: user.id,
            updated_at: now,
          }).eq('id', proposal.schedule_id)
        : supabase.from('speaking_test_schedules').update({
            status: 'approved',
            approved_by: user.id,
            updated_at: now,
          }).eq('mentor_proposal_id', proposal.id);

      const { error: schedErr } = await schedQuery;
      if (schedErr) throw schedErr;

      // 4. Insert mentor_assignments
      const { error: assignErr } = await supabase.from('mentor_assignments').insert({
        mentor_id: proposal.proposed_mentor_id,
        candidate_id: proposal.candidate_id,
        assigned_by: user.id,
        active: true,
      });

      if (assignErr) throw assignErr;

      // 5. Notifications
      const notifs = [
        // Mentor notification
        {
          user_id: proposal.proposed_mentor_id,
          title: 'Speaking Test Assignment',
          message: `You are assigned to conduct ${proposal.candidate_name}'s Speaking Test on ${proposal.proposed_date} at ${proposal.proposed_time}.`,
          type: 'academic',
          read: false,
          sent_by: user.id,
        },
        // RM notification
        {
          user_id: proposal.proposed_by_id,
          title: 'Mentor Proposal Approved',
          message: `Your proposal for ${proposal.proposed_mentor_name} / ${proposal.candidate_name} on ${proposal.proposed_date} has been approved.`,
          type: 'academic',
          read: false,
          sent_by: user.id,
        },
      ];

      // Candidate notification
      if (proposal.candidate_user_id) {
        notifs.push({
          user_id: proposal.candidate_user_id,
          title: 'Speaking Test Scheduled',
          message: `Your Speaking Test is scheduled for ${proposal.proposed_date} at ${proposal.proposed_time}. Your mentor will be in touch.`,
          type: 'gate',
          read: false,
          sent_by: user.id,
        });
      }

      await supabase.from('notifications').insert(notifs);

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error approving proposal:', err);
      setErrorMsg(`Failed to approve proposal: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rejectReason.trim()) return;

    try {
      setProcessing(true);
      setErrorMsg(null);
      const now = new Date().toISOString();

      // 1. Update mentor_proposals
      const { error: propErr } = await supabase
        .from('mentor_proposals')
        .update({
          status: 'rejected',
          approved_by: user.id,
          approval_notes: rejectReason.trim(),
          updated_at: now,
        })
        .eq('id', proposal.id);

      if (propErr) throw propErr;

      // 2. Update academic_requests
      if (proposal.academic_request_id) {
        await supabase
          .from('academic_requests')
          .update({
            approval_status: 'rejected',
            approval_notes: rejectReason.trim(),
            updated_at: now,
          })
          .eq('id', proposal.academic_request_id);
      } else {
        await supabase
          .from('academic_requests')
          .update({
            approval_status: 'rejected',
            approval_notes: rejectReason.trim(),
            updated_at: now,
          })
          .eq('candidate_id', proposal.candidate_id)
          .eq('request_type', 'speaking_test');
      }

      // 3. Update speaking_test_schedules
      const schedQuery = proposal.schedule_id
        ? supabase.from('speaking_test_schedules').update({
            status: 'rejected',
            approval_notes: rejectReason.trim(),
            updated_at: now,
          }).eq('id', proposal.schedule_id)
        : supabase.from('speaking_test_schedules').update({
            status: 'rejected',
            approval_notes: rejectReason.trim(),
            updated_at: now,
          }).eq('mentor_proposal_id', proposal.id);

      await schedQuery;

      // 4. Notify RM
      await supabase.from('notifications').insert({
        user_id: proposal.proposed_by_id,
        title: 'Mentor Proposal Rejected',
        message: `Proposal rejected. Reason: ${rejectReason.trim()}. Submit a revised proposal.`,
        type: 'academic',
        read: false,
        sent_by: user.id,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error rejecting proposal:', err);
      setErrorMsg(`Failed to reject proposal: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#1B3270]">
              Review Mentor Proposal — Speaking Test
            </h3>
            <p className="text-xs text-slate-500">
              Submitted by RM {proposal.proposed_by_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-[6px]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-xs text-rose-800">
            {errorMsg}
          </div>
        )}

        {/* Candidate & Verification Summary */}
        <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-sm">
              {proposal.candidate_name}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
              {proposal.candidate_role || 'Healthcare Placement'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-slate-700">
            <div>
              <span className="text-slate-400">Language Level: </span>
              <span className="font-semibold">{proposal.candidate_language_level || 'Not specified'}</span>
            </div>
            <div>
              <span className="text-slate-400">Documents: </span>
              <span className="font-semibold text-emerald-700">
                {proposal.verified_docs_count} verified
              </span>
              {proposal.pending_docs_count > 0 && (
                <span className="text-slate-400">
                  {' '}({proposal.pending_docs_count} optional pending)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Proposal Details */}
        <div className="border border-[#E2E8F4] rounded-[8px] p-4 text-xs space-y-2.5">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
            Proposed Mentorship & Scheduling
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
            <div>
              <span className="text-slate-400">Proposed Mentor: </span>
              <span className="font-semibold text-slate-900">{proposal.proposed_mentor_name}</span>
              <span className="text-[11px] text-slate-500 ml-1">
                ({proposal.proposed_mentor_workload} active candidates)
              </span>
            </div>
            <div>
              <span className="text-slate-400">Proposed Slot: </span>
              <span className="font-semibold text-slate-900">
                {proposal.proposed_date} at {proposal.proposed_time}
              </span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-slate-400">Duration: </span>
              <span className="font-semibold">45 minutes</span>
            </div>
            {proposal.rm_notes && (
              <div className="sm:col-span-2 pt-1 border-t border-slate-100">
                <span className="text-slate-400 font-medium">RM Notes: </span>
                <p className="text-slate-700 mt-0.5 bg-slate-50 p-2 rounded border border-slate-200">
                  {proposal.rm_notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ACTION VIEWS */}
        {activeAction === 'approve' && (
          <form onSubmit={handleApprove} className="space-y-3 pt-2 border-t border-[#E2E8F4]">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Academic Notes for Mentor (Optional)
              </label>
              <textarea
                rows={2}
                value={leadNotes}
                onChange={(e) => setLeadNotes(e.target.value)}
                placeholder="Specific clinical scenarios or dialect notes to evaluate..."
                className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                disabled={processing}
                className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={processing}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Confirm & Approve Schedule</span>
              </button>
            </div>
          </form>
        )}

        {activeAction === 'reject' && (
          <form onSubmit={handleReject} className="space-y-3 pt-2 border-t border-[#E2E8F4]">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Mentor at capacity; Date/time clashes with hospital shift; Clinical track mismatch..."
                className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActiveAction(null)}
                disabled={processing}
                className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={processing || !rejectReason.trim()}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                <span>Confirm Rejection</span>
              </button>
            </div>
          </form>
        )}

        {/* DEFAULT ACTION BUTTONS */}
        {!activeAction && (
          <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F4]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveAction('reject')}
                className="px-3 py-1.5 border border-rose-600 hover:bg-rose-50 text-rose-700 rounded-[6px] text-xs font-semibold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveAction('approve')}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve Proposal</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
