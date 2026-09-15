import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import { EmptyState } from '../../../../components/ui/EmptyState';
import {
  GraduationCap,
  Search,
  Users,
  Calendar,
  X,
  Loader2,
  BookOpen,
  Eye,
} from 'lucide-react';
import { formatDate } from '../../../../utils/formatters';

interface CohortRow {
  id: string;
  name: string;
  track: string;
  status: string;
  mentor_name: string;
  start_date: string | null;
  end_date: string | null;
  my_members_count: number;
}

interface CohortMemberDetail {
  candidate_id: string;
  candidate_name: string;
  supplier_name: string;
  status: string;
  joined_at: string;
}

interface CohortSessionDetail {
  id: string;
  title: string;
  session_date: string;
  topic?: string | null;
  status?: string | null;
}

export const CandidateRmCohortsTab: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected Cohort Drawer
  const [selectedCohort, setSelectedCohort] = useState<CohortRow | null>(null);
  const [loadingDrawer, setLoadingDrawer] = useState(false);
  const [drawerMembers, setDrawerMembers] = useState<CohortMemberDetail[]>([]);
  const [drawerSessions, setDrawerSessions] = useState<CohortSessionDetail[]>([]);

  const fetchCohorts = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // 1. Get my assigned supplier IDs
      const { data: assignments } = await supabase
        .from('rm_assignments')
        .select('entity_id')
        .eq('rm_profile_id', user.id)
        .eq('entity_type', 'supplier')
        .eq('active', true);

      const supplierIds = (assignments || []).map((a) => a.entity_id);
      if (supplierIds.length === 0) {
        setCohorts([]);
        return;
      }

      // 2. Get candidates from my assigned suppliers
      const { data: cands } = await supabase
        .from('candidates')
        .select('id, supplier_id')
        .in('supplier_id', supplierIds);

      const candIds = (cands || []).map((c) => c.id);
      if (candIds.length === 0) {
        setCohorts([]);
        return;
      }

      // 3. Find cohort members for these candidates
      const { data: cMembers } = await supabase
        .from('cohort_members')
        .select('cohort_id, candidate_id')
        .in('candidate_id', candIds);

      const cohortIdCounts: Record<string, number> = {};
      (cMembers || []).forEach((cm) => {
        cohortIdCounts[cm.cohort_id] = (cohortIdCounts[cm.cohort_id] || 0) + 1;
      });

      const uniqueCohortIds = Object.keys(cohortIdCounts);
      if (uniqueCohortIds.length === 0) {
        setCohorts([]);
        return;
      }

      // 4. Fetch the cohorts
      const { data: cohortList, error } = await supabase
        .from('cohorts')
        .select(`
          id,
          name,
          track,
          status,
          start_date,
          end_date,
          mentor_id,
          profiles:mentor_id (first_name, last_name, email)
        `)
        .in('id', uniqueCohortIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows: CohortRow[] = (cohortList || []).map((c: any) => {
        const mentor = c.profiles;
        const mentorName = mentor
          ? `${mentor.first_name || ''} ${mentor.last_name || ''}`.trim() || mentor.email
          : 'Unassigned';

        return {
          id: c.id,
          name: c.name,
          track: c.track,
          status: c.status,
          mentor_name: mentorName,
          start_date: c.start_date,
          end_date: c.end_date,
          my_members_count: cohortIdCounts[c.id] || 0,
        };
      });

      setCohorts(rows);
    } catch (err) {
      console.error('Error loading cohorts for RM:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCohorts();
  }, [user]);

  const handleOpenDrawer = async (cohort: CohortRow) => {
    setSelectedCohort(cohort);
    setLoadingDrawer(true);
    setDrawerMembers([]);
    setDrawerSessions([]);

    try {
      // 1. Get my supplier IDs
      const { data: assignments } = await supabase
        .from('rm_assignments')
        .select('entity_id')
        .eq('rm_profile_id', user!.id)
        .eq('entity_type', 'supplier')
        .eq('active', true);

      const supplierIds = (assignments || []).map((a) => a.entity_id);

      // 2. Fetch cohort members who belong to my suppliers
      const { data: members } = await supabase
        .from('cohort_members')
        .select(`
          candidate_id,
          status,
          created_at,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            supplier_id,
            suppliers:supplier_id (company_name)
          )
        `)
        .eq('cohort_id', cohort.id);

      const myMembers: CohortMemberDetail[] = (members || [])
        .filter((m: any) => m.candidates && supplierIds.includes(m.candidates.supplier_id))
        .map((m: any) => {
          const c = m.candidates;
          const sup = c.suppliers;
          return {
            candidate_id: c.id,
            candidate_name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Candidate #${c.id.slice(0, 6)}`,
            supplier_name: sup?.company_name || 'Agency Partner',
            status: m.status || 'enrolled',
            joined_at: m.created_at,
          };
        });

      setDrawerMembers(myMembers);

      // 3. Fetch cohort sessions
      const { data: sessions } = await supabase
        .from('cohort_sessions')
        .select('id, title, session_date, topic, status')
        .eq('cohort_id', cohort.id)
        .order('session_date', { ascending: true });

      setDrawerSessions(sessions || []);
    } catch (err) {
      console.error('Error loading cohort detail for RM:', err);
    } finally {
      setLoadingDrawer(false);
    }
  };

  const filteredCohorts = cohorts.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.track.toLowerCase().includes(q) ||
      c.mentor_name.toLowerCase().includes(q) ||
      c.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <GraduationCap className="w-5 h-5 text-[#1B3270]" />
            <h1 className="text-xl font-bold text-slate-900">Cohorts</h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Read-only visibility into academic training cohorts containing candidates from your assigned suppliers.
          </p>
        </div>
      </div>

      {/* Search Filter */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3 shadow-2xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter cohorts by name, track, mentor, or status..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          />
        </div>
      </div>

      {/* Cohorts Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredCohorts.length === 0 ? (
          <EmptyState
            title="No cohorts found"
            subtitle="There are currently no active or scheduled cohorts with candidates from your assigned suppliers."
            icon={GraduationCap}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Cohort Name</th>
                  <th className="py-3 px-4">Track</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Mentor</th>
                  <th className="py-3 px-4 text-center">My Suppliers' Candidates</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredCohorts.map((cohort) => (
                  <tr key={cohort.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {cohort.name}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {cohort.track}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          cohort.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : cohort.status === 'completed'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {cohort.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-800">
                      {cohort.mentor_name}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {cohort.my_members_count} {cohort.my_members_count === 1 ? 'candidate' : 'candidates'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                      {cohort.start_date ? formatDate(cohort.start_date) : 'TBD'}
                      {cohort.end_date ? ` – ${formatDate(cohort.end_date)}` : ''}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenDrawer(cohort)}
                        className="px-3 py-1 bg-white hover:bg-slate-50 border border-[#E2E8F4] text-slate-700 hover:text-slate-900 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors inline-flex items-center space-x-1.5"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-500" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* READ-ONLY COHORT DETAIL DRAWER */}
      {selectedCohort && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div>
                <div className="flex items-center space-x-2">
                  <GraduationCap className="w-4 h-4 text-[#1B3270]" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    {selectedCohort.name}
                  </h3>
                </div>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                    {selectedCohort.track}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Mentor: {selectedCohort.mentor_name}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCohort(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {loadingDrawer ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Loading cohort detail...</p>
                </div>
              ) : (
                <>
                  {/* Candidates from my suppliers */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-[#1B3270]" />
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Candidates from My Suppliers ({drawerMembers.length})
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Read-Only</span>
                    </div>

                    {drawerMembers.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-lg border border-[#E2E8F4]">
                        No candidates from your assigned suppliers in this cohort.
                      </p>
                    ) : (
                      <div className="border border-[#E2E8F4] rounded-[8px] overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-[11px] text-slate-500 font-semibold uppercase">
                            <tr>
                              <th className="py-2.5 px-3">Candidate</th>
                              <th className="py-2.5 px-3">Supplier</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Joined</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                            {drawerMembers.map((m) => (
                              <tr key={m.candidate_id} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  {m.candidate_name}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {m.supplier_name}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                                    {m.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                                  {formatDate(m.joined_at)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Scheduled Sessions */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <BookOpen className="w-4 h-4 text-[#1B3270]" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Curriculum &amp; Sessions ({drawerSessions.length})
                      </h4>
                    </div>

                    {drawerSessions.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-4 bg-slate-50 rounded-lg border border-[#E2E8F4]">
                        No sessions scheduled yet for this cohort.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {drawerSessions.map((session, idx) => (
                          <div
                            key={session.id}
                            className="p-3 border border-[#E2E8F4] rounded-[8px] flex items-center justify-between text-xs bg-[#FCFDFE]"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-slate-700 text-[11px]">
                                  Session #{idx + 1}:
                                </span>
                                <span className="font-semibold text-slate-900">
                                  {session.title}
                                </span>
                              </div>
                              {session.topic && (
                                <p className="text-[11px] text-slate-500">{session.topic}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-[11px] font-mono text-slate-600 flex items-center justify-end space-x-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{formatDate(session.session_date)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#E2E8F4] bg-[#F8FAFD] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedCohort(null)}
                className="px-4 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-white transition-colors"
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

export default CandidateRmCohortsTab;
