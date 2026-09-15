import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../../../lib/supabase';
import { useAuth } from '../../../../../context/AuthContext';
import {
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Send,
  Loader2,
  Check,
  ArrowDown,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { ALL_DOCUMENT_TYPES, DocumentTypeConfig } from '../../../../../utils/documentTypes';

export interface DocumentReviewCandidate {
  id: string;
  first_name: string;
  last_name: string;
  target_role?: string | null;
  language_level_self_reported?: string | null;
  user_id?: string | null;
  supplier_name?: string | null;
  profile_completion_pct?: number | null;
  dt_passed_at?: string | null;
}

interface DocumentReviewPanelProps {
  candidate: DocumentReviewCandidate | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface DocumentRecord {
  id: string;
  candidate_id: string;
  document_type: string;
  file_url: string | null;
  status: string;
  rejection_reason?: string | null;
  verification_notes?: string | null;
  uploaded_at?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
}

interface MentorOption {
  id: string;
  name: string;
  email: string;
  activeCount: number;
}

interface ExistingProposalData {
  id: string;
  status: string;
  proposed_mentor_id: string;
  proposed_mentor_name?: string;
  proposed_date?: string;
  proposed_time?: string;
  created_at: string;
  approval_notes?: string | null;
  notes?: string | null;
}

export const DocumentReviewPanel: React.FC<DocumentReviewPanelProps> = ({
  candidate,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [verifierMap, setVerifierMap] = useState<Record<string, string>>({});
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [existingProposal, setExistingProposal] = useState<ExistingProposalData | null>(null);

  // Rejection modal
  const [rejectingDoc, setRejectingDoc] = useState<{ docId: string; typeConfig: DocumentTypeConfig } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);

  // Proposal form state
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('');
  const [leadNotes, setLeadNotes] = useState('');
  const [submittingProposal, setSubmittingProposal] = useState(false);
  const [proposalSuccessMsg, setProposalSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const proposalFormRef = useRef<HTMLDivElement | null>(null);

  // Minimum date today for proposal date picker (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    if (!candidate || !isOpen) return;

    try {
      setLoading(true);
      setErrorMessage(null);

      // 1. Fetch candidate documents
      const { data: docsData, error: docsErr } = await supabase
        .from('documents')
        .select('*')
        .eq('candidate_id', candidate.id);

      if (docsErr) throw docsErr;
      const docsList: DocumentRecord[] = docsData || [];
      setDocuments(docsList);

      // 2. Fetch verifier profiles if any verified_by IDs exist
      const verifierIds = Array.from(
        new Set(
          docsList
            .map((d) => d.verified_by)
            .filter((id): id is string => Boolean(id))
        )
      );

      if (verifierIds.length > 0) {
        const { data: verifierProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', verifierIds);

        const vMap: Record<string, string> = {};
        (verifierProfiles || []).forEach((p) => {
          vMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
        });
        setVerifierMap(vMap);
      }

      // 3. Fetch mentors and active workload
      const { data: mentorProfiles, error: mErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'mentor')
        .eq('is_internal', true);

      if (mErr) throw mErr;

      const { data: activeAssignments } = await supabase
        .from('mentor_assignments')
        .select('mentor_id')
        .eq('active', true);

      const workloadCount: Record<string, number> = {};
      (activeAssignments || []).forEach((a) => {
        workloadCount[a.mentor_id] = (workloadCount[a.mentor_id] || 0) + 1;
      });

      const formattedMentors: MentorOption[] = (mentorProfiles || []).map((m) => ({
        id: m.id,
        name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email,
        email: m.email,
        activeCount: workloadCount[m.id] || 0,
      }));

      // Sort by workload ascending (mentors with fewest active candidates first)
      formattedMentors.sort((a, b) => a.activeCount - b.activeCount);
      setMentors(formattedMentors);
      if (formattedMentors.length > 0 && !selectedMentorId) {
        setSelectedMentorId(formattedMentors[0].id);
      }

      // 4. Fetch existing mentor proposal and speaking test schedule
      const { data: propData, error: propErr } = await supabase
        .from('mentor_proposals')
        .select('*')
        .eq('candidate_id', candidate.id)
        .eq('proposal_type', 'speaking_test')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (propErr) throw propErr;

      if (propData) {
        // Fetch schedule to get proposed_date and proposed_time
        const { data: schedData } = await supabase
          .from('speaking_test_schedules')
          .select('proposed_date, proposed_time')
          .eq('mentor_proposal_id', propData.id)
          .maybeSingle();

        // Fetch mentor name
        let mentorName = 'Assigned Mentor';
        if (propData.proposed_mentor_id) {
          const m = formattedMentors.find((x) => x.id === propData.proposed_mentor_id);
          if (m) {
            mentorName = m.name;
          } else {
            const { data: mProf } = await supabase
              .from('profiles')
              .select('first_name, last_name, email')
              .eq('id', propData.proposed_mentor_id)
              .maybeSingle();
            if (mProf) {
              mentorName = `${mProf.first_name || ''} ${mProf.last_name || ''}`.trim() || mProf.email;
            }
          }
        }

        setExistingProposal({
          id: propData.id,
          status: propData.status || 'pending',
          proposed_mentor_id: propData.proposed_mentor_id,
          proposed_mentor_name: mentorName,
          proposed_date: schedData?.proposed_date,
          proposed_time: schedData?.proposed_time,
          created_at: propData.created_at,
          approval_notes: propData.approval_notes,
          notes: propData.notes,
        });
      } else {
        setExistingProposal(null);
      }
    } catch (err: any) {
      console.error('Error loading document review data:', err);
      setErrorMessage(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [candidate?.id, isOpen]);

  if (!isOpen || !candidate) return null;

  // Compute verification stats across all 18 document types
  const mandatoryTypes = ALL_DOCUMENT_TYPES.filter((d) => d.is_mandatory);
  const mandatoryCount = mandatoryTypes.length;

  const docRecordMap: Record<string, DocumentRecord> = {};
  documents.forEach((d) => {
    docRecordMap[d.document_type] = d;
  });

  const verifiedMandatoryCount = mandatoryTypes.filter(
    (t) => docRecordMap[t.document_type]?.status === 'verified'
  ).length;

  const allMandatoryVerified = verifiedMandatoryCount >= mandatoryCount;
  const progressPct = Math.min(100, Math.round((verifiedMandatoryCount / mandatoryCount) * 100));

  // Handlers
  const handleVerify = async (docRecord: DocumentRecord, typeConfig: DocumentTypeConfig) => {
    if (!user) return;
    try {
      setProcessingDocId(docRecord.id);
      const now = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from('documents')
        .update({
          status: 'verified',
          verified_by: user.id,
          verified_at: now,
          rejection_reason: null,
        })
        .eq('id', docRecord.id);

      if (updateErr) throw updateErr;

      // Notify candidate if user_id exists
      if (candidate.user_id) {
        await supabase.from('notifications').insert({
          user_id: candidate.user_id,
          title: 'Document Verified',
          message: `${typeConfig.label} has been verified.`,
          type: 'document',
          read: false,
          sent_by: user.id,
        });
      }

      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error verifying document:', err);
      alert(`Failed to verify document: ${err.message}`);
    } finally {
      setProcessingDocId(null);
    }
  };

  const handleOpenRejectModal = (docRecord: DocumentRecord, typeConfig: DocumentTypeConfig) => {
    setRejectingDoc({ docId: docRecord.id, typeConfig });
    setRejectionReason('');
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !rejectingDoc || !rejectionReason.trim()) return;

    try {
      setProcessingDocId(rejectingDoc.docId);
      const now = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from('documents')
        .update({
          status: 'rejected',
          verified_by: user.id,
          verified_at: now,
          rejection_reason: rejectionReason.trim(),
          verification_notes: rejectionReason.trim(),
        })
        .eq('id', rejectingDoc.docId);

      if (updateErr) throw updateErr;

      // Notify candidate
      if (candidate.user_id) {
        await supabase.from('notifications').insert({
          user_id: candidate.user_id,
          title: 'Document Action Required',
          message: `${rejectingDoc.typeConfig.label} was not accepted (${rejectionReason.trim()}). Re-upload the document.`,
          type: 'document',
          read: false,
          sent_by: user.id,
        });
      }

      setRejectingDoc(null);
      setRejectionReason('');
      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error rejecting document:', err);
      alert(`Failed to reject document: ${err.message}`);
    } finally {
      setProcessingDocId(null);
    }
  };

  const handleUndo = async (docRecord: DocumentRecord) => {
    if (!user) return;
    try {
      setProcessingDocId(docRecord.id);

      const { error: updateErr } = await supabase
        .from('documents')
        .update({
          status: 'under_review',
          verified_by: null,
          verified_at: null,
          rejection_reason: null,
        })
        .eq('id', docRecord.id);

      if (updateErr) throw updateErr;

      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error undoing document verification:', err);
      alert(`Failed to update document: ${err.message}`);
    } finally {
      setProcessingDocId(null);
    }
  };

  // Submit Mentor Proposal
  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !candidate || !selectedMentorId || !proposedDate || !proposedTime) {
      alert('Select a mentor, date, and time.');
      return;
    }

    try {
      setSubmittingProposal(true);
      setErrorMessage(null);
      setProposalSuccessMsg(null);

      // 1. Insert mentor_proposals
      const { data: propData, error: propErr } = await supabase
        .from('mentor_proposals')
        .insert({
          proposed_by: user.id,
          candidate_id: candidate.id,
          proposed_mentor_id: selectedMentorId,
          proposal_type: 'speaking_test',
          status: 'pending',
          notes: leadNotes.trim() || null,
        })
        .select('id')
        .single();

      if (propErr) throw propErr;
      const proposalId = propData.id;

      // 2. Upsert academic_requests
      const { data: existingReq } = await supabase
        .from('academic_requests')
        .select('id')
        .eq('candidate_id', candidate.id)
        .eq('request_type', 'speaking_test')
        .maybeSingle();

      let academicRequestId = existingReq?.id;

      if (existingReq) {
        const { error: reqUpdErr } = await supabase
          .from('academic_requests')
          .update({
            approval_status: 'pending',
            notes: leadNotes.trim() || null,
            requested_by: user.id,
            status: 'pending_assignment',
          })
          .eq('id', existingReq.id);
        if (reqUpdErr) throw reqUpdErr;
      } else {
        const { data: newReq, error: reqInsErr } = await supabase
          .from('academic_requests')
          .insert({
            candidate_id: candidate.id,
            request_type: 'speaking_test',
            requested_by: user.id,
            status: 'pending_assignment',
            approval_status: 'pending',
            notes: leadNotes.trim() || null,
          })
          .select('id')
          .single();
        if (reqInsErr) throw reqInsErr;
        academicRequestId = newReq.id;
      }

      // 3. Insert speaking_test_schedules
      const { error: schedErr } = await supabase.from('speaking_test_schedules').insert({
        candidate_id: candidate.id,
        academic_request_id: academicRequestId,
        mentor_proposal_id: proposalId,
        proposed_by: user.id,
        mentor_id: selectedMentorId,
        proposed_date: proposedDate,
        proposed_time: proposedTime,
        duration_minutes: 45,
        status: 'proposed',
      });

      if (schedErr) throw schedErr;

      // 4. Notify Academic Lead(s)
      const { data: academicLeads } = await supabase
        .from('profiles')
        .select('id')
        .eq('internal_role', 'academic_lead');

      const selectedMentorObj = mentors.find((m) => m.id === selectedMentorId);
      const mentorDisplayName = selectedMentorObj?.name || 'Proposed Mentor';
      const candidateDisplayName = `${candidate.first_name} ${candidate.last_name}`.trim();

      if (academicLeads && academicLeads.length > 0) {
        const notifs = academicLeads.map((lead) => ({
          user_id: lead.id,
          title: 'Mentor Proposal Awaiting Approval',
          message: `${mentorDisplayName} proposed for ${candidateDisplayName}'s Speaking Test on ${proposedDate} at ${proposedTime} — review and approve.`,
          type: 'academic',
          read: false,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifs);
      }

      setProposalSuccessMsg('Proposal submitted. The Academic Lead will review and confirm.');
      await loadData();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Error submitting mentor proposal:', err);
      setErrorMessage(`Failed to submit proposal: ${err.message}`);
    } finally {
      setSubmittingProposal(false);
    }
  };

  const scrollToProposalForm = () => {
    if (proposalFormRef.current) {
      proposalFormRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* HEADER */}
        <div className="px-6 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-[#1B3270]">
                {candidate.first_name} {candidate.last_name} — Document Review
              </h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-slate-200 text-slate-700">
                #{candidate.id.slice(0, 6).toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify uploaded documents. All mandatory documents must be verified before a mentor can be proposed.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin" />
              <p className="text-xs text-slate-500 font-medium">Loading candidate documents...</p>
            </div>
          ) : (
            <>
              {/* TOP: VERIFICATION PROGRESS BAR */}
              <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Mandatory Verification Progress
                    </span>
                  </div>
                  <span className="text-xs font-bold text-[#1B3270]">
                    {verifiedMandatoryCount} / {mandatoryCount} mandatory documents verified ({progressPct}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* READINESS CHECK CARD (When all mandatory docs verified) */}
              {allMandatoryVerified && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-[10px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in">
                  <div className="flex items-start space-x-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-emerald-900">
                        All required documents verified
                      </h4>
                      <p className="text-emerald-700 mt-0.5">
                        You can now propose a mentor and schedule the Speaking Test.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={scrollToProposalForm}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] font-semibold flex items-center space-x-1.5 transition-colors shrink-0 shadow-2xs self-start sm:self-auto cursor-pointer"
                  >
                    <span>Proceed to Mentor Proposal</span>
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* DOCUMENT LIST: ALL 18 TYPES */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Document Checklist (18 Total)
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Mandatory: {mandatoryCount} • Optional: {ALL_DOCUMENT_TYPES.length - mandatoryCount}
                  </span>
                </div>

                <div className="bg-white border border-[#E2E8F4] rounded-[10px] divide-y divide-[#E2E8F4] overflow-hidden shadow-2xs">
                  {ALL_DOCUMENT_TYPES.map((typeConfig) => {
                    const record = docRecordMap[typeConfig.document_type];
                    const hasFile = Boolean(record?.file_url);
                    const status = record?.status || (hasFile ? 'pending' : 'not_uploaded');
                    const isProcessing = processingDocId === record?.id;
                    const verifierName = record?.verified_by ? verifierMap[record.verified_by] || 'RM' : '';

                    return (
                      <div
                        key={typeConfig.document_type}
                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#F8FAFD]/50 transition-colors"
                      >
                        {/* LEFT: Label, Notes helper, Mandatory/Optional Badge */}
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-[14px] font-medium text-[#1B3270]">
                              {typeConfig.label}
                            </span>
                            {typeConfig.is_mandatory ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Mandatory
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Optional
                              </span>
                            )}
                          </div>
                          {typeConfig.notes && (
                            <p className="text-[12px] text-[#94A3B8]">{typeConfig.notes}</p>
                          )}
                          {/* File link if uploaded */}
                          {hasFile && record?.file_url && (
                            <div className="pt-0.5">
                              <a
                                href={record.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#1B3270] hover:text-[#2952A3] hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>View Uploaded File</span>
                              </a>
                            </div>
                          )}
                        </div>

                        {/* CENTER: Status Badge */}
                        <div className="shrink-0 flex items-center">
                          {status === 'verified' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Verified</span>
                            </span>
                          )}
                          {status === 'rejected' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Rejected</span>
                            </span>
                          )}
                          {status === 'under_review' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Under Review</span>
                            </span>
                          )}
                          {status === 'pending' && hasFile && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pending Review</span>
                            </span>
                          )}
                          {(!hasFile || status === 'not_uploaded') && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Not Uploaded
                            </span>
                          )}
                        </div>

                        {/* RIGHT: Actions */}
                        <div className="shrink-0 flex items-center justify-end">
                          {/* Case 1: File exists and status IN ('pending', 'under_review') */}
                          {hasFile && record && ['pending', 'under_review'].includes(status) && (
                            <div className="flex items-center space-x-2">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleVerify(record, typeConfig)}
                                className="px-3 py-1 bg-white border border-emerald-600 hover:bg-emerald-50 text-emerald-700 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors inline-flex items-center space-x-1"
                              >
                                {isProcessing ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                                <span>Verify</span>
                              </button>

                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleOpenRejectModal(record, typeConfig)}
                                className="px-3 py-1 bg-white border border-rose-600 hover:bg-rose-50 text-rose-700 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors inline-flex items-center space-x-1"
                              >
                                <X className="w-3 h-3" />
                                <span>Reject</span>
                              </button>
                            </div>
                          )}

                          {/* Case 2: Status = 'verified' */}
                          {status === 'verified' && record && (
                            <div className="text-right text-xs space-y-0.5">
                              <div className="text-emerald-700 font-medium">
                                Verified by {verifierName || 'RM'} on{' '}
                                {record.verified_at
                                  ? new Date(record.verified_at).toLocaleDateString()
                                  : 'recently'}
                              </div>
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleUndo(record)}
                                className="text-[11px] text-slate-400 hover:text-slate-700 underline font-medium cursor-pointer inline-flex items-center space-x-1"
                              >
                                {isProcessing && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                <span>Undo</span>
                              </button>
                            </div>
                          )}

                          {/* Case 3: Status = 'rejected' */}
                          {status === 'rejected' && record && (
                            <div className="text-right text-xs max-w-xs">
                              <div className="text-rose-700 font-medium">
                                Rejected: {record.rejection_reason || 'Document does not meet criteria'}
                              </div>
                              <div className="text-[11px] text-slate-400 italic">
                                Awaiting re-upload from candidate
                              </div>
                            </div>
                          )}

                          {/* Case 4: No file_url */}
                          {!hasFile && (
                            <span className="text-xs text-slate-400 italic">
                              Not uploaded yet
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MENTOR PROPOSAL FORM / STATUS CARD (Part 4) */}
              {allMandatoryVerified && (
                <div
                  ref={proposalFormRef}
                  className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-5"
                >
                  <div className="border-b border-[#E2E8F4] pb-3">
                    <h3 className="text-sm font-bold text-[#1B3270]">
                      Propose Mentor & Schedule Speaking Test
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Your proposal will be reviewed and approved by the Academic Lead.
                    </p>
                  </div>

                  {/* Existing Proposal Display */}
                  {existingProposal && existingProposal.status !== 'rejected' ? (
                    <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 text-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          Proposal Status:
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                            existingProposal.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {existingProposal.status === 'approved'
                            ? 'Approved by Academic Lead'
                            : 'Pending Academic Lead Approval'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                        <div>
                          <span className="text-slate-400">Proposed Mentor: </span>
                          <span className="font-semibold">{existingProposal.proposed_mentor_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Proposed Schedule: </span>
                          <span className="font-semibold">
                            {existingProposal.proposed_date || 'Date pending'} at{' '}
                            {existingProposal.proposed_time || 'Time pending'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Submitted: </span>
                          <span>{new Date(existingProposal.created_at).toLocaleDateString()}</span>
                        </div>
                        {existingProposal.notes && (
                          <div className="sm:col-span-2">
                            <span className="text-slate-400">Notes for Lead: </span>
                            <span>{existingProposal.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {existingProposal?.status === 'rejected' && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-xs text-rose-800 space-y-1">
                          <div className="font-bold flex items-center space-x-1.5">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                            <span>Previous Proposal Rejected by Academic Lead</span>
                          </div>
                          <p>
                            Reason:{' '}
                            <span className="font-medium">
                              {existingProposal.approval_notes || 'No reason specified'}
                            </span>
                          </p>
                          <p className="text-rose-600 text-[11px]">
                            Please submit a revised proposal below:
                          </p>
                        </div>
                      )}

                      {proposalSuccessMsg && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-[8px] text-xs text-emerald-800 flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>{proposalSuccessMsg}</span>
                        </div>
                      )}

                      {errorMessage && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-xs text-rose-800">
                          {errorMessage}
                        </div>
                      )}

                      <form onSubmit={handleSubmitProposal} className="space-y-4 text-xs">
                        {/* Mentor Dropdown */}
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Select Mentor
                          </label>
                          <select
                            value={selectedMentorId}
                            onChange={(e) => setSelectedMentorId(e.target.value)}
                            required
                            className="w-full p-2 border border-[#E2E8F4] rounded-[6px] text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                          >
                            <option value="">— Select an internal mentor —</option>
                            {mentors.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} — {m.activeCount} active candidates
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Date & Time Pickers */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Proposed Date
                            </label>
                            <input
                              type="date"
                              min={todayStr}
                              value={proposedDate}
                              onChange={(e) => setProposedDate(e.target.value)}
                              required
                              className="w-full p-2 border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Proposed Time
                            </label>
                            <input
                              type="time"
                              value={proposedTime}
                              onChange={(e) => setProposedTime(e.target.value)}
                              required
                              className="w-full p-2 border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-slate-700 mb-1">
                              Duration
                            </label>
                            <input
                              type="text"
                              value="45 minutes"
                              disabled
                              className="w-full p-2 border border-[#E2E8F4] bg-slate-50 rounded-[6px] text-slate-500 cursor-not-allowed"
                            />
                          </div>
                        </div>

                        {/* Notes for Academic Lead */}
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            Notes for Academic Lead (Optional)
                          </label>
                          <textarea
                            rows={3}
                            value={leadNotes}
                            onChange={(e) => setLeadNotes(e.target.value)}
                            placeholder="Special focus clinical areas, candidate timezone preferences..."
                            className="w-full p-2 border border-[#E2E8F4] rounded-[6px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                          />
                        </div>

                        <div className="flex justify-end pt-2">
                          <button
                            type="submit"
                            disabled={submittingProposal}
                            className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white font-semibold rounded-[6px] shadow-2xs flex items-center space-x-2 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {submittingProposal ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                            <span>Submit Proposal</span>
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* FOOTER */}
        <div className="px-6 py-3.5 border-t border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            {allMandatoryVerified
              ? 'All required documents verified. Ready for scheduling.'
              : `${mandatoryCount - verifiedMandatoryCount} mandatory documents pending verification.`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 border border-[#E2E8F4] bg-white hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
          >
            Close Panel
          </button>
        </div>
      </div>

      {/* REJECTION MODAL */}
      {rejectingDoc && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Reject Document: {rejectingDoc.typeConfig.label}
              </h3>
              <button
                type="button"
                onClick={() => setRejectingDoc(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Please enter the specific reason for rejecting this document. This note will be sent directly to the candidate so they can rectify and re-upload.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Scanned copy is illegible; Missing official hospital seal; Incomplete pages..."
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setRejectingDoc(null)}
                  className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!rejectionReason.trim()}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
