import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Users,
  Calendar,
  Award,
  Briefcase,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  Circle,
  ArrowRight,
} from 'lucide-react';
import { formatTimeAgo } from '../../utils/formatters';

interface EmployerHomeTabProps {
  employer: any;
  onNavigateTab: (tab: string, state?: any) => void;
}

export const EmployerHomeTab: React.FC<EmployerHomeTabProps> = ({
  employer,
  onNavigateTab,
}) => {
  const [stats, setStats] = useState({
    pipeline: 0,
    interviewsScheduled: 0,
    pendingOffers: 0,
    activeJobs: 0,
  });
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [checklist, setChecklist] = useState({
    profile_completed: false,
    rm_assigned: false,
    first_requirement_posted: false,
    talent_pool_browsed: false,
    first_placement: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchHomeData = async () => {
    if (!employer?.id) return;
    try {
      setLoading(true);

      // 1. Get employer's job requirement IDs
      const { data: employerJobs } = await supabase
        .from('job_requirements')
        .select('id, title, status')
        .eq('employer_id', employer.id);

      const jobIds = (employerJobs || []).map((j) => j.id);
      const activeJobsCount = (employerJobs || []).filter(
        (j) => j.status === 'active'
      ).length;

      let placedCount = 0;

      if (jobIds.length > 0) {
        // Total in pipeline: NOT IN ('rejected', 'placed')
        const { count: pipelineCount } = await supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .in('job_id', jobIds)
          .not('status', 'in', '("rejected","placed")');

        // Interviews Scheduled: status = 'interview_scheduled'
        const { count: interviewsCount } = await supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .in('job_id', jobIds)
          .eq('status', 'interview_scheduled');

        // Pending Offers: status = 'offer_sent'
        const { count: offersCount } = await supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .in('job_id', jobIds)
          .eq('status', 'offer_sent');

        // Placed candidates count
        const { count: placedTotal } = await supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .in('job_id', jobIds)
          .eq('status', 'placed');

        placedCount = placedTotal || 0;

        // Recent Movements: last 5 job_applications
        const { data: movements } = await supabase
          .from('job_applications')
          .select(`
            id,
            candidate_id,
            status,
            updated_at,
            job_requirements (
              title
            )
          `)
          .in('job_id', jobIds)
          .order('updated_at', { ascending: false })
          .limit(5);

        setStats({
          pipeline: pipelineCount || 0,
          interviewsScheduled: interviewsCount || 0,
          pendingOffers: offersCount || 0,
          activeJobs: activeJobsCount,
        });

        setRecentMovements(movements || []);
      } else {
        setStats({
          pipeline: 0,
          interviewsScheduled: 0,
          pendingOffers: 0,
          activeJobs: activeJobsCount,
        });
        setRecentMovements([]);
      }

      // 2. Recompute Onboarding Checklist
      // Step 1: profile_completed: company_name, company_size, primary_contact_name, country all non-null
      const profileCompleted = Boolean(
        employer.company_name?.trim() &&
        employer.company_size &&
        employer.primary_contact_name?.trim() &&
        (employer.country || employer.location)
      );

      // Step 2: rm_assigned: rm_assignments exists for this employer (active = true)
      const { count: rmCount } = await supabase
        .from('rm_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('entity_type', 'employer')
        .eq('entity_id', employer.id)
        .eq('active', true);
      const rmAssigned = (rmCount || 0) > 0;

      // Step 3: first_requirement_posted: count job_requirements >= 1
      const firstRequirementPosted = (employerJobs?.length || 0) >= 1;

      // Step 4: talent_pool_browsed: count employer_candidate_interests >= 1
      const { count: interestCount } = await supabase
        .from('employer_candidate_interests')
        .select('id', { count: 'exact', head: true })
        .eq('employer_id', employer.id);
      const talentPoolBrowsed = (interestCount || 0) >= 1;

      // Step 5: first_placement: count placed applications >= 1
      const firstPlacement = placedCount >= 1;

      const newChecklist = {
        profile_completed: profileCompleted,
        rm_assigned: rmAssigned,
        first_requirement_posted: firstRequirementPosted,
        talent_pool_browsed: talentPoolBrowsed,
        first_placement: firstPlacement,
      };

      setChecklist(newChecklist);

      // Persist to employers.onboarding_checklist
      await supabase
        .from('employers')
        .update({ onboarding_checklist: newChecklist })
        .eq('id', employer.id);
    } catch (err) {
      console.error('Error loading employer home data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeData();
  }, [employer?.id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'shortlisted':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#7EB3E8]/20 text-[#2952A3] border border-[#7EB3E8]/30 capitalize">
            Shortlisted
          </span>
        );
      case 'interview_scheduled':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 capitalize">
            Interview Scheduled
          </span>
        );
      case 'interviewed':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#7C3AED] text-white capitalize">
            Interviewed
          </span>
        );
      case 'selected':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 capitalize">
            Selected
          </span>
        );
      case 'offer_sent':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 capitalize">
            Offer Sent
          </span>
        );
      case 'reveal_gate':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#1B3270] text-white capitalize">
            Reveal Gate
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 capitalize">
            Rejected
          </span>
        );
      case 'applied':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-[#4A5568] border border-gray-200 capitalize">
            Applied
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
      </div>
    );
  }

  const allChecklistComplete =
    checklist.profile_completed &&
    checklist.rm_assigned &&
    checklist.first_requirement_posted &&
    checklist.talent_pool_browsed &&
    checklist.first_placement;

  const checklistCompletedCount = [
    checklist.profile_completed,
    checklist.rm_assigned,
    checklist.first_requirement_posted,
    checklist.talent_pool_browsed,
    checklist.first_placement,
  ].filter(Boolean).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-150">
      {/* ONBOARDING CHECKLIST CARD — shown until all 5 complete */}
      {!allChecklistComplete && (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">
                Get Started with TerraTern
              </h2>
              <p className="text-xs text-[#4A5568] mt-0.5">
                Complete these initial milestones to activate your international recruitment pipeline.
              </p>
            </div>
            <span className="text-xs font-bold text-[#1B3270] bg-[#1B3270]/10 px-3 py-1 rounded-full">
              {checklistCompletedCount} of 5 steps complete
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[#E2E8F4] h-2 rounded-full overflow-hidden mb-6">
            <div
              className="bg-[#10B981] h-full transition-all duration-300 rounded-full"
              style={{ width: `${(checklistCompletedCount / 5) * 100}%` }}
            ></div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-3.5">
            {/* Step 1: Profile Completed */}
            <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] last:border-b-0">
              <div className="flex items-center space-x-3">
                {checklist.profile_completed ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    checklist.profile_completed ? 'text-[#0F172A]' : 'text-[#4A5568]'
                  }`}
                >
                  Company profile completed
                </span>
              </div>
              {!checklist.profile_completed && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('profile')}
                  className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1"
                >
                  <span>Complete Profile</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Step 2: Account Manager Assigned */}
            <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] last:border-b-0">
              <div className="flex items-center space-x-3">
                {checklist.rm_assigned ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    checklist.rm_assigned ? 'text-[#0F172A]' : 'text-[#4A5568]'
                  }`}
                >
                  Account manager assigned
                </span>
              </div>
              {!checklist.rm_assigned && (
                <span className="text-[11px] text-[#94A3B8] italic">
                  Assigned by TerraTern team.
                </span>
              )}
            </div>

            {/* Step 3: First Job Requirement Posted */}
            <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] last:border-b-0">
              <div className="flex items-center space-x-3">
                {checklist.first_requirement_posted ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    checklist.first_requirement_posted ? 'text-[#0F172A]' : 'text-[#4A5568]'
                  }`}
                >
                  First job requirement posted
                </span>
              </div>
              {!checklist.first_requirement_posted && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('my_jobs', { openPostForm: true })}
                  className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1"
                >
                  <span>Post your first requirement</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Step 4: Browsed Candidate Pool */}
            <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] last:border-b-0">
              <div className="flex items-center space-x-3">
                {checklist.talent_pool_browsed ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    checklist.talent_pool_browsed ? 'text-[#0F172A]' : 'text-[#4A5568]'
                  }`}
                >
                  Browsed the candidate pool
                </span>
              </div>
              {!checklist.talent_pool_browsed && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('talent_pool')}
                  className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1"
                >
                  <span>Browse candidates</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Step 5: First Candidate Placed */}
            <div className="flex items-center justify-between py-1 border-b border-[#F1F5F9] last:border-b-0">
              <div className="flex items-center space-x-3">
                {checklist.first_placement ? (
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                )}
                <span
                  className={`text-xs font-medium ${
                    checklist.first_placement ? 'text-[#0F172A]' : 'text-[#4A5568]'
                  }`}
                >
                  First candidate placed
                </span>
              </div>
              {!checklist.first_placement && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('my_candidates')}
                  className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1"
                >
                  <span>Track your pipeline</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* STATS ROW — 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total in Pipeline */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">
              Total in Pipeline
            </span>
            <div className="w-8 h-8 rounded-md bg-[#7EB3E8]/20 flex items-center justify-center text-[#1B3270]">
              <Users size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1B3270] mt-2">{stats.pipeline}</p>
          </div>
        </div>

        {/* Card 2: Interviews Scheduled */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">
              Interviews Scheduled
            </span>
            <div className="w-8 h-8 rounded-md bg-[#F59E0B]/15 flex items-center justify-center text-[#F59E0B]">
              <Calendar size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1B3270] mt-2">{stats.interviewsScheduled}</p>
          </div>
        </div>

        {/* Card 3: Pending Offers */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">
              Pending Offers
            </span>
            <div className="w-8 h-8 rounded-md bg-[#10B981]/15 flex items-center justify-center text-[#10B981]">
              <Award size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1B3270] mt-2">{stats.pendingOffers}</p>
          </div>
        </div>

        {/* Card 4: Active Jobs */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">
              Active Jobs
            </span>
            <div className="w-8 h-8 rounded-md bg-[#2952A3]/10 flex items-center justify-center text-[#2952A3]">
              <Briefcase size={18} />
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#1B3270] mt-2">{stats.activeJobs}</p>
          </div>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-[#1B3270]">Recruitment Actions</h3>
          <p className="text-xs text-[#4A5568] mt-0.5">
            Create new clinical hiring requirements or discover verified German-ready talent.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigateTab('my_jobs', { openPostForm: true })}
            className="py-2 px-4 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-medium rounded-[6px] transition-colors shadow-[0_1px_4px_rgba(27,50,112,0.08)] flex items-center space-x-1.5"
          >
            <Plus size={14} />
            <span>Post New Job</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('talent_pool')}
            className="py-2 px-4 bg-white hover:bg-[#F8FAFD] text-[#1B3270] border border-[#E2E8F4] text-xs font-medium rounded-[6px] transition-colors flex items-center space-x-1.5"
          >
            <Search size={14} />
            <span>Browse Talent Pool</span>
          </button>
        </div>
      </div>

      {/* RECENT MOVEMENTS */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-[0_1px_4px_rgba(27,50,112,0.08)] space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1B3270]">Recent Movements</h3>
          <span className="text-xs text-[#94A3B8]">Pipeline progression</span>
        </div>

        {recentMovements.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#4A5568]">
            No recent activity.
          </div>
        ) : (
          <div className="space-y-3">
            {recentMovements.map((move) => {
              const anonId = `Candidate #${move.candidate_id.substring(0, 6).toUpperCase()}`;

              return (
                <div
                  key={move.id}
                  className="p-3 bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[#1B3270] block">
                      {anonId}
                    </span>
                    <span className="text-[#4A5568]">
                      {move.job_requirements?.title || 'Healthcare Position'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div>{getStatusBadge(move.status)}</div>
                    <span className="text-[11px] text-[#94A3B8] whitespace-nowrap flex items-center">
                      <Clock size={11} className="mr-0.5" />
                      {formatTimeAgo(move.updated_at)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
