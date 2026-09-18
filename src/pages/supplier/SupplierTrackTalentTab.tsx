import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Award,
  Briefcase,
  AlertTriangle,
  CheckCircle2,
  X,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { EmptyState } from '../../components/ui/EmptyState';
import { getApplicationStatusLabel } from '../../utils/labels';
import { MultiSelectFilter } from '../../components/ui/MultiSelectFilter';
import { SupplierCandidateDetailPanel } from './components/SupplierCandidateDetailPanel';

interface SupplierTrackTalentTabProps {
  supplier: any;
  onNavigateTab: (tab: string) => void;
}

interface ActiveCandidate {
  id: string;
  first_name: string;
  last_name: string;
  target_role?: string | null;
  language_level_self_reported?: string | null;
  user_id?: string | null;
  application?: {
    id: string;
    job_id: string;
    status: string;
    fit_score?: number | null;
    created_at: string;
    job_title: string;
    job_location?: string;
    submission_cap: number;
    current_submissions: number;
    role_type?: string;
    employer_id?: string;
  } | null;
}

export const SupplierTrackTalentTab: React.FC<SupplierTrackTalentTabProps> = ({
  supplier,
  onNavigateTab,
}) => {
  const [candidates, setCandidates] = useState<ActiveCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    candidates.forEach((c) => {
      if (c.target_role) set.add(c.target_role);
    });
    return Array.from(set)
      .sort()
      .map((r) => ({ value: r, label: r.replace('_', ' ') }));
  }, [candidates]);

  const statusOptions = useMemo(
    () => [
      { value: 'unsubmitted', label: 'Not Submitted' },
      { value: 'applied', label: 'Applied' },
      { value: 'shortlisted', label: 'Shortlisted' },
      { value: 'interview_scheduled', label: 'Interview Scheduled' },
      { value: 'interviewed', label: 'Interviewed' },
      { value: 'selected', label: 'Selected' },
      { value: 'offer_sent', label: 'Offer Sent' },
      { value: 'placed', label: 'Placed' },
      { value: 'rejected', label: 'Rejected' },
    ],
    []
  );

  const filteredCandidates = useMemo(() => {
    return candidates.filter((cand) => {
      if (roleFilters.length > 0 && (!cand.target_role || !roleFilters.includes(cand.target_role))) {
        return false;
      }
      const appStatus = cand.application?.status || 'unsubmitted';
      if (statusFilters.length > 0 && !statusFilters.includes(appStatus)) {
        return false;
      }
      return true;
    });
  }, [candidates, roleFilters, statusFilters]);

  // Submit to Requirement Modal State
  const [submitModalCandidate, setSubmitModalCandidate] = useState<ActiveCandidate | null>(null);
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobFitScores, setJobFitScores] = useState<Record<string, number>>({});
  const [selectedJobToSubmit, setSelectedJobToSubmit] = useState<any | null>(null);
  const [submittingToJob, setSubmittingToJob] = useState(false);
  const [selectedCandidateForDetail, setSelectedCandidateForDetail] = useState<ActiveCandidate | null>(null);

  // Withdrawal Modal State
  const [withdrawModalData, setWithdrawModalData] = useState<{
    candidate: ActiveCandidate;
    application: NonNullable<ActiveCandidate['application']>;
  } | null>(null);
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchTrackData = async () => {
    if (!supplier?.id) return;
    try {
      setLoading(true);

      // 1. Pull candidates where supplier_id = current supplier AND status = 'interview_ready'
      const { data: cands, error: candsErr } = await supabase
        .from('candidates')
        .select('*')
        .eq('supplier_id', supplier.id)
        .eq('status', 'interview_ready')
        .order('created_at', { ascending: false });

      if (candsErr) {
        console.error('Error fetching interview ready candidates:', candsErr);
        setCandidates([]);
        return;
      }

      const candList = cands || [];

      if (candList.length > 0) {
        const candIds = candList.map((c) => c.id);

        // Fetch job_applications for these candidates
        const { data: apps, error: appsErr } = await supabase
          .from('job_applications')
          .select(`
            id,
            candidate_id,
            job_id,
            status,
            fit_score,
            created_at,
            job_requirements (
              id,
              title,
              location,
              role_type,
              submission_cap,
              current_submissions,
              employer_id
            )
          `)
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        if (appsErr) console.error('Error fetching candidate applications:', appsErr);

        // Group applications by candidate
        const appsByCand: Record<string, any[]> = {};
        (apps || []).forEach((app) => {
          if (!appsByCand[app.candidate_id]) appsByCand[app.candidate_id] = [];
          appsByCand[app.candidate_id].push(app);
        });

        // Enrich candidates with their latest application
        const enriched: ActiveCandidate[] = [];

        candList.forEach((cand) => {
          const candApps = appsByCand[cand.id] || [];

          // If placed, exclude from Active Pipeline (moved to Placements tab)
          const isPlaced = candApps.some((a) => a.status === 'placed');
          if (isPlaced) return;

          // Find latest non-withdrawn application, or the latest application
          const activeOrLatestApp =
            candApps.find((a) => a.status !== 'withdrawn') || candApps[0] || null;

          let appData: ActiveCandidate['application'] = null;
          if (activeOrLatestApp && activeOrLatestApp.job_requirements) {
            const jr = activeOrLatestApp.job_requirements;
            appData = {
              id: activeOrLatestApp.id,
              job_id: activeOrLatestApp.job_id,
              status: activeOrLatestApp.status,
              fit_score: activeOrLatestApp.fit_score,
              created_at: activeOrLatestApp.created_at,
              job_title: jr.title,
              job_location: jr.location,
              submission_cap: jr.submission_cap,
              current_submissions: jr.current_submissions,
              role_type: jr.role_type,
              employer_id: jr.employer_id,
            };
          }

          enriched.push({
            id: cand.id,
            first_name: cand.first_name || '',
            last_name: cand.last_name || '',
            target_role: cand.target_role,
            language_level_self_reported: cand.language_level_self_reported,
            user_id: cand.user_id,
            application: appData,
          });
        });

        setCandidates(enriched);
      } else {
        setCandidates([]);
      }
    } catch (err) {
      console.error('Error in fetchTrackData:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrackData();
  }, [supplier?.id]);

  // ----------------------------------------------------
  // JOB SELECTION MODAL LOGIC
  // ----------------------------------------------------
  const handleOpenSubmitModal = async (candidate: ActiveCandidate) => {
    setSubmitModalCandidate(candidate);
    setSelectedJobToSubmit(null);
    setJobFitScores({});
    try {
      setLoadingJobs(true);

      // Pull active job requirements
      const { data: jobs, error: jobsErr } = await supabase
        .from('job_requirements')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (jobsErr) throw jobsErr;

      // If candidate was previously rejected for a specific job, filter that job out
      const rejectedJobId =
        candidate.application?.status === 'rejected' ? candidate.application.job_id : null;

      const filteredJobs = (jobs || []).filter((j) => j.id !== rejectedJobId);
      setActiveJobs(filteredJobs);

      // Compute fit scores for each job asynchronously
      const scoresMap: Record<string, number> = {};
      await Promise.all(
        filteredJobs.map(async (j) => {
          try {
            const { data: score, error: scoreErr } = await supabase.rpc('compute_fit_score', {
              p_candidate_id: candidate.id,
              p_job_id: j.id,
            });
            scoresMap[j.id] = scoreErr || score === null ? 0 : Number(score);
          } catch {
            scoresMap[j.id] = 0;
          }
        })
      );
      setJobFitScores(scoresMap);
    } catch (err: any) {
      console.error('Error loading jobs for submission:', err);
      showToast('Failed to load active requirements.', 'error');
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleConfirmSubmit = async () => {
    if (!submitModalCandidate || !selectedJobToSubmit || !supplier?.id) return;

    const remaining = selectedJobToSubmit.submission_cap - selectedJobToSubmit.current_submissions;
    if (remaining <= 0) {
      showToast('This requirement has reached its submission limit.', 'error');
      return;
    }

    try {
      setSubmittingToJob(true);
      const computedScore = jobFitScores[selectedJobToSubmit.id] || 0;

      // 1. Insert job_application
      const { error: insertErr } = await supabase.from('job_applications').insert({
        candidate_id: submitModalCandidate.id,
        job_id: selectedJobToSubmit.id,
        supplier_id: supplier.id,
        submitted_by: 'supplier',
        status: 'applied',
        fit_score: computedScore,
      });

      if (insertErr) throw insertErr;

      // 2. Increment current_submissions on job_requirements
      await supabase
        .from('job_requirements')
        .update({
          current_submissions: (selectedJobToSubmit.current_submissions || 0) + 1,
        })
        .eq('id', selectedJobToSubmit.id);

      // 3. Insert notification for Employer RM
      const anonymizedId = `Candidate #${submitModalCandidate.id.substring(0, 6).toUpperCase()}`;
      const companyName = supplier.company_name || 'Partner Supplier';

      // Find employer RM
      if (selectedJobToSubmit.employer_id) {
        const { data: rmAssoc } = await supabase
          .from('rm_assignments')
          .select('rm_profile_id')
          .eq('entity_type', 'employer')
          .eq('entity_id', selectedJobToSubmit.employer_id)
          .eq('active', true)
          .maybeSingle();

        if (rmAssoc?.rm_profile_id) {
          await supabase.from('notifications').insert({
            user_id: rmAssoc.rm_profile_id,
            title: 'New Candidate Submission',
            message: `New submission: ${anonymizedId} submitted by ${companyName} for ${selectedJobToSubmit.title}. Fit Score: ${computedScore}/100.`,
            type: 'general',
            read: false,
          });
        }
      }

      const fullName = `${submitModalCandidate.first_name} ${submitModalCandidate.last_name}`.trim();
      showToast(`${fullName} submitted to ${selectedJobToSubmit.title}.`);
      setSubmitModalCandidate(null);
      setSelectedJobToSubmit(null);
      await fetchTrackData();
    } catch (err: any) {
      console.error('Error submitting candidate to job:', err);
      showToast(err.message || 'Failed to submit candidate.', 'error');
    } finally {
      setSubmittingToJob(false);
    }
  };

  // ----------------------------------------------------
  // WITHDRAWAL FLOW LOGIC
  // ----------------------------------------------------
  const handleOpenWithdrawModal = (
    candidate: ActiveCandidate,
    application: NonNullable<ActiveCandidate['application']>
  ) => {
    // Defensive check
    if (
      [
        'interview_scheduled',
        'interviewed',
        'selected',
        'offer_sent',
        'reveal_gate',
        'placed',
      ].includes(application.status)
    ) {
      showToast(
        'This candidate is too far in the process to withdraw. Contact your account manager for assistance.',
        'error'
      );
      return;
    }

    setWithdrawModalData({ candidate, application });
    setWithdrawalReason('');
  };

  const handleConfirmWithdrawal = async () => {
    if (!withdrawModalData || !supplier?.id) return;

    const { candidate, application } = withdrawModalData;

    try {
      setWithdrawing(true);

      // 1. UPDATE job_applications: status = 'withdrawn', withdrawal_reason, withdrawn_at
      const { error: updateAppErr } = await supabase
        .from('job_applications')
        .update({
          status: 'withdrawn',
          withdrawal_reason: withdrawalReason.trim() || null,
          withdrawn_at: new Date().toISOString(),
        })
        .eq('id', application.id);

      if (updateAppErr) throw updateAppErr;

      // 2. UPDATE job_requirements: current_submissions - 1
      const newCount = Math.max(0, (application.current_submissions || 1) - 1);
      await supabase
        .from('job_requirements')
        .update({ current_submissions: newCount })
        .eq('id', application.job_id);

      // 3. Notify Employer RM
      const anonymizedId = `Candidate #${candidate.id.substring(0, 6).toUpperCase()}`;
      if (application.employer_id) {
        const { data: rmAssoc } = await supabase
          .from('rm_assignments')
          .select('rm_profile_id')
          .eq('entity_type', 'employer')
          .eq('entity_id', application.employer_id)
          .eq('active', true)
          .maybeSingle();

        if (rmAssoc?.rm_profile_id) {
          await supabase.from('notifications').insert({
            user_id: rmAssoc.rm_profile_id,
            title: 'Candidate Application Withdrawn',
            message: `Supplier has withdrawn candidate ${anonymizedId} from ${application.job_title}. Reason: ${
              withdrawalReason.trim() || 'Not provided'
            }.`,
            type: 'general',
            read: false,
          });
        }
      }

      // 4. Notify candidate if user_id exists
      if (candidate.user_id) {
        await supabase.from('notifications').insert({
          user_id: candidate.user_id,
          title: 'Application Withdrawn',
          message: `Your submission to ${application.job_title} has been withdrawn by your supplier.`,
          type: 'general',
          read: false,
        });
      }

      showToast('Submission withdrawn.');
      setWithdrawModalData(null);
      await fetchTrackData();
    } catch (err: any) {
      console.error('Error withdrawing submission:', err);
      showToast(err.message || 'Failed to withdraw submission.', 'error');
    } finally {
      setWithdrawing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150 pb-12">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-[8px] text-xs font-medium shadow-lg transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-[#1B3270]">
            Active Pipeline ({candidates.length})
          </h3>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Monitor and submit your Interview Ready candidates to active German healthcare requirements.
          </p>
        </div>
      </div>

      {/* Empty State */}
      {candidates.length === 0 ? (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs">
          <EmptyState
            title="No Interview Ready candidates in pipeline"
            subtitle="Candidates unlock Interview Ready status after passing all diagnostic gates and assessments."
            icon={Award}
            actionLabel="Track qualification progress in Candidates →"
            onAction={() => onNavigateTab('post_talent')}
          />
        </div>
      ) : (
        <>
          {/* Filters Bar */}
          <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3 shadow-2xs flex flex-wrap items-center gap-3">
            {roleOptions.length > 0 && (
              <div className="w-full sm:w-48">
                <MultiSelectFilter
                  label="Role"
                  options={roleOptions}
                  selectedValues={roleFilters}
                  onChange={setRoleFilters}
                />
              </div>
            )}
            <div className="w-full sm:w-56">
              <MultiSelectFilter
                label="Application Status"
                options={statusOptions}
                selectedValues={statusFilters}
                onChange={setStatusFilters}
              />
            </div>
            <span className="text-xs text-slate-400 ml-auto font-medium">
              Showing {filteredCandidates.length} of {candidates.length} candidate{candidates.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Candidates Table */}
          <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F4] bg-[#F8FAFD] text-[#94A3B8]">
                    <th className="py-3 px-4 font-semibold">Name</th>
                    <th className="py-3 px-3 font-semibold">Role</th>
                    <th className="py-3 px-3 font-semibold">Language</th>
                    <th className="py-3 px-3 font-semibold">Applied To</th>
                    <th className="py-3 px-3 font-semibold">Application Status</th>
                    <th className="py-3 px-3 font-semibold">Fit Score</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-[#0F172A]">
                  {filteredCandidates.map((cand) => {
                    const app = cand.application;
                    const fullName = `${cand.first_name} ${cand.last_name}`.trim() || 'Candidate';

                  // Row State Determination
                  const isSubmitted = !!app && app.status !== 'withdrawn';
                  const isRejected = app?.status === 'rejected';
                  const isInterviewOrBeyond =
                    isSubmitted &&
                    [
                      'interview_scheduled',
                      'interviewed',
                      'selected',
                      'offer_sent',
                      'reveal_gate',
                    ].includes(app.status);
                  const isWithdrawable =
                    isSubmitted && ['applied', 'shortlisted'].includes(app.status);

                  return (
                    <tr
                      key={cand.id}
                      className={`transition-colors ${
                        isInterviewOrBeyond
                          ? 'bg-amber-50/40 hover:bg-amber-50/70 border-l-4 border-l-amber-500'
                          : 'hover:bg-gray-50/60'
                      }`}
                    >
                      {/* Name (Full name, never anonymized for supplier) */}
                      <td className="py-3.5 px-4 font-semibold text-[#0F172A]">
                        <button
                          type="button"
                          onClick={() => setSelectedCandidateForDetail(cand)}
                          className="font-semibold text-[#1B3270] hover:text-[#2952A3] hover:underline text-left cursor-pointer"
                        >
                          {fullName}
                        </button>
                      </td>

                      {/* Target Role */}
                      <td className="py-3.5 px-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#1B3270]/10 text-[#1B3270] capitalize">
                          {cand.target_role || 'Healthcare'}
                        </span>
                      </td>

                      {/* Language */}
                      <td className="py-3.5 px-3 font-medium text-[#4A5568]">
                        Level {cand.language_level_self_reported || 'B1'}
                      </td>

                      {/* Applied To */}
                      <td className="py-3.5 px-3">
                        {!isSubmitted ? (
                          <span className="text-[#94A3B8] italic">Not submitted</span>
                        ) : isRejected ? (
                          <span className="line-through text-[#94A3B8]">{app.job_title}</span>
                        ) : (
                          <span className="font-semibold text-[#1B3270]">{app.job_title}</span>
                        )}
                      </td>

                      {/* Application Status */}
                      <td className="py-3.5 px-3">
                        {!isSubmitted ? (
                          <span className="text-[#94A3B8]">—</span>
                        ) : isRejected ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Not Progressed
                          </span>
                        ) : (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isInterviewOrBeyond
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {getApplicationStatusLabel(app.status)}
                          </span>
                        )}
                      </td>

                      {/* Fit Score */}
                      <td className="py-3.5 px-3">
                        {isSubmitted && app.fit_score !== undefined && app.fit_score !== null ? (
                          <span className="font-semibold text-[#0F172A]">
                            {app.fit_score}/100
                          </span>
                        ) : (
                          <span className="text-[#94A3B8]">—</span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-right">
                        {/* STATE 1: Not yet submitted */}
                        {!isSubmitted && (
                          <button
                            type="button"
                            onClick={() => handleOpenSubmitModal(cand)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold transition-colors shadow-2xs"
                          >
                            <Briefcase className="w-3.5 h-3.5" />
                            <span>Submit to Requirement</span>
                          </button>
                        )}

                        {/* STATE 2: Active submission (withdrawable) */}
                        {isWithdrawable && (
                          <button
                            type="button"
                            onClick={() => handleOpenWithdrawModal(cand, app)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 border border-rose-300 text-rose-600 hover:bg-rose-50 rounded-[4px] text-xs font-semibold transition-colors"
                          >
                            <span>Withdraw</span>
                          </button>
                        )}

                        {/* STATE 3: Interview scheduled or beyond */}
                        {isInterviewOrBeyond && (
                          <span className="text-[11px] font-medium text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded">
                            Active Employer Engagement
                          </span>
                        )}

                        {/* STATE 4: Rejected / Not Progressed */}
                        {isRejected && (
                          <button
                            type="button"
                            onClick={() => handleOpenSubmitModal(cand)}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#1B3270] text-[#1B3270] hover:bg-[#1B3270]/5 rounded-[6px] text-xs font-semibold transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Submit Elsewhere</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </>
      )}

      {/* ==================================================== */}
      {/* JOB SELECTION MODAL */}
      {/* ==================================================== */}
      {submitModalCandidate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-2xl w-full p-6 shadow-xl max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4] mb-4">
              <div>
                <h3 className="text-base font-bold text-[#0F172A]">
                  Submit {submitModalCandidate.first_name} {submitModalCandidate.last_name} to a Job Requirement
                </h3>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Only Interview Ready candidates can be submitted.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSubmitModalCandidate(null);
                  setSelectedJobToSubmit(null);
                }}
                className="text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-3">
              {loadingJobs ? (
                <div className="py-12 flex flex-col items-center justify-center">
                  <Loader2 className="w-7 h-7 text-[#1B3270] animate-spin mb-2" />
                  <p className="text-xs text-[#4A5568]">Evaluating requirements and calculating fit scores...</p>
                </div>
              ) : activeJobs.length === 0 ? (
                <p className="text-xs text-[#94A3B8] py-8 text-center italic">
                  No active job requirements available right now.
                </p>
              ) : selectedJobToSubmit ? (
                /* Confirmation Step */
                <div className="p-5 rounded-[8px] bg-[#F8FAFD] border border-[#E2E8F4] space-y-4">
                  <h4 className="text-sm font-bold text-[#0F172A]">
                    Confirm submission of {submitModalCandidate.first_name} {submitModalCandidate.last_name} to {selectedJobToSubmit.title}?
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-[6px] border border-[#E2E8F4]">
                    <div>
                      <span className="text-[#94A3B8] block text-[11px]">Location</span>
                      <strong className="text-[#0F172A]">{selectedJobToSubmit.location}</strong>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[11px]">Role Match</span>
                      <strong className="text-[#0F172A] capitalize">{selectedJobToSubmit.role_type}</strong>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[11px]">Calculated Fit Score</span>
                      <strong className="text-[#10B981] font-bold">
                        {jobFitScores[selectedJobToSubmit.id] || 0} / 100
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#94A3B8] block text-[11px]">Remaining Capacity</span>
                      <strong className="text-[#0F172A]">
                        {selectedJobToSubmit.submission_cap - selectedJobToSubmit.current_submissions} slots
                      </strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end space-x-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedJobToSubmit(null)}
                      disabled={submittingToJob}
                      className="px-4 py-2 border border-[#E2E8F4] rounded-[6px] text-xs font-medium text-[#4A5568] hover:bg-white"
                    >
                      Back to Requirements
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSubmit}
                      disabled={submittingToJob}
                      className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-60 text-white rounded-[6px] text-xs font-semibold transition-colors flex items-center space-x-1.5"
                    >
                      {submittingToJob && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Confirm & Submit</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* List of Job Requirements */
                activeJobs.map((job) => {
                  const slotsRemaining = job.submission_cap - job.current_submissions;
                  const isCapReached = slotsRemaining <= 0;
                  const fitScore = jobFitScores[job.id] || 0;
                  const isRoleMatch =
                    submitModalCandidate.target_role?.toLowerCase() ===
                    job.role_type?.toLowerCase();

                  return (
                    <div
                      key={job.id}
                      className="p-4 rounded-[8px] border border-[#E2E8F4] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-gray-300 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-[#0F172A]">{job.title}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#1B3270]/10 text-[#1B3270] capitalize">
                            {job.role_type}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#4A5568]">{job.location}</p>

                        <div className="flex items-center space-x-3 text-[11px] pt-1">
                          <span className="text-[#4A5568]">
                            Slots: <strong>{slotsRemaining > 0 ? slotsRemaining : 0} remaining</strong>
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-[#1B3270]">
                            Fit Score: {fitScore}/100
                          </span>
                          <span>•</span>
                          {isRoleMatch ? (
                            <span className="text-emerald-700 font-semibold">Role aligned</span>
                          ) : (
                            <span className="text-amber-700 font-medium">
                              Role does not match. Review before submitting
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isCapReached}
                        onClick={() => setSelectedJobToSubmit(job)}
                        className={`px-3.5 py-2 rounded-[6px] text-xs font-semibold transition-colors flex-shrink-0 ${
                          isCapReached
                            ? 'bg-gray-100 text-[#94A3B8] cursor-not-allowed'
                            : 'bg-[#1B3270] hover:bg-[#2952A3] text-white shadow-2xs'
                        }`}
                      >
                        {isCapReached ? 'Capacity Reached' : 'Select this requirement'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* WITHDRAWAL CONFIRMATION MODAL */}
      {/* ==================================================== */}
      {withdrawModalData && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0F172A] mb-1">
              Withdraw {withdrawModalData.candidate.first_name} {withdrawModalData.candidate.last_name} from {withdrawModalData.application.job_title}?
            </h3>
            <p className="text-xs text-[#4A5568] leading-relaxed mb-4">
              This will remove the submission and free up one slot for other candidates.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                Reason for withdrawal (optional)
              </label>
              <textarea
                rows={3}
                value={withdrawalReason}
                onChange={(e) => setWithdrawalReason(e.target.value)}
                placeholder="Candidate accepted another offer, relocated, or opted for different clinical track..."
                className="w-full px-3 py-2 bg-white border border-[#E2E8F4] focus:border-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none resize-none"
              />
            </div>

            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setWithdrawModalData(null)}
                disabled={withdrawing}
                className="px-4 py-2 border border-[#E2E8F4] rounded-[6px] text-xs font-medium text-[#4A5568] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmWithdrawal}
                disabled={withdrawing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-[6px] text-xs font-semibold transition-colors flex items-center space-x-1.5"
              >
                {withdrawing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Withdrawal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Detail Modal */}
      {selectedCandidateForDetail && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-5xl w-full h-[92vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <SupplierCandidateDetailPanel
              candidateId={selectedCandidateForDetail.id}
              initialTab="profile"
              onClose={() => setSelectedCandidateForDetail(null)}
              onCandidateUpdated={fetchTrackData}
            />
          </div>
        </div>
      )}
    </div>
  );
};
