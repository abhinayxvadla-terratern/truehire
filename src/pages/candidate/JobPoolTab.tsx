import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { MapPin, Briefcase, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { getApplicationStatusLabel } from '../../utils/labels';

interface JobPoolTabProps {
  candidate: any;
}

export const JobPoolTab: React.FC<JobPoolTabProps> = ({ candidate }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('view') === 'applications' ? 'applications' : 'all';
  const [view, setView] = useState<'all' | 'applications'>(initialView);

  useEffect(() => {
    const v = searchParams.get('view');
    if (v === 'applications' || v === 'all') {
      setView(v);
    }
  }, [searchParams]);

  const handleViewChange = (newView: 'all' | 'applications') => {
    setView(newView);
    setSearchParams({ tab: 'job_pool', view: newView });
  };
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canApplyToJobs = Boolean(candidate?.can_apply_to_jobs || candidate?.status === 'interview_ready');

  const fetchData = async () => {
    if (!candidate?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);

      // 1. Fetch active jobs
      const { data: jobsData, error: jobsErr } = await supabase
        .from('job_requirements')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (jobsErr) console.error('Error fetching jobs:', jobsErr);
      else setJobs(jobsData || []);

      // 2. Fetch candidate's applications with joined job requirements
      const { data: appsData, error: appsErr } = await supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          job_id,
          status,
          submitted_by,
          created_at,
          job_requirements (
            title,
            location,
            role_type,
            description
          )
        `)
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false });

      if (appsErr) {
        console.error('Error fetching applications:', appsErr);
      } else {
        setApplications(appsData || []);
        const appliedIds = new Set((appsData || []).map((app) => app.job_id));
        setAppliedJobIds(appliedIds);
      }
    } catch (err) {
      console.error('Error loading job pool data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (candidate?.id) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [candidate?.id]);

  const handleApply = async (jobId: string) => {
    if (!canApplyToJobs) return;
    if (appliedJobIds.has(jobId)) return;

    try {
      setApplyingJobId(jobId);
      setFeedbackMessage(null);

      // 1. Insert application
      const { error } = await supabase.from('job_applications').insert({
        candidate_id: candidate.id,
        job_id: jobId,
        submitted_by: 'candidate',
        status: 'applied',
      });

      if (error) {
        throw error;
      }

      // 2. Look up employer and notify Employer RM
      const { data: jobReq } = await supabase
        .from('job_requirements')
        .select('id, title, employer_id')
        .eq('id', jobId)
        .maybeSingle();

      const candidateName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'A candidate';
      const jobTitle = jobReq?.title || 'Open Role';

      if (jobReq?.employer_id) {
        const { data: rmAssign } = await supabase
          .from('rm_assignments')
          .select('rm_profile_id')
          .eq('entity_type', 'employer')
          .eq('entity_id', jobReq.employer_id)
          .eq('active', true)
          .maybeSingle();

        if (rmAssign?.rm_profile_id) {
          await supabase.from('notifications').insert({
            user_id: rmAssign.rm_profile_id,
            title: 'New Candidate Application',
            message: `${candidateName} applied to ${jobTitle}. Review their application in your pipeline.`,
            type: 'general',
            read: false,
          });
        } else {
          // Notify internal employer_requirements_rm staff
          const { data: rmStaff } = await supabase
            .from('profiles')
            .select('id')
            .eq('internal_role', 'employer_requirements_rm');

          if (rmStaff && rmStaff.length > 0) {
            const notifs = rmStaff.map((s) => ({
              user_id: s.id,
              title: 'New Candidate Application',
              message: `${candidateName} applied to ${jobTitle}. Review their application in your pipeline.`,
              type: 'general',
              read: false,
            }));
            await supabase.from('notifications').insert(notifs);
          }
        }
      }

      setFeedbackMessage({
        type: 'success',
        text: 'Your application has been submitted successfully!',
      });

      // Refresh applications
      await fetchData();
    } catch (err: any) {
      console.error('Error submitting application:', err);
      setFeedbackMessage({
        type: 'error',
        text: 'Failed to submit application. Try again.',
      });
    } finally {
      setApplyingJobId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const label = getApplicationStatusLabel(status);
    switch (status) {
      case 'shortlisted':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#7EB3E8]/20 text-[#2952A3] border border-[#7EB3E8]/30">
            {label}
          </span>
        );
      case 'interview_scheduled':
      case 'interviewed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
            {label}
          </span>
        );
      case 'selected':
      case 'offer_sent':
      case 'reveal_gate':
      case 'placed':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
            {label}
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
            {label}
          </span>
        );
      case 'applied':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F8FAFD] text-[#94A3B8] border border-[#E2E8F4]">
            {label}
          </span>
        );
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
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Pill Toggle Bar */}
      <div className="flex items-center justify-between">
        <div className="bg-[#F8FAFD] border border-[#E2E8F4] p-1 rounded-full inline-flex">
          <button
            type="button"
            onClick={() => handleViewChange('all')}
            className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
              view === 'all'
                ? 'bg-[#1B3270] text-white shadow-sm'
                : 'text-[#4A5568] hover:text-[#1B3270]'
            }`}
          >
            All Open Roles ({jobs.length})
          </button>
          <button
            type="button"
            onClick={() => handleViewChange('applications')}
            className={`px-5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
              view === 'applications'
                ? 'bg-[#1B3270] text-white shadow-sm'
                : 'text-[#4A5568] hover:text-[#1B3270]'
            }`}
          >
            My Applications ({applications.length})
          </button>
        </div>

        {!canApplyToJobs && view === 'all' && (
          <div className="text-xs text-[#94A3B8] hidden sm:block">
            Applications unlock once you achieve <strong>Interview Ready</strong> status.
          </div>
        )}
      </div>

      {feedbackMessage && (
        <div
          className={`text-xs p-3 rounded-[6px] border ${
            feedbackMessage.type === 'success'
              ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20'
              : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20'
          }`}
        >
          {feedbackMessage.text}
        </div>
      )}

      {/* ALL JOBS VIEW */}
      {view === 'all' && (
        <div>
          {jobs.length === 0 ? (
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-12 text-center shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
              <Briefcase size={32} className="mx-auto text-[#94A3B8] mb-3" />
              <h3 className="text-base font-semibold text-[#1B3270] mb-1">
                No open roles right now. Check back soon.
              </h3>
              <p className="text-xs text-[#94A3B8]">
                New healthcare and nursing opportunities are posted regularly.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jobs.map((job) => {
                const hasApplied = appliedJobIds.has(job.id);
                return (
                  <div
                    key={job.id}
                    className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col justify-between hover:border-[#7EB3E8] transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-[14px] font-semibold text-[#1B3270] leading-snug">
                          {job.title}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#7EB3E8]/20 text-[#2952A3] whitespace-nowrap capitalize">
                          {job.role_type}
                        </span>
                      </div>

                      <div className="flex items-center text-[12px] text-[#4A5568] mb-3">
                        <MapPin size={13} className="mr-1 text-[#94A3B8]" />
                        {job.location}
                      </div>

                      {job.description && (
                        <p className="text-xs text-[#4A5568] line-clamp-2 mb-4 leading-relaxed">
                          {job.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-between">
                      <span className="text-[11px] text-[#94A3B8]">
                        Submissions: {job.current_submissions}/{job.submission_cap}
                      </span>

                      {hasApplied ? (
                        <span className="inline-flex items-center text-xs font-semibold text-[#10B981] bg-[#10B981]/10 px-3 py-1.5 rounded-[6px] border border-[#10B981]/20">
                          <CheckCircle2 size={13} className="mr-1" />
                          Already Applied
                        </span>
                      ) : canApplyToJobs ? (
                        <button
                          type="button"
                          disabled={applyingJobId === job.id}
                          onClick={() => handleApply(job.id)}
                          className="py-1.5 px-4 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-medium rounded-[6px] transition-colors shadow-[0_1px_4px_rgba(27,50,112,0.08)] disabled:opacity-50 cursor-pointer"
                        >
                          {applyingJobId === job.id ? 'Submitting...' : 'Apply Now'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Complete your full qualification to unlock the ability to apply"
                          className="py-1.5 px-3 bg-[#F8FAFD] border border-[#E2E8F4] text-[#94A3B8] text-xs font-medium rounded-[6px] cursor-not-allowed"
                        >
                          Available once qualified to apply
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MY APPLICATIONS VIEW */}
      {view === 'applications' && (
        <div>
          {applications.length === 0 ? (
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-12 text-center shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
              <Clock size={32} className="mx-auto text-[#94A3B8] mb-3" />
              <h3 className="text-base font-semibold text-[#1B3270] mb-1">
                No applications yet.
              </h3>
              <p className="text-xs text-[#94A3B8]">
                Once you reach Interview Ready status, you will be able to apply to open roles.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h4 className="text-[14px] font-semibold text-[#1B3270]">
                        {app.job_requirements?.title || 'Healthcare Position'}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#7EB3E8]/20 text-[#2952A3] capitalize">
                        {app.job_requirements?.role_type || 'Role'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#F8FAFD] text-[#1B3270] border border-[#E2E8F4]">
                        {app.submitted_by === 'supplier' ? 'Submitted by supplier' : 'You applied directly'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-[12px] text-[#4A5568]">
                      <span className="flex items-center">
                        <MapPin size={12} className="mr-1 text-[#94A3B8]" />
                        {app.job_requirements?.location || 'Germany'}
                      </span>
                      <span className="text-[#94A3B8]">•</span>
                      <span className="flex items-center text-[#94A3B8]">
                        <Calendar size={12} className="mr-1" />
                        Applied on {formatDate(app.created_at)}
                      </span>
                    </div>
                  </div>

                  <div>{getStatusBadge(app.status)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
