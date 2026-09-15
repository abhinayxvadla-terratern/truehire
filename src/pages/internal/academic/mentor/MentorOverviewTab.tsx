import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Users,
  Calendar,
  AlertCircle,
  Clock,
  Mic,
  CheckCircle2,
  ChevronRight,
  Loader2,
  BookOpen,
  HelpCircle,
  Check,
  X,
  Award,
} from 'lucide-react';
import { RecordSpeakingTestModal } from './components/RecordSpeakingTestModal';
import { RecordAssessmentModal } from './components/RecordAssessmentModal';
import { ClarificationResubmitModal } from './components/ClarificationResubmitModal';

interface MentorOverviewTabProps {
  onNavigateTab: (tabId: string) => void;
}

interface ActionItem {
  id: string;
  category:
    | 'cohort_session_today'
    | 'final_test_pending'
    | 'st_queried'
    | 'cooling_active'
    | 'final_test_locked'
    | 'record_st'
    | 'general';
  title: string;
  subtitle: string;
  badge?: { label: string; bg: string; text: string };
  actionBtn?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  isActionRequired: boolean;
}

interface RecentNoteItem {
  id: string;
  candidate_name: string;
  note: string;
  note_type: string;
  is_escalation: boolean;
  created_at: string;
}

interface AttendanceCandidate {
  candidate_id: string;
  candidate_name: string;
}

interface AttendanceSessionTarget {
  id: string;
  cohort_id: string;
  session_number: number;
  session_title: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  cohort_name: string;
}

