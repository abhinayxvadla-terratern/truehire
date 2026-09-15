import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import { notifyByRole } from '../../../../utils/notificationRouting';
import {
  Layers,
  Search,
  AlertTriangle,
  Building2,
  X,
  Loader2,
  Check,
  Clock,
} from 'lucide-react';

interface ApplicationRow {
  id: string;
  candidate_id: string;
  first_name: string | null;
  last_name: string | null;
  user_id: string | null;
  job_id: string;
  job_title: string;
  employer_name: string;
  submitted_by: string;
  supplier_id?: string | null;
  supplier_name: string;
  status: string;
  fit_score: number | null;
  interview_scheduled_at: string | null;
  interview_time: string | null;
  interview_notes: string | null;
  interview_feedback: string | null;
  rejection_reason: string | null;
  days_since_update: number;
  created_at: string;
  updated_at: string;
}

interface EmployerRmPipelineTabProps {
  initialStatusFilter?: string;
}

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const EmployerRmPipelineTab: React.FC<EmployerRmPipelineTabProps> = ({
  initialStatusFilter,
}) => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [jobOptions, setJobOptions] = useState<{ id: string; title: string; employer_name: string }[]>([]);
  const [selectedJobFilter, setSelectedJobFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(
    initialStatusFilter || 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Status updating
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);

  // Escalation Modal
  const [escalationApp, setEscalationApp] = useState<ApplicationRow | null>(null);
  const [escalationNote, setEscalationNote] = useState('');
  const [raisingEscalation, setRaisingEscalation] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchPipelineApplications = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch assigned employers
      const { data: assignments } = await supabase
        .from('rm_assignments')
        .select('entity_id')
        .eq('rm_profile_id', user.id)
        .eq('entity_type', 'employer')
        .eq('active', true);

      const employerIds = (assignments || []).map((a) => a.entity_id);

      if (employerIds.length === 0) {
        setApplications([]);
        setJobOptions([]);
        return;
      }

      // 2. Fetch jobs for these employers
      const { data: jobs } = await supabase
        .from('job_requirements')
        .select(`
          id,
          title,
          employers:employer_id (company_name)
        `)
        .in('employer_id', employerIds);

      const jobOpts = (jobs || []).map((j: any) => ({
        id: j.id,
        title: j.title,
        employer_name: j.employers?.company_name || 'Hospital Facility',
      }));
      setJobOptions(jobOpts);

      const jobIds = (jobs || []).map((j) => j.id);

      if (jobIds.length === 0) {
        setApplications([]);
        return;
      }

      // 3. Fetch applications for these jobs
      const { data: apps, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          job_id,
          status,
          fit_score,
          interview_scheduled_at,
          interview_time,
          interview_notes,
          interview_feedback,
          rejection_reason,
          submitted_by,
          supplier_id,
          created_at,
          updated_at,
          candidates:candidate_id (first_name, last_name, user_id),
          job_requirements:job_id (
            title,
            employers:employer_id (company_name)
          ),
          suppliers:supplier_id (company_name)
        `)
        .in('job_id', jobIds)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const rows: ApplicationRow[] = (apps || []).map((a: any) => {
        const c = a.candidates;
        const j = a.job_requirements;
        const updatedTime = new Date(a.updated_at || a.created_at || Date.now()).getTime();
        const daysDiff = Math.max(
          0,
          Math.floor((Date.now() - updatedTime) / (1000 * 60 * 60 * 24))
        );

        return {
          id: a.id,
          candidate_id: a.candidate_id,
          first_name: c?.first_name || null,
          last_name: c?.last_name || null,
          user_id: c?.user_id || null,
          job_id: a.job_id,
          job_title: j?.title || 'Healthcare Position',
          employer_name: j?.employers?.company_name || 'Hospital Partner',
          submitted_by: a.submitted_by,
          supplier_id: a.supplier_id,
          supplier_name: a.suppliers?.company_name || 'Direct Candidate',
          status: a.status,
          fit_score: a.fit_score ?? null,
          interview_scheduled_at: a.interview_scheduled_at || null,
          interview_time: a.interview_time || null,
          interview_notes: a.interview_notes || null,
          interview_feedback: a.interview_feedback || null,
          rejection_reason: a.rejection_reason || null,
          days_since_update: daysDiff,
          created_at: a.created_at,
          updated_at: a.updated_at,
        };
      });

      setApplications(rows);
    } catch (err) {
      console.error('Error fetching pipeline applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelineApplications();
  }, [user]);

  const handleMoveStatus = async (app: ApplicationRow, newStatus: string) => {
    if (!user) return;

    try {
      setUpdatingAppId(app.id);

      let rejReason: string | null = null;
      if (newStatus === 'rejected') {
        rejReason = window.prompt('Provide rejection feedback / reason (optional):') || 'Requirements criteria not met';
      }

      const updatePayload: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (rejReason) {
        updatePayload.rejection_reason = rejReason;
      }

      // 1. UPDATE status & updated_at
      const { error } = await supabase
        .from('job_applications')
        .update(updatePayload)
        .eq('id', app.id);

      if (error) throw error;

      // 2. Light reveal notification if moving to interview_scheduled
      if (newStatus === 'interview_scheduled' && app.user_id) {
        await supabase.from('notifications').insert({
          user_id: app.user_id,
          title: 'Interview Scheduled',
          message: `You have been selected for an interview for ${app.job_title}. Your Relationship Manager will coordinate timing shortly.`,
          type: 'application_update',
          read: false,
          sent_by: user.id,
        });
      }

      // 3. When candidate passes interview (selected)
      if (newStatus === 'selected') {
        await notifyByRole(
          supabase,
          'placement_lead',
          'Candidate Passed Interview',
          `Candidate for ${app.job_title} has passed their interview and been selected.`,
          'placement',
          user.id
        );
        await notifyByRole(
          supabase,
          'employer_requirements_rm',
          'Candidate Passed Interview',
          `Candidate for ${app.job_title} has passed their interview and been selected.`,
          'placement',
          user.id
        );
      }

      // 4. When candidate is rejected / not progressed
      if (newStatus === 'rejected') {
        if (app.user_id) {
          await supabase.from('notifications').insert({
            user_id: app.user_id,
            title: 'Application Update',
            message: `Your application for ${app.job_title} was not progressed (${rejReason || 'Criteria not met'}).`,
            type: 'application_update',
            read: false,
            sent_by: user.id,
          });
        }
        if (app.supplier_id) {
          const { data: sup } = await supabase
            .from('suppliers')
            .select('user_id')
            .eq('id', app.supplier_id)
            .maybeSingle();
          if (sup?.user_id) {
            await supabase.from('notifications').insert({
              user_id: sup.user_id,
              title: 'Candidate Not Progressed',
              message: `Candidate #${app.candidate_id.slice(0, 6).toUpperCase()} was not progressed for ${app.job_title}.`,
              type: 'application_update',
              read: false,
              sent_by: user.id,
            });
          }
        }
      }

      showToast(`Application moved to ${newStatus.replace('_', ' ')}`);

      // Update local row
      setApplications((prev) =>
        prev.map((row) =>
          row.id === app.id
            ? { ...row, status: newStatus, rejection_reason: rejReason || row.rejection_reason, days_since_update: 0 }
            : row
        )
      );
    } catch (err: any) {
      alert(`Failed to update application status: ${err.message}`);
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleRaiseConcern = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalationApp || !user) return;

    try {
      setRaisingEscalation(true);

      const { error } = await supabase.from('escalations').insert({
        entity_type: 'application',
        entity_id: escalationApp.id,
        note: escalationNote.trim(),
        raised_by: user.id,
        status: 'open',
      });

      if (error) throw error;

      showToast(`Concern raised for ${escalationApp.job_title}`);
      setEscalationApp(null);
      setEscalationNote('');
    } catch (err: any) {
      alert(`Failed to raise concern: ${err.message}`);
    } finally {
      setRaisingEscalation(false);
    }
  };

  const getValidNextStatuses = (current: string): string[] => {
    switch (current) {
      case 'applied':
        return ['shortlisted'];
      case 'shortlisted':
        return ['interview_scheduled', 'rejected'];
      case 'interview_scheduled':
        return ['interviewed'];
      case 'interviewed':
        return ['selected', 'rejected'];
      case 'selected':
        return ['offer_sent'];
      default:
        return [];
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (selectedJobFilter !== 'all' && app.job_id !== selectedJobFilter) return false;
    if (selectedStatusFilter !== 'all' && app.status !== selectedStatusFilter)
      return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchJob = app.job_title.toLowerCase().includes(q);
      const matchEmp = app.employer_name.toLowerCase().includes(q);
      const matchSup = app.supplier_name.toLowerCase().includes(q);
      const matchId = app.candidate_id.toLowerCase().includes(q);
      const matchName =
        app.first_name &&
        `${app.first_name} ${app.last_name}`.toLowerCase().includes(q);
      if (!matchJob && !matchEmp && !matchSup && !matchId && !matchName) return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Hospital Application Pipeline & Candidate Coordination
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Progress candidate applications through hospital review, trigger interview invitations, and raise operational concerns.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by position, employer, candidate, supplier..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          {/* Job Filter */}
          <div>
            <select
              value={selectedJobFilter}
              onChange={(e) => setSelectedJobFilter(e.target.value)}
              className="w-full py-1.5 px-3 text-xs border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All Jobs & Vacancies</option>
              {jobOptions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title} ({j.employer_name})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full py-1.5 px-3 text-xs border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All Application Statuses</option>
              <option value="applied">Applied</option>
              <option value="shortlisted">Shortlisted</option>
              <option value="interview_scheduled">Interview Scheduled</option>
              <option value="interviewed">Interviewed</option>
              <option value="selected">Selected</option>
              <option value="offer_sent">Offer Sent</option>
              <option value="reveal_gate">Reveal Gate Active</option>
              <option value="placed">Placed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="py-16 text-center">
            <Layers className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">
              No applications in this pipeline view
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Adjust your job or status filters above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Candidate Identity</th>
                  <th className="py-3 px-4">Position & Facility</th>
                  <th className="py-3 px-4">Fit Score</th>
                  <th className="py-3 px-4">Submission Source</th>
                  <th className="py-3 px-4">Application Status</th>
                  <th className="py-3 px-4">Interview & Feedback / Reason</th>
                  <th className="py-3 px-4 text-center">Days in Stage</th>
                  <th className="py-3 px-4 text-right">Pipeline Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredApplications.map((app) => {
                  const validNext = getValidNextStatuses(app.status);

                  // Anonymization Rule:
                  // status IN ('applied', 'shortlisted') -> Candidate #[first 6 of candidate_id]
                  // status = 'interview_scheduled' or beyond (before placed) -> Full Name + note "Name shared for interview coordination"
                  // placed -> Full Name + note "Fully revealed — placement complete"
                  const isAnonymized = ['applied', 'shortlisted'].includes(app.status);
                  const isPlaced = app.status === 'placed';

                  return (
                    <tr key={app.id} className="hover:bg-[#F8FAFD] transition-colors">
                      {/* Candidate Identity */}
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {isAnonymized ? (
                          <div className="font-mono text-slate-800">
                            Candidate #{app.candidate_id.slice(0, 6).toUpperCase()}
                            <div className="text-[10px] text-slate-400 font-sans font-normal">
                              Anonymized prior to interview schedule
                            </div>
                          </div>
                        ) : isPlaced ? (
                          <div>
                            <div className="text-slate-900 font-bold">
                              {app.first_name} {app.last_name}
                            </div>
                            <div className="text-[10px] text-emerald-700 font-medium">
                              Fully revealed — placement complete
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-slate-900 font-bold">
                              {app.first_name} {app.last_name}
                            </div>
                            <div className="text-[10px] text-indigo-700 font-medium">
                              Name shared for interview coordination
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Job & Employer */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {app.job_title}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-1">
                          <Building2 className="w-3 h-3 text-slate-400" />
                          <span>{app.employer_name}</span>
                        </div>
                      </td>

                      {/* Fit Score */}
                      <td className="py-3.5 px-4 font-mono font-bold">
                        {app.fit_score != null ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] ${
                              app.fit_score >= 80
                                ? 'bg-emerald-100 text-emerald-800'
                                : app.fit_score >= 60
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {app.fit_score}%
                          </span>
                        ) : (
                          <span className="text-slate-400 font-sans font-normal">—</span>
                        )}
                      </td>

                      {/* Submitted by */}
                      <td className="py-3.5 px-4 text-slate-600">
                        {app.submitted_by === 'supplier'
                          ? app.supplier_name
                          : 'Direct Applicant'}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            app.status === 'placed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.status === 'offer_sent'
                              ? 'bg-purple-100 text-purple-800'
                              : app.status === 'interview_scheduled'
                              ? 'bg-blue-100 text-blue-800'
                              : app.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {app.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Interview & Feedback / Reason */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {app.interview_scheduled_at && (
                          <div className="text-[11px] text-blue-900 font-medium">
                            <Clock className="w-3 h-3 inline mr-1 text-blue-600" />
                            {formatDate(app.interview_scheduled_at)} {app.interview_time || ''}
                            {app.interview_notes && (
                              <div className="text-[10px] text-slate-500 italic mt-0.5">
                                {app.interview_notes}
                              </div>
                            )}
                          </div>
                        )}
                        {app.interview_feedback && (
                          <div className="text-[10px] text-emerald-800 mt-1 bg-emerald-50 p-1.5 rounded border border-emerald-100">
                            <span className="font-semibold">Feedback:</span> {app.interview_feedback}
                          </div>
                        )}
                        {app.rejection_reason && (
                          <div className="text-[10px] text-rose-800 mt-1 bg-rose-50 p-1.5 rounded border border-rose-100">
                            <span className="font-semibold">Reason:</span> {app.rejection_reason}
                          </div>
                        )}
                        {!app.interview_scheduled_at && !app.interview_feedback && !app.rejection_reason && (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Days since update */}
                      <td className="py-3.5 px-4 text-center font-bold">
                        <span
                          className={
                            app.days_since_update > 5
                              ? 'text-amber-600'
                              : 'text-slate-500'
                          }
                        >
                          {app.days_since_update}d
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Move Status Buttons */}
                          {validNext.map((next) => (
                            <button
                              key={next}
                              type="button"
                              disabled={updatingAppId === app.id}
                              onClick={() => handleMoveStatus(app, next)}
                              className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors shadow-2xs ${
                                next === 'rejected'
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                  : next === 'offer_sent'
                                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                                  : 'bg-[#1B3270] text-white hover:bg-[#2952A3]'
                              }`}
                            >
                              {updatingAppId === app.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                `Move to ${next.replace('_', ' ')}`
                              )}
                            </button>
                          ))}

                          {/* Raise Concern Button */}
                          <button
                            type="button"
                            title="Raise Operational Concern"
                            onClick={() => {
                              setEscalationApp(app);
                              setEscalationNote('');
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RAISE CONCERN / ESCALATION MODAL */}
      {escalationApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Raise Operational Concern
              </h3>
              <button
                type="button"
                onClick={() => setEscalationApp(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3 text-xs space-y-1">
              <div>
                Position:{' '}
                <span className="font-bold text-slate-900">
                  {escalationApp.job_title}
                </span>
              </div>
              <div>
                Hospital Facility:{' '}
                <span className="font-medium text-slate-700">
                  {escalationApp.employer_name}
                </span>
              </div>
              <div>
                Candidate:{' '}
                <span className="font-mono text-slate-800">
                  #{escalationApp.candidate_id.slice(0, 6).toUpperCase()}
                </span>
              </div>
            </div>

            <form onSubmit={handleRaiseConcern} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Concern / Blocker Note *
                </label>
                <textarea
                  rows={3}
                  required
                  value={escalationNote}
                  onChange={(e) => setEscalationNote(e.target.value)}
                  placeholder="Describe salary discrepancy, interview delay, visa blocker..."
                  className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setEscalationApp(null)}
                  className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={raisingEscalation}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                >
                  {raisingEscalation ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  )}
                  <span>File Escalation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerRmPipelineTab;
