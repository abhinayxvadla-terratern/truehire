import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InternalShell, InternalTabItem } from '../../../../components/internal/InternalShell';
import { EmployerAssociateOverviewTab } from './EmployerAssociateOverviewTab';
import { EmployerAssociateEmployersTab } from './EmployerAssociateEmployersTab';
import { OnboardEmployerTab } from './OnboardEmployerTab';

import { LayoutGrid, Building2, PlusCircle } from 'lucide-react';

const TABS: InternalTabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'my_employers', label: 'My Employers', icon: Building2 },
  { id: 'onboard', label: 'Onboard Employer', icon: PlusCircle },
];

export const EmployerAssociateDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState<string>(currentTab);
  const [targetEmployerId, setTargetEmployerId] = useState<string | null>(null);

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
        return (
          <EmployerAssociateOverviewTab
            onNavigateTab={handleTabChange}
            onSelectEmployerForDetail={(empId) => setTargetEmployerId(empId)}
          />
        );
      case 'my_employers':
        return <EmployerAssociateEmployersTab initialSelectedEmployerId={targetEmployerId} />;
      case 'onboard':
        return <OnboardEmployerTab />;
      default:
        return (
          <EmployerAssociateOverviewTab
            onNavigateTab={handleTabChange}
            onSelectEmployerForDetail={(empId) => setTargetEmployerId(empId)}
          />
        );
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

export default EmployerAssociateDashboard;
