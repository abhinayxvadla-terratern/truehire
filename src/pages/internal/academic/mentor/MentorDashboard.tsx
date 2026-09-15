import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InternalShell, InternalTabItem } from '../../../../components/internal/InternalShell';
import { MentorOverviewTab } from './MentorOverviewTab';
import { MentorCandidatesTab } from './MentorCandidatesTab';
import { MentorCohortsTab } from './MentorCohortsTab';
import { MentorSessionNotesTab } from './MentorSessionNotesTab';
import { LayoutGrid, Layers, Users, Edit3 } from 'lucide-react';

export const MentorDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';
  const cohortIdParam = searchParams.get('cohortId') || undefined;
  const [activeTab, setActiveTab] = useState(currentTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const tabs: InternalTabItem[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'my-cohorts', label: 'My Cohorts', icon: Layers },
    { id: 'my-candidates', label: 'My Candidates', icon: Users },
    { id: 'session-notes', label: 'Session Notes', icon: Edit3 },
  ];

  const handleTabChange = (tabId: string, extraParams?: Record<string, string>) => {
    setActiveTab(tabId);
    const params: Record<string, string> = { tab: tabId, ...(extraParams || {}) };
    setSearchParams(params);
  };

  return (
    <InternalShell tabs={tabs} activeTab={activeTab} onTabChange={(t) => handleTabChange(t)}>
      {activeTab === 'overview' && (
        <MentorOverviewTab onNavigateTab={(t) => handleTabChange(t)} />
      )}
      {activeTab === 'my-candidates' && (
        <MentorCandidatesTab onNavigateTab={(t, p) => handleTabChange(t, p)} />
      )}
      {activeTab === 'my-cohorts' && (
        <MentorCohortsTab initialCohortId={cohortIdParam} />
      )}
      {activeTab === 'session-notes' && (
        <MentorSessionNotesTab onNavigateTab={(t, p) => handleTabChange(t, p)} />
      )}
    </InternalShell>
  );
};

export default MentorDashboard;
