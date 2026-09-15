import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  CheckCircle2,
  Calendar,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { getNoteTypeLabel } from '../../../../utils/labels';

interface SessionNoteItem {
  id: string;
  candidate_id: string;
  candidate_name: string;
  cohort_name: string | null;
  cohort_id: string | null;
  note: string;
  note_type: string;
  is_escalation: boolean;
  resolved: boolean | null;
  session_id: string | null;
  session_info?: {
    cohort_name: string;
    cohort_id: string;
    session_number: number;
    session_title: string;
    session_date: string;
  } | null;
  created_at: string;
}

interface AssignedCandidateOption {
  id: string;
  name: string;
  cohort_id: string | null;
  cohort_name: string | null;
}

interface AvailableSessionOption {
  id: string;
  cohort_id: string;
  label: string;
}

interface MentorSessionNotesTabProps {
  onNavigateTab?: (tabId: string, params?: Record<string, string>) => void;
}

export const MentorSessionNotesTab: React.FC<MentorSessionNotesTabProps> = ({ onNavigateTab }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<SessionNoteItem[]>([]);
  const [myCandidates, setMyCandidates] = useState<AssignedCandidateOption[]>([]);
  const [candidateCohortMap, setCandidateCohortMap] = useState<Record<string, { id: string; name: string }>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [typeFilter, setTypeFilter] = useState<'all' | 'session' | 'flag' | 'general'>('all');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'this_week' | 'this_month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded notes state (inline expansion)
  const [expandedNoteIds, setExpandedNoteIds] = useState<Record<string, boolean>>({});

  // Add Note Modal
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [targetCandidateId, setTargetCandidateId] = useState('');
  const [noteType, setNoteType] = useState<'session' | 'general'>('session');
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [availableSessions, setAvailableSessions] = useState<AvailableSessionOption[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [addNoteError, setAddNoteError] = useState<string | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchNotesAndCandidates = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch active mentor assignments
      const { data: assignments } = await supabase
        .from('mentor_assignments')
        .select(`
          candidate_id,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            cohort_id
          )
        `)
        .eq('mentor_id', user.id)
        .eq('active', true);

      const candList = (assignments || [])
        .map((a: any) => a.candidates)
        .filter((c: any) => Boolean(c));

      const candIds = candList.map((c: any) => c.id);

      // 2. Fetch cohort memberships for these candidates
      let cohortMap: Record<string, { id: string; name: string }> = {};
      if (candIds.length > 0) {
        const { data: cohortMembers } = await supabase
          .from('cohort_members')
          .select(`
            candidate_id,
            cohort_id,
            cohorts:cohort_id (
              id,
              name
            )
          `)
          .in('candidate_id', candIds);

        (cohortMembers || []).forEach((cm: any) => {
          if (cm.cohorts) {
            cohortMap[cm.candidate_id] = {
              id: cm.cohorts.id,
              name: cm.cohorts.name,
            };
          }
        });

        // Check fallback c.cohort_id
        const missingCohortIds = candList
          .filter((c: any) => c.cohort_id && !cohortMap[c.id])
          .map((c: any) => c.cohort_id);

        if (missingCohortIds.length > 0) {
          const { data: extraCohorts } = await supabase
            .from('cohorts')
            .select('id, name')
            .in('id', missingCohortIds);

          const extraMap = new Map((extraCohorts || []).map((co: any) => [co.id, co]));
          candList.forEach((c: any) => {
            if (c.cohort_id && !cohortMap[c.id] && extraMap.has(c.cohort_id)) {
              const co: any = extraMap.get(c.cohort_id);
              cohortMap[c.id] = { id: co.id, name: co.name };
            }
          });
        }
      }

      setCandidateCohortMap(cohortMap);

      const candOptions: AssignedCandidateOption[] = candList.map((c: any) => ({
        id: c.id,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate',
        cohort_id: cohortMap[c.id]?.id || null,
        cohort_name: cohortMap[c.id]?.name || null,
      }));

      setMyCandidates(candOptions);
      if (candOptions.length > 0 && !targetCandidateId) {
        setTargetCandidateId(candOptions[0].id);
      }

      // 3. Fetch all notes written by this mentor
      const { data: noteList, error: notesErr } = await supabase
        .from('internal_notes')
        .select(`
          id,
          candidate_id,
          note,
          note_type,
          is_escalation,
          resolved,
          session_id,
          created_at,
          candidates:candidate_id (id, first_name, last_name, cohort_id)
        `)
        .eq('author_id', user.id)
        .order('created_at', { ascending: false });

      if (notesErr) throw notesErr;

      // 4. If any note has session_id, fetch session details
      const sessionIds = Array.from(
        new Set(
          (noteList || [])
            .map((n: any) => n.session_id)
            .filter(Boolean)
        )
      );

      let sessionMap: Record<
        string,
        {
          id: string;
          cohort_id: string;
          cohort_name: string;
          session_number: number;
          session_title: string;
          session_date: string;
        }
      > = {};

      if (sessionIds.length > 0) {
        const { data: sessionRows } = await supabase
          .from('bootcamp_sessions')
          .select(`
            id,
            cohort_id,
            session_number,
            session_title,
            session_date,
            cohorts:cohort_id (id, name)
          `)
          .in('id', sessionIds);

        (sessionRows || []).forEach((s: any) => {
          sessionMap[s.id] = {
            id: s.id,
            cohort_id: s.cohort_id,
            cohort_name: s.cohorts?.name || 'Cohort',
            session_number: s.session_number,
            session_title: s.session_title,
            session_date: s.session_date,
          };
        });
      }

      const mapped: SessionNoteItem[] = (noteList || []).map((n: any) => {
        const c = n.candidates;
        const candidateName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        const cohortInfo = cohortMap[n.candidate_id] || null;
        const linkedSession = n.session_id ? sessionMap[n.session_id] || null : null;

        return {
          id: n.id,
          candidate_id: n.candidate_id,
          candidate_name: candidateName,
          cohort_name: cohortInfo?.name || linkedSession?.cohort_name || null,
          cohort_id: cohortInfo?.id || linkedSession?.cohort_id || null,
          note: n.note,
          note_type: n.note_type,
          is_escalation: Boolean(n.is_escalation),
          resolved: n.resolved,
          session_id: n.session_id || null,
          session_info: linkedSession,
          created_at: n.created_at,
        };
      });

      setNotes(mapped);
    } catch (err) {
      console.error('Error fetching session notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotesAndCandidates();
  }, [user]);

  // When target candidate changes in Add Note modal, fetch completed sessions for their cohort
  useEffect(() => {
    if (!targetCandidateId) {
      setAvailableSessions([]);
      setSelectedSessionId('');
      return;
    }

    const cohortInfo = candidateCohortMap[targetCandidateId];
    if (!cohortInfo?.id) {
      setAvailableSessions([]);
      setSelectedSessionId('');
      return;
    }

    const fetchSessions = async () => {
      setLoadingSessions(true);
      try {
        const { data, error } = await supabase
          .from('bootcamp_sessions')
          .select('id, session_number, session_title, session_date, status')
          .eq('cohort_id', cohortInfo.id)
          .eq('status', 'completed')
          .order('session_number', { ascending: true });

        if (error) throw error;

        const options: AvailableSessionOption[] = (data || []).map((s: any) => ({
          id: s.id,
          cohort_id: cohortInfo.id,
          label: `${cohortInfo.name} — Session ${s.session_number}: ${s.session_title} (${s.session_date})`,
        }));

        setAvailableSessions(options);
        setSelectedSessionId('');
      } catch (err) {
        console.error('Error fetching completed sessions for candidate:', err);
        setAvailableSessions([]);
      } finally {
        setLoadingSessions(false);
      }
    };

    fetchSessions();
  }, [targetCandidateId, candidateCohortMap]);

  const toggleExpand = (id: string) => {
    setExpandedNoteIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Handle Submit New Note
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !targetCandidateId || !noteText.trim()) return;

    setSubmittingNote(true);
    setAddNoteError(null);

    const chosenCand = myCandidates.find((c) => c.id === targetCandidateId);

    try {
      const insertPayload: any = {
        author_id: user.id,
        candidate_id: targetCandidateId,
        note: noteText.trim(),
        note_type: noteType,
        is_escalation: false,
        resolved: false,
        session_id: noteType === 'session' && selectedSessionId ? selectedSessionId : null,
      };

      const { error } = await supabase.from('internal_notes').insert(insertPayload);

      if (error) throw error;

      showToast(`Logged note for ${chosenCand?.name || 'Candidate'}.`);
      setNoteText('');
      setSelectedSessionId('');
      setIsAddNoteOpen(false);
      fetchNotesAndCandidates();
    } catch (err: any) {
      console.error('Error logging session note:', err);
      setAddNoteError(err.message || 'Failed to create note');
    } finally {
      setSubmittingNote(false);
    }
  };

  // Filter notes
  const filteredNotes = notes.filter((n) => {
    // Note Type Filter Pill
    if (typeFilter === 'session') {
      if (n.note_type !== 'session') return false;
    } else if (typeFilter === 'flag') {
      if (!n.is_escalation && n.note_type !== 'flag') return false;
    } else if (typeFilter === 'general') {
      if (n.note_type === 'session' || n.is_escalation || n.note_type === 'flag') return false;
    }

    // Candidate dropdown filter
    if (selectedCandidateId !== 'all' && n.candidate_id !== selectedCandidateId) {
      return false;
    }

    // Date range filter
    if (dateFilter === 'this_week') {
      const now = new Date();
      const day = now.getDay();
      const diffToMon = (day + 6) % 7;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMon);
      monday.setHours(0, 0, 0, 0);
      const noteDate = new Date(n.created_at);
      if (noteDate < monday) return false;
    } else if (dateFilter === 'this_month') {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const noteDate = new Date(n.created_at);
      if (noteDate < firstOfMonth) return false;
    } else if (dateFilter === 'custom') {
      const noteDate = new Date(n.created_at).getTime();
      if (customStartDate) {
        const start = new Date(customStartDate + 'T00:00:00').getTime();
        if (noteDate < start) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate + 'T23:59:59').getTime();
        if (noteDate > end) return false;
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = n.candidate_name.toLowerCase().includes(q);
      const matchText = n.note.toLowerCase().includes(q);
      const matchCohort = (n.cohort_name || '').toLowerCase().includes(q);
      if (!matchName && !matchText && !matchCohort) return false;
    }

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg flex items-center space-x-2 text-xs animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header & Add Note Button */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-4 h-4 text-[#1B3270]" />
          <h2 className="text-sm font-bold text-slate-800">
            Session &amp; Clinical Evaluation Notes ({filteredNotes.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsAddNoteOpen(true);
            setAddNoteError(null);
            if (myCandidates.length > 0 && !targetCandidateId) {
              setTargetCandidateId(myCandidates[0].id);
            }
          }}
          className="px-3.5 py-1.5 bg-[#1B3270] hover:bg-[#16285a] text-white font-semibold rounded-[6px] text-xs transition-colors shadow-2xs flex items-center cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Session Note
        </button>
      </div>

      {/* FILTERS CONTAINER */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3 shadow-2xs space-y-3 text-xs">
        {/* Row 1: Note Type Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F4] pb-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'all', label: 'All Notes' },
              { id: 'session', label: 'Session Notes' },
              { id: 'flag', label: 'At-Risk Flags' },
              { id: 'general', label: 'General Notes' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilter(tab.id as any)}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors cursor-pointer ${
                  typeFilter === tab.id
                    ? 'bg-[#1B3270] text-white shadow-2xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-[#E2E8F4]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate or notes..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
            />
          </div>
        </div>

        {/* Row 2: Candidate Dropdown & Date Range Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-0.5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Candidate Dropdown */}
            <div className="flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-medium">Candidate:</span>
              <select
                value={selectedCandidateId}
                onChange={(e) => setSelectedCandidateId(e.target.value)}
                className="px-2.5 py-1.5 border border-[#E2E8F4] rounded-[6px] bg-white text-slate-700 focus:ring-1 focus:ring-[#1B3270] outline-none"
              >
                <option value="all">All Assigned Candidates ({myCandidates.length})</option>
                {myCandidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.cohort_name ? `(${c.cohort_name})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1" />
              {[
                { id: 'all', label: 'All Time' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'custom', label: 'Custom' },
              ].map((df) => (
                <button
                  key={df.id}
                  type="button"
                  onClick={() => setDateFilter(df.id as any)}
                  className={`px-2.5 py-1 rounded-[5px] text-[11px] font-medium transition-colors cursor-pointer ${
                    dateFilter === df.id
                      ? 'bg-[#1B3270] text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-[#E2E8F4]'
                  }`}
                >
                  {df.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Pickers */}
          {dateFilter === 'custom' && (
            <div className="flex items-center space-x-2 animate-in fade-in duration-150">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2 py-1 text-[11px] border border-[#E2E8F4] rounded-[5px] bg-white text-slate-700 focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2 py-1 text-[11px] border border-[#E2E8F4] rounded-[5px] bg-white text-slate-700 focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* NOTES TABLE / LIST */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1B3270]" />
            Loading session logs...
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="font-semibold text-slate-600">No session notes found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {notes.length === 0
                ? 'Click "Add Session Note" to log clinical coaching, language evaluations, or general mentee progress.'
                : 'No notes match your current filters. Try selecting "All Notes" or resetting the date filter.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Cohort</th>
                  <th className="py-3 px-4">Note Type</th>
                  <th className="py-3 px-4">Note Content</th>
                  <th className="py-3 px-4">Session Date</th>
                  <th className="py-3 px-4 text-center">Actions Required</th>
                  <th className="py-3 px-4 text-right">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredNotes.map((item) => {
                  const isExpanded = expandedNoteIds[item.id] || false;

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-slate-50/60 transition-colors">
                        {/* Candidate */}
                        <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                          {item.candidate_name}
                        </td>

                        {/* Cohort */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {item.cohort_name ? (
                            <span className="font-medium text-[#1B3270]">
                              {item.cohort_name}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Note Type */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.note_type === 'session'
                                ? 'bg-blue-100 text-blue-800'
                                : item.is_escalation || item.note_type === 'flag'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {item.is_escalation || item.note_type === 'flag'
                              ? 'At-Risk Flag'
                              : getNoteTypeLabel(item.note_type)}
                          </span>
                        </td>

                        {/* Note Content */}
                        <td className="py-3 px-4 max-w-sm">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className={`text-slate-600 ${isExpanded ? '' : 'truncate block'}`}>
                                {item.note}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleExpand(item.id)}
                                className="text-[11px] text-[#1B3270] hover:underline shrink-0 font-medium flex items-center cursor-pointer"
                              >
                                {isExpanded ? (
                                  <>
                                    Collapse <ChevronUp className="w-3 h-3 ml-0.5" />
                                  </>
                                ) : (
                                  <>
                                    View full <ChevronDown className="w-3 h-3 ml-0.5" />
                                  </>
                                )}
                              </button>
                            </div>

                            {/* Linked session button if note_type='session' and has session_info */}
                            {item.note_type === 'session' && item.session_info && (
                              <div className="mt-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onNavigateTab?.('my-cohorts', {
                                      cohortId: item.session_info!.cohort_id,
                                    })
                                  }
                                  className="text-[11px] text-[#1B3270] hover:underline font-medium inline-flex items-center bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                >
                                  <GraduationCap className="w-3 h-3 mr-1 text-[#1B3270]" />
                                  Related session: {item.session_info.cohort_name} — Session{' '}
                                  {item.session_info.session_number} — {item.session_info.session_date} &rarr;
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Session Date */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                          {item.session_info?.session_date ? (
                            <span className="font-medium text-slate-700">
                              {item.session_info.session_date}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        {/* Actions Required */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {item.is_escalation ? (
                            item.resolved ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" />
                                Resolved
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 mr-1 text-rose-500" />
                                Action Required
                              </span>
                            )
                          ) : (
                            <span className="text-slate-400 font-medium text-[11px]">—</span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                          <span className="inline-flex items-center">
                            <Calendar className="w-3 h-3 mr-1 text-slate-400" />
                            {new Date(item.created_at).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </td>
                      </tr>

                      {/* Expanded View */}
                      {isExpanded && (
                        <tr className="bg-slate-50/80">
                          <td colSpan={7} className="px-6 py-3 border-b border-[#E2E8F4]">
                            <div className="p-3.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs space-y-2">
                              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                                <span>Full Clinical &amp; Mentorship Note Content</span>
                                <span>Note ID: {item.id.slice(0, 8)}...</span>
                              </div>
                              <p className="text-slate-800 whitespace-pre-wrap leading-relaxed font-normal">
                                {item.note}
                              </p>
                              {item.session_info && (
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500">
                                    Linked Cohort Session: <strong>{item.session_info.cohort_name}</strong> (Session {item.session_info.session_number}: {item.session_info.session_title})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onNavigateTab?.('my-cohorts', {
                                        cohortId: item.session_info!.cohort_id,
                                      })
                                    }
                                    className="text-[#1B3270] font-semibold hover:underline cursor-pointer"
                                  >
                                    View Session Attendance in Cohorts &rarr;
                                  </button>
                                </div>
                              )}
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
      </div>

      {/* ADD NOTE MODAL */}
      {isAddNoteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-[12px] border border-[#E2E8F4] shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F4] bg-[#F8FAFD]">
              <div className="flex items-center space-x-2">
                <Plus className="w-4 h-4 text-[#1B3270]" />
                <h3 className="text-sm font-bold text-slate-800">
                  Log Mentorship Note
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddNoteOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNote} className="p-5 space-y-4 text-xs">
              {addNoteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700 flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{addNoteError}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Select Candidate *
                </label>
                {myCandidates.length === 0 ? (
                  <p className="text-slate-400 italic p-2 bg-slate-50 rounded border border-[#E2E8F4]">
                    No assigned candidates available.
                  </p>
                ) : (
                  <select
                    value={targetCandidateId}
                    onChange={(e) => setTargetCandidateId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                  >
                    {myCandidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.cohort_name ? `(${c.cohort_name})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Note Type *
                </label>
                <select
                  value={noteType}
                  onChange={(e) =>
                    setNoteType(e.target.value as 'session' | 'general')
                  }
                  className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                >
                  <option value="session">Session Coaching Log</option>
                  <option value="general">General Administrative / Progress Note</option>
                </select>
              </div>

              {/* Optional Link to Session if noteType === 'session' */}
              {noteType === 'session' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Link to Session <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  {loadingSessions ? (
                    <div className="py-2 text-slate-400 text-xs flex items-center">
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5 text-[#1B3270]" />
                      Loading candidate cohort sessions...
                    </div>
                  ) : availableSessions.length === 0 ? (
                    <p className="text-slate-400 italic p-2 bg-slate-50 rounded border border-[#E2E8F4] text-[11px]">
                      No completed cohort sessions recorded for this candidate yet.
                    </p>
                  ) : (
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                    >
                      <option value="">-- No linked session (General session note) --</option>
                      {availableSessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Note Text *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Record session discussion, student responses, grammar exercises covered, or clinical documentation points..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="w-full p-2.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddNoteOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-[6px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingNote || !targetCandidateId || !noteText.trim()}
                  className="px-4 py-1.5 font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] shadow-xs disabled:opacity-50 flex items-center cursor-pointer transition-colors"
                >
                  {submittingNote && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                  Save Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorSessionNotesTab;
