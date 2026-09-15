import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Home,
  Users,
  Activity,
  List,
  CheckCircle2,
  CreditCard,
  Building2,
} from 'lucide-react';
import { DashboardLayout, NavItemConfig } from '../components/layout/DashboardLayout';
import { SupplierHomeTab } from './supplier/SupplierHomeTab';
import { SupplierProfileTab } from './supplier/SupplierProfileTab';
import { SupplierPostTalentTab } from './supplier/SupplierPostTalentTab';
import { SupplierTrackTalentTab } from './supplier/SupplierTrackTalentTab';
import { SupplierPlacementsTab } from './supplier/SupplierPlacementsTab';
import { SupplierJobPoolTab } from './supplier/SupplierJobPoolTab';
import { SupplierOfferingsTab } from './supplier/SupplierOfferingsTab';

type SupplierTabType =
  | 'home'
  | 'profile'
  | 'post_talent'
  | 'track_talent'
  | 'placements'
  | 'job_pool'
  | 'offerings';

const SUPPLIER_NAV_ITEMS: NavItemConfig[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'post_talent', label: 'Candidates', icon: Users },
  { id: 'track_talent', label: 'Active Pipeline', icon: Activity },
  { id: 'job_pool', label: 'Open Requirements', icon: List },
  { id: 'placements', label: 'Placements', icon: CheckCircle2 },
  { id: 'offerings', label: 'Subscription', icon: CreditCard },
  { id: 'profile', label: 'Company Profile', icon: Building2, isDividerBefore: true },
];

export const SupplierDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as SupplierTabType;
  const [currentTab, setCurrentTab] = useState<SupplierTabType>(
    tabParam && SUPPLIER_NAV_ITEMS.some((i) => i.id === tabParam) ? tabParam : 'home'
  );
  const [supplier, setSupplier] = useState<any>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'member'>('admin');
  const [loading, setLoading] = useState(true);
  const [preSelectedCandidate, setPreSelectedCandidate] = useState<any>(null);

  useEffect(() => {
    const tab = searchParams.get('tab') as SupplierTabType;
    if (tab && SUPPLIER_NAV_ITEMS.some((i) => i.id === tab) && tab !== currentTab) {
      setCurrentTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setCurrentTab(tabId as SupplierTabType);
    setSearchParams({ tab: tabId });
  };

  const fetchSupplier = async () => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      
      // 1. Try resolving supplier ID via helper RPC
      let resolvedSupplierId: string | null = null;
      const { data: rpcSupplierId } = await supabase.rpc('get_my_supplier_id');
      if (rpcSupplierId) {
        resolvedSupplierId = rpcSupplierId;
      }

      let data: any = null;
      if (resolvedSupplierId) {
        const { data: supData, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', resolvedSupplierId)
          .maybeSingle();
        if (!error && supData) {
          data = supData;
        }
      }

      // 2. Direct fallback lookup by user_id or is_admin_profile_id
      if (!data) {
        const { data: directData } = await supabase
          .from('suppliers')
          .select('*')
          .or(`user_id.eq.${profile.id},is_admin_profile_id.eq.${profile.id}`)
          .maybeSingle();
        data = directData;
      }

      // Edge case fallback: if user registered with role supplier but suppliers row not present
      if (!data && profile.role === 'supplier') {
        const { data: newSupp, error: createErr } = await supabase
          .from('suppliers')
          .insert({
            user_id: profile.id,
            is_admin_profile_id: profile.id,
            company_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email?.split('@')[0] || 'Supplier Partner',
            company_type: 'placement_agency',
            tier: 'basic',
          })
          .select()
          .single();

        if (!createErr) {
          data = newSupp;
        }
      }

      // 3. Determine current user's team role
      let userRole: 'admin' | 'member' = 'admin';
      if (data?.id) {
        const { data: member } = await supabase
          .from('supplier_team_members')
          .select('role')
          .eq('supplier_id', data.id)
          .or(`profile_id.eq.${profile.id},email.eq.${profile.email}`)
          .maybeSingle();

        if (member?.role) {
          userRole = member.role === 'admin' ? 'admin' : 'member';
        } else if (data.user_id === profile.id || data.is_admin_profile_id === profile.id) {
          userRole = 'admin';
        } else {
          userRole = 'member';
        }
      }

      setSupplier(data);
      setCurrentUserRole(userRole);
    } catch (err) {
      console.error('Unexpected error loading supplier:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupplier();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
        <span className="text-xs text-[#94A3B8] mt-3 font-medium">
          Loading Supplier Dashboard...
        </span>
      </div>
    );
  }

  return (
    <DashboardLayout
      navItems={SUPPLIER_NAV_ITEMS}
      activeTab={currentTab}
      onTabChange={handleTabChange}
    >
      <div className="max-w-7xl mx-auto w-full min-w-0 space-y-6">
        {currentTab === 'home' && (
          <SupplierHomeTab
            supplier={supplier}
            onNavigateTab={handleTabChange}
          />
        )}

        {currentTab === 'profile' && (
          <SupplierProfileTab
            supplier={supplier}
            currentUserRole={currentUserRole}
            onRefresh={fetchSupplier}
          />
        )}

        {currentTab === 'post_talent' && (
          <SupplierPostTalentTab supplier={supplier} />
        )}

        {currentTab === 'track_talent' && (
          <SupplierTrackTalentTab
            supplier={supplier}
            onNavigateTab={handleTabChange}
          />
        )}

        {currentTab === 'placements' && (
          <SupplierPlacementsTab supplier={supplier} />
        )}

        {currentTab === 'job_pool' && (
          <SupplierJobPoolTab
            supplier={supplier}
            preSelectedCandidate={preSelectedCandidate}
            onClearPreSelectedCandidate={() => setPreSelectedCandidate(null)}
          />
        )}

        {currentTab === 'offerings' && (
          <SupplierOfferingsTab supplier={supplier} />
        )}
      </div>
    </DashboardLayout>
  );
};
