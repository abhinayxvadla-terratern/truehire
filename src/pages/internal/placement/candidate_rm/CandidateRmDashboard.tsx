import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InternalShell, InternalTabItem } from '../../../../components/internal/InternalShell';
import { CandidateRmOverviewTab } from './CandidateRmOverviewTab';
import { CandidateRmCandidatesTab } from './CandidateRmCandidatesTab';
import { CandidateRmSuppliersTab } from './CandidateRmSuppliersTab';
import { CandidateRmCohortsTab } from './CandidateRmCohortsTab';
import { CandidateRmNotificationsTab } from './CandidateRmNotificationsTab';
import { LayoutGrid, Users, Briefcase, Layers, Bell } from 'lucide-react';

const TABS: InternalTabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'my_candidates', label: 'My Candidates', icon: Users },
  { id: 'my_suppliers', label: 'My Suppliers', icon: Briefcase },
  { id: 'cohorts', label: 'Cohorts', icon: Layers },
  { id: 'notifications', label: 'Send Notification', icon: Bell },
];

export const CandidateRmDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState<string>(currentTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return <CandidateRmOverviewTab onNavigateTab={handleTabChange} />;
      case 'my_candidates':
        return <CandidateRmCandidatesTab />;
      case 'my_suppliers':
        return <CandidateRmSuppliersTab />;
      case 'cohorts':
        return <CandidateRmCohortsTab />;
      case 'notifications':
        return <CandidateRmNotificationsTab />;
      default:
        return <CandidateRmOverviewTab onNavigateTab={handleTabChange} />;
    }
  };

  return (
    <InternalShell
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    >
      {renderActiveTab()}
    </InternalShell>
  );
};

export default CandidateRmDashboard;
