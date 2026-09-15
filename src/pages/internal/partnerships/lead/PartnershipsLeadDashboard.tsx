import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InternalShell, InternalTabItem } from '../../../../components/internal/InternalShell';
import { LeadOverviewTab } from './LeadOverviewTab';
import { LeadSuppliersTab } from './LeadSuppliersTab';
import { LeadEmployersTab } from './LeadEmployersTab';
import { LeadTeamTab } from './LeadTeamTab';

import { LayoutGrid, Briefcase, Building2, Users } from 'lucide-react';

const TABS: InternalTabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'suppliers', label: 'Supplier Accounts', icon: Briefcase },
  { id: 'employers', label: 'Employer Accounts', icon: Building2 },
  { id: 'team', label: 'My Team', icon: Users },
];

export const PartnershipsLeadDashboard: React.FC = () => {
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
        return <LeadOverviewTab onNavigateTab={handleTabChange} />;
      case 'suppliers':
        return <LeadSuppliersTab />;
      case 'employers':
        return <LeadEmployersTab />;
      case 'team':
        return <LeadTeamTab />;
      default:
        return <LeadOverviewTab onNavigateTab={handleTabChange} />;
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

export default PartnershipsLeadDashboard;
