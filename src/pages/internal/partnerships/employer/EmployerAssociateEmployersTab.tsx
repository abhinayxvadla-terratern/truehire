import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Briefcase,
  Search,
  Eye,
  X,
  Layers,
  Building,
  Users,
  CheckCircle,
  AlertTriangle,
  Heart,
  Globe,
  CheckSquare,
  Loader2,
  Check,
  Bell,
} from 'lucide-react';
import { notifyByRole } from '../../../../utils/notificationRouting';

interface EmployerRow {
  id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  subscription_tier: string;
  created_at: string;
  rm_name: string;
  has_rm: boolean;
  active_jobs_count: number;
  team_members_count: number;
  profile_pct: number;
  checklist_completed_count: number;
  healthcare_roles_hiring?: string[];
  preferred_source_countries?: string[];
  annual_hiring_volume?: string | null;
  onboarding_checklist?: any;
}

interface EmployerTeamMemberItem {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  role: string;
  invite_status: string;
}

const ONBOARDING_STEPS = [
  { key: 'profile_completed', label: 'Company profile completed' },
  { key: 'rm_assigned', label: 'Account manager assigned' },
  { key: 'first_requirement_posted', label: 'First job requirement posted' },
  { key: 'talent_pool_browsed', label: 'Browsed candidate talent pool' },
  { key: 'first_placement', label: 'First candidate placed' },
];

interface EmployerAssociateEmployersTabProps {
  initialSelectedEmployerId?: string | null;
}

