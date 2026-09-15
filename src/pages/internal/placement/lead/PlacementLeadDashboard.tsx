import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InternalShell, InternalTabItem } from '../../../../components/internal/InternalShell';
import { LeadOverviewTab } from './LeadOverviewTab';
import { LeadCandidatePipelineTab } from './LeadCandidatePipelineTab';
import { LeadEmployerPipelineTab } from './LeadEmployerPipelineTab';
import { LeadRmAssignmentQueueTab } from './LeadRmAssignmentQueueTab';
import { LeadCohortsTab } from './LeadCohortsTab';
import { LeadPlacementsTab } from './LeadPlacementsTab';
import { LeadRevealGateTab } from './LeadRevealGateTab';
import { LeadTeamTab } from './LeadTeamTab';

import {
  LayoutGrid,
  UserCheck,
  Users,
  Building2,
  Layers,
  Unlock,
  CheckCircle2,
  Shield,
} from 'lucide-react';

const TABS: InternalTabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'rm_assignment_queue', label: 'RM Assignment Queue', icon: UserCheck },
  { id: 'candidate_pipeline', label: 'Candidate Pipeline', icon: Users },
  { id: 'employer_pipeline', label: 'Employer Pipeline', icon: Building2 },
  { id: 'cohorts', label: 'Cohorts', icon: Layers },
  { id: 'reveal_gate', label: 'Reveal Process', icon: Unlock },
  { id: 'placements', label: 'Placements', icon: CheckCircle2 },
  { id: 'my_team', label: 'My Team', icon: Shield },
];

export const PlacementLeadDashboard: React.FC = () => {
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
      case 'candidate_pipeline':
        return <LeadCandidatePipelineTab />;
      case 'employer_pipeline':
        return <LeadEmployerPipelineTab />;
      case 'rm_assignment_queue':
        return <LeadRmAssignmentQueueTab />;
      case 'cohorts':
        return <LeadCohortsTab />;
      case 'placements':
        return <LeadPlacementsTab />;
      case 'reveal_gate':
        return <LeadRevealGateTab />;
      case 'my_team':
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

export default PlacementLeadDashboard;
