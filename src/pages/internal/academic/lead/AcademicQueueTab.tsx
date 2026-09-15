import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Search,
  UserPlus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Building2,
  Calendar,
  UserCheck,
  Eye,
} from 'lucide-react';
import { CandidateProfileDetailView } from '../../components/CandidateProfileDetailView';
import { MultiSelectFilter } from '../../../../components/ui/MultiSelectFilter';

interface AcademyQueueItem {
  candidate_id: string;
  candidate_name: string;
  supplier_name: string;
  current_stage: string;
  stage_status: string;
  assigned_mentor_id: string | null;
  mentor_name: string | null;
  days_in_stage: number;
  academic_request_id: string | null;
  academic_request_status: string | null;
  requesting_rm_id: string | null;
  candidate_user_id: string | null;
  // Qualification Queue enhancements
  dt_attempt_count: number;
  cooling_active: boolean;
  cooling_days_remaining: number;
  is_dt_cooling: boolean;
  track: string | null;
  cohort_id: string | null;
  cohort_name: string | null;
  consecutive_final_test_fails: number;
  final_test_locked: boolean;
}

interface MentorOption {
  id: string;
  name: string;
  activeCount: number;
}

export const AcademicQueueTab: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<AcademyQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [stageFilters, setStageFilters] = useState<string[]>([]);
  const [trackFilters, setTrackFilters] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Assign Mentor Modal
  const [selectedCandidateForAssign, setSelectedCandidateForAssign] =
    useState<AcademyQueueItem | null>(null);
  const [selectedCandidateDetail, setSelectedCandidateDetail] =
    useState<AcademyQueueItem | null>(null);
  const [availableMentors, setAvailableMentors] = useState<MentorOption[]>([]);
  const [selectedMentorId, setSelectedMentorId] = useState<string>('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchQueueData = async () => {
    try {
      setLoading(true);

      // 1. Fetch all candidates with supplier information
      const { data: candidates, error: candErr } = await supabase
        .from('candidates')
        .select(`
          id,
          first_name,
          last_name,
          status,
          user_id,
          created_at,
          supplier_id,
          speaking_test_track,
          cohort_id,
          consecutive_final_test_fails,
          final_test_locked,
          dt_attempt_count,
          suppliers:supplier_id (company_name)
        `)
        .order('created_at', { ascending: false });

      if (candErr) throw candErr;

      const candList = candidates || [];
      if (candList.length === 0) {
        setItems([]);
        return;
      }

      const candIds = candList.map((c) => c.id);

      // 2. Fetch academic_requests for these candidates
      const { data: academicRequests } = await supabase
        .from('academic_requests')
        .select('id, candidate_id, assigned_mentor_id, status, requested_by, created_at, updated_at')
        .in('candidate_id', candIds)
        .order('created_at', { ascending: false });

      // Map latest academic request per candidate
      const reqMap: Record<string, any> = {};
      (academicRequests || []).forEach((r) => {
        if (!reqMap[r.candidate_id]) {
          reqMap[r.candidate_id] = r;
        }
      });

      // 3. Fetch gate_results for these candidates
      const { data: gateResults } = await supabase
        .from('gate_results')
        .select('id, candidate_id, gate_type, status, review_status, score, created_at')
        .in('candidate_id', candIds)
        .order('created_at', { ascending: false });

      // Group gate_results by candidate_id
      const gateMap: Record<string, any[]> = {};
      (gateResults || []).forEach((g) => {
        if (!gateMap[g.candidate_id]) gateMap[g.candidate_id] = [];
        gateMap[g.candidate_id].push(g);
      });

      // 4. Fetch active mentor assignments
      const { data: mentorAssignments } = await supabase
        .from('mentor_assignments')
        .select('candidate_id, mentor_id, assigned_at')
        .eq('active', true);

      const assignMap: Record<string, any> = {};
      (mentorAssignments || []).forEach((ma) => {
        assignMap[ma.candidate_id] = ma;
      });

      // 5. Fetch profiles for mentors to resolve names
      const { data: mentorProfiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'mentor');

      const mentorNameMap: Record<string, string> = {};
      (mentorProfiles || []).forEach((m) => {
        mentorNameMap[m.id] =
          `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
      });

      // 6. Fetch active cooling periods for these candidates
      const { data: coolingData } = await supabase
        .from('cooling_periods')
        .select('id, candidate_id, gate_type, ends_at, status')
        .in('candidate_id', candIds)
        .eq('status', 'active');

      const coolingMap: Record<
        string,
        { gate_type: string; ends_at: string; days_remaining: number; is_dt: boolean }
      > = {};
      (coolingData || []).forEach((cp: any) => {
        if (!cp.candidate_id) return;
        const endsMs = new Date(cp.ends_at).getTime();
        if (endsMs > Date.now()) {
          const daysRemaining = Math.max(
            0,
            Math.ceil((endsMs - Date.now()) / (1000 * 60 * 60 * 24))
          );
          coolingMap[cp.candidate_id] = {
            gate_type: cp.gate_type,
            ends_at: cp.ends_at,
            days_remaining: daysRemaining,
            is_dt: cp.gate_type === 'dt',
          };
        }
      });

      // 7. Fetch cohort memberships
      const { data: cohortMembers } = await supabase
        .from('cohort_members')
        .select(`
          candidate_id,
          cohort_id,
          cohorts:cohort_id (id, name)
        `)
        .in('candidate_id', candIds);

      const cohortNameMap: Record<string, { id: string; name: string }> = {};
      (cohortMembers || []).forEach((cm: any) => {
        if (cm.cohorts?.name) {
          cohortNameMap[cm.candidate_id] = {
            id: cm.cohort_id,
            name: cm.cohorts.name,
          };
        }
      });

      // Fallback for direct candidate.cohort_id
      const directCohortIds = candList
        .map((c: any) => c.cohort_id)
        .filter(
          (cid: any): cid is string =>
            Boolean(cid) && !Object.values(cohortNameMap).some((v) => v.id === cid)
        );

      if (directCohortIds.length > 0) {
        const { data: directCohorts } = await supabase
          .from('cohorts')
          .select('id, name')
          .in('id', directCohortIds);
        const directMap: Record<string, string> = {};
        (directCohorts || []).forEach((dc: any) => {
          directMap[dc.id] = dc.name;
        });
        candList.forEach((c: any) => {
          if (c.cohort_id && directMap[c.cohort_id] && !cohortNameMap[c.id]) {
            cohortNameMap[c.id] = { id: c.cohort_id, name: directMap[c.cohort_id] };
          }
        });
      }

      // 8. Assemble Academy Queue Items
      const mappedQueue: AcademyQueueItem[] = candList.map((c: any) => {
        const cName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate';
        const supplierName = c.suppliers?.company_name || 'Direct / Independent';

        const latestReq = reqMap[c.id];
        const gates = gateMap[c.id] || [];
        const activeAssign = assignMap[c.id];

        const assignedMentorId =
          activeAssign?.mentor_id || latestReq?.assigned_mentor_id || null;
        const mentorName = assignedMentorId
          ? mentorNameMap[assignedMentorId] || 'Assigned Mentor'
          : null;

        // Determine current stage & status
        let currentStage = 'Pre-Academy';
        let stageStatus = 'idle';
        let stageDate = c.created_at;

        const assessmentGate = gates.find((g) => g.gate_type === 'assessment');
        const bootcampGate = gates.find((g) => g.gate_type === 'bootcamp');
        const stGate = gates.find((g) => g.gate_type === 'speaking_test');

        if (assessmentGate) {
          currentStage = 'Assessment';
          stageStatus =
            assessmentGate.review_status === 'pending'
              ? 'Assessment Pending Review'
              : assessmentGate.status;
          stageDate = assessmentGate.created_at;
        } else if (bootcampGate && bootcampGate.status === 'in_progress') {
          currentStage = 'In Bootcamp';
          stageStatus = 'In Progress';
          stageDate = bootcampGate.created_at;
        } else if (bootcampGate && bootcampGate.status === 'completed') {
          currentStage = 'Awaiting Assessment';
          stageStatus = 'Ready for Assessment';
          stageDate = bootcampGate.created_at;
        } else if (stGate) {
          if (stGate.review_status === 'pending') {
            currentStage = 'Speaking Test';
            stageStatus = 'ST Pending Review';
          } else if (stGate.status === 'pass') {
            currentStage = 'In Bootcamp';
            stageStatus = 'Awaiting Bootcamp Start';
          } else {
            currentStage = 'Speaking Test';
            stageStatus = 'ST Failed';
          }
          stageDate = stGate.created_at;
        } else if (latestReq) {
          if (latestReq.status === 'pending_assignment') {
            currentStage = 'Speaking Test';
            stageStatus = 'Awaiting ST Assignment';
          } else if (latestReq.status === 'assigned' || latestReq.status === 'in_progress') {
            currentStage = 'Speaking Test';
            stageStatus = 'In Speaking Test';
          } else if (latestReq.status === 'pending_review') {
            currentStage = 'Speaking Test';
            stageStatus = 'ST Pending Review';
          }
          stageDate = latestReq.updated_at || latestReq.created_at;
        }

        const daysInStage = Math.max(
          0,
          Math.floor((Date.now() - new Date(stageDate).getTime()) / (1000 * 60 * 60 * 24))
        );

        const cooling = coolingMap[c.id];
        const cohortInfo = cohortNameMap[c.id];

        let trackLabel: string | null = null;
        if (c.speaking_test_track) {
          const tLower = c.speaking_test_track.toLowerCase();
          if (tLower.includes('pass')) trackLabel = 'Pass Track';
          else if (tLower.includes('fail')) trackLabel = 'Fail Track';
          else trackLabel = c.speaking_test_track;
        }

        return {
          candidate_id: c.id,
          candidate_name: cName,
          supplier_name: supplierName,
          current_stage: currentStage,
          stage_status: stageStatus,
          assigned_mentor_id: assignedMentorId,
          mentor_name: mentorName,
          days_in_stage: daysInStage,
          academic_request_id: latestReq?.id || null,
          academic_request_status: latestReq?.status || null,
          requesting_rm_id: latestReq?.requested_by || null,
          candidate_user_id: c.user_id || null,
          // Qualification Queue enhancements
          dt_attempt_count: c.dt_attempt_count || 0,
          cooling_active: Boolean(cooling),
          cooling_days_remaining: cooling?.days_remaining || 0,
          is_dt_cooling: Boolean(cooling?.is_dt),
          track: trackLabel,
          cohort_id: cohortInfo?.id || null,
          cohort_name: cohortInfo?.name || null,
          consecutive_final_test_fails: c.consecutive_final_test_fails || 0,
          final_test_locked: Boolean(c.final_test_locked),
        };
      });

      setItems(mappedQueue);
    } catch (err) {
      console.error('Error fetching academy queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueData();
  }, []);

  // Fetch Mentors with load for Assign modal
  const handleOpenAssignModal = async (candidate: AcademyQueueItem) => {
    setSelectedCandidateForAssign(candidate);
    setSelectedMentorId('');
    setAssignError(null);

    try {
      const { data: mentors } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'mentor')
        .eq('is_internal', true);

      const { data: assignments } = await supabase
        .from('mentor_assignments')
        .select('mentor_id')
        .eq('active', true);

      const loadMap: Record<string, number> = {};
      (assignments || []).forEach((a) => {
        loadMap[a.mentor_id] = (loadMap[a.mentor_id] || 0) + 1;
      });

      const options: MentorOption[] = (mentors || []).map((m) => ({
        id: m.id,
        name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
        activeCount: loadMap[m.id] || 0,
      }));

      setAvailableMentors(options);
      if (options.length > 0) {
        setSelectedMentorId(options[0].id);
      }
    } catch (err) {
      console.error('Error fetching mentors for assign modal:', err);
    }
  };

  // Confirm Assign Mentor
  const handleConfirmAssignMentor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCandidateForAssign || !selectedMentorId) return;

    setAssigning(true);
    setAssignError(null);

    const c = selectedCandidateForAssign;
    const chosenMentor = availableMentors.find((m) => m.id === selectedMentorId);

    try {
      // 1. UPDATE academic_requests SET assigned_mentor_id, status = 'assigned'
      if (c.academic_request_id) {
        const { error: reqErr } = await supabase
          .from('academic_requests')
          .update({
            assigned_mentor_id: selectedMentorId,
            status: 'assigned',
            updated_at: new Date().toISOString(),
          })
          .eq('id', c.academic_request_id);

        if (reqErr) throw reqErr;
      } else {
        // Create an academic request if one didn't exist
        const { error: insertReqErr } = await supabase
          .from('academic_requests')
          .insert({
            candidate_id: c.candidate_id,
            request_type: 'speaking_test',
            requested_by: user.id,
            assigned_mentor_id: selectedMentorId,
            status: 'assigned',
          });

        if (insertReqErr) throw insertReqErr;
      }

      // 2. Deactivate any previous mentor assignments for this candidate
      await supabase
        .from('mentor_assignments')
        .update({ active: false })
        .eq('candidate_id', c.candidate_id);

      // 3. INSERT mentor_assignments
      const { error: assignErr } = await supabase.from('mentor_assignments').insert({
        mentor_id: selectedMentorId,
        candidate_id: c.candidate_id,
        assigned_by: user.id,
        active: true,
      });

      if (assignErr) throw assignErr;

      // 4. INSERT notification for mentor
      await supabase.from('notifications').insert({
        user_id: selectedMentorId,
        title: 'New candidate assigned',
        message: `You have been assigned to ${c.candidate_name}. Next action: Conduct Speaking Test.`,
        type: 'academic',
        sent_by: user.id,
      });

      // 5. INSERT notification for requesting RM
      if (c.requesting_rm_id) {
        await supabase.from('notifications').insert({
          user_id: c.requesting_rm_id,
          title: 'Mentor Assigned',
          message: `Mentor ${chosenMentor?.name || ''} assigned for ${c.candidate_name}. Speaking Test will be scheduled.`,
          type: 'placement',
          sent_by: user.id,
        });
      }

      showToast(`Assigned ${chosenMentor?.name} to ${c.candidate_name}.`);
      setSelectedCandidateForAssign(null);
      fetchQueueData();
    } catch (err: any) {
      console.error('Error assigning mentor:', err);
      setAssignError(err.message || 'Failed to assign mentor');
    } finally {
      setAssigning(false);
    }
  };

  const stageOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.current_stage) set.add(i.current_stage);
    });
    return Array.from(set).sort().map((s) => ({ value: s, label: s }));
  }, [items]);

  const trackOptions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.track) set.add(i.track);
    });
    return Array.from(set).sort().map((t) => ({ value: t, label: t }));
  }, [items]);

  // Filter items
  const filteredItems = items.filter((item) => {
    if (stageFilters.length > 0 && !stageFilters.includes(item.current_stage)) return false;
    if (trackFilters.length > 0 && (!item.track || !trackFilters.includes(item.track))) return false;

    // 1. Filter pill
    if (selectedFilter === 'dt_cooling_active') {
      if (!item.is_dt_cooling || !item.cooling_active) return false;
    } else if (selectedFilter === 'final_test_locked') {
      if (!item.final_test_locked) return false;
    } else if (selectedFilter === 'pass_track') {
      if (item.track !== 'Pass Track') return false;
    } else if (selectedFilter === 'fail_track') {
      if (item.track !== 'Fail Track') return false;
    } else if (selectedFilter === 'awaiting_st') {
      if (item.stage_status !== 'Awaiting ST Assignment') return false;
    } else if (selectedFilter === 'in_st') {
      if (
        item.stage_status !== 'In Speaking Test' &&
        item.stage_status !== 'ST Pending Review'
      )
        return false;
    } else if (selectedFilter === 'in_bootcamp') {
      if (item.current_stage !== 'In Bootcamp') return false;
    } else if (selectedFilter === 'awaiting_assessment') {
      if (item.stage_status !== 'Ready for Assessment') return false;
    } else if (selectedFilter === 'assessment_pending_review') {
      if (item.stage_status !== 'Assessment Pending Review') return false;
    }

    // 2. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.candidate_name.toLowerCase().includes(q);
      const matchSupplier = item.supplier_name.toLowerCase().includes(q);
      const matchMentor = (item.mentor_name || '').toLowerCase().includes(q);
      const matchCohort = (item.cohort_name || '').toLowerCase().includes(q);
      if (!matchName && !matchSupplier && !matchMentor && !matchCohort) return false;
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg flex items-center space-x-2 text-xs animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* FILTER PILLS BAR */}
      <div className="flex flex-wrap items-center gap-2 pb-1">
        {[
          { id: 'all', label: `All (${items.length})` },
          {
            id: 'dt_cooling_active',
            label: `DT Cooling Active (${items.filter((i) => i.is_dt_cooling && i.cooling_active).length})`,
          },
          {
            id: 'final_test_locked',
            label: `Final Test Locked (${items.filter((i) => i.final_test_locked).length})`,
          },
          {
            id: 'pass_track',
            label: `Pass Track (${items.filter((i) => i.track === 'Pass Track').length})`,
          },
          {
            id: 'fail_track',
            label: `Fail Track (${items.filter((i) => i.track === 'Fail Track').length})`,
          },
          {
            id: 'awaiting_st',
            label: `Awaiting ST (${items.filter((i) => i.stage_status === 'Awaiting ST Assignment').length})`,
          },
          {
            id: 'in_st',
            label: `In ST (${items.filter((i) => i.stage_status === 'In Speaking Test' || i.stage_status === 'ST Pending Review').length})`,
          },
          {
            id: 'in_bootcamp',
            label: `In Bootcamp (${items.filter((i) => i.current_stage === 'In Bootcamp').length})`,
          },
        ].map((pill) => (
          <button
            key={pill.id}
            onClick={() => setSelectedFilter(pill.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              selectedFilter === pill.id
                ? 'bg-[#1B3270] text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-[#E2E8F4] hover:bg-slate-50'
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate by name, sourcing partner / supplier, mentor, or cohort..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          />
        </div>
        {stageOptions.length > 0 && (
          <div className="w-full md:w-44">
            <MultiSelectFilter
              label="Stage"
              options={stageOptions}
              selectedValues={stageFilters}
              onChange={setStageFilters}
            />
          </div>
        )}
        {trackOptions.length > 0 && (
          <div className="w-full md:w-44">
            <MultiSelectFilter
              label="Track"
              options={trackOptions}
              selectedValues={trackFilters}
              onChange={setTrackFilters}
            />
          </div>
        )}
        <span className="text-xs text-slate-400 shrink-0 font-medium">
          Showing {filteredItems.length} candidate{filteredItems.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* QUEUE TABLE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1B3270]" />
            Loading academy queue...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <GraduationCap className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700">
              No candidates matching current filter
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Candidates in academic preparation and language testing will appear in this unified queue.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3">Candidate</th>
                  <th className="py-3 px-3">Supplier</th>
                  <th className="py-3 px-3">Stage & Status</th>
                  <th className="py-3 px-3 text-center">DT Attempts</th>
                  <th className="py-3 px-3 text-center">Cooling</th>
                  <th className="py-3 px-3 text-center">Track</th>
                  <th className="py-3 px-3">Cohort</th>
                  <th className="py-3 px-3 text-center">Final Fails</th>
                  <th className="py-3 px-3">Assigned Mentor</th>
                  <th className="py-3 px-3 text-center">Days</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredItems.map((item) => (
                  <tr
                    key={item.candidate_id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="py-3 px-3 font-bold text-slate-800">
                      {item.candidate_name}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      <div className="flex items-center">
                        <Building2 className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[110px]">{item.supplier_name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-700 block whitespace-nowrap">
                          {item.current_stage}
                        </span>
                        <span
                          className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            item.stage_status.includes('Pending Review')
                              ? 'bg-purple-100 text-purple-700'
                              : item.stage_status.includes('Awaiting')
                              ? 'bg-amber-100 text-amber-700'
                              : item.stage_status.includes('Progress')
                              ? 'bg-blue-100 text-blue-700'
                              : item.stage_status === 'pass'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.stage_status}
                        </span>
                      </div>
                    </td>

                    {/* DT Attempts */}
                    <td className="py-3 px-3 text-center">
                      <span className="font-semibold text-slate-700">
                        {item.dt_attempt_count}/10
                      </span>
                    </td>

                    {/* Cooling */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {item.cooling_active ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Active ({item.cooling_days_remaining}d)
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">None</span>
                      )}
                    </td>

                    {/* Track */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {item.track === 'Pass Track' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Pass Track
                        </span>
                      ) : item.track === 'Fail Track' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          Fail Track
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Not Assigned</span>
                      )}
                    </td>

                    {/* Cohort */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.cohort_name ? (
                        <span className="font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[11px]">
                          {item.cohort_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Unassigned</span>
                      )}
                    </td>

                    {/* Final Fails */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {item.final_test_locked || item.consecutive_final_test_fails >= 3 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          3 (Locked)
                        </span>
                      ) : item.consecutive_final_test_fails > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          {item.consecutive_final_test_fails} fail{item.consecutive_final_test_fails > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-500 font-medium">0</span>
                      )}
                    </td>

                    {/* Assigned Mentor */}
                    <td className="py-3 px-3">
                      {item.mentor_name ? (
                        <span className="font-medium text-slate-700 flex items-center">
                          <UserCheck className="w-3.5 h-3.5 mr-1 text-emerald-600 shrink-0" />
                          <span className="truncate max-w-[110px]">{item.mentor_name}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Days in stage */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center text-slate-500 font-medium">
                        <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                        {item.days_in_stage}d
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedCandidateDetail(item)}
                          className="px-2 py-1 text-xs font-semibold bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[5px] inline-flex items-center shadow-2xs cursor-pointer"
                        >
                          <Eye className="w-3 h-3 mr-1 text-[#1B3270]" />
                          <span>View</span>
                        </button>

                        {!item.assigned_mentor_id ||
                        item.stage_status === 'Awaiting ST Assignment' ? (
                          <button
                            onClick={() => handleOpenAssignModal(item)}
                            className="px-2 py-1 text-xs font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[5px] inline-flex items-center shadow-2xs cursor-pointer whitespace-nowrap"
                          >
                            <UserPlus className="w-3 h-3 mr-1" />
                            Assign
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenAssignModal(item)}
                            className="px-2 py-1 text-[11px] font-medium border border-[#E2E8F4] bg-white hover:bg-slate-50 text-slate-600 rounded-[5px] cursor-pointer"
                          >
                            Reassign
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ASSIGN MENTOR MODAL */}
      {selectedCandidateForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD]">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-[#1B3270]" />
                <h3 className="text-sm font-bold text-slate-800">
                  Assign Mentor to Candidate
                </h3>
              </div>
              <button
                onClick={() => setSelectedCandidateForAssign(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssignMentor} className="p-5 space-y-4 text-xs">
              {assignError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{assignError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-[#E2E8F4] rounded-[8px] space-y-1">
                <span className="text-[11px] text-slate-400 block">Candidate</span>
                <span className="font-bold text-slate-800 text-sm block">
                  {selectedCandidateForAssign.candidate_name}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Supplier: {selectedCandidateForAssign.supplier_name}
                </span>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Select Clinical / Language Mentor
                </label>
                {availableMentors.length === 0 ? (
                  <p className="text-slate-400 italic p-2 bg-slate-50 rounded border border-[#E2E8F4]">
                    No active mentors found. Please provision mentor accounts in Mentor Management tab.
                  </p>
                ) : (
                  <select
                    value={selectedMentorId}
                    onChange={(e) => setSelectedMentorId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  >
                    {availableMentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.activeCount} active candidates)
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-slate-400 mt-1">
                  Mentors with &gt;5 active candidates may experience scheduling bottlenecks.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedCandidateForAssign(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedMentorId}
                  className="px-4 py-1.5 font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] shadow-xs disabled:opacity-50 flex items-center"
                >
                  {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANDIDATE DETAIL DRAWER */}
      {selectedCandidateDetail && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/30 backdrop-blur-2xs transition-all">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-[#E2E8F4] animate-in slide-in-from-right duration-200">
            <div className="px-6 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div>
                <h2 className="text-base font-bold text-[#1B3270]">
                  {selectedCandidateDetail.candidate_name}
                </h2>
                <p className="text-xs text-slate-400">
                  {selectedCandidateDetail.supplier_name} • Stage: {selectedCandidateDetail.current_stage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCandidateDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <CandidateProfileDetailView candidateId={selectedCandidateDetail.candidate_id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicQueueTab;
