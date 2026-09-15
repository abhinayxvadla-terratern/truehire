import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Info, Sparkles } from 'lucide-react';
import { DocumentUploadCard } from '../../components/candidate/DocumentUploadCard';
import {
  ALL_DOCUMENT_TYPES,
  DocumentSection,
  MANDATORY_DOC_COUNT,
} from '../../utils/documentTypes';

interface DocumentationTabProps {
  candidate: any;
}

type FilterSection = 'all' | DocumentSection;

export const DocumentationTab: React.FC<DocumentationTabProps> = ({
  candidate,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterSection>('all');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cvParseToast, setCvParseToast] = useState<string | null>(null);

  const showCvToast = (msg: string) => {
    setCvParseToast(msg);
    setTimeout(() => setCvParseToast(null), 4000);
  };

  const fetchAndInitDocuments = async () => {
    if (!candidate?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Fetch current documents
      const { data: existingDocs, error } = await supabase
        .from('documents')
        .select('*')
        .eq('candidate_id', candidate.id);

      if (error) throw error;

      const docList = existingDocs || [];
      const existingTypes = new Set(docList.map((d) => d.document_type));

      // 2. Identify missing types from 18 standard types
      const missingTypes = ALL_DOCUMENT_TYPES.filter(
        (t) => !existingTypes.has(t.document_type)
      );

      if (missingTypes.length > 0) {
        const rowsToInsert = missingTypes.map((t) => ({
          candidate_id: candidate.id,
          document_type: t.document_type,
          document_label: t.label,
          status: 'not_uploaded',
          is_mandatory: t.is_mandatory,
          source_section: t.source_section,
          notes: t.notes,
        }));

        const { data: inserted, error: insertErr } = await supabase
          .from('documents')
          .insert(rowsToInsert)
          .select();

        if (!insertErr && inserted) {
          docList.push(...inserted);
        }
      }

      setDocuments(docList);
    } catch (err) {
      console.error('Error loading documents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndInitDocuments();
  }, [candidate?.id]);

  // Handle parsing CV requested from updated_cv upload
  const handleParseCv = async (fileUrl: string) => {
    if (!candidate?.id) return;
    try {
      showCvToast('Parsing your CV with AI... This takes a few seconds.');

      // 1. Insert row in candidate_cv_parses
      const { error: pErr } = await supabase
        .from('candidate_cv_parses')
        .insert({
          candidate_id: candidate.id,
          cv_file_url: fileUrl,
          status: 'processing',
          applied: false,
        });

      if (pErr) throw pErr;

      // 2. Invoke parse-cv edge function
      try {
        await supabase.functions.invoke('parse-cv', {
          body: {
            cv_file_url: fileUrl,
            candidate_id: candidate.id,
          },
        });
      } catch (fnErr) {
        console.warn('Edge function invoke note:', fnErr);
      }

      showCvToast('CV parsed! Head over to "My Profile" to review and apply details.');
    } catch (err: any) {
      console.error('Error parsing CV:', err);
      showCvToast('Could not automatically parse CV. You can fill details manually in My Profile.');
    }
  };

  // Metrics
  const verifiedCount = documents.filter((d) => d.status === 'verified').length;
  const pendingCount = documents.filter(
    (d) => d.status === 'pending' || d.status === 'under_review'
  ).length;
  const rejectedCount = documents.filter((d) => d.status === 'rejected').length;
  const notUploadedCount = documents.filter(
    (d) => d.status === 'not_uploaded' || !d.status
  ).length;

  const mandatoryVerifiedCount = documents.filter(
    (d) => d.status === 'verified' && d.is_mandatory
  ).length;

  const progressPct = Math.min(
    100,
    Math.round((mandatoryVerifiedCount / MANDATORY_DOC_COUNT) * 100)
  );

  const getProgressBarColor = () => {
    if (rejectedCount > 0) return 'bg-rose-500';
    if (progressPct === 100) return 'bg-emerald-500';
    if (pendingCount > 0 || progressPct > 0) return 'bg-amber-500';
    return 'bg-[#2952A3]';
  };

  // Filtered documents
  const filteredDocTypes = ALL_DOCUMENT_TYPES.filter((t) => {
    if (activeFilter === 'all') return true;
    return t.source_section === activeFilter;
  });

  // Map existing documents by document_type
  const docMap: Record<string, any> = {};
  const expDocs: any[] = [];
  documents.forEach((d) => {
    if (d.document_type === 'experience_certificate') {
      expDocs.push(d);
    } else {
      docMap[d.document_type] = d;
    }
  });

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B3270]" />
        <span className="text-xs text-slate-400 mt-3 font-medium">
          Loading Document Records...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Toast */}
      {cvParseToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] text-xs font-semibold shadow-lg flex items-center space-x-2 animate-in slide-in-from-bottom duration-200">
          <Sparkles size={15} className="text-emerald-400" />
          <span>{cvParseToast}</span>
        </div>
      )}

      {/* 1. DOCUMENT SUMMARY AT TOP */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-[0_1px_4px_rgba(27,50,112,0.06)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1B3270]">
              Documents Status Overview
            </h2>
            <p className="text-xs text-[#4A5568] mt-0.5">
              Documents: <strong className="text-emerald-700">{verifiedCount} verified</strong> ·{' '}
              <strong className="text-amber-700">{pendingCount} under review</strong> ·{' '}
              <strong className="text-slate-500">{notUploadedCount} not uploaded</strong>
              {rejectedCount > 0 && (
                <>
                  {' '}· <strong className="text-rose-600">{rejectedCount} rejected</strong>
                </>
              )}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs font-bold text-[#1B3270]">
              {mandatoryVerifiedCount} of {MANDATORY_DOC_COUNT} Required Verified
            </span>
            <span className="text-xs text-[#94A3B8] ml-1">({progressPct}%)</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* CROSS-LINK NOTE */}
      <div className="p-3 bg-slate-50 border border-[#E2E8F4] rounded-[8px] text-xs text-[#4A5568] flex items-center space-x-2">
        <Info size={15} className="text-[#2952A3] shrink-0" />
        <span>
          Documents uploaded in your profile sections appear here automatically. You can also upload directly below.
        </span>
      </div>

      {/* SECTION FILTER TABS (Pill style) */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: 'all', label: 'All' },
          { id: 'personal', label: 'Personal' },
          { id: 'education', label: 'Education' },
          { id: 'professional', label: 'Professional' },
          { id: 'experience', label: 'Experience' },
          { id: 'language', label: 'Language' },
        ].map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as FilterSection)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#1B3270] text-white shadow-2xs'
                  : 'bg-white border border-[#E2E8F4] text-[#4A5568] hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* DOCUMENT LIST */}
      <div className="space-y-3">
        {filteredDocTypes.map((docTypeConfig) => {
          // Special handling for multi-upload experience certificates
          if (docTypeConfig.document_type === 'experience_certificate') {
            return (
              <div key={docTypeConfig.document_type} className="space-y-2">
                {expDocs.length === 0 ? (
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType={docTypeConfig.document_type}
                    label="Experience Certificate #1"
                    isMandatory={docTypeConfig.is_mandatory}
                    notes={docTypeConfig.notes}
                    sourceSection={docTypeConfig.source_section}
                    isMultiExperience={true}
                    onDocUploaded={fetchAndInitDocuments}
                  />
                ) : (
                  expDocs.map((expDoc, idx) => (
                    <DocumentUploadCard
                      key={expDoc.id || idx}
                      candidateId={candidate.id}
                      documentType={docTypeConfig.document_type}
                      label={`Experience Certificate #${idx + 1}`}
                      isMandatory={idx === 0}
                      sourceSection={docTypeConfig.source_section}
                      existingDoc={expDoc}
                      isMultiExperience={true}
                      onDocUploaded={fetchAndInitDocuments}
                      onDeleteDoc={async (docId) => {
                        await supabase.from('documents').delete().eq('id', docId);
                        fetchAndInitDocuments();
                      }}
                    />
                  ))
                )}
              </div>
            );
          }

          const existing = docMap[docTypeConfig.document_type];
          return (
            <DocumentUploadCard
              key={docTypeConfig.document_type}
              candidateId={candidate.id}
              documentType={docTypeConfig.document_type}
              label={docTypeConfig.label}
              isMandatory={docTypeConfig.is_mandatory}
              notes={docTypeConfig.notes}
              sourceSection={docTypeConfig.source_section}
              existingDoc={existing}
              onDocUploaded={fetchAndInitDocuments}
              onParseCvRequested={handleParseCv}
            />
          );
        })}
      </div>
    </div>
  );
};
