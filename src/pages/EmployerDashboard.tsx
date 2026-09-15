import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Home,
  Search,
  FileText,
  BarChart2,
  CheckCircle2,
  MessageCircle,
  Building2,
} from 'lucide-react';
import { DashboardLayout, NavItemConfig } from '../components/layout/DashboardLayout';
import { EmployerHomeTab } from './employer/EmployerHomeTab';
import { EmployerProfileTab } from './employer/EmployerProfileTab';
import { EmployerTalentPoolTab } from './employer/EmployerTalentPoolTab';
import { EmployerMyJobsTab } from './employer/EmployerMyJobsTab';
import { EmployerMyCandidatesTab } from './employer/EmployerMyCandidatesTab';
import { EmployerPlacementsTab } from './employer/EmployerPlacementsTab';
import { EmployerMessagesTab } from './employer/EmployerMessagesTab';

type EmployerTabType =
  | 'home'
  | 'talent_pool'
  | 'my_jobs'
  | 'my_candidates'
  | 'placements'
  | 'messages'
  | 'profile';

import { useSearchParams } from 'react-router-dom';

export const EmployerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as EmployerTabType;
  const [currentTab, setCurrentTab] = useState<EmployerTabType>(
    tabParam && ['home', 'talent_pool', 'my_jobs', 'my_candidates', 'placements', 'messages', 'profile'].includes(tabParam)
      ? tabParam
      : 'home'
  );
  const [employer, setEmployer] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member'>('admin');
  const [loading, setLoading] = useState(true);
  const [openPostJobOnNavigate, setOpenPostJobOnNavigate] = useState(false);
  const [filterCandidateId, setFilterCandidateId] = useState<string | null>(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    const tab = searchParams.get('tab') as EmployerTabType;
    if (
      tab &&
      ['home', 'talent_pool', 'my_jobs', 'my_candidates', 'placements', 'messages', 'profile'].includes(tab) &&
      tab !== currentTab
    ) {
      setCurrentTab(tab);
    }
  }, [searchParams]);

  const fetchEmployer = async () => {
    if (!profile?.id) return;
    try {
      setLoading(true);

      // 1. Try resolving employer ID via helper RPC
      let resolvedEmployerId: string | null = null;
      const { data: rpcEmployerId } = await supabase.rpc('get_my_employer_id');
      if (rpcEmployerId) {
        resolvedEmployerId = rpcEmployerId;
      }

      let data: any = null;
      if (resolvedEmployerId) {
        const { data: empData, error } = await supabase
          .from('employers')
          .select('*')
          .eq('id', resolvedEmployerId)
          .maybeSingle();
        if (!error && empData) {
          data = empData;
        }
      }

      // 2. Direct fallback lookup by user_id or is_admin_profile_id
      if (!data) {
        const { data: directData } = await supabase
          .from('employers')
          .select('*')
          .or(`user_id.eq.${profile.id},is_admin_profile_id.eq.${profile.id}`)
          .maybeSingle();
        data = directData;
      }

      // 3. Fallback lookup via employer_team_members
      if (!data) {
        const { data: teamData } = await supabase
          .from('employer_team_members')
          .select('employer_id')
          .eq('profile_id', profile.id)
          .eq('invite_status', 'accepted')
          .maybeSingle();

        if (teamData?.employer_id) {
          const { data: empByTeam } = await supabase
            .from('employers')
            .select('*')
            .eq('id', teamData.employer_id)
            .maybeSingle();
          data = empByTeam;
        }
      }

      // Edge case: if employer row doesn't exist yet for this employer profile
      if (!data && profile.role === 'employer') {
        const { data: newEmp, error: createErr } = await supabase
          .from('employers')
          .insert({
            user_id: profile.id,
            is_admin_profile_id: profile.id,
            company_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email?.split('@')[0] || 'Employer Facility',
            location: 'Germany',
            country: 'Germany',
          })
          .select()
          .single();

        if (!createErr) {
          data = newEmp;
        }
      }

      // Determine current user's team role
      let userRole: 'admin' | 'member' = 'admin';
      if (data?.id) {
        const { data: member } = await supabase
          .from('employer_team_members')
          .select('role')
          .eq('employer_id', data.id)
          .or(`profile_id.eq.${profile.id},email.eq.${profile.email}`)
          .maybeSingle();

        if (member?.role) {
          userRole = member.role === 'admin' ? 'admin' : 'member';
        } else if (data.user_id === profile.id || data.is_admin_profile_id === profile.id) {
          userRole = 'admin';
        } else {
          userRole = 'member';
        }
      }

      setEmployer(data);
      setCurrentUserRole(userRole);
    } catch (err) {
      console.error('Unexpected error loading employer:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadMessagesCount = async (empId?: string) => {
    const targetId = empId || employer?.id;
    if (!targetId) return;

    try {
      const { count, error } = await supabase
        .from('employer_rm_messages')
        .select('*', { count: 'exact', head: true })
        .eq('employer_id', targetId)
        .eq('sender_type', 'rm')
        .eq('read', false);

      if (!error && count !== null) {
        setUnreadMessagesCount(count);
      }
    } catch (err) {
      console.error('Error fetching unread messages count:', err);
    }
  };

  useEffect(() => {
    fetchEmployer();
  }, [profile?.id]);

  useEffect(() => {
    if (!employer?.id) return;
    fetchUnreadMessagesCount(employer.id);

    // Real-time listener for incoming RM messages or read updates
    const channel = supabase
      .channel(`employer_dashboard_messages_${employer.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employer_rm_messages',
          filter: `employer_id=eq.${employer.id}`,
        },
        () => {
          fetchUnreadMessagesCount(employer.id);
        }
      )
      .subscribe();

    // Fallback periodic poll to ensure unread badge never gets stuck
    const pollInterval = setInterval(() => {
      fetchUnreadMessagesCount(employer.id);
    }, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [employer?.id]);

  const handleNavigateTab = (tab: string, state?: any) => {
    if (state?.openPostJobForm || state?.openPostForm) {
      setOpenPostJobOnNavigate(true);
    } else {
      setOpenPostJobOnNavigate(false);
    }
    if (state?.candidateId) {
      setFilterCandidateId(state.candidateId);
    } else if (tab !== 'my_candidates') {
      setFilterCandidateId(null);
    }
    setCurrentTab(tab as EmployerTabType);
    setSearchParams({ tab });
  };

  const navItems: NavItemConfig[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'talent_pool', label: 'Browse Candidates', icon: Search },
    { id: 'my_jobs', label: 'My Requirements', icon: FileText },
    { id: 'my_candidates', label: 'Candidate Pipeline', icon: BarChart2 },
    { id: 'placements', label: 'Placements', icon: CheckCircle2 },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageCircle,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    },
    { id: 'profile', label: 'Company Profile', icon: Building2, isDividerBefore: true },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
        <span className="text-xs text-[#94A3B8] mt-3 font-medium">
          Loading Employer Dashboard...
        </span>
      </div>
    );
  }

  return (
    <DashboardLayout
      navItems={navItems}
      activeTab={currentTab}
      onTabChange={(tabId) => {
        setOpenPostJobOnNavigate(false);
        setCurrentTab(tabId as EmployerTabType);
        setSearchParams({ tab: tabId });
      }}
    >
      <div className="max-w-7xl mx-auto w-full min-w-0 space-y-6">
        {currentTab === 'home' && (
          <EmployerHomeTab employer={employer} onNavigateTab={handleNavigateTab} />
        )}

        {currentTab === 'talent_pool' && (
          <EmployerTalentPoolTab
            employer={employer}
            onNavigateTab={handleNavigateTab}
          />
        )}

        {currentTab === 'my_jobs' && (
          <EmployerMyJobsTab
            employer={employer}
            initialOpenPostForm={openPostJobOnNavigate}
          />
        )}

        {currentTab === 'my_candidates' && (
          <EmployerMyCandidatesTab
            employer={employer}
            initialCandidateId={filterCandidateId}
            onClearCandidateFilter={() => setFilterCandidateId(null)}
          />
        )}

        {currentTab === 'placements' && (
          <EmployerPlacementsTab employer={employer} />
        )}

        {currentTab === 'messages' && (
          <EmployerMessagesTab
            employer={employer}
            onUnreadCountChange={() => fetchUnreadMessagesCount(employer?.id)}
          />
        )}

        {currentTab === 'profile' && (
          <EmployerProfileTab
            employer={employer}
            currentUserRole={currentUserRole}
            onRefresh={fetchEmployer}
          />
        )}
      </div>
    </DashboardLayout>
  );
};
