import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import {
  FileCheck,
  CheckCircle,
  AlertTriangle,
  Plus,
  Loader2,
  RefreshCw,
  X,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

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

export const RubricCriteriaTab: React.FC = () => {
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

  // Add form
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxScore, setNewMaxScore] = useState<number>(20);
  const [newOrderPosition, setNewOrderPosition] = useState<number>(1);
  const [addingCriterion, setAddingCriterion] = useState(false);

  // Delete state
  const [criterionToDelete, setCriterionToDelete] = useState<RubricCriterion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleDeleteCriterionConfirm = async () => {
    if (!criterionToDelete || !user) return;
    setIsDeleting(true);
    try {
      // 1. Audit log
      await supabase.from('rubric_audit').insert({
        criterion_id: criterionToDelete.id,
        changed_by: user.id,
        action: 'deleted',
        previous_data: criterionToDelete,
      });

      // 2. Delete criterion
      const { error } = await supabase
        .from('speaking_test_rubric_criteria')
        .delete()
        .eq('id', criterionToDelete.id);

      if (error) throw error;

      showToast('Criterion deleted.');
      setCriterionToDelete(null);
      fetchCriteria();
    } catch (err: any) {
      alert(`Failed to delete criterion: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
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
          updated_at,
          updater:updated_by (first_name, last_name, email)
        `)
        .order('order_position', { ascending: true });

      if (error) throw error;

      const mapped: RubricCriterion[] = (data || []).map((c: any) => {
        const updater = c.updater;
        const uName = updater
          ? `${updater.first_name || ''} ${updater.last_name || ''}`.trim() || updater.email
          : 'System';

        return {
          id: c.id,
          criterion_name: c.criterion_name,
          description: c.description || '',
          max_score: c.max_score ?? 20,
          order_position: c.order_position ?? 1,
          is_active: c.is_active ?? true,
          updated_by: c.updated_by,
          updated_at: c.updated_at,
          updater_name: uName,
        };
      });

      setCriteria(mapped);

      // Default next order position
      const maxPos = mapped.reduce((max, cur) => Math.max(max, cur.order_position || 0), 0);
      setNewOrderPosition(maxPos + 1);
    } catch (err) {
      console.error('Error fetching rubric criteria:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCriteria();
  }, []);

  const totalScore = useMemo(() => {
    return criteria.filter((c) => c.is_active).reduce((sum, cur) => sum + (cur.max_score || 0), 0);
  }, [criteria]);

  // Edit Handlers
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
    if (!editingCriterion || !user || savingEdit) return;
    setSavingEdit(true);
    try {
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
        max_score: Number(editForm.max_score),
        order_position: Number(editForm.order_position),
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
        change_summary: `Super Admin ${isWeightChange ? 'changed weight for' : 'updated'} criterion "${newData.criterion_name}"`,
      });

      showToast(`Criterion "${newData.criterion_name}" updated.`);
      setEditingCriterion(null);
      fetchCriteria();
    } catch (err: any) {
      console.error('Error saving criterion:', err);
      alert(err.message || 'Failed to update criterion.');
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle Active / Deactivate
  const handleToggleActive = async () => {
    if (!targetToggleCriterion || !user || togglingStatus) return;
    setTogglingStatus(true);
    try {
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
        change_summary: `Super Admin ${nextActive ? 'reactivated' : 'deactivated'} criterion "${targetToggleCriterion.criterion_name}"`,
      });

      showToast(`Criterion "${targetToggleCriterion.criterion_name}" updated.`);
      setTargetToggleCriterion(null);
      fetchCriteria();
    } catch (err: any) {
      console.error('Error toggling criterion:', err);
      alert(err.message || 'Failed to toggle criterion status.');
    } finally {
      setTogglingStatus(false);
    }
  };

  // Add Criterion
  const handleAddCriterion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || addingCriterion) return;
    if (!newName.trim() || !newDescription.trim()) {
      alert('Fill out all required fields.');
      return;
    }

    setAddingCriterion(true);
    try {
      const payload = {
        criterion_name: newName.trim(),
        description: newDescription.trim(),
        max_score: Number(newMaxScore),
        order_position: Number(newOrderPosition),
        is_active: true,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('speaking_test_rubric_criteria')
        .insert(payload)
        .select('id')
        .single();

      if (error) throw error;

      if (data?.id) {
        await supabase.from('rubric_audit').insert({
          criterion_id: data.id,
          action: 'created',
          changed_by: user.id,
          previous_data: null,
          new_data: payload,
          change_summary: `Super Admin created criterion "${payload.criterion_name}"`,
        });
      }

      showToast(`Criterion "${payload.criterion_name}" added successfully.`);
      setNewName('');
      setNewDescription('');
      setNewMaxScore(20);
      fetchCriteria();
    } catch (err: any) {
      console.error('Error adding criterion:', err);
      alert(err.message || 'Failed to add criterion.');
    } finally {
      setAddingCriterion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 text-sm">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1B3270]">Speaking Test Rubric Criteria</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage scoring dimensions and weight distributions used by mentors during speaking evaluations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchCriteria();
          }}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#E2E8F4] rounded-[6px] hover:bg-slate-50 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* TOTAL SCORE INDICATOR BANNER */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-50 text-[#1B3270] rounded-lg">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">
              Total possible score: {totalScore}
            </p>
            <p className="text-xs text-slate-500">
              Cumulative maximum score across all active evaluation criteria.
            </p>
          </div>
        </div>

        {totalScore !== 100 ? (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Total is {totalScore}. Expected: 100.
          </span>
        ) : (
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
            100-point rubric calibration intact.
          </span>
        )}
      </div>

      {/* CRITERIA TABLE */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Loading rubric criteria...</p>
          </div>
        ) : criteria.length === 0 ? (
          <div className="py-16 text-center">
            <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No rubric criteria configured</p>
            <p className="text-xs text-slate-400 mt-1">Add your first evaluation criterion below.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F4] text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 w-16 text-center">Order</th>
                  <th className="px-4 py-3.5">Criterion Name</th>
                  <th className="px-4 py-3.5">Description</th>
                  <th className="px-4 py-3.5 text-center">Max Score</th>
                  <th className="px-4 py-3.5 text-center">Active</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4]">
                {criteria.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-700">
                      {c.order_position}
                    </td>
                    <td className="px-4 py-3.5 font-bold text-slate-800">{c.criterion_name}</td>
                    <td className="px-4 py-3.5 text-slate-600 max-w-sm leading-relaxed">
                      {c.description}
                    </td>
                    <td className="px-4 py-3.5 text-center font-mono font-extrabold text-[#1B3270]">
                      {c.max_score} pts
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          c.is_active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="px-2.5 py-1 text-xs font-semibold text-[#1B3270] hover:bg-slate-100 rounded"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setTargetToggleCriterion(c)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded ${
                          c.is_active
                            ? 'text-rose-600 hover:bg-rose-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {c.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCriterionToDelete(c)}
                        className="inline-flex items-center space-x-1 h-7 px-2.5 text-xs font-semibold text-[#EF4444] border border-[#EF4444] rounded-[6px] hover:bg-red-50 transition-colors cursor-pointer"
                        title="Delete criterion"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION: ADD NEW CRITERION */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-4">
        <div className="border-b border-[#E2E8F4] pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-[#1B3270]">Add New Criterion</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Define a new speaking test assessment dimension.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full">
            Next Position: #{newOrderPosition}
          </span>
        </div>

        <form onSubmit={handleAddCriterion} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Criterion Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Clinical Communication & Terminology"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Score *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={newMaxScore}
                  onChange={(e) => setNewMaxScore(Number(e.target.value))}
                  className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Order Position *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={newOrderPosition}
                  onChange={(e) => setNewOrderPosition(Number(e.target.value))}
                  className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Scoring Guidance *
            </label>
            <textarea
              required
              rows={3}
              placeholder="Detail what candidate behavior demonstrates mastery in this rubric criterion..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              className="w-full border border-[#E2E8F4] rounded-[6px] p-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={addingCriterion}
              className="px-4 py-2 text-xs font-bold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] disabled:opacity-50 flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            >
              {addingCriterion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Add Criterion</span>
            </button>
          </div>
        </form>
      </div>

      {/* EDIT MODAL */}
      {editingCriterion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-base font-bold text-slate-800">Edit Rubric Criterion</h3>
              <button onClick={() => setEditingCriterion(null)}>
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Criterion Name</label>
                <input
                  type="text"
                  required
                  value={editForm.criterion_name}
                  onChange={(e) => setEditForm({ ...editForm, criterion_name: e.target.value })}
                  className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  required
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Score</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editForm.max_score}
                    onChange={(e) => setEditForm({ ...editForm, max_score: Number(e.target.value) })}
                    className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Order Position</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={editForm.order_position}
                    onChange={(e) => setEditForm({ ...editForm, order_position: Number(e.target.value) })}
                    className="w-full border border-[#E2E8F4] rounded-[6px] p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setEditingCriterion(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[6px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] disabled:opacity-50 flex items-center space-x-1"
                >
                  {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEACTIVATE CONFIRM MODAL */}
      {targetToggleCriterion && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-800">
                {targetToggleCriterion.is_active ? 'Deactivate Criterion' : 'Reactivate Criterion'}
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {targetToggleCriterion.is_active
                ? `Deactivating "${targetToggleCriterion.criterion_name}" will remove it from future speaking test rubrics. Existing recorded scores are preserved.`
                : `Reactivating "${targetToggleCriterion.criterion_name}" will include it in subsequent speaking tests.`}
            </p>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setTargetToggleCriterion(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[6px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={togglingStatus}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-[6px] disabled:opacity-50 flex items-center space-x-1.5 ${
                  targetToggleCriterion.is_active
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {togglingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {targetToggleCriterion.is_active ? 'Confirm Deactivation' : 'Confirm Reactivation'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {criterionToDelete && (
        <DeleteConfirmationModal
          isOpen={true}
          tier="tier2"
          entityType="Criterion"
          entityName={criterionToDelete.criterion_name}
          bodyText="Deleting this criterion removes it and all associated rubric scores from historical results."
          onClose={() => setCriterionToDelete(null)}
          onConfirm={handleDeleteCriterionConfirm}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
