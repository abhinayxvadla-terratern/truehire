import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InternalShell, InternalTabItem } from '../../../../components/internal/InternalShell';
import { AcademicLeadOverviewTab } from './AcademicLeadOverviewTab';
import { AcademicQueueTab } from './AcademicQueueTab';
import { GateReviewTab } from './GateReviewTab';
import { AcademicCohortsTab } from './AcademicCohortsTab';
import { AcademicSchedulesTab } from './AcademicSchedulesTab';
import { MentorManagementTab } from './MentorManagementTab';
import { AcademicDtQuestionsTab } from './AcademicDtQuestionsTab';
import { AcademicRubricTab } from './AcademicRubricTab';
import { AcademicOfferingsTab } from './AcademicOfferingsTab';

import {
  LayoutGrid,
  List,
  CheckSquare,
  Layers,
  Calendar,
  User,
  HelpCircle,
  Sliders,
  BookOpen,
} from 'lucide-react';

const TABS: InternalTabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'qualification_queue', label: 'Qualification Queue', icon: List },
  { id: 'result_review', label: 'Result Review', icon: CheckSquare },
  { id: 'cohorts', label: 'Cohorts', icon: Layers },
  { id: 'schedules', label: 'Test Schedules', icon: Calendar },
  { id: 'mentors', label: 'Mentor Management', icon: User },
  { id: 'dt_questions', label: 'DT Questions', icon: HelpCircle },
  { id: 'rubric_criteria', label: 'Rubric Criteria', icon: Sliders },
  { id: 'offerings', label: 'Training Offerings', icon: BookOpen },
];

export const AcademicLeadDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState<string>(currentTab);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string, filter?: string) => {
    // Normalization for legacy keys
    let normalized = tabId;
    if (tabId === 'academy-queue') normalized = 'qualification_queue';
    if (tabId === 'gate-review') normalized = 'result_review';

    setActiveTab(normalized);
    const params: Record<string, string> = { tab: normalized };
    if (filter) {
      params.filter = filter;
    }
    setSearchParams(params);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return <AcademicLeadOverviewTab onNavigateTab={handleTabChange} />;
      case 'qualification_queue':
      case 'academy-queue':
        return <AcademicQueueTab />;
      case 'result_review':
      case 'gate-review':
        return <GateReviewTab initialFilter={searchParams.get('filter') || undefined} />;
      case 'cohorts':
        return <AcademicCohortsTab />;
      case 'schedules':
        return <AcademicSchedulesTab />;
      case 'mentors':
        return <MentorManagementTab />;
      case 'dt_questions':
        return <AcademicDtQuestionsTab />;
      case 'rubric_criteria':
        return <AcademicRubricTab />;
      case 'offerings':
        return <AcademicOfferingsTab />;
      default:
        return <AcademicLeadOverviewTab onNavigateTab={handleTabChange} />;
    }
  };

  return (
    <InternalShell tabs={TABS} activeTab={activeTab} onTabChange={handleTabChange}>
      {renderActiveTab()}
    </InternalShell>
  );
};

export default AcademicLeadDashboard;
