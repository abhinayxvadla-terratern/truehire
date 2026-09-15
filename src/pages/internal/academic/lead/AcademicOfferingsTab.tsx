import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Package,
  Plus,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  Loader2,
  Euro,
  UserPlus,
  Search,
  X,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { getGateLabel, getOfferingTypeLabel } from '../../../../utils/labels';

interface OfferingRow {
  id: string;
  name: string;
  description: string | null;
  type: string;
  applicable_gate: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
}

interface CandidateOption {
  id: string;
  first_name: string | null;
  last_name: string | null;
  user_id: string | null;
  target_role: string | null;
}

export const AcademicOfferingsTab: React.FC = () => {
  const { user } = useAuth();
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State - Create
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Language Course');
  const [applicableGate, setApplicableGate] = useState('assessment');
  const [price, setPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Modal State
  const [editingOffering, setEditingOffering] = useState<OfferingRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState('Language Course');
  const [editApplicableGate, setEditApplicableGate] = useState('assessment');
  const [editPrice, setEditPrice] = useState('');
  const [updating, setUpdating] = useState(false);

  // Manually Assign Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>('');
  const [gateTypeFailed, setGateTypeFailed] = useState<'dt' | 'assessment'>('assessment');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [offeringUsageMap, setOfferingUsageMap] = useState<Record<string, number>>({});

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchOfferings = async () => {
    setLoading(true);
    try {
      const [offRes, usageRes] = await Promise.all([
        supabase
          .from('offerings')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('candidate_offerings').select('offering_id'),
      ]);

      if (offRes.error) throw offRes.error;
      setOfferings(offRes.data || []);

      const usage: Record<string, number> = {};
      (usageRes.data || []).forEach((u: any) => {
        if (u.offering_id) {
          usage[u.offering_id] = (usage[u.offering_id] || 0) + 1;
        }
      });
      setOfferingUsageMap(usage);
    } catch (err) {
      console.error('Error fetching offerings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfferings();
  }, []);

  // Fetch candidates when Assign modal opens
  const handleOpenAssignModal = async () => {
    setIsAssignModalOpen(true);
    setAssignError(null);
    setCandidateSearch('');
    setSelectedCandidateIds([]);
    if (offerings.length > 0) {
      const firstActive = offerings.find((o) => o.is_active) || offerings[0];
      setSelectedOfferingId(firstActive.id);
    }

    try {
      const { data } = await supabase
        .from('candidates')
        .select('id, first_name, last_name, user_id, target_role')
        .order('first_name', { ascending: true });

      setCandidates(data || []);
    } catch (err) {
      console.error('Error loading candidates for assignment:', err);
    }
  };

  const handleCreateOffering = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    const cleanDesc = description.trim();
    const numPrice = parseFloat(price);

    if (!cleanName) {
      setFormError('Offering name is required.');
      return;
    }
    if (isNaN(numPrice) || numPrice < 0) {
      setFormError('Enter a valid price in €.');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('offerings')
        .insert({
          name: cleanName,
          description: cleanDesc || null,
          type,
          applicable_gate: applicableGate,
          price: numPrice,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setOfferings((prev) => [data as OfferingRow, ...prev]);
      setName('');
      setDescription('');
      setPrice('');
      showToast(`Offering "${cleanName}" created successfully.`);
    } catch (err: any) {
      setFormError(err.message || 'Failed to create offering.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (offering: OfferingRow) => {
    const newStatus = !offering.is_active;

    try {
      const { error } = await supabase
        .from('offerings')
        .update({ is_active: newStatus })
        .eq('id', offering.id);

      if (error) throw error;

      setOfferings((prev) =>
        prev.map((o) => (o.id === offering.id ? { ...o, is_active: newStatus } : o))
      );
      showToast(
        `Offering "${offering.name}" is now ${newStatus ? 'Active' : 'Inactive'}`
      );
    } catch (err: any) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  const handleStartEdit = (offering: OfferingRow) => {
    setEditingOffering(offering);
    setEditName(offering.name);
    setEditDescription(offering.description || '');
    setEditType(offering.type);
    setEditApplicableGate(offering.applicable_gate || 'assessment');
    setEditPrice(offering.price.toString());
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOffering) return;

    const numPrice = parseFloat(editPrice);
    if (isNaN(numPrice) || numPrice < 0) {
      alert('Enter a valid price');
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('offerings')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          type: editType,
          applicable_gate: editApplicableGate,
          price: numPrice,
        })
        .eq('id', editingOffering.id);

      if (error) throw error;

      setOfferings((prev) =>
        prev.map((o) =>
          o.id === editingOffering.id
            ? {
                ...o,
                name: editName.trim(),
                description: editDescription.trim() || null,
                type: editType,
                applicable_gate: editApplicableGate,
                price: numPrice,
              }
            : o
        )
      );

      showToast('Offering updated successfully.');
      setEditingOffering(null);
    } catch (err: any) {
      alert(`Failed to update: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  // Submit Manual Assignment (Bulk)
  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || selectedCandidateIds.length === 0 || !selectedOfferingId) return;

    setAssigning(true);
    setAssignError(null);

    const chosenOffering = offerings.find((o) => o.id === selectedOfferingId);
    const chosenCandidates = candidates.filter((c) => selectedCandidateIds.includes(c.id));

    try {
      // 1. Bulk INSERT candidate_offerings
      const rowsToInsert = selectedCandidateIds.map((cId) => ({
        candidate_id: cId,
        offering_id: selectedOfferingId,
        gate_type_failed: gateTypeFailed,
        status: 'recommended',
      }));

      const { error: insertErr } = await supabase
        .from('candidate_offerings')
        .insert(rowsToInsert);

      if (insertErr) throw insertErr;

      // 2. INSERT notification for each candidate
      const notifs = chosenCandidates
        .filter((c) => c.user_id)
        .map((c) => ({
          user_id: c.user_id!,
          title: 'Training Offering Recommended',
          message: `A training offering (${
            chosenOffering?.name || 'Academic Course'
          }) has been recommended for you. Check your Academy tab.`,
          type: 'academic',
          sent_by: user.id,
        }));

      if (notifs.length > 0) {
        await supabase.from('notifications').insert(notifs);
      }

      showToast(
        `Assigned "${chosenOffering?.name}" to ${selectedCandidateIds.length} candidate(s).`
      );
      setIsAssignModalOpen(false);
      await fetchOfferings();
    } catch (err: any) {
      console.error('Error assigning offering to candidates:', err);
      setAssignError(err.message || 'Failed to assign offering');
    } finally {
      setAssigning(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    if (candidateSearch.trim()) {
      const q = candidateSearch.toLowerCase();
      const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
      return fullName.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg flex items-center space-x-2 text-xs animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">
            Academy Curriculum & Offerings Catalog
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage educational modules, language preparation packages, and recommend them to candidates
          </p>
        </div>

        <button
          onClick={handleOpenAssignModal}
          className="px-3.5 py-2 text-xs font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] transition-colors shadow-2xs flex items-center"
        >
          <UserPlus className="w-4 h-4 mr-1.5" />
          Assign to Candidate
        </button>
      </div>

      {/* FORM: CREATE NEW OFFERING */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-[#E2E8F4]">
          <Package className="w-4 h-4 text-[#1B3270]" />
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Create New Academy Offering
          </h3>
        </div>

        {formError && (
          <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleCreateOffering} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Offering Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Intensive German B2 for Healthcare"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-700"
              >
                <option value="Language Course">Language Course</option>
                <option value="Clinical Bootcamp">Clinical Bootcamp</option>
                <option value="Exam Preparation">Exam Preparation</option>
                <option value="Documentation Assist">Documentation Assist</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Applicable Gate *
              </label>
              <select
                value={applicableGate}
                onChange={(e) => setApplicableGate(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-700"
              >
                <option value="assessment">Assessment (Remedial)</option>
                <option value="dt">Diagnostic Test (Entry)</option>
                <option value="speaking_test">Speaking Test</option>
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Description
              </label>
              <input
                type="text"
                placeholder="Key learning outcomes, duration, curriculum highlights..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Price (€) *
              </label>
              <div className="relative">
                <Euro className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] font-semibold transition-colors flex items-center space-x-1.5 disabled:opacity-50 text-xs shadow-2xs"
            >
              {creating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Create Offering</span>
            </button>
          </div>
        </form>
      </div>

      {/* OFFERINGS CATALOG LIST */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F4] flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Active Catalog ({offerings.length})
          </h3>
          <span className="text-[11px] text-slate-400">
            Available across academy qualification gates
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1B3270]" />
            Loading catalog...
          </div>
        ) : offerings.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="font-semibold text-slate-600">No offerings registered yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Create educational pathways using the form above.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F4]">
            {offerings.map((item) => (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {item.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {getOfferingTypeLabel(item.type)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-[#1B3270]">
                      Gate: {item.applicable_gate ? getGateLabel(item.applicable_gate) : 'Any'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                      Usage: {offeringUsageMap[item.id] || 0} enrolled
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-slate-500 text-[11px] max-w-xl">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-4 shrink-0">
                  <span className="text-sm font-bold text-slate-800">
                    €{Number(item.price).toFixed(2)}
                  </span>

                  <button
                    onClick={() => handleStartEdit(item)}
                    className="p-1.5 rounded-[5px] text-slate-400 hover:text-[#1B3270] hover:bg-slate-100 transition-colors"
                    title="Edit offering"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleToggleActive(item)}
                    className="flex items-center space-x-1 text-[11px] font-semibold transition-colors"
                  >
                    {item.is_active ? (
                      <span className="text-emerald-700 flex items-center">
                        <ToggleRight className="w-5 h-5 mr-1" />
                        Active
                      </span>
                    ) : (
                      <span className="text-slate-400 flex items-center">
                        <ToggleLeft className="w-5 h-5 mr-1" />
                        Inactive
                      </span>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* EDIT MODAL */}
      {editingOffering && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD]">
              <h3 className="text-sm font-bold text-slate-800">Edit Offering</h3>
              <button
                onClick={() => setEditingOffering(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Applicable Gate
                  </label>
                  <select
                    value={editApplicableGate}
                    onChange={(e) => setEditApplicableGate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  >
                    <option value="assessment">Assessment</option>
                    <option value="dt">Diagnostic Test</option>
                    <option value="speaking_test">Speaking Test</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Price (€)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingOffering(null)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-4 py-1.5 font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] disabled:opacity-50 flex items-center"
                >
                  {updating && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANUALLY ASSIGN MODAL */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD]">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-4 h-4 text-[#1B3270]" />
                <h3 className="text-sm font-bold text-slate-800">
                  Assign to Candidate
                </h3>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssign} className="p-5 space-y-4 text-xs">
              {assignError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{assignError}</span>
                </div>
              )}

              {/* Candidate Search / Bulk Select */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-semibold">
                    Select Candidates for Bulk Assignment *
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = filteredCandidates.map((c) => c.id);
                        setSelectedCandidateIds(allIds);
                      }}
                      className="text-[10px] text-[#1B3270] hover:underline font-semibold"
                    >
                      Select All ({filteredCandidates.length})
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCandidateIds([])}
                      className="text-[10px] text-slate-500 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    placeholder="Search candidate by name..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>

                <div className="border border-[#E2E8F4] rounded-[6px] max-h-44 overflow-y-auto divide-y divide-[#E2E8F4] bg-white">
                  {filteredCandidates.length === 0 ? (
                    <div className="p-3 text-center text-slate-400 text-[11px]">
                      No matching candidates found
                    </div>
                  ) : (
                    filteredCandidates.map((c) => {
                      const isSelected = selectedCandidateIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className={`flex items-center space-x-2.5 p-2 hover:bg-slate-50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/50' : ''
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCandidateIds((prev) => [...prev, c.id]);
                              } else {
                                setSelectedCandidateIds((prev) =>
                                  prev.filter((id) => id !== c.id)
                                );
                              }
                            }}
                            className="rounded border-[#E2E8F4] text-[#1B3270] focus:ring-[#1B3270]"
                          />
                          <div className="text-xs">
                            <span className="font-semibold text-slate-800">
                              {c.first_name} {c.last_name}
                            </span>
                            {c.target_role && (
                              <span className="text-[10px] text-slate-400 ml-1.5">
                                • {c.target_role}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Selected: <strong className="text-[#1B3270]">{selectedCandidateIds.length}</strong> candidate(s)
                </div>
              </div>

              {/* Offering Select */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Select Offering *
                </label>
                <select
                  value={selectedOfferingId}
                  onChange={(e) => setSelectedOfferingId(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                >
                  {offerings
                    .filter((o) => o.is_active)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name} (€{o.price})
                      </option>
                    ))}
                </select>
              </div>

              {/* Gate Type Failed */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Associated Deficit Gate
                </label>
                <select
                  value={gateTypeFailed}
                  onChange={(e) =>
                    setGateTypeFailed(e.target.value as 'dt' | 'assessment')
                  }
                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                >
                  <option value="assessment">Assessment</option>
                  <option value="dt">Diagnostic Test</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    assigning ||
                    selectedCandidateIds.length === 0 ||
                    !selectedOfferingId
                  }
                  className="px-4 py-1.5 font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] shadow-xs disabled:opacity-50 flex items-center cursor-pointer"
                >
                  {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  <span>
                    Assign Offering{' '}
                    {selectedCandidateIds.length > 0
                      ? `(${selectedCandidateIds.length})`
                      : ''}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicOfferingsTab;
