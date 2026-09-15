import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import {
  Search,
  CheckCircle2,
  Calendar,
  FileText,
  User,
  Loader2,
  ShieldCheck,
  BookOpen,
  HelpCircle,
  Award,
} from 'lucide-react';
import {
  GateReviewModal,
  PendingGateResult,
} from '../components/GateReviewModal';
import {
  SpeakingTestApproveModal,
  SpeakingTestClarifyModal,
} from '../components/SpeakingTestApprovalModals';
import { getGateLabel } from '../../../../utils/labels';
import { MultiSelectFilter } from '../../../../components/ui/MultiSelectFilter';

interface GateReviewTabProps {
  initialFilter?: string;
}

interface ExpandedSessionNotes {
  [gateId: string]: Array<{ id: string; note: string; created_at: string }>;
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

interface SpeakingTestDetailMap {
  [candidateId: string]: {
    id: string;
    totalScore: number;
    scorePct: number;
    languageLevel: string;
    overallOutcome: 'pass' | 'fail';
    mentorNotes: string;
    rubricRows: RubricScoreRow[];
  };
}

export const GateReviewTab: React.FC<GateReviewTabProps> = () => {
  const [results, setResults] = useState<PendingGateResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search (Multi-select)
  const [gateTypeFilter, setGateTypeFilter] = useState<string[]>([]);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Speaking test details map: candidateId -> SpeakingTestDetailMap
  const [speakingTestDetails, setSpeakingTestDetails] = useState<SpeakingTestDetailMap>({});

  // Session notes cache per gate
  const [sessionNotesMap, setSessionNotesMap] = useState<ExpandedSessionNotes>({});

  // Review Modal (standard gate review)
  const [selectedReview, setSelectedReview] = useState<PendingGateResult | null>(null);

  // Speaking test approve modal state
  const [approveStData, setApproveStData] = useState<{
    candidateName: string;
    candidateUserId: string | null;
    candidateId: string;
    stResultId: string;
    mentorId: string;
    score: number;
    scorePct: number;
    languageLevel: string;
    overallOutcome: 'pass' | 'fail';
  } | null>(null);

  // Speaking test clarify modal state
  const [clarifyStData, setClarifyStData] = useState<{
    candidateName: string;
    candidateId: string;
    stResultId: string;
    mentorId: string;
  } | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchPendingReviews = async () => {
    try {
      setLoading(true);

      // 1. Query gate_results where review_status = 'pending', ordered by created_at asc (FIFO)
      const { data: gates, error: gatesErr } = await supabase
        .from('gate_results')
        .select(`
          id,
          candidate_id,
          gate_type,
          status,
          score,
          recorded_by,
          notes,
          created_at,
          review_status,
          candidates:candidate_id (
            id,
            first_name,
            last_name,
            target_role,
            language_level_self_reported,
            user_id
          )
        `)
        .eq('review_status', 'pending')
        .order('created_at', { ascending: true });

      if (gatesErr) throw gatesErr;

      const recorderIds = Array.from(
        new Set(
          (gates || [])
            .map((g) => g.recorded_by)
            .filter((id): id is string => Boolean(id))
        )
      );

      const profileMap: Record<string, string> = {};
      if (recorderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', recorderIds);

        (profiles || []).forEach((p) => {
          profileMap[p.id] =
            `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
        });
      }

      const mapped: PendingGateResult[] = (gates || []).map((g: any) => {
        const c = g.candidates;
        const candidateName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Candidate'
          : 'Candidate';

        return {
          id: g.id,
          candidate_id: g.candidate_id,
          candidate_name: candidateName,
          candidate_target_role: c?.target_role || null,
          candidate_language_level: c?.language_level_self_reported || null,
          candidate_user_id: c?.user_id || null,
          gate_type: g.gate_type,
          status: g.status,
          score: g.score,
          recorded_by: g.recorded_by,
          mentor_name: (g.recorded_by && profileMap[g.recorded_by]) || 'Mentor',
          notes: g.notes,
          created_at: g.created_at,
          review_status: g.review_status,
        };
      });

      setResults(mapped);

      // 2. Fetch Speaking Test Rubric breakdowns for speaking_test reviews
      const stCandIds = mapped
        .filter((m) => m.gate_type === 'speaking_test')
        .map((m) => m.candidate_id);

      if (stCandIds.length > 0) {
        // Fetch speaking_test_results
        const { data: stResults } = await supabase
          .from('speaking_test_results')
          .select('*')
          .in('candidate_id', stCandIds)
          .eq('review_status', 'pending')
          .order('created_at', { ascending: false });

        if (stResults && stResults.length > 0) {
          const stResultIds = stResults.map((r) => r.id);

          // Fetch all active rubric criteria
          const { data: criteriaData } = await supabase
            .from('speaking_test_rubric_criteria')
            .select('id, criterion_name, description, max_score, order_position')
            .order('order_position', { ascending: true });

          const critMap: Record<string, any> = {};
          (criteriaData || []).forEach((crit) => {
            critMap[crit.id] = crit;
          });

          // Fetch rubric scores for these results
          const { data: rubricScores } = await supabase
            .from('speaking_test_rubric_scores')
            .select('*')
            .in('result_id', stResultIds);

          const rubricGroup: Record<string, RubricScoreRow[]> = {};
          (rubricScores || []).forEach((rs) => {
            if (!rubricGroup[rs.result_id]) rubricGroup[rs.result_id] = [];
            const crit = critMap[rs.criterion_id];
            if (crit) {
              rubricGroup[rs.result_id].push({
                criterionId: rs.criterion_id,
                criterionName: crit.criterion_name,
                description: crit.description,
                score: rs.score,
                maxScore: crit.max_score || 20,
                notes: rs.notes || null,
                orderPosition: crit.order_position || 0,
              });
            }
          });

          const stMap: SpeakingTestDetailMap = {};
          stResults.forEach((str) => {
            const rows = rubricGroup[str.id] || [];
            rows.sort((a, b) => a.orderPosition - b.orderPosition);

            stMap[str.candidate_id] = {
              id: str.id,
              totalScore: Number(str.total_score) || 0,
              scorePct: Number(str.score_pct) || 0,
              languageLevel: str.language_level_assessed || 'B1',
              overallOutcome: str.overall_outcome || 'pass',
              mentorNotes: str.mentor_notes || '',
              rubricRows: rows,
            };
          });

          setSpeakingTestDetails(stMap);
        }
      }

      // 3. Fetch session notes for each gate item
      const candIds = Array.from(new Set(mapped.map((m) => m.candidate_id)));
      if (candIds.length > 0) {
        const { data: notes } = await supabase
          .from('internal_notes')
          .select('id, candidate_id, author_id, note, created_at')
          .in('candidate_id', candIds)
          .eq('note_type', 'session')
          .order('created_at', { ascending: false });

        const notesGrouped: ExpandedSessionNotes = {};
        mapped.forEach((item) => {
          const matching = (notes || []).filter(
            (n) =>
              n.candidate_id === item.candidate_id &&
              (!item.recorded_by || n.author_id === item.recorded_by)
          );
          notesGrouped[item.id] = matching.slice(0, 3);
        });

        setSessionNotesMap(notesGrouped);
      }
    } catch (err) {
      console.error('Error fetching pending reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingReviews();
  }, []);

  const getCriterionBadgeClass = (score: number) => {
    if (score <= 7) return 'bg-rose-50 text-rose-700 border-rose-300';
    if (score <= 13) return 'bg-amber-50 text-amber-700 border-amber-300';
    return 'bg-emerald-50 text-emerald-700 border-emerald-300';
  };

  const filteredResults = results.filter((item) => {
    if (gateTypeFilter.length > 0 && !gateTypeFilter.includes(item.gate_type)) {
      return false;
    }

    if (
      reviewStatusFilter.length > 0 &&
      !reviewStatusFilter.includes(item.review_status || 'pending')
    ) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.candidate_name.toLowerCase().includes(q);
      const matchMentor = item.mentor_name.toLowerCase().includes(q);
      const matchRole = (item.candidate_target_role || '').toLowerCase().includes(q);
      if (!matchName && !matchMentor && !matchRole) return false;
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

      {/* Speaking Test Approve Modal */}
      {approveStData && (
        <SpeakingTestApproveModal
          isOpen={true}
          candidateName={approveStData.candidateName}
          candidateUserId={approveStData.candidateUserId}
          candidateId={approveStData.candidateId}
          stResultId={approveStData.stResultId}
          mentorId={approveStData.mentorId}
          score={approveStData.score}
          scorePct={approveStData.scorePct}
          languageLevel={approveStData.languageLevel}
          overallOutcome={approveStData.overallOutcome}
          onClose={() => setApproveStData(null)}
          onSuccess={(msg) => {
            showToast(msg);
            fetchPendingReviews();
          }}
        />
      )}

      {/* Speaking Test Clarify Modal */}
      {clarifyStData && (
        <SpeakingTestClarifyModal
          isOpen={true}
          candidateName={clarifyStData.candidateName}
          candidateId={clarifyStData.candidateId}
          stResultId={clarifyStData.stResultId}
          mentorId={clarifyStData.mentorId}
          onClose={() => setClarifyStData(null)}
          onSuccess={(msg) => {
            showToast(msg);
            fetchPendingReviews();
          }}
        />
      )}

      {/* Standard Gate Review Modal (for assessment or full review) */}
      {selectedReview && (
        <GateReviewModal
          gateResult={selectedReview}
          onClose={() => setSelectedReview(null)}
          onSuccess={(msg) => {
            showToast(msg);
            fetchPendingReviews();
          }}
        />
      )}

      {/* Filters Bar */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MultiSelectFilter
            label="Gate Types"
            options={[
              { value: 'speaking_test', label: 'Speaking Test' },
              { value: 'assessment', label: 'Final Assessment' },
              { value: 'bootcamp', label: 'Bootcamp' },
              { value: 'doc_verification', label: 'Document Verification' },
              { value: 'dt', label: 'Diagnostic Test' },
            ]}
            selectedValues={gateTypeFilter}
            onChange={setGateTypeFilter}
          />
          <MultiSelectFilter
            label="Review Status"
            options={[
              { value: 'pending', label: 'Pending Review' },
              { value: 'approved', label: 'Approved' },
              { value: 'queried', label: 'Clarification Requested' },
            ]}
            selectedValues={reviewStatusFilter}
            onChange={setReviewStatusFilter}
          />
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate, role, or mentor..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
          />
        </div>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#1B3270]" />
          Loading gate review queue...
        </div>
      ) : filteredResults.length === 0 ? (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] py-16 px-4 text-center shadow-2xs">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">
            No gate reviews pending in queue
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            All submitted Speaking Tests and Assessment evaluations have been reviewed.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResults.map((item) => {
            const itemSessionNotes = sessionNotesMap[item.id] || [];
            const stDetail = speakingTestDetails[item.candidate_id];
            const isSpeakingTest = item.gate_type === 'speaking_test';

            const displayScore = stDetail ? stDetail.totalScore : item.score;
            const displayScorePct = stDetail ? stDetail.scorePct : item.score;
            const displayOutcome = stDetail ? stDetail.overallOutcome : item.status;
            const displayLevel = stDetail ? stDetail.languageLevel : item.candidate_language_level;

            return (
              <div
                key={item.id}
                className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden text-xs transition-all hover:border-slate-300"
              >
                {/* Card Top Row */}
                <div className="p-4 sm:p-5 border-b border-[#E2E8F4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFD]/70">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {item.candidate_name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.gate_type === 'speaking_test'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {getGateLabel(item.gate_type)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          displayOutcome === 'pass'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {displayOutcome === 'pass' ? 'PASS' : 'DID NOT PASS'}
                      </span>
                      {displayLevel && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          Level: {displayLevel}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      {item.candidate_target_role && (
                        <span>
                          Target Role: <strong className="text-slate-700">{item.candidate_target_role}</strong>
                        </span>
                      )}
                      <span className="flex items-center">
                        <User className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        Mentor: <strong className="ml-1 text-slate-700">{item.mentor_name}</strong>
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        Test Date: <strong className="ml-1 text-slate-700">{new Date(item.created_at).toLocaleDateString()}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Score & Direct Action Buttons */}
                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-slate-400 block font-semibold">
                        Total Score
                      </span>
                      <span className="text-base font-bold text-slate-800">
                        {displayScore !== null ? `${displayScore} / 100` : '—'}{' '}
                        {displayScorePct !== null && (
                          <span
                            className={`text-xs font-semibold ${
                              (displayScorePct || 0) >= 60 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            ({displayScorePct}%)
                          </span>
                        )}
                      </span>
                    </div>

                    {isSpeakingTest && stDetail ? (
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setClarifyStData({
                              candidateName: item.candidate_name,
                              candidateId: item.candidate_id,
                              stResultId: stDetail.id,
                              mentorId: item.recorded_by || '',
                            })
                          }
                          className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-[6px] text-xs border border-amber-200 transition-colors flex items-center cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5 mr-1 text-amber-600" />
                          Request Clarification
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setApproveStData({
                              candidateName: item.candidate_name,
                              candidateUserId: item.candidate_user_id,
                              candidateId: item.candidate_id,
                              stResultId: stDetail.id,
                              mentorId: item.recorded_by || '',
                              score: stDetail.totalScore,
                              scorePct: stDetail.scorePct,
                              languageLevel: stDetail.languageLevel,
                              overallOutcome: stDetail.overallOutcome,
                            })
                          }
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-[6px] text-xs transition-colors shadow-2xs flex items-center cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Approve Result
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedReview(item)}
                        className="px-4 py-2 bg-[#1B3270] hover:bg-[#16285a] text-white font-semibold rounded-[6px] text-xs transition-colors shadow-2xs flex items-center cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Review Assessment
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Details Body */}
                <div className="p-4 sm:p-5 space-y-4">
                  {/* PART 2: 5-ROW RUBRIC TABLE FOR SPEAKING TEST */}
                  {isSpeakingTest && stDetail && stDetail.rubricRows.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center">
                          <Award className="w-3.5 h-3.5 mr-1.5 text-[#1B3270]" />
                          Rubric Evaluation Breakdown (5 Criteria)
                        </span>
                        <span className="text-[11px] text-slate-400">
                          Pass Benchmark: 60% (12/20 avg)
                        </span>
                      </div>

                      <div className="overflow-x-auto border border-[#E2E8F4] rounded-[8px]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-[11px] text-slate-500 font-semibold">
                              <th className="py-2.5 px-3 font-semibold text-slate-700">Criterion</th>
                              <th className="py-2.5 px-3 font-semibold text-slate-700 w-28 text-center">Score</th>
                              <th className="py-2.5 px-3 font-semibold text-slate-700 w-20 text-center">Max</th>
                              <th className="py-2.5 px-3 font-semibold text-slate-700">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F4]">
                            {stDetail.rubricRows.map((r, idx) => {
                              const badgeStyle = getCriterionBadgeClass(r.score);
                              return (
                                <tr key={r.criterionId} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <div className="font-bold text-[#1B3270]">
                                      {idx + 1}. {r.criterionName}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      {r.description}
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    <span
                                      className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs border ${badgeStyle}`}
                                    >
                                      {r.score}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-center text-slate-400 font-medium">
                                    / {r.maxScore}
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-600">
                                    {r.notes ? (
                                      <span className="whitespace-pre-wrap">{r.notes}</span>
                                    ) : (
                                      <span className="text-slate-400 italic text-[11px]">No specific notes</span>
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

                  {/* Mentor Evaluation Notes */}
                  {(stDetail?.mentorNotes || item.notes) && (
                    <div className="p-3.5 bg-slate-50 border border-[#E2E8F4] rounded-[8px]">
                      <div className="flex items-center text-slate-700 font-semibold mb-1">
                        <FileText className="w-3.5 h-3.5 mr-1.5 text-[#1B3270]" />
                        Mentor Notes (Full Performance Commentary)
                      </div>
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap pl-5 text-xs">
                        {stDetail?.mentorNotes || item.notes}
                      </p>
                    </div>
                  )}

                  {/* Recent Session Notes */}
                  {itemSessionNotes.length > 0 && (
                    <div>
                      <div className="flex items-center text-slate-700 font-semibold mb-1.5">
                        <BookOpen className="w-3.5 h-3.5 mr-1.5 text-[#2952A3]" />
                        Recent Mentor Session Notes ({itemSessionNotes.length})
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {itemSessionNotes.map((sn) => (
                          <div
                            key={sn.id}
                            className="p-2.5 bg-slate-50/60 border border-[#E2E8F4] rounded-[6px] text-[11px]"
                          >
                            <span className="text-slate-400 block text-[10px] mb-0.5">
                              {new Date(sn.created_at).toLocaleString()}
                            </span>
                            <p className="text-slate-700 whitespace-pre-wrap">{sn.note}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GateReviewTab;
