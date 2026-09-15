import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import { notifyByRole } from '../../../../utils/notificationRouting';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Plus,
  Check,
  X,
  Award,
  BookOpen,
  Lock,
  Eye,
} from 'lucide-react';

interface CohortSummary {
  id: string;
  name: string;
  track: string;
  status: 'proposed' | 'approved' | 'active' | 'completed' | 'cancelled';
  bootcamp_start_date: string;
  bootcamp_end_date: string;
  members_count: number;
  total_sessions: number;
  completed_sessions: number;
}

interface CohortMemberDetail {
  candidate_id: string;
  candidate_name: string;
  target_role: string | null;
  language_level: string | null;
  track: string | null;
  st_outcome: 'pass' | 'fail' | 'not_taken';
  attended_sessions: number;
  total_sessions: number;
  final_test_attempts_count: number;
  consecutive_final_test_fails: number;
  final_test_locked: boolean;
  latest_final_review_status: string | null;
  latest_final_outcome: string | null;
  candidate_user_id: string | null;
}

interface BootcampSessionItem {
  id: string;
  cohort_id: string;
  session_number: number;
  session_title: string;
  session_date: string;
  session_time: string;
  duration_minutes: number;
  topic: string | null;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
}

interface MentorCohortsTabProps {
  initialCohortId?: string | null;
}

