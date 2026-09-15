import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Briefcase,
  Search,
  Eye,
  X,
  CheckCircle,
  Building,
  Users,
  CheckSquare,
  AlertTriangle,
  Loader2,
  Heart,
  Globe,
} from 'lucide-react';

interface EmployerRow {
  id: string;
  company_name: string;
  location: string | null;
  industry: string | null;
  subscription_tier: string;
  created_at: string;
  onboarded_by_name: string;
  rm_name: string;
  has_rm: boolean;
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
  created_at: string;
}

const ONBOARDING_STEPS = [
  { key: 'profile_completed', label: 'Company profile completed' },
  { key: 'rm_assigned', label: 'Account manager assigned' },
  { key: 'first_requirement_posted', label: 'First job requirement posted' },
  { key: 'talent_pool_browsed', label: 'Browsed candidate talent pool' },
  { key: 'first_placement', label: 'First candidate placed' },
];

export const LeadEmployersTab: React.FC = () => {
  const { user: _user } = useAuth();
  const [employers, setEmployers] = useState<EmployerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');

  // Detail Drawer
  const [selectedEmployer, setSelectedEmployer] = useState<EmployerRow | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [teamMembers, setTeamMembers] = useState<EmployerTeamMemberItem[]>([]);

  const fetchEmployers = async () => {
    setLoading(true);
    try {
      // 1. Fetch employers with onboarder profile
      const { data: emps, error: empErr } = await supabase
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
          created_by_internal,
          healthcare_roles_hiring,
          preferred_source_countries,
          annual_hiring_volume,
          onboarding_checklist,
          profiles:created_by_internal(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (empErr) throw empErr;

      const empList = emps || [];
      const empIds = empList.map((e) => e.id);

      // 2. Active RM assignments for employers
      const rmMap: Record<string, string> = {};
      if (empIds.length > 0) {
        const { data: rmAssignments } = await supabase
          .from('rm_assignments')
          .select(`
            entity_id,
            profiles:rm_profile_id(first_name, last_name, email)
          `)
          .eq('entity_type', 'employer')
          .eq('active', true)
          .in('entity_id', empIds);

        (rmAssignments || []).forEach((rm: any) => {
          const name = rm.profiles
            ? `${rm.profiles.first_name || ''} ${rm.profiles.last_name || ''}`.trim() || rm.profiles.email
            : 'Assigned RM';
          rmMap[rm.entity_id] = name;
        });
      }

      // 3. Team members count per employer
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

      // 4. Build rows
      const rows: EmployerRow[] = empList.map((e: any) => {
        const onboarder = e.profiles
          ? `${e.profiles.first_name || ''} ${e.profiles.last_name || ''}`.trim() || e.profiles.email
          : 'Direct / Self';

        const hasRm = Boolean(rmMap[e.id]);
        const teamCount = teamCountMap[e.id] || 0;

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
          onboarded_by_name: onboarder,
          rm_name: rmMap[e.id] || 'Not assigned',
          has_rm: hasRm,
          team_members_count: teamCount,
          profile_pct: pct,
          checklist_completed_count: checklistCompleted,
          healthcare_roles_hiring: e.healthcare_roles_hiring || [],
          preferred_source_countries: e.preferred_source_countries || [],
          annual_hiring_volume: e.annual_hiring_volume,
          onboarding_checklist: checklist,
        };
      });

      setEmployers(rows);
    } catch (err) {
      console.error('Error fetching employers for lead:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployers();
  }, []);

  const handleOpenDetail = async (emp: EmployerRow) => {
    setSelectedEmployer(emp);
    setDrawerLoading(true);
    try {
      const { data: teamData } = await supabase
        .from('employer_team_members')
        .select('id, first_name, last_name, email, role, invite_status, created_at')
        .eq('employer_id', emp.id)
        .order('created_at', { ascending: false });

      setTeamMembers(teamData || []);
    } catch (err) {
      console.error('Error loading employer detail drawer:', err);
    } finally {
      setDrawerLoading(false);
    }
  };

  const filteredEmployers = employers.filter((e) => {
    const q = searchQuery.toLowerCase().trim();
    if (
      q &&
      !e.company_name.toLowerCase().includes(q) &&
      !e.onboarded_by_name.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (tierFilter !== 'all' && e.subscription_tier !== tierFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">Employer Accounts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Oversee healthcare enterprise facilities, associate onboarding provenance, and hiring pipeline readiness.
          </p>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by facility name or onboarder..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs outline-none focus:bg-white focus:ring-1 focus:ring-[#1B3270] transition-colors"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Subscription:</span>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs outline-none text-slate-700 font-medium focus:bg-white focus:ring-1 focus:ring-[#1B3270]"
          >
            <option value="all">All Tiers</option>
            <option value="basic">Basic</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>

      {/* EMPLOYERS TABLE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredEmployers.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            <Briefcase className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            No healthcare employer accounts found matching your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Hospital / Facility</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Tier</th>
                  <th className="py-3 px-4 text-center">Team Members</th>
                  <th className="py-3 px-4 text-center">Profile %</th>
                  <th className="py-3 px-4 text-center">Checklist</th>
                  <th className="py-3 px-4 text-center">RM Assigned</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredEmployers.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div>{emp.company_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        Onboarded by: {emp.onboarded_by_name}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {emp.location || 'Germany'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200">
                        {emp.subscription_tier}
                      </span>
                    </td>
                    {/* Team Members */}
                    <td className="py-3.5 px-4 text-center font-mono font-medium">
                      {emp.team_members_count}
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
                    {/* RM Assigned */}
                    <td className="py-3.5 px-4 text-center">
                      {emp.has_rm ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
                          Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                          No
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
                  {/* Facility Identity Card */}
                  <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 space-y-3">
                    <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                      <Building className="w-4 h-4 text-[#2952A3]" />
                      <span>Facility Profile & Allocation</span>
                    </h3>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Location</span>
                        <span className="font-semibold text-slate-800">
                          {selectedEmployer.location || 'Germany'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Subscription Tier</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-slate-100 text-slate-800 border border-slate-200 inline-block mt-0.5">
                          {selectedEmployer.subscription_tier}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Profile Completeness</span>
                        <span className="font-mono font-bold text-[#1B3270]">
                          {selectedEmployer.profile_pct}%
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Account Manager</span>
                        <span
                          className={`font-semibold ${
                            selectedEmployer.has_rm ? 'text-[#1B3270]' : 'text-amber-600'
                          }`}
                        >
                          {selectedEmployer.rm_name}
                        </span>
                      </div>
                    </div>
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
                        No team members registered yet.
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

                  {/* SECTION 2: CLINICAL HIRING NEEDS (READ-ONLY) */}
                  <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-[#1B3270] text-sm flex items-center space-x-1.5">
                        <Heart className="w-4 h-4 text-[#2952A3]" />
                        <span>Clinical Hiring Profile</span>
                      </h3>
                      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                        Preferences
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

export default LeadEmployersTab;
