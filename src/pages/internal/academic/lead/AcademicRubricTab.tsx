import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  FileCheck,
  CheckCircle,
  Plus,
  Loader2,
  RefreshCw,
  X,
  Edit2,
  Power,
  AlertTriangle,
} from 'lucide-react';

interface RubricCriterion {
  id: string;
  criterion_name: string;
  description: string;
  max_score: number;
  order_position: number;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string | null;
  updater_name?: string;
}

export const AcademicRubricTab: React.FC = () => {
  const { user } = useAuth();
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Modal
  const [editingCriterion, setEditingCriterion] = useState<RubricCriterion | null>(null);
  const [editForm, setEditForm] = useState({
    criterion_name: '',
    description: '',
    max_score: 20,
    order_position: 1,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Deactivate modal
  const [targetToggleCriterion, setTargetToggleCriterion] = useState<RubricCriterion | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Add form modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxScore, setNewMaxScore] = useState<number>(20);
  const [newOrderPosition, setNewOrderPosition] = useState<number>(1);
  const [addingCriterion, setAddingCriterion] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchCriteria = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('speaking_test_rubric_criteria')
        .select(`
          id,
          criterion_name,
          description,
          max_score,
          order_position,
          is_active,
          updated_by,
          updated_at
        `)
        .order('order_position', { ascending: true });

      if (error) throw error;

      const cList = data || [];

      // Resolve updater names
      const updaterIds = Array.from(
        new Set(cList.map((c) => c.updated_by).filter((id): id is string => Boolean(id)))
      );

      const nameMap: Record<string, string> = {};
      if (updaterIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', updaterIds);

        (profs || []).forEach((p) => {
          nameMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
        });
      }

      const mapped: RubricCriterion[] = cList.map((c: any) => ({
        id: c.id,
        criterion_name: c.criterion_name,
        description: c.description || '',
        max_score: c.max_score ?? 20,
        order_position: c.order_position ?? 1,
        is_active: c.is_active ?? true,
        updated_by: c.updated_by,
        updated_at: c.updated_at,
        updater_name: c.updated_by ? nameMap[c.updated_by] || 'Academic Staff' : 'System',
      }));

      setCriteria(mapped);
    } catch (err: any) {
      console.error('Error fetching rubric criteria:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCriteria();
  }, []);

  const totalMaxScore = useMemo(() => {
    return criteria
      .filter((c) => c.is_active)
      .reduce((sum, c) => sum + (c.max_score || 0), 0);
  }, [criteria]);

  const handleOpenEdit = (c: RubricCriterion) => {
    setEditingCriterion(c);
    setEditForm({
      criterion_name: c.criterion_name,
      description: c.description,
      max_score: c.max_score,
      order_position: c.order_position,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCriterion || !user) return;

    try {
      setSavingEdit(true);
      const nowIso = new Date().toISOString();

      const previousData = {
        criterion_name: editingCriterion.criterion_name,
        description: editingCriterion.description,
        max_score: editingCriterion.max_score,
        order_position: editingCriterion.order_position,
      };

      const newData = {
        criterion_name: editForm.criterion_name.trim(),
        description: editForm.description.trim(),
        max_score: Number(editForm.max_score) || 20,
        order_position: Number(editForm.order_position) || 1,
      };

      const isWeightChange = previousData.max_score !== newData.max_score;
      const actionType = isWeightChange ? 'weight_changed' : 'updated';

      const { error: updateErr } = await supabase
        .from('speaking_test_rubric_criteria')
        .update({
          ...newData,
          updated_by: user.id,
          updated_at: nowIso,
        })
        .eq('id', editingCriterion.id);

      if (updateErr) throw updateErr;

      await supabase.from('rubric_audit').insert({
        criterion_id: editingCriterion.id,
        action: actionType,
        changed_by: user.id,
        previous_data: previousData,
        new_data: newData,
        change_summary: `Academic Lead ${isWeightChange ? 'changed weight for' : 'updated'} criterion "${newData.criterion_name}"`,
      });

      showToast(`Criterion "${newData.criterion_name}" updated successfully.`);
      setEditingCriterion(null);
      await fetchCriteria();
    } catch (err: any) {
      alert(err.message || 'Failed to update criterion.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async () => {
    if (!targetToggleCriterion || !user || togglingStatus) return;

    try {
      setTogglingStatus(true);
      const nowIso = new Date().toISOString();
      const nextActive = !targetToggleCriterion.is_active;

      const { error } = await supabase
        .from('speaking_test_rubric_criteria')
        .update({
          is_active: nextActive,
          updated_by: user.id,
          updated_at: nowIso,
        })
        .eq('id', targetToggleCriterion.id);

      if (error) throw error;

      await supabase.from('rubric_audit').insert({
        criterion_id: targetToggleCriterion.id,
        action: nextActive ? 'updated' : 'deactivated',
        changed_by: user.id,
        previous_data: { is_active: targetToggleCriterion.is_active },
        new_data: { is_active: nextActive },
        change_summary: `Academic Lead ${nextActive ? 'reactivated' : 'deactivated'} criterion "${targetToggleCriterion.criterion_name}"`,
      });

      showToast(`Criterion "${targetToggleCriterion.criterion_name}" updated.`);
      setTargetToggleCriterion(null);
      await fetchCriteria();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle criterion status.');
    } finally {
      setTogglingStatus(false);
    }
  };

  const handleCreateCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setAddingCriterion(true);
      const nowIso = new Date().toISOString();

      const insertPayload = {
        criterion_name: newName.trim(),
        description: newDescription.trim() || null,
        max_score: Number(newMaxScore) || 20,
        order_position: Number(newOrderPosition) || criteria.length + 1,
        is_active: true,
        updated_by: user.id,
        updated_at: nowIso,
      };

      const { data: created, error } = await supabase
        .from('speaking_test_rubric_criteria')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      if (created) {
        await supabase.from('rubric_audit').insert({
          criterion_id: created.id,
          action: 'created',
          changed_by: user.id,
          previous_data: null,
          new_data: insertPayload,
          change_summary: `Academic Lead added criterion "${insertPayload.criterion_name}"`,
        });
      }

      showToast(`Criterion "${insertPayload.criterion_name}" created.`);
      setIsAddModalOpen(false);
      setNewName('');
      setNewDescription('');
      setNewMaxScore(20);
      await fetchCriteria();
    } catch (err: any) {
      alert(err.message || 'Failed to create criterion.');
    } finally {
      setAddingCriterion(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Speaking Test Rubric Criteria</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure evaluation parameters and scoring weights for Clinical German Speaking assessments.
          </p>
        </div>
        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setRefreshing(true);
              fetchCriteria();
            }}
            disabled={loading || refreshing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Sync Rubric'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setNewOrderPosition(criteria.length + 1);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Criterion</span>
          </button>
        </div>
      </div>

      {/* Weight Summary Banner */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-[8px] bg-blue-50 text-blue-700">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900">Total Active Rubric Weight</span>
            <p className="text-[11px] text-slate-500">Sum of max scores across all enabled rubric criteria.</p>
          </div>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-black ${totalMaxScore === 100 ? 'text-[#1B3270]' : 'text-amber-600'}`}>
            {totalMaxScore}
          </span>
          <span className="text-xs text-slate-400 font-bold ml-1">/ 100 pts</span>
        </div>
      </div>

      {!loading && totalMaxScore !== 100 && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-[8px] flex items-start space-x-2.5 text-xs text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">Warning: Active Rubric Weight Mismatch</span>
            <p className="mt-0.5 text-[11px] text-amber-800">
              The total score of all active criteria must sum exactly to 100 points (currently {totalMaxScore} points). Mentors will not be able to evaluate Speaking Tests accurately until rubric criteria weights total 100.
            </p>
          </div>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
              <tr>
                <th className="px-5 py-3 w-12">#</th>
                <th className="px-4 py-3">Criterion Name</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Max Points</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Modified By</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F4]">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-5 py-4">
                      <div className="h-4 bg-slate-100 rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : criteria.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    No rubric criteria defined. Click "Add Criterion" to configure speaking test evaluation parameters.
                  </td>
                </tr>
              ) : (
                criteria.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-slate-50 transition-colors ${!c.is_active ? 'opacity-60 bg-slate-50/40' : ''}`}
                  >
                    <td className="px-5 py-3.5 font-bold text-slate-500">#{c.order_position}</td>
                    <td className="px-4 py-3.5 font-bold text-slate-900">{c.criterion_name}</td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-sm">{c.description || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-[#1B3270] bg-[#1B3270]/5 px-2 py-0.5 rounded border border-[#1B3270]/15">
                        {c.max_score} pts
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          c.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {c.is_active ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                      {c.updater_name}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 text-slate-500 hover:text-[#1B3270] hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"
                        title="Edit Criterion"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetToggleCriterion(c)}
                        className={`p-1.5 rounded-[6px] transition-colors cursor-pointer ${
                          c.is_active
                            ? 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                            : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                        }`}
                        title={c.is_active ? 'Deactivate Criterion' : 'Activate Criterion'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingCriterion && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#E2E8F4] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <h3 className="text-sm font-bold text-slate-900">Edit Rubric Criterion</h3>
              <button
                type="button"
                onClick={() => setEditingCriterion(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Criterion Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.criterion_name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, criterion_name: e.target.value }))}
                  className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Description / Guidelines</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Max Score (Weight) *</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={editForm.max_score}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, max_score: Number(e.target.value) }))
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Order Position *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={editForm.order_position}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, order_position: Number(e.target.value) }))
                    }
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingCriterion(null)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-[6px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 font-semibold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Criterion</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#E2E8F4] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <h3 className="text-sm font-bold text-slate-900">Add Speaking Test Criterion</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCriterion} className="p-5 space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Criterion Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fluency & Pronunciation"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Description / Rubric Notes</label>
                <textarea
                  rows={3}
                  placeholder="Details for assessing candidate speech delivery, medical terminology..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Max Score (Weight) *</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={newMaxScore}
                    onChange={(e) => setNewMaxScore(Number(e.target.value))}
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Order Position *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={newOrderPosition}
                    onChange={(e) => setNewOrderPosition(Number(e.target.value))}
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-[6px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingCriterion}
                  className="px-4 py-1.5 font-semibold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  {addingCriterion && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Criterion</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOGGLE STATUS CONFIRM MODAL */}
      {targetToggleCriterion && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#E2E8F4] w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 text-center space-y-3">
              <div
                className={`w-10 h-10 rounded-full mx-auto flex items-center justify-center ${
                  targetToggleCriterion.is_active ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {targetToggleCriterion.is_active ? 'Deactivate Criterion' : 'Reactivate Criterion'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to {targetToggleCriterion.is_active ? 'deactivate' : 'reactivate'} criterion "
                  {targetToggleCriterion.criterion_name}"?
                  {targetToggleCriterion.is_active &&
                    ' Inactive criteria will not be displayed on mentors\' speaking test scorecards.'}
                </p>
              </div>

              <div className="flex items-center justify-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetToggleCriterion(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 border border-slate-200 rounded-[6px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={togglingStatus}
                  onClick={handleToggleActive}
                  className={`px-4 py-1.5 text-xs font-semibold text-white rounded-[6px] cursor-pointer shadow-2xs flex items-center space-x-1 ${
                    targetToggleCriterion.is_active ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {togglingStatus && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{targetToggleCriterion.is_active ? 'Confirm Deactivate' : 'Confirm Reactivate'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AcademicRubricTab;
