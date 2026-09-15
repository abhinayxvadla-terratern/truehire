import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InternalShell, InternalTabItem } from '../../../components/internal/InternalShell';
import { OverviewTab } from './OverviewTab';
import { CandidatesTab } from './CandidatesTab';
import { SuppliersTab } from './SuppliersTab';
import { EmployersTab } from './EmployersTab';
import { CohortsTab } from './CohortsTab';
import { PlacementsTab } from './PlacementsTab';
import { RevealQueueTab } from './RevealQueueTab';
import { InternalTeamTab } from './InternalTeamTab';
import { GateManagementTab } from './GateManagementTab';
import { DtQuestionsTab } from './DtQuestionsTab';
import { RubricCriteriaTab } from './RubricCriteriaTab';
import { OfferingsTab } from './OfferingsTab';
import { MessagesAuditTab } from './MessagesAuditTab';
import { NotificationsTab } from './NotificationsTab';
import { SettingsTab } from './SettingsTab';

import {
  LayoutGrid,
  Users,
  Briefcase,
  Building2,
  Layers,
  CheckCircle2,
  Unlock,
  Shield,
  GitBranch,
  HelpCircle,
  Sliders,
  BookOpen,
  Mail,
  Bell,
  Settings,
} from 'lucide-react';

const TABS: InternalTabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid, section: 'Platform' },
  { id: 'candidates', label: 'All Candidates', icon: Users, section: 'Stakeholders' },
  { id: 'suppliers', label: 'All Suppliers', icon: Briefcase, section: 'Stakeholders' },
  { id: 'employers', label: 'All Employers', icon: Building2, section: 'Stakeholders' },
  { id: 'cohorts', label: 'Cohorts', icon: Layers, section: 'Operations' },
  { id: 'placements', label: 'Placements', icon: CheckCircle2, section: 'Operations' },
  { id: 'reveal_queue', label: 'Reveal Queue', icon: Unlock, section: 'Operations' },
  { id: 'team', label: 'Team Management', icon: Shield, section: 'Team' },
  { id: 'gates', label: 'Gate Results', icon: GitBranch, section: 'Configuration' },
  { id: 'dt_questions', label: 'DT Questions', icon: HelpCircle, section: 'Configuration' },
  { id: 'rubric_criteria', label: 'Rubric Criteria', icon: Sliders, section: 'Configuration' },
  { id: 'offerings', label: 'Training Catalogue', icon: BookOpen, section: 'Configuration' },
  { id: 'messages_audit', label: 'Messages Audit', icon: Mail, section: 'Configuration' },
  { id: 'notifications', label: 'Notifications', icon: Bell, section: 'Configuration' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'Configuration' },
];

export const SuperAdminDashboard: React.FC = () => {
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
        return <OverviewTab onNavigateTab={handleTabChange} />;
      case 'candidates':
        return <CandidatesTab />;
      case 'suppliers':
        return (
          <SuppliersTab
            onNavigateCandidatesWithFilter={(_supplierName) => {
              handleTabChange('candidates');
            }}
          />
        );
      case 'employers':
        return <EmployersTab />;
      case 'cohorts':
        return <CohortsTab />;
      case 'placements':
        return <PlacementsTab />;
      case 'reveal_queue':
        return <RevealQueueTab />;
      case 'team':
        return <InternalTeamTab />;
      case 'gates':
        return <GateManagementTab />;
      case 'dt_questions':
        return <DtQuestionsTab />;
      case 'rubric_criteria':
        return <RubricCriteriaTab />;
      case 'offerings':
        return <OfferingsTab />;
      case 'messages_audit':
        return <MessagesAuditTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <OverviewTab onNavigateTab={handleTabChange} />;
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

export default SuperAdminDashboard;
