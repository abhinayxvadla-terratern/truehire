import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, CheckCircle2, AlertTriangle, Briefcase, Loader2, Sparkles } from 'lucide-react';

export interface CandidateOption {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  target_role?: string | null;
}

interface SubmitCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: any;
  interviewReadyCandidates: CandidateOption[];
  supplierId: string;
  supplierCompany?: string;
  preSelectedCandidateId?: string;
  onSuccess: (candidateName?: string, jobTitle?: string) => void;
}

export const SubmitCandidateModal: React.FC<SubmitCandidateModalProps> = ({
  isOpen,
  onClose,
  job,
  interviewReadyCandidates,
  supplierId,
  supplierCompany,
  preSelectedCandidateId,
  onSuccess,
}) => {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>(
    preSelectedCandidateId || interviewReadyCandidates[0]?.id || ''
  );
  const [fitScore, setFitScore] = useState<number | null>(null);
  const [loadingFitScore, setLoadingFitScore] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preSelectedCandidateId) {
      setSelectedCandidateId(preSelectedCandidateId);
    } else if (interviewReadyCandidates.length > 0 && !selectedCandidateId) {
      setSelectedCandidateId(interviewReadyCandidates[0].id);
    }
  }, [preSelectedCandidateId, interviewReadyCandidates]);

  // Compute fit score dynamically on candidate selection
  useEffect(() => {
    let isCancelled = false;

    const computeScore = async () => {
      if (!selectedCandidateId || !job?.id) {
        setFitScore(null);
        return;
      }

      try {
        setLoadingFitScore(true);
        const { data: score, error: rpcErr } = await supabase.rpc('compute_fit_score', {
          p_candidate_id: selectedCandidateId,
          p_job_id: job.id,
        });

        if (!isCancelled) {
          if (rpcErr || score === null || score === undefined) {
            setFitScore(0);
          } else {
            setFitScore(Number(score));
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Error computing fit score:', err);
          setFitScore(0);
        }
      } finally {
        if (!isCancelled) {
          setLoadingFitScore(false);
        }
      }
    };

    computeScore();

    return () => {
      isCancelled = true;
    };
  }, [selectedCandidateId, job?.id]);

  if (!isOpen || !job) return null;

  const selectedCandidate = interviewReadyCandidates.find(
    (c) => c.id === selectedCandidateId
  );

  const selectedCandidateName = selectedCandidate
    ? `${selectedCandidate.first_name || ''} ${selectedCandidate.last_name || ''}`.trim() || 'Candidate'
    : 'Candidate';

  const isRoleAligned =
    selectedCandidate &&
    job.role_type &&
    selectedCandidate.target_role?.trim().toLowerCase() === job.role_type.trim().toLowerCase();

  const slotsRemaining = (job.submission_cap || 0) - (job.current_submissions || 0);

  const getFitBadge = (score: number) => {
    if (score >= 80) {
      return {
        label: 'Strong match',
        color: 'text-[#10B981]',
        bg: 'bg-[#10B981]/10',
        border: 'border-[#10B981]/30',
      };
    }
    if (score >= 60) {
      return {
        label: 'Good match',
        color: 'text-[#D97706]',
        bg: 'bg-[#F59E0B]/10',
        border: 'border-[#F59E0B]/30',
      };
    }
    if (score >= 40) {
      return {
        label: 'Moderate match',
        color: 'text-[#D97706]',
        bg: 'bg-[#F59E0B]/10',
        border: 'border-[#F59E0B]/30',
      };
    }
    return {
      label: 'Low match — review before submitting',
      color: 'text-[#EF4444]',
      bg: 'bg-[#EF4444]/10',
      border: 'border-[#EF4444]/30',
    };
  };

  const badge = fitScore !== null ? getFitBadge(fitScore) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCandidateId) {
      setError('Select a candidate to submit.');
      return;
    }

    if (slotsRemaining <= 0) {
      setError('This requirement has reached its submission limit.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Check if candidate already has an active non-withdrawn submission
      const { data: existingApp } = await supabase
        .from('job_applications')
        .select('id, status')
        .eq('candidate_id', selectedCandidateId)
        .eq('job_id', job.id)
        .neq('status', 'withdrawn')
        .maybeSingle();

      if (existingApp) {
        setError('This candidate has already been submitted to this requirement.');
        setSubmitting(false);
        return;
      }

      const computedScore = fitScore ?? 0;

      // 1. Insert job_application
      const { error: insertErr } = await supabase.from('job_applications').insert({
        candidate_id: selectedCandidateId,
        job_id: job.id,
        supplier_id: supplierId,
        submitted_by: 'supplier',
        status: 'applied',
        fit_score: computedScore,
      });

      if (insertErr) throw insertErr;

      // 2. Increment current_submissions on job_requirements
      await supabase
        .from('job_requirements')
        .update({
          current_submissions: (job.current_submissions || 0) + 1,
        })
        .eq('id', job.id);

      // 3. Insert notification for Employer RM
      if (job.employer_id) {
        const { data: rmAssoc } = await supabase
          .from('rm_assignments')
          .select('rm_profile_id')
          .eq('entity_type', 'employer')
          .eq('entity_id', job.employer_id)
          .eq('active', true)
          .maybeSingle();

        if (rmAssoc?.rm_profile_id) {
          const anonymizedId = `Candidate #${selectedCandidateId.substring(0, 6).toUpperCase()}`;
          const companyName = supplierCompany || 'Partner Supplier';
          await supabase.from('notifications').insert({
            user_id: rmAssoc.rm_profile_id,
            title: 'New Candidate Submission',
            message: `New submission: ${anonymizedId} submitted by ${companyName} for ${job.title}. Fit Score: ${computedScore}/100.`,
            type: 'general',
            read: false,
          });
        }
      }

      onSuccess(selectedCandidateName, job.title);
      onClose();
    } catch (err: any) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to submit candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-xl max-w-lg w-full p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#1B3270]"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center space-x-2.5 mb-1">
          <div className="w-8 h-8 rounded-[6px] bg-[#7EB3E8]/20 flex items-center justify-center text-[#1B3270]">
            <Briefcase size={16} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#1B3270]">Submit Candidate</h3>
            <p className="text-xs text-[#94A3B8]">{job.title}</p>
          </div>
        </div>

        {/* Job Requirement Info */}
        <div className="my-4 p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <span className="text-[#94A3B8] block text-[11px]">Role Category</span>
            <span className="font-semibold text-[#2952A3] uppercase">{job.role_type}</span>
          </div>
          <div className="text-right space-y-0.5">
            <span className="text-[#94A3B8] block text-[11px]">Available Capacity</span>
            <span className={`font-semibold ${slotsRemaining > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {slotsRemaining > 0 ? `${slotsRemaining} slots remaining` : 'Cap reached'}
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-[6px] p-2.5">
            {error}
          </div>
        )}

        {interviewReadyCandidates.length === 0 ? (
          <div className="py-6 text-center space-y-2">
            <p className="text-xs text-[#4A5568]">
              You have no candidates with <strong>Interview Ready</strong> status.
            </p>
            <p className="text-[11px] text-[#94A3B8]">
              Only candidates who have passed all qualification gates can be submitted to jobs.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Candidate Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
                Select Candidate
              </label>
              <select
                value={selectedCandidateId}
                onChange={(e) => {
                  setSelectedCandidateId(e.target.value);
                  setError(null);
                }}
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F4] rounded-[6px] text-[#1B3270] font-medium outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
              >
                {interviewReadyCandidates.map((cand) => {
                  const fullName = `${cand.first_name || ''} ${cand.last_name || ''}`.trim() || 'Candidate';
                  return (
                    <option key={cand.id} value={cand.id}>
                      {fullName} — {cand.target_role || 'General'}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Fit Score & Alignment Card */}
            {selectedCandidate && (
              <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs text-[#1B3270] font-semibold">
                    <Sparkles size={14} className="text-[#2952A3]" />
                    <span>Real-Time Fit Analysis</span>
                  </div>
                  {loadingFitScore && (
                    <span className="text-[11px] text-[#94A3B8] flex items-center">
                      <Loader2 size={12} className="animate-spin mr-1" />
                      Calculating fit...
                    </span>
                  )}
                </div>

                {/* Score badge */}
                {!loadingFitScore && fitScore !== null && badge && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[#E2E8F4]">
                    <div>
                      <span className="text-xs text-[#4A5568]">Fit Score: </span>
                      <strong className="text-sm font-bold text-[#1B3270]">
                        {fitScore} / 100
                      </strong>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.border} ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                )}

                {/* Role Alignment Indicator */}
                <div className="pt-2 border-t border-[#E2E8F4] flex items-center justify-between text-xs">
                  <span className="text-[#94A3B8]">Role alignment:</span>
                  {isRoleAligned ? (
                    <span className="text-[#10B981] font-semibold flex items-center space-x-1">
                      <CheckCircle2 size={13} className="mr-1" />
                      Role aligned
                    </span>
                  ) : (
                    <span className="text-[#D97706] font-semibold flex items-center space-x-1">
                      <AlertTriangle size={13} className="mr-1" />
                      Role mismatch
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-[#4A5568] hover:text-[#1B3270]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || slotsRemaining <= 0 || loadingFitScore}
                className="px-5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors disabled:opacity-50 flex items-center space-x-1.5 shadow-2xs"
              >
                {submitting && <Loader2 size={13} className="animate-spin mr-1" />}
                <span>Confirm & Submit</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
