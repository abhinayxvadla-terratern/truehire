import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Building2,
  Search,
  Eye,
  Plus,
  X,
  Loader2,
  Check,
  Save,
  CheckCircle,
  Circle,
  Mail,
} from 'lucide-react';

interface EmployerRow {
  id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  subscription_tier: string;
  active_jobs_count: number;
  total_applications_count: number;
  last_activity: string;
  created_at: string;
  raw?: any;
}

interface EmployerJobItem {
  id: string;
  title: string;
  location: string;
  role_type: string;
  status: string;
  submission_cap: number;
  current_submissions: number;
}

export const EmployerRmEmployersTab: React.FC = () => {
  const { user } = useAuth();
  const [employers, setEmployers] = useState<EmployerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail Drawer
  const [selectedEmployer, setSelectedEmployer] = useState<EmployerRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [savingEmployer, setSavingEmployer] = useState(false);

  const [employerJobs, setEmployerJobs] = useState<EmployerJobItem[]>([]);
  const [employerTeamMembers, setEmployerTeamMembers] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  // Post Job Modal
  const [postJobModalOpen, setPostJobModalOpen] = useState(false);
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newJobLocation, setNewJobLocation] = useState('');
  const [newJobRoleType, setNewJobRoleType] = useState('Registered Nurse (Krankenpfleger/in)');
  const [newJobDesc, setNewJobDesc] = useState('');
  const [newJobCap, setNewJobCap] = useState(10);
  const [submittingJob, setSubmittingJob] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchMyEmployers = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch assigned employers
      const { data: assignments, error: assErr } = await supabase
        .from('rm_assignments')
        .select(`
          entity_id,
          employers:entity_id (*)
        `)
        .eq('rm_profile_id', user.id)
        .eq('entity_type', 'employer')
        .eq('active', true);

      if (assErr) throw assErr;

      const empList = (assignments || [])
        .map((a: any) => a.employers)
        .filter(Boolean);

      const empIds = empList.map((e: any) => e.id);

      if (empIds.length === 0) {
        setEmployers([]);
        return;
      }

      // 2. Fetch jobs for these employers
      const { data: allJobs } = await supabase
        .from('job_requirements')
        .select('id, employer_id, status, created_at')
        .in('employer_id', empIds);

      const jobMap: Record<string, any[]> = {};
      (allJobs || []).forEach((j) => {
        jobMap[j.employer_id] = jobMap[j.employer_id] || [];
        jobMap[j.employer_id].push(j);
      });

      // 3. Fetch applications for these employers
      const jobIds = (allJobs || []).map((j) => j.id);
      const appMap: Record<string, number> = {};

      if (jobIds.length > 0) {
        const { data: allApps } = await supabase
          .from('job_applications')
          .select('id, job_id')
          .in('job_id', jobIds);

        (allApps || []).forEach((a) => {
          const j = (allJobs || []).find((jb) => jb.id === a.job_id);
          if (j) {
            appMap[j.employer_id] = (appMap[j.employer_id] || 0) + 1;
          }
        });
      }

      const rows: EmployerRow[] = empList.map((e: any) => {
        const jobs = jobMap[e.id] || [];
        const activeJobs = jobs.filter((j) => j.status === 'active').length;
        const totalApps = appMap[e.id] || 0;

        let lastDate = e.created_at;
        jobs.forEach((j) => {
          if (j.created_at > lastDate) lastDate = j.created_at;
        });

        return {
          id: e.id,
          company_name: e.company_name,
          location: e.location,
          industry: e.industry,
          subscription_tier: e.subscription_tier || 'basic',
          active_jobs_count: activeJobs,
          total_applications_count: totalApps,
          last_activity: lastDate,
          created_at: e.created_at,
          raw: e,
        };
      });

      setEmployers(rows);
    } catch (err) {
      console.error('Error fetching Employer RM employers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyEmployers();
  }, [user]);

  const handleOpenDetail = async (emp: EmployerRow) => {
    setSelectedEmployer(emp);
    setEditName(emp.company_name);
    setEditLocation(emp.location || '');
    setEditIndustry(emp.industry || '');
    setJobsLoading(true);

    try {
      const [jobsRes, teamRes] = await Promise.all([
        supabase
          .from('job_requirements')
          .select('*')
          .eq('employer_id', emp.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('employer_team_members')
          .select('*')
          .eq('employer_id', emp.id)
          .order('created_at', { ascending: false }),
      ]);

      setEmployerJobs(jobsRes.data || []);
      setEmployerTeamMembers(teamRes.data || []);
    } catch (err) {
      console.error('Error fetching employer jobs and team:', err);
    } finally {
      setJobsLoading(false);
    }
  };

  const handleSaveEmployerInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployer) return;

    try {
      setSavingEmployer(true);

      const { error } = await supabase
        .from('employers')
        .update({
          company_name: editName.trim(),
          location: editLocation.trim() || null,
          industry: editIndustry.trim() || null,
        })
        .eq('id', selectedEmployer.id);

      if (error) throw error;

      showToast('Facility profile updated successfully');
      setSelectedEmployer((prev) =>
        prev
          ? {
              ...prev,
              company_name: editName.trim(),
              location: editLocation.trim(),
              industry: editIndustry.trim(),
            }
          : null
      );
      fetchMyEmployers();
    } catch (err: any) {
      alert(`Failed to save employer info: ${err.message}`);
    } finally {
      setSavingEmployer(false);
    }
  };

  const handleCreateJobForEmployer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployer || !newJobTitle.trim() || !newJobLocation.trim()) return;

    try {
      setSubmittingJob(true);

      const { error } = await supabase.from('job_requirements').insert({
        employer_id: selectedEmployer.id,
        title: newJobTitle.trim(),
        location: newJobLocation.trim(),
        role_type: newJobRoleType,
        description: newJobDesc.trim() || null,
        submission_cap: Number(newJobCap) || 10,
        current_submissions: 0,
        status: 'active',
      });

      if (error) throw error;

      showToast(`Position posted for ${selectedEmployer.company_name}`);
      setPostJobModalOpen(false);
      setNewJobTitle('');
      setNewJobLocation('');
      setNewJobDesc('');
      setNewJobCap(10);

      // Refresh drawer jobs
      handleOpenDetail(selectedEmployer);
      fetchMyEmployers();
    } catch (err: any) {
      alert(`Failed to post job requirement: ${err.message}`);
    } finally {
      setSubmittingJob(false);
    }
  };

  const filteredEmployers = employers.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.company_name.toLowerCase().includes(q) ||
      (e.location || '').toLowerCase().includes(q) ||
      (e.industry || '').toLowerCase().includes(q)
    );
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
          Assigned Healthcare Employers
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Partner hospitals, clinic groups, and care centers managed under your Relationship Management account.
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search healthcare employer, location, clinical specialty..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          />
        </div>
      </div>

      {/* Employers Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredEmployers.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">
              No employers assigned
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              You do not have any active employer assignments. Contact your Placement Lead.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Hospital / Employer Name</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Subscription Tier</th>
                  <th className="py-3 px-4 text-center">Active Jobs</th>
                  <th className="py-3 px-4 text-center">Total Applications</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredEmployers.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{emp.company_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {emp.industry || 'Healthcare Provider'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      {emp.location || '—'}
                    </td>

                    <td className="py-3.5 px-4 capitalize">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {emp.subscription_tier}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                      {emp.active_jobs_count}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {emp.total_applications_count}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(emp.last_activity).toLocaleDateString()}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(emp)}
                        className="px-2.5 py-1 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs inline-flex items-center space-x-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL DRAWER */}
      {selectedEmployer && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {selectedEmployer.company_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Tier: {selectedEmployer.subscription_tier.toUpperCase()} •{' '}
                  {selectedEmployer.location || 'Location unspecified'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployer(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* EDITABLE COMPANY INFO */}
              <div className="bg-slate-50 border border-[#E2E8F4] rounded-[8px] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Edit Healthcare Provider Profile
                  </span>
                  <span className="text-[10px] text-slate-400">RM Privileges</span>
                </div>

                <form onSubmit={handleSaveEmployerInfo} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                      Company / Hospital Legal Name
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-xs p-2 bg-white border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Location / City
                      </label>
                      <input
                        type="text"
                        value={editLocation}
                        onChange={(e) => setEditLocation(e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">
                        Clinical Sector / Industry
                      </label>
                      <input
                        type="text"
                        value={editIndustry}
                        onChange={(e) => setEditIndustry(e.target.value)}
                        className="w-full text-xs p-2 bg-white border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={savingEmployer}
                      className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1 shadow-2xs cursor-pointer"
                    >
                      {savingEmployer ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>Save Profile Changes</span>
                    </button>
                  </div>
                </form>

                {/* Extended Facility Metadata */}
                <div className="mt-4 pt-4 border-t border-[#E2E8F4] grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <span className="text-slate-400 block font-medium">Country</span>
                    <span className="text-slate-800 font-semibold">
                      {selectedEmployer.raw?.country || 'Germany'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Facility Size</span>
                    <span className="text-slate-800 font-semibold">
                      {selectedEmployer.raw?.company_size || 'Unspecified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Primary Contact</span>
                    <span className="text-slate-800 font-semibold">
                      {selectedEmployer.raw?.primary_contact_name || 'Unspecified'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Annual Hiring Volume</span>
                    <span className="text-slate-800 font-semibold">
                      {selectedEmployer.raw?.annual_hiring_volume || 'Unspecified'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block font-medium">Office Address</span>
                    <span className="text-slate-800 font-semibold">
                      {selectedEmployer.raw?.office_address || 'Unspecified'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block font-medium">Healthcare Roles Hiring</span>
                    <span className="text-slate-800 font-semibold">
                      {Array.isArray(selectedEmployer.raw?.healthcare_roles_hiring)
                        ? selectedEmployer.raw.healthcare_roles_hiring.join(', ')
                        : selectedEmployer.raw?.healthcare_roles_hiring || 'Nursing & Clinical Care'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ONBOARDING CHECKLIST */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Onboarding Checklist Progress
                  </h4>
                  {(() => {
                    const chk = selectedEmployer.raw?.onboarding_checklist || {};
                    const items = [
                      chk.profile_completed,
                      chk.rm_assigned ?? true,
                      chk.first_requirement_posted ?? employerJobs.length > 0,
                      chk.talent_pool_browsed,
                      chk.first_placement,
                    ];
                    const completedCount = items.filter(Boolean).length;
                    return (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1B3270]/10 text-[#1B3270]">
                        {completedCount} of 5 Completed
                      </span>
                    );
                  })()}
                </div>

                {(() => {
                  const chk = selectedEmployer.raw?.onboarding_checklist || {};
                  const steps = [
                    { label: 'Hospital Profile Completed', done: !!chk.profile_completed },
                    { label: 'Account Manager Assigned', done: chk.rm_assigned ?? true },
                    {
                      label: 'First Job Requirement Posted',
                      done: !!chk.first_requirement_posted || employerJobs.length > 0,
                    },
                    { label: 'Talent Pool Browsed', done: !!chk.talent_pool_browsed },
                    { label: 'First Candidate Placed', done: !!chk.first_placement },
                  ];

                  return (
                    <div className="space-y-2">
                      {steps.map((step, idx) => (
                        <div
                          key={idx}
                          className="flex items-center space-x-2 text-xs text-slate-700"
                        >
                          {step.done ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Circle className="w-4 h-4 text-slate-300 shrink-0" />
                          )}
                          <span className={step.done ? 'font-medium text-slate-900' : 'text-slate-500'}>
                            {step.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* TEAM MEMBERS */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Authorized Team Members ({employerTeamMembers.length})
                  </h4>
                </div>

                {employerTeamMembers.length === 0 ? (
                  <p className="text-slate-400 italic py-2 text-center text-xs">
                    No authorized team members registered yet.
                  </p>
                ) : (
                  <div className="border border-[#E2E8F4] rounded-[6px] divide-y divide-[#E2E8F4] overflow-hidden">
                    {employerTeamMembers.map((tm) => (
                      <div
                        key={tm.id}
                        className="p-3 flex items-center justify-between hover:bg-slate-50 text-xs"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {tm.first_name} {tm.last_name}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center space-x-1 mt-0.5">
                            <Mail className="w-3 h-3 text-slate-400" />
                            <span>{tm.email}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                            {tm.role?.replace(/_/g, ' ') || 'Member'}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-0.5 capitalize">
                            {tm.invite_status || 'active'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* POSTED JOB REQUIREMENTS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Job Requirements ({employerJobs.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      setNewJobLocation(selectedEmployer.location || 'Berlin, Germany');
                      setPostJobModalOpen(true);
                    }}
                    className="px-2.5 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Post on Employer's Behalf</span>
                  </button>
                </div>

                {jobsLoading ? (
                  <div className="py-8 text-center space-y-2">
                    <Loader2 className="w-5 h-5 animate-spin text-[#1B3270] mx-auto" />
                    <p className="text-slate-500">Loading requirements...</p>
                  </div>
                ) : employerJobs.length === 0 ? (
                  <p className="text-slate-400 italic py-4 text-center">
                    This hospital has no job requirements posted yet.
                  </p>
                ) : (
                  <div className="border border-[#E2E8F4] rounded-[8px] overflow-hidden divide-y divide-[#E2E8F4]">
                    {employerJobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-3 flex items-center justify-between hover:bg-slate-50"
                      >
                        <div>
                          <div className="font-bold text-slate-900">
                            {job.title}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {job.location} • {job.role_type}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              job.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {job.status}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {job.current_submissions} / {job.submission_cap} candidates
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E2E8F4] bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmployer(null)}
                className="px-4 py-2 bg-white border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POST JOB MODAL */}
      {postJobModalOpen && selectedEmployer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Post Job for {selectedEmployer.company_name}
              </h3>
              <button
                type="button"
                onClick={() => setPostJobModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJobForEmployer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Position Title *
                </label>
                <input
                  type="text"
                  required
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  placeholder="e.g. Ward Clinical Nurse (Gesundheits- und Krankenpfleger)"
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
                    value={newJobLocation}
                    onChange={(e) => setNewJobLocation(e.target.value)}
                    placeholder="e.g. Munich, Germany"
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
                    value={newJobCap}
                    onChange={(e) => setNewJobCap(Number(e.target.value))}
                    className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Role Type *
                </label>
                <select
                  value={newJobRoleType}
                  onChange={(e) => setNewJobRoleType(e.target.value)}
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
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                  placeholder="Department specifics, shift rotation, B2 certification requirement..."
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setPostJobModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingJob}
                  className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs"
                >
                  {submittingJob ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Post Job</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerRmEmployersTab;