export const MentorOverviewTab: React.FC<MentorOverviewTabProps> = ({
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // 4 Stats
  const [activeCandidatesCount, setActiveCandidatesCount] = useState(0);
  const [sessionsThisWeekCount, setSessionsThisWeekCount] = useState(0);
  const [actionsRequiredCount, setActionsRequiredCount] = useState(0);
  const [finalTestsPendingCount, setFinalTestsPendingCount] = useState(0);

  // What to Do Next action items
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);

  // Recent notes
  const [recentNotes, setRecentNotes] = useState<RecentNoteItem[]>([]);

  // Action Modals State
  const [activeSpeakingTestCandidate, setActiveSpeakingTestCandidate] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [activeAssessmentCandidate, setActiveAssessmentCandidate] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [activeClarificationData, setActiveClarificationData] = useState<{
    candidateId: string;
    candidateName: string;
    speakingTestResultId: string;
    reviewerNotes: string | null;
    currentMentorNotes: string | null;
  } | null>(null);

  // Attendance Modal state
  const [attendanceSession, setAttendanceSession] =
    useState<AttendanceSessionTarget | null>(null);
  const [attendanceMembers, setAttendanceMembers] = useState<AttendanceCandidate[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [loadingAttendanceMembers, setLoadingAttendanceMembers] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadMentorOverview = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // ─────────────────────────────────────────────────────────────
      // 1. STAT: Active Candidates
      // ─────────────────────────────────────────────────────────────
      const { data: assignments, error: assignErr } = await supabase
        .from('mentor_assignments')
        .select(`
          candidate_id,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            target_role,
            language_level_self_reported,
            final_test_locked,
            consecutive_final_test_fails,
            user_id
          )
        `)
        .eq('mentor_id', user.id)
        .eq('active', true);

      if (assignErr) throw assignErr;

      const activeList = assignments || [];
      setActiveCandidatesCount(activeList.length);
      const myCandidateIds = activeList.map((a: any) => a.candidate_id);

      // ─────────────────────────────────────────────────────────────
      // 2. STAT: Sessions This Week (Monday to Sunday)
      // ─────────────────────────────────────────────────────────────
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 is Sunday
      const diffToMon = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMon);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      const mondayStr = monday.toISOString().split('T')[0];
      const sundayStr = sunday.toISOString().split('T')[0];

      // Fetch my cohorts
      const { data: myCohorts } = await supabase
        .from('cohorts')
        .select('id, name')
        .eq('mentor_id', user.id);

      const myCohortList = myCohorts || [];
      const myCohortIds = myCohortList.map((c) => c.id);
      const cohortNameMap: Record<string, string> = {};
      myCohortList.forEach((c) => {
        cohortNameMap[c.id] = c.name;
      });

      let weeklySessionsCount = 0;
      if (myCohortIds.length > 0) {
        const { count: sCount } = await supabase
          .from('bootcamp_sessions')
          .select('*', { count: 'exact', head: true })
          .in('cohort_id', myCohortIds)
          .gte('session_date', mondayStr)
          .lte('session_date', sundayStr);

        weeklySessionsCount = sCount || 0;
      }
      setSessionsThisWeekCount(weeklySessionsCount);

      // ─────────────────────────────────────────────────────────────
      // 3. STAT: Final Tests Pending
      // ─────────────────────────────────────────────────────────────
      const { count: ftPendingCount, data: ftPendingData } = await supabase
        .from('final_test_attempts')
        .select(`
          id,
          candidate_id,
          review_status,
          candidates:candidate_id (first_name, last_name)
        `, { count: 'exact' })
        .eq('mentor_id', user.id)
        .eq('review_status', 'pending');

      setFinalTestsPendingCount(ftPendingCount || 0);

      // ─────────────────────────────────────────────────────────────
      // 4. ACTION ITEMS: Build "What to Do Next"
      // ─────────────────────────────────────────────────────────────
      const todayStr = now.toISOString().split('T')[0];
      const items: ActionItem[] = [];

      // A. COHORT SESSION TODAY
      if (myCohortIds.length > 0) {
        const { data: todaySessions } = await supabase
          .from('bootcamp_sessions')
          .select('*')
          .in('cohort_id', myCohortIds)
          .eq('session_date', todayStr)
          .eq('status', 'scheduled')
          .order('session_time', { ascending: true });

        (todaySessions || []).forEach((sess: any) => {
          const cName = cohortNameMap[sess.cohort_id] || 'Cohort';
          items.push({
            id: `today_sess_${sess.id}`,
            category: 'cohort_session_today',
            title: `Cohort ${cName} — Session #${sess.session_number}: ${sess.session_title}`,
            subtitle: `Today at ${sess.session_time} (${sess.duration_minutes} mins)`,
            badge: { label: 'Session Today', bg: 'bg-emerald-50 border border-emerald-200', text: 'text-emerald-700' },
            actionBtn: {
              label: 'Mark Attendance',
              onClick: () => {
                handleOpenAttendanceModal({
                  id: sess.id,
                  cohort_id: sess.cohort_id,
                  session_number: sess.session_number,
                  session_title: sess.session_title,
                  session_date: sess.session_date,
                  session_time: sess.session_time,
                  duration_minutes: sess.duration_minutes,
                  cohort_name: cName,
                });
              },
              icon: <Check className="w-3.5 h-3.5 mr-1" />,
            },
            isActionRequired: true,
          });
        });
      }

      // B. ST RESULT QUERIED
      const { data: queriedSTs } = await supabase
        .from('speaking_test_results')
        .select(`
          id,
          candidate_id,
          review_status,
          mentor_notes,
          reviewer_notes,
          candidates:candidate_id (first_name, last_name)
        `)
        .eq('mentor_id', user.id)
        .eq('review_status', 'queried');

      (queriedSTs || []).forEach((st: any) => {
        const c = st.candidates;
        const cName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        items.push({
          id: `st_queried_${st.id}`,
          category: 'st_queried',
          title: `${cName} — Speaking Test result needs clarification`,
          subtitle: st.reviewer_notes
            ? `Query: "${st.reviewer_notes}"`
            : 'Academic Lead requested clarification on evaluation criteria.',
          badge: { label: 'Clarification Requested', bg: 'bg-amber-50 border border-amber-200', text: 'text-amber-800' },
          actionBtn: {
            label: 'Add Clarification',
            onClick: () => {
              setActiveClarificationData({
                candidateId: st.candidate_id,
                candidateName: cName,
                speakingTestResultId: st.id,
                reviewerNotes: st.reviewer_notes,
                currentMentorNotes: st.mentor_notes,
              });
            },
            icon: <HelpCircle className="w-3.5 h-3.5 mr-1" />,
          },
          isActionRequired: true,
        });
      });

      // C. FINAL TEST PENDING REVIEW (Informational)
      (ftPendingData || []).forEach((ft: any) => {
        const c = ft.candidates;
        const cName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        items.push({
          id: `ft_pending_${ft.id}`,
          category: 'final_test_pending',
          title: `${cName} — Final Test result awaiting Academic Lead review`,
          subtitle: 'Evaluation submitted and queued for verification.',
          badge: { label: 'Under Review', bg: 'bg-purple-50 border border-purple-200', text: 'text-purple-800' },
          isActionRequired: false,
        });
      });

      // D. COOLING PERIOD ACTIVE (Informational)
      if (myCandidateIds.length > 0) {
        const { data: coolingList } = await supabase
          .from('cooling_periods')
          .select(`
            id,
            candidate_id,
            ends_at,
            status,
            candidates:candidate_id (first_name, last_name)
          `)
          .in('candidate_id', myCandidateIds)
          .eq('gate_type', 'assessment')
          .eq('status', 'active')
          .gt('ends_at', now.toISOString());

        (coolingList || []).forEach((cp: any) => {
          const c = cp.candidates;
          const cName = c
            ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
            : 'Candidate';
          const endsFormatted = new Date(cp.ends_at).toLocaleDateString();

          items.push({
            id: `cooling_${cp.id}`,
            category: 'cooling_active',
            title: `${cName} — Final Assessment cooling active until ${endsFormatted}`,
            subtitle: 'Candidate is in preparation cooldown period before retake eligibility.',
            badge: { label: 'Cooling Active', bg: 'bg-amber-50 border border-amber-200', text: 'text-amber-800' },
            isActionRequired: false,
          });
        });

        // E. FINAL TEST LOCKED (Informational)
        activeList.forEach((a: any) => {
          const c = a.candidates;
          if (c?.final_test_locked) {
            const cName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate';
            items.push({
              id: `locked_${c.id}`,
              category: 'final_test_locked',
              title: `${cName} — Final Assessment locked — waiting for training completion`,
              subtitle: 'Reached 3 consecutive fails. Test locked until cooling expires & offering availed.',
              badge: { label: 'Test Locked', bg: 'bg-rose-50 border border-rose-200', text: 'text-rose-800' },
              isActionRequired: false,
            });
          }
        });

        // F. CANDIDATES NEEDING SPEAKING TEST
        const { data: gates } = await supabase
          .from('gate_results')
          .select('candidate_id, gate_type')
          .in('candidate_id', myCandidateIds)
          .eq('gate_type', 'speaking_test');

        const candidatesWithST = new Set((gates || []).map((g) => g.candidate_id));

        activeList.forEach((a: any) => {
          const c = a.candidates;
          if (c && !candidatesWithST.has(c.id)) {
            const cName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate';
            items.push({
              id: `st_need_${c.id}`,
              category: 'record_st',
              title: `Conduct Speaking Test for ${cName}`,
              subtitle: `Assigned mentee awaiting diagnostic language evaluation.`,
              badge: { label: 'ST Required', bg: 'bg-blue-50 border border-blue-200', text: 'text-blue-800' },
              actionBtn: {
                label: 'Record Test Result',
                onClick: () => {
                  setActiveSpeakingTestCandidate({ id: c.id, name: cName });
                },
                icon: <Mic className="w-3.5 h-3.5 mr-1" />,
              },
              isActionRequired: true,
            });
          }
        });
      }

      setActionItems(items);
      const actionCount = items.filter((i) => i.isActionRequired).length;
      setActionsRequiredCount(actionCount);

      // ─────────────────────────────────────────────────────────────
      // 5. Recent Session Notes (last 5)
      // ─────────────────────────────────────────────────────────────
      const { data: notes, error: notesErr } = await supabase
        .from('internal_notes')
        .select(`
          id,
          note,
          note_type,
          is_escalation,
          created_at,
          candidates:candidate_id (first_name, last_name)
        `)
        .eq('author_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (notesErr) throw notesErr;

      const mappedNotes: RecentNoteItem[] = (notes || []).map((n: any) => {
        const c = n.candidates;
        const candidateName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        return {
          id: n.id,
          candidate_name: candidateName,
          note: n.note,
          note_type: n.note_type,
          is_escalation: n.is_escalation,
          created_at: n.created_at,
        };
      });

      setRecentNotes(mappedNotes);
    } catch (err) {
      console.error('Error loading mentor overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentorOverview();
  }, [user]);

  // Handle Attendance Modal Open & Member Fetch
  const handleOpenAttendanceModal = async (session: AttendanceSessionTarget) => {
    setAttendanceSession(session);
    setAttendanceNotes('');
    setLoadingAttendanceMembers(true);

    try {
      const { data: membersData } = await supabase
        .from('cohort_members')
        .select(`
          candidate_id,
          candidates:candidate_id (id, first_name, last_name)
        `)
        .eq('cohort_id', session.cohort_id);

      const memList: AttendanceCandidate[] = (membersData || []).map((m: any) => {
        const c = m.candidates;
        const name = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';
        return {
          candidate_id: m.candidate_id,
          candidate_name: name,
        };
      });

      setAttendanceMembers(memList);

      // Default all to present
      const defaultMap: Record<string, boolean> = {};
      memList.forEach((m) => {
        defaultMap[m.candidate_id] = true;
      });
      setAttendanceMap(defaultMap);
    } catch (err) {
      console.error('Error fetching members for attendance:', err);
    } finally {
      setLoadingAttendanceMembers(false);
    }
  };

  // Handle Save Attendance
  const handleSaveAttendance = async () => {
    if (!user || !attendanceSession) return;

    try {
      setSavingAttendance(true);

      const records = attendanceMembers.map((m) => ({
        session_id: attendanceSession.id,
        candidate_id: m.candidate_id,
        cohort_id: attendanceSession.cohort_id,
        attended: Boolean(attendanceMap[m.candidate_id]),
        notes: attendanceNotes.trim() || null,
        marked_by: user.id,
      }));

      // Upsert attendance
      const { error: attErr } = await supabase
        .from('bootcamp_attendance')
        .upsert(records, { onConflict: 'session_id,candidate_id' });

      if (attErr) throw attErr;

      // Ensure each member has gate_results for bootcamp
      for (const m of attendanceMembers) {
        const { data: existingGate } = await supabase
          .from('gate_results')
          .select('id')
          .eq('candidate_id', m.candidate_id)
          .eq('gate_type', 'bootcamp')
          .maybeSingle();

        if (!existingGate) {
          await supabase.from('gate_results').insert({
            candidate_id: m.candidate_id,
            gate_type: 'bootcamp',
            status: 'in_progress',
            recorded_by: user.id,
            review_status: 'not_required',
          });
        }
      }

      const presentCount = Object.values(attendanceMap).filter(Boolean).length;
      const absentCount = attendanceMembers.length - presentCount;

      showToast(`Attendance saved: ${presentCount} present, ${absentCount} absent.`);
      setAttendanceSession(null);
      loadMentorOverview();
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      alert(err.message || 'Failed to save attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg flex items-center space-x-2 text-xs animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Speaking Test Modal */}
      {activeSpeakingTestCandidate && (
        <RecordSpeakingTestModal
          candidateId={activeSpeakingTestCandidate.id}
          candidateName={activeSpeakingTestCandidate.name}
          onClose={() => setActiveSpeakingTestCandidate(null)}
          onSuccess={() => {
            showToast('Result submitted for Academic Lead review.');
            loadMentorOverview();
          }}
        />
      )}

      {/* Assessment Modal */}
      {activeAssessmentCandidate && (
        <RecordAssessmentModal
          candidateId={activeAssessmentCandidate.id}
          candidateName={activeAssessmentCandidate.name}
          onClose={() => setActiveAssessmentCandidate(null)}
          onSuccess={() => {
            showToast('Assessment submitted for Academic Lead review.');
            loadMentorOverview();
          }}
        />
      )}

      {/* ST Clarification Modal */}
      {activeClarificationData && (
        <ClarificationResubmitModal
          candidateId={activeClarificationData.candidateId}
          candidateName={activeClarificationData.candidateName}
          speakingTestResultId={activeClarificationData.speakingTestResultId}
          reviewerNotes={activeClarificationData.reviewerNotes}
          currentMentorNotes={activeClarificationData.currentMentorNotes}
          onClose={() => setActiveClarificationData(null)}
          onSuccess={() => {
            showToast('Clarification response submitted to Academic Lead.');
            loadMentorOverview();
          }}
        />
      )}

      {/* Attendance Modal */}
      {attendanceSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Attendance — Session #{attendanceSession.session_number}:{' '}
                  {attendanceSession.session_title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Cohort: {attendanceSession.cohort_name} • Today at{' '}
                  {attendanceSession.session_time} ({attendanceSession.duration_minutes} mins)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAttendanceSession(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {loadingAttendanceMembers ? (
                <div className="py-8 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-[#1B3270]" />
                  Loading enrolled candidates...
                </div>
              ) : attendanceMembers.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  No candidates currently enrolled in this cohort.
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F4]">
                    <span className="font-semibold text-slate-700">Enrolled Candidate</span>
                    <span className="font-semibold text-slate-700">Attendance Toggle</span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {attendanceMembers.map((m) => {
                      const isPresent = Boolean(attendanceMap[m.candidate_id]);
                      return (
                        <div
                          key={m.candidate_id}
                          className="flex items-center justify-between p-2 rounded-[6px] hover:bg-slate-50 transition-colors border border-slate-100"
                        >
                          <span className="font-medium text-slate-800">
                            {m.candidate_name}
                          </span>
                          <div className="flex items-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setAttendanceMap((prev) => ({
                                  ...prev,
                                  [m.candidate_id]: true,
                                }))
                              }
                              className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold transition-colors cursor-pointer ${
                                isPresent
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              Present ●
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAttendanceMap((prev) => ({
                                  ...prev,
                                  [m.candidate_id]: false,
                                }))
                              }
                              className={`px-2.5 py-1 rounded-[5px] text-[11px] font-semibold transition-colors cursor-pointer ${
                                !isPresent
                                  ? 'bg-rose-600 text-white shadow-2xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              Absent ○
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Session notes (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={attendanceNotes}
                      onChange={(e) => setAttendanceNotes(e.target.value)}
                      placeholder="Record topics covered, student engagement, or observations..."
                      className="w-full text-xs p-2.5 border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                    <button
                      type="button"
                      onClick={() => setAttendanceSession(null)}
                      className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px] font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={savingAttendance}
                      onClick={handleSaveAttendance}
                      className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#16285a] text-white font-semibold rounded-[6px] disabled:opacity-50 flex items-center space-x-1 shadow-2xs"
                    >
                      {savingAttendance && (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                      )}
                      <span>Save Attendance</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STATS ROW — 4 cards
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Active Candidates */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">Active Candidates</span>
            <div className="w-7 h-7 rounded-md bg-blue-50 flex items-center justify-center text-[#1B3270]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1B3270] mt-2">
              {loading ? '—' : activeCandidatesCount}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Mentees currently in your academic roster
            </p>
          </div>
        </div>

        {/* Card 2: Sessions This Week */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">Sessions This Week</span>
            <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1B3270] mt-2">
              {loading ? '—' : sessionsThisWeekCount}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Bootcamp sessions across your cohorts
            </p>
          </div>
        </div>

        {/* Card 3: Actions Required */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">Actions Required</span>
            <div className="w-7 h-7 rounded-md bg-amber-50 flex items-center justify-center text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1B3270] mt-2">
              {loading ? '—' : actionsRequiredCount}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Sessions today, ST evaluations, & queries
            </p>
          </div>
        </div>

        {/* Card 4: Final Tests Pending */}
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs flex flex-col justify-between min-h-[104px]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#94A3B8]">Final Tests Pending</span>
            <div className="w-7 h-7 rounded-md bg-purple-50 flex items-center justify-center text-purple-600">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-[#1B3270] mt-2">
              {loading ? '—' : finalTestsPendingCount}
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Results awaiting Academic Lead review
            </p>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          WHAT TO DO NEXT — Main Queue Card
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#E2E8F4] flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1B3270] animate-pulse" />
              <h3 className="text-sm font-bold text-slate-800">
                What to Do Next ({actionItems.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Actionable tasks, today's cohort sessions, pending evaluations, and cooling period trackers
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onNavigateTab('my-cohorts')}
              className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center"
            >
              My Cohorts
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => onNavigateTab('my-candidates')}
              className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center"
            >
              My Candidates
              <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1B3270]" />
            Loading mentor actions...
          </div>
        ) : actionItems.length === 0 ? (
          <div className="py-16 px-4 text-center text-xs">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <h4 className="font-semibold text-slate-700">All caught up!</h4>
            <p className="text-slate-400 text-[11px] mt-0.5 max-w-sm mx-auto">
              No sessions scheduled today, pending evaluations, or clarification queries awaiting your response.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F4]">
            {actionItems.map((item) => (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900 text-sm">
                      {item.title}
                    </span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badge.bg} ${item.badge.text}`}
                      >
                        {item.badge.label}
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    {item.subtitle}
                  </p>
                </div>

                <div className="shrink-0 flex items-center space-x-2">
                  {item.actionBtn ? (
                    <button
                      type="button"
                      onClick={item.actionBtn.onClick}
                      className="px-3.5 py-1.5 bg-[#1B3270] hover:bg-[#16285a] text-white font-semibold rounded-[6px] text-xs shadow-2xs flex items-center cursor-pointer transition-colors"
                    >
                      {item.actionBtn.icon}
                      <span>{item.actionBtn.label}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium italic">
                      Informational
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RECENT SESSION NOTES CARD
      ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F4] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-[#1B3270]" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Recent Session Notes ({recentNotes.length})
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('session-notes')}
            className="text-xs text-[#1B3270] font-semibold hover:underline"
          >
            View All Notes &rarr;
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
            Loading notes...
          </div>
        ) : recentNotes.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-xs">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="font-semibold text-slate-600">No session notes recorded yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Notes recorded during speaking tests and coaching sessions will show here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F4]">
            {recentNotes.map((note) => (
              <div
                key={note.id}
                className="p-3.5 hover:bg-slate-50/60 transition-colors flex items-start justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-800">
                      {note.candidate_name}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        note.note_type === 'session'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {note.note_type}
                    </span>
                    {note.is_escalation && (
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 flex items-center">
                        <AlertCircle className="w-2.5 h-2.5 mr-0.5" />
                        Escalation
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 line-clamp-2 leading-relaxed">
                    {note.note}
                  </p>
                </div>

                <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                  {new Date(note.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MentorOverviewTab;
