import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ShieldCheck,
  Check,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { getCandidateDisplay } from '../../utils/anonymization';
import { notifyByRole } from '../../utils/notificationRouting';
import { EmptyState } from '../../components/ui/EmptyState';
import { CandidateComparisonModal } from './CandidateComparisonModal';
import { formatDate } from '../../utils/formatters';
import { MultiSelectFilter } from '../../components/ui/MultiSelectFilter';

interface EmployerTalentPoolTabProps {
  employer: any;
  onNavigateTab?: (tab: string, state?: any) => void;
}

type TalentPoolView = 'all' | 'expressed_interest';

const ROLE_OPTIONS = [
  { value: 'nursing', label: 'Nursing' },
  { value: 'ausbildung', label: 'Ausbildung' },
  { value: 'care', label: 'Care' },
  { value: 'allied_health', label: 'Allied Health' },
  { value: 'other', label: 'Other Roles' },
];

export const EmployerTalentPoolTab: React.FC<EmployerTalentPoolTabProps> = ({
  employer,
  onNavigateTab,
}) => {
  const [currentView, setCurrentView] = useState<TalentPoolView>('all');
  const [roleFilters, setRoleFilters] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Map candidateId -> interest record { status, id }
  const [interestMap, setInterestMap] = useState<Record<string, { status: string; id?: string }>>({});
  const [submittingInterestId, setSubmittingInterestId] = useState<string | null>(null);

  // Expressed Interest list
  const [expressedList, setExpressedList] = useState<any[]>([]);
  const [loadingExpressed, setLoadingExpressed] = useState(false);

  // Candidate Comparison State (up to 4)
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch candidates and employer interests
  const fetchTalentPool = async () => {
    try {
      setLoading(true);

      // 1. Pull candidates where status = 'interview_ready' AND can_apply_to_jobs = true
      let query = supabase
        .from('candidates')
        .select(`
          id,
          target_role,
          language_level_self_reported,
          total_years_experience,
          status,
          can_apply_to_jobs,
          created_at
        `)
        .eq('status', 'interview_ready')
        .or('can_apply_to_jobs.is.null,can_apply_to_jobs.eq.true')
        .order('created_at', { ascending: false });

      const { data: candData, error: candErr } = await query;

      if (candErr) {
        console.error('Error fetching talent pool candidates:', candErr);
        setCandidates([]);
      } else {
        const cands = candData || [];
        const candIds = cands.map((c) => c.id);

        // Fetch assessed speaking test levels if available
        if (candIds.length > 0) {
          const { data: stData } = await supabase
            .from('speaking_test_results')
            .select('candidate_id, language_level_assessed')
            .in('candidate_id', candIds)
            .eq('review_status', 'approved');

          const stMap = new Map((stData || []).map((s) => [s.candidate_id, s.language_level_assessed]));

          const enriched = cands.map((c) => ({
            ...c,
            speaking_test_level: stMap.get(c.id) || null,
          }));

          setCandidates(enriched);
        } else {
          setCandidates(cands);
        }
      }

      // 2. Fetch all employer interests for this employer
      if (employer?.id) {
        const { data: interests, error: intErr } = await supabase
          .from('employer_candidate_interests')
          .select('id, candidate_id, status')
          .eq('employer_id', employer.id);

        if (!intErr && interests) {
          const map: Record<string, { status: string; id?: string }> = {};
          interests.forEach((item) => {
            if (item.candidate_id) {
              map[item.candidate_id] = { status: item.status || 'pending_facilitation', id: item.id };
            }
          });
          setInterestMap(map);
        }
      }
    } catch (err) {
      console.error('Unexpected error loading talent pool:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCandidates = useMemo(() => {
    if (roleFilters.length === 0) return candidates;
    return candidates.filter((cand) => {
      const role = (cand.target_role || '').toLowerCase();
      return roleFilters.some((f) => {
        if (f === 'nursing') return role.includes('nurs');
        if (f === 'allied_health') return role.includes('allied');
        if (f === 'other') return !role.includes('nurs') && !role.includes('allied') && !role.includes('ausbildung') && !role.includes('care');
        return role.includes(f.toLowerCase());
      });
    });
  }, [candidates, roleFilters]);

  // Fetch Expressed Interest view rows
  const fetchExpressedInterests = async () => {
    if (!employer?.id) return;
    try {
      setLoadingExpressed(true);
      const { data, error } = await supabase
        .from('employer_candidate_interests')
        .select(`
          id,
          candidate_id,
          status,
          created_at,
          linked_application_id,
          candidates:candidate_id (
            id,
            target_role,
            language_level_self_reported,
            total_years_experience
          ),
          job_applications:linked_application_id (
            id,
            job_id,
            job_requirements:job_id (
              title
            )
          )
        `)
        .eq('employer_id', employer.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading expressed interests:', error);
        setExpressedList([]);
      } else {
        setExpressedList(data || []);
      }
    } catch (err) {
      console.error('Error fetching expressed interest tab:', err);
    } finally {
      setLoadingExpressed(false);
    }
  };

  useEffect(() => {
    fetchTalentPool();
  }, [employer?.id]);

  useEffect(() => {
    if (currentView === 'expressed_interest') {
      fetchExpressedInterests();
    }
  }, [currentView, employer?.id]);

  // Express Interest Action
  const handleExpressInterest = async (candId: string) => {
    if (!employer?.id) return;
    const company = employer?.company_name || 'Employer Facility';

    try {
      setSubmittingInterestId(candId);

      // 1. INSERT employer_candidate_interests
      const { data: inserted, error: insertErr } = await supabase
        .from('employer_candidate_interests')
        .insert({
          employer_id: employer.id,
          candidate_id: candId,
          expressed_by: (await supabase.auth.getUser()).data.user?.id,
          status: 'pending_facilitation',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // 2. Notify assigned RM and Employer RMs
      const notifyMessage = `${company} has expressed interest in Candidate #${candId.substring(0, 6).toUpperCase()}. Facilitate and link to a job requirement.`;

      // Check assigned RM
      const { data: rmAssigned } = await supabase
        .from('rm_assignments')
        .select('rm_profile_id')
        .eq('entity_type', 'employer')
        .eq('entity_id', employer.id)
        .eq('active', true)
        .maybeSingle();

      if (rmAssigned?.rm_profile_id) {
        await supabase.from('notifications').insert({
          user_id: rmAssigned.rm_profile_id,
          title: 'Employer Interest — Candidate',
          message: notifyMessage,
          type: 'employer_interest',
          read: false,
        });
      }

      // Also notify employer_requirements_rm role
      await notifyByRole(
        supabase,
        'employer_requirements_rm',
        'Employer Interest — Candidate',
        notifyMessage,
        'employer_interest'
      );

      // 3. UPDATE onboarding_checklist: talent_pool_browsed = true
      const currentChecklist = employer?.onboarding_checklist || {};
      const updatedChecklist = {
        ...currentChecklist,
        talent_pool_browsed: true,
      };
      await supabase
        .from('employers')
        .update({ onboarding_checklist: updatedChecklist })
        .eq('id', employer.id);

      // 4. Update local map
      setInterestMap((prev) => ({
        ...prev,
        [candId]: { status: 'pending_facilitation', id: inserted.id },
      }));

      showToast(`Interest expressed in Candidate #${candId.substring(0, 6).toUpperCase()}.`);
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('duplicate') || err.message?.includes('unique')) {
        showToast('Interest has already been expressed for this candidate.');
      } else {
        showToast(err.message || 'Failed to record interest.');
      }
    } finally {
      setSubmittingInterestId(null);
    }
  };

  // Toggle comparison checkbox
  const handleToggleComparison = (candId: string) => {
    if (selectedForComparison.includes(candId)) {
      setSelectedForComparison((prev) => prev.filter((id) => id !== candId));
    } else {
      if (selectedForComparison.length >= 4) {
        return;
      }
      setSelectedForComparison((prev) => [...prev, candId]);
    }
  };

  const clearComparison = () => {
    setSelectedForComparison([]);
  };

  const selectedCandidatesData = candidates.filter((c) =>
    selectedForComparison.includes(c.id)
  );

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#10B981] text-white px-5 py-3 rounded-[8px] shadow-lg flex items-center space-x-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* VIEW TOGGLE PILLS: "All Candidates" | "Expressed Interest" */}
      <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
        <div className="inline-flex p-1 bg-[#F1F5F9] rounded-full border border-[#E2E8F4]">
          <button
            type="button"
            onClick={() => setCurrentView('all')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all ${
              currentView === 'all'
                ? 'bg-white text-[#1B3270] shadow-xs'
                : 'text-[#4A5568] hover:text-[#1B3270]'
            }`}
          >
            All Candidates
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('expressed_interest')}
            className={`px-5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 ${
              currentView === 'expressed_interest'
                ? 'bg-white text-[#1B3270] shadow-xs'
                : 'text-[#4A5568] hover:text-[#1B3270]'
            }`}
          >
            <span>Expressed Interest</span>
            {Object.keys(interestMap).length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#1B3270]/10 text-[#1B3270] font-bold">
                {Object.keys(interestMap).length}
              </span>
            )}
          </button>
        </div>

        {currentView === 'all' && (
          <div className="text-xs text-[#94A3B8] hidden sm:block">
            Showing verified candidates ready for clinical interviews
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* VIEW 1: ALL CANDIDATES */}
      {/* ========================================================= */}
      {currentView === 'all' && (
        <div className="space-y-6">
          {/* Platform Promise Banner */}
          <div className="bg-[#7EB3E8]/[0.12] border border-[#7EB3E8] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex items-start space-x-3 text-[#1B3270]">
            <ShieldCheck size={22} className="text-[#2952A3] mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#2952A3]">
                TerraTern Verified Talent Standard
              </h4>
              <p className="text-xs font-semibold leading-relaxed flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span>Every candidate shown here has completed the full TerraTern qualification:</span>
                <span className="text-[#10B981] font-medium inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Diagnostic Test</span>
                <span className="text-[#10B981] font-medium inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Document Verification</span>
                <span className="text-[#10B981] font-medium inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Speaking Test</span>
                <span className="text-[#10B981] font-medium inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Interview Bootcamp</span>
                <span className="text-[#10B981] font-medium inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Final Assessment</span>
              </p>
            </div>
          </div>

          {/* Role Filter MultiSelect */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="w-full sm:w-64">
              <MultiSelectFilter
                label="Role"
                options={ROLE_OPTIONS}
                selectedValues={roleFilters}
                onChange={setRoleFilters}
              />
            </div>
            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
              Showing {filteredCandidates.length} of {candidates.length} candidate{candidates.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Candidate Grid */}
          {loading ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
            </div>
          ) : candidates.length === 0 ? (
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
              <EmptyState
                title="No candidates yet"
                subtitle="Candidates will appear here once they complete all qualification gates."
              />
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
              <EmptyState
                title="No candidates match selected filters"
                subtitle="Try selecting different roles to view candidates."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCandidates.map((cand) => {
                const displayInfo = getCandidateDisplay(cand, 'applied');
                const isSelected = selectedForComparison.includes(cand.id);
                const isLimitReached = selectedForComparison.length >= 4 && !isSelected;
                const interest = interestMap[cand.id];
                const interestStatus = interest?.status;
                const isSubmitting = submittingInterestId === cand.id;

                return (
                  <div
                    key={cand.id}
                    className={`bg-white border rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col justify-between transition-all relative ${
                      isSelected
                        ? 'border-[#1B3270] ring-2 ring-[#1B3270]/10 bg-[#F8FAFD]/40'
                        : 'border-[#E2E8F4] hover:border-[#7EB3E8]'
                    }`}
                  >
                    <div>
                      {/* Top Row: Comparison Checkbox & Role Badge */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <label
                          className={`inline-flex items-center space-x-2 text-xs font-semibold cursor-pointer select-none ${
                            isLimitReached ? 'opacity-40 cursor-not-allowed' : 'text-[#0F172A]'
                          }`}
                          title={isLimitReached ? 'Maximum 4 candidates for comparison.' : undefined}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isLimitReached}
                            onChange={() => handleToggleComparison(cand.id)}
                            className="w-4 h-4 rounded text-[#1B3270] focus:ring-[#1B3270] border-gray-300"
                          />
                          <span className="text-[13px] font-bold text-[#1B3270]">
                            {displayInfo.display}
                          </span>
                        </label>

                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#7EB3E8]/20 text-[#2952A3] capitalize whitespace-nowrap">
                          {cand.target_role || 'Healthcare'}
                        </span>
                      </div>

                      {/* Language & Experience Row */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-bold bg-[#F8FAFD] border border-[#E2E8F4] text-[#1B3270]">
                          German {cand.speaking_test_level || cand.language_level_self_reported || 'B1'}
                        </span>
                        {cand.total_years_experience !== null && cand.total_years_experience !== undefined && (
                          <span className="text-[11px] text-[#4A5568] bg-gray-100 px-2 py-0.5 rounded">
                            {cand.total_years_experience} {Number(cand.total_years_experience) === 1 ? 'yr' : 'yrs'} exp
                          </span>
                        )}
                        <span className="text-[11px] text-[#10B981] font-semibold ml-auto">
                          Verified Pass
                        </span>
                      </div>

                      {/* Gate Completion Badges */}
                      <div className="space-y-1.5 mb-5 pt-2 border-t border-[#E2E8F4]">
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider block">
                          Passed Gates
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                            <Check size={10} className="mr-0.5" /> DT
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                            <Check size={10} className="mr-0.5" /> Docs
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                            <Check size={10} className="mr-0.5" /> Speaking
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                            <Check size={10} className="mr-0.5" /> Bootcamp
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                            <Check size={10} className="mr-0.5" /> Assessment
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Three-State "Express Interest" Button */}
                    <div className="pt-2 border-t border-[#E2E8F4] space-y-1.5">
                      {interestStatus === 'in_pipeline' ? (
                        /* State 3: In pipeline */
                        <div>
                          <button
                            type="button"
                            disabled
                            className="w-full py-2 px-3 text-xs font-semibold rounded-[6px] bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 cursor-default"
                          >
                            In Your Pipeline
                          </button>
                          <p className="text-[11px] text-[#4A5568] text-center mt-1">
                            This candidate is in your Candidate Pipeline.
                          </p>
                        </div>
                      ) : interestStatus === 'pending_facilitation' ? (
                        /* State 2: Interest expressed, pending facilitation */
                        <div>
                          <button
                            type="button"
                            disabled
                            className="w-full py-2 px-3 text-xs font-semibold rounded-[6px] bg-gray-100 text-[#94A3B8] border border-gray-200 cursor-default"
                          >
                            Interest Expressed
                          </button>
                          <p className="text-[11px] text-[#4A5568] text-center mt-1">
                            Our team is facilitating this. Check Expressed Interest tab.
                          </p>
                        </div>
                      ) : (
                        /* State 1: Not yet expressed interest */
                        <div>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleExpressInterest(cand.id)}
                            className="w-full py-2 px-3 text-xs font-semibold rounded-[6px] border border-[#1B3270] text-[#1B3270] hover:bg-[#1B3270] hover:text-white transition-colors"
                          >
                            {isSubmitting ? 'Recording Interest...' : 'Express Interest'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sticky Candidate Comparison Bar (Appears when >= 2 selected) */}
          {selectedForComparison.length >= 2 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1B3270] text-white px-6 py-3.5 rounded-[12px] shadow-xl border border-white/10 flex items-center space-x-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-white/20 text-white font-bold text-xs flex items-center justify-center">
                  {selectedForComparison.length}
                </span>
                <span className="text-xs font-semibold">
                  {selectedForComparison.length} candidates selected
                </span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setIsComparisonOpen(true)}
                  className="px-4 py-1.5 bg-white text-[#1B3270] hover:bg-[#F8FAFD] rounded-[6px] text-xs font-bold transition-colors shadow-xs"
                >
                  Compare
                </button>
                <button
                  type="button"
                  onClick={clearComparison}
                  className="text-xs text-white/70 hover:text-white underline transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VIEW 2: EXPRESSED INTEREST */}
      {/* ========================================================= */}
      {currentView === 'expressed_interest' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">Expressed Interest Tracking</h3>
              <p className="text-xs text-[#4A5568] mt-0.5">
                Monitor candidates you have requested for staffing requirement facilitation.
              </p>
            </div>
          </div>

          {loadingExpressed ? (
            <div className="py-12 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
            </div>
          ) : expressedList.length === 0 ? (
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-12 text-center shadow-xs">
              <EmptyState
                title="No expressed interests yet"
                subtitle="You have not expressed interest in any candidates yet. Browse the candidate pool to get started."
              />
              <button
                type="button"
                onClick={() => setCurrentView('all')}
                className="mt-4 px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors"
              >
                Browse Candidates
              </button>
            </div>
          ) : (
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-[#4A5568] font-semibold">
                    <tr>
                      <th className="py-3 px-4">Candidate</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Language Level</th>
                      <th className="py-3 px-4">Date Expressed</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Linked Job</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F4] text-[#0F172A]">
                    {expressedList.map((item) => {
                      const cand = item.candidates || {};
                      const anonId = `Candidate #${item.candidate_id?.substring(0, 6).toUpperCase()}`;
                      const linkedJobTitle = item.job_applications?.job_requirements?.title || '—';

                      return (
                        <tr key={item.id} className="hover:bg-[#F8FAFD]/60">
                          <td className="py-3.5 px-4 font-bold text-[#1B3270]">
                            {anonId}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#7EB3E8]/20 text-[#2952A3] capitalize">
                              {cand.target_role || 'Healthcare'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 font-medium">
                            German {cand.language_level_self_reported || 'B1'}
                          </td>

                          <td className="py-3.5 px-4 text-[#4A5568]">
                            {formatDate(item.created_at)}
                          </td>

                          <td className="py-3.5 px-4">
                            {item.status === 'in_pipeline' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                                In your pipeline
                              </span>
                            ) : item.status === 'not_proceeded' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-[#94A3B8] border border-gray-200">
                                Not proceeded
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
                                Awaiting facilitation
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-[#4A5568]">
                            {linkedJobTitle}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {item.status === 'in_pipeline' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (onNavigateTab) {
                                    onNavigateTab('my_candidates', { candidateId: item.candidate_id });
                                  }
                                }}
                                className="inline-flex items-center space-x-1 text-xs font-semibold text-[#1B3270] hover:text-[#2952A3]"
                              >
                                <span>View in Pipeline</span>
                                <ArrowRight size={13} />
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#94A3B8] italic">Facilitating</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {isComparisonOpen && (
        <CandidateComparisonModal
          candidates={selectedCandidatesData}
          employer={employer}
          interestMap={interestMap}
          onExpressInterest={handleExpressInterest}
          onClose={() => setIsComparisonOpen(false)}
          submittingInterestId={submittingInterestId}
        />
      )}
    </div>
  );
};
