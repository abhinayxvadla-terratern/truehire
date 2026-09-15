import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Building2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Check,
  ShieldAlert,
  Bell,
  FileCheck,
  UserCheck,
} from 'lucide-react';
import { notifyByRole } from '../../../../utils/notificationRouting';

interface SupplierItem {
  id: string;
  company_name: string;
  tier: string;
  created_at: string;
  compliance_declared: boolean;
  no_fee_policy_confirmed: boolean;
  has_rm: boolean;
  rm_name?: string;
}

interface ActionQueueItem {
  supplierId: string;
  companyName: string;
  issue: 'rm' | 'compliance_docs';
  label: string;
  pendingDocsCount?: number;
}

interface AssociateOverviewTabProps {
  onNavigateTab: (tabId: string) => void;
  onSelectSupplierForDetail?: (supplierId: string) => void;
}

export const AssociateOverviewTab: React.FC<AssociateOverviewTabProps> = ({
  onNavigateTab,
  onSelectSupplierForDetail: _onSelectSupplierForDetail,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Metrics
  const [mySuppliersCount, setMySuppliersCount] = useState(0);
  const [complianceDocsPendingCount, setComplianceDocsPendingCount] = useState(0);
  const [rmAssignedCount, setRmAssignedCount] = useState(0);
  const [rmPendingCount, setRmPendingCount] = useState(0);

  const [actionQueue, setActionQueue] = useState<ActionQueueItem[]>([]);
  const [recentlyOnboarded, setRecentlyOnboarded] = useState<SupplierItem[]>([]);

  // Notifications state (locks for 24h)
  const [notifiedSuppliers, setNotifiedSuppliers] = useState<Set<string>>(new Set());
  const [notifyingSupplierId, setNotifyingSupplierId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const isNotifiedRecent = (supplierId: string) => {
    if (notifiedSuppliers.has(supplierId)) return true;
    try {
      const stored = localStorage.getItem(`rm_notified_sup_${supplierId}`);
      if (!stored) return false;
      const timeDiff = Date.now() - parseInt(stored, 10);
      return timeDiff < 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  };

  const fetchAssociateOverview = async () => {
    if (!user) return;
    try {
      // 1. Fetch suppliers created by this associate
      const { data: mySups, error } = await supabase
        .from('suppliers')
        .select('id, company_name, tier, compliance_declared, no_fee_policy_confirmed, created_at')
        .eq('created_by_internal', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const supList = mySups || [];
      setMySuppliersCount(supList.length);
      const supIds = supList.map((s) => s.id);

      // 2. Fetch active RM assignments for these suppliers
      const rmMap: Record<string, string> = {};
      if (supIds.length > 0) {
        const { data: rmData } = await supabase
          .from('rm_assignments')
          .select(`
            entity_id,
            profiles:rm_profile_id(first_name, last_name, email)
          `)
          .eq('entity_type', 'supplier')
          .eq('active', true)
          .in('entity_id', supIds);

        (rmData || []).forEach((r: any) => {
          const name = r.profiles
            ? `${r.profiles.first_name || ''} ${r.profiles.last_name || ''}`.trim() || r.profiles.email
            : 'Assigned RM';
          rmMap[r.entity_id] = name;
        });
      }

      // 3. Fetch pending compliance documents for my suppliers
      const pendingDocsMap: Record<string, number> = {};
      let totalPendingDocs = 0;
      if (supIds.length > 0) {
        const { data: docs } = await supabase
          .from('supplier_documents')
          .select('supplier_id, verification_status')
          .in('supplier_id', supIds)
          .in('verification_status', ['pending', 'pending_review']);

        (docs || []).forEach((d) => {
          if (d.supplier_id) {
            pendingDocsMap[d.supplier_id] = (pendingDocsMap[d.supplier_id] || 0) + 1;
            totalPendingDocs++;
          }
        });
      }
      setComplianceDocsPendingCount(totalPendingDocs);

      // 4. Calculate metrics & build Action Queue
      let assigned = 0;
      let pendingRm = 0;
      const queue: ActionQueueItem[] = [];

      const enrichedSups: SupplierItem[] = supList.map((s) => {
        const hasRm = Boolean(rmMap[s.id]);
        if (hasRm) {
          assigned++;
        } else {
          pendingRm++;
          queue.push({
            supplierId: s.id,
            companyName: s.company_name,
            issue: 'rm',
            label: `${s.company_name} — Account manager not yet assigned`,
          });
        }

        const pendingCount = pendingDocsMap[s.id] || 0;
        if (pendingCount > 0) {
          queue.push({
            supplierId: s.id,
            companyName: s.company_name,
            issue: 'compliance_docs',
            label: `${s.company_name} — ${pendingCount} compliance document${pendingCount > 1 ? 's' : ''} uploaded, awaiting review`,
            pendingDocsCount: pendingCount,
          });
        }

        return {
          id: s.id,
          company_name: s.company_name,
          tier: s.tier,
          created_at: s.created_at,
          compliance_declared: s.compliance_declared,
          no_fee_policy_confirmed: s.no_fee_policy_confirmed,
          has_rm: hasRm,
          rm_name: rmMap[s.id],
        };
      });

      setRmAssignedCount(assigned);
      setRmPendingCount(pendingRm);
      setActionQueue(queue);
      setRecentlyOnboarded(enrichedSups.slice(0, 5));
    } catch (err) {
      console.error('Error loading associate overview:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAssociateOverview();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAssociateOverview();
  };

  const handleNotifyPlacementTeam = async (supplierId: string, companyName: string) => {
    if (!user || notifyingSupplierId) return;
    setNotifyingSupplierId(supplierId);

    try {
      // Get associate display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, email')
        .eq('id', user.id)
        .single();

      const associateName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
        : 'Associate';

      await notifyByRole(
        supabase,
        'placement_lead',
        'RM Assignment Needed',
        `${companyName} (onboarded by ${associateName}) does not have an account manager assigned. Review and assign.`,
        'rm_assignment_request',
        user.id
      );

      // Lock for 24h
      try {
        localStorage.setItem(`rm_notified_sup_${supplierId}`, Date.now().toString());
      } catch {}

      setNotifiedSuppliers((prev) => new Set(prev).add(supplierId));
      showToast('Placement team has been notified.');
    } catch (err) {
      console.error('Error dispatching notification to placement lead:', err);
      alert('Failed to send notification to placement team.');
    } finally {
      setNotifyingSupplierId(null);
    }
  };

  const statCards = [
    {
      title: 'My Suppliers',
      count: mySuppliersCount,
      icon: Building2,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tab: 'my_suppliers',
    },
    {
      title: 'Compliance Docs Pending',
      count: complianceDocsPendingCount,
      icon: FileCheck,
      color: complianceDocsPendingCount > 0 ? 'text-amber-600' : 'text-slate-500',
      bg: complianceDocsPendingCount > 0 ? 'bg-amber-50' : 'bg-slate-50',
      tab: 'my_suppliers',
    },
    {
      title: 'RM Assigned',
      count: rmAssignedCount,
      icon: UserCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tab: 'my_suppliers',
    },
    {
      title: 'RM Pending',
      count: rmPendingCount,
      icon: AlertTriangle,
      color: rmPendingCount > 0 ? 'text-rose-600' : 'text-slate-500',
      bg: rmPendingCount > 0 ? 'bg-rose-50' : 'bg-slate-50',
      tab: 'my_suppliers',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[6px] shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Subheader & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
        <div>
          <p className="text-sm text-slate-500">
            Manage your regional sourcing agency relationships, compliance tracking, and RM handoffs.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[8px] hover:bg-slate-50 hover:text-[#1B3270] transition-colors shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* STATS ROW (4 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[104px] bg-white border border-[#E2E8F4] rounded-[12px] animate-pulse p-5"
            />
          ))
        ) : (
          statCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div
                key={idx}
                onClick={() => onNavigateTab(card.tab)}
                className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs hover:border-[#1B3270]/30 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">
                    {card.title}
                  </span>
                  <div className={`p-1.5 rounded-md ${card.bg} ${card.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-[#1B3270]">
                    {card.count.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-[#94A3B8] group-hover:text-[#2952A3] flex items-center font-medium">
                    View
                    <ArrowRight className="w-3 h-3 ml-0.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ACTION QUEUE CARD */}
      <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-[#1B3270]" />
            <h2 className="text-base font-bold text-slate-800">Action Queue</h2>
          </div>
          <span
            className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
              actionQueue.length > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {actionQueue.length > 0
              ? `${actionQueue.length} Pending Items`
              : 'All Clear'}
          </span>
        </div>

        {actionQueue.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">
              All clear — your onboarded suppliers have designated RMs and up-to-date compliance records.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F4]">
            {actionQueue.map((item, idx) => {
              const alreadyNotified = isNotifiedRecent(item.supplierId);
              const isBusy = notifyingSupplierId === item.supplierId;

              return (
                <div
                  key={`${item.supplierId}-${item.issue}-${idx}`}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        item.issue === 'rm' ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                      <p className="text-[11px] text-slate-400">
                        {item.issue === 'rm'
                          ? 'Agency requires Relationship Manager assignment by Placement Lead.'
                          : 'Informational: Document verification is performed by the assigned Account Manager.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    {item.issue === 'rm' ? (
                      <button
                        type="button"
                        onClick={() => handleNotifyPlacementTeam(item.supplierId, item.companyName)}
                        disabled={alreadyNotified || isBusy}
                        className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] font-semibold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 shrink-0"
                      >
                        {isBusy ? (
                          <span>Notifying...</span>
                        ) : alreadyNotified ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-300" />
                            <span>Placement team notified</span>
                          </>
                        ) : (
                          <>
                            <Bell className="w-3.5 h-3.5" />
                            <span>Notify Placement Team</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-200">
                        Under RM Review
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RECENTLY ONBOARDED SUPPLIERS */}
      <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
          <h2 className="text-base font-bold text-slate-800">
            Recently Onboarded Agencies
          </h2>
          <button
            onClick={() => onNavigateTab('my_suppliers')}
            className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center space-x-1 cursor-pointer"
          >
            <span>View All Suppliers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {recentlyOnboarded.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No suppliers onboarded yet. Use the Onboard Supplier tab to issue invitations.
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F4]">
            {recentlyOnboarded.map((s) => (
              <div
                key={s.id}
                className="py-3 flex items-center justify-between hover:bg-[#F8FAFD] transition-colors rounded px-2 text-xs"
              >
                <div>
                  <span className="font-semibold text-slate-900 block">
                    {s.company_name}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Onboarded on {new Date(s.created_at).toLocaleDateString('en-GB')}
                  </span>
                </div>
                <div className="flex items-center space-x-4">
                  <div>
                    {s.has_rm ? (
                      <span className="text-emerald-700 font-medium text-[11px] flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                        {s.rm_name}
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium text-[11px] flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
                        Awaiting RM
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('my_suppliers')}
                    className="text-[#1B3270] hover:underline font-semibold text-xs cursor-pointer"
                  >
                    Details →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AssociateOverviewTab;
