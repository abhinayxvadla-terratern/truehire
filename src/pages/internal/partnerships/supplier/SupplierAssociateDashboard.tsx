import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { InternalShell, InternalTabItem } from '../../../../components/internal/InternalShell';
import { AssociateOverviewTab } from './AssociateOverviewTab';
import { AssociateSuppliersTab } from './AssociateSuppliersTab';
import { OnboardSupplierTab } from './OnboardSupplierTab';

import { LayoutGrid, Briefcase, PlusCircle } from 'lucide-react';

const TABS: InternalTabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'my_suppliers', label: 'My Suppliers', icon: Briefcase },
  { id: 'onboard', label: 'Onboard Supplier', icon: PlusCircle },
];

export const SupplierAssociateDashboard: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState<string>(currentTab);
  const [targetSupplierId, setTargetSupplierId] = useState<string | null>(null);

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
          <AssociateOverviewTab
            onNavigateTab={handleTabChange}
            onSelectSupplierForDetail={(supId) => setTargetSupplierId(supId)}
          />
        );
      case 'my_suppliers':
        return <AssociateSuppliersTab initialSelectedSupplierId={targetSupplierId} />;
      case 'onboard':
        return <OnboardSupplierTab />;
      default:
        return (
          <AssociateOverviewTab
            onNavigateTab={handleTabChange}
            onSelectSupplierForDetail={(supId) => setTargetSupplierId(supId)}
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

export default SupplierAssociateDashboard;
