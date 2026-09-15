import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { confirmPlacement } from '../../../utils/placementConfirmation';
import {
  Clock,
  Search,
  CheckCircle2,
  Check,
  X,
  UserCheck,
  FileCheck,
  CreditCard,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';

interface RevealConditions {
  offer_letter?: boolean;
  deposit?: boolean;
  consent?: boolean;
}

interface RevealQueueRow {
  id: string;
  candidate_id: string;
  candidate_name: string;
  job_id: string;
  job_title: string;
  employer_id: string;
  employer_name: string;
  supplier_id?: string | null;
  status: 'offer_sent' | 'reveal_gate' | string;
  days_at_stage: number;
  conditions: RevealConditions;
  rm_name: string;
  updated_at: string;
}

export const RevealQueueTab: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<RevealQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal / Drawer
  const [selectedItem, setSelectedItem] = useState<RevealQueueRow | null>(null);
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [confirmingPlacement, setConfirmingPlacement] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchRevealQueue = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          job_id,
          status,
          updated_at,
          created_at,
          supplier_id,
          reveal_gate_conditions,
          candidates:candidate_id (first_name, last_name),
          job_requirements:job_id (
            title,
            employer_id,
            employers:employer_id (id, company_name)
          )
        `)
        .in('status', ['offer_sent', 'reveal_gate'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Employer RM assignments
      const { data: rmAssignments } = await supabase
        .from('rm_assignments')
        .select(`
          entity_id,
          active,
          profiles:rm_profile_id (first_name, last_name, email)
        `)
        .eq('entity_type', 'employer')
        .eq('active', true);

      const rmMap: Record<string, string> = {};
      if (rmAssignments) {
        rmAssignments.forEach((a: any) => {
          if (a.entity_id && a.profiles) {
            rmMap[a.entity_id] = `${a.profiles.first_name || ''} ${a.profiles.last_name || ''}`.trim() || a.profiles.email;
          }
        });
      }

      const rows: RevealQueueRow[] = (data || []).map((app: any) => {
        const c = app.candidates;
        const cName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Candidate #${app.candidate_id.slice(0, 6)}`
          : `Candidate #${app.candidate_id.slice(0, 6)}`;

        const updatedDate = new Date(app.updated_at || app.created_at || Date.now());
        const daysDiff = Math.max(
          0,
          Math.floor((Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        const empId = app.job_requirements?.employer_id || '';
        const empName = app.job_requirements?.employers?.company_name || 'Hospital Facility';
        const jobTitle = app.job_requirements?.title || 'Healthcare Specialist';

        return {
          id: app.id,
          candidate_id: app.candidate_id,
          candidate_name: cName,
          job_id: app.job_id,
          job_title: jobTitle,
          employer_id: empId,
          employer_name: empName,
          supplier_id: app.supplier_id,
          status: app.status,
          days_at_stage: daysDiff,
          conditions: (app.reveal_gate_conditions as RevealConditions) || {
            offer_letter: false,
            deposit: false,
            consent: false,
          },
          rm_name: rmMap[empId] || 'Unassigned',
          updated_at: app.updated_at,
        };
      });

      setItems(rows);
    } catch (err) {
      console.error('Error fetching reveal queue:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRevealQueue();
  }, []);

  const handleToggleCondition = async (key: 'offer_letter' | 'deposit' | 'consent') => {
    if (!selectedItem || togglingKey) return;
    setTogglingKey(key);
    try {
      const nextConditions = {
        ...selectedItem.conditions,
        [key]: !selectedItem.conditions[key],
      };

      const { error } = await supabase
        .from('job_applications')
        .update({
          reveal_gate_conditions: nextConditions,
          status: 'reveal_gate',
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedItem.id);

      if (error) throw error;

      const updated = { ...selectedItem, conditions: nextConditions };
      setSelectedItem(updated);
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      showToast(`Updated "${key.replace('_', ' ')}" condition.`);
    } catch (err: any) {
      console.error('Error updating condition:', err);
      alert(err.message || 'Failed to update condition.');
    } finally {
      setTogglingKey(null);
    }
  };

  const handleConfirmPlacement = async () => {
    if (!selectedItem || confirmingPlacement || !user) return;
    setConfirmingPlacement(true);
    try {
      await confirmPlacement({
        supabase,
        applicationId: selectedItem.id,
        candidateId: selectedItem.candidate_id,
        jobId: selectedItem.job_id,
        jobTitle: selectedItem.job_title,
        employerId: selectedItem.employer_id,
        supplierId: selectedItem.supplier_id,
        confirmedByUserId: user.id,
      });

      showToast(`Placement confirmed for ${selectedItem.candidate_name}!`);
      setSelectedItem(null);
      fetchRevealQueue();
    } catch (err: any) {
      console.error('Error confirming placement:', err);
      alert(err.message || 'Failed to confirm placement.');
    } finally {
      setConfirmingPlacement(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cand = item.candidate_name.toLowerCase();
      const emp = item.employer_name.toLowerCase();
      const job = item.job_title.toLowerCase();
      if (!cand.includes(q) && !emp.includes(q) && !job.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">Reveal Queue</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage candidate identities moving through post-offer reveal gates, verify condition checklists, and formalize placements.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchRevealQueue();
          }}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate, employer, or position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:outline-none focus:ring-1 focus:ring-[#1B3270] text-slate-800"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-[#E2E8F4] rounded-[6px] px-3 py-2 text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
        >
          <option value="all">All Stages</option>
          <option value="offer_sent">Offer Sent</option>
          <option value="reveal_gate">Reveal Gate Active</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading reveal queue...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No applications in reveal queue</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Candidates who have received an offer or entered the reveal gate will be tracked here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F4] text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Candidate Name</th>
                  <th className="px-4 py-3.5">Job Title</th>
                  <th className="px-4 py-3.5">Employer</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Days at Stage</th>
                  <th className="px-4 py-3.5">Conditions Met</th>
                  <th className="px-4 py-3.5">Assigned RM</th>
                  <th className="px-4 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4]">
                {filteredItems.map((item) => {
                  const conditions = item.conditions || {};
                  const isOffer = Boolean(conditions.offer_letter);
                  const isDep = Boolean(conditions.deposit);
                  const isCons = Boolean(conditions.consent);
                  const metCount = (isOffer ? 1 : 0) + (isDep ? 1 : 0) + (isCons ? 1 : 0);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {item.candidate_name}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">{item.job_title}</td>
                      <td className="px-4 py-3.5 font-semibold text-slate-800">
                        {item.employer_name}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            item.status === 'reveal_gate'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.status === 'reveal_gate' ? 'Reveal Gate' : 'Offer Sent'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-medium text-slate-700">
                          {item.days_at_stage}d
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {item.status === 'reveal_gate' ? (
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 ${
                                isOffer
                                  ? 'bg-[#F0FDF4] text-[#166534]'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              Offer {isOffer && <Check size={11} strokeWidth={2} />}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 ${
                                isDep
                                  ? 'bg-[#F0FDF4] text-[#166534]'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              Deposit {isDep && <Check size={11} strokeWidth={2} />}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium inline-flex items-center gap-1 ${
                                isCons
                                  ? 'bg-[#F0FDF4] text-[#166534]'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              Consent {isCons && <Check size={11} strokeWidth={2} />}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500 ml-1">
                              ({metCount}/3)
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium">{item.rm_name}</td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] hover:bg-slate-100 rounded transition-colors"
                        >
                          <span>View & Manage</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REVEAL DETAIL / MANAGE MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] max-w-lg w-full p-6 shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#E2E8F4]">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-lg font-bold text-[#1B3270]">Reveal Process</h3>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                    {selectedItem.status === 'reveal_gate' ? 'Reveal Gate' : 'Offer Sent'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Candidate: <strong className="text-slate-800">{selectedItem.candidate_name}</strong> • Employer: <strong className="text-slate-800">{selectedItem.employer_name}</strong>
                </p>
                <p className="text-xs text-slate-400">Position: {selectedItem.job_title}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Checklist */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Gate Verification Checklist
              </h4>

              {/* 1. Offer Letter */}
              <div className="p-3.5 bg-slate-50 border border-[#E2E8F4] rounded-[8px] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <FileCheck
                    className={`w-5 h-5 ${
                      selectedItem.conditions.offer_letter ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Formal Offer Letter</p>
                    <p className="text-[11px] text-slate-400">Official hospital contract signed and dispatched</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(togglingKey)}
                  onClick={() => handleToggleCondition('offer_letter')}
                  className={`px-3 py-1 text-xs font-bold rounded-[6px] border transition-colors ${
                    selectedItem.conditions.offer_letter
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {selectedItem.conditions.offer_letter ? 'Verified' : 'Mark Verified'}
                </button>
              </div>

              {/* 2. Placement Deposit */}
              <div className="p-3.5 bg-slate-50 border border-[#E2E8F4] rounded-[8px] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CreditCard
                    className={`w-5 h-5 ${
                      selectedItem.conditions.deposit ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Placement Deposit</p>
                    <p className="text-[11px] text-slate-400">Employer placement retainer payment confirmed</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(togglingKey)}
                  onClick={() => handleToggleCondition('deposit')}
                  className={`px-3 py-1 text-xs font-bold rounded-[6px] border transition-colors ${
                    selectedItem.conditions.deposit
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {selectedItem.conditions.deposit ? 'Verified' : 'Mark Verified'}
                </button>
              </div>

              {/* 3. Candidate Consent */}
              <div className="p-3.5 bg-slate-50 border border-[#E2E8F4] rounded-[8px] flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <UserCheck
                    className={`w-5 h-5 ${
                      selectedItem.conditions.consent ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-slate-800">Candidate Data Consent</p>
                    <p className="text-[11px] text-slate-400">Explicit candidate consent to disclose full credentials</p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(togglingKey)}
                  onClick={() => handleToggleCondition('consent')}
                  className={`px-3 py-1 text-xs font-bold rounded-[6px] border transition-colors ${
                    selectedItem.conditions.consent
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {selectedItem.conditions.consent ? 'Verified' : 'Mark Verified'}
                </button>
              </div>
            </div>

            {/* Bottom Actions */}
            {(() => {
              const allMet =
                Boolean(selectedItem.conditions.offer_letter) &&
                Boolean(selectedItem.conditions.deposit) &&
                Boolean(selectedItem.conditions.consent);

              return (
                <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    {allMet ? (
                      <span className="text-emerald-600 font-semibold flex items-center">
                        <CheckCircle2 className="w-4 h-4 mr-1" /> All conditions met!
                      </span>
                    ) : (
                      'All 3 conditions must be satisfied to confirm placement.'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={handleConfirmPlacement}
                    disabled={!allMet || confirmingPlacement}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-[6px] disabled:opacity-40 flex items-center space-x-1.5 shadow-2xs"
                  >
                    {confirmingPlacement && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm Placement</span>
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
