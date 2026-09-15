import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  Briefcase,
  Search,
  Eye,
  X,
  Building,
  Loader2,
  Check,
  Users,
  MessageSquare,
  Heart,
  Trash2,
  CheckSquare,
} from 'lucide-react';
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

interface EmployerRow {
  id: string;
  user_id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  subscription_tier: string;
  created_at: string;
  contact_name?: string;
  contact_email?: string;
  rm_name?: string;
  rm_profile_id?: string;
  rm_assignment_id?: string;
  active_jobs_count: number;
  total_apps_count: number;
  // Updates
  team_members_count: number;
  profile_pct: number;
  onboarding_steps_count: number;
  unread_messages_count: number;
  healthcare_roles_hiring: string[] | null;
  preferred_source_countries: string[] | null;
  annual_hiring_volume: string | null;
  onboarding_checklist?: any;
}

interface JobRequirementItem {
  id: string;
  title: string;
  location: string;
  role_type: string;
  status: string;
  current_submissions: number;
  submission_cap: number;
  created_at: string;
}

interface RMOption {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  internal_role: string;
}

interface EmployerTeamMemberItem {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  created_at: string;
}

interface EmployerMessageItem {
  id: string;
  sender_type: string;
  sender_display_name: string | null;
  message: string;
  created_at: string;
}

interface ExpressedInterestItem {
  id: string;
  candidate_id: string;
  candidate_name: string;
  job_title: string;
  status: string;
  created_at: string;
}

