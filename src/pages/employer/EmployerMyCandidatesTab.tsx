import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Check,
  AlertCircle,
  Video,
  Building2,
  Phone,
  Calendar,
  MessageSquare,
  CheckCircle2,
  X,
  UserCheck,
} from 'lucide-react';
import { getCandidateDisplay } from '../../utils/anonymization';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../utils/formatters';
import { notifyByRole } from '../../utils/notificationRouting';
import { MultiSelectFilter } from '../../components/ui/MultiSelectFilter';

interface EmployerMyCandidatesTabProps {
  employer: any;
  initialCandidateId?: string | null;
  onClearCandidateFilter?: () => void;
}

const REJECTION_REASONS = [
  'Not the right fit for this role',
  'Overqualified',
  'Underqualified',
  'Language level insufficient',
  'Interview performance',
  'Role filled by another candidate',
  'Other',
];

export const EmployerMyCandidatesTab: React.FC<EmployerMyCandidatesTabProps> = ({
  employer,
  initialCandidateId = null,
  onClearCandidateFilter,
}) => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [jobFilters, setJobFilters] = useState<string[]>([]);
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [candidateFilterId, setCandidateFilterId] = useState<string | null>(initialCandidateId);

  const jobOptions = useMemo(() => {
    return jobs.map((j) => ({
      value: j.id,
      label: j.title,
    }));
  }, [jobs]);

  const statusOptions = useMemo(() => [
    { value: 'applied', label: 'Applied' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'interview_scheduled', label: 'Interview Scheduled' },
    { value: 'interviewed', label: 'Interviewed' },
    { value: 'selected', label: 'Selected' },
    { value: 'offer_sent', label: 'Offer Sent' },
    { value: 'reveal_gate', label: 'Reveal Process' },
    { value: 'placed', label: 'Placed' },
    { value: 'rejected', label: 'Not Progressed' },
  ], []);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(true);
  const [assignedRm, setAssignedRm] = useState<any | null>(null);

  // Row Expansion state (for interview notes & feedback)
  const [expandedAppIds, setExpandedAppIds] = useState<Set<string>>(new Set());

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);

  // --- MODAL STATES ---
  // 1. Interview Scheduling Modal
  const [schedulingApp, setSchedulingApp] = useState<any | null>(null);
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [interviewDate, setInterviewDate] = useState('');
  const [interviewTime, setInterviewTime] = useState('10:00');
  const [interviewFormat, setInterviewFormat] = useState<'video' | 'in_person' | 'phone'>('video');
  const [interviewNotes, setInterviewNotes] = useState('');
  const [submittingSchedule, setSubmittingSchedule] = useState(false);

  // 2. Rejection Modal
  const [rejectingApp, setRejectingApp] = useState<any | null>(null);
  const [rejectionReasonType, setRejectionReasonType] = useState(REJECTION_REASONS[0]);
  const [customRejectionReason, setCustomRejectionReason] = useState('');
  const [submittingRejection, setSubmittingRejection] = useState(false);

  // 3. Interview Feedback Modal
  const [feedbackApp, setFeedbackApp] = useState<any | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackNextStep, setFeedbackNextStep] = useState<'selected' | 'rejected'>('selected');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // 4. Reveal Process Modal
  const [revealApp, setRevealApp] = useState<any | null>(null);

  // 5. Placement Details Modal
  const [placementApp, setPlacementApp] = useState<any | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const toggleRowExpansion = (appId: string) => {
    setExpandedAppIds((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  };

  const notifyEmployerRm = async (title: string, message: string) => {
    if (assignedRm?.id) {
      await supabase.from('notifications').insert({
        user_id: assignedRm.id,
        type: 'general',
        title,
        message,
      });
    } else {
      await notifyByRole(
        supabase,
        'employer_requirements_rm',
        title,
        message,
        'general'
      );
    }
  };

  const fetchCandidatesData = async () => {
    if (!employer?.id) return;
    try {
      setLoading(true);

      // 1. Fetch employer's jobs for filter dropdown
      const { data: employerJobs } = await supabase
        .from('job_requirements')
        .select('id, title, role_type')
        .eq('employer_id', employer.id)
        .order('created_at', { ascending: false });

      setJobs(employerJobs || []);

      // 1b. Fetch assigned RM details
      const { data: rmData } = await supabase
        .from('rm_assignments')
        .select(`
          rm_profile_id,
          profiles:rm_profile_id (id, full_name, email)
        `)
        .eq('entity_type', 'employer')
        .eq('entity_id', employer.id)
        .eq('active', true)
        .maybeSingle();

      if (rmData?.profiles) {
        setAssignedRm(rmData.profiles);
      }

      const jobIds = (employerJobs || []).map((j) => j.id);

      if (jobIds.length === 0) {
        setApplications([]);
        return;
      }

      // 2. Fetch job_applications with candidate & requirement details
      let query = supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          job_id,
          supplier_id,
          submitted_by,
          status,
          fit_score,
          interview_date,
          interview_time,
          interview_format,
          interview_notes,
          employer_feedback,
          feedback_submitted_at,
          rejection_reason,
          rejected_at,
          reveal_gate_conditions,
          updated_at,
          created_at,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            user_id,
            email,
            supplier_id,
            suppliers:supplier_id (company_name, user_id)
          ),
          job_requirements!inner (
            id,
            title,
            role_type
          )
        `)
        .in('job_id', jobIds)
        .order('updated_at', { ascending: false });

      const { data: appsData, error: appsErr } = await query;

      if (appsErr) {
        console.error('Error fetching applications:', appsErr);
        setApplications([]);
      } else {
        setApplications(appsData || []);
      }
    } catch (err) {
      console.error('Unexpected error loading employer candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidatesData();
  }, [employer?.id]);

  useEffect(() => {
    if (initialCandidateId) {
      setCandidateFilterId(initialCandidateId);
    }
  }, [initialCandidateId]);

  const displayedApplications = useMemo(() => {
    return applications.filter((app) => {
      if (candidateFilterId && app.candidate_id !== candidateFilterId) {
        return false;
      }
      if (jobFilters.length > 0 && !jobFilters.includes(app.job_id)) {
        return false;
      }
      if (statusFilters.length > 0 && !statusFilters.includes(app.status)) {
        return false;
      }
      return true;
    });
  }, [applications, candidateFilterId, jobFilters, statusFilters]);

  const calculateDaysSinceUpdate = (updatedAt: string) => {
    const diffMs = new Date().getTime() - new Date(updatedAt).getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return days <= 0 ? 0 : days;
  };

  const getFormatIcon = (format?: string | null) => {
    switch (format) {
      case 'in_person':
        return <Building2 size={12} className="text-slate-500" />;
      case 'phone':
        return <Phone size={12} className="text-slate-500" />;
      case 'video':
      default:
        return <Video size={12} className="text-blue-500" />;
    }
  };

  const getFormatLabel = (format?: string | null) => {
    switch (format) {
      case 'in_person':
        return 'In-person';
      case 'phone':
        return 'Phone call';
      case 'video':
      default:
        return 'Video call';
    }
  };

  // --- STAGE TRANSITION ACTIONS ---

  // 1. Move to Shortlisted
  const handleMoveToShortlisted = async (app: any) => {
    try {
      setUpdatingAppId(app.id);
      const { error } = await supabase
        .from('job_applications')
        .update({
          status: 'shortlisted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', app.id);

      if (error) throw error;
      showToast('Candidate moved to Shortlisted.');
      await fetchCandidatesData();
    } catch (err: any) {
      console.error('Error shortlisting candidate:', err);
      alert(err.message || 'Failed to move candidate to Shortlisted.');
    } finally {
      setUpdatingAppId(null);
    }
  };

  // 2. Open Interview Scheduling Modal (new schedule or edit)
  const handleOpenScheduleModal = (app: any, isEdit = false) => {
    setSchedulingApp(app);
    setIsEditingSchedule(isEdit);
    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    if (isEdit && app.interview_date) {
      setInterviewDate(app.interview_date);
      setInterviewTime(app.interview_time || '10:00');
      setInterviewFormat(app.interview_format || 'video');
      setInterviewNotes(app.interview_notes || '');
    } else {
      setInterviewDate(tomorrowStr);
      setInterviewTime('10:00');
      setInterviewFormat('video');
      setInterviewNotes('');
    }
  };

  // 2b. Confirm Interview Schedule
  const handleConfirmSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingApp || !interviewDate || !interviewTime) return;

    try {
      setSubmittingSchedule(true);
      const jobTitle = schedulingApp.job_requirements?.title || 'Position';
      const anonId = `Candidate #${schedulingApp.candidate_id.substring(0, 6).toUpperCase()}`;
      const formatText = getFormatLabel(interviewFormat);

      // 1. Update job_applications
      const { error: updateErr } = await supabase
        .from('job_applications')
        .update({
          status: 'interview_scheduled',
          interview_date: interviewDate,
          interview_time: interviewTime,
          interview_format: interviewFormat,
          interview_notes: interviewNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', schedulingApp.id);

      if (updateErr) throw updateErr;

      // 2. Notify Employer RM
      await notifyEmployerRm(
        'Interview Scheduled',
        `Employer has scheduled interview with ${anonId} for ${jobTitle} on ${interviewDate} at ${interviewTime} (${formatText}).`
      );

      // 3. Notify Candidate (if registered profile user_id exists)
      const candUserId = schedulingApp.candidates?.user_id;
      if (candUserId) {
        await supabase.from('notifications').insert({
          user_id: candUserId,
          type: 'general',
          title: 'Interview Scheduled',
          message: `Your interview for ${jobTitle} has been scheduled for ${interviewDate} at ${interviewTime} via ${formatText}.${
            interviewNotes.trim() ? ` Instructions: ${interviewNotes.trim()}` : ''
          }`,
        });
      }

      setSchedulingApp(null);
      showToast(
        isEditingSchedule
          ? 'Interview schedule updated.'
          : 'Interview scheduled. Candidate name is now unlocked for interview coordination.'
      );
      await fetchCandidatesData();
    } catch (err: any) {
      console.error('Error scheduling interview:', err);
      alert(err.message || 'Failed to schedule interview.');
    } finally {
      setSubmittingSchedule(false);
    }
  };

  // 3. Mark as Interviewed
  const handleMarkInterviewed = async (app: any) => {
    try {
      setUpdatingAppId(app.id);
      const { error } = await supabase
        .from('job_applications')
        .update({
          status: 'interviewed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', app.id);

      if (error) throw error;

      // Prompt feedback immediately
      showToast('Candidate marked as Interviewed.');
      await fetchCandidatesData();
      setFeedbackApp(app);
      setFeedbackText('');
      setFeedbackNextStep('selected');
    } catch (err: any) {
      console.error('Error updating status to interviewed:', err);
      alert(err.message || 'Failed to update status.');
    } finally {
      setUpdatingAppId(null);
    }
  };

  // 4. Open Interview Feedback Modal
  const handleOpenFeedbackModal = (app: any) => {
    setFeedbackApp(app);
    setFeedbackText(app.employer_feedback || '');
    setFeedbackNextStep('selected');
  };

  // 4b. Confirm Interview Feedback
  const handleConfirmFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackApp) return;
    if (feedbackText.trim().length < 30) {
      alert('Overall impression must be at least 30 characters.');
      return;
    }

    try {
      setSubmittingFeedback(true);
      const jobTitle = feedbackApp.job_requirements?.title || 'Position';
      const anonId = `Candidate #${feedbackApp.candidate_id.substring(0, 6).toUpperCase()}`;

      // 1. Update feedback in job_applications
      const updates: any = {
        employer_feedback: feedbackText.trim(),
        feedback_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (feedbackNextStep === 'selected') {
        updates.status = 'selected';
      }

      const { error: updateErr } = await supabase
        .from('job_applications')
        .update(updates)
        .eq('id', feedbackApp.id);

      if (updateErr) throw updateErr;

      // 2. Notify RM of feedback
      await notifyEmployerRm(
        'Interview Feedback Submitted',
        `Employer has submitted interview feedback for ${anonId} (${jobTitle}). Decision: ${
          feedbackNextStep === 'selected' ? 'Selected' : 'Not Progressed'
        }.`
      );

      // If Next Step is "selected", also notify RM of candidate selection
      if (feedbackNextStep === 'selected') {
        await notifyEmployerRm(
          'Candidate Selected',
          `${anonId} has been selected for ${jobTitle}.`
        );
      }

      const currentApp = feedbackApp;
      setFeedbackApp(null);

      if (feedbackNextStep === 'rejected') {
        // Trigger rejection flow directly
        setRejectingApp(currentApp);
        setRejectionReasonType('Interview performance');
        setCustomRejectionReason('');
      } else {
        showToast('Feedback saved and candidate moved to Selected.');
      }

      await fetchCandidatesData();
    } catch (err: any) {
      console.error('Error saving feedback:', err);
      alert(err.message || 'Failed to save feedback.');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  // 5. Move to Selected
  const handleMoveToSelected = async (app: any) => {
    try {
      setUpdatingAppId(app.id);
      const jobTitle = app.job_requirements?.title || 'Position';
      const anonId = `Candidate #${app.candidate_id.substring(0, 6).toUpperCase()}`;

      const { error } = await supabase
        .from('job_requirements')
        .update({
          status: 'selected',
          updated_at: new Date().toISOString(),
        })
        .eq('id', app.id);

      if (error) {
        // Fallback update directly to job_applications
        const { error: appErr } = await supabase
          .from('job_applications')
          .update({
            status: 'selected',
            updated_at: new Date().toISOString(),
          })
          .eq('id', app.id);
        if (appErr) throw appErr;
      }

      await notifyEmployerRm(
        'Candidate Selected',
        `${anonId} has been selected for ${jobTitle}.`
      );

      showToast('Candidate moved to Selected.');
      await fetchCandidatesData();
    } catch (err: any) {
      console.error('Error selecting candidate:', err);
      alert(err.message || 'Failed to move candidate to Selected.');
    } finally {
      setUpdatingAppId(null);
    }
  };

  // 6. Send Offer
  const handleSendOffer = async (app: any) => {
    try {
      setUpdatingAppId(app.id);
      const jobTitle = app.job_requirements?.title || 'Position';
      const anonId = `Candidate #${app.candidate_id.substring(0, 6).toUpperCase()}`;

      const { error } = await supabase
        .from('job_applications')
        .update({
          status: 'offer_sent',
          updated_at: new Date().toISOString(),
        })
        .eq('id', app.id);

      if (error) throw error;

      await notifyEmployerRm(
        'Offer Sent to Candidate',
        `Offer sent to ${anonId} for ${jobTitle}. Initiate the reveal process when ready.`
      );

      showToast('Offer sent. You can now begin the Reveal Process when ready.');
      await fetchCandidatesData();
    } catch (err: any) {
      console.error('Error sending offer:', err);
      alert(err.message || 'Failed to update status to Offer Sent.');
    } finally {
      setUpdatingAppId(null);
    }
  };

  // 7. Begin Reveal Process
  const handleBeginRevealProcess = async (app: any) => {
    try {
      setUpdatingAppId(app.id);
      const jobTitle = app.job_requirements?.title || 'Position';
      const candObj = app.candidates || { id: app.candidate_id };
      const displayInfo = getCandidateDisplay(candObj, 'reveal_gate');

      const { error } = await supabase
        .from('job_applications')
        .update({
          status: 'reveal_gate',
          updated_at: new Date().toISOString(),
        })
        .eq('id', app.id);

      if (error) throw error;

      await notifyEmployerRm(
        'Reveal Process Initiated',
        `${employer?.company_name || 'Employer'} has initiated the reveal process for Candidate ${
          displayInfo.display
        } for ${jobTitle}. Coordinate the three conditions: offer letter, deposit, and candidate consent.`
      );

      showToast('Reveal Process initiated. Our team has been notified.');
      await fetchCandidatesData();

      // Open Reveal Process panel for this app
      setRevealApp({ ...app, status: 'reveal_gate' });
    } catch (err: any) {
      console.error('Error initiating reveal process:', err);
      alert(err.message || 'Failed to initiate reveal process.');
    } finally {
      setUpdatingAppId(null);
    }
  };

  // 8. Open Rejection Modal
  const handleOpenRejectionModal = (app: any) => {
    setRejectingApp(app);
    setRejectionReasonType(REJECTION_REASONS[0]);
    setCustomRejectionReason('');
  };

  // 8b. Confirm Rejection ("Not Progressed")
  const handleConfirmRejection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingApp) return;

    try {
      setSubmittingRejection(true);
      const jobTitle = rejectingApp.job_requirements?.title || 'Position';
      const anonId = `Candidate #${rejectingApp.candidate_id.substring(0, 6).toUpperCase()}`;
      const finalReason =
        rejectionReasonType === 'Other'
          ? customRejectionReason.trim()
          : rejectionReasonType;

      // 1. UPDATE job_applications
      const { error: updateErr } = await supabase
        .from('job_applications')
        .update({
          status: 'rejected',
          rejection_reason: finalReason || null,
          rejected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', rejectingApp.id);

      if (updateErr) throw updateErr;

      // 2. Notify Employer RM with reason
      await notifyEmployerRm(
        'Candidate Not Progressed',
        `Employer has moved ${anonId} to Not Progressed for ${jobTitle}. Reason: ${
          finalReason || 'Not provided'
        }.`
      );

      // 3. Notify Candidate (if registered) — Never show reason
      const candUserId = rejectingApp.candidates?.user_id;
      if (candUserId) {
        await supabase.from('notifications').insert({
          user_id: candUserId,
          type: 'general',
          title: 'Application Update',
          message: `Your application for ${jobTitle} has not progressed at this time.`,
        });
      }

      // 4. Notify Supplier (if supplier_id exists)
      const supplierUserId = rejectingApp.candidates?.suppliers?.user_id;
      const candName = `${rejectingApp.candidates?.first_name || ''} ${
        rejectingApp.candidates?.last_name || ''
      }`.trim() || anonId;

      if (supplierUserId) {
        await supabase.from('notifications').insert({
          user_id: supplierUserId,
          type: 'general',
          title: 'Application Update',
          message: `Candidate ${candName}'s application for ${jobTitle} has not progressed.`,
        });
      }

      setRejectingApp(null);
      showToast('Candidate moved to Not Progressed.');
      await fetchCandidatesData();
    } catch (err: any) {
      console.error('Error rejecting candidate:', err);
      alert(err.message || 'Failed to move candidate to Not Progressed.');
    } finally {
      setSubmittingRejection(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'shortlisted':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#7EB3E8]/20 text-[#2952A3] border border-[#7EB3E8]/30 capitalize whitespace-nowrap">
            Shortlisted
          </span>
        );
      case 'interview_scheduled':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 capitalize whitespace-nowrap">
            Interview Scheduled
          </span>
        );
      case 'interviewed':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#7C3AED]/15 text-[#7C3AED] border border-[#7C3AED]/30 capitalize whitespace-nowrap">
            Interviewed
          </span>
        );
      case 'selected':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 capitalize whitespace-nowrap">
            Selected
          </span>
        );
      case 'offer_sent':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 capitalize whitespace-nowrap">
            Offer Sent
          </span>
        );
      case 'reveal_gate':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#1B3270] text-white capitalize whitespace-nowrap">
            Reveal Process
          </span>
        );
      case 'placed':
        return (
          <span className="px-2.5 py-0.5 rounded-[4px] text-[11px] font-medium bg-[#F0FDF4] text-[#166534] capitalize whitespace-nowrap flex items-center space-x-1">
            <Check size={11} />
            <span>Placed</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 capitalize whitespace-nowrap">
            Not Progressed
          </span>
        );
      case 'applied':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-[#4A5568] border border-gray-200 capitalize whitespace-nowrap">
            Applied
          </span>
        );
    }
  };

  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* PIPELINE STAGE GUIDE (Collapsible Info Box) */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-[0_1px_4px_rgba(27,50,112,0.08)] overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen(!guideOpen)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-[#F8FAFD] transition-colors cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <Info size={16} className="text-[#2952A3]" />
            <span className="text-xs font-bold text-[#1B3270] uppercase tracking-wider">
              Candidate Pipeline Stages
            </span>
          </div>
          {guideOpen ? (
            <ChevronUp size={15} className="text-[#94A3B8]" />
          ) : (
            <ChevronDown size={15} className="text-[#94A3B8]" />
          )}
        </button>

        {guideOpen && (
          <div className="px-6 pb-4 pt-1 border-t border-[#E2E8F4] text-xs text-[#4A5568] bg-[#F8FAFD]/50 space-y-1">
            <p className="font-semibold text-[#1B3270] leading-relaxed flex flex-wrap items-center gap-1.5">
              <span>Applied</span>
              <span className="text-[#94A3B8]">→</span>
              <span>Shortlisted</span>
              <span className="text-[#94A3B8]">→</span>
              <span>Interview Scheduled</span>
              <span className="text-[#94A3B8]">→</span>
              <span>Interviewed</span>
              <span className="text-[#94A3B8]">→</span>
              <span>Selected</span>
              <span className="text-[#94A3B8]">→</span>
              <span>Offer Sent</span>
              <span className="text-[#94A3B8]">→</span>
              <span>Reveal Process</span>
              <span className="text-[#94A3B8]">→</span>
              <span className="text-emerald-700 font-bold">Placed</span>
            </p>
            <p className="text-[11px] text-[#94A3B8]">
              Candidate identities are anonymized (Level 1) until an interview is scheduled (Level 2 Light Reveal: full name unlocked). At the Reveal Process stage, TerraTern coordinates the offer letter, deposit, and candidate consent before formal placement.
            </p>
          </div>
        )}
      </div>

      {/* TOP FILTER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
        <div>
          <h3 className="text-sm font-bold text-[#1B3270]">Candidate Pipeline</h3>
          <p className="text-xs text-[#94A3B8]">
            Manage application progressions, schedule interviews, record feedback, and track reveal gate conditions.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="w-full sm:w-56">
            <MultiSelectFilter
              label="Requirement"
              options={jobOptions}
              selectedValues={jobFilters}
              onChange={setJobFilters}
            />
          </div>
          <div className="w-full sm:w-52">
            <MultiSelectFilter
              label="Stage"
              options={statusOptions}
              selectedValues={statusFilters}
              onChange={setStatusFilters}
            />
          </div>
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
            Showing {displayedApplications.length} of {applications.length}
          </span>
        </div>
      </div>

      {/* FILTERED CANDIDATE ACTIVE INDICATOR */}
      {candidateFilterId && (
        <div className="flex items-center justify-between bg-[#7EB3E8]/15 border border-[#7EB3E8]/40 px-4 py-2.5 rounded-[8px] text-xs text-[#1B3270]">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#1B3270]" />
            <span>
              Filtered by candidate: <strong>Candidate #{candidateFilterId.substring(0, 6).toUpperCase()}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setCandidateFilterId(null);
              onClearCandidateFilter?.();
            }}
            className="text-xs font-semibold text-[#1B3270] hover:underline cursor-pointer"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* CANDIDATES TABLE / EMPTY STATE */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
        </div>
      ) : displayedApplications.length === 0 ? (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
          <EmptyState
            title={candidateFilterId ? "No matching application found" : "No applications yet"}
            subtitle={
              candidateFilterId
                ? "This candidate has not yet been submitted or assigned to a specific job requirement."
                : "Applications submitted to your requirements will appear here."
            }
          />
        </div>
      ) : (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-[0_1px_4px_rgba(27,50,112,0.08)] overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F4] text-[#94A3B8] font-semibold uppercase tracking-wider bg-[#F8FAFD]/50">
                <th className="py-3.5 px-4">Candidate</th>
                <th className="py-3.5 px-4">Job Requirement</th>
                <th className="py-3.5 px-4">Role Type</th>
                <th className="py-3.5 px-4">Current Stage</th>
                <th className="py-3.5 px-4">Interview Details</th>
                <th className="py-3.5 px-4">Last Updated</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F4]">
              {displayedApplications.map((app) => {
                const candObj = app.candidates || { id: app.candidate_id };
                const displayInfo = getCandidateDisplay(candObj, app.status);
                const daysSinceUpdate = calculateDaysSinceUpdate(app.updated_at);
                const isExpanded = expandedAppIds.has(app.id);
                const hasFeedback = Boolean(app.employer_feedback);

                return (
                  <React.Fragment key={app.id}>
                    <tr
                      className={`hover:bg-[#F8FAFD] transition-colors ${
                        isExpanded ? 'bg-[#F8FAFD]/40' : ''
                      }`}
                    >
                      {/* 1. Candidate Identity (Level 1/2/3 Anonymization) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div>
                          <div className="font-bold text-[#1B3270]">
                            {displayInfo.display}
                          </div>
                          {displayInfo.label && (
                            <div
                              className={`text-[10px] font-medium ${
                                displayInfo.level === 3
                                  ? 'text-emerald-700'
                                  : 'text-indigo-700'
                              }`}
                            >
                              {displayInfo.label}
                            </div>
                          )}
                          {displayInfo.level === 3 && (
                            <div className="text-[10px] text-slate-500 space-y-0.5 mt-0.5">
                              {displayInfo.email && <div>Email: {displayInfo.email}</div>}
                              {displayInfo.supplierName && (
                                <div>Supplier: {displayInfo.supplierName}</div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 2. Job Title */}
                      <td className="py-3.5 px-4 text-[#4A5568] font-medium max-w-xs truncate">
                        {app.job_requirements?.title || 'Healthcare Position'}
                      </td>

                      {/* 3. Role Type Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#7EB3E8]/20 text-[#2952A3] capitalize">
                          {app.job_requirements?.role_type || 'General'}
                        </span>
                      </td>

                      {/* 4. Current Stage Badge + Feedback link if interviewed */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>{getStatusBadge(app.status)}</div>
                          {app.status === 'interviewed' && (
                            <div>
                              {hasFeedback ? (
                                <span className="text-[10px] text-emerald-600 font-semibold flex items-center space-x-0.5">
                                  <Check size={10} />
                                  <span>Feedback recorded</span>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenFeedbackModal(app)}
                                  className="text-[10px] text-amber-600 hover:text-amber-800 font-bold underline cursor-pointer"
                                >
                                  Record your interview feedback →
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 5. Interview Details Column */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {app.interview_date ? (
                          <button
                            type="button"
                            onClick={() => toggleRowExpansion(app.id)}
                            className="text-left group cursor-pointer"
                          >
                            <div className="flex items-center space-x-1.5 text-[11px] text-slate-700 font-medium">
                              {getFormatIcon(app.interview_format)}
                              <span>
                                {formatDate(app.interview_date)} at {app.interview_time || '10:00'}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 group-hover:text-[#1B3270]">
                              {getFormatLabel(app.interview_format)} · Click to {isExpanded ? 'collapse' : 'view notes'}
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs">—</span>
                        )}
                      </td>

                      {/* 6. Last Updated */}
                      <td className="py-3.5 px-4 text-[#4A5568] whitespace-nowrap">
                        {daysSinceUpdate === 0 ? 'Today' : `${daysSinceUpdate}d ago`}
                      </td>

                      {/* 7. Context-Aware Actions per Stage */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          {/* STAGE: APPLIED */}
                          {app.status === 'applied' && (
                            <>
                              <button
                                type="button"
                                disabled={updatingAppId === app.id}
                                onClick={() => handleMoveToShortlisted(app)}
                                className="py-1 px-3 bg-[#1B3270] hover:bg-[#2952A3] text-white text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                              >
                                Move to Shortlisted
                              </button>
                              <button
                                type="button"
                                disabled={updatingAppId === app.id}
                                onClick={() => handleOpenRejectionModal(app)}
                                className="py-1 px-2.5 text-[11px] font-semibold text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/10 rounded-[6px] transition-colors cursor-pointer"
                              >
                                Not Progressed
                              </button>
                            </>
                          )}

                          {/* STAGE: SHORTLISTED */}
                          {app.status === 'shortlisted' && (
                            <>
                              <button
                                type="button"
                                disabled={updatingAppId === app.id}
                                onClick={() => handleOpenScheduleModal(app, false)}
                                className="py-1 px-3 bg-[#1B3270] hover:bg-[#2952A3] text-white text-[11px] font-semibold rounded-[6px] transition-colors flex items-center space-x-1 cursor-pointer"
                              >
                                <Calendar size={12} />
                                <span>Schedule Interview</span>
                              </button>
                              <button
                                type="button"
                                disabled={updatingAppId === app.id}
                                onClick={() => handleOpenRejectionModal(app)}
                                className="py-1 px-2.5 text-[11px] font-semibold text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/10 rounded-[6px] transition-colors cursor-pointer"
                              >
                                Not Progressed
                              </button>
                            </>
                          )}

                          {/* STAGE: INTERVIEW SCHEDULED */}
                          {app.status === 'interview_scheduled' && (
                            <>
                              <button
                                type="button"
                                disabled={updatingAppId === app.id}
                                onClick={() => handleMarkInterviewed(app)}
                                className="py-1 px-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                              >
                                Mark as Interviewed
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenScheduleModal(app, true)}
                                className="text-[11px] text-[#2952A3] hover:underline font-medium cursor-pointer"
                              >
                                Edit schedule
                              </button>
                              <button
                                type="button"
                                disabled={updatingAppId === app.id}
                                onClick={() => handleOpenRejectionModal(app)}
                                className="py-1 px-2.5 text-[11px] font-semibold text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/10 rounded-[6px] transition-colors cursor-pointer"
                              >
                                Not Progressed
                              </button>
                            </>
                          )}

                          {/* STAGE: INTERVIEWED */}
                          {app.status === 'interviewed' && (
                            <>
                              <button
                                type="button"
                                disabled={updatingAppId === app.id}
                                onClick={() => handleMoveToSelected(app)}
                                className="py-1 px-3 bg-[#10B981] hover:bg-[#059669] text-white text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                              >
                                Move to Selected
                              </button>
                              <button
                                type="button"
                                disabled={updatingAppId === app.id}
                                onClick={() => handleOpenRejectionModal(app)}
                                className="py-1 px-2.5 text-[11px] font-semibold text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/10 rounded-[6px] transition-colors cursor-pointer"
                              >
                                Not Progressed
                              </button>
                            </>
                          )}

                          {/* STAGE: SELECTED */}
                          {app.status === 'selected' && (
                            <>
                              <button
                                type="button"
                                disabled={updatingAppId === app.id}
                                onClick={() => handleSendOffer(app)}
                                className="py-1 px-3 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                              >
                                Send Offer
                              </button>
                              <button
                                type="button"
                                disabled={updatingAppId === app.id}
                                onClick={() => handleOpenRejectionModal(app)}
                                className="py-1 px-2.5 text-[11px] font-semibold text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/10 rounded-[6px] transition-colors cursor-pointer"
                              >
                                Not Progressed
                              </button>
                            </>
                          )}

                          {/* STAGE: OFFER SENT */}
                          {app.status === 'offer_sent' && (
                            <button
                              type="button"
                              disabled={updatingAppId === app.id}
                              onClick={() => handleBeginRevealProcess(app)}
                              className="py-1 px-3 bg-[#1B3270] hover:bg-[#2952A3] text-white text-[11px] font-semibold rounded-[6px] transition-colors shadow-2xs flex items-center space-x-1 cursor-pointer"
                            >
                              <Sparkles size={12} />
                              <span>Begin Reveal Process</span>
                            </button>
                          )}

                          {/* STAGE: REVEAL PROCESS (REVEAL GATE) */}
                          {app.status === 'reveal_gate' && (
                            <button
                              type="button"
                              onClick={() => setRevealApp(app)}
                              className="py-1 px-3 bg-white border border-[#1B3270] text-[#1B3270] hover:bg-[#1B3270]/5 text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                            >
                              View Reveal Progress
                            </button>
                          )}

                          {/* STAGE: PLACED */}
                          {app.status === 'placed' && (
                            <button
                              type="button"
                              onClick={() => setPlacementApp(app)}
                              className="py-1 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                            >
                              View Placement Details
                            </button>
                          )}

                          {/* STAGE: REJECTED */}
                          {app.status === 'rejected' && app.rejection_reason && (
                            <span
                              className="text-[11px] text-slate-400 italic max-w-[140px] truncate block"
                              title={`Reason: ${app.rejection_reason}`}
                            >
                              {app.rejection_reason}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDABLE ROW DETAILS (Interview notes & confidential feedback) */}
                    {isExpanded && (
                      <tr className="bg-[#F8FAFD]/90 border-b border-[#E2E8F4]">
                        <td colSpan={7} className="px-6 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            {/* Left: Schedule & Instructions */}
                            <div className="space-y-1">
                              <div className="font-bold text-[#1B3270] flex items-center space-x-1.5">
                                <Calendar size={13} className="text-[#2952A3]" />
                                <span>
                                  Interview:{' '}
                                  {app.interview_date
                                    ? `${formatDate(app.interview_date)} at ${
                                        app.interview_time || '10:00'
                                      }`
                                    : 'Not scheduled'}{' '}
                                  via {getFormatLabel(app.interview_format)}
                                </span>
                              </div>
                              {app.interview_notes ? (
                                <p className="text-slate-600 bg-white p-2.5 rounded-[6px] border border-[#E2E8F4] text-[11px]">
                                  <strong className="text-slate-700 block mb-0.5">
                                    Candidate Instructions & Notes:
                                  </strong>
                                  {app.interview_notes}
                                </p>
                              ) : (
                                <p className="text-slate-400 text-[11px] italic">
                                  No specific preparation notes entered.
                                </p>
                              )}
                            </div>

                            {/* Right: Employer Feedback */}
                            <div className="space-y-1">
                              <div className="font-bold text-[#1B3270] flex items-center space-x-1.5">
                                <MessageSquare size={13} className="text-[#2952A3]" />
                                <span>Employer Interview Feedback</span>
                              </div>
                              {app.employer_feedback ? (
                                <div className="bg-white p-2.5 rounded-[6px] border border-[#E2E8F4] text-[11px] space-y-1">
                                  <p className="text-slate-700 whitespace-pre-line">
                                    {app.employer_feedback}
                                  </p>
                                  <span className="text-[10px] text-slate-400 block pt-1 border-t border-slate-100">
                                    Submitted{' '}
                                    {app.feedback_submitted_at
                                      ? formatDate(app.feedback_submitted_at)
                                      : 'Recently'}{' '}
                                    · Private to your facility
                                  </span>
                                </div>
                              ) : (
                                <div className="bg-white p-2.5 rounded-[6px] border border-dashed border-[#E2E8F4] text-[11px] flex items-center justify-between">
                                  <span className="text-slate-400 italic">
                                    No interview feedback recorded yet.
                                  </span>
                                  {app.status === 'interviewed' && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenFeedbackModal(app)}
                                      className="text-amber-600 hover:text-amber-700 font-bold underline text-[11px]"
                                    >
                                      Record Feedback
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* --- 1. INTERVIEW SCHEDULING MODAL --- */}
      {schedulingApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E2E8F4] max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-start justify-between border-b border-[#E2E8F4] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1B3270]">
                  {isEditingSchedule ? 'Edit Interview Schedule' : 'Schedule Interview'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-slate-700">
                    Candidate #{schedulingApp.candidate_id.substring(0, 6).toUpperCase()}
                  </span>{' '}
                  — {schedulingApp.job_requirements?.title || 'Position'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSchedulingApp(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmSchedule} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Interview Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={tomorrowStr}
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-800 outline-none focus:border-[#2952A3]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Interview Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={interviewTime}
                    onChange={(e) => setInterviewTime(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-800 outline-none focus:border-[#2952A3]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Interview Format *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={`flex items-center space-x-2 p-2.5 rounded-[6px] border cursor-pointer transition-all ${
                      interviewFormat === 'video'
                        ? 'border-[#1B3270] bg-[#1B3270]/5 font-semibold text-[#1B3270]'
                        : 'border-[#E2E8F4] text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="interviewFormat"
                      value="video"
                      checked={interviewFormat === 'video'}
                      onChange={() => setInterviewFormat('video')}
                      className="text-[#1B3270] focus:ring-[#1B3270]"
                    />
                    <span className="flex items-center space-x-1">
                      <Video size={13} className="text-blue-500" />
                      <span>Video call</span>
                    </span>
                  </label>

                  <label
                    className={`flex items-center space-x-2 p-2.5 rounded-[6px] border cursor-pointer transition-all ${
                      interviewFormat === 'in_person'
                        ? 'border-[#1B3270] bg-[#1B3270]/5 font-semibold text-[#1B3270]'
                        : 'border-[#E2E8F4] text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="interviewFormat"
                      value="in_person"
                      checked={interviewFormat === 'in_person'}
                      onChange={() => setInterviewFormat('in_person')}
                      className="text-[#1B3270] focus:ring-[#1B3270]"
                    />
                    <span className="flex items-center space-x-1">
                      <Building2 size={13} className="text-slate-500" />
                      <span>In-person</span>
                    </span>
                  </label>

                  <label
                    className={`flex items-center space-x-2 p-2.5 rounded-[6px] border cursor-pointer transition-all ${
                      interviewFormat === 'phone'
                        ? 'border-[#1B3270] bg-[#1B3270]/5 font-semibold text-[#1B3270]'
                        : 'border-[#E2E8F4] text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="interviewFormat"
                      value="phone"
                      checked={interviewFormat === 'phone'}
                      onChange={() => setInterviewFormat('phone')}
                      className="text-[#1B3270] focus:ring-[#1B3270]"
                    />
                    <span className="flex items-center space-x-1">
                      <Phone size={13} className="text-slate-500" />
                      <span>Phone call</span>
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Interview Notes & Candidate Instructions (Optional)
                </label>
                <textarea
                  rows={3}
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                  placeholder="Meeting links, clinical ward directions, preparation topics, or interview panel member names..."
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-800 outline-none focus:border-[#2952A3]"
                />
              </div>

              <div className="p-3 rounded-[6px] bg-blue-50 border border-blue-200 text-[11px] text-blue-900 flex items-start space-x-2">
                <Info size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Light Reveal Activation:</strong> Confirming this interview unlocks Candidate #[
                  {schedulingApp.candidate_id.substring(0, 6).toUpperCase()}]'s full name in your pipeline for seamless interview coordination.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setSchedulingApp(null)}
                  disabled={submittingSchedule}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSchedule}
                  className="px-5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] shadow-2xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingSchedule ? (
                    <span>Scheduling...</span>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirm & Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 2. REJECTION MODAL ("Move to Not Progressed") --- */}
      {rejectingApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E2E8F4] max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-start justify-between border-b border-[#E2E8F4] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#EF4444]">
                  Move to Not Progressed
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getCandidateDisplay(
                    rejectingApp.candidates || { id: rejectingApp.candidate_id },
                    rejectingApp.status
                  ).display}{' '}
                  — {rejectingApp.job_requirements?.title || 'Position'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejectingApp(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Amber Info Card on Anonymization retention */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-[6px] text-xs text-amber-900 space-y-1">
              <div className="font-semibold flex items-center space-x-1">
                <AlertCircle size={13} className="text-amber-600" />
                <span>Identity Protection Notice</span>
              </div>
              <p className="text-[11px] text-amber-800">
                {['applied', 'shortlisted'].includes(rejectingApp.status)
                  ? 'Candidate identity will remain Level 1 (Candidate #' +
                    rejectingApp.candidate_id.substring(0, 6).toUpperCase() +
                    '). Direct contact details will not be disclosed.'
                  : 'Candidate identity will remain Level 2 (Name only). Full private contact details remain protected.'}
              </p>
            </div>

            <form onSubmit={handleConfirmRejection} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Reason for not progressing (Optional)
                </label>
                <select
                  value={rejectionReasonType}
                  onChange={(e) => setRejectionReasonType(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-800 outline-none focus:border-[#2952A3]"
                >
                  {REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {rejectionReasonType === 'Other' && (
                <div>
                  <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Please describe the reason
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={customRejectionReason}
                    onChange={(e) => setCustomRejectionReason(e.target.value)}
                    placeholder="Provide specific notes regarding why the candidate is not progressing..."
                    className="w-full px-3 py-2 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-800 outline-none focus:border-[#2952A3]"
                  />
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Note: Feedback reasons are securely routed to your Employer RM for sourcing optimization and are never shared directly with the candidate.
              </p>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setRejectingApp(null)}
                  disabled={submittingRejection}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRejection}
                  className="px-5 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-semibold rounded-[6px] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingRejection ? 'Updating...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 3. INTERVIEW FEEDBACK MODAL --- */}
      {feedbackApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E2E8F4] max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-start justify-between border-b border-[#E2E8F4] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1B3270]">
                  Interview Feedback
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {getCandidateDisplay(
                    feedbackApp.candidates || { id: feedbackApp.candidate_id },
                    feedbackApp.status
                  ).display}{' '}
                  — {feedbackApp.job_requirements?.title || 'Position'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFeedbackApp(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmFeedback} className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 uppercase tracking-wider">
                    Overall Impression * (Min 30 characters)
                  </label>
                  <span
                    className={`text-[10px] font-semibold ${
                      feedbackText.trim().length >= 30 ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {feedbackText.trim().length} / 30 min chars
                  </span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="How did the interview go? What were the candidate's clinical strengths, German language proficiency, and areas for improvement?"
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#E2E8F4] rounded-[6px] text-slate-800 outline-none focus:border-[#2952A3]"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Your Next Step for this Candidate:
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-center space-x-2.5 p-3 rounded-[8px] border cursor-pointer transition-all ${
                      feedbackNextStep === 'selected'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold'
                        : 'border-[#E2E8F4] hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="feedbackNextStep"
                      value="selected"
                      checked={feedbackNextStep === 'selected'}
                      onChange={() => setFeedbackNextStep('selected')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span>Move to Selected</span>
                      <span className="text-[11px] text-slate-500 font-normal block">
                        Candidate meets clinical standards and is selected for offer preparation.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center space-x-2.5 p-3 rounded-[8px] border cursor-pointer transition-all ${
                      feedbackNextStep === 'rejected'
                        ? 'border-red-400 bg-red-50/40 text-red-900 font-semibold'
                        : 'border-[#E2E8F4] hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="feedbackNextStep"
                      value="rejected"
                      checked={feedbackNextStep === 'rejected'}
                      onChange={() => setFeedbackNextStep('rejected')}
                      className="text-red-600 focus:ring-red-500"
                    />
                    <div>
                      <span>Move to Not Progressed</span>
                      <span className="text-[11px] text-slate-500 font-normal block">
                        Candidate will not be offered a contract at this time.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setFeedbackApp(null)}
                  disabled={submittingFeedback}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingFeedback || feedbackText.trim().length < 30}
                  className="px-5 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submittingFeedback ? 'Saving...' : 'Save Feedback'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- 4. REVEAL PROCESS PANEL MODAL --- */}
      {revealApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E2E8F4] max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-start justify-between border-b border-[#E2E8F4] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#1B3270]">
                  Reveal Process — {revealApp.job_requirements?.title || 'Position'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {getCandidateDisplay(
                    revealApp.candidates || { id: revealApp.candidate_id },
                    revealApp.status
                  ).display}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevealApp(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* 3 Conditions Checklist */}
            {(() => {
              const cond = revealApp.reveal_gate_conditions || {};
              const offerDone = Boolean(cond.offer_letter);
              const depositDone = Boolean(cond.deposit);
              const consentDone = Boolean(cond.consent);
              const completedCount = [offerDone, depositDone, consentDone].filter(Boolean).length;
              const allDone = completedCount === 3;

              return (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                      <span>Conditions Checklist</span>
                      <span className="text-[#1B3270]">
                        {completedCount} of 3 conditions met
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                        style={{ width: `${(completedCount / 3) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {/* Condition 1: Offer Letter */}
                    <div className="p-3.5 rounded-[8px] border border-[#E2E8F4] bg-[#F8FAFD]/50 flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              offerDone
                                ? 'bg-emerald-500 text-white font-bold'
                                : 'border border-slate-300 text-slate-400'
                            }`}
                          >
                            {offerDone ? <Check size={10} strokeWidth={2.5} /> : null}
                          </span>
                          <span className="font-bold text-xs text-slate-800">
                            Offer Letter Confirmed
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 pl-6">
                          Managed by TerraTern team
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          offerDone
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {offerDone ? 'Confirmed' : 'Pending'}
                      </span>
                    </div>

                    {/* Condition 2: Employer Deposit */}
                    <div className="p-3.5 rounded-[8px] border border-[#E2E8F4] bg-[#F8FAFD]/50 flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              depositDone
                                ? 'bg-emerald-500 text-white font-bold'
                                : 'border border-slate-300 text-slate-400'
                            }`}
                          >
                            {depositDone ? <Check size={10} strokeWidth={2.5} /> : null}
                          </span>
                          <span className="font-bold text-xs text-slate-800">
                            Employer Deposit Confirmed
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 pl-6">
                          Contact your account manager to arrange the deposit.
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          depositDone
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {depositDone ? 'Confirmed' : 'Pending'}
                      </span>
                    </div>

                    {/* Condition 3: Candidate Consent */}
                    <div className="p-3.5 rounded-[8px] border border-[#E2E8F4] bg-[#F8FAFD]/50 flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              consentDone
                                ? 'bg-emerald-500 text-white font-bold'
                                : 'border border-slate-300 text-slate-400'
                            }`}
                          >
                            {consentDone ? <Check size={10} strokeWidth={2.5} /> : null}
                          </span>
                          <span className="font-bold text-xs text-slate-800">
                            Candidate Consent Obtained
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 pl-6">
                          Managed by TerraTern team
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          consentDone
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {consentDone ? 'Confirmed' : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {allDone ? (
                    <div className="p-3.5 rounded-[8px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                      <div className="flex items-center space-x-2 font-bold">
                        <CheckCircle2 size={16} className="text-emerald-600" />
                        <span>All 3 conditions met. Placement confirmed!</span>
                      </div>
                      <span className="text-[11px] text-emerald-700 font-semibold">
                        Placement Confirmed
                      </span>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-[8px] bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                      <div className="font-bold flex items-center space-x-1.5">
                        <UserCheck size={14} className="text-blue-600" />
                        <span>Account Manager Coordination</span>
                      </div>
                      <p className="text-[11px] text-blue-800">
                        Your account manager{' '}
                        <strong>{assignedRm?.full_name || 'at TerraTern'}</strong>{' '}
                        {assignedRm?.email ? `(${assignedRm.email})` : ''} is coordinating this process. Contact them for any queries regarding deposit arrangements or offer letter execution.
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="pt-2 flex justify-end border-t border-[#E2E8F4]">
              <button
                type="button"
                onClick={() => setRevealApp(null)}
                className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 5. PLACEMENT DETAILS MODAL --- */}
      {placementApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-2xl border border-[#E2E8F4] max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-5">
            <div className="flex items-start justify-between border-b border-[#E2E8F4] pb-3">
              <div>
                <h3 className="text-base font-bold text-emerald-700 flex items-center space-x-1.5">
                  <CheckCircle2 size={18} />
                  <span>Placement Confirmed</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {placementApp.job_requirements?.title || 'Healthcare Position'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlacementApp(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Level 3 Full Reveal Details */}
            <div className="p-4 rounded-[8px] bg-emerald-50/60 border border-emerald-200 text-xs space-y-2">
              <div className="font-bold text-emerald-950 text-sm">
                {placementApp.candidates?.first_name} {placementApp.candidates?.last_name}
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                <div>
                  <span className="text-slate-400 block">Candidate Email:</span>
                  <span className="font-medium">
                    {placementApp.candidates?.email || 'Secured via TerraTern'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Sourcing Partner:</span>
                  <span className="font-medium">
                    {placementApp.candidates?.suppliers?.company_name || 'Direct / Academy'}
                  </span>
                </div>
              </div>
              <div className="pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-800">
                Full candidate profile and credentials have been unmasked. Relocation, Anerkennung equivalence certificate, and German work visa logistics are underway with your account manager.
              </div>
            </div>

            <div className="pt-2 flex justify-end border-t border-[#E2E8F4]">
              <button
                type="button"
                onClick={() => setPlacementApp(null)}
                className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
