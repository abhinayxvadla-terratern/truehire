import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InternalShell, InternalTabItem } from '../../../../components/internal/InternalShell';
import { EmployerRmOverviewTab } from './EmployerRmOverviewTab';
import { EmployerRmEmployersTab } from './EmployerRmEmployersTab';
import { EmployerRmJobsTab } from './EmployerRmJobsTab';
import { EmployerRmPipelineTab } from './EmployerRmPipelineTab';
import { EmployerRmRevealGateTab } from './EmployerRmRevealGateTab';

import { LayoutGrid, Building2, FileText, BarChart2, Unlock } from 'lucide-react';

const TABS: InternalTabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'my_employers', label: 'My Employers', icon: Building2 },
  { id: 'jobs', label: 'Job Requirements', icon: FileText },
  { id: 'pipeline', label: 'Application Pipeline', icon: BarChart2 },
  { id: 'reveal_gate', label: 'Reveal Process', icon: Unlock },
];

export const EmployerRmDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';
  const statusParam = searchParams.get('status') || undefined;
  const [activeTab, setActiveTab] = useState<string>(currentTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string, filterParam?: string) => {
    setActiveTab(tabId);
    if (filterParam) {
      setSearchParams({ tab: tabId, status: filterParam });
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return <EmployerRmOverviewTab onNavigateTab={handleTabChange} />;
      case 'my_employers':
        return <EmployerRmEmployersTab />;
      case 'jobs':
        return <EmployerRmJobsTab />;
      case 'pipeline':
        return <EmployerRmPipelineTab initialStatusFilter={statusParam} />;
      case 'reveal_gate':
        return <EmployerRmRevealGateTab />;
      default:
        return <EmployerRmOverviewTab onNavigateTab={handleTabChange} />;
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

export default EmployerRmDashboard;