export const MentorCohortsTab: React.FC<MentorCohortsTabProps> = ({
  initialCohortId,
}) => {
  const { user, profile } = useAuth();
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Single cohort manage view
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(
    initialCohortId || null
  );
  const [activeCohort, setActiveCohort] = useState<CohortSummary | null>(null);
  const [members, setMembers] = useState<CohortMemberDetail[]>([]);
  const [sessions, setSessions] = useState<BootcampSessionItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Attendance modal
  const [attendanceSession, setAttendanceSession] =
    useState<BootcampSessionItem | null>(null);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, boolean>>({});
  const [attendanceNotes, setAttendanceNotes] = useState('');
  const [savingAttendance, setSavingAttendance] = useState(false);

  // View Attendance modal
  const [viewAttendanceSession, setViewAttendanceSession] =
    useState<BootcampSessionItem | null>(null);
  const [pastAttendanceList, setPastAttendanceList] = useState<
    Array<{ candidate_id: string; candidate_name: string; attended: boolean; notes: string | null }>
  >([]);
  const [loadingPastAttendance, setLoadingPastAttendance] = useState(false);

  // Add Session modal
  const [isAddSessionOpen, setIsAddSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionTime, setNewSessionTime] = useState('10:00');
  const [newSessionDuration, setNewSessionDuration] = useState(90);
  const [newSessionTopic, setNewSessionTopic] = useState('');
  const [addingSession, setAddingSession] = useState(false);

  // Record Final Test modal
  const [finalTestCandidate, setFinalTestCandidate] =
    useState<CohortMemberDetail | null>(null);
  const [finalScore, setFinalScore] = useState<number>(75);
  const [finalOutcome, setFinalOutcome] = useState<'pass' | 'fail'>('pass');
  const [finalMentorNotes, setFinalMentorNotes] = useState('');
  const [candidateAttemptsHistory, setCandidateAttemptsHistory] = useState<
    Array<{ attempt_number: number; created_at: string; score: number; outcome: string }>
  >([]);
  const [recordingFinalTest, setRecordingFinalTest] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchMyCohorts = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const { data: cList, error: cErr } = await supabase
        .from('cohorts')
        .select(`
          id,
          name,
          track,
          status,
          bootcamp_start_date,
          bootcamp_end_date,
          created_at
        `)
        .eq('mentor_id', user.id)
        .in('status', ['approved', 'active', 'completed', 'cancelled'])
        .order('bootcamp_start_date', { ascending: false });

      if (cErr) throw cErr;

      const cohortIds = (cList || []).map((c) => c.id);

      // Members count per cohort
      const membersCountMap: Record<string, number> = {};
      if (cohortIds.length > 0) {
        const { data: mData } = await supabase
          .from('cohort_members')
          .select('cohort_id')
          .in('cohort_id', cohortIds);

        (mData || []).forEach((m) => {
          membersCountMap[m.cohort_id] = (membersCountMap[m.cohort_id] || 0) + 1;
        });
      }

      // Sessions count per cohort
      const totalSessionsMap: Record<string, number> = {};
      const completedSessionsMap: Record<string, number> = {};

      if (cohortIds.length > 0) {
        const { data: sData } = await supabase
          .from('bootcamp_sessions')
          .select('cohort_id, status')
          .in('cohort_id', cohortIds);

        (sData || []).forEach((s) => {
          totalSessionsMap[s.cohort_id] = (totalSessionsMap[s.cohort_id] || 0) + 1;
          if (s.status === 'completed') {
            completedSessionsMap[s.cohort_id] =
              (completedSessionsMap[s.cohort_id] || 0) + 1;
          }
        });
      }

      const summaries: CohortSummary[] = (cList || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        track: c.track || 'Pass Track',
        status: c.status,
        bootcamp_start_date: c.bootcamp_start_date,
        bootcamp_end_date: c.bootcamp_end_date,
        members_count: membersCountMap[c.id] || 0,
        total_sessions: totalSessionsMap[c.id] || 0,
        completed_sessions: completedSessionsMap[c.id] || 0,
      }));

      setCohorts(summaries);

      if (selectedCohortId) {
        const match = summaries.find((s) => s.id === selectedCohortId);
        if (match) setActiveCohort(match);
      }
    } catch (err) {
      console.error('Error fetching cohorts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyCohorts();
  }, [user]);

  // Load single cohort detail
  const loadCohortDetail = async (cohortId: string) => {
    try {
      setLoadingDetail(true);

      // 1. Sessions
      const { data: sList, error: sErr } = await supabase
        .from('bootcamp_sessions')
        .select('*')
        .eq('cohort_id', cohortId)
        .order('session_number', { ascending: true });

      if (sErr) throw sErr;
      const sessionItems = (sList || []) as BootcampSessionItem[];
      setSessions(sessionItems);

      // 2. Members with candidate details
      const { data: mList, error: mErr } = await supabase
        .from('cohort_members')
        .select(`
          candidate_id,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            target_role,
            language_level_self_reported,
            speaking_test_track,
            consecutive_final_test_fails,
            final_test_locked,
            user_id
          )
        `)
        .eq('cohort_id', cohortId);

      if (mErr) throw mErr;

      const candIds = (mList || []).map((m: any) => m.candidate_id);

      // Fetch ST outcomes
      const stMap: Record<string, 'pass' | 'fail' | 'not_taken'> = {};
      if (candIds.length > 0) {
        const { data: stData } = await supabase
          .from('speaking_test_results')
          .select('candidate_id, overall_outcome, review_status')
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        (stData || []).forEach((st: any) => {
          if (!stMap[st.candidate_id]) {
            stMap[st.candidate_id] = st.overall_outcome || 'pass';
          }
        });
      }

      // Fetch Attendance
      const attendanceMapPerCandidate: Record<string, number> = {};
      if (sessionItems.length > 0 && candIds.length > 0) {
        const sessionIds = sessionItems.map((s) => s.id);
        const { data: attData } = await supabase
          .from('bootcamp_attendance')
          .select('candidate_id, attended')
          .in('session_id', sessionIds)
          .eq('attended', true);

        (attData || []).forEach((att) => {
          attendanceMapPerCandidate[att.candidate_id] =
            (attendanceMapPerCandidate[att.candidate_id] || 0) + 1;
        });
      }

      // Fetch Final Test Attempts
      const ftAttemptsMap: Record<
        string,
        { count: number; consecutiveFails: number; lastOutcome: string | null; reviewStatus: string | null }
      > = {};

      if (candIds.length > 0) {
        const { data: ftData } = await supabase
          .from('final_test_attempts')
          .select('candidate_id, outcome, review_status, consecutive_fail_count')
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        (ftData || []).forEach((ft: any) => {
          if (!ftAttemptsMap[ft.candidate_id]) {
            ftAttemptsMap[ft.candidate_id] = {
              count: 1,
              consecutiveFails: ft.consecutive_fail_count || 0,
              lastOutcome: ft.outcome,
              reviewStatus: ft.review_status,
            };
          } else {
            ftAttemptsMap[ft.candidate_id].count += 1;
          }
        });
      }

      const mappedMembers: CohortMemberDetail[] = (mList || []).map((m: any) => {
        const c = m.candidates;
        const cName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        const ftInfo = ftAttemptsMap[m.candidate_id];

        return {
          candidate_id: m.candidate_id,
          candidate_name: cName,
          target_role: c?.target_role || null,
          language_level: c?.language_level_self_reported || null,
          track: c?.speaking_test_track || null,
          st_outcome: stMap[m.candidate_id] || 'not_taken',
          attended_sessions: attendanceMapPerCandidate[m.candidate_id] || 0,
          total_sessions: sessionItems.length,
          final_test_attempts_count: ftInfo?.count || 0,
          consecutive_final_test_fails:
            c?.consecutive_final_test_fails ?? ftInfo?.consecutiveFails ?? 0,
          final_test_locked: Boolean(c?.final_test_locked),
          latest_final_review_status: ftInfo?.reviewStatus || null,
          latest_final_outcome: ftInfo?.lastOutcome || null,
          candidate_user_id: c?.user_id || null,
        };
      });

      setMembers(mappedMembers);
    } catch (err) {
      console.error('Error loading cohort detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (selectedCohortId) {
      const match = cohorts.find((c) => c.id === selectedCohortId);
      if (match) setActiveCohort(match);
      loadCohortDetail(selectedCohortId);
    } else {
      setActiveCohort(null);
      setMembers([]);
      setSessions([]);
    }
  }, [selectedCohortId]);

  // Handle Mark Session as Completed
  const handleMarkSessionCompleted = async (session: BootcampSessionItem) => {
    try {
      const { error } = await supabase
        .from('bootcamp_sessions')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', session.id);

      if (error) throw error;

      showToast(`Session ${session.session_number} marked as completed.`);
      if (selectedCohortId) {
        loadCohortDetail(selectedCohortId);
        fetchMyCohorts();
      }
    } catch (err: any) {
      console.error('Error completing session:', err);
      alert(err.message || 'Failed to update session');
    }
  };

  // Open Attendance Modal
  const handleOpenAttendanceModal = (session: BootcampSessionItem) => {
    setAttendanceSession(session);
    setAttendanceNotes('');

    // Default all members to present
    const defaultMap: Record<string, boolean> = {};
    members.forEach((m) => {
      defaultMap[m.candidate_id] = true;
    });
    setAttendanceMap(defaultMap);
  };

  // Save Attendance
  const handleSaveAttendance = async () => {
    if (!user || !attendanceSession || !selectedCohortId) return;

    try {
      setSavingAttendance(true);

      const records = members.map((m) => ({
        session_id: attendanceSession.id,
        candidate_id: m.candidate_id,
        cohort_id: selectedCohortId,
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
      for (const m of members) {
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
      const absentCount = members.length - presentCount;

      showToast(`Attendance saved: ${presentCount} present, ${absentCount} absent.`);
      setAttendanceSession(null);
      if (selectedCohortId) {
        loadCohortDetail(selectedCohortId);
      }
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      alert(err.message || 'Failed to save attendance');
    } finally {
      setSavingAttendance(false);
    }
  };

  // View Past Attendance
  const handleOpenViewAttendance = async (session: BootcampSessionItem) => {
    setViewAttendanceSession(session);
    setLoadingPastAttendance(true);

    try {
      const { data, error } = await supabase
        .from('bootcamp_attendance')
        .select(`
          candidate_id,
          attended,
          notes,
          candidates:candidate_id (first_name, last_name)
        `)
        .eq('session_id', session.id);

      if (error) throw error;

      const list = (data || []).map((d: any) => {
        const c = d.candidates;
        const name = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';
        return {
          candidate_id: d.candidate_id,
          candidate_name: name,
          attended: Boolean(d.attended),
          notes: d.notes,
        };
      });

      setPastAttendanceList(list);
    } catch (err) {
      console.error('Error loading past attendance:', err);
    } finally {
      setLoadingPastAttendance(false);
    }
  };

  // Add Session
  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCohortId || !newSessionTitle.trim() || !newSessionDate) return;

    try {
      setAddingSession(true);

      const nextNumber =
        sessions.length > 0
          ? Math.max(...sessions.map((s) => s.session_number)) + 1
          : 1;

      const { error: sErr } = await supabase
        .from('bootcamp_sessions')
        .insert({
          cohort_id: selectedCohortId,
          session_number: nextNumber,
          session_title: newSessionTitle.trim(),
          session_date: newSessionDate,
          session_time: newSessionTime,
          duration_minutes: Number(newSessionDuration) || 90,
          topic: newSessionTopic.trim() || null,
          status: 'scheduled',
          created_by: user.id,
        })
        .select()
        .single();

      if (sErr) throw sErr;

      // Notify all cohort member candidates
      const memberUserIds = members
        .map((m) => m.candidate_user_id)
        .filter((uid): uid is string => Boolean(uid));

      if (memberUserIds.length > 0) {
        const notifs = memberUserIds.map((uid) => ({
          user_id: uid,
          title: 'New Bootcamp Session Scheduled',
          message: `Session ${nextNumber}: "${newSessionTitle.trim()}" is scheduled for ${newSessionDate} at ${newSessionTime}.`,
          type: 'academic',
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifs);
      }

      showToast(`Session ${nextNumber} added successfully.`);
      setIsAddSessionOpen(false);
      setNewSessionTitle('');
      setNewSessionDate('');
      setNewSessionTopic('');
      loadCohortDetail(selectedCohortId);
      fetchMyCohorts();
    } catch (err: any) {
      console.error('Error adding session:', err);
      alert(err.message || 'Failed to add session');
    } finally {
      setAddingSession(false);
    }
  };

  // Open Final Test Modal
  const handleOpenFinalTestModal = async (member: CohortMemberDetail) => {
    setFinalTestCandidate(member);
    setFinalScore(75);
    setFinalOutcome('pass');
    setFinalMentorNotes('');

    try {
      const { data } = await supabase
        .from('final_test_attempts')
        .select('attempt_number, created_at, score, outcome')
        .eq('candidate_id', member.candidate_id)
        .order('attempt_number', { ascending: true });

      setCandidateAttemptsHistory(data || []);
    } catch (err) {
      console.error('Error loading attempt history:', err);
    }
  };

  // Submit Final Test
  const handleSubmitFinalTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !finalTestCandidate || !selectedCohortId) return;

    if (!finalMentorNotes.trim()) {
      alert('Mentor notes are required.');
      return;
    }

    try {
      setRecordingFinalTest(true);

      const nextAttemptNumber = candidateAttemptsHistory.length + 1;
      const newConsecutiveFails =
        finalOutcome === 'fail'
          ? (finalTestCandidate.consecutive_final_test_fails || 0) + 1
          : 0;

      // 1. Insert final_test_attempts
      const { error: ftErr } = await supabase.from('final_test_attempts').insert({
        candidate_id: finalTestCandidate.candidate_id,
        cohort_id: selectedCohortId,
        mentor_id: user.id,
        attempt_number: nextAttemptNumber,
        score: finalScore,
        score_pct: finalScore,
        max_score: 100,
        pass_threshold_pct: 60,
        outcome: finalOutcome,
        mentor_notes: finalMentorNotes.trim(),
        review_status: 'pending',
        consecutive_fail_count: newConsecutiveFails,
      });

      if (ftErr) throw ftErr;

      // 2. Insert gate_results
      const { error: gErr } = await supabase.from('gate_results').insert({
        candidate_id: finalTestCandidate.candidate_id,
        gate_type: 'assessment',
        score: finalScore,
        status: finalOutcome,
        recorded_by: user.id,
        review_status: 'pending',
        notes: finalMentorNotes.trim(),
      });

      if (gErr) throw gErr;

      // 3. Notify Academic Lead
      const mentorDisplayName =
        profile?.first_name && profile?.last_name
          ? `${profile.first_name} ${profile.last_name}`
          : 'Mentor';

      await notifyByRole(
        supabase,
        'academic_lead',
        'Final Assessment Submitted for Review',
        `Mentor ${mentorDisplayName} recorded Final Assessment for ${finalTestCandidate.candidate_name} (${finalOutcome.toUpperCase()}, ${finalScore}%) — review and approve.`,
        'academic',
        user.id
      );

      showToast(`Final Assessment submitted for ${finalTestCandidate.candidate_name}.`);
      setFinalTestCandidate(null);
      if (selectedCohortId) {
        loadCohortDetail(selectedCohortId);
      }
    } catch (err: any) {
      console.error('Error submitting final test:', err);
      alert(err.message || 'Failed to submit final test');
    } finally {
      setRecordingFinalTest(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const allSessionsCompleted =
    sessions.length > 0 && sessions.every((s) => s.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg flex items-center space-x-2 text-xs animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VIEW 1: COHORT CARDS DIRECTORY
      ───────────────────────────────────────────────────────────── */}
      {!selectedCohortId ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-[10px] border border-[#E2E8F4] shadow-2xs">
            <div>
              <h2 className="text-base font-bold text-slate-800">My Cohorts</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Active & completed training cohorts assigned to you as mentor
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200 self-start sm:self-auto">
              {cohorts.length} Cohort{cohorts.length === 1 ? '' : 's'}
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1B3270]" />
              Loading your assigned cohorts...
            </div>
          ) : cohorts.length === 0 ? (
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] py-16 px-4 text-center shadow-2xs">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-700">
                No cohorts currently assigned
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                When an Academic Lead proposes or activates a cohort under your mentorship, it will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {cohorts.map((cohort) => {
                const completionPct =
                  cohort.total_sessions > 0
                    ? Math.round(
                        (cohort.completed_sessions / cohort.total_sessions) * 100
                      )
                    : 0;

                return (
                  <div
                    key={cohort.id}
                    className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-sm font-bold text-slate-900 leading-snug">
                            {cohort.name}
                          </h3>
                          <span
                            className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              cohort.track.toLowerCase().includes('pass')
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {cohort.track}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            cohort.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : cohort.status === 'completed'
                              ? 'bg-purple-100 text-purple-800'
                              : cohort.status === 'approved'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {cohort.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1 pt-1">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center">
                            <Users className="w-3.5 h-3.5 mr-1 text-slate-400" />
                            {cohort.members_count} member{cohort.members_count === 1 ? '' : 's'}
                          </span>
                          <span className="font-semibold text-slate-700">
                            {cohort.completed_sessions} / {cohort.total_sessions} sessions done
                          </span>
                        </div>

                        <div className="flex items-center text-[11px]">
                          <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                          <span>
                            {cohort.bootcamp_start_date
                              ? new Date(cohort.bootcamp_start_date).toLocaleDateString()
                              : 'TBD'}{' '}
                            –{' '}
                            {cohort.bootcamp_end_date
                              ? new Date(cohort.bootcamp_end_date).toLocaleDateString()
                              : 'TBD'}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                          <span>Curriculum Progress</span>
                          <span>{completionPct}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#1B3270] h-full rounded-full transition-all duration-300"
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCohortId(cohort.id)}
                      className="w-full py-2 bg-[#1B3270] hover:bg-[#16285a] text-white text-xs font-semibold rounded-[6px] transition-colors flex items-center justify-center space-x-1 shadow-2xs cursor-pointer"
                    >
                      <span>Manage Cohort</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ─────────────────────────────────────────────────────────────
            VIEW 2: SINGLE COHORT MANAGEMENT (FULL-PAGE VIEW)
        ───────────────────────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Header & Back Button */}
          <div className="bg-white p-5 rounded-[10px] border border-[#E2E8F4] shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => setSelectedCohortId(null)}
                className="text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] flex items-center mb-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back to My Cohorts
              </button>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-lg font-bold text-slate-900">
                  {activeCohort?.name || 'Cohort Details'}
                </h1>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeCohort?.track.toLowerCase().includes('pass')
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {activeCohort?.track}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    activeCohort?.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : activeCohort?.status === 'completed'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {activeCohort?.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center space-x-3 pt-0.5">
                <span>
                  Date Range:{' '}
                  {activeCohort?.bootcamp_start_date
                    ? new Date(activeCohort.bootcamp_start_date).toLocaleDateString()
                    : 'TBD'}{' '}
                  –{' '}
                  {activeCohort?.bootcamp_end_date
                    ? new Date(activeCohort.bootcamp_end_date).toLocaleDateString()
                    : 'TBD'}
                </span>
                <span>•</span>
                <span>{members.length} Enrolled Candidate{members.length === 1 ? '' : 's'}</span>
                <span>•</span>
                <span>{sessions.length} Scheduled Session{sessions.length === 1 ? '' : 's'}</span>
              </p>
            </div>

            {(activeCohort?.status === 'approved' || activeCohort?.status === 'active') && (
              <button
                type="button"
                onClick={() => setIsAddSessionOpen(true)}
                className="px-3.5 py-2 bg-[#1B3270] hover:bg-[#16285a] text-white text-xs font-semibold rounded-[6px] flex items-center space-x-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Session</span>
              </button>
            )}
          </div>

          {loadingDetail ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1B3270]" />
              Loading cohort curriculum & members...
            </div>
          ) : (
            <>
              {/* ─────────────────────────────────────────────────────────────
                  SECTION: MEMBERS TABLE
              ───────────────────────────────────────────────────────────── */}
              <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F4] flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
                      <Users className="w-4 h-4 mr-1.5 text-[#1B3270]" />
                      Cohort Members ({members.length})
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Attendance rates and exit assessment eligibility
                    </p>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px]">
                    <span className="flex items-center text-amber-700 font-medium">
                      <span className="w-2.5 h-2.5 bg-amber-400 rounded-sm mr-1.5" />
                      Amber: Consecutive fails ≥ 2
                    </span>
                    <span className="flex items-center text-rose-700 font-medium">
                      <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm mr-1.5" />
                      Red: Assessment Locked
                    </span>
                  </div>
                </div>

                {members.length === 0 ? (
                  <div className="py-12 px-4 text-center text-slate-400 text-xs">
                    No candidates are currently enrolled in this cohort.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Candidate Name</th>
                          <th className="py-3 px-4">ST Outcome</th>
                          <th className="py-3 px-4">Language Level</th>
                          <th className="py-3 px-4 text-center">Attendance</th>
                          <th className="py-3 px-4 text-center">Final Test Attempts</th>
                          <th className="py-3 px-4 text-center">Consecutive Fails</th>
                          <th className="py-3 px-4 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                        {members.map((m) => {
                          const isLocked = m.final_test_locked;
                          const isAmber =
                            !isLocked && m.consecutive_final_test_fails >= 2;

                          return (
                            <tr
                              key={m.candidate_id}
                              className={`transition-colors ${
                                isLocked
                                  ? 'bg-rose-50/60 border-l-4 border-l-rose-500'
                                  : isAmber
                                  ? 'bg-amber-50/60 border-l-4 border-l-amber-400'
                                  : 'hover:bg-slate-50/60'
                              }`}
                            >
                              <td className="py-3 px-4 font-bold text-slate-900">
                                <div>{m.candidate_name}</div>
                                <div className="text-[10px] text-slate-400 font-normal">
                                  {m.target_role || 'Candidate'}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    m.st_outcome === 'pass'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : m.st_outcome === 'fail'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {m.st_outcome.toUpperCase()}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-semibold text-slate-700">
                                  {m.language_level || 'B1'}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-semibold text-slate-800">
                                  {m.attended_sessions} / {m.total_sessions}
                                </span>
                                <span className="text-[10px] text-slate-400 ml-1">
                                  (
                                  {m.total_sessions > 0
                                    ? Math.round(
                                        (m.attended_sessions / m.total_sessions) * 100
                                      )
                                    : 0}
                                  %)
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center font-medium text-slate-700">
                                {m.final_test_attempts_count}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {m.consecutive_final_test_fails > 0 ? (
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      m.consecutive_final_test_fails >= 3
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}
                                  >
                                    {m.consecutive_final_test_fails} / 3
                                  </span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                {isLocked ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                    <Lock className="w-3 h-3 mr-1" />
                                    Locked
                                  </span>
                                ) : m.latest_final_review_status === 'pending' ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Review Pending
                                  </span>
                                ) : m.latest_final_outcome === 'pass' ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Passed Assessment
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                    In Training
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  SECTION: SESSIONS LIST
              ───────────────────────────────────────────────────────────── */}
              <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
                <div className="p-4 border-b border-[#E2E8F4] flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center">
                      <BookOpen className="w-4 h-4 mr-1.5 text-[#1B3270]" />
                      Bootcamp Sessions ({sessions.length})
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Session schedules, attendance rosters, and completion records
                    </p>
                  </div>
                </div>

                {sessions.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <h4 className="text-xs font-semibold text-slate-700">
                      No sessions created yet
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Click "+ Add Session" above to schedule the first curriculum module.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E2E8F4]">
                    {sessions.map((session) => {
                      const isPastOrToday = session.session_date <= todayStr;
                      const daysAway = Math.ceil(
                        (new Date(session.session_date).getTime() - Date.now()) /
                          (1000 * 60 * 60 * 24)
                      );

                      return (
                        <div
                          key={session.id}
                          className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-sm">
                                Session #{session.session_number}: {session.session_title}
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                  session.status === 'completed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : session.status === 'cancelled'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {session.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                              <span className="flex items-center">
                                <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                {new Date(session.session_date).toLocaleDateString()} at{' '}
                                {session.session_time}
                              </span>
                              <span>•</span>
                              <span className="flex items-center">
                                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                                {session.duration_minutes} mins
                              </span>
                              {session.topic && (
                                <>
                                  <span>•</span>
                                  <span>Topic: {session.topic}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center space-x-2 shrink-0">
                            {session.status === 'completed' ? (
                              <button
                                type="button"
                                onClick={() => handleOpenViewAttendance(session)}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-[6px] transition-colors flex items-center space-x-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                                <span>View Attendance</span>
                              </button>
                            ) : isPastOrToday ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenAttendanceModal(session)}
                                  className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#16285a] text-white text-xs font-semibold rounded-[6px] transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5 mr-1" />
                                  <span>Mark Attendance</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMarkSessionCompleted(session)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-[6px] transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                  <span>Mark as Completed</span>
                                </button>
                              </>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-[6px]">
                                Upcoming — {daysAway} day{daysAway === 1 ? '' : 's'} away
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  SECTION: FINAL TEST ADMINISTRATION
                  (Only shown after all sessions completed)
              ───────────────────────────────────────────────────────────── */}
              {allSessionsCompleted && (
                <div className="bg-white border-2 border-emerald-300 rounded-[10px] shadow-sm overflow-hidden animate-in fade-in duration-200">
                  <div className="p-4 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-emerald-950 flex items-center">
                        <Award className="w-4 h-4 mr-1.5 text-emerald-700" />
                        Bootcamp Complete — Administer Final Assessment
                      </h3>
                      <p className="text-xs text-emerald-800 mt-0.5">
                        All sessions have been conducted. Record final evaluation results for enrolled candidates.
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full">
                      Ready for Assessment
                    </span>
                  </div>

                  <div className="divide-y divide-[#E2E8F4]">
                    {members.map((member) => {
                      const isLocked = member.final_test_locked;
                      const isReviewPending =
                        member.latest_final_review_status === 'pending';

                      return (
                        <div
                          key={member.candidate_id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/60 transition-colors"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900 text-sm">
                                {member.candidate_name}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                ({member.target_role || 'Candidate'})
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
                              <span>
                                Attempts: <strong>{member.final_test_attempts_count}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Last Outcome:{' '}
                                <strong>
                                  {member.latest_final_outcome
                                    ? member.latest_final_outcome.toUpperCase()
                                    : 'None'}
                                </strong>
                              </span>
                              <span>•</span>
                              <span>
                                Consecutive Fails:{' '}
                                <strong
                                  className={
                                    member.consecutive_final_test_fails >= 2
                                      ? 'text-rose-600'
                                      : 'text-slate-700'
                                  }
                                >
                                  {member.consecutive_final_test_fails} / 3
                                </strong>
                              </span>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center space-x-2">
                            {isLocked ? (
                              <span className="px-3 py-1.5 rounded-[6px] text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center">
                                <Lock className="w-3.5 h-3.5 mr-1" />
                                Locked — training required
                              </span>
                            ) : isReviewPending ? (
                              <span className="px-3 py-1.5 rounded-[6px] text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center">
                                <Clock className="w-3.5 h-3.5 mr-1" />
                                Result under review
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleOpenFinalTestModal(member)}
                                className="px-3.5 py-1.5 bg-[#1B3270] hover:bg-[#16285a] text-white text-xs font-semibold rounded-[6px] transition-colors flex items-center space-x-1 shadow-2xs cursor-pointer"
                              >
                                <Award className="w-3.5 h-3.5 mr-1" />
                                <span>Record Final Test</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: MARK ATTENDANCE
      ───────────────────────────────────────────────────────────── */}
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
                  {new Date(attendanceSession.session_date).toLocaleDateString()} at{' '}
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
              <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F4]">
                <span className="font-semibold text-slate-700">Enrolled Candidate</span>
                <span className="font-semibold text-slate-700">Attendance Toggle</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {members.map((m) => {
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
                          className={`px-2 py-1 rounded-[5px] text-[11px] font-semibold transition-colors cursor-pointer ${
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
                          className={`px-2 py-1 rounded-[5px] text-[11px] font-semibold transition-colors cursor-pointer ${
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
                  {savingAttendance && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Save Attendance</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: VIEW PAST ATTENDANCE
      ───────────────────────────────────────────────────────────── */}
      {viewAttendanceSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Attendance Record — Session #{viewAttendanceSession.session_number}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {viewAttendanceSession.session_title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewAttendanceSession(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              {loadingPastAttendance ? (
                <div className="py-8 text-center text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" />
                  Loading attendance roster...
                </div>
              ) : pastAttendanceList.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  No individual attendance logs found for this session.
                </div>
              ) : (
                <div className="divide-y divide-[#E2E8F4] max-h-60 overflow-y-auto pr-1">
                  {pastAttendanceList.map((p) => (
                    <div
                      key={p.candidate_id}
                      className="py-2.5 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-800 block">
                          {p.candidate_name}
                        </span>
                        {p.notes && (
                          <span className="text-[11px] text-slate-500 italic block">
                            Note: {p.notes}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.attended
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {p.attended ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-3 border-t border-[#E2E8F4] flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewAttendanceSession(null)}
                  className="px-4 py-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-[6px] font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 3: ADD SESSION
      ───────────────────────────────────────────────────────────── */}
      {isAddSessionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Schedule New Session</h3>
              <button
                type="button"
                onClick={() => setIsAddSessionOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSession} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Session Title *
                </label>
                <input
                  type="text"
                  required
                  value={newSessionTitle}
                  onChange={(e) => setNewSessionTitle(e.target.value)}
                  placeholder="e.g. Clinical Communication & Patient Handovers"
                  className="w-full p-2 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    className="w-full p-2 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={newSessionTime}
                    onChange={(e) => setNewSessionTime(e.target.value)}
                    className="w-full p-2 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Duration (mins)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={240}
                    value={newSessionDuration}
                    onChange={(e) => setNewSessionDuration(Number(e.target.value))}
                    className="w-full p-2 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Topic
                  </label>
                  <input
                    type="text"
                    value={newSessionTopic}
                    onChange={(e) => setNewSessionTopic(e.target.value)}
                    placeholder="e.g. Grammar, Roleplay"
                    className="w-full p-2 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setIsAddSessionOpen(false)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingSession || !newSessionTitle.trim() || !newSessionDate}
                  className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#16285a] text-white font-semibold rounded-[6px] disabled:opacity-50 flex items-center space-x-1 shadow-2xs"
                >
                  {addingSession && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                  <span>Add Session</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 4: RECORD FINAL ASSESSMENT
      ───────────────────────────────────────────────────────────── */}
      {finalTestCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Final Assessment — {finalTestCandidate.candidate_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Record exit evaluation following cohort completion
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFinalTestCandidate(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitFinalTest} className="p-5 space-y-4 text-xs">
              {/* Previous Attempt History (If fail >= 1) */}
              {finalTestCandidate.consecutive_final_test_fails >= 1 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-[8px] space-y-2">
                  <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>
                      Previous Attempts ({candidateAttemptsHistory.length}) • Consecutive Fails:{' '}
                      {finalTestCandidate.consecutive_final_test_fails}
                    </span>
                  </div>

                  {candidateAttemptsHistory.length > 0 && (
                    <div className="border border-amber-200 rounded-[6px] overflow-hidden bg-white">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-amber-100/60 font-semibold text-amber-900">
                          <tr>
                            <th className="py-1.5 px-2.5">Attempt</th>
                            <th className="py-1.5 px-2.5">Date</th>
                            <th className="py-1.5 px-2.5">Score</th>
                            <th className="py-1.5 px-2.5">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 text-slate-700">
                          {candidateAttemptsHistory.map((att) => (
                            <tr key={att.attempt_number}>
                              <td className="py-1 px-2.5 font-medium">#{att.attempt_number}</td>
                              <td className="py-1 px-2.5">
                                {new Date(att.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-1 px-2.5 font-semibold">{att.score}%</td>
                              <td className="py-1 px-2.5 uppercase font-bold text-[10px]">
                                <span
                                  className={
                                    att.outcome === 'pass'
                                      ? 'text-emerald-700'
                                      : 'text-rose-700'
                                  }
                                >
                                  {att.outcome}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Score & Outcome */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Assessment Score (0–100) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={finalScore}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setFinalScore(val);
                      setFinalOutcome(val >= 60 ? 'pass' : 'fail');
                    }}
                    className="w-full p-2 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Outcome Determination *
                  </label>
                  <select
                    value={finalOutcome}
                    onChange={(e) => setFinalOutcome(e.target.value as any)}
                    className="w-full p-2 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  >
                    <option value="pass">Pass (Eligible for Placement)</option>
                    <option value="fail">Did Not Pass (Needs Remediation)</option>
                  </select>
                </div>
              </div>

              {/* Mentor Notes */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mentor Evaluation Commentary *
                </label>
                <textarea
                  rows={4}
                  required
                  value={finalMentorNotes}
                  onChange={(e) => setFinalMentorNotes(e.target.value)}
                  placeholder="Provide comprehensive feedback on language fluency, clinical readiness, and overall performance..."
                  className="w-full p-2.5 text-xs border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setFinalTestCandidate(null)}
                  className="px-3.5 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px] font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingFinalTest || !finalMentorNotes.trim()}
                  className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#16285a] text-white font-semibold rounded-[6px] disabled:opacity-50 flex items-center space-x-1 shadow-2xs"
                >
                  {recordingFinalTest && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  )}
                  <span>Submit for Review</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorCohortsTab;
