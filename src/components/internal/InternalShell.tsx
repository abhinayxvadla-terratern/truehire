import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout, NavItemConfig } from '../layout/DashboardLayout';
import { LayoutGrid, LucideIcon } from 'lucide-react';

export interface InternalTabItem {
  id: string;
  label: string;
  count?: number;
  icon?: LucideIcon;
  section?: string;
  isDividerBefore?: boolean;
}

interface InternalShellProps {
  tabs?: InternalTabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  children: React.ReactNode;
}

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  super_admin: 'Super Admin',
  partnerships_lead: 'Partnerships Lead',
  supplier_partnerships_associate: 'Supplier Partnerships',
  employer_partnerships_associate: 'Employer Partnerships',
  placement_lead: 'Placement Lead',
  candidate_supplier_rm: 'Candidate & Supplier RM',
  employer_requirements_rm: 'Employer Requirements RM',
  academic_lead: 'Academic Lead',
  mentor: 'Clinical & Language Mentor',
};

export const InternalShell: React.FC<InternalShellProps> = ({
  tabs,
  activeTab,
  onTabChange,
  children,
}) => {
  const { profile } = useAuth();

  const roleTitle =
    (profile?.internal_role && ROLE_DISPLAY_NAMES[profile.internal_role]) ||
    'Internal Staff';

  const navItems: NavItemConfig[] = (tabs || []).map((tab) => ({
    id: tab.id,
    label: tab.label,
    icon: tab.icon || LayoutGrid,
    badge: tab.count,
    section: tab.section,
    isDividerBefore: tab.isDividerBefore,
  }));

  const currentTab = activeTab || (tabs?.[0]?.id ?? '');

  return (
    <DashboardLayout
      navItems={navItems}
      activeTab={currentTab}
      onTabChange={onTabChange || (() => {})}
      roleBadge={roleTitle}
      isInternal={true}
    >
      <div className="max-w-7xl mx-auto w-full min-w-0 space-y-6">
        {children}
      </div>
    </DashboardLayout>
  );
};

export default InternalShell;
