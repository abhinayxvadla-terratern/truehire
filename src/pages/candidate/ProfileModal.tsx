import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string;
  initialTargetRole?: string | null;
  initialLanguageLevel?: string | null;
  initialNationality?: string | null;
  onSuccess: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  candidateId,
  initialTargetRole,
  initialLanguageLevel,
  initialNationality,
  onSuccess,
}) => {
  const [targetRole, setTargetRole] = useState(initialTargetRole || 'nursing');
  const [languageLevel, setLanguageLevel] = useState(initialLanguageLevel || 'B1');
  const [nationality, setNationality] = useState(initialNationality || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('candidates')
        .update({
          target_role: targetRole,
          language_level_self_reported: languageLevel,
          nationality: nationality.trim() || null,
        })
        .eq('id', candidateId);

      if (updateError) {
        throw updateError;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating candidate profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-[0_1px_4px_rgba(27,50,112,0.08)] max-w-md w-full p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#94A3B8] hover:text-[#1B3270]"
        >
          <X size={18} />
        </button>

        <h3 className="text-lg font-bold text-[#1B3270] mb-1">
          Complete Your Profile
        </h3>
        <p className="text-xs text-[#94A3B8] mb-5">
          Provide your target career details for placement matching.
        </p>

        {error && (
          <div className="mb-4 text-xs text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-[6px] p-2.5">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
              Target Role
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F4] rounded-[6px] text-[#1B3270] outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
            >
              <option value="nursing">Nursing</option>
              <option value="ausbildung">Ausbildung</option>
              <option value="care">Care</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
              Self-Reported German Language Level
            </label>
            <select
              value={languageLevel}
              onChange={(e) => setLanguageLevel(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F4] rounded-[6px] text-[#1B3270] outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
            >
              <option value="A2">A2 - Elementary</option>
              <option value="B1">B1 - Intermediate</option>
              <option value="B2">B2 - Upper Intermediate</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
              Nationality (Optional)
            </label>
            <input
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="e.g. Indian, Filipino, Vietnamese"
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-[#E2E8F4] rounded-[6px] text-[#1B3270] placeholder-[#94A3B8] outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#4A5568] hover:text-[#1B3270] rounded-[6px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-medium rounded-[6px] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
