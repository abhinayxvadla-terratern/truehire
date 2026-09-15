import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  Award,
  Search,
  CheckCircle,
  AlertTriangle,
  Eye,
  Check,
  X,
  Send,
  Loader2,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { getGateLabel, getReviewStatusLabel } from '../../../utils/labels';
import { MultiSelectFilter } from '../../../components/ui/MultiSelectFilter';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

interface GateResultRow {
  id: string;
  candidate_id: string;
  gate_type: string;
  status: string;
  score: number | null;
  review_status: string;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  candidate_name: string;
  recorded_by_name: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reviewer_name?: string;
}

export const GateManagementTab: React.FC = () => {
  const { user } = useAuth();
  const [gates, setGates] = useState<GateResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [gateTypeFilter, setGateTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState('all');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkApproving, setBulkApproving] = useState(false);

  // Modal State
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [freshGate, setFreshGate] = useState<any | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [isOverriding, setIsOverriding] = useState(false);
  const [queryMessage, setQueryMessage] = useState('');
  const [isQuerying, setIsQuerying] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Delete State
  const [deletingGate, setDeletingGate] = useState<GateResultRow | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchGates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gate_results')
        .select(`
          id,
          candidate_id,
          gate_type,
          status,
          score,
          review_status,
          notes,
          recorded_by,
          reviewed_by,
          reviewed_at,
          created_at,
          candidates(first_name, last_name),
          recorder:recorded_by(first_name, last_name, email),
          reviewer:reviewed_by(first_name, last_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const rows: GateResultRow[] = (data || []).map((g: any) => {
        const recorder = g.recorder;
        const reviewer = g.reviewer;
        const recName = recorder
          ? `${recorder.first_name || ''} ${recorder.last_name || ''}`.trim() || recorder.email
          : 'System';
        const revName = reviewer
          ? `${reviewer.first_name || ''} ${reviewer.last_name || ''}`.trim() || reviewer.email
          : 'TerraTern Admin';

        return {
          id: g.id,
          candidate_id: g.candidate_id,
          gate_type: g.gate_type,
          status: g.status,
          score: g.score,
          review_status: g.review_status || 'not_required',
          notes: g.notes,
          recorded_by: g.recorded_by,
          reviewed_by: g.reviewed_by,
          reviewed_at: g.reviewed_at,
          created_at: g.created_at,
          candidate_name: g.candidates
            ? `${g.candidates.first_name || ''} ${g.candidates.last_name || ''}`.trim() || 'Candidate'
            : 'Candidate',
          recorded_by_name: recName,
          reviewer_name: revName,
        };
      });

      setGates(rows);
    } catch (err) {
      console.error('Error fetching gate results:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGates();
  }, []);

  // Filtered dataset
  const filteredGates = useMemo(() => {
    const now = new Date().getTime();

    return gates.filter((g) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      if (
        q &&
        !g.candidate_name.toLowerCase().includes(q) &&
        !g.gate_type.toLowerCase().includes(q) &&
        !g.recorded_by_name.toLowerCase().includes(q)
      ) {
        return false;
      }

      // Gate type (multi-select)
      if (gateTypeFilter.length > 0 && !gateTypeFilter.includes(g.gate_type)) {
        return false;
      }

      // Status (multi-select)
      if (statusFilter.length > 0 && !statusFilter.includes(g.status)) {
        return false;
      }

      // Review status (multi-select)
      if (reviewStatusFilter.length > 0 && !reviewStatusFilter.includes(g.review_status)) {
        return false;
      }

      // Date
      if (dateFilter === '7d') {
        const itemDate = new Date(g.created_at).getTime();
        if (now - itemDate > 7 * 24 * 60 * 60 * 1000) return false;
      } else if (dateFilter === '30d') {
        const itemDate = new Date(g.created_at).getTime();
        if (now - itemDate > 30 * 24 * 60 * 60 * 1000) return false;
      }

      return true;
    });
  }, [gates, searchQuery, gateTypeFilter, statusFilter, reviewStatusFilter, dateFilter]);

  // Handle select all pending
  const pendingFilteredIds = useMemo(() => {
    return filteredGates.filter((g) => g.review_status === 'pending').map((g) => g.id);
  }, [filteredGates]);

  const handleSelectAllPending = () => {
    if (selectedIds.length === pendingFilteredIds.length && pendingFilteredIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingFilteredIds);
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open modal with fresh fetch (Bug fix: stale state prevention)
  const handleOpenReviewModal = async (gate: GateResultRow) => {
    setSelectedGateId(gate.id);
    setModalLoading(true);
    setIsOverriding(false);
    setIsQuerying(false);
    setQueryMessage('');

    try {
      const { data, error } = await supabase
        .from('gate_results')
        .select(`
          id,
          candidate_id,
          gate_type,
          status,
          score,
          review_status,
          notes,
          recorded_by,
          reviewed_by,
          reviewed_at,
          created_at,
          candidates(id, first_name, last_name, supplier_id, user_id),
          recorder:recorded_by(first_name, last_name, email),
          reviewer:reviewed_by(first_name, last_name, email)
        `)
        .eq('id', gate.id)
        .single();

      if (error) throw error;

      const cand = (data as any).candidates;
      const rec = (data as any).recorder;
      const rev = (data as any).reviewer;

      setFreshGate({
        ...data,
        candidate_name: cand ? `${cand.first_name || ''} ${cand.last_name || ''}`.trim() || 'Candidate' : 'Candidate',
        candidate_user_id: cand?.user_id,
        supplier_id: cand?.supplier_id,
        recorded_by_name: rec ? `${rec.first_name || ''} ${rec.last_name || ''}`.trim() || rec.email : 'System',
        reviewer_name: rev ? `${rev.first_name || ''} ${rev.last_name || ''}`.trim() || rev.email : 'TerraTern Admin',
      });
    } catch (err: any) {
      console.error('Error fetching fresh gate result:', err);
      alert('Failed to load fresh gate result.');
      setSelectedGateId(null);
    } finally {
      setModalLoading(false);
    }
  };

  // Helper: Dispatch notifications on approval
  const dispatchApprovalNotifications = async (gateItem: any) => {
    try {
      const gType = gateItem.gate_type;
      const isPass = gateItem.status === 'pass';
      const cName = gateItem.candidate_name || 'Candidate';
      const candUserId = gateItem.candidate_user_id || gateItem.candidates?.user_id;
      const gLabel = getGateLabel(gType);

      // 1. Candidate notification
      if (candUserId) {
        let msg = `Your ${gLabel} result has been confirmed as ${gateItem.status.toUpperCase()}.`;
        if (gType === 'assessment' && isPass) {
          msg = 'Congratulations! You have completed your Final Assessment and are now Interview Ready.';
        }
        await supabase.from('notifications').insert({
          user_id: candUserId,
          type: 'gate_result',
          title: `Gate Result: ${gLabel}`,
          message: msg,
          read: false,
        });
      }

      // 2. Assigned Candidate RM
      const { data: rmAss } = await supabase
        .from('rm_assignments')
        .select('rm_profile_id')
        .eq('entity_type', 'candidate')
        .eq('entity_id', gateItem.candidate_id)
        .eq('active', true)
        .maybeSingle();

      if (rmAss?.rm_profile_id) {
        let rmMsg = `${cName} achieved ${gateItem.status.toUpperCase()} in ${gLabel}.`;
        if (gType === 'assessment' && isPass) {
          rmMsg = `${cName} has passed the Final Assessment and is now marked Interview Ready.`;
        }
        await supabase.from('notifications').insert({
          user_id: rmAss.rm_profile_id,
          type: 'gate_result',
          title: `Candidate Gate Outcome: ${cName}`,
          message: rmMsg,
          read: false,
        });
      }

      // 3. Mentor / Assessor who recorded it (for speaking_test)
      if (gType === 'speaking_test' && gateItem.recorded_by) {
        await supabase.from('notifications').insert({
          user_id: gateItem.recorded_by,
          type: 'gate_result',
          title: `Speaking Test Approved: ${cName}`,
          message: `Super Admin confirmed and approved your speaking evaluation for ${cName}.`,
          read: false,
        });
      }

      // 4. Supplier notification (if exists and assessment pass)
      if (gType === 'assessment' && isPass && gateItem.supplier_id) {
        const { data: sMembers } = await supabase
          .from('supplier_team_members')
          .select('profile_id')
          .eq('supplier_id', gateItem.supplier_id);

        if (sMembers && sMembers.length > 0) {
          const sNotifs = sMembers
            .filter((sm: any) => sm.profile_id)
            .map((sm: any) => ({
              user_id: sm.profile_id,
              type: 'gate_result',
              title: 'Candidate Achieved Interview Ready',
              message: 'A candidate from your pool has successfully passed the final assessment and is now interview ready.',
              read: false,
            }));
          if (sNotifs.length > 0) {
            await supabase.from('notifications').insert(sNotifs);
          }
        }
      }
    } catch (nErr) {
      console.error('Error dispatching approval notifications:', nErr);
    }
  };

  // Bulk Approve
  const handleBulkApprove = async () => {
    if (selectedIds.length === 0 || !user) return;
    setBulkApproving(true);

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('gate_results')
        .update({
          review_status: 'approved',
          reviewed_by: user.id,
          reviewed_at: nowIso,
        })
        .in('id', selectedIds);

      if (error) throw error;

      // Dispatch notifications for each approved result
      const approvedGates = gates.filter((g) => selectedIds.includes(g.id));
      for (const g of approvedGates) {
        await dispatchApprovalNotifications(g);
      }

      // Re-fetch all rows to ensure badge states and table data are completely fresh
      await fetchGates();
      setSelectedIds([]);
      showToast(`${selectedIds.length} results approved. Candidates and RMs have been notified.`);
    } catch (err: any) {
      alert(`Failed to bulk approve: ${err.message}`);
    } finally {
      setBulkApproving(false);
    }
  };

  // Single Approve Modal (Optimistic UI)
  const handleApproveSingle = async () => {
    if (!freshGate || !user || modalSubmitting) return;
    setModalSubmitting(true);

    const prevReviewStatus = freshGate.review_status;

    // Optimistic UI update in table
    setGates((prev) =>
      prev.map((g) =>
        g.id === freshGate.id
          ? {
              ...g,
              review_status: 'approved',
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString(),
              reviewer_name: 'TerraTern Admin',
            }
          : g
      )
    );

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('gate_results')
        .update({
          review_status: 'approved',
          reviewed_by: user.id,
          reviewed_at: nowIso,
        })
        .eq('id', freshGate.id);

      if (error) throw error;

      // Dispatch notifications
      await dispatchApprovalNotifications(freshGate);

      showToast(`Gate result approved for ${freshGate.candidate_name}`);
      setSelectedGateId(null);
      setFreshGate(null);
      setIsOverriding(false);
    } catch (err: any) {
      // Revert optimistic update
      setGates((prev) =>
        prev.map((g) => (g.id === freshGate.id ? { ...g, review_status: prevReviewStatus } : g))
      );
      alert(`Approval error: ${err.message}`);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Single Query Modal
  const handleQuerySingle = async () => {
    if (!freshGate || !user || modalSubmitting) return;
    if (!queryMessage.trim()) {
      alert('Enter a query explaining why this evaluation is queried.');
      return;
    }

    setModalSubmitting(true);
    try {
      const updatedNotes = freshGate.notes
        ? `${freshGate.notes}\n[Super Admin Query]: ${queryMessage.trim()}`
        : `[Super Admin Query]: ${queryMessage.trim()}`;

      const { error: updateErr } = await supabase
        .from('gate_results')
        .update({
          review_status: 'queried',
          notes: updatedNotes,
        })
        .eq('id', freshGate.id);

      if (updateErr) throw updateErr;

      // Dispatch notification to recorded_by assessor
      if (freshGate.recorded_by) {
        await supabase.from('notifications').insert({
          user_id: freshGate.recorded_by,
          type: 'gate_result',
          title: `Gate Evaluation Queried: ${getGateLabel(freshGate.gate_type)}`,
          message: `Super Admin queried your gate assessment for ${freshGate.candidate_name}: "${queryMessage.trim()}"`,
          read: false,
        });
      }

      setGates((prev) =>
        prev.map((g) =>
          g.id === freshGate.id
            ? {
                ...g,
                review_status: 'queried',
                notes: updatedNotes,
              }
            : g
        )
      );

      showToast(`Clarification requested for ${freshGate.candidate_name}`);
      setSelectedGateId(null);
      setFreshGate(null);
      setQueryMessage('');
      setIsQuerying(false);
    } catch (err: any) {
      alert(`Query dispatch error: ${err.message}`);
    } finally {
      setModalSubmitting(false);
    }
  };

  // Delete Gate Result (Tier 2)
  const handleDeleteGate = async () => {
    if (!deletingGate || !user || deletingInProgress) return;
    setDeletingInProgress(true);

    try {
      const { error } = await supabase
        .from('gate_results')
        .delete()
        .eq('id', deletingGate.id);

      if (error) throw error;

      showToast('Gate result deleted.');
      setDeletingGate(null);
      await fetchGates();
    } catch (err: any) {
      console.error('Error deleting gate result:', err);
      alert(err.message || 'Failed to delete gate result.');
    } finally {
      setDeletingInProgress(false);
    }
  };

  const getReviewStatusBadge = (st: string) => {
    switch (st.toLowerCase()) {
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'queried':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'not_required':
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  // Distinct gate types for multi-select options
  const gateTypeOptions = useMemo(() => {
    const set = new Set<string>();
    gates.forEach((g) => set.add(g.gate_type));
    return Array.from(set).map((t) => ({
      value: t,
      label: getGateLabel(t),
    }));
  }, [gates]);

  const reviewStatusOptions = [
    { value: 'pending', label: 'Pending Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'queried', label: 'Queried' },
    { value: 'not_required', label: 'Not Required' },
  ];

  const outcomeOptions = [
    { value: 'pass', label: 'Pass' },
    { value: 'fail', label: 'Fail' },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[6px] shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">Gate Results</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            All qualification gate results across every candidate. Review, approve, or override results recorded by mentors.
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs text-slate-500 bg-white border border-[#E2E8F4] px-3 py-1.5 rounded-[6px] shadow-2xs">
          <Award className="w-3.5 h-3.5 text-[#1B3270]" />
          <span>Pending Review: <strong className="text-amber-700">{pendingFilteredIds.length}</strong></span>
        </div>
      </div>

      {/* FILTERS */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search candidate, gate, or assessor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-[6px] border border-[#E2E8F4] focus:ring-1 focus:ring-[#1B3270] outline-none"
            />
          </div>

          {/* Gate Type (Multi-select) */}
          <MultiSelectFilter
            label="Gate Types"
            options={gateTypeOptions}
            selectedValues={gateTypeFilter}
            onChange={setGateTypeFilter}
          />

          {/* Review Status (Multi-select) */}
          <MultiSelectFilter
            label="Review Statuses"
            options={reviewStatusOptions}
            selectedValues={reviewStatusFilter}
            onChange={setReviewStatusFilter}
          />

          {/* Outcome (Multi-select) */}
          <MultiSelectFilter
            label="Outcomes"
            options={outcomeOptions}
            selectedValues={statusFilter}
            onChange={setStatusFilter}
          />

          {/* Date Filter (Single select sort/date window) */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-[6px] border border-[#E2E8F4] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-700 h-[36px]"
            >
              <option value="all">All Dates</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#E2E8F4] text-xs">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleSelectAllPending}
              disabled={pendingFilteredIds.length === 0}
              className="font-semibold text-[#1B3270] hover:underline disabled:text-slate-400 disabled:no-underline cursor-pointer"
            >
              {selectedIds.length === pendingFilteredIds.length && pendingFilteredIds.length > 0
                ? 'Deselect All Pending'
                : `Select All Pending (${pendingFilteredIds.length})`}
            </button>
            {selectedIds.length > 0 && (
              <span className="text-slate-500">
                · {selectedIds.length} result(s) selected
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={bulkApproving}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-[6px] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {bulkApproving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5" />
              )}
              <span>Approve Selected Results ({selectedIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#1B3270] mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading gate results...</p>
          </div>
        ) : filteredGates.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700">No gate results recorded</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Evaluation scores submitted by language instructors or clinical assessors will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="w-10 py-3 px-4">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Gate Type</th>
                  <th className="py-3 px-4">Outcome</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Review Status</th>
                  <th className="py-3 px-4">Recorded By</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredGates.map((gate) => {
                  const isPending = gate.review_status === 'pending';
                  const isApproved = gate.review_status === 'approved';
                  const isQueried = gate.review_status === 'queried';
                  const isSelected = selectedIds.includes(gate.id);

                  return (
                    <tr
                      key={gate.id}
                      className={`hover:bg-[#F8FAFD] transition-colors ${
                        isSelected ? 'bg-[#F0F4FF]/50' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        {isPending && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(gate.id)}
                            className="rounded text-[#1B3270] focus:ring-0 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {gate.candidate_name}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-[#1B3270]">
                        {getGateLabel(gate.gate_type)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            gate.status === 'pass'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {gate.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {gate.score !== null ? gate.score : '—'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getReviewStatusBadge(
                            gate.review_status
                          )}`}
                        >
                          {getReviewStatusLabel(gate.review_status)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {gate.recorded_by_name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px]">
                        {new Date(gate.created_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenReviewModal(gate)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold text-[#1B3270] bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-[#F0F4FF] hover:border-[#2952A3]/30 transition-colors shadow-2xs cursor-pointer"
                        >
                          {isQueried && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1" />
                          )}
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isApproved ? 'View' : 'Review'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingGate(gate)}
                          className="inline-flex items-center gap-1 h-7 px-2.5 text-xs font-medium text-[#EF4444] hover:bg-red-50 border border-[#EF4444] rounded transition-colors cursor-pointer"
                          title="Delete Gate Result"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-[#EF4444]" />
                          <span>Delete</span>
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

      {/* FRESH REVIEW MODAL */}
      {selectedGateId && (
        <div className="fixed inset-0 z-60 overflow-y-auto flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            {modalLoading || !freshGate ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-[#1B3270] mx-auto mb-2" />
                <p className="text-xs text-slate-500">Fetching latest gate status...</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F4]">
                  <div className="flex items-center space-x-2">
                    <Award className="w-5 h-5 text-[#1B3270]" />
                    <h3 className="font-bold text-base text-slate-900">
                      {freshGate.review_status === 'approved' && !isOverriding
                        ? 'Gate Evaluation Details'
                        : 'Review Gate Evaluation'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGateId(null);
                      setFreshGate(null);
                      setIsOverriding(false);
                    }}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* APPROVED BANNER */}
                {freshGate.review_status === 'approved' && !isOverriding && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-[8px] flex items-center space-x-2 text-xs text-emerald-900 font-medium">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      ✓ Approved by {freshGate.reviewer_name || 'TerraTern Admin'} on{' '}
                      {freshGate.reviewed_at
                        ? new Date(freshGate.reviewed_at).toLocaleDateString('en-GB')
                        : new Date(freshGate.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                )}

                {/* OVERRIDE WARNING BANNER */}
                {isOverriding && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] flex items-center space-x-2 text-xs text-rose-800 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>You are about to override an already-approved result.</span>
                  </div>
                )}

                {/* QUERIED BANNER */}
                {freshGate.review_status === 'queried' && !isOverriding && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-[8px] space-y-1 text-xs text-amber-900">
                    <div className="flex items-center space-x-1.5 font-bold">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Clarification requested by {freshGate.reviewer_name || 'Super Admin'}</span>
                    </div>
                  </div>
                )}

                {/* Assessment Details */}
                <div className="space-y-3 bg-[#F8FAFD] p-4 rounded-[8px] border border-[#E2E8F4] text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Candidate</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {freshGate.candidate_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Gate Milestone</span>
                      <span className="font-bold text-[#1B3270]">
                        {getGateLabel(freshGate.gate_type)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Evaluation Outcome</span>
                      <span
                        className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          freshGate.status === 'pass'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {freshGate.status} (Score: {freshGate.score ?? 'N/A'})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Assessor</span>
                      <span className="font-medium text-slate-700">
                        {freshGate.recorded_by_name}
                      </span>
                    </div>
                  </div>

                  {freshGate.notes && (
                    <div className="pt-2 border-t border-[#E2E8F4]">
                      <span className="text-slate-400 block text-[11px] mb-1">
                        Assessor Observations & Notes
                      </span>
                      <p className="bg-white p-2.5 rounded border border-[#E2E8F4] text-slate-700 whitespace-pre-wrap">
                        {freshGate.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* PRE-APPROVAL NOTIFICATION INFO NOTE */}
                {(freshGate.review_status !== 'approved' || isOverriding) && !isQuerying && (
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-[8px] text-[11px] text-slate-700 space-y-1">
                    <p className="font-bold text-[#1B3270]">Approving will notify:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                      {freshGate.gate_type === 'speaking_test' && (
                        <>
                          <li>Candidate — result notification</li>
                          <li>Assigned Candidate RM — outcome</li>
                          <li>Mentor who recorded it — confirmation</li>
                        </>
                      )}
                      {freshGate.gate_type === 'assessment' && freshGate.status === 'pass' && (
                        <>
                          <li>Candidate — Interview Ready notification</li>
                          <li>Assigned Candidate RM — Interview Ready</li>
                          <li>Supplier (if exists) — anonymized notice</li>
                        </>
                      )}
                      {freshGate.gate_type === 'assessment' && freshGate.status !== 'pass' && (
                        <>
                          <li>Candidate — fail notification</li>
                          <li>Assigned Candidate RM — fail outcome</li>
                        </>
                      )}
                      {freshGate.gate_type === 'dt' && (
                        <>
                          <li>Candidate only</li>
                        </>
                      )}
                      {freshGate.gate_type === 'doc_verification' && (
                        <li>Candidate — verification update</li>
                      )}
                      {freshGate.gate_type === 'bootcamp' && (
                        <li>Candidate — bootcamp status update</li>
                      )}
                      {!['speaking_test', 'assessment', 'dt', 'doc_verification', 'bootcamp'].includes(
                        freshGate.gate_type
                      ) && (
                        <li>Candidate and Assigned RM</li>
                      )}
                    </ul>
                    {freshGate.gate_type === 'dt' && (
                      <p className="text-[10px] text-amber-700 font-semibold pt-1">
                        Note: DT results are auto-scored. This is a manual override.
                      </p>
                    )}
                  </div>
                )}

                {/* MODAL ACTIONS */}
                {freshGate.review_status === 'approved' && !isOverriding ? (
                  /* Approved state: Read only + Override button */
                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedGateId(null);
                        setFreshGate(null);
                      }}
                      className="px-4 py-2 border border-[#E2E8F4] text-slate-600 rounded-[6px] text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsOverriding(true)}
                      className="px-4 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-[6px] shadow-2xs transition-colors cursor-pointer"
                    >
                      Override
                    </button>
                  </div>
                ) : !isQuerying ? (
                  /* Pending / Queried / Overriding State: Approve + Query buttons */
                  <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F4]">
                    <button
                      type="button"
                      onClick={() => setIsQuerying(true)}
                      className="px-4 py-2 border border-rose-200 bg-rose-50 text-rose-700 font-semibold text-xs rounded-[6px] hover:bg-rose-100 transition-colors cursor-pointer flex items-center space-x-1.5"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Request Clarification</span>
                    </button>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGateId(null);
                          setFreshGate(null);
                          setIsOverriding(false);
                        }}
                        className="px-4 py-2 border border-[#E2E8F4] text-slate-600 rounded-[6px] text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleApproveSingle}
                        disabled={modalSubmitting}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                      >
                        {modalSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>{isOverriding ? 'Confirm Override & Approve' : 'Approve Result'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Query Form */
                  <div className="space-y-3 pt-2 border-t border-[#E2E8F4]">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Clarification Query for Assessor *
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Specify the clarification needed regarding the test criteria, score, or evidence..."
                        value={queryMessage}
                        onChange={(e) => setQueryMessage(e.target.value)}
                        className="w-full p-2.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                      />
                      <p className="text-[11px] text-slate-400 mt-1">
                        Submitting this will mark the review status as <strong>queried</strong> and notify {freshGate.recorded_by_name}.
                      </p>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                      <button
                        type="button"
                        onClick={() => setIsQuerying(false)}
                        className="px-3 py-1.5 border border-[#E2E8F4] text-slate-600 rounded-[6px] text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleQuerySingle}
                        disabled={modalSubmitting || !queryMessage.trim()}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-semibold shadow-2xs cursor-pointer disabled:opacity-50 flex items-center space-x-1"
                      >
                        {modalSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>Send Query</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL (Tier 2) */}
      <DeleteConfirmationModal
        isOpen={!!deletingGate}
        onClose={() => setDeletingGate(null)}
        onConfirm={handleDeleteGate}
        tier="tier2"
        entityType="Gate Result"
        entityName={deletingGate ? `${getGateLabel(deletingGate.gate_type)} (${deletingGate.candidate_name})` : ''}
        bodyText="This permanently deletes this gate evaluation record."
        isDeleting={deletingInProgress}
      />
    </div>
  );
};
