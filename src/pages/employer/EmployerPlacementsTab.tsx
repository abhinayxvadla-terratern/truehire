import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Award,
  Search,
  Mail,
  Building2,
  UserCheck,
  CheckCircle2,
  X,
  ShieldCheck,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface EmployerPlacementsTabProps {
  employer: any;
}

interface PlacedCandidateItem {
  id: string; // application id
  candidate_id: string;
  candidate_name: string;
  candidate_email: string;
  target_role: string;
  job_id: string;
  job_title: string;
  location: string;
  placed_at: string;
  supplier_name: string;
  submitted_by: string;
  rm_name: string;
  rm_email: string;
}

export const EmployerPlacementsTab: React.FC<EmployerPlacementsTabProps> = ({ employer }) => {
  const [placements, setPlacements] = useState<PlacedCandidateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlacement, setSelectedPlacement] = useState<PlacedCandidateItem | null>(null);
  const [assignedRm, setAssignedRm] = useState<{ name: string; email: string } | null>(null);

  const fetchPlacements = async () => {
    if (!employer?.id) return;
    try {
      setLoading(true);

      // 1. Fetch assigned Account Manager (RM) for this employer
      const { data: rmAss } = await supabase
        .from('rm_assignments')
        .select(`
          rm_profile_id,
          profiles:rm_profile_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('entity_type', 'employer')
        .eq('entity_id', employer.id)
        .eq('active', true)
        .maybeSingle();

      let rmInfo = { name: 'TerraTern Placement Team', email: 'placements@terratern.com' };
      if (rmAss?.profiles) {
        const p: any = rmAss.profiles;
        rmInfo = {
          name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email,
          email: p.email,
        };
      }
      setAssignedRm(rmInfo);

      // 2. Fetch all jobs belonging to this employer
      const { data: employerJobs, error: jobsErr } = await supabase
        .from('job_requirements')
        .select('id, title, location')
        .eq('employer_id', employer.id);

      if (jobsErr) throw jobsErr;

      const jobMap = new Map<string, { title: string; location: string }>();
      (employerJobs || []).forEach((j) => {
        jobMap.set(j.id, {
          title: j.title || 'Untitled Requirement',
          location: j.location || employer.location || 'Germany',
        });
      });

      const jobIds = Array.from(jobMap.keys());
      if (jobIds.length === 0) {
        setPlacements([]);
        return;
      }

      // 3. Fetch placed job applications
      const { data: applications, error: appsErr } = await supabase
        .from('job_applications')
        .select(`
          id,
          job_id,
          candidate_id,
          status,
          submitted_by,
          supplier_id,
          updated_at,
          created_at
        `)
        .in('job_id', jobIds)
        .eq('status', 'placed')
        .order('updated_at', { ascending: false });

      if (appsErr) throw appsErr;

      if (!applications || applications.length === 0) {
        setPlacements([]);
        return;
      }

      // 4. Fetch candidate and supplier profiles
      const candidateIds = applications.map((a) => a.candidate_id);
      const supplierIds = applications
        .map((a) => a.supplier_id)
        .filter(Boolean) as string[];

      const [{ data: candidatesData }, { data: suppliersData }] = await Promise.all([
        supabase
          .from('candidates')
          .select('id, first_name, last_name, email, target_role, supplier_id, user_id')
          .in('id', candidateIds),
        supplierIds.length > 0
          ? supabase.from('suppliers').select('id, company_name').in('id', supplierIds)
          : Promise.resolve({ data: [] }),
      ]);

      const candMap = new Map<string, any>();
      (candidatesData || []).forEach((c) => candMap.set(c.id, c));

      // Also if candidate has user_id, check profiles to ensure we have the best email
      const candidateUserIds = (candidatesData || [])
        .map((c) => c.user_id)
        .filter(Boolean) as string[];

      const userEmailMap = new Map<string, string>();
      if (candidateUserIds.length > 0) {
        const { data: profData } = await supabase
          .from('profiles')
          .select('id, email, first_name, last_name')
          .in('id', candidateUserIds);
        (profData || []).forEach((p) => {
          if (p.email) userEmailMap.set(p.id, p.email);
        });
      }

      const supMap = new Map<string, string>();
      (suppliersData || []).forEach((s) => supMap.set(s.id, s.company_name));

      // Map to PlacedCandidateItem array
      const mapped: PlacedCandidateItem[] = applications.map((app) => {
        const cand = candMap.get(app.candidate_id);
        const job = jobMap.get(app.job_id);

        const fullName =
          cand && (cand.first_name || cand.last_name)
            ? `${cand.first_name || ''} ${cand.last_name || ''}`.trim()
            : `Candidate #${app.candidate_id.slice(0, 6).toUpperCase()}`;

        const candEmail =
          (cand?.user_id && userEmailMap.get(cand.user_id)) ||
          cand?.email ||
          'Email shared upon onboarding';

        const supplierName =
          app.supplier_id && supMap.has(app.supplier_id)
            ? supMap.get(app.supplier_id)!
            : cand?.supplier_id && supMap.has(cand.supplier_id)
            ? supMap.get(cand.supplier_id)!
            : app.submitted_by === 'candidate'
            ? 'Direct application'
            : 'TerraTern Global Talent';

        return {
          id: app.id,
          candidate_id: app.candidate_id,
          candidate_name: fullName,
          candidate_email: candEmail,
          target_role: cand?.target_role || 'Healthcare Professional',
          job_id: app.job_id,
          job_title: job?.title || 'Healthcare Role',
          location: job?.location || employer.location || 'Germany',
          placed_at: app.updated_at || app.created_at,
          supplier_name: supplierName,
          submitted_by: app.submitted_by,
          rm_name: rmInfo.name,
          rm_email: rmInfo.email,
        };
      });

      setPlacements(mapped);
    } catch (err) {
      console.error('Error fetching placements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlacements();
  }, [employer?.id]);

  const filteredPlacements = placements.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.candidate_name.toLowerCase().includes(q) ||
      p.candidate_email.toLowerCase().includes(q) ||
      p.job_title.toLowerCase().includes(q) ||
      p.target_role.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.supplier_name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* SUMMARY STAT CARD */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Confirmed Hires
            </span>
            <div className="mt-1 flex items-baseline space-x-2">
              <span className="text-3xl font-extrabold text-[#10B981] tracking-tight">
                {loading ? '—' : placements.length}
              </span>
              <span className="text-sm font-semibold text-slate-700">
                Total Placements
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Successful candidates placed at {employer?.company_name || 'your hospital'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-[#10B981]">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Identity Status
            </span>
            <div className="mt-1 flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-[#1B3270]" />
              <span className="text-sm font-bold text-slate-900">
                Level 3 Full Reveal
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Direct contact details and agency sourcing partner unlocked
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Account Manager
            </span>
            <div className="mt-1">
              <span className="text-sm font-bold text-slate-900 block truncate">
                {assignedRm?.name || 'TerraTern Team'}
              </span>
              <span className="text-[11px] text-slate-500 truncate block">
                {assignedRm?.email || 'placements@terratern.com'}
              </span>
            </div>
            <p className="text-[11px] text-[#1B3270] font-medium mt-1">
              Supports onboarding & relocation
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#1B3270]/10 flex items-center justify-center text-[#1B3270]">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search placed candidate, job title, email, role, or agency..."
            className="w-full pl-9 pr-4 py-2 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-[#1B3270] focus:bg-white transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={fetchPlacements}
          className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* PLACEMENTS TABLE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredPlacements.length === 0 ? (
          <div className="py-16 px-4 text-center max-w-md mx-auto">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#10B981] mx-auto mb-3">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              {searchQuery ? 'No matching placements found' : 'No placements yet'}
            </h3>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {searchQuery
                ? 'Try adjusting your search keywords.'
                : 'Placed candidates will appear here once the full reveal process is completed.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Job Title</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Placed Date</th>
                  <th className="py-3 px-4">RM who coordinated</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4]">
                {filteredPlacements.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedPlacement(item)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      <div>
                        <span className="font-bold text-slate-900 hover:text-[#1B3270]">
                          {item.candidate_name}
                        </span>
                        <div className="flex items-center space-x-1 mt-0.5">
                          <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                          <span className="text-[10px] text-emerald-700 font-medium">
                            Full details shared — placement confirmed
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <a
                        href={`mailto:${item.candidate_email}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center space-x-1 text-[#1B3270] hover:underline font-medium"
                      >
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span>{item.candidate_email}</span>
                      </a>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#7EB3E8]/20 text-[#2952A3] capitalize">
                        {item.target_role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {item.job_title}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{item.location}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {formatDate(item.placed_at)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="flex items-center space-x-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#1B3270]" />
                        <span className="font-medium">{item.rm_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPlacement(item);
                        }}
                        className="px-2.5 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors inline-flex items-center space-x-1"
                      >
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

      {/* CANDIDATE DETAIL MODAL (PLACED) */}
      {selectedPlacement && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E2E8F4] max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 bg-[#1B3270] text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold tracking-tight">
                  Placed Candidate — {selectedPlacement.candidate_name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlacement(null)}
                className="text-white/80 hover:text-white p-1 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5 text-xs text-slate-700 max-h-[80vh] overflow-y-auto">
              {/* Level 3 Confirmed Banner */}
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-[8px] flex items-center space-x-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                <span className="text-emerald-800 font-medium">
                  Full reveal completed. Contractual conditions and candidate consent confirmed.
                </span>
              </div>

              {/* Placement Details */}
              <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Placement Details
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Position:</span>
                    <span className="font-bold text-slate-900">{selectedPlacement.job_title}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Location:</span>
                    <span className="font-medium text-slate-800">{selectedPlacement.location}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Placed on:</span>
                    <span className="font-medium text-slate-800">{formatDate(selectedPlacement.placed_at)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Coordinated by:</span>
                    <span className="font-semibold text-[#1B3270]">{selectedPlacement.rm_name}</span>
                  </div>
                </div>
              </div>

              {/* Candidate Contact */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-2.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Candidate Contact
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Name:</span>
                    <span className="font-bold text-slate-900">{selectedPlacement.candidate_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Email:</span>
                    <a
                      href={`mailto:${selectedPlacement.candidate_email}`}
                      className="font-semibold text-[#1B3270] hover:underline flex items-center space-x-1"
                    >
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>{selectedPlacement.candidate_email}</span>
                    </a>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Role Focus:</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#7EB3E8]/20 text-[#2952A3] capitalize">
                      {selectedPlacement.target_role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 italic pt-1 border-t border-[#E2E8F4]">
                    Direct contact for post-placement onboarding is conducted via verified email.
                  </p>
                </div>
              </div>

              {/* Source */}
              <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Source Agency
                </div>
                <div className="flex items-center space-x-2 pt-1">
                  <Building2 className="w-4 h-4 text-slate-500" />
                  <span className="font-semibold text-slate-800">
                    {selectedPlacement.supplier_name}
                  </span>
                </div>
              </div>

              {/* Account Manager Coordination Note */}
              <div className="p-3.5 rounded-[8px] bg-[#1B3270]/5 border border-[#1B3270]/15 space-y-1.5">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-[#1B3270]">
                  <UserCheck className="w-4 h-4" />
                  <span>Post-Placement Coordination Notice</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  For post-placement coordination (visa, documentation, onboarding), work with your TerraTern account manager{' '}
                  <span className="font-semibold text-slate-900">{selectedPlacement.rm_name}</span> (
                  <a
                    href={`mailto:${selectedPlacement.rm_email}`}
                    className="text-[#1B3270] font-medium underline"
                  >
                    {selectedPlacement.rm_email}
                  </a>
                  ).
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-[#E2E8F4] flex justify-between items-center">
              <a
                href={`mailto:${selectedPlacement.candidate_email}`}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contact Candidate</span>
              </a>
              <button
                type="button"
                onClick={() => setSelectedPlacement(null)}
                className="px-3.5 py-1.5 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
