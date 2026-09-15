import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Plus,
  ChevronUp,
  ChevronDown,
  MapPin,
  Briefcase,
  Copy,
  Calendar,
  AlertTriangle,
  Check,
  Trash2,
  Bookmark,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { notifyByRole } from '../../utils/notificationRouting';

interface EmployerMyJobsTabProps {
  employer: any;
  initialOpenPostForm?: boolean;
}

export const EmployerMyJobsTab: React.FC<EmployerMyJobsTabProps> = ({
  employer,
  initialOpenPostForm = false,
}) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(initialOpenPostForm);

  // Form inputs
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [roleType, setRoleType] = useState('nursing');
  const [description, setDescription] = useState('');
  const [submissionCap, setSubmissionCap] = useState(10);
  const [expiryDate, setExpiryDate] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Templates collapsible section
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<any | null>(null);

  // Auto-pause banner state
  const [autoPausedJobs, setAutoPausedJobs] = useState<any[]>([]);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchJobs = async () => {
    if (!employer?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_requirements')
        .select('*')
        .eq('employer_id', employer.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching jobs:', error);
        return;
      }

      const allJobs = data || [];
      const todayStr = new Date().toISOString().split('T')[0];

      // Expiry auto-pause check: active jobs where expiry_date <= todayStr
      const expiredToPause = allJobs.filter(
        (j) => j.status === 'active' && j.expiry_date && j.expiry_date <= todayStr
      );

      if (expiredToPause.length > 0) {
        const expiredIds = expiredToPause.map((j) => j.id);
        const { error: updateErr } = await supabase
          .from('job_requirements')
          .update({ status: 'paused' })
          .in('id', expiredIds);

        if (!updateErr) {
          expiredToPause.forEach((j) => {
            j.status = 'paused';
          });
          setAutoPausedJobs((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newPaused = expiredToPause.filter((j) => !existingIds.has(j.id));
            return [...prev, ...newPaused];
          });

          // Look up assigned RM to notify
          const { data: rmAss } = await supabase
            .from('rm_assignments')
            .select('rm_profile_id')
            .eq('entity_type', 'employer')
            .eq('entity_id', employer.id)
            .eq('active', true)
            .maybeSingle();

          for (const pJob of expiredToPause) {
            const notifTitle = 'Job Requirement Deadline Reached';
            const notifMsg = `${pJob.title} for ${
              employer.company_name || 'an employer'
            } has reached its deadline and has been automatically paused.`;

            if (rmAss?.rm_profile_id) {
              await supabase.from('notifications').insert({
                user_id: rmAss.rm_profile_id,
                type: 'general',
                title: notifTitle,
                message: notifMsg,
              });
            } else {
              await notifyByRole(
                supabase,
                'employer_requirements_rm',
                notifTitle,
                notifMsg,
                'general'
              );
            }
          }
        }
      }

      setJobs(allJobs);
    } catch (err) {
      console.error('Unexpected error loading jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [employer?.id]);

  useEffect(() => {
    if (initialOpenPostForm) {
      setIsFormOpen(true);
    }
  }, [initialOpenPostForm]);

  const handlePostRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !location.trim()) {
      setFormError('Job Title and Location are required.');
      return;
    }

    try {
      setSubmitting(true);
      setFormError(null);

      const { error } = await supabase.from('job_requirements').insert({
        employer_id: employer.id,
        title: title.trim(),
        location: location.trim(),
        role_type: roleType,
        description: description.trim() || null,
        submission_cap: Number(submissionCap) || 10,
        current_submissions: 0,
        status: 'active',
        expiry_date: expiryDate ? expiryDate : null,
        is_template: isTemplate,
      });

      if (error) {
        throw error;
      }

      // Reset form & collapse
      setTitle('');
      setLocation('');
      setRoleType('nursing');
      setDescription('');
      setSubmissionCap(10);
      setExpiryDate('');
      setIsTemplate(false);
      setIsFormOpen(false);

      showToast(isTemplate ? 'Requirement posted and saved as template.' : 'Job requirement posted.');
      await fetchJobs();
    } catch (err: any) {
      console.error('Error posting requirement:', err);
      setFormError(err.message || 'Failed to post job requirement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDuplicateJob = async (jobToDup: any) => {
    try {
      const { error } = await supabase.from('job_requirements').insert({
        employer_id: employer.id,
        title: `${jobToDup.title} (Copy)`,
        location: jobToDup.location,
        role_type: jobToDup.role_type,
        description: jobToDup.description,
        submission_cap: jobToDup.submission_cap,
        current_submissions: 0,
        status: 'active',
        duplicated_from: jobToDup.id,
        expiry_date: null,
        is_template: false,
      });

      if (error) throw error;
      showToast('Requirement duplicated.');
      await fetchJobs();
    } catch (err: any) {
      console.error('Error duplicating requirement:', err);
      alert(err.message || 'Failed to duplicate requirement.');
    }
  };

  const handleUseTemplate = (tpl: any) => {
    setTitle(tpl.title);
    setLocation(tpl.location);
    setRoleType(tpl.role_type);
    setDescription(tpl.description || '');
    setSubmissionCap(tpl.submission_cap || 10);
    setExpiryDate('');
    setIsTemplate(false);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('job_requirements')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      setDeletingTemplate(null);
      showToast('Template deleted.');
      await fetchJobs();
    } catch (err: any) {
      console.error('Error deleting template:', err);
      alert(err.message || 'Failed to delete template.');
    }
  };

  const handleResumeAutoPausedJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('job_requirements')
        .update({
          status: 'active',
          expiry_date: null,
        })
        .eq('id', jobId);

      if (error) throw error;
      setAutoPausedJobs((prev) => prev.filter((j) => j.id !== jobId));
      showToast('Requirement re-activated with deadline removed.');
      await fetchJobs();
    } catch (err: any) {
      console.error('Error resuming requirement:', err);
    }
  };

  const handleUpdateStatus = async (jobId: string, newStatus: 'active' | 'paused' | 'closed') => {
    try {
      const { error } = await supabase
        .from('job_requirements')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;
      await fetchJobs();
    } catch (err) {
      console.error(`Error updating job to ${newStatus}:`, err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
            Paused
          </span>
        );
      case 'closed':
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-[#94A3B8] border border-gray-200">
            Closed
          </span>
        );
    }
  };

  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const templateList = jobs.filter((j) => j.is_template);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* AUTO-PAUSED DEADLINE ALERT BANNER */}
      {autoPausedJobs.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-[10px] space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span className="text-xs font-bold text-amber-900">
                {autoPausedJobs.length} requirement{autoPausedJobs.length === 1 ? '' : 's'} reached deadline and paused
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAutoPausedJobs([])}
              className="text-xs text-amber-700 hover:text-amber-900 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
          <p className="text-xs text-amber-800">
            The following requirements reached their application deadline and were automatically paused:{' '}
            <span className="font-semibold">{autoPausedJobs.map((j) => j.title).join(', ')}</span>.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {autoPausedJobs.map((job) => (
              <div
                key={job.id}
                className="inline-flex items-center space-x-2 bg-white px-2.5 py-1 rounded-[6px] border border-amber-200 text-xs"
              >
                <span className="font-medium text-slate-800 truncate max-w-[200px]">
                  {job.title}
                </span>
                <button
                  type="button"
                  onClick={() => handleResumeAutoPausedJob(job.id)}
                  className="font-bold text-[#1B3270] hover:underline cursor-pointer"
                >
                  Resume
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* POST NEW REQUIREMENT COLLAPSIBLE BUTTON & FORM */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-[0_1px_4px_rgba(27,50,112,0.08)] overflow-hidden">
        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#F8FAFD] transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <Plus size={16} className="text-[#1B3270]" />
            <span className="text-sm font-bold text-[#1B3270]">
              Post New Requirement
            </span>
          </div>
          {isFormOpen ? (
            <ChevronUp size={16} className="text-[#94A3B8]" />
          ) : (
            <ChevronDown size={16} className="text-[#94A3B8]" />
          )}
        </button>

        {isFormOpen && (
          <form
            onSubmit={handlePostRequirement}
            className="p-6 border-t border-[#E2E8F4] space-y-4 bg-[#F8FAFD]/40 animate-in fade-in duration-150"
          >
            {formError && (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-[6px] text-xs text-[#EF4444]">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
                  Job Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Registered Intensive Care Nurse"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F4] rounded-[6px] text-[#1B3270] placeholder-[#94A3B8] outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
                  Location (City / State in Germany) *
                </label>
                <input
                  type="text"
                  required
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Munich, Bavaria"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F4] rounded-[6px] text-[#1B3270] placeholder-[#94A3B8] outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
                  Role Type *
                </label>
                <select
                  value={roleType}
                  onChange={(e) => setRoleType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F4] rounded-[6px] text-[#1B3270] outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
                >
                  <option value="nursing">Nursing</option>
                  <option value="ausbildung">Ausbildung</option>
                  <option value="care">Care</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
                  Submission Cap (Max Candidates) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={submissionCap}
                  onChange={(e) => setSubmissionCap(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F4] rounded-[6px] text-[#1B3270] outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
                  Application Deadline (Optional)
                </label>
                <input
                  type="date"
                  min={tomorrowStr}
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F4] rounded-[6px] text-[#1B3270] outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
                />
                <p className="text-[10px] text-[#94A3B8] mt-1">
                  Will pause automatically on this date.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
                Job Description & Department Requirements (Optional)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Shift details, specialized equipment experience, clinical ward responsibilities..."
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F4] rounded-[6px] text-[#1B3270] placeholder-[#94A3B8] outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
              />
            </div>

            {/* Save as template checkbox */}
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="saveAsTemplate"
                checked={isTemplate}
                onChange={(e) => setIsTemplate(e.target.checked)}
                className="w-4 h-4 text-[#1B3270] rounded border-slate-300 focus:ring-[#1B3270] cursor-pointer"
              />
              <label
                htmlFor="saveAsTemplate"
                className="text-xs font-semibold text-[#1B3270] cursor-pointer select-none"
              >
                Save as template for future use
              </label>
            </div>

            <div className="pt-2 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-xs font-medium text-[#4A5568] hover:text-[#1B3270] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="py-2.5 px-6 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-medium rounded-[6px] transition-colors shadow-[0_1px_4px_rgba(27,50,112,0.08)] disabled:opacity-60 cursor-pointer"
              >
                {submitting ? 'Posting...' : 'Post Job Requirement'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* JOBS LIST */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#1B3270]">
            Your Posted Requirements ({jobs.length})
          </h3>
        </div>

        {loading ? (
          <div className="py-12 flex justify-center">
            <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-12 text-center shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-2">
            <Briefcase size={32} className="mx-auto text-[#94A3B8]" />
            <h4 className="text-base font-semibold text-[#1B3270]">
              No requirements posted yet.
            </h4>
            <p className="text-xs text-[#94A3B8]">
              Post your first job requirement above to begin receiving verified candidates.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const todayStr = new Date().toISOString().split('T')[0];
              const isPast = job.expiry_date && job.expiry_date < todayStr;
              const diffDays = job.expiry_date
                ? Math.ceil(
                    (new Date(job.expiry_date).getTime() - new Date(todayStr).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                : null;
              const isClosingSoon = !isPast && diffDays !== null && diffDays <= 7 && diffDays >= 0;

              return (
                <div
                  key={job.id}
                  className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h4 className="text-[14px] font-semibold text-[#1B3270]">
                        {job.title}
                      </h4>
                      <div>{getStatusBadge(job.status)}</div>
                      {job.is_template && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Template
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#4A5568]">
                      <span className="flex items-center">
                        <MapPin size={12} className="mr-1 text-[#94A3B8]" />
                        {job.location}
                      </span>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#7EB3E8]/20 text-[#2952A3] capitalize">
                        {job.role_type}
                      </span>

                      <span className="text-[#94A3B8]">
                        Submissions: {job.current_submissions} / {job.submission_cap}
                      </span>

                      <span className="text-[#94A3B8]">
                        Posted {formatDate(job.created_at)}
                      </span>

                      {job.expiry_date && (
                        <span className="flex items-center space-x-1.5">
                          <Calendar size={12} className="text-[#94A3B8]" />
                          <span>Deadline: {formatDate(job.expiry_date)}</span>
                          {isPast && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                              Expired
                            </span>
                          )}
                          {isClosingSoon && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              Closing soon
                            </span>
                          )}
                        </span>
                      )}
                    </div>

                    {job.description && (
                      <p className="text-xs text-[#4A5568] line-clamp-1 pt-0.5">
                        {job.description}
                      </p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center space-x-2 flex-shrink-0 flex-wrap gap-y-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicateJob(job)}
                      title="Duplicate requirement"
                      className="px-2.5 py-1 text-xs text-[#1B3270] border border-[#E2E8F4] hover:bg-slate-50 rounded-[6px] transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <Copy size={12} />
                      <span>Duplicate</span>
                    </button>

                    {job.is_template && (
                      <button
                        type="button"
                        onClick={() => handleUseTemplate(job)}
                        className="px-2.5 py-1 text-xs text-[#2952A3] bg-[#7EB3E8]/15 border border-[#7EB3E8]/30 hover:bg-[#7EB3E8]/25 rounded-[6px] transition-colors font-medium cursor-pointer"
                      >
                        Create from Template
                      </button>
                    )}

                    {job.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(job.id, 'paused')}
                        className="px-3 py-1 text-xs text-[#F59E0B] border border-[#F59E0B]/30 hover:bg-[#F59E0B]/10 rounded-[6px] transition-colors cursor-pointer"
                      >
                        Pause
                      </button>
                    )}

                    {job.status === 'paused' && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(job.id, 'active')}
                        className="px-3 py-1 text-xs text-[#10B981] border border-[#10B981]/30 hover:bg-[#10B981]/10 rounded-[6px] transition-colors cursor-pointer"
                      >
                        Resume
                      </button>
                    )}

                    {(job.status === 'active' || job.status === 'paused') && (
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(job.id, 'closed')}
                        className="px-3 py-1 text-xs text-[#94A3B8] border border-[#E2E8F4] hover:text-[#EF4444] hover:border-[#EF4444]/30 rounded-[6px] transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* TEMPLATES SECTION */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-[0_1px_4px_rgba(27,50,112,0.08)] overflow-hidden">
        <button
          type="button"
          onClick={() => setTemplatesOpen(!templatesOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#F8FAFD] transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <Bookmark size={16} className="text-[#1B3270]" />
            <span className="text-sm font-bold text-[#1B3270]">
              Templates ({templateList.length})
            </span>
          </div>
          {templatesOpen ? (
            <ChevronUp size={16} className="text-[#94A3B8]" />
          ) : (
            <ChevronDown size={16} className="text-[#94A3B8]" />
          )}
        </button>

        {templatesOpen && (
          <div className="p-5 border-t border-[#E2E8F4] bg-[#F8FAFD]/30 space-y-3 animate-in fade-in duration-150">
            {templateList.length === 0 ? (
              <div className="py-8 text-center space-y-1">
                <Bookmark size={24} className="mx-auto text-slate-300" />
                <p className="text-xs font-semibold text-[#1B3270]">
                  No templates saved yet.
                </p>
                <p className="text-[11px] text-[#94A3B8]">
                  Toggle "Save as template" when posting a requirement to save it here for quick re-use.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templateList.map((tpl) => (
                  <div
                    key={tpl.id}
                    className="p-4 rounded-[8px] bg-white border border-[#E2E8F4] flex flex-col justify-between space-y-3 shadow-2xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#1B3270] truncate max-w-[200px]">
                          {tpl.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          Template
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-[#4A5568]">
                        <span className="flex items-center">
                          <MapPin size={11} className="mr-0.5 text-[#94A3B8]" />
                          {tpl.location}
                        </span>
                        <span>•</span>
                        <span className="capitalize font-medium text-[#2952A3]">
                          {tpl.role_type}
                        </span>
                        <span>•</span>
                        <span className="text-[#94A3B8]">
                          Cap: {tpl.submission_cap}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#E2E8F4] flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setDeletingTemplate(tpl)}
                        className="text-[11px] text-red-500 hover:text-red-700 flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUseTemplate(tpl)}
                        className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-medium cursor-pointer transition-colors shadow-2xs"
                      >
                        Use Template
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CONFIRM DELETE TEMPLATE MODAL */}
      {deletingTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#E2E8F4] max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-sm font-bold text-[#1B3270]">
                Delete Requirement Template?
              </h3>
              <p className="text-xs text-[#4A5568] mt-1">
                Are you sure you want to delete the template{' '}
                <strong>"{deletingTemplate.title}"</strong>? This will not affect any active requirements already created from it.
              </p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
              <button
                type="button"
                onClick={() => setDeletingTemplate(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTemplate(deletingTemplate.id)}
                className="px-3 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-[6px] cursor-pointer"
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
