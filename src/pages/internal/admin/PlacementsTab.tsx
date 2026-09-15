import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Award,
  Search,
  Download,
  Calendar,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter';

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

export const PlacementsTab: React.FC = () => {
  const [placements, setPlacements] = useState<PlacementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [employerFilters, setEmployerFilters] = useState<string[]>([]);
  const [supplierFilters, setSupplierFilters] = useState<string[]>([]);
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState('all'); // all, this_month, this_quarter, this_year

  // Unique lists for filter dropdowns
  const [employersList, setEmployersList] = useState<string[]>([]);
  const [suppliersList, setSuppliersList] = useState<string[]>([]);
  const [rolesList, setRolesList] = useState<string[]>([]);

  const fetchPlacements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          job_id,
          supplier_id,
          placed_at,
          created_at,
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
        .order('placed_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Also get RM assignments for employers to display who coordinated
      const { data: rmAssignments } = await supabase
        .from('rm_assignments')
        .select(`
          entity_id,
          active,
          profiles:rm_profile_id (first_name, last_name, email)
        `)
        .eq('entity_type', 'employer')
        .eq('active', true);

      const rmMap: Record<string, string> = {};
      if (rmAssignments) {
        rmAssignments.forEach((a: any) => {
          if (a.entity_id && a.profiles) {
            rmMap[a.entity_id] = `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}`.trim() || a.profiles.email;
          }
        });
      }

      const empSet = new Set<string>();
      const supSet = new Set<string>();
      const roleSet = new Set<string>();

      const rows: PlacementRow[] = (data || []).map((app: any) => {
        const c = app.candidates;
        const candName = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() : 'Candidate';
        const candEmail = c?.profiles?.email || '—';
        const role = c?.target_role || app.job_requirements?.role_type || 'Nursing';

        const empName = app.job_requirements?.employers?.company_name || 'Direct Employer';
        const empId = app.job_requirements?.employers?.id || '';
        const supName = app.suppliers?.company_name || 'Direct';
        const jobTitle = app.job_requirements?.title || 'Healthcare Specialist';
        const placedDate = app.placed_at || app.created_at;
        const rmCoordinator = rmMap[empId] || 'Placement Desk';

        empSet.add(empName);
        if (supName !== 'Direct') supSet.add(supName);
        roleSet.add(role);

        return {
          id: app.id,
          candidate_id: app.candidate_id,
          candidate_name: candName || `ID ${app.candidate_id?.slice(0, 6)}`,
          candidate_email: candEmail,
          target_role: role,
          job_id: app.job_id,
          job_title: jobTitle,
          employer_id: empId,
          employer_name: empName,
          supplier_id: app.supplier_id,
          supplier_name: supName,
          placed_at: placedDate,
          rm_name: rmCoordinator,
        };
      });

      setPlacements(rows);
      setEmployersList(Array.from(empSet).sort());
      setSuppliersList(Array.from(supSet).sort());
      setRolesList(Array.from(roleSet).sort());
    } catch (err) {
      console.error('Error fetching placements:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlacements();
  }, []);

  const employerOptions = useMemo(
    () => employersList.map((e) => ({ value: e, label: e })),
    [employersList]
  );

  const supplierOptions = useMemo(
    () => [
      { value: 'Direct', label: 'Direct Candidates' },
      ...suppliersList.map((s) => ({ value: s, label: s })),
    ],
    [suppliersList]
  );

  const roleOptions = useMemo(
    () => rolesList.map((r) => ({ value: r, label: r })),
    [rolesList]
  );

  // Summary Metrics calculations
  const totalCount = placements.length;

  const thisMonthCount = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return placements.filter((p) => new Date(p.placed_at).getTime() >= startOfMonth).length;
  }, [placements]);

  const thisQuarterCount = useMemo(() => {
    const now = new Date();
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1).getTime();
    return placements.filter((p) => new Date(p.placed_at).getTime() >= startOfQuarter).length;
  }, [placements]);

  // Filtering
  const filteredPlacements = useMemo(() => {
    return placements.filter((p) => {
      if (employerFilters.length > 0 && !employerFilters.includes(p.employer_name)) return false;
      if (supplierFilters.length > 0 && !supplierFilters.includes(p.supplier_name)) return false;
      if (roleFilters.length > 0 && !roleFilters.includes(p.target_role)) return false;

      if (dateFilter === 'this_month') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        if (new Date(p.placed_at).getTime() < startOfMonth) return false;
      } else if (dateFilter === 'this_quarter') {
        const now = new Date();
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        const startOfQuarter = new Date(now.getFullYear(), quarterStartMonth, 1).getTime();
        if (new Date(p.placed_at).getTime() < startOfQuarter) return false;
      } else if (dateFilter === 'this_year') {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
        if (new Date(p.placed_at).getTime() < startOfYear) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cand = p.candidate_name.toLowerCase();
        const email = p.candidate_email.toLowerCase();
        const job = p.job_title.toLowerCase();
        const emp = p.employer_name.toLowerCase();
        if (!cand.includes(q) && !email.includes(q) && !job.includes(q) && !emp.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [placements, employerFilters, supplierFilters, roleFilters, dateFilter, searchQuery]);

  // CSV Export
  const handleExportCsv = () => {
    if (filteredPlacements.length === 0) return;

    const headers = [
      'Candidate Name',
      'Candidate Email',
      'Role',
      'Job Title',
      'Employer',
      'Supplier',
      'Placed Date',
      'Coordinated By RM',
    ];

    const rows = filteredPlacements.map((p) => [
      `"${p.candidate_name.replace(/"/g, '""')}"`,
      `"${p.candidate_email.replace(/"/g, '""')}"`,
      `"${p.target_role.replace(/"/g, '""')}"`,
      `"${p.job_title.replace(/"/g, '""')}"`,
      `"${p.employer_name.replace(/"/g, '""')}"`,
      `"${p.supplier_name.replace(/"/g, '""')}"`,
      `"${new Date(p.placed_at).toLocaleDateString()}"`,
      `"${p.rm_name.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `terratern_placements_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">Placements Record</h1>
          <p className="text-sm text-slate-500 mt-1">
            Official ledger of all successfully matched and placed international healthcare professionals.
          </p>
        </div>
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredPlacements.length === 0}
            className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export to CSV</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              fetchPlacements();
            }}
            disabled={refreshing}
            className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* SUMMARY ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Total Placements</span>
            <p className="text-2xl font-extrabold text-[#1B3270] mt-1">{totalCount.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Placed This Month</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{thisMonthCount.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Placed This Quarter</span>
            <p className="text-2xl font-extrabold text-[#1B3270] mt-1">{thisQuarterCount.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* FILTERS BAR */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate, job, or employer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3270] text-slate-800"
          />
        </div>

        {/* Employer Filter */}
        <div className="w-full sm:w-44">
          <MultiSelectFilter
            label="Employer"
            options={employerOptions}
            selectedValues={employerFilters}
            onChange={setEmployerFilters}
          />
        </div>

        {/* Supplier Filter */}
        <div className="w-full sm:w-44">
          <MultiSelectFilter
            label="Source"
            options={supplierOptions}
            selectedValues={supplierFilters}
            onChange={setSupplierFilters}
          />
        </div>

        {/* Role Filter */}
        <div className="w-full sm:w-44">
          <MultiSelectFilter
            label="Role"
            options={roleOptions}
            selectedValues={roleFilters}
            onChange={setRoleFilters}
          />
        </div>

        {/* Date Filter */}
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="border border-[#E2E8F4] rounded-[6px] px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
        >
          <option value="all">All Time</option>
          <option value="this_month">This Month</option>
          <option value="this_quarter">This Quarter</option>
          <option value="this_year">This Year</option>
        </select>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading placements...</p>
          </div>
        ) : filteredPlacements.length === 0 ? (
          <div className="py-16 text-center">
            <Award className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No placed candidates found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Placements will appear here once candidates successfully pass all 3 reveal gate conditions.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F4] text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Candidate Name</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Job Title</th>
                  <th className="px-4 py-3.5">Employer</th>
                  <th className="px-4 py-3.5">Supplier / Source</th>
                  <th className="px-4 py-3.5">Placed Date</th>
                  <th className="px-4 py-3.5">Coordinated By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4]">
                {filteredPlacements.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 font-semibold text-slate-800">
                      {p.candidate_name}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{p.candidate_email}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 capitalize">
                        {p.target_role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-700">{p.job_title}</td>
                    <td className="px-4 py-3.5 text-slate-800 font-semibold">{p.employer_name}</td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                          p.supplier_name === 'Direct'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        }`}
                      >
                        {p.supplier_name}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {new Date(p.placed_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3.5 text-slate-600 font-medium">
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
