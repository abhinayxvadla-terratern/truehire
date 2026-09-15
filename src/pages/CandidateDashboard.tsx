import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Home, ClipboardList, Folder, Award, Briefcase, User } from 'lucide-react';
import { DashboardLayout, NavItemConfig } from '../components/layout/DashboardLayout';
import { HomeTab } from './candidate/HomeTab';
import { ProfileTab } from './candidate/ProfileTab';
import { JobPoolTab } from './candidate/JobPoolTab';
import { DtTab } from './candidate/DtTab';
import { DocumentationTab } from './candidate/DocumentationTab';
import { AcademyTab } from './candidate/AcademyTab';
import { ProfileModal } from './candidate/ProfileModal';

type TabType = 'home' | 'profile' | 'job_pool' | 'dt' | 'documentation' | 'academy';

const CANDIDATE_NAV_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'dt', label: 'Diagnostic Test', icon: ClipboardList },
  { id: 'documentation', label: 'My Documents', icon: Folder },
  { id: 'academy', label: 'Qualification', icon: Award },
  { id: 'job_pool', label: 'Browse Jobs', icon: Briefcase },
  { id: 'profile', label: 'My Profile', icon: User, isDividerBefore: true },
];

export const CandidateDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TabType;
  const [currentTab, setCurrentTab] = useState<TabType>(
    tabParam && CANDIDATE_NAV_ITEMS.some((i) => i.id === tabParam) ? tabParam : 'home'
  );
  const [candidate, setCandidate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && CANDIDATE_NAV_ITEMS.some((i) => i.id === tab) && tab !== currentTab) {
      setCurrentTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string, extraParams?: Record<string, string>) => {
    setCurrentTab(tabId as TabType);
    setSearchParams({ tab: tabId, ...(extraParams || {}) });
  };

  const fetchCandidate = async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      let { data, error } = await supabase
        .from('candidates')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading candidate record:', error);
      }

      // If user registered with role candidate but no candidates row yet exists
      if (!data && profile.role === 'candidate') {
        const { data: newCand, error: createErr } = await supabase
          .from('candidates')
          .insert({
            user_id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            status: 'onboarding',
          })
          .select()
          .single();

        if (!createErr) {
          data = newCand;
        }
      }

      setCandidate(data);
    } catch (err) {
      console.error('Unexpected error loading candidate:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidate();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
        <span className="text-xs text-[#94A3B8] mt-3 font-medium">
          Loading Candidate Dashboard...
        </span>
      </div>
    );
  }

  return (
    <DashboardLayout
      navItems={CANDIDATE_NAV_ITEMS}
      activeTab={currentTab}
      onTabChange={handleTabChange}
    >
      <div className="max-w-7xl mx-auto w-full min-w-0 space-y-6">
        {currentTab === 'home' && (
          <HomeTab
            candidate={candidate}
            onNavigateTab={handleTabChange}
            onOpenProfileModal={() => setIsProfileModalOpen(true)}
          />
        )}

        {currentTab === 'profile' && (
          <ProfileTab
            candidate={candidate}
            onRefreshCandidate={fetchCandidate}
          />
        )}

        {currentTab === 'job_pool' && <JobPoolTab candidate={candidate} />}

        {currentTab === 'dt' && (
          <DtTab
            candidate={candidate}
            onNavigateTab={handleTabChange}
          />
        )}

        {currentTab === 'documentation' && (
          <DocumentationTab candidate={candidate} />
        )}

        {currentTab === 'academy' && <AcademyTab candidate={candidate} />}
      </div>

      {/* Complete Profile Modal */}
      {candidate && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          candidateId={candidate.id}
          initialTargetRole={candidate.target_role}
          initialLanguageLevel={candidate.language_level_self_reported}
          initialNationality={candidate.nationality}
          onSuccess={fetchCandidate}
        />
      )}
    </DashboardLayout>
  );
};
