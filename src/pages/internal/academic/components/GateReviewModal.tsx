import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  X,
  CheckCircle2,
  HelpCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  FileText,
  User,
  Loader2,
  Award,
  Lock,
} from 'lucide-react';
import { SpeakingTestApproveModal } from './SpeakingTestApprovalModals';

export interface PendingGateResult {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_target_role: string | null;
  candidate_language_level: string | null;
  candidate_user_id: string | null;
  gate_type: string;
  status: string; // 'pass' | 'fail' | 'in_progress'
  score: number | null;
  recorded_by: string | null;
  mentor_name: string;
  notes: string | null;
  created_at: string;
  review_status: string;
}

interface OfferingOption {
  id: string;
  name: string;
  price: number;
}

interface RubricScoreRow {
  criterionId: string;
  criterionName: string;
  description: string;
  score: number;
  maxScore: number;
  notes: string | null;
  orderPosition: number;
}

interface GateReviewModalProps {
  gateResult: PendingGateResult | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const GateReviewModal: React.FC<GateReviewModalProps> = ({
  gateResult,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [sessionNotes, setSessionNotes] = useState<
    Array<{ id: string; note: string; created_at: string }>
  >([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Mode: 'view' | 'query'
  const [mode, setMode] = useState<'view' | 'query'>('view');
  const [queryQuestion, setQueryQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fresh gate state (stale state prevention)
  const [freshReviewStatus, setFreshReviewStatus] = useState<string>('pending');
  const [reviewedByName, setReviewedByName] = useState<string | null>(null);
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  const [isOverriding, setIsOverriding] = useState(false);
  const [loadingFresh, setLoadingFresh] = useState(true);

  // Speaking Test Rubric Details
  const [stResult, setStResult] = useState<any | null>(null);
  const [rubricRows, setRubricRows] = useState<RubricScoreRow[]>([]);
  const [showStConfirmApprove, setShowStConfirmApprove] = useState(false);

  // Assessment fail analysis
  const [assessmentAttempts, setAssessmentAttempts] = useState<number>(1);
  const [isConsecutiveThirdFail, setIsConsecutiveThirdFail] = useState(false);
  const [offerings, setOfferings] = useState<OfferingOption[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>('');
  const [candidateData, setCandidateData] = useState<{
    consecutive_final_test_fails: number;
    final_test_locked: boolean;
    supplier_id: string | null;
    user_id: string | null;
  } | null>(null);

  useEffect(() => {
    if (!gateResult) return;

    setMode('view');
    setQueryQuestion('');
    setErrorMessage(null);
    setShowStConfirmApprove(false);
    setIsOverriding(false);
    setLoadingFresh(true);

    // Fetch fresh gate result record
    const fetchFreshRecord = async () => {
      try {
        const { data: fData, error: fErr } = await supabase
          .from('gate_results')
          .select(`
            id,
            review_status,
            reviewed_by,
            reviewed_at,
            reviewer:reviewed_by(first_name, last_name, email)
          `)
          .eq('id', gateResult.id)
          .single();

        if (fErr) throw fErr;
        if (fData) {
          setFreshReviewStatus(fData.review_status || 'pending');
          setReviewedAt(fData.reviewed_at);
          const rev = (fData as any).reviewer;
          setReviewedByName(
            rev ? `${rev.first_name || ''} ${rev.last_name || ''}`.trim() || rev.email : 'Academic Lead'
          );
        }
      } catch (err) {
        console.error('Error fetching fresh gate status:', err);
      } finally {
        setLoadingFresh(false);
      }
    };
    fetchFreshRecord();

    // If speaking test, fetch speaking_test_results and rubric scores
    if (gateResult.gate_type === 'speaking_test') {
      const fetchSpeakingTestData = async () => {
        try {
          const { data: resData } = await supabase
            .from('speaking_test_results')
            .select('*')
            .eq('candidate_id', gateResult.candidate_id)
            .eq('review_status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (resData) {
            setStResult(resData);

            // Fetch rubric criteria
            const { data: criteriaData } = await supabase
              .from('speaking_test_rubric_criteria')
              .select('id, criterion_name, description, max_score, order_position')
              .order('order_position', { ascending: true });

            const critMap: Record<string, any> = {};
            (criteriaData || []).forEach((c) => {
              critMap[c.id] = c;
            });

            // Fetch rubric scores
            const { data: scoresData } = await supabase
              .from('speaking_test_rubric_scores')
              .select('*')
              .eq('result_id', resData.id);

            const rows: RubricScoreRow[] = (scoresData || []).map((s) => {
              const c = critMap[s.criterion_id];
              return {
                criterionId: s.criterion_id,
                criterionName: c?.criterion_name || 'Criterion',
                description: c?.description || '',
                score: s.score,
                maxScore: c?.max_score || 20,
                notes: s.notes || null,
                orderPosition: c?.order_position || 0,
              };
            });

            rows.sort((a, b) => a.orderPosition - b.orderPosition);
            setRubricRows(rows);
          }
        } catch (err) {
          console.error('Error loading speaking test details:', err);
        }
      };

      fetchSpeakingTestData();
    }

    // Fetch session notes
    const fetchNotes = async () => {
      setLoadingNotes(true);
      try {
        let query = supabase
          .from('internal_notes')
          .select('id, note, created_at')
          .eq('candidate_id', gateResult.candidate_id)
          .eq('note_type', 'session')
          .order('created_at', { ascending: false })
          .limit(3);

        if (gateResult.recorded_by) {
          query = query.eq('author_id', gateResult.recorded_by);
        }

        const { data } = await query;
        setSessionNotes(data || []);
      } catch (err) {
        console.error('Error fetching session notes:', err);
      } finally {
        setLoadingNotes(false);
      }
    };

    fetchNotes();

    // If assessment (pass or fail), fetch candidate assessment info and offerings
    if (gateResult.gate_type === 'assessment') {
      const fetchAssessmentInfo = async () => {
        try {
          const { data: cand } = await supabase
            .from('candidates')
            .select('consecutive_final_test_fails, final_test_locked, supplier_id, user_id')
            .eq('id', gateResult.candidate_id)
            .maybeSingle();

          const currentFails = cand?.consecutive_final_test_fails || 0;
          setCandidateData({
            consecutive_final_test_fails: currentFails,
            final_test_locked: !!cand?.final_test_locked,
            supplier_id: cand?.supplier_id || null,
            user_id: cand?.user_id || gateResult.candidate_user_id || null,
          });

          const nextFailCount = currentFails + 1;
          setAssessmentAttempts(nextFailCount);
          setIsConsecutiveThirdFail(nextFailCount >= 3);

          // Fetch applicable offerings
          const { data: offData } = await supabase
            .from('offerings')
            .select('id, name, price')
            .eq('is_active', true)
            .eq('applicable_gate', 'assessment');

          setOfferings(offData || []);
          if (offData && offData.length > 0) {
            setSelectedOfferingId(offData[0].id);
          }
        } catch (err) {
          console.error('Error checking attempts:', err);
        }
      };

      fetchAssessmentInfo();
    }
  }, [gateResult]);

  if (!gateResult) return null;

  const candidateFullName = gateResult.candidate_name;

  // Handle Assessment Standard Approve
  const handleApproveStandard = async () => {
    if (!user) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      // Update gate_results
      const { error: updateGateErr } = await supabase
        .from('gate_results')
        .update({
          review_status: 'approved',
          status: gateResult.status,
        })
        .eq('id', gateResult.id);

      if (updateGateErr) throw updateGateErr;

      if (gateResult.gate_type === 'assessment' && gateResult.status === 'pass') {
        const now = new Date().toISOString();

        // 1. Update final_test_attempts
        await supabase
          .from('final_test_attempts')
          .update({
            review_status: 'approved',
            reviewed_by: user.id,
            reviewed_at: now,
          })
          .eq('candidate_id', gateResult.candidate_id)
          .eq('review_status', 'pending');

        // 2. Update candidate
        const { error: candErr } = await supabase
          .from('candidates')
          .update({
            status: 'interview_ready',
            can_apply_to_jobs: true,
            consecutive_final_test_fails: 0,
            final_test_locked: false,
          })
          .eq('id', gateResult.candidate_id);

        if (candErr) throw candErr;

        // 3. Candidate notification
        const candUserId = candidateData?.user_id || gateResult.candidate_user_id;
        if (candUserId) {
          await supabase.from('notifications').insert({
            user_id: candUserId,
            title: 'Interview Ready — Final Assessment Passed',
            message:
              'Congratulations! You have passed the Final Assessment and are now Interview Ready. You may now apply directly to active healthcare jobs.',
            type: 'placement',
            sent_by: user.id,
          });
        }

        // 4. RM Notification
        let requestingRmId: string | null = null;
        const { data: acReq } = await supabase
          .from('academic_requests')
          .select('requested_by')
          .eq('candidate_id', gateResult.candidate_id)
          .maybeSingle();

        if (acReq?.requested_by) {
          requestingRmId = acReq.requested_by;
        } else {
          const { data: ma } = await supabase
            .from('mentor_assignments')
            .select('assigned_by')
            .eq('candidate_id', gateResult.candidate_id)
            .maybeSingle();
          if (ma?.assigned_by) requestingRmId = ma.assigned_by;
        }

        if (requestingRmId) {
          await supabase.from('notifications').insert({
            user_id: requestingRmId,
            title: 'Candidate Interview Ready',
            message: `${candidateFullName} has passed the Assessment and is now Interview Ready.`,
            type: 'placement',
            sent_by: user.id,
          });
        }

        // 5. Supplier Notification (anonymized)
        const supplierId = candidateData?.supplier_id;
        if (supplierId) {
          const { data: sRecord } = await supabase
            .from('suppliers')
            .select('user_id')
            .eq('id', supplierId)
            .maybeSingle();

          const { data: sMembers } = await supabase
            .from('supplier_team_members')
            .select('profile_id')
            .eq('supplier_id', supplierId);

          const supplierRecipients = new Set<string>();
          if (sRecord?.user_id) supplierRecipients.add(sRecord.user_id);
          (sMembers || []).forEach((m) => {
            if (m.profile_id) supplierRecipients.add(m.profile_id);
          });

          const shortId = gateResult.candidate_id.slice(-6).toUpperCase();
          const sNotifs = Array.from(supplierRecipients).map((sUid) => ({
            user_id: sUid,
            title: 'Candidate Interview Ready',
            message: `A candidate (Candidate #${shortId}) has passed the Final Assessment and is now Interview Ready.`,
            type: 'placement',
            sent_by: user.id,
          }));

          if (sNotifs.length > 0) {
            await supabase.from('notifications').insert(sNotifs);
          }
        }
      }

      onSuccess(`Successfully approved Assessment for ${candidateFullName}.`);
      onClose();
    } catch (err: any) {
      console.error('Error approving gate result:', err);
      setErrorMessage(err.message || 'Failed to approve gate result');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Approve Assessment Fail with Offering (Fail 1 or 2: Cooling + Offering)
  const handleApproveFailWithOffering = async () => {
    if (!user) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();
      const currentFails = candidateData?.consecutive_final_test_fails || 0;
      const newFails = currentFails + 1;

      // 1. Update gate_results
      const { error: gateErr } = await supabase
        .from('gate_results')
        .update({
          review_status: 'approved',
          status: 'fail',
        })
        .eq('id', gateResult.id);

      if (gateErr) throw gateErr;

      // 2. Update final_test_attempts
      await supabase
        .from('final_test_attempts')
        .update({
          review_status: 'approved',
          reviewed_by: user.id,
          reviewed_at: now,
        })
        .eq('candidate_id', gateResult.candidate_id)
        .eq('review_status', 'pending');

      // 3. Update candidates consecutive_final_test_fails
      await supabase
        .from('candidates')
        .update({
          consecutive_final_test_fails: newFails,
        })
        .eq('id', gateResult.candidate_id);

      // 4. Insert cooling_periods (7 days)
      const coolingEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from('cooling_periods').insert({
        candidate_id: gateResult.candidate_id,
        gate_type: 'assessment',
        reason: 'final_test_failed',
        start_date: now,
        end_date: coolingEnd,
      });

      // 5. Insert candidate_offerings
      if (selectedOfferingId) {
        await supabase.from('candidate_offerings').insert({
          candidate_id: gateResult.candidate_id,
          offering_id: selectedOfferingId,
          gate_type_failed: 'assessment',
          status: 'recommended',
        });
      }

      // 6. Notify candidate
      const candUserId = candidateData?.user_id || gateResult.candidate_user_id;
      if (candUserId) {
        await supabase.from('notifications').insert({
          user_id: candUserId,
          title: 'Final Assessment Result Available',
          message:
            'Your assessment result has been reviewed. A 7-day cooling period is now active. Review recommended training offerings in your Academy tab.',
          type: 'academic',
          sent_by: user.id,
        });
      }

      onSuccess(`Assessment fail approved (Attempt ${newFails} of 3). 7-day cooling period and training offering assigned.`);
      onClose();
    } catch (err: any) {
      console.error('Error approving fail with offering:', err);
      setErrorMessage(err.message || 'Failed to process assessment review');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Approve Fail 3: Lock Final Test
  const handleApproveFailLocked = async () => {
    if (!user) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const now = new Date().toISOString();

      // 1. Update gate_results
      const { error: gateErr } = await supabase
        .from('gate_results')
        .update({
          review_status: 'approved',
          status: 'fail',
        })
        .eq('id', gateResult.id);

      if (gateErr) throw gateErr;

      // 2. Update final_test_attempts
      await supabase
        .from('final_test_attempts')
        .update({
          review_status: 'approved',
          reviewed_by: user.id,
          reviewed_at: now,
        })
        .eq('candidate_id', gateResult.candidate_id)
        .eq('review_status', 'pending');

      // 3. Update candidates: consecutive_final_test_fails = 3, final_test_locked = true
      await supabase
        .from('candidates')
        .update({
          consecutive_final_test_fails: 3,
          final_test_locked: true,
        })
        .eq('id', gateResult.candidate_id);

      // 4. Notify candidate (locked)
      const candUserId = candidateData?.user_id || gateResult.candidate_user_id;
      if (candUserId) {
        await supabase.from('notifications').insert({
          user_id: candUserId,
          title: 'Final Assessment Locked',
          message:
            'You have reached 3 consecutive failed assessment attempts. Your assessment is now locked. Contact your relationship manager.',
          type: 'academic',
          sent_by: user.id,
        });
      }

      // 5. Notify RM (locked)
      let requestingRmId: string | null = null;
      const { data: acReq } = await supabase
        .from('academic_requests')
        .select('requested_by')
        .eq('candidate_id', gateResult.candidate_id)
        .maybeSingle();

      if (acReq?.requested_by) {
        requestingRmId = acReq.requested_by;
      } else {
        const { data: ma } = await supabase
          .from('mentor_assignments')
          .select('assigned_by')
          .eq('candidate_id', gateResult.candidate_id)
          .maybeSingle();
        if (ma?.assigned_by) requestingRmId = ma.assigned_by;
      }

      if (requestingRmId) {
        await supabase.from('notifications').insert({
          user_id: requestingRmId,
          title: 'Candidate Final Assessment Locked',
          message: `${candidateFullName} has failed the Final Assessment 3 consecutive times. Assessment access is locked.`,
          type: 'academic',
          sent_by: user.id,
        });
      }

      onSuccess(`Assessment fail approved (3rd consecutive fail). Candidate final test locked and RM notified.`);
      onClose();
    } catch (err: any) {
      console.error('Error locking candidate assessment:', err);
      setErrorMessage(err.message || 'Failed to process assessment lock');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Query
  const handleQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !queryQuestion.trim()) return;

    setSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. Update gate result status to queried
      const { error: gateErr } = await supabase
        .from('gate_results')
        .update({ review_status: 'queried' })
        .eq('id', gateResult.id);

      if (gateErr) throw gateErr;

      // If speaking test, also update speaking_test_results
      if (stResult?.id) {
        await supabase
          .from('speaking_test_results')
          .update({
            review_status: 'queried',
            reviewer_notes: queryQuestion.trim(),
          })
          .eq('id', stResult.id);
      }

      // 2. Notify mentor
      if (gateResult.recorded_by) {
        await supabase.from('notifications').insert({
          user_id: gateResult.recorded_by,
          title: 'Gate result queried',
          message: `Academic Lead has a question about your ${
            gateResult.gate_type === 'speaking_test' ? 'Speaking Test' : 'Assessment'
          } result for ${candidateFullName}: ${queryQuestion.trim()}`,
          type: 'academic',
          sent_by: user.id,
        });
      }

      onSuccess(`Query sent to mentor for ${candidateFullName}.`);
      onClose();
    } catch (err: any) {
      console.error('Error querying result:', err);
      setErrorMessage(err.message || 'Failed to query mentor');
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColorClass = (score: number) => {
    if (score <= 7) return 'bg-rose-50 text-rose-700 border-rose-300';
    if (score <= 13) return 'bg-amber-50 text-amber-700 border-amber-300';
    return 'bg-emerald-50 text-emerald-700 border-emerald-300';
  };

  const isSpeakingTest = gateResult.gate_type === 'speaking_test';
  const effectiveScore = stResult ? Number(stResult.total_score) : gateResult.score;
  const effectiveScorePct = stResult ? Number(stResult.score_pct) : gateResult.score;
  const effectiveOutcome: 'pass' | 'fail' = stResult ? stResult.overall_outcome : (gateResult.status === 'pass' ? 'pass' : 'fail');
  const effectiveLevel = stResult?.language_level_assessed || gateResult.candidate_language_level || 'B1';

  return (
    <>
      {/* Speaking Test Approve Modal Confirmation */}
      {showStConfirmApprove && stResult && (
        <SpeakingTestApproveModal
          isOpen={true}
          candidateName={candidateFullName}
          candidateUserId={gateResult.candidate_user_id}
          candidateId={gateResult.candidate_id}
          stResultId={stResult.id}
          mentorId={gateResult.recorded_by || ''}
          score={effectiveScore || 0}
          scorePct={effectiveScorePct || 0}
          languageLevel={effectiveLevel}
          overallOutcome={effectiveOutcome}
          onClose={() => setShowStConfirmApprove(false)}
          onSuccess={(msg) => {
            onSuccess(msg);
            onClose();
          }}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
        <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD] shrink-0">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#1B3270]/10 text-[#1B3270]">
                  {isSpeakingTest ? 'Speaking Test Review' : 'Final Assessment Review'}
                </span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    effectiveOutcome === 'pass'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {effectiveOutcome === 'pass' ? 'PASS' : 'DID NOT PASS'}
                </span>
                {effectiveLevel && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                    Level: {effectiveLevel}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                {candidateFullName}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-5 overflow-y-auto text-xs flex-1">
            {loadingFresh ? (
              <div className="py-12 text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-[#1B3270] mx-auto mb-2" />
                <p className="text-xs text-slate-500">Fetching latest gate status...</p>
              </div>
            ) : (
              <>
                {/* APPROVED BANNER */}
                {freshReviewStatus === 'approved' && !isOverriding && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-[8px] flex items-center space-x-2 text-xs text-emerald-900 font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      ✓ Approved by {reviewedByName || 'Academic Lead'} on{' '}
                      {reviewedAt
                        ? new Date(reviewedAt).toLocaleDateString('en-GB')
                        : new Date(gateResult.created_at).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                )}

                {/* OVERRIDE WARNING BANNER */}
                {isOverriding && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] flex items-center space-x-2 text-xs text-rose-800 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>You are about to override an already-approved result.</span>
                  </div>
                )}

                {/* QUERIED BANNER */}
                {freshReviewStatus === 'queried' && !isOverriding && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-[8px] flex items-center space-x-2 text-xs text-amber-900 font-medium">
                    <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Clarification requested by {reviewedByName || 'Academic Lead'}</span>
                  </div>
                )}

                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700">
                    {errorMessage}
                  </div>
                )}

            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-[#E2E8F4] rounded-[8px]">
              <div>
                <span className="text-slate-400 block text-[11px]">Mentor</span>
                <span className="font-semibold text-slate-700 flex items-center mt-0.5">
                  <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {gateResult.mentor_name}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Score</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                  {effectiveScore !== null ? `${effectiveScore} / 100` : '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Target Role</span>
                <span className="font-semibold text-slate-700 block mt-0.5">
                  {gateResult.candidate_target_role || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Date Logged</span>
                <span className="font-medium text-slate-600 flex items-center mt-0.5">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  {new Date(gateResult.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* 5-ROW RUBRIC TABLE FOR SPEAKING TEST */}
            {isSpeakingTest && rubricRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center text-xs">
                    <Award className="w-4 h-4 mr-1.5 text-[#1B3270]" />
                    Rubric Evaluation Breakdown (5 Criteria × 20 Pts)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Pass Standard: 60%
                  </span>
                </div>

                <div className="overflow-x-auto border border-[#E2E8F4] rounded-[8px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-[11px] text-slate-500 font-semibold">
                        <th className="py-2.5 px-3 font-semibold text-slate-700">Criterion</th>
                        <th className="py-2.5 px-3 font-semibold text-slate-700 w-24 text-center">Score</th>
                        <th className="py-2.5 px-3 font-semibold text-slate-700 w-16 text-center">Max</th>
                        <th className="py-2.5 px-3 font-semibold text-slate-700">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F4]">
                      {rubricRows.map((r, idx) => {
                        const badgeClass = getScoreColorClass(r.score);
                        return (
                          <tr key={r.criterionId} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3">
                              <div className="font-bold text-[#1B3270]">
                                {idx + 1}. {r.criterionName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {r.description}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs border ${badgeClass}`}
                              >
                                {r.score}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center text-slate-400 font-medium">
                              / {r.maxScore}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {r.notes ? (
                                <span className="whitespace-pre-wrap">{r.notes}</span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">None</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Mentor Summary / Evaluation Notes */}
            {(stResult?.mentor_notes || gateResult.notes) && (
              <div className="p-3.5 border border-[#E2E8F4] rounded-[8px] bg-white space-y-1">
                <div className="flex items-center text-slate-700 font-semibold">
                  <FileText className="w-3.5 h-3.5 mr-1.5 text-[#1B3270]" />
                  Mentor Notes (Full Evaluation Commentary)
                </div>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed pl-5">
                  {stResult?.mentor_notes || gateResult.notes}
                </p>
              </div>
            )}

            {/* Recent Mentor Session Notes */}
            <div>
              <span className="font-semibold text-slate-700 block mb-1.5 flex items-center">
                <BookOpen className="w-3.5 h-3.5 mr-1.5 text-[#2952A3]" />
                Recent Mentor Session Notes ({sessionNotes.length})
              </span>
              {loadingNotes ? (
                <div className="py-4 text-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                  Loading session logs...
                </div>
              ) : sessionNotes.length === 0 ? (
                <div className="p-3 bg-slate-50 border border-dashed border-[#E2E8F4] rounded-[8px] text-slate-400 text-center">
                  No previous session notes recorded by this mentor.
                </div>
              ) : (
                <div className="space-y-2">
                  {sessionNotes.map((sn) => (
                    <div
                      key={sn.id}
                      className="p-2.5 bg-slate-50 border border-[#E2E8F4] rounded-[6px]"
                    >
                      <div className="text-[10px] text-slate-400 mb-0.5">
                        {new Date(sn.created_at).toLocaleString()}
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{sn.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Assessment Fail Workflow Details */}
            {!isSpeakingTest && gateResult.status === 'fail' && (
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-[8px] space-y-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-900 text-xs">
                      Assessment Non-Passing Determination — Attempt {assessmentAttempts} of 3
                    </h4>
                    <p className="text-[11px] text-amber-900 font-medium mt-0.5">
                      Current Consecutive Fails: <strong className="text-rose-700">{candidateData?.consecutive_final_test_fails || 0}</strong>
                    </p>
                    <p className="text-amber-800 text-[11px] mt-0.5">
                      {isConsecutiveThirdFail
                        ? 'This is the candidate’s 3rd consecutive failed assessment. Confirming will set final_test_locked = true and notify both Candidate and Relationship Manager.'
                        : `Candidate did not reach the threshold. Approving will activate a 7-day cooling period, increment consecutive fails to ${assessmentAttempts}, and assign the recommended training offering.`}
                    </p>
                  </div>
                </div>

                {!isConsecutiveThirdFail && offerings.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Assign Remedial Training Offering
                    </label>
                    <select
                      value={selectedOfferingId}
                      onChange={(e) => setSelectedOfferingId(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                    >
                      {offerings.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name} (€{o.price})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Query Mode Form */}
            {mode === 'query' && (
              <form onSubmit={handleQuerySubmit} className="space-y-3 pt-2">
                <div className="p-3 bg-blue-50/50 border border-blue-200 rounded-[8px]">
                  <label className="block font-semibold text-blue-950 mb-1">
                    What clarification is needed from Mentor?
                  </label>
                  <textarea
                    value={queryQuestion}
                    onChange={(e) => setQueryQuestion(e.target.value)}
                    placeholder="e.g. Clarify grammar score breakdown or provide specific audio timestamps..."
                    rows={3}
                    required
                    className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setMode('view')}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-[6px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !queryQuestion.trim()}
                    className="px-3.5 py-1.5 text-xs font-semibold bg-[#1B3270] text-white rounded-[6px] hover:bg-[#16285a] disabled:opacity-50 flex items-center cursor-pointer"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                    Send Query to Mentor
                  </button>
                </div>
              </form>
            )}

            {/* PRE-APPROVAL NOTIFICATION INFO NOTE */}
            {(freshReviewStatus !== 'approved' || isOverriding) && mode === 'view' && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-[8px] text-[11px] text-slate-700 space-y-1">
                <p className="font-bold text-[#1B3270]">Approving will notify:</p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                  {gateResult.gate_type === 'speaking_test' && (
                    <>
                      <li>Candidate — result notification</li>
                      <li>Assigned Candidate RM — outcome</li>
                      <li>Mentor who recorded it — confirmation</li>
                    </>
                  )}
                  {gateResult.gate_type === 'assessment' && gateResult.status === 'pass' && (
                    <>
                      <li>Candidate — Interview Ready notification</li>
                      <li>Assigned Candidate RM — Interview Ready</li>
                      <li>Supplier (if exists) — anonymized notice</li>
                    </>
                  )}
                  {gateResult.gate_type === 'assessment' && gateResult.status !== 'pass' && (
                    <>
                      <li>Candidate — fail notification</li>
                      <li>Assigned Candidate RM — fail outcome</li>
                    </>
                  )}
                  {gateResult.gate_type === 'dt' && (
                    <li>Candidate only (Note: DT results are auto-scored. This is a manual override.)</li>
                  )}
                  {gateResult.gate_type === 'doc_verification' && (
                    <li>Candidate — verification update</li>
                  )}
                  {gateResult.gate_type === 'bootcamp' && (
                    <li>Candidate — bootcamp status update</li>
                  )}
                </ul>
              </div>
            )}
              </>
            )}
          </div>

          {/* Footer Actions */}
          {freshReviewStatus === 'approved' && !isOverriding ? (
            <div className="px-6 py-4 bg-[#F8FAFD] border-t border-[#E2E8F4] flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-[6px] cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setIsOverriding(true)}
                className="px-3.5 py-1.5 text-xs font-semibold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-[6px] cursor-pointer shadow-2xs"
              >
                Override
              </button>
            </div>
          ) : mode === 'view' && (
            <div className="px-6 py-4 bg-[#F8FAFD] border-t border-[#E2E8F4] flex flex-wrap items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setMode('query')}
                className="px-3.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-[6px] flex items-center cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                Request Clarification
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-[6px] cursor-pointer"
                >
                  Close
                </button>

                {isSpeakingTest ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      if (stResult) {
                        setShowStConfirmApprove(true);
                      } else {
                        handleApproveStandard();
                      }
                    }}
                    className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] flex items-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Approve Result
                  </button>
                ) : gateResult.gate_type === 'assessment' &&
                  gateResult.status === 'fail' &&
                  isConsecutiveThirdFail ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleApproveFailLocked}
                    className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-[6px] flex items-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <Lock className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Confirm Fail &amp; Lock Assessment
                  </button>
                ) : gateResult.gate_type === 'assessment' &&
                  gateResult.status === 'fail' ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleApproveFailWithOffering}
                    className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-[6px] flex items-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Approve &amp; Assign Training
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleApproveStandard}
                    className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] flex items-center shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Approve Result
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GateReviewModal;
