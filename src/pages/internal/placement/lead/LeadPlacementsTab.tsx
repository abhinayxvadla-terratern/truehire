import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Award,
  Search,
  Calendar,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { formatDate } from '../../../../utils/formatters';

interface PlacementRow {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  target_role: string;
  job_id: string;
  job_title: string;
  employer_id: string;
  employer_name: string;
  supplier_id: string | null;
  supplier_name: string;
  placed_at: string;
  rm_name: string;
}

export const LeadPlacementsTab: React.FC = () => {
  const { user } = useAuth();
  const [placements, setPlacements] = useState<PlacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [employerFilter, setEmployerFilter] = useState('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  // Filter dropdown options
  const [employersList, setEmployersList] = useState<string[]>([]);
  const [suppliersList, setSuppliersList] = useState<string[]>([]);
  const [rolesList, setRolesList] = useState<string[]>([]);

  const fetchPlacements = async () => {
    try {
      setLoading(true);

      // 1. Fetch all Employer RMs in placement lead's team
      const { data: empRms } = await supabase
        .from('profiles')
        .select('id')
        .eq('internal_role', 'employer_requirements_rm')
        .eq('is_internal', true);

      const empRmIds = (empRms || []).map((r) => r.id);

      // 2. Fetch assigned employer IDs for these RMs
      let assignedEmployerIds: string[] = [];
      if (empRmIds.length > 0) {
        const { data: assignments } = await supabase
          .from('rm_assignments')
          .select('entity_id')
          .eq('entity_type', 'employer')
          .eq('active', true)
          .in('rm_profile_id', empRmIds);

        assignedEmployerIds = (assignments || []).map((a) => a.entity_id);
      }

      // 3. Fetch placed job applications
      let query = supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          job_id,
          supplier_id,
          placed_at,
          created_at,
          updated_at,
          candidates:candidate_id (
            first_name,
            last_name,
            target_role,
            user_id,
            profiles:user_id (email)
          ),
          job_requirements:job_id (
            title,
            location,
            role_type,
            employer_id,
            employers:employer_id (id, company_name)
          ),
          suppliers:supplier_id (company_name)
        `)
        .eq('status', 'placed')
        .order('updated_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Filter by team's assigned employers if any assignments exist
      let filteredData = data || [];
      if (assignedEmployerIds.length > 0) {
        filteredData = filteredData.filter((app: any) => {
          const empId = app.job_requirements?.employer_id;
          return empId ? assignedEmployerIds.includes(empId) : true;
        });
      }

      // 4. Fetch RM assignments to know who coordinated each placement
      const { data: rmAssignments } = await supabase
        .from('rm_assignments')
        .select(`
          entity_id,
          entity_type,
          profiles:rm_profile_id (first_name, last_name, email)
        `)
        .eq('active', true);

      const empRmMap: Record<string, string> = {};
      const supRmMap: Record<string, string> = {};

      (rmAssignments || []).forEach((a: any) => {
        const name = a.profiles
          ? `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}`.trim() || a.profiles.email
          : 'Assigned RM';

        if (a.entity_type === 'employer') {
          empRmMap[a.entity_id] = name;
        } else if (a.entity_type === 'supplier') {
          supRmMap[a.entity_id] = name;
        }
      });

      const empSet = new Set<string>();
      const supSet = new Set<string>();
      const roleSet = new Set<string>();

      const rows: PlacementRow[] = filteredData.map((app: any) => {
        const c = app.candidates;
        const candName = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate' : 'Candidate';
        const candEmail = c?.profiles?.email || '—';
        const targetRole = c?.target_role || app.job_requirements?.role_type || 'Healthcare Professional';

        const j = app.job_requirements;
        const jobTitle = j?.title || 'Healthcare Role';
        const empId = j?.employer_id || '';
        const empName = j?.employers?.company_name || 'Hospital Partner';

        const supId = app.supplier_id;
        const supName = app.suppliers?.company_name || 'Direct Sourced';

        const placedDate = app.placed_at || app.updated_at || app.created_at;
        const rmName = (empId && empRmMap[empId]) || (supId && supRmMap[supId]) || 'Placement Team';

        if (empName) empSet.add(empName);
        if (supName) supSet.add(supName);
        if (targetRole) roleSet.add(targetRole);

        return {
          id: app.id,
          candidate_id: app.candidate_id,
          candidate_name: candName,
          candidate_email: candEmail,
          target_role: targetRole,
          job_id: app.job_id,
          job_title: jobTitle,
          employer_id: empId,
          employer_name: empName,
          supplier_id: supId,
          supplier_name: supName,
          placed_at: placedDate,
          rm_name: rmName,
        };
      });

      setPlacements(rows);
      setEmployersList(Array.from(empSet).sort());
      setSuppliersList(Array.from(supSet).sort());
      setRolesList(Array.from(roleSet).sort());
    } catch (err) {
      console.error('Error fetching Lead placements data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlacements();
  }, [user]);

  // Metric computations
  const metrics = useMemo(() => {
    const total = placements.length;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    // Quarter calculation
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1).getTime();

    let thisMonth = 0;
    let thisQuarter = 0;

    placements.forEach((p) => {
      const placedTime = new Date(p.placed_at).getTime();
      if (placedTime >= startOfMonth) thisMonth++;
      if (placedTime >= startOfQuarter) thisQuarter++;
    });

    return { total, thisMonth, thisQuarter };
  }, [placements]);

  const filteredPlacements = placements.filter((p) => {
    if (employerFilter !== 'all' && p.employer_name !== employerFilter) return false;
    if (supplierFilter !== 'all' && p.supplier_name !== supplierFilter) return false;
    if (roleFilter !== 'all' && p.target_role !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.candidate_name.toLowerCase().includes(q) ||
        p.job_title.toLowerCase().includes(q) ||
        p.employer_name.toLowerCase().includes(q) ||
        p.supplier_name.toLowerCase().includes(q) ||
        p.rm_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Placements
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Confirmed post-reveal clinical placements across your team's employers.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchPlacements();
          }}
          disabled={refreshing}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-50 shadow-2xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#1B3270]' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* SUMMARY STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Placements
            </span>
            <Award className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {metrics.total}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">All-time confirmed hires</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              This Month
            </span>
            <Calendar className="w-5 h-5 text-[#1B3270]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {metrics.thisMonth}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Placed in current calendar month</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              This Quarter
            </span>
            <TrendingUp className="w-5 h-5 text-[#1B3270]" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2">
            {metrics.thisQuarter}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Placed in current quarter</p>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Employer filter */}
          <select
            value={employerFilter}
            onChange={(e) => setEmployerFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          >
            <option value="all">All Employers</option>
            {employersList.map((emp) => (
              <option key={emp} value={emp}>
                {emp}
              </option>
            ))}
          </select>

          {/* Supplier filter */}
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          >
            <option value="all">All Suppliers</option>
            {suppliersList.map((sup) => (
              <option key={sup} value={sup}>
                {sup}
              </option>
            ))}
          </select>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          >
            <option value="all">All Roles</option>
            {rolesList.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search candidate, job, RM..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          />
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-xs">Loading placements...</p>
          </div>
        ) : filteredPlacements.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-800">No placements found</h4>
            <p className="text-xs text-slate-500 mt-1">
              No placed candidates match the active filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Job Title</th>
                  <th className="py-3 px-4">Employer</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Placed Date</th>
                  <th className="py-3 px-4">RM Coordinated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPlacements.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/75 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{p.candidate_name}</div>
                      <div className="text-[11px] text-slate-400">{p.candidate_email}</div>
                    </td>
                    <td className="py-3.5 px-4">{p.target_role}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{p.job_title}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-900">{p.employer_name}</td>
                    <td className="py-3.5 px-4 text-slate-600">{p.supplier_name}</td>
                    <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                      {formatDate(p.placed_at)}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {p.rm_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadPlacementsTab;