export const EmployersTab: React.FC = () => {
  const { user } = useAuth();
  const [employers, setEmployers] = useState<EmployerRow[]>([]);
  const [rmOptions, setRmOptions] = useState<RMOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [subscriptionFilters, setSubscriptionFilters] = useState<string[]>([]);
  const [countryFilters, setCountryFilters] = useState<string[]>([]);
  const [rmFilter, setRmFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [employerToDelete, setEmployerToDelete] = useState<EmployerRow | null>(null);
  const [isDeletingEmployer, setIsDeletingEmployer] = useState(false);

  // Detail drawer
  const [selectedEmployer, setSelectedEmployer] = useState<EmployerRow | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [pipelineSummary, setPipelineSummary] = useState<Record<string, number>>({});
  const [employerJobs, setEmployerJobs] = useState<JobRequirementItem[]>([]);

  // Drawer Sub-sections
  const [teamMembers, setTeamMembers] = useState<EmployerTeamMemberItem[]>([]);
  const [messagesAudit, setMessagesAudit] = useState<EmployerMessageItem[]>([]);
  const [expressedInterests, setExpressedInterests] = useState<ExpressedInterestItem[]>([]);

  // Editable fields
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editIndustry, setEditIndustry] = useState('');
  const [editTier, setEditTier] = useState('');
  const [selectedRmId, setSelectedRmId] = useState('');
  const [savingEmployer, setSavingEmployer] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchEmployers = async () => {
    setLoading(true);
    try {
      // 1. Fetch internal team eligible for Employer RM
      const { data: teamData } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, internal_role')
        .eq('is_internal', true)
        .in('internal_role', [
          'employer_requirements_rm',
          'employer_partnerships_associate',
          'partnerships_lead',
          'super_admin',
        ]);
      if (teamData) {
        setRmOptions(teamData as RMOption[]);
      }

      // 2. Fetch employers with profile join
      const { data: empData, error: empErr } = await supabase
        .from('employers')
        .select(`
          id,
          user_id,
          company_name,
          location,
          industry,
          subscription_tier,
          created_at,
          description,
          website_url,
          year_established,
          company_size,
          primary_contact_name,
          healthcare_roles_hiring,
          preferred_source_countries,
          annual_hiring_volume,
          onboarding_checklist,
          profiles:user_id (first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (empErr) throw empErr;

      // 3. Fetch active RM assignments for employers
      const { data: rmData } = await supabase
        .from('rm_assignments')
        .select(`
          id,
          entity_id,
          rm_profile_id,
          profiles:rm_profile_id (first_name, last_name, email)
        `)
        .eq('entity_type', 'employer')
        .eq('active', true);

      const rmMap: Record<string, { id: string; rm_id: string; name: string }> = {};
      if (rmData) {
        rmData.forEach((item: any) => {
          if (item.entity_id) {
            const p = item.profiles;
            const name = p
              ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email
              : 'Assigned RM';
            rmMap[item.entity_id] = {
              id: item.id,
              rm_id: item.rm_profile_id,
              name,
            };
          }
        });
      }

      // 4. Counts: team members, unread messages, jobs, applications
      const [teamsRes, messagesRes, jobsRes, appsRes] = await Promise.all([
        supabase.from('employer_team_members').select('id, employer_id'),
        supabase
          .from('employer_rm_messages')
          .select('id, employer_id')
          .eq('read', false)
          .eq('sender_type', 'employer'),
        supabase.from('job_requirements').select('id, employer_id, status'),
        supabase.from('job_applications').select('id, job_id, job_requirements(employer_id)'),
      ]);

      const teamCountMap: Record<string, number> = {};
      (teamsRes.data || []).forEach((t: any) => {
        teamCountMap[t.employer_id] = (teamCountMap[t.employer_id] || 0) + 1;
      });

      const unreadMap: Record<string, number> = {};
      (messagesRes.data || []).forEach((m: any) => {
        unreadMap[m.employer_id] = (unreadMap[m.employer_id] || 0) + 1;
      });

      const jobsCountMap: Record<string, number> = {};
      (jobsRes.data || []).forEach((j: any) => {
        if (j.status === 'active') {
          jobsCountMap[j.employer_id] = (jobsCountMap[j.employer_id] || 0) + 1;
        }
      });

      const appsCountMap: Record<string, number> = {};
      (appsRes.data || []).forEach((a: any) => {
        const empId = a.job_requirements?.employer_id;
        if (empId) {
          appsCountMap[empId] = (appsCountMap[empId] || 0) + 1;
        }
      });

      const rows: EmployerRow[] = (empData || []).map((e: any) => {
        const contact = e.profiles;
        const contactName = contact
          ? `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Facility Lead'
          : '—';
        const contactEmail = contact?.email || '—';

        const rmInfo = rmMap[e.id];

        // Profile completeness (out of 10 attributes)
        const profileFields = [
          e.company_name,
          e.location,
          e.industry,
          e.description,
          e.website_url,
          e.year_established,
          e.company_size,
          e.primary_contact_name,
          e.healthcare_roles_hiring?.length ? 'has' : null,
          e.annual_hiring_volume,
        ];
        const filledFields = profileFields.filter(Boolean).length;
        const profilePct = Math.round((filledFields / 10) * 100);

        // Onboarding steps (out of 5)
        const activeJobs = jobsCountMap[e.id] || 0;
        const teamCount = teamCountMap[e.id] || 0;
        const checklist = e.onboarding_checklist || {};

        const steps = [
          Boolean(e.user_id),
          profilePct >= 50,
          activeJobs > 0 || Boolean(checklist.job_posted),
          teamCount > 0 || Boolean(checklist.team_invited),
          Boolean(rmInfo),
        ];
        const onboardingSteps = steps.filter(Boolean).length;

        return {
          id: e.id,
          user_id: e.user_id,
          company_name: e.company_name,
          location: e.location,
          industry: e.industry,
          subscription_tier: e.subscription_tier || 'standard',
          created_at: e.created_at,
          contact_name: contactName,
          contact_email: contactEmail,
          rm_name: rmInfo?.name || 'Unassigned',
          rm_profile_id: rmInfo?.rm_id,
          rm_assignment_id: rmInfo?.id,
          active_jobs_count: activeJobs,
          total_apps_count: appsCountMap[e.id] || 0,
          team_members_count: teamCount,
          profile_pct: profilePct,
          onboarding_steps_count: onboardingSteps,
          unread_messages_count: unreadMap[e.id] || 0,
          healthcare_roles_hiring: e.healthcare_roles_hiring || null,
          preferred_source_countries: e.preferred_source_countries || null,
          annual_hiring_volume: e.annual_hiring_volume || null,
          onboarding_checklist: e.onboarding_checklist,
        };
      });

      setEmployers(rows);
    } catch (err) {
      console.error('Error fetching employers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployers();
  }, []);

  const handleOpenDetail = async (emp: EmployerRow) => {
    setSelectedEmployer(emp);
    setEditCompanyName(emp.company_name);
    setEditLocation(emp.location || '');
    setEditIndustry(emp.industry || '');
    setEditTier(emp.subscription_tier);
    setSelectedRmId(emp.rm_profile_id || '');
    setDrawerLoading(true);

    try {
      const [jobsRes, appsRes, teamRes, msgsRes, interestsRes] = await Promise.all([
        // 1. Requirements
        supabase
          .from('job_requirements')
          .select('*')
          .eq('employer_id', emp.id)
          .order('created_at', { ascending: false }),

        // 2. Pipeline apps
        supabase
          .from('job_applications')
          .select('status, job_id, job_requirements(employer_id)')
          .eq('job_requirements.employer_id', emp.id),

        // 3. Team members
        supabase
          .from('employer_team_members')
          .select('id, full_name, email, role, status, created_at')
          .eq('employer_id', emp.id)
          .order('created_at', { ascending: false }),

        // 4. Messages audit
        supabase
          .from('employer_rm_messages')
          .select('id, sender_type, sender_display_name, message, created_at')
          .eq('employer_id', emp.id)
          .order('created_at', { ascending: false })
          .limit(25),

        // 5. Expressed interests
        supabase
          .from('employer_candidate_interests')
          .select(`
            id,
            candidate_id,
            status,
            created_at,
            candidates (first_name, last_name),
            job_requirements (title)
          `)
          .eq('employer_id', emp.id)
          .order('created_at', { ascending: false }),
      ]);

      const jobList: JobRequirementItem[] = jobsRes.data || [];
      setEmployerJobs(jobList);

      const counts: Record<string, number> = {
        submitted: 0,
        shortlisted: 0,
        interview: 0,
        offered: 0,
        placed: 0,
        rejected: 0,
      };
      (appsRes.data || []).forEach((a: any) => {
        const st = (a.status || '').toLowerCase();
        counts[st] = (counts[st] || 0) + 1;
      });
      setPipelineSummary(counts);

      setTeamMembers(teamRes.data || []);
      setMessagesAudit(msgsRes.data || []);

      const mappedInterests: ExpressedInterestItem[] = (interestsRes.data || []).map((i: any) => {
        const c = i.candidates;
        const cName = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : 'Candidate';
        const jTitle = i.job_requirements?.title || 'General Pipeline';
        return {
          id: i.id,
          candidate_id: i.candidate_id,
          candidate_name: cName || `Candidate #${i.candidate_id.slice(0, 6)}`,
          job_title: jTitle,
          status: i.status || 'expressed',
          created_at: i.created_at,
        };
      });
      setExpressedInterests(mappedInterests);
    } catch (err) {
      console.error('Error fetching employer details:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleSaveEmployer = async () => {
    if (!selectedEmployer || !user) return;
    setSavingEmployer(true);

    try {
      // 1. Update employer profile
      const { error: updateErr } = await supabase
        .from('employers')
        .update({
          company_name: editCompanyName.trim(),
          location: editLocation.trim() || null,
          industry: editIndustry.trim() || null,
          subscription_tier: editTier,
        })
        .eq('id', selectedEmployer.id);

      if (updateErr) throw updateErr;

      // 2. Handle RM assignment
      let updatedRmName = selectedEmployer.rm_name;
      let updatedRmAssignmentId = selectedEmployer.rm_assignment_id;

      if (selectedRmId !== (selectedEmployer.rm_profile_id || '')) {
        if (selectedEmployer.rm_assignment_id) {
          await supabase
            .from('rm_assignments')
            .update({ active: false })
            .eq('id', selectedEmployer.rm_assignment_id);
        }

        if (selectedRmId) {
          const { data: newAssign, error: assignErr } = await supabase
            .from('rm_assignments')
            .insert({
              entity_id: selectedEmployer.id,
              entity_type: 'employer',
              rm_profile_id: selectedRmId,
              assigned_by: user.id,
              active: true,
            })
            .select('id')
            .single();

          if (assignErr) throw assignErr;
          updatedRmAssignmentId = newAssign.id;
          const assignedRm = rmOptions.find((r) => r.id === selectedRmId);
          updatedRmName = assignedRm
            ? `${assignedRm.first_name} ${assignedRm.last_name}`
            : 'Assigned RM';
        } else {
          updatedRmName = 'Unassigned';
          updatedRmAssignmentId = undefined;
        }
      }

      const updated: EmployerRow = {
        ...selectedEmployer,
        company_name: editCompanyName.trim(),
        location: editLocation.trim() || null,
        industry: editIndustry.trim() || null,
        subscription_tier: editTier,
        rm_name: updatedRmName,
        rm_profile_id: selectedRmId || undefined,
        rm_assignment_id: updatedRmAssignmentId,
      };

      setEmployers((prev) => prev.map((e) => (e.id === selectedEmployer.id ? updated : e)));
      setSelectedEmployer(updated);
      showToast('Employer record saved successfully');
    } catch (err: any) {
      alert(`Error updating employer: ${err.message}`);
    } finally {
      setSavingEmployer(false);
    }
  };

  const subscriptionOptions = [
    { value: 'standard', label: 'Standard' },
    { value: 'premium', label: 'Premium' },
    { value: 'enterprise', label: 'Enterprise' },
  ];

  const countryOptions = employers.reduce<{ value: string; label: string }[]>((acc, e) => {
    if (e.location && e.location.trim() && !acc.some((o) => o.value === e.location?.trim())) {
      acc.push({ value: e.location.trim(), label: e.location.trim() });
    }
    return acc;
  }, []);

  const handleDeleteEmployerConfirm = async () => {
    if (!employerToDelete) return;
    setIsDeletingEmployer(true);
    try {
      const { error } = await supabase.rpc('admin_delete_employer', {
        p_employer_id: employerToDelete.id,
      });
      if (error) throw error;

      showToast('Employer deleted.');
      setEmployerToDelete(null);
      if (selectedEmployer?.id === employerToDelete.id) {
        setSelectedEmployer(null);
      }
      fetchEmployers();
    } catch (err: any) {
      alert(`Failed to delete employer: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeletingEmployer(false);
    }
  };

  const filteredEmployers = employers.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    if (
      q &&
      !e.company_name.toLowerCase().includes(q) &&
      !e.location?.toLowerCase().includes(q) &&
      !e.contact_email?.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (subscriptionFilters.length > 0 && !subscriptionFilters.includes(e.subscription_tier)) {
      return false;
    }
    if (countryFilters.length > 0 && (!e.location || !countryFilters.includes(e.location))) {
      return false;
    }
    if (rmFilter === 'assigned' && (!e.rm_name || e.rm_name === 'Unassigned')) {
      return false;
    }
    if (rmFilter === 'unassigned' && e.rm_name && e.rm_name !== 'Unassigned') {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[6px] shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">All Employers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Healthcare facilities, hospital networks, staffing volumes, and dedicated account management.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-white border border-[#E2E8F4] px-3 py-1.5 rounded-[6px] shadow-2xs">
          <Building className="w-3.5 h-3.5 text-[#1B3270]" />
          <span>Registered Facilities: <strong className="text-slate-800">{employers.length}</strong></span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search facility name, location, or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-[6px] border border-[#E2E8F4] focus:ring-1 focus:ring-[#1B3270] outline-none"
          />
        </div>
        <div className="w-full sm:w-44">
          <MultiSelectFilter
            label="Subscription"
            options={subscriptionOptions}
            selectedValues={subscriptionFilters}
            onChange={setSubscriptionFilters}
          />
        </div>
        {countryOptions.length > 0 && (
          <div className="w-full sm:w-44">
            <MultiSelectFilter
              label="Country"
              options={countryOptions}
              selectedValues={countryFilters}
              onChange={setCountryFilters}
            />
          </div>
        )}
        <div className="w-full sm:w-44">
          <select
            value={rmFilter}
            onChange={(e) => setRmFilter(e.target.value as any)}
            className="w-full h-9 px-3 text-xs rounded-[6px] border border-[#E2E8F4] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-700 cursor-pointer"
          >
            <option value="all">All RM Status</option>
            <option value="assigned">RM Assigned</option>
            <option value="unassigned">Unassigned</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredEmployers.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Briefcase className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No employers found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || subscriptionFilters.length > 0 || countryFilters.length > 0
                ? 'No matching facilities found for these filters.'
                : 'Employers will appear here once onboarded.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3.5 px-4">Hospital / Facility</th>
                  <th className="py-3.5 px-4">Location</th>
                  <th className="py-3.5 px-4 text-center">Team</th>
                  <th className="py-3.5 px-4 text-center">Profile</th>
                  <th className="py-3.5 px-4 text-center">Onboarding</th>
                  <th className="py-3.5 px-4 text-center">Messages</th>
                  <th className="py-3.5 px-4">Account Manager</th>
                  <th className="py-3.5 px-4 text-center">Active Jobs</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredEmployers.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{emp.company_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {emp.contact_email}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {emp.location || 'Germany'}
                    </td>
                    {/* Team Members Column */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium">
                      {emp.team_members_count}
                    </td>
                    {/* Profile Completeness Column */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center space-x-1.5">
                        <span className="font-mono font-bold text-slate-700">{emp.profile_pct}%</span>
                        <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              emp.profile_pct >= 80
                                ? 'bg-emerald-500'
                                : emp.profile_pct >= 50
                                ? 'bg-amber-500'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${emp.profile_pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    {/* Onboarding Steps Column */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          emp.onboarding_steps_count === 5
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {emp.onboarding_steps_count}/5
                      </span>
                    </td>
                    {/* Messages Unread Column */}
                    <td className="py-3.5 px-4 text-center">
                      {emp.unread_messages_count > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white animate-pulse">
                          {emp.unread_messages_count} new
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {emp.rm_name}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold font-mono">
                      {emp.active_jobs_count}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(emp)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#1B3270] bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-[#F0F4FF] transition-colors shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmployerToDelete(emp)}
                          className="inline-flex items-center space-x-1 h-7 px-2.5 text-xs font-semibold text-[#EF4444] border border-[#EF4444] rounded-[6px] hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete employer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EMPLOYER DETAIL DRAWER */}
      {selectedEmployer && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/30 backdrop-blur-2xs">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-[#E2E8F4] animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-[#1B3270] text-white flex items-center justify-center font-bold text-sm">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#1B3270]">
                    {selectedEmployer.company_name}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {selectedEmployer.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
              {drawerLoading ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading facility details...</p>
                </div>
              ) : (
                <>
                  {/* Pipeline Summary Bar */}
                  {Object.keys(pipelineSummary).length > 0 && (
                    <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Candidate Pipeline</span>
                      <div className="flex items-center space-x-2 text-[11px] font-medium">
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800">Applied: {pipelineSummary.applied || 0}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800">Interview: {pipelineSummary.interview_scheduled || 0}</span>
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Placed: {pipelineSummary.placed || 0}</span>
                      </div>
                    </div>
                  )}
              <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 space-y-3">
                <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                  <Building className="w-4 h-4 text-[#2952A3]" />
                  <span>Facility Identity</span>
                </h3>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Facility / Group Name
                  </label>
                  <input
                    type="text"
                    value={editCompanyName}
                    onChange={(e) => setEditCompanyName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Location / Region
                    </label>
                    <input
                      type="text"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs outline-none focus:ring-1 focus:ring-[#1B3270]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Sector / Specialty
                    </label>
                    <input
                      type="text"
                      value={editIndustry}
                      onChange={(e) => setEditIndustry(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs outline-none focus:ring-1 focus:ring-[#1B3270]"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#E2E8F4] text-[11px] text-slate-500">
                  <span className="font-semibold">Linked Account:</span> {selectedEmployer.contact_name} ({selectedEmployer.contact_email})
                </div>
              </div>

              {/* RM Assignment */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-2 shadow-2xs">
                <h3 className="font-bold text-[#1B3270] text-sm">Designated Account Manager</h3>
                <select
                  value={selectedRmId}
                  onChange={(e) => setSelectedRmId(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs outline-none bg-white focus:ring-1 focus:ring-[#1B3270]"
                >
                  <option value="">No RM Assigned</option>
                  {rmOptions.map((rm) => (
                    <option key={rm.id} value={rm.id}>
                      {rm.first_name} {rm.last_name} ({rm.internal_role.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
              </div>

              {/* SECTION: HIRING NEEDS (READ-ONLY) (NEW) */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <Heart className="w-4 h-4 text-[#1B3270]" />
                  <h3 className="font-bold text-[#1B3270] text-sm">Clinical Hiring Profile</h3>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                      Roles Needed
                    </span>
                    {selectedEmployer.healthcare_roles_hiring?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedEmployer.healthcare_roles_hiring.map((r, i) => (
                          <span key={i} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[11px] border border-blue-200 capitalize">
                            {r.replace('_', ' ')}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No specific roles selected yet</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Annual Volume
                      </span>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {selectedEmployer.annual_hiring_volume || 'Not specified'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                        Preferred Sources
                      </span>
                      <p className="font-semibold text-slate-800 mt-0.5">
                        {selectedEmployer.preferred_source_countries?.join(', ') || 'Any ethical sourcing partner'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: ONBOARDING CHECKLIST (NEW) */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-4 h-4 text-[#1B3270]" />
                  <h3 className="font-bold text-[#1B3270] text-sm">Onboarding Checklist ({selectedEmployer.onboarding_steps_count}/5)</h3>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Employer Account Created', done: Boolean(selectedEmployer.user_id) },
                    { label: 'Company Profile ≥ 50% Complete', done: selectedEmployer.profile_pct >= 50 },
                    { label: 'First Job Requirement Posted', done: selectedEmployer.active_jobs_count > 0 },
                    { label: 'Facility Team Members Added', done: teamMembers.length > 0 },
                    { label: 'Dedicated Account Manager Assigned', done: Boolean(selectedEmployer.rm_assignment_id || selectedRmId) },
                  ].map((step, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200">
                      <span className="font-medium text-slate-700">{step.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          step.done
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {step.done ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION: TEAM MEMBERS (READ-ONLY) (NEW) */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-[#1B3270]" />
                  <h3 className="font-bold text-[#1B3270] text-sm">Facility Team Members ({teamMembers.length})</h3>
                </div>
                {teamMembers.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-2">No team members registered under this facility.</p>
                ) : (
                  <div className="divide-y divide-[#E2E8F4]">
                    {teamMembers.map((m) => (
                      <div key={m.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">{m.full_name || 'Team Member'}</p>
                          <p className="text-[11px] text-slate-400">{m.email}</p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 capitalize">
                            {m.role}
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(m.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: EXPRESSED INTERESTS (NEW) */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                <div className="flex items-center space-x-2">
                  <Heart className="w-4 h-4 text-rose-500" />
                  <h3 className="font-bold text-[#1B3270] text-sm">Expressed Interests ({expressedInterests.length})</h3>
                </div>
                {expressedInterests.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-2">Employer has not bookmarked or expressed interest in talent yet.</p>
                ) : (
                  <div className="divide-y divide-[#E2E8F4] max-h-48 overflow-y-auto">
                    {expressedInterests.map((interest) => (
                      <div key={interest.id} className="py-2 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">
                            {interest.candidate_name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Re: {interest.job_title} • {new Date(interest.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 capitalize">
                          {interest.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: MESSAGES AUDIT (READ-ONLY) (NEW) */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-[#1B3270]" />
                    <h3 className="font-bold text-[#1B3270] text-sm">Messages Audit Feed</h3>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Read-only conversation log</span>
                </div>

                {messagesAudit.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-2">No messages between facility and account manager yet.</p>
                ) : (
                  <div className="divide-y divide-[#E2E8F4] max-h-56 overflow-y-auto space-y-2 pt-1">
                    {messagesAudit.map((m) => (
                      <div key={m.id} className="py-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-800">
                            {m.sender_display_name || (m.sender_type === 'employer' ? 'Facility Contact' : 'Account Manager')}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                            • {new Date(m.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="p-2 rounded bg-slate-50 border border-slate-200 text-slate-700 text-xs leading-relaxed">
                          {m.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Jobs List */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 shadow-2xs space-y-2">
                <h3 className="font-bold text-[#1B3270] text-sm">Job Requirements ({employerJobs.length})</h3>
                {employerJobs.length === 0 ? (
                  <p className="text-slate-400 italic text-center py-2">No requirements posted yet.</p>
                ) : (
                  <div className="divide-y divide-[#E2E8F4]">
                    {employerJobs.map((j) => (
                      <div key={j.id} className="py-2 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-800">{j.title}</p>
                          <p className="text-[10px] text-slate-400">{j.location} • {j.role_type}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                          {j.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              </>
            )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setSelectedEmployer(null)}
                className="px-4 py-2 border border-[#E2E8F4] text-slate-600 rounded-[6px] font-semibold hover:bg-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveEmployer}
                disabled={savingEmployer}
                className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1"
              >
                {savingEmployer ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Changes</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {employerToDelete && (
        <DeleteConfirmationModal
          isOpen={true}
          tier="tier1"
          entityType="Employer"
          entityName={employerToDelete.company_name}
          onClose={() => setEmployerToDelete(null)}
          onConfirm={handleDeleteEmployerConfirm}
          isDeleting={isDeletingEmployer}
        />
      )}
    </div>
  );
};
