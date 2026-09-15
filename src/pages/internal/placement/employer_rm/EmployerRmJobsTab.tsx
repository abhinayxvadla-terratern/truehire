import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Briefcase,
  Search,
  Plus,
  Building2,
  Play,
  Pause,
  XCircle,
  X,
  Loader2,
  Check,
} from 'lucide-react';

interface JobCardItem {
  id: string;
  title: string;
  location: string;
  role_type: string;
  description: string | null;
  status: string;
  submission_cap: number;
  current_submissions: number;
  employer_id: string;
  employer_name: string;
  created_at: string;
}

interface EmployerOption {
  id: string;
  company_name: string;
  location: string | null;
}

export const EmployerRmJobsTab: React.FC = () => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<JobCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [employerOptions, setEmployerOptions] = useState<EmployerOption[]>([]);
  const [selectedEmployerFilter, setSelectedEmployerFilter] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Status updates
  const [updatingJobId, setUpdatingJobId] = useState<string | null>(null);

  // Post Job modal
  const [postJobModalOpen, setPostJobModalOpen] = useState(false);
  const [modalEmployerId, setModalEmployerId] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalLocation, setModalLocation] = useState('');
  const [modalRoleType, setModalRoleType] = useState(
    'Registered Nurse (Krankenpfleger/in)'
  );
  const [modalDesc, setModalDesc] = useState('');
  const [modalCap, setModalCap] = useState(10);
  const [submittingJob, setSubmittingJob] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchJobsAndEmployers = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch assigned employers
      const { data: assignments, error: assErr } = await supabase
        .from('rm_assignments')
        .select(`
          entity_id,
          employers:entity_id (id, company_name, location)
        `)
        .eq('rm_profile_id', user.id)
        .eq('entity_type', 'employer')
        .eq('active', true);

      if (assErr) throw assErr;

      const empList = (assignments || [])
        .map((a: any) => a.employers)
        .filter(Boolean);

      setEmployerOptions(empList);
      const empIds = empList.map((e: any) => e.id);

      if (empIds.length === 0) {
        setJobs([]);
        return;
      }

      // 2. Fetch jobs for these employers
      const { data: jobData, error: jobErr } = await supabase
        .from('job_requirements')
        .select(`
          *,
          employers:employer_id (company_name)
        `)
        .in('employer_id', empIds)
        .order('created_at', { ascending: false });

      if (jobErr) throw jobErr;

      const mapped: JobCardItem[] = (jobData || []).map((j: any) => ({
        id: j.id,
        title: j.title,
        location: j.location,
        role_type: j.role_type,
        description: j.description,
        status: j.status,
        submission_cap: j.submission_cap,
        current_submissions: j.current_submissions,
        employer_id: j.employer_id,
        employer_name: j.employers?.company_name || 'Hospital Facility',
        created_at: j.created_at,
      }));

      setJobs(mapped);
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobsAndEmployers();
  }, [user]);

  const handleUpdateJobStatus = async (
    jobId: string,
    newStatus: 'active' | 'paused' | 'closed'
  ) => {
    try {
      setUpdatingJobId(jobId);

      const { error } = await supabase
        .from('job_requirements')
        .update({ status: newStatus })
        .eq('id', jobId);

      if (error) throw error;

      showToast(`Position status updated to ${newStatus}`);
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
      );
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setUpdatingJobId(null);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalEmployerId || !modalTitle.trim() || !modalLocation.trim()) return;

    try {
      setSubmittingJob(true);

      const { error } = await supabase.from('job_requirements').insert({
        employer_id: modalEmployerId,
        title: modalTitle.trim(),
        location: modalLocation.trim(),
        role_type: modalRoleType,
        description: modalDesc.trim() || null,
        submission_cap: Number(modalCap) || 10,
        current_submissions: 0,
        status: 'active',
      });

      if (error) throw error;

      showToast('Position created and published successfully.');
      setPostJobModalOpen(false);
      setModalEmployerId('');
      setModalTitle('');
      setModalLocation('');
      setModalDesc('');
      setModalCap(10);
      fetchJobsAndEmployers();
    } catch (err: any) {
      alert(`Failed to post job requirement: ${err.message}`);
    } finally {
      setSubmittingJob(false);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (
      selectedEmployerFilter !== 'all' &&
      job.employer_id !== selectedEmployerFilter
    )
      return false;
    if (selectedStatusFilter !== 'all' && job.status !== selectedStatusFilter)
      return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = job.title.toLowerCase().includes(q);
      const matchEmp = job.employer_name.toLowerCase().includes(q);
      const matchLoc = job.location.toLowerCase().includes(q);
      const matchRole = job.role_type.toLowerCase().includes(q);
      if (!matchTitle && !matchEmp && !matchLoc && !matchRole) return false;
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

      {/* Header & Post Job Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Hospital Requirements & Job Vacancies
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain clinical job quotas, adjust submission caps, and publish vacancies directly on behalf of healthcare facilities.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setPostJobModalOpen(true)}
          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Post on Employer's Behalf</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search job title, role, hospital, location..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          {/* Employer Filter */}
          <div>
            <select
              value={selectedEmployerFilter}
              onChange={(e) => setSelectedEmployerFilter(e.target.value)}
              className="w-full py-1.5 px-3 text-xs border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All My Employers</option>
              {employerOptions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.company_name}
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
              <option value="all">All Job Statuses</option>
              <option value="active">Active Only</option>
              <option value="paused">Paused</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-44 bg-white border border-[#E2E8F4] rounded-[10px] animate-pulse"
            />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] py-16 text-center shadow-2xs">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">
            No clinical requirements found
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Click "Post on Employer's Behalf" to publish a new hospital vacancy.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredJobs.map((job) => {
            const isUpdating = updatingJobId === job.id;
            const progressPercent = Math.min(
              100,
              Math.round((job.current_submissions / (job.submission_cap || 1)) * 100)
            );

            return (
              <div
                key={job.id}
                className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs space-y-4 hover:border-slate-300 transition-colors flex flex-col justify-between"
              >
                <div className="space-y-2">
                  {/* Top line: Employer & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-xs text-slate-600 font-semibold">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{job.employer_name}</span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        job.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : job.status === 'paused'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {job.status}
                    </span>
                  </div>

                  {/* Title & Role */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug">
                      {job.title}
                    </h3>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {job.location} • {job.role_type}
                    </div>
                  </div>

                  {job.description && (
                    <p className="text-xs text-slate-600 line-clamp-2 pt-1">
                      {job.description}
                    </p>
                  )}

                  {/* Submissions Bar */}
                  <div className="pt-2 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-600">
                        Submissions Pipeline
                      </span>
                      <span className="font-bold text-slate-900">
                        {job.current_submissions} / {job.submission_cap} candidates
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progressPercent >= 100
                            ? 'bg-rose-500'
                            : progressPercent >= 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom line: Date & Actions */}
                <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">
                    Created {new Date(job.created_at).toLocaleDateString()}
                  </span>

                  {/* Status Toggle Buttons */}
                  <div className="flex items-center space-x-1.5">
                    {job.status === 'active' ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateJobStatus(job.id, 'paused')}
                        className="px-2.5 py-1 bg-white border border-[#E2E8F4] hover:bg-amber-50 hover:text-amber-800 text-slate-700 rounded-[6px] text-[11px] font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Pause className="w-3 h-3" />
                        <span>Pause</span>
                      </button>
                    ) : job.status === 'paused' ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateJobStatus(job.id, 'active')}
                        className="px-2.5 py-1 bg-white border border-[#E2E8F4] hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 rounded-[6px] text-[11px] font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <Play className="w-3 h-3" />
                        <span>Resume</span>
                      </button>
                    ) : null}

                    {job.status !== 'closed' && (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleUpdateJobStatus(job.id, 'closed')}
                        className="px-2.5 py-1 bg-white border border-[#E2E8F4] hover:bg-rose-50 hover:text-rose-800 text-slate-700 rounded-[6px] text-[11px] font-semibold flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Close</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* POST JOB MODAL */}
      {postJobModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Post Job on Behalf of Healthcare Employer
              </h3>
              <button
                type="button"
                onClick={() => setPostJobModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Healthcare Employer *
                </label>
                <select
                  required
                  value={modalEmployerId}
                  onChange={(e) => {
                    setModalEmployerId(e.target.value);
                    const chosen = employerOptions.find((emp) => emp.id === e.target.value);
                    if (chosen?.location) {
                      setModalLocation(chosen.location);
                    }
                  }}
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                >
                  <option value="">Select Hospital / Facility...</option>
                  {employerOptions.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Position Title *
                </label>
                <input
                  type="text"
                  required
                  value={modalTitle}
                  onChange={(e) => setModalTitle(e.target.value)}
                  placeholder="e.g. Surgical Ward Nurse (OTA / OP-Pflegekraft)"
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Location *
                  </label>
                  <input
                    type="text"
                    required
                    value={modalLocation}
                    onChange={(e) => setModalLocation(e.target.value)}
                    placeholder="e.g. Frankfurt am Main, Germany"
                    className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Submission Cap *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={100}
                    value={modalCap}
                    onChange={(e) => setModalCap(Number(e.target.value))}
                    className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Clinical Role Type *
                </label>
                <select
                  value={modalRoleType}
                  onChange={(e) => setModalRoleType(e.target.value)}
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                >
                  <option value="Registered Nurse (Krankenpfleger/in)">
                    Registered Nurse (Krankenpfleger/in)
                  </option>
                  <option value="ICU / Anesthesia Specialist (Anästhesie/Intensivpflege)">
                    ICU / Anesthesia Specialist (Anästhesie/Intensivpflege)
                  </option>
                  <option value="Surgical / OR Nurse (OTA / OP-Pflege)">
                    Surgical / OR Nurse (OTA / OP-Pflege)
                  </option>
                  <option value="Pediatric Nurse (Gesundheits- und Kinderkrankenpflege)">
                    Pediatric Nurse (Gesundheits- und Kinderkrankenpflege)
                  </option>
                  <option value="Geriatric Care Specialist (Altenpfleger/in)">
                    Geriatric Care Specialist (Altenpfleger/in)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Job Description & Department Requirements
                </label>
                <textarea
                  rows={3}
                  value={modalDesc}
                  onChange={(e) => setModalDesc(e.target.value)}
                  placeholder="Ward protocols, shift rotation, B2 certification requirement..."
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setPostJobModalOpen(false)}
                  className="px-3.5 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingJob}
                  className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                >
                  {submittingJob ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Publish Requirement</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerRmJobsTab;
