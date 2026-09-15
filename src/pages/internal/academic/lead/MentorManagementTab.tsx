import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Users,
  UserPlus,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  BookOpen,
  X,
  Search,
  CheckCircle2,
} from 'lucide-react';

interface MentorItem {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  created_at: string;
  activeCandidatesCount: number;
  completedPlacementsCount: number;
  recentSessionNotesCount: number;
}

interface AssignmentHistoryItem {
  id: string;
  candidate_id: string;
  candidate_name: string;
  mentor_id: string;
  mentor_name: string;
  active: boolean;
  assigned_at: string;
}

interface SessionNoteItem {
  id: string;
  candidate_name: string;
  note: string;
  note_type: string;
  is_escalation: boolean;
  created_at: string;
}

export const MentorManagementTab: React.FC = () => {
  const { user } = useAuth();
  const [mentors, setMentors] = useState<MentorItem[]>([]);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Generated Link State
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // View Sessions Drawer
  const [selectedMentorForSessions, setSelectedMentorForSessions] = useState<MentorItem | null>(null);
  const [mentorSessions, setMentorSessions] = useState<SessionNoteItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Assignment history filter
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchMentorManagementData = async () => {
    try {
      setLoading(true);

      // 1. Fetch mentor profiles
      const { data: mentorProfiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, created_at')
        .eq('internal_role', 'mentor')
        .eq('is_internal', true)
        .order('created_at', { ascending: false });

      if (profilesErr) throw profilesErr;

      const mentorList = mentorProfiles || [];
      const mentorIds = mentorList.map((m) => m.id);

      // 2. Fetch mentor_assignments
      const { data: assignments } = await supabase
        .from('mentor_assignments')
        .select(`
          id,
          candidate_id,
          mentor_id,
          active,
          assigned_at,
          candidates:candidate_id (first_name, last_name)
        `)
        .order('assigned_at', { ascending: false });

      // Build stats per mentor
      const activeCountMap: Record<string, number> = {};
      const completedCountMap: Record<string, number> = {};

      (assignments || []).forEach((a) => {
        if (a.active) {
          activeCountMap[a.mentor_id] = (activeCountMap[a.mentor_id] || 0) + 1;
        } else {
          completedCountMap[a.mentor_id] = (completedCountMap[a.mentor_id] || 0) + 1;
        }
      });

      // 3. Fetch recent session notes count (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentNotes } = await supabase
        .from('internal_notes')
        .select('author_id')
        .in('author_id', mentorIds.length > 0 ? mentorIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('created_at', sevenDaysAgo.toISOString());

      const notesCountMap: Record<string, number> = {};
      (recentNotes || []).forEach((n) => {
        notesCountMap[n.author_id] = (notesCountMap[n.author_id] || 0) + 1;
      });

      // Assemble mentor items
      const mappedMentors: MentorItem[] = mentorList.map((m) => ({
        id: m.id,
        first_name: m.first_name || '',
        last_name: m.last_name || '',
        email: m.email,
        created_at: m.created_at,
        activeCandidatesCount: activeCountMap[m.id] || 0,
        completedPlacementsCount: completedCountMap[m.id] || 0,
        recentSessionNotesCount: notesCountMap[m.id] || 0,
      }));

      setMentors(mappedMentors);

      // Assemble assignment history
      const mentorNameMap: Record<string, string> = {};
      mentorList.forEach((m) => {
        mentorNameMap[m.id] =
          `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
      });

      const mappedHistory: AssignmentHistoryItem[] = (assignments || []).map((a: any) => {
        const c = a.candidates;
        const candidateName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        return {
          id: a.id,
          candidate_id: a.candidate_id,
          candidate_name: candidateName,
          mentor_id: a.mentor_id,
          mentor_name: mentorNameMap[a.mentor_id] || 'Mentor',
          active: a.active,
          assigned_at: a.assigned_at,
        };
      });

      setAssignmentHistory(mappedHistory);
    } catch (err) {
      console.error('Error fetching mentor management data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMentorManagementData();
  }, []);

  // Handle Generate Invite
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setGeneratedInviteLink(null);

    if (!user) return;

    try {
      setCreatingInvite(true);

      // Check if email already exists in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        setFormError('A user profile with this email address already exists.');
        setCreatingInvite(false);
        return;
      }

      // Check if pending invite exists
      const { data: existingInvite } = await supabase
        .from('pending_invites')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (existingInvite) {
        setFormError('An active pending invitation already exists for this email.');
        setCreatingInvite(false);
        return;
      }

      // Generate token & 7 day expiration
      const token =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { error: insertErr } = await supabase.from('pending_invites').insert({
        email: email.trim().toLowerCase(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        internal_role: 'mentor',
        invite_type: 'internal',
        created_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

      if (insertErr) throw insertErr;

      const link = `${window.location.origin}/internal/accept-invite?token=${token}`;
      setGeneratedInviteLink(link);
      showToast('Mentor invitation link generated successfully.');

      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
    } catch (err: any) {
      console.error('Error generating mentor invite:', err);
      setFormError(err.message || 'Failed to generate invitation');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedInviteLink) return;
    navigator.clipboard.writeText(generatedInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Open Sessions Drawer for a Mentor
  const handleOpenSessions = async (mentor: MentorItem) => {
    setSelectedMentorForSessions(mentor);
    setLoadingSessions(true);

    try {
      const { data: notes, error } = await supabase
        .from('internal_notes')
        .select(`
          id,
          note,
          note_type,
          is_escalation,
          created_at,
          candidates:candidate_id (first_name, last_name)
        `)
        .eq('author_id', mentor.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped: SessionNoteItem[] = (notes || []).map((n: any) => {
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

      setMentorSessions(mapped);
    } catch (err) {
      console.error('Error loading mentor sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Filter Assignment History
  const filteredHistory = assignmentHistory.filter((item) => {
    if (historySearchQuery.trim()) {
      const q = historySearchQuery.toLowerCase();
      const matchCand = item.candidate_name.toLowerCase().includes(q);
      const matchMentor = item.mentor_name.toLowerCase().includes(q);
      if (!matchCand && !matchMentor) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg flex items-center space-x-2 text-xs animate-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* SECTION: CREATE MENTOR ACCOUNT */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs">
        <div className="flex items-center space-x-2 mb-1">
          <UserPlus className="w-4 h-4 text-[#1B3270]" />
          <h3 className="text-sm font-bold text-slate-800">
            Provision Mentor Account
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Generate a secure, single-use token invite link valid for 7 days for a clinical or language mentor.
        </p>

        {formError && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-[8px] text-rose-700 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleGenerateInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              First Name
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Last Name
            </label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">
              Work Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@terratern.com"
              className="w-full px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          <div className="sm:col-span-3 flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-400">
              Role: <strong className="text-slate-700">Clinical & Language Mentor</strong> (fixed permissions)
            </span>
            <button
              type="submit"
              disabled={creatingInvite}
              className="px-4 py-2 font-semibold bg-[#1B3270] hover:bg-[#16285a] text-white rounded-[6px] shadow-2xs disabled:opacity-50 flex items-center text-xs"
            >
              {creatingInvite ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              ) : (
                <UserPlus className="w-3.5 h-3.5 mr-1.5" />
              )}
              Send Invite
            </button>
          </div>
        </form>

        {/* Generated Link Display */}
        {generatedInviteLink && (
          <div className="mt-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-[8px] text-xs space-y-2">
            <div className="flex items-center space-x-1.5 text-emerald-800 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Invitation Link Ready (Valid for 7 Days)</span>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={generatedInviteLink}
                className="flex-1 px-3 py-1.5 bg-white border border-emerald-300 rounded-[6px] font-mono text-[11px] text-slate-700 select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-[6px] flex items-center shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1" />
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MENTOR LIST */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-[#1B3270]" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Active Mentors Roster ({mentors.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Workload & historical session activity
          </span>
        </div>

        {loading ? (
          <div className="bg-white border border-[#E2E8F4] rounded-[10px] py-12 text-center text-slate-400 text-xs">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1B3270]" />
            Loading mentor team roster...
          </div>
        ) : mentors.length === 0 ? (
          <div className="bg-white border border-[#E2E8F4] rounded-[10px] py-12 px-4 text-center text-xs">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
            <p className="font-semibold text-slate-600">No active mentors provisioned</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Use the form above to invite clinical and language mentors.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {mentors.map((m) => {
              const fullName = `${m.first_name} ${m.last_name}`.trim() || m.email;

              return (
                <div
                  key={m.id}
                  className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs text-xs space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          {fullName}
                        </h4>
                        <span className="text-slate-400 text-[11px]">
                          {m.email}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-[#1B3270] border border-blue-200 shrink-0">
                        Mentor
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-1 p-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] text-center">
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-medium">
                          Active
                        </span>
                        <span className="font-bold text-slate-800 text-sm">
                          {m.activeCandidatesCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-medium">
                          Completed
                        </span>
                        <span className="font-bold text-emerald-700 text-sm">
                          {m.completedPlacementsCount}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase text-slate-400 block font-medium">
                          7d Notes
                        </span>
                        <span className="font-bold text-slate-700 text-sm">
                          {m.recentSessionNotesCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F4]">
                    <span className="text-[10px] text-slate-400 flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      Since {new Date(m.created_at).toLocaleDateString()}
                    </span>

                    <button
                      onClick={() => handleOpenSessions(m)}
                      className="px-2.5 py-1 font-semibold text-[11px] text-[#1B3270] bg-[#1B3270]/5 hover:bg-[#1B3270]/10 rounded-[5px] transition-colors flex items-center"
                    >
                      <BookOpen className="w-3 h-3 mr-1" />
                      View Sessions
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ASSIGNMENT HISTORY */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-[#E2E8F4] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Mentor Assignment History ({assignmentHistory.length})
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Chronological log of candidate assignments across the academy
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={historySearchQuery}
              onChange={(e) => setHistorySearchQuery(e.target.value)}
              placeholder="Filter candidate or mentor..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <div className="py-12 px-4 text-center text-xs text-slate-400">
            No assignment history matching current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Candidate</th>
                  <th className="py-2.5 px-4">Assigned Mentor</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Assigned Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      {item.candidate_name}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-700">
                      {item.mentor_name}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.active ? 'Active' : 'Completed / Archived'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-500">
                      {new Date(item.assigned_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW SESSIONS DRAWER */}
      {selectedMentorForSessions && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-[#E2E8F4] flex items-center justify-between bg-[#F8FAFD]">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400">
                  Mentor Session Logs
                </span>
                <h3 className="text-sm font-bold text-slate-800">
                  {selectedMentorForSessions.first_name} {selectedMentorForSessions.last_name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMentorForSessions(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3 text-xs">
              {loadingSessions ? (
                <div className="py-16 text-center text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#1B3270]" />
                  Loading session notes...
                </div>
              ) : mentorSessions.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                  <p className="font-semibold text-slate-600">No session notes recorded</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    This mentor has not logged session details for any assigned candidates yet.
                  </p>
                </div>
              ) : (
                mentorSessions.map((s) => (
                  <div
                    key={s.id}
                    className={`p-3 rounded-[8px] border text-xs space-y-1.5 ${
                      s.is_escalation
                        ? 'bg-rose-50/50 border-rose-200'
                        : 'bg-slate-50 border-[#E2E8F4]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800">
                          {s.candidate_name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            s.note_type === 'session'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {s.note_type}
                        </span>
                        {s.is_escalation && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800">
                            Escalation
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(s.created_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {s.note}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-[#E2E8F4] bg-[#F8FAFD] flex justify-end">
              <button
                onClick={() => setSelectedMentorForSessions(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-white border border-[#E2E8F4] rounded-[6px] text-slate-700 hover:bg-slate-50"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MentorManagementTab;