export const EmployerAssociateEmployersTab: React.FC<EmployerAssociateEmployersTabProps> = ({
  initialSelectedEmployerId,
}) => {
  const { user } = useAuth();
  const [employers, setEmployers] = useState<EmployerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Detail Drawer
  const [selectedEmployer, setSelectedEmployer] = useState<EmployerRow | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<EmployerTeamMemberItem[]>([]);

  // Notifications
  const [notifying, setNotifying] = useState(false);
  const [notifiedEmployers, setNotifiedEmployers] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isNotifiedRecent = (employerId: string) => {
    if (notifiedEmployers.has(employerId)) return true;
    try {
      const stored = localStorage.getItem(`rm_notified_emp_${employerId}`);
      if (!stored) return false;
      const timeDiff = Date.now() - parseInt(stored, 10);
      return timeDiff < 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  };

  const fetchMyEmployers = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // 1. Fetch employers created by this associate
      const { data: emps, error } = await supabase
        .from('employers')
        .select(`
          id,
          company_name,
          company_size,
          location,
          country,
          office_address,
          primary_contact_name,
          industry,
          subscription_tier,
          created_at,
          healthcare_roles_hiring,
          preferred_source_countries,
          annual_hiring_volume,
          onboarding_checklist
        `)
        .eq('created_by_internal', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const empList = emps || [];
      const empIds = empList.map((e) => e.id);

      // 2. Fetch RM names
      const rmMap: Record<string, string> = {};
      if (empIds.length > 0) {
        const { data: rmData } = await supabase
          .from('rm_assignments')
          .select(`
            entity_id,
            profiles:rm_profile_id(first_name, last_name, email)
          `)
          .eq('entity_type', 'employer')
          .eq('active', true)
          .in('entity_id', empIds);

        (rmData || []).forEach((rm: any) => {
          const name = rm.profiles
            ? `${rm.profiles.first_name || ''} ${rm.profiles.last_name || ''}`.trim() || rm.profiles.email
            : 'Assigned RM';
          rmMap[rm.entity_id] = name;
        });
      }

      // 3. Team member counts
      const teamCountMap: Record<string, number> = {};
      if (empIds.length > 0) {
        const { data: teamData } = await supabase
          .from('employer_team_members')
          .select('employer_id')
          .in('employer_id', empIds);

        (teamData || []).forEach((tm) => {
          teamCountMap[tm.employer_id] = (teamCountMap[tm.employer_id] || 0) + 1;
        });
      }

      // 4. Active jobs count
      const jobCountMap: Record<string, number> = {};
      if (empIds.length > 0) {
        const { data: jobs } = await supabase
          .from('job_requirements')
          .select('id, employer_id')
          .eq('status', 'active')
          .in('employer_id', empIds);

        (jobs || []).forEach((j) => {
          jobCountMap[j.employer_id] = (jobCountMap[j.employer_id] || 0) + 1;
        });
      }

      const rows: EmployerRow[] = empList.map((e: any) => {
        const hasRm = Boolean(rmMap[e.id]);

        // Profile completeness percentage
        let filledCount = 0;
        const totalTrackedFields = 6;
        if (e.company_name) filledCount++;
        if (e.company_size) filledCount++;
        if (e.primary_contact_name) filledCount++;
        if (e.country || e.location || e.office_address) filledCount++;
        if (Array.isArray(e.healthcare_roles_hiring) && e.healthcare_roles_hiring.length > 0) filledCount++;
        if (e.annual_hiring_volume) filledCount++;
        const pct = Math.round((filledCount / totalTrackedFields) * 100);

        // Checklist completed count
        const checklist = e.onboarding_checklist || {};
        let checklistCompleted = 0;
        if (checklist.profile_completed || pct === 100) checklistCompleted++;
        if (checklist.rm_assigned || hasRm) checklistCompleted++;
        if (checklist.first_requirement_posted) checklistCompleted++;
        if (checklist.talent_pool_browsed) checklistCompleted++;
        if (checklist.first_placement) checklistCompleted++;

        return {
          id: e.id,
          company_name: e.company_name,
          location: e.location,
          industry: e.industry,
          subscription_tier: e.subscription_tier || 'standard',
          created_at: e.created_at,
          rm_name: rmMap[e.id] || 'Not assigned',
          has_rm: hasRm,
          active_jobs_count: jobCountMap[e.id] || 0,
          team_members_count: teamCountMap[e.id] || 0,
          profile_pct: pct,
          checklist_completed_count: checklistCompleted,
          healthcare_roles_hiring: e.healthcare_roles_hiring || [],
          preferred_source_countries: e.preferred_source_countries || [],
          annual_hiring_volume: e.annual_hiring_volume,
          onboarding_checklist: checklist,
        };
      });

      setEmployers(rows);

      if (initialSelectedEmployerId) {
        const target = rows.find((r) => r.id === initialSelectedEmployerId);
        if (target) {
          handleOpenDetail(target);
        }
      }
    } catch (err) {
      console.error('Error fetching my employers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyEmployers();
  }, [user, initialSelectedEmployerId]);

  const handleOpenDetail = async (emp: EmployerRow) => {
    setSelectedEmployer(emp);
    setDrawerLoading(true);

    try {
      const { data: teamData } = await supabase
        .from('employer_team_members')
        .select('id, first_name, last_name, email, role, invite_status')
        .eq('employer_id', emp.id);

      setTeamMembers(teamData || []);
    } catch (err) {
      console.error('Error loading employer details:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleNotifyPlacementTeam = async (employerId: string, companyName: string) => {
    if (!user || notifying) return;
    setNotifying(true);

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      const associateName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
        : 'Associate';

      await notifyByRole(
        supabase,
        'placement_lead',
        'RM Assignment Needed',
        `${companyName} (onboarded by ${associateName}) does not have an account manager assigned. Review and assign.`,
        'rm_assignment_request',
        user.id
      );

      try {
        localStorage.setItem(`rm_notified_emp_${employerId}`, Date.now().toString());
      } catch {}

      setNotifiedEmployers((prev) => new Set(prev).add(employerId));
      showToast('Placement team has been notified.');
    } catch (err) {
      console.error('Error notifying placement team:', err);
      alert('Failed to send notification to placement team.');
    } finally {
      setNotifying(false);
    }
  };

  const filteredEmployers = employers.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    return !q || e.company_name.toLowerCase().includes(q) || e.location?.toLowerCase().includes(q);
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
          <h1 className="text-2xl font-bold text-[#1B3270]">My Healthcare Employers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Healthcare clinics, hospital groups, and care networks onboarded through your account pipeline.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-white border border-[#E2E8F4] px-3 py-1.5 rounded-[6px] shadow-2xs">
          <Briefcase className="w-3.5 h-3.5 text-[#1B3270]" />
          <span>Total Facilities: <strong className="text-slate-800">{employers.length}</strong></span>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search facility name or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-[6px] border border-[#E2E8F4] focus:ring-1 focus:ring-[#1B3270] outline-none"
          />
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
            <Building className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">No facilities found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Employers you onboard will be listed here with profile completeness, checklist milestones, and RM assignments.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Hospital / Facility</th>
                  <th className="py-3 px-4 text-center">Team</th>
                  <th className="py-3 px-4 text-center">Profile</th>
                  <th className="py-3 px-4 text-center">Checklist</th>
                  <th className="py-3 px-4 text-center">Requirements Posted</th>
                  <th className="py-3 px-4 text-center">RM Assigned</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredEmployers.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{emp.company_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {emp.location || 'Germany'} • Tier: {emp.subscription_tier}
                      </div>
                    </td>
                    {/* Team Members */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium">
                      {emp.team_members_count} members
                    </td>
                    {/* Profile % */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center space-x-1.5">
                        <span className="font-mono font-bold text-slate-700">{emp.profile_pct}%</span>
                        <div className="w-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              emp.profile_pct === 100
                                ? 'bg-emerald-500'
                                : emp.profile_pct >= 50
                                ? 'bg-blue-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${emp.profile_pct}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    {/* Checklist */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          emp.checklist_completed_count === 5
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {emp.checklist_completed_count}/5 steps
                      </span>
                    </td>
                    {/* Requirements Posted */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                        <Layers className="w-3 h-3 text-blue-600" />
                        <span>{emp.active_jobs_count} active</span>
                      </span>
                    </td>
                    {/* RM Assigned */}
                    <td className="py-3.5 px-4 text-center">
                      {emp.has_rm ? (
                        <span className="inline-flex items-center text-emerald-700 font-semibold text-[11px]">
                          <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          {emp.rm_name}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                          Not assigned
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(emp)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#1B3270] bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-[#F0F4FF] hover:border-[#2952A3]/30 transition-colors shadow-2xs cursor-pointer"
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

      {/* READ-ONLY EMPLOYER DETAIL DRAWER */}
      {selectedEmployer && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/30 backdrop-blur-2xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col border-l border-[#E2E8F4] animate-in slide-in-from-right duration-200">
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
                  <p className="text-xs text-slate-400">Employer Overview (Read-Only)</p>
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-700">
              {drawerLoading ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Loading facility details...</p>
                </div>
              ) : (
                <>
                  {/* RM Assignment Status Card */}
                  <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 space-y-3">
                    <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                      <Building className="w-4 h-4 text-[#2952A3]" />
                      <span>Account Manager Assignment</span>
                    </h3>

                    {selectedEmployer.has_rm ? (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-[6px] flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-emerald-800 font-semibold block">
                            Dedicated Account Manager
                          </span>
                          <span className="text-emerald-900 font-bold text-sm">
                            {selectedEmployer.rm_name}
                          </span>
                        </div>
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                    ) : (
                      <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-[6px] space-y-2.5">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="font-bold text-amber-900">Not yet assigned</p>
                            <p className="text-[11px] text-amber-800 mt-0.5">
                              This healthcare facility is awaiting dedicated Account Manager allocation by the Placement Lead.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleNotifyPlacementTeam(selectedEmployer.id, selectedEmployer.company_name)}
                          disabled={isNotifiedRecent(selectedEmployer.id) || notifying}
                          className="w-full py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] font-semibold text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
                        >
                          {notifying ? (
                            <span>Notifying...</span>
                          ) : isNotifiedRecent(selectedEmployer.id) ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Placement team notified</span>
                            </>
                          ) : (
                            <>
                              <Bell className="w-3.5 h-3.5" />
                              <span>Notify Placement Team</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* SECTION 1: TEAM MEMBERS (READ-ONLY) */}
                  <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                        <Users className="w-4 h-4 text-[#2952A3]" />
                        <span>Team Members ({teamMembers.length})</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Read-Only
                      </span>
                    </div>

                    {teamMembers.length === 0 ? (
                      <p className="text-slate-400 italic text-center py-2 text-xs">
                        No team members registered under this facility yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#E2E8F4]">
                        {teamMembers.map((m) => {
                          const fullName = `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Team Member';
                          return (
                            <div key={m.id} className="py-2 flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-slate-800">{fullName}</p>
                                <p className="text-[11px] text-slate-400">{m.email}</p>
                              </div>
                              <div className="text-right">
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                                  {m.role}
                                </span>
                                <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{m.invite_status}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: HIRING NEEDS (READ-ONLY) */}
                  <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                        <Heart className="w-4 h-4 text-[#2952A3]" />
                        <span>Hiring Needs & Preferences</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Read-Only
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                          Healthcare Roles Hiring
                        </span>
                        {selectedEmployer.healthcare_roles_hiring?.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedEmployer.healthcare_roles_hiring.map((r, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[11px] border border-blue-200 capitalize"
                              >
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
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block flex items-center space-x-1">
                            <Globe className="w-3 h-3 text-slate-400" />
                            <span>Preferred Sources</span>
                          </span>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {selectedEmployer.preferred_source_countries?.length
                              ? selectedEmployer.preferred_source_countries.join(', ')
                              : 'Any ethical sourcing partner'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: ONBOARDING CHECKLIST (READ-ONLY) */}
                  <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                        <CheckSquare className="w-4 h-4 text-[#2952A3]" />
                        <span>Onboarding Progress</span>
                      </h3>
                      <span className="font-mono text-xs font-bold text-[#1B3270]">
                        {selectedEmployer.checklist_completed_count}/5 completed
                      </span>
                    </div>

                    <div className="space-y-2">
                      {ONBOARDING_STEPS.map((step) => {
                        const cl = selectedEmployer.onboarding_checklist || {};
                        let isDone = false;
                        if (step.key === 'profile_completed') {
                          isDone = Boolean(cl.profile_completed || selectedEmployer.profile_pct === 100);
                        } else if (step.key === 'rm_assigned') {
                          isDone = Boolean(cl.rm_assigned || selectedEmployer.has_rm);
                        } else if (step.key === 'first_requirement_posted') {
                          isDone = Boolean(cl.first_requirement_posted);
                        } else if (step.key === 'talent_pool_browsed') {
                          isDone = Boolean(cl.talent_pool_browsed);
                        } else if (step.key === 'first_placement') {
                          isDone = Boolean(cl.first_placement);
                        }

                        return (
                          <div
                            key={step.key}
                            className="flex items-center justify-between p-2 rounded bg-[#F8FAFD] border border-[#E2E8F4]"
                          >
                            <span className="text-slate-700 font-medium">{step.label}</span>
                            {isDone ? (
                              <span className="text-emerald-700 font-bold text-[11px] flex items-center">
                                <CheckCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                Complete
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">Pending</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E2E8F4] bg-[#F8FAFD] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedEmployer(null)}
                className="px-4 py-2 border border-[#E2E8F4] text-slate-600 rounded-[6px] font-semibold hover:bg-white cursor-pointer text-xs"
              >
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployerAssociateEmployersTab;
