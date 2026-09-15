import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  tier?: 'tier1' | 'tier2';
  entityType: string; // e.g. "Candidate", "Supplier", "Employer", "Question", "Gate Result", "Offering", "Cohort", "Notification", "Team Member"
  entityName?: string; // e.g. "John Doe" or "Apex Agency"
  bodyText?: string;
  isDeleting?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  tier = 'tier2',
  entityType,
  entityName,
  bodyText,
  isDeleting = false,
}) => {
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setConfirmInput('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isTier1 = tier === 'tier1';
  const canConfirm = isTier1 ? confirmInput.trim() === 'DELETE' : true;

  const defaultBody = isTier1
    ? `This permanently deletes ${entityName || entityType} and all associated data. This cannot be undone.`
    : bodyText || `Are you sure you want to permanently delete this ${entityType.toLowerCase()}?`;

  return (
    <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-2xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-[10px] max-w-md w-full shadow-2xl overflow-hidden border border-[#E2E8F4]">
        {/* Modal Header */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between border-b ${
            isTier1
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-[#F8FAFD] border-[#E2E8F4] text-slate-900'
          }`}
        >
          <div className="flex items-center space-x-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                isTier1 ? 'bg-rose-100 text-rose-600' : 'bg-rose-50 text-rose-600'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold">Delete {entityType}?</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 text-xs text-slate-700">
          <p className="text-slate-600 leading-relaxed font-normal">{defaultBody}</p>

          {isTier1 && (
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-semibold text-slate-700">
                To confirm deletion, type <span className="font-mono font-bold text-rose-600">DELETE</span> below:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Type DELETE to confirm"
                disabled={isDeleting}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono"
              />
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-3.5 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm || isDeleting}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
