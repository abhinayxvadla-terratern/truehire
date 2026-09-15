import React, { useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Loader2,
  Trash2,
} from 'lucide-react';

interface DocumentUploadCardProps {
  candidateId: string;
  documentType: string;
  label?: string;
  isMandatory?: boolean;
  notes?: string | null;
  sourceSection?: string;
  existingDoc?: any;
  onDocUploaded?: (doc: any) => void;
  onParseCvRequested?: (fileUrl: string) => void;
  compact?: boolean;
  isMultiExperience?: boolean;
  onDeleteDoc?: (docId: string) => void;
}

export const DocumentUploadCard: React.FC<DocumentUploadCardProps> = ({
  candidateId,
  documentType,
  label,
  isMandatory = true,
  notes,
  sourceSection,
  existingDoc,
  onDocUploaded,
  onParseCvRequested,
  compact = false,
  isMultiExperience = false,
  onDeleteDoc,
}) => {
  const [doc, setDoc] = useState<any>(existingDoc || null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showCvPrompt, setShowCvPrompt] = useState(false);
  const [employerNote, setEmployerNote] = useState(existingDoc?.notes || '');
  const [savingNote, setSavingNote] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state if existingDoc changes from parent
  React.useEffect(() => {
    if (existingDoc) {
      setDoc(existingDoc);
      if (existingDoc.notes) {
        setEmployerNote(existingDoc.notes);
      }
    }
  }, [existingDoc]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !candidateId) return;

    // Enforce 10MB max file size limit
    const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError('File size exceeds 10MB limit. Select a smaller file.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${candidateId}/${documentType}/${Date.now()}_${sanitizedName}`;

      // 1. Upload to Supabase Storage bucket 'candidate-documents'
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('candidate-documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      // 2. Persist to documents table
      const docPayload: any = {
        candidate_id: candidateId,
        document_type: documentType,
        document_label: label || documentType,
        file_url: uploadData.path,
        status: 'pending',
        is_mandatory: isMandatory,
        source_section: sourceSection,
        notes: isMultiExperience ? employerNote : notes,
        uploaded_at: new Date().toISOString(),
        rejection_reason: null,
      };

      let savedDoc: any = null;

      if (isMultiExperience && doc?.id) {
        // Update existing experience row
        const { data, error } = await supabase
          .from('documents')
          .update(docPayload)
          .eq('id', doc.id)
          .select()
          .single();
        if (error) throw error;
        savedDoc = data;
      } else if (isMultiExperience && !doc?.id) {
        // Insert new experience row
        const { data, error } = await supabase
          .from('documents')
          .insert(docPayload)
          .select()
          .single();
        if (error) throw error;
        savedDoc = data;
      } else {
        // Standard upsert
        const { data, error } = await supabase
          .from('documents')
          .upsert(docPayload, { onConflict: 'candidate_id, document_type' })
          .select()
          .single();
        if (error) throw error;
        savedDoc = data;
      }

      setDoc(savedDoc);
      if (onDocUploaded) {
        onDocUploaded(savedDoc);
      }

      // If uploaded document is updated_cv, show parse prompt
      if (documentType === 'updated_cv') {
        setShowCvPrompt(true);
      }
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleViewDocument = async () => {
    if (!doc?.file_url) return;
    try {
      let downloadUrl = doc.file_url;
      if (!doc.file_url.startsWith('http')) {
        const { data, error } = await supabase.storage
          .from('candidate-documents')
          .createSignedUrl(doc.file_url, 300);
        if (error || !data?.signedUrl) {
          throw error || new Error('Could not get signed URL');
        }
        downloadUrl = data.signedUrl;
      }
      window.open(downloadUrl, '_blank');
    } catch (err) {
      console.error('Error viewing document:', err);
    }
  };

  const handleSaveEmployerNote = async () => {
    if (!doc?.id) return;
    try {
      setSavingNote(true);
      const { error } = await supabase
        .from('documents')
        .update({ notes: employerNote })
        .eq('id', doc.id);
      if (error) throw error;
    } catch (err) {
      console.error('Error saving note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const status = doc?.status || 'not_uploaded';

  const renderStatusBadge = () => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span>Verified</span>
          </span>
        );
      case 'under_review':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Clock size={13} className="text-sky-600" />
            <span>Under Review</span>
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={13} className="text-amber-600" />
            <span>Uploaded — Awaiting Review</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={13} className="text-rose-600" />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500">
            Not Uploaded
          </span>
        );
    }
  };

  const displayFilename = doc?.file_url
    ? doc.file_url.split('/').pop()?.replace(/^\d+_/, '')
    : null;

  return (
    <div
      className={`bg-white border rounded-[8px] transition-all duration-150 ${
        status === 'rejected'
          ? 'border-rose-300 bg-rose-50/20'
          : status === 'verified'
          ? 'border-emerald-200'
          : 'border-[#E2E8F4] hover:border-slate-300'
      } ${compact ? 'p-3.5' : 'p-4'}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2">
            <h4 className="text-sm font-medium text-[#1B3270] truncate">
              {label || documentType}
            </h4>

            {isMandatory ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                Required
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-slate-100 text-slate-500">
                Optional
              </span>
            )}
          </div>

          {notes && !isMultiExperience && (
            <p className="text-xs text-[#94A3B8] mt-0.5">{notes}</p>
          )}

          {/* Employer Label input for Experience Certificates */}
          {isMultiExperience && (
            <div className="mt-2 flex items-center space-x-2">
              <input
                type="text"
                value={employerNote}
                onChange={(e) => setEmployerNote(e.target.value)}
                onBlur={handleSaveEmployerNote}
                placeholder="Hospital / Employer Name"
                className="text-xs px-2.5 py-1 border border-[#E2E8F4] rounded-[5px] w-64 focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
              {savingNote && <span className="text-[10px] text-slate-400">Saving...</span>}
            </div>
          )}

          {/* Rejection Reason if any */}
          {status === 'rejected' && doc?.rejection_reason && (
            <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-center space-x-1">
              <AlertCircle size={12} className="shrink-0" />
              <span>Reason: {doc.rejection_reason}</span>
            </p>
          )}

          {/* Uploaded File Link */}
          {doc?.file_url && (
            <div className="mt-1.5 flex items-center space-x-2 text-xs text-[#2952A3]">
              <button
                type="button"
                onClick={handleViewDocument}
                className="font-medium hover:underline inline-flex items-center space-x-1 text-[#1B3270]"
              >
                <FileText size={12} className="text-[#2952A3]" />
                <span className="truncate max-w-[220px]">{displayFilename || 'View Document'}</span>
                <ExternalLink size={11} className="text-slate-400" />
              </button>
              {doc.uploaded_at && (
                <span className="text-[11px] text-slate-400">
                  • {new Date(doc.uploaded_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Center: Status Badge */}
        <div className="flex items-center shrink-0">{renderStatusBadge()}</div>

        {/* Right: Actions */}
        <div className="flex items-center space-x-2 shrink-0">
          {uploading ? (
            <div className="flex items-center space-x-1.5 px-3 py-1.5 text-xs text-[#1B3270] font-medium">
              <Loader2 size={14} className="animate-spin text-[#1B3270]" />
              <span>Uploading...</span>
            </div>
          ) : status === 'not_uploaded' ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors duration-150 inline-flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            >
              <Upload size={13} />
              <span>Upload</span>
            </button>
          ) : status === 'rejected' ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-[6px] transition-colors duration-150 inline-flex items-center space-x-1.5 shadow-2xs cursor-pointer"
            >
              <RefreshCw size={13} />
              <span>Re-upload</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-[6px] transition-colors inline-flex items-center space-x-1 cursor-pointer"
              >
                <RefreshCw size={11} className="text-slate-500" />
                <span>Replace</span>
              </button>

              {isMultiExperience && onDeleteDoc && doc?.id && (
                <button
                  type="button"
                  onClick={() => onDeleteDoc(doc.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                  title="Remove certificate"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="mt-2 text-xs text-rose-600 bg-rose-50 p-2 rounded-[5px] border border-rose-200 flex items-center space-x-1.5">
          <AlertCircle size={13} className="shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {/* CV Parse Prompt on CV Upload */}
      {showCvPrompt && (
        <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-[6px] text-xs space-y-2">
          <p className="font-semibold text-[#1B3270]">
            Would you like to parse this CV to auto-fill your profile?
          </p>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setShowCvPrompt(false);
                if (onParseCvRequested && doc?.file_url) {
                  onParseCvRequested(doc.file_url);
                }
              }}
              className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white font-semibold rounded-[5px] cursor-pointer"
            >
              Yes, parse my CV
            </button>
            <button
              type="button"
              onClick={() => setShowCvPrompt(false)}
              className="px-3 py-1 bg-white border border-[#E2E8F4] text-slate-700 font-medium rounded-[5px] hover:bg-slate-50 cursor-pointer"
            >
              No, just save it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
