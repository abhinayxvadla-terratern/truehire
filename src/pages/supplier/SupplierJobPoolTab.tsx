import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Briefcase, Check, Users } from 'lucide-react';
import { SubmitCandidateModal } from './SubmitCandidateModal';

interface SupplierJobPoolTabProps {
  supplier: any;
  preSelectedCandidate?: any;
  onClearPreSelectedCandidate?: () => void;
}

export const SupplierJobPoolTab: React.FC<SupplierJobPoolTabProps> = ({
  supplier,
  preSelectedCandidate,
  onClearPreSelectedCandidate,
}) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [interviewReadyCandidates, setInterviewReadyCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchData = async () => {
    if (!supplier?.id) return;
    try {
      setLoading(true);

      // 1. Pull job_requirements where status = 'active'
      const { data: jobsData, error: jobsErr } = await supabase
        .from('job_requirements')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (jobsErr) console.error('Error fetching jobs:', jobsErr);
      else setJobs(jobsData || []);

      // 2. Pull interview ready candidates
      const { data: candsData, error: candsErr } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, target_role')
        .eq('supplier_id', supplier.id)
        .eq('status', 'interview_ready');

      if (candsErr) console.error('Error fetching interview ready candidates:', candsErr);
      else setInterviewReadyCandidates(candsData || []);
    } catch (err) {
      console.error('Error loading supplier job pool:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [supplier?.id]);

  const handleOpenSubmit = (job: any) => {
    setSelectedJob(job);
    setIsModalOpen(true);
  };

  const handleSubmissionSuccess = (candidateName?: string, jobTitle?: string) => {
    const msg =
      candidateName && jobTitle
        ? `${candidateName} submitted to ${jobTitle}.`
        : 'Candidate submitted successfully to employer pipeline!';
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
    fetchData();
    if (onClearPreSelectedCandidate) onClearPreSelectedCandidate();
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
      </div>
    );
  }

  const preSelectedCandidateName = preSelectedCandidate
    ? `${preSelectedCandidate.first_name || ''} ${preSelectedCandidate.last_name || ''}`.trim() ||
      `Candidate #${preSelectedCandidate.id?.substring(0, 6).toUpperCase()}`
    : '';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-[#1B3270]">
            Active Job Requirements ({jobs.length})
          </h3>
          <p className="text-xs text-[#94A3B8]">
            German healthcare listings available for verified candidate submission.
          </p>
        </div>

        {preSelectedCandidate && (
          <div className="text-xs bg-[#7EB3E8]/15 text-[#1B3270] px-3 py-1.5 rounded-[6px] border border-[#7EB3E8]/30 flex items-center space-x-1.5">
            <Users size={13} />
            <span>
              Pre-selected: <strong>{preSelectedCandidateName}</strong>
            </span>
          </div>
        )}
      </div>

      {toastMessage && (
        <div className="p-3 bg-[#10B981]/10 border border-[#10B981]/25 rounded-[6px] text-xs text-[#10B981] flex items-center space-x-2">
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-12 text-center shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-2">
          <Briefcase size={32} className="mx-auto text-[#94A3B8]" />
          <h4 className="text-base font-semibold text-[#1B3270]">
            No active job requirements at this time.
          </h4>
          <p className="text-xs text-[#94A3B8]">
            Employers post new nursing and clinical roles on a weekly basis.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => {
            const slotsRemaining = (job.submission_cap || 0) - (job.current_submissions || 0);
            const isCapReached = slotsRemaining <= 0;

            return (
              <div
                key={job.id}
                className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col justify-between hover:border-[#7EB3E8] transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-[14px] font-semibold text-[#1B3270] leading-snug">
                      {job.title}
                    </h4>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#7EB3E8]/20 text-[#2952A3] capitalize whitespace-nowrap">
                      {job.role_type}
                    </span>
                  </div>

                  <div className="flex items-center text-xs text-[#4A5568] mb-3">
                    <MapPin size={12} className="mr-1 text-[#94A3B8]" />
                    {job.location}
                  </div>

                  {job.description && (
                    <p className="text-xs text-[#4A5568] line-clamp-2 mb-4 leading-relaxed">
                      {job.description}
                    </p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-between">
                  <span className="text-xs text-[#94A3B8]">
                    Slots remaining: {slotsRemaining > 0 ? slotsRemaining : 0}
                  </span>

                  <button
                    type="button"
                    disabled={isCapReached}
                    onClick={() => handleOpenSubmit(job)}
                    className="py-1.5 px-4 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-medium rounded-[6px] transition-colors shadow-[0_1px_4px_rgba(27,50,112,0.08)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCapReached ? 'Cap Reached' : 'Submit Candidate'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Submit Candidate Modal */}
      {selectedJob && (
        <SubmitCandidateModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          job={selectedJob}
          interviewReadyCandidates={interviewReadyCandidates}
          supplierId={supplier.id}
          supplierCompany={supplier.company_name}
          preSelectedCandidateId={preSelectedCandidate?.id}
          onSuccess={handleSubmissionSuccess}
        />
      )}
    </div>
  );
};
