import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Calendar as CalendarIcon,
  Search,
  Clock,
  User,
  UserCheck,
  CheckCircle2,
  RotateCcw,
  Eye,
  RefreshCw,
  X,
  Loader2,
  CalendarDays,
} from 'lucide-react';
import { formatDate } from '../../../../utils/formatters';

interface ScheduleItem {
  id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string | null;
  candidate_phone: string | null;
  candidate_role: string | null;
  candidate_level: string | null;
  candidate_user_id: string | null;
  mentor_id: string;
  mentor_name: string;
  mentor_email: string | null;
  proposed_by_id: string | null;
  proposed_by_name: string;
  proposed_date: string;
  proposed_time: string;
  duration_minutes: number;
  status: string; // 'proposed' | 'approved' | 'completed' | 'rescheduled' | 'cancelled'
  approval_notes: string | null;
  reschedule_reason: string | null;
  mentor_proposal_id: string | null;
  academic_request_id: string | null;
  created_at: string;
}

interface TestResultDetail {
  id: string;
  total_score: number | null;
  score_pct: number | null;
  language_level_assessed: string | null;
  overall_outcome: string | null;
  mentor_notes: string | null;
  reviewed_at: string | null;
}

export const AcademicSchedulesTab: React.FC = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [mentorFilter, setMentorFilter] = useState('all');
  const [mentorsList, setMentorsList] = useState<{ id: string; name: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [upcomingToggle, setUpcomingToggle] = useState(true); // Default upcoming view
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Detail Modal
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem | null>(null);
  const [completedResult, setCompletedResult] = useState<TestResultDetail | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);

  // Reschedule Modal
  const [reschedulingSchedule, setReschedulingSchedule] = useState<ScheduleItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [isSubmittingReschedule, setIsSubmittingReschedule] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);

      // 1. Fetch mentors list for filter
      const { data: mentors } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('internal_role', 'mentor');

      const mentorMap: Record<string, { name: string; email: string }> = {};
      const mentorOpts: { id: string; name: string }[] = [];
      (mentors || []).forEach((m) => {
        const name = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
        mentorMap[m.id] = { name, email: m.email };
        mentorOpts.push({ id: m.id, name });
      });
      setMentorsList(mentorOpts);

      // 2. Fetch all speaking_test_schedules
      const { data: rows, error } = await supabase
        .from('speaking_test_schedules')
        .select(`
          id,
          candidate_id,
          mentor_id,
          proposed_by,
          proposed_date,
          proposed_time,
          duration_minutes,
          status,
          approval_notes,
          reschedule_reason,
          mentor_proposal_id,
          academic_request_id,
          created_at,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            email,
            phone,
            target_role,
            language_level_self_reported,
            user_id
          )
        `)
        .order('proposed_date', { ascending: true })
        .order('proposed_time', { ascending: true });

      if (error) throw error;

      // Proposers
      const proposerIds = Array.from(
        new Set((rows || []).map((r) => r.proposed_by).filter((id): id is string => Boolean(id)))
      );
      const proposerMap: Record<string, string> = {};
      if (proposerIds.length > 0) {
        const { data: proposers } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', proposerIds);
        (proposers || []).forEach((p) => {
          proposerMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
        });
      }

      const mapped: ScheduleItem[] = (rows || []).map((r: any) => {
        const c = r.candidates;
        const cName = c ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate' : 'Candidate';
        const mentorInfo = r.mentor_id ? mentorMap[r.mentor_id] : null;

        return {
          id: r.id,
          candidate_id: r.candidate_id,
          candidate_name: cName,
          candidate_email: c?.email || null,
          candidate_phone: c?.phone || null,
          candidate_role: c?.target_role || 'Healthcare Professional',
          candidate_level: c?.language_level_self_reported || 'B2',
          candidate_user_id: c?.user_id || null,
          mentor_id: r.mentor_id || '',
          mentor_name: mentorInfo?.name || 'Assigned Mentor',
          mentor_email: mentorInfo?.email || null,
          proposed_by_id: r.proposed_by,
          proposed_by_name: (r.proposed_by && proposerMap[r.proposed_by]) || 'Placement RM',
          proposed_date: r.proposed_date,
          proposed_time: r.proposed_time || '10:00',
          duration_minutes: r.duration_minutes || 45,
          status: r.status || 'proposed',
          approval_notes: r.approval_notes,
          reschedule_reason: r.reschedule_reason,
          mentor_proposal_id: r.mentor_proposal_id,
          academic_request_id: r.academic_request_id,
          created_at: r.created_at,
        };
      });

      setSchedules(mapped);
    } catch (err) {
      console.error('Error fetching speaking test schedules:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const handleOpenDetail = async (schedule: ScheduleItem) => {
    setSelectedSchedule(schedule);
    setCompletedResult(null);

    if (schedule.status === 'completed') {
      try {
        setLoadingResult(true);
        const { data: res } = await supabase
          .from('speaking_test_results')
          .select('id, total_score, score_pct, language_level_assessed, overall_outcome, mentor_notes, reviewed_at')
          .eq('candidate_id', schedule.candidate_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setCompletedResult(res || null);
      } catch (err) {
        console.error('Error loading result detail:', err);
      } finally {
        setLoadingResult(false);
      }
    }
  };

  const handleOpenRescheduleModal = (schedule: ScheduleItem) => {
    setReschedulingSchedule(schedule);
    setRescheduleDate(schedule.proposed_date || new Date().toISOString().split('T')[0]);
    setRescheduleTime(schedule.proposed_time || '10:00');
    setRescheduleReason('');
  };

  const handleConfirmReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingSchedule || !rescheduleDate || !user) return;

    try {
      setIsSubmittingReschedule(true);
      const now = new Date().toISOString();

      // 1. UPDATE speaking_test_schedules
      const { error: updErr } = await supabase
        .from('speaking_test_schedules')
        .update({
          proposed_date: rescheduleDate,
          proposed_time: rescheduleTime,
          status: 'rescheduled',
          reschedule_reason: rescheduleReason.trim() || 'Schedule adjusted by Academic Lead',
          updated_at: now,
        })
        .eq('id', reschedulingSchedule.id);

      if (updErr) throw updErr;

      // 2. Notify mentor
      if (reschedulingSchedule.mentor_id) {
        await supabase.from('notifications').insert({
          user_id: reschedulingSchedule.mentor_id,
          type: 'general',
          title: 'Speaking Test Rescheduled',
          message: `Speaking test with ${reschedulingSchedule.candidate_name} has been rescheduled to ${formatDate(rescheduleDate)} at ${rescheduleTime}. Reason: ${rescheduleReason || 'Academic schedule update'}.`,
          sent_by: user.id,
        });
      }

      // 3. Notify candidate
      if (reschedulingSchedule.candidate_user_id) {
        await supabase.from('notifications').insert({
          user_id: reschedulingSchedule.candidate_user_id,
          type: 'general',
          title: 'Speaking Assessment Rescheduled',
          message: `Your clinical German speaking assessment has been rescheduled to ${formatDate(rescheduleDate)} at ${rescheduleTime}. Check your portal for joining link details.`,
          sent_by: user.id,
        });
      }

      showToast(`Assessment rescheduled to ${formatDate(rescheduleDate)} at ${rescheduleTime}.`);
      setReschedulingSchedule(null);
      if (selectedSchedule?.id === reschedulingSchedule.id) {
        setSelectedSchedule(null);
      }
      await fetchSchedules();
    } catch (err: any) {
      alert(`Reschedule failed: ${err.message}`);
    } finally {
      setIsSubmittingReschedule(false);
    }
  };

  // Filtered schedules
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      // Upcoming toggle
      if (upcomingToggle) {
        if (s.status !== 'approved' || s.proposed_date < todayStr) return false;
      }

      // Status filter
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;

      // Mentor filter
      if (mentorFilter !== 'all' && s.mentor_id !== mentorFilter) return false;

      // Date range
      if (startDateFilter && s.proposed_date < startDateFilter) return false;
      if (endDateFilter && s.proposed_date > endDateFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.candidate_name.toLowerCase().includes(q);
        const matchMentor = s.mentor_name.toLowerCase().includes(q);
        const matchProposer = s.proposed_by_name.toLowerCase().includes(q);
        if (!matchName && !matchMentor && !matchProposer) return false;
      }

      return true;
    });
  }, [schedules, upcomingToggle, statusFilter, mentorFilter, startDateFilter, endDateFilter, searchQuery, todayStr]);

  // Group by date for upcoming calendar-style list
  const groupedUpcoming = useMemo(() => {
    if (!upcomingToggle) return null;

    const map: Record<string, ScheduleItem[]> = {};
    filteredSchedules.forEach((s) => {
      map[s.proposed_date] = map[s.proposed_date] || [];
      map[s.proposed_date].push(s);
    });

    const dates = Object.keys(map).sort();
    return dates.map((d) => ({
      date: d,
      items: map[d],
    }));
  }, [filteredSchedules, upcomingToggle]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'proposed':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            Proposed
          </span>
        );
      case 'approved':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Scheduled
          </span>
        );
      case 'completed':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Completed
          </span>
        );
      case 'rescheduled':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Rescheduled
          </span>
        );
      case 'cancelled':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Speaking Test Schedules</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Coordinate clinical German language evaluations, monitor upcoming slots, and manage reschedulings across mentors.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchSchedules();
          }}
          disabled={loading || refreshing}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Syncing...' : 'Sync Schedules'}</span>
        </button>
      </div>

      {/* Main Container */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {/* Controls Bar */}
        <div className="p-5 border-b border-[#E2E8F4] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* View Mode Toggle */}
            <div className="inline-flex items-center bg-slate-100 p-1 rounded-[8px] border border-slate-200 self-start">
              <button
                type="button"
                onClick={() => setUpcomingToggle(true)}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold cursor-pointer transition-all flex items-center space-x-1.5 ${
                  upcomingToggle
                    ? 'bg-white text-[#1B3270] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Upcoming View</span>
              </button>
              <button
                type="button"
                onClick={() => setUpcomingToggle(false)}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold cursor-pointer transition-all flex items-center space-x-1.5 ${
                  !upcomingToggle
                    ? 'bg-white text-[#1B3270] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>All Schedules Table</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidate, mentor, or RM..."
                className="w-full pl-8.5 pr-3 py-1.5 text-xs bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
              />
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2.5 text-xs pt-1">
            {!upcomingToggle && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-[#E2E8F4] rounded-[6px] text-slate-700 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
              >
                <option value="all">All Statuses</option>
                <option value="proposed">Proposed</option>
                <option value="approved">Approved (Scheduled)</option>
                <option value="completed">Completed</option>
                <option value="rescheduled">Rescheduled</option>
                <option value="cancelled">Cancelled</option>
              </select>
            )}

            <select
              value={mentorFilter}
              onChange={(e) => setMentorFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-[#E2E8F4] rounded-[6px] text-slate-700 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All Mentors</option>
              {mentorsList.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            {/* Date Range Inputs */}
            <div className="flex items-center space-x-1 bg-slate-50 border border-[#E2E8F4] rounded-[6px] px-2 py-1">
              <span className="text-[11px] text-slate-400">From:</span>
              <input
                type="date"
                value={startDateFilter}
                onChange={(e) => setStartDateFilter(e.target.value)}
                className="bg-transparent text-slate-700 text-xs focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-1 bg-slate-50 border border-[#E2E8F4] rounded-[6px] px-2 py-1">
              <span className="text-[11px] text-slate-400">To:</span>
              <input
                type="date"
                value={endDateFilter}
                onChange={(e) => setEndDateFilter(e.target.value)}
                className="bg-transparent text-slate-700 text-xs focus:outline-none"
              />
            </div>

            {(startDateFilter || endDateFilter || mentorFilter !== 'all' || (!upcomingToggle && statusFilter !== 'all') || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStartDateFilter('');
                  setEndDateFilter('');
                  setMentorFilter('all');
                  setStatusFilter('all');
                  setSearchQuery('');
                }}
                className="text-xs text-[#1B3270] hover:underline font-semibold cursor-pointer ml-1"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : upcomingToggle && groupedUpcoming ? (
          /* UPCOMING CALENDAR-STYLE GROUPED VIEW */
          <div className="p-5 space-y-6">
            {groupedUpcoming.length === 0 ? (
              <div className="py-12 text-center">
                <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">No upcoming scheduled speaking tests.</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Scheduled sessions for today and future dates will appear here grouped by day.
                </p>
              </div>
            ) : (
              groupedUpcoming.map((group) => (
                <div key={group.date} className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#1B3270]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                      {formatDate(group.date)}
                    </h3>
                    <span className="text-[11px] text-slate-400 font-medium">
                      ({group.items.length} assessment{group.items.length === 1 ? '' : 's'})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-[8px] border border-[#E2E8F4] bg-[#F8FAFD] hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{item.candidate_name}</h4>
                              <p className="text-[11px] text-slate-500 font-medium">
                                {item.candidate_role} • Self-Reported: {item.candidate_level}
                              </p>
                            </div>
                            {getStatusBadge(item.status)}
                          </div>

                          <div className="text-xs space-y-1 pt-1 text-slate-600">
                            <div className="flex items-center space-x-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold text-slate-800">{item.proposed_time}</span>
                              <span className="text-slate-400">({item.duration_minutes} mins)</span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                Mentor: <strong className="text-slate-800">{item.mentor_name}</strong>
                              </span>
                            </div>
                            <div className="flex items-center space-x-1.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>
                                Proposed by: <span className="text-slate-700">{item.proposed_by_name}</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-slate-200 flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => handleOpenRescheduleModal(item)}
                            className="px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-[6px] cursor-pointer flex items-center space-x-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reschedule</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(item)}
                            className="px-3 py-1 text-xs font-semibold text-[#1B3270] hover:bg-slate-100 border border-[#E2E8F4] rounded-[6px] cursor-pointer flex items-center space-x-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Detail</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* ALL SCHEDULES TABLE VIEW */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <tr>
                  <th className="px-5 py-3">Candidate Name</th>
                  <th className="px-4 py-3">Assigned Mentor</th>
                  <th className="px-4 py-3">Scheduled Date & Time</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Proposed By</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4]">
                {filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                      No matching speaking test schedules found.
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-900">{s.candidate_name}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">{s.mentor_name}</td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-700 font-medium">
                        {formatDate(s.proposed_date)} at {s.proposed_time}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">{s.duration_minutes} mins</td>
                      <td className="px-4 py-3.5">{getStatusBadge(s.status)}</td>
                      <td className="px-4 py-3.5 text-slate-600">{s.proposed_by_name}</td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        {s.status === 'approved' && (
                          <button
                            type="button"
                            onClick={() => handleOpenRescheduleModal(s)}
                            className="text-amber-700 hover:text-amber-900 font-semibold cursor-pointer"
                          >
                            Reschedule
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(s)}
                          className="text-[#1B3270] hover:underline font-semibold cursor-pointer"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SCHEDULE DETAIL MODAL */}
      {selectedSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#E2E8F4] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <h3 className="text-sm font-bold text-slate-900">Speaking Test Schedule Details</h3>
              <button
                type="button"
                onClick={() => setSelectedSchedule(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              {/* Candidate Info Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[8px] space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Candidate Information</h4>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Full Name</span>
                    <strong className="text-slate-900">{selectedSchedule.candidate_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Target Role</span>
                    <span>{selectedSchedule.candidate_role}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Language Level</span>
                    <span>{selectedSchedule.candidate_level}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Email</span>
                    <span>{selectedSchedule.candidate_email || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Schedule Info Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-[8px] space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Session Coordination</h4>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Assigned Mentor</span>
                    <strong className="text-slate-900">{selectedSchedule.mentor_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Status</span>
                    {getStatusBadge(selectedSchedule.status)}
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Scheduled Slot</span>
                    <span>
                      {formatDate(selectedSchedule.proposed_date)} at {selectedSchedule.proposed_time}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Duration</span>
                    <span>{selectedSchedule.duration_minutes} minutes</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Proposed By</span>
                    <span>{selectedSchedule.proposed_by_name}</span>
                  </div>
                </div>
                {selectedSchedule.reschedule_reason && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-slate-400 block font-semibold">Reschedule Reason:</span>
                    <p className="text-amber-800 text-[11px] italic bg-amber-50 p-2 rounded border border-amber-200 mt-0.5">
                      "{selectedSchedule.reschedule_reason}"
                    </p>
                  </div>
                )}
              </div>

              {/* Assessment Result (if completed) */}
              {selectedSchedule.status === 'completed' && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-[8px] space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Recorded Speaking Test Result
                  </h4>
                  {loadingResult ? (
                    <div className="h-10 bg-white/70 rounded animate-pulse" />
                  ) : completedResult ? (
                    <div className="space-y-1.5 text-emerald-900">
                      <div className="flex items-center justify-between">
                        <span>Outcome:</span>
                        <strong className="capitalize">{completedResult.overall_outcome}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Score:</span>
                        <strong>{completedResult.total_score ?? '—'} pts ({completedResult.score_pct ?? '—'}%)</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Assessed Level:</span>
                        <strong>{completedResult.language_level_assessed || '—'}</strong>
                      </div>
                      {completedResult.mentor_notes && (
                        <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-emerald-200 italic mt-1">
                          Mentor Note: "{completedResult.mentor_notes}"
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-emerald-700 italic">Result record pending synchronization.</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                {selectedSchedule.status === 'approved' && (
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenRescheduleModal(selectedSchedule);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-[6px] cursor-pointer flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reschedule</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedSchedule(null)}
                  className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-[6px] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESCHEDULE MODAL */}
      {reschedulingSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[12px] shadow-xl border border-[#E2E8F4] w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <h3 className="text-sm font-bold text-slate-900">Reschedule Speaking Test</h3>
              <button
                type="button"
                onClick={() => setReschedulingSchedule(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReschedule} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-[8px] space-y-1">
                <p className="font-bold text-slate-900">{reschedulingSchedule.candidate_name}</p>
                <p className="text-slate-600">
                  Mentor: <strong className="text-slate-800">{reschedulingSchedule.mentor_name}</strong>
                </p>
                <p className="text-slate-500 text-[11px]">
                  Original slot: {formatDate(reschedulingSchedule.proposed_date)} at {reschedulingSchedule.proposed_time}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">New Date *</label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">New Time *</label>
                  <input
                    type="time"
                    required
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="w-full text-xs p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Reschedule Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Explain why this assessment was rescheduled (e.g. mentor clinical shift conflict, candidate internet outage)..."
                  className="w-full text-xs p-2.5 bg-slate-50 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270] focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReschedulingSchedule(null)}
                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 border border-slate-200 rounded-[6px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReschedule}
                  className="px-4 py-1.5 font-semibold text-white bg-[#1B3270] hover:bg-[#2952A3] rounded-[6px] flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                >
                  {isSubmittingReschedule && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Reschedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default AcademicSchedulesTab;
