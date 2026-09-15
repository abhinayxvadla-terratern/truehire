import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  Package,
  Plus,
  Check,
  ToggleLeft,
  ToggleRight,
  Euro,
  AlertCircle,
  Loader2,
  Trash2,
} from 'lucide-react';
import { getGateLabel, getOfferingTypeLabel } from '../../../utils/labels';
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal';

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

export const OfferingsTab: React.FC = () => {
  const [offerings, setOfferings] = useState<OfferingRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Language Course');
  const [applicableGate, setApplicableGate] = useState('dt');
  const [price, setPrice] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [offeringToDelete, setOfferingToDelete] = useState<OfferingRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchOfferings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('offerings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOfferings(data || []);
    } catch (err) {
      console.error('Error fetching offerings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOfferings();
  }, []);

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

  const handleDeleteOfferingConfirm = async () => {
    if (!offeringToDelete) return;
    setIsDeleting(true);
    try {
      // 1. Delete candidate recommendations for this offering
      await supabase
        .from('candidate_offerings')
        .delete()
        .eq('offering_id', offeringToDelete.id);

      // 2. Delete offering
      const { error } = await supabase
        .from('offerings')
        .delete()
        .eq('id', offeringToDelete.id);

      if (error) throw error;

      showToast('Offering deleted.');
      setOfferingToDelete(null);
      fetchOfferings();
    } catch (err: any) {
      alert(`Failed to delete offering: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-18 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[6px] shadow-lg flex items-center space-x-2 text-xs font-semibold animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1B3270]">Training & Language Offerings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Catalog learning modules, supplemental language courses, and qualification pathways for candidates.
        </p>
      </div>

      {/* FORM: CREATE OFFERING (ALWAYS VISIBLE) */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-4">
        <div className="flex items-center space-x-2 pb-2 border-b border-[#E2E8F4]">
          <Package className="w-5 h-5 text-[#1B3270]" />
          <h2 className="text-base font-bold text-slate-800">Create New Offering</h2>
        </div>

        {formError && (
          <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleCreateOffering} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Offering Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Intensive German B2 for Nurses"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Offering Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-800"
              >
                <option value="Language Course">Language Course</option>
                <option value="Training">Training</option>
                <option value="Clinical Prep">Clinical Prep</option>
                <option value="Exam Certification">Exam Certification</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Applicable Gate *
              </label>
              <select
                value={applicableGate}
                onChange={(e) => setApplicableGate(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-800"
              >
                <option value="dt">Diagnostic Test</option>
                <option value="assessment">Final Assessment</option>
                <option value="interview_prep">Interview Preparation</option>
                <option value="general">General Qualification</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
            <div className="lg:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Course Description
              </label>
              <textarea
                rows={2}
                placeholder="Key learning outcomes, duration, syllabus highlights, and prerequisites..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Price in € *
                </label>
                <div className="relative">
                  <Euro className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={creating}
                className="w-full py-2 px-4 bg-[#1B3270] hover:bg-[#2952A3] text-white font-semibold text-xs rounded-[6px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center justify-center space-x-1.5"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Offering</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* LIST: ALL OFFERINGS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Cataloged Offerings ({offerings.length})
          </h2>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : offerings.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">No offerings listed yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Use the form above to add language courses or training packages to the catalog.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Offering Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Target Gate</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                  {offerings.map((off) => (
                    <tr key={off.id} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{off.name}</div>
                        {off.description && (
                          <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-md">
                            {off.description}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          {getOfferingTypeLabel(off.type)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-600">
                        {off.applicable_gate ? getGateLabel(off.applicable_gate) : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        €{Number(off.price).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            off.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {off.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(off)}
                            className={`p-1 rounded transition-colors cursor-pointer ${
                              off.is_active
                                ? 'text-emerald-600 hover:text-emerald-700'
                                : 'text-slate-400 hover:text-slate-600'
                            }`}
                            title={`Toggle ${off.is_active ? 'Off' : 'On'}`}
                          >
                            {off.is_active ? (
                              <ToggleRight className="w-7 h-7" />
                            ) : (
                              <ToggleLeft className="w-7 h-7" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOfferingToDelete(off)}
                            className="inline-flex items-center space-x-1 h-7 px-2.5 text-xs font-semibold text-[#EF4444] border border-[#EF4444] rounded-[6px] hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete offering"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {offeringToDelete && (
        <DeleteConfirmationModal
          isOpen={true}
          tier="tier2"
          entityType="Offering"
          entityName={offeringToDelete.name}
          bodyText="Candidate recommendations for this offering will also be removed."
          onClose={() => setOfferingToDelete(null)}
          onConfirm={handleDeleteOfferingConfirm}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
};
