import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Building2,
  Users,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  X,
  Loader2,
  Check,
  Send,
  FileCheck2,
} from 'lucide-react';
import {
  DocumentReviewPanel,
  DocumentReviewCandidate,
} from './components/DocumentReviewPanel';
import { ALL_DOCUMENT_TYPES } from '../../../../utils/documentTypes';

interface ActionItem {
  id: string;
  type:
    | 'speaking_test'
    | 'doc_rejected'
    | 'st_pending'
    | 'dt_cooling'
    | 'final_test_locked'
    | 'dt_attempt_limit'
    | 'bulk_upload';
  candidateId?: string;
  candidateName?: string;
  targetRole?: string;
  supplierName: string;
  supplierUserId?: string | null;
  detail: string;
}

interface SpeakingTestRow {
  id: string;
  candidateName: string;
  status: string;
  mentorName: string;
  requestedDate: string;
}

interface AwaitingDocReviewItem {
  id: string;
  first_name: string;
  last_name: string;
  target_role?: string | null;
  language_level_self_reported?: string | null;
  user_id?: string | null;
  supplier_name: string;
  dt_passed_at: string;
  verifiedDocsCount: number;
  mandatoryDocsCount: number;
  profileCompletionPct: number;
}

interface CandidateRmOverviewTabProps {
  onNavigateTab: (tabId: string) => void;
}

export const CandidateRmOverviewTab: React.FC<CandidateRmOverviewTabProps> = ({
  onNavigateTab,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 4 Stats
  const [mySuppliersCount, setMySuppliersCount] = useState(0);
  const [totalCandidatesCount, setTotalCandidatesCount] = useState(0);
  const [stuckCount, setStuckCount] = useState(0);
  const [interviewReadyCount, setInterviewReadyCount] = useState(0);

  // Action Items & Speaking Test Requests
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [speakingRequests, setSpeakingRequests] = useState<SpeakingTestRow[]>([]);

  // Awaiting Document Review (Part 1)
  const [awaitingReviewCandidates, setAwaitingReviewCandidates] = useState<AwaitingDocReviewItem[]>([]);
  const [selectedReviewCandidate, setSelectedReviewCandidate] = useState<DocumentReviewCandidate | null>(null);
  const [isReviewPanelOpen, setIsReviewPanelOpen] = useState(false);

  // Request Speaking Test Modal
  const [speakingModalItem, setSpeakingModalItem] = useState<ActionItem | null>(null);
  const [speakingNotes, setSpeakingNotes] = useState('');
  const [requestingSpeaking, setRequestingSpeaking] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchOverviewData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // 1. Fetch my active assignments (suppliers and direct candidates)
      const { data: assignments, error: assErr } = await supabase
        .from('rm_assignments')
        .select('entity_id, entity_type')
        .eq('rm_profile_id', user.id)
        .eq('active', true);

      if (assErr) throw assErr;

      const supplierIds = (assignments || [])
        .filter((a) => a.entity_type === 'supplier')
        .map((a) => a.entity_id);
      const directCandidateIds = (assignments || [])
        .filter((a) => a.entity_type === 'candidate')
        .map((a) => a.entity_id);

      setMySuppliersCount(supplierIds.length);

      if (supplierIds.length === 0 && directCandidateIds.length === 0) {
        setTotalCandidatesCount(0);
        setStuckCount(0);
        setInterviewReadyCount(0);
        setActionItems([]);
        setSpeakingRequests([]);
        setAwaitingReviewCandidates([]);
        return;
      }

      // 2. Fetch candidates belonging to these suppliers or directly assigned
      let candQuery = supabase
        .from('candidates')
        .select(`
          id,
          user_id,
          first_name,
          last_name,
          target_role,
          language_level_self_reported,
          status,
          supplier_id,
          profile_completion_pct,
          dt_passed_at,
          dt_attempt_count,
          final_test_locked,
          created_at,
          suppliers:supplier_id (id, company_name, user_id)
        `);

      if (supplierIds.length > 0 && directCandidateIds.length > 0) {
        candQuery = candQuery.or(`supplier_id.in.(${supplierIds.join(',')}),id.in.(${directCandidateIds.join(',')})`);
      } else if (supplierIds.length > 0) {
        candQuery = candQuery.in('supplier_id', supplierIds);
      } else {
        candQuery = candQuery.in('id', directCandidateIds);
      }

      const { data: cands, error: candsErr } = await candQuery;

      if (candsErr) throw candsErr;
      const candidateList = cands || [];
      setTotalCandidatesCount(candidateList.length);

      const irCount = candidateList.filter((c) => c.status === 'interview_ready').length;
      setInterviewReadyCount(irCount);

      const candIds = candidateList.map((c) => c.id);

      // Fetch speaking test schedules to know who already has a schedule
      let scheduledCandidateIds = new Set<string>();
      if (candIds.length > 0) {
        const { data: stSchedules } = await supabase
          .from('speaking_test_schedules')
          .select('candidate_id')
          .in('candidate_id', candIds);
        scheduledCandidateIds = new Set((stSchedules || []).map((s) => s.candidate_id));
      }

      // Fetch all documents for candidates to count verified mandatory docs
      const candDocsMap: Record<string, Record<string, string>> = {};
      if (candIds.length > 0) {
        const { data: allDocs } = await supabase
          .from('documents')
          .select('candidate_id, document_type, status')
          .in('candidate_id', candIds);

        (allDocs || []).forEach((d) => {
          if (!candDocsMap[d.candidate_id]) {
            candDocsMap[d.candidate_id] = {};
          }
          candDocsMap[d.candidate_id][d.document_type] = d.status;
        });
      }

      const mandatoryTypesList = ALL_DOCUMENT_TYPES.filter((t) => t.is_mandatory);
      const mandatoryCount = mandatoryTypesList.length;

      // Part 1: Awaiting Document Review list
      // candidates where dt_passed_at IS NOT NULL, status = 'in_progress', and no speaking_test_schedules record yet
      const awaitingList: AwaitingDocReviewItem[] = candidateList
        .filter((c) => c.dt_passed_at && c.status === 'in_progress' && !scheduledCandidateIds.has(c.id))
        .map((c) => {
          const docMap = candDocsMap[c.id] || {};
          const verifiedCount = mandatoryTypesList.filter((t) => docMap[t.document_type] === 'verified').length;
          const sup = c.suppliers as any;
          return {
            id: c.id,
            first_name: c.first_name || 'Candidate',
            last_name: c.last_name || '',
            target_role: c.target_role,
            language_level_self_reported: c.language_level_self_reported,
            user_id: c.user_id,
            supplier_name: sup?.company_name || 'Direct / Agency',
            dt_passed_at: c.dt_passed_at,
            verifiedDocsCount: verifiedCount,
            mandatoryDocsCount: mandatoryCount,
            profileCompletionPct: c.profile_completion_pct || 0,
          };
        });

      setAwaitingReviewCandidates(awaitingList);

      // 3. Fetch gate results for candidates to detect stuck > 7 days & doc verification pass
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      let stuckCandidatesCount = 0;
      const docVerifiedCandidateIds: string[] = [];

      if (candIds.length > 0) {
        const { data: gates } = await supabase
          .from('gate_results')
          .select('candidate_id, gate_type, status, created_at')
          .in('candidate_id', candIds)
          .order('created_at', { ascending: false });

        const latestGateMap: Record<string, any> = {};
        (gates || []).forEach((g) => {
          if (!latestGateMap[g.candidate_id]) {
            latestGateMap[g.candidate_id] = g;
          }
          if (g.gate_type === 'doc_verification' && g.status === 'pass') {
            docVerifiedCandidateIds.push(g.candidate_id);
          }
        });

        // Stuck count: latest gate created < 7 days ago AND status != 'pass'
        candidateList.forEach((c) => {
          if (c.status !== 'placed') {
            const latest = latestGateMap[c.id];
            if (latest && latest.created_at < sevenDaysAgo && latest.status !== 'pass') {
              stuckCandidatesCount++;
            }
          }
        });
      }
      setStuckCount(stuckCandidatesCount);

      // 4. Fetch rejected documents
      const { data: rejDocs } = await supabase
        .from('documents')
        .select('candidate_id, document_type, rejection_reason')
        .in('candidate_id', candIds)
        .eq('status', 'rejected');

      // 5. Fetch academic requests for these candidates
      const { data: acReqs } = await supabase
        .from('academic_requests')
        .select(`
          id,
          candidate_id,
          request_type,
          status,
          requested_by,
          created_at,
          profiles:assigned_mentor_id (first_name, last_name, email),
          candidates:candidate_id (first_name, last_name)
        `)
        .in('candidate_id', candIds);

      const reqCandidateIds = (acReqs || []).map((r) => r.candidate_id);

      // Assemble Action Items:
      const items: ActionItem[] = [];

      // ITEM TYPE 1: Docs verified & no academic request yet
      candidateList.forEach((c) => {
        if (
          docVerifiedCandidateIds.includes(c.id) &&
          !reqCandidateIds.includes(c.id)
        ) {
          const sup = c.suppliers as any;
          items.push({
            id: `st-ready-${c.id}`,
            type: 'speaking_test',
            candidateId: c.id,
            candidateName: `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Candidate #${c.id.slice(0, 6)}`,
            targetRole: c.target_role || 'Healthcare Placement',
            supplierName: sup?.company_name || 'Agency Partner',
            supplierUserId: sup?.user_id || null,
            detail: 'Docs verified — Ready for Speaking Test request',
          });
        }
      });

      // ITEM TYPE 2: Document rejected
      (rejDocs || []).forEach((d) => {
        const c = candidateList.find((cand) => cand.id === d.candidate_id);
        if (c) {
          const sup = c.suppliers as any;
          items.push({
            id: `doc-rej-${d.candidate_id}-${d.document_type}`,
            type: 'doc_rejected',
            candidateId: c.id,
            candidateName: `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Candidate #${c.id.slice(0, 6)}`,
            supplierName: sup?.company_name || 'Agency Partner',
            supplierUserId: sup?.user_id || null,
            detail: `Document rejected (${d.document_type.replace('_', ' ')}) — Notify supplier`,
          });
        }
      });

      // ITEM TYPE 3: Academic requests pending assignment
      (acReqs || []).forEach((r: any) => {
        if (r.status === 'pending_assignment') {
          const c = candidateList.find((cand) => cand.id === r.candidate_id);
          items.push({
            id: `st-pending-${r.id}`,
            type: 'st_pending',
            candidateId: r.candidate_id,
            candidateName: c
              ? `${c.first_name || ''} ${c.last_name || ''}`.trim()
              : 'Candidate',
            supplierName: (c?.suppliers as any)?.company_name || 'Supplier',
            detail: 'Speaking Test request pending assignment. Waiting on Academic Lead.',
          });
        }
      });

      // ITEM TYPE 4: DT Cooling Alerts
      if (candIds.length > 0) {
        const { data: coolingList } = await supabase
          .from('cooling_periods')
          .select('candidate_id, end_date')
          .eq('gate_type', 'dt')
          .eq('status', 'active')
          .in('candidate_id', candIds);

        (coolingList || []).forEach((cp) => {
          const c = candidateList.find((cand) => cand.id === cp.candidate_id);
          if (c) {
            const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Candidate #${c.id.slice(0, 6)}`;
            items.push({
              id: `dt-cooling-${c.id}`,
              type: 'dt_cooling',
              candidateId: c.id,
              candidateName: name,
              supplierName: (c.suppliers as any)?.company_name || 'Agency Partner',
              detail: `DT cooling active until ${new Date(cp.end_date).toLocaleDateString()}`,
            });
          }
        });
      }

      // ITEM TYPE 5: Final Assessment Locked Alerts
      candidateList.forEach((c) => {
        const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Candidate #${c.id.slice(0, 6)}`;
        const sup = c.suppliers as any;
        if (c.final_test_locked) {
          items.push({
            id: `final-locked-${c.id}`,
            type: 'final_test_locked',
            candidateId: c.id,
            candidateName: name,
            supplierName: sup?.company_name || 'Agency Partner',
            detail: 'Final Assessment locked — training required before retake',
          });
        }
      });

      // ITEM TYPE 6: DT Attempt Limit (>= 10)
      candidateList.forEach((c) => {
        const name = `${c.first_name || ''} ${c.last_name || ''}`.trim() || `Candidate #${c.id.slice(0, 6)}`;
        const sup = c.suppliers as any;
        if ((c.dt_attempt_count || 0) >= 10) {
          items.push({
            id: `dt-limit-${c.id}`,
            type: 'dt_attempt_limit',
            candidateId: c.id,
            candidateName: name,
            supplierName: sup?.company_name || 'Agency Partner',
            detail: 'Has used all 10 DT attempts. Cooling period active.',
          });
        }
      });

      // ITEM TYPE 7: Bulk Uploads in past 24 hours
      if (supplierIds.length > 0) {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: bulkUploads } = await supabase
          .from('supplier_bulk_uploads')
          .select(`
            id,
            supplier_id,
            total_candidates,
            successful_candidates,
            failed_candidates,
            suppliers:supplier_id (company_name)
          `)
          .in('supplier_id', supplierIds)
          .gt('created_at', yesterday);

        (bulkUploads || []).forEach((bu: any) => {
          const sName = bu.suppliers?.company_name || 'Supplier';
          items.push({
            id: `bulk-upload-${bu.id}`,
            type: 'bulk_upload',
            supplierName: sName,
            detail: `${sName} uploaded ${bu.total_candidates || 0} candidates (${bu.successful_candidates || 0} added, ${bu.failed_candidates || 0} errors)`,
          });
        });
      }

      setActionItems(items);

      // Speaking Test Requests Table (requested_by = auth.uid())
      const myReqs = (acReqs || []).filter((r) => r.requested_by === user.id);
      const formattedReqs: SpeakingTestRow[] = myReqs.map((r: any) => {
        const c = r.candidates;
        const mentor = r.profiles;
        return {
          id: r.id,
          candidateName: c
            ? `${c.first_name || ''} ${c.last_name || ''}`.trim()
            : 'Candidate',
          status: r.status,
          mentorName: mentor
            ? `${mentor.first_name || ''} ${mentor.last_name || ''}`.trim() ||
              mentor.email
            : 'Unassigned',
          requestedDate: new Date(r.created_at).toLocaleDateString(),
        };
      });

      setSpeakingRequests(formattedReqs);
    } catch (err) {
      console.error('Error fetching Candidate RM overview:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, [user]);

  const handleConfirmSpeakingRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!speakingModalItem || !user) return;

    try {
      setRequestingSpeaking(true);

      // 1. Insert into academic_requests
      const { error: reqErr } = await supabase.from('academic_requests').insert({
        candidate_id: speakingModalItem.candidateId,
        request_type: 'speaking_test',
        requested_by: user.id,
        status: 'pending_assignment',
        notes: speakingNotes || null,
      });

      if (reqErr) throw reqErr;

      // 2. Insert notification for Academic Lead user(s)
      const { data: acLeads } = await supabase
        .from('profiles')
        .select('id')
        .eq('internal_role', 'academic_lead');

      if (acLeads && acLeads.length > 0) {
        const notifs = acLeads.map((al) => ({
          user_id: al.id,
          title: 'Speaking Test Request',
          message: `Candidate ${speakingModalItem.candidateName} from supplier ${speakingModalItem.supplierName} is ready for Speaking Test. Assign a mentor.`,
          type: 'general',
          read: false,
          sent_by: user.id,
        }));
        await supabase.from('notifications').insert(notifs);
      }

      showToast('Speaking Test requested. Academic team has been notified.');
      setSpeakingModalItem(null);
      setSpeakingNotes('');
      fetchOverviewData();
    } catch (err: any) {
      alert(`Failed to request speaking test: ${err.message}`);
    } finally {
      setRequestingSpeaking(false);
    }
  };

  const handleNotifySupplier = async (item: ActionItem) => {
    if (!user) return;

    if (!item.supplierUserId) {
      alert(
        `Cannot notify ${item.supplierName}: Supplier contact has not registered an account yet.`
      );
      return;
    }

    try {
      const { error } = await supabase.from('notifications').insert({
        user_id: item.supplierUserId,
        title: 'Document Action Required',
        message: `Document rejected for candidate ${item.candidateName}. Assist with resubmission.`,
        type: 'document',
        read: false,
        sent_by: user.id,
      });

      if (error) throw error;

      showToast(`Supplier ${item.supplierName} has been notified.`);
    } catch (err: any) {
      alert(`Failed to notify supplier: ${err.message}`);
    }
  };

  const statCards = [
    {
      title: 'My Suppliers',
      count: mySuppliersCount,
      icon: Building2,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      tab: 'my_suppliers',
    },
    {
      title: 'Total Candidates',
      count: totalCandidatesCount,
      icon: Users,
      color: 'text-sky-600',
      bg: 'bg-sky-50',
      tab: 'my_candidates',
    },
    {
      title: 'Stuck >7 Days',
      count: stuckCount,
      icon: Clock,
      color: stuckCount > 0 ? 'text-rose-600' : 'text-slate-500',
      bg: stuckCount > 0 ? 'bg-rose-50' : 'bg-slate-50',
      tab: 'my_candidates',
    },
    {
      title: 'Interview Ready',
      count: interviewReadyCount,
      icon: Sparkles,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      tab: 'my_candidates',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header bar with subtitle & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#E2E8F4]">
        <div>
          <p className="text-[13px] text-[#4A5568]">
            Monitor international talent progression, supplier adherence, and coordinate speaking test gate milestones.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchOverviewData();
          }}
          disabled={loading || refreshing}
          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-white border border-[#E2E8F4] hover:bg-slate-50 text-slate-700 rounded-[8px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-slate-500 ${
              refreshing ? 'animate-spin' : ''
            }`}
          />
          <span>{refreshing ? 'Syncing...' : 'Sync Pipeline'}</span>
        </button>
      </div>

      {/* STATS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.title}
              onClick={() => onNavigateTab(card.tab)}
              className="bg-white border border-[#E2E8F4] rounded-[12px] p-5 shadow-xs hover:border-[#1B3270]/40 transition-all cursor-pointer group flex flex-col justify-between min-h-[104px]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] transition-colors">
                  {card.title}
                </span>
                <Icon className="w-4 h-4 text-[#2952A3] stroke-[1.5]" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-[24px] font-semibold text-[#1B3270] leading-tight tracking-tight">
                  {loading ? '—' : card.count}
                </span>
                <span className="text-[11px] font-medium text-[#94A3B8] group-hover:text-[#1B3270] flex items-center transition-colors">
                  View <ArrowRight className="w-3 h-3 ml-0.5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* AWAITING DOCUMENT REVIEW (Part 1) */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCheck2 className="w-4 h-4 text-[#1B3270]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Awaiting Document Review
            </h2>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1B3270] border border-blue-200">
            {awaitingReviewCandidates.length} Awaiting Review
          </span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : awaitingReviewCandidates.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-slate-600 font-medium">
                No candidates awaiting document review.
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All candidates who passed the Diagnostic Test have their speaking test scheduled or are proceeding to next stages.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4">DT Pass Date</th>
                    <th className="py-3 px-4">Documents</th>
                    <th className="py-3 px-4">Profile Completion</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                  {awaitingReviewCandidates.map((cand) => (
                    <tr key={cand.id} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div>
                          {cand.first_name} {cand.last_name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal font-mono">
                          #{cand.id.slice(0, 6).toUpperCase()} • {cand.supplier_name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {new Date(cand.dt_passed_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            cand.verifiedDocsCount === cand.mandatoryDocsCount
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {cand.verifiedDocsCount} of {cand.mandatoryDocsCount} verified
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#1B3270] rounded-full"
                              style={{ width: `${cand.profileCompletionPct}%` }}
                            />
                          </div>
                          <span className="font-semibold text-slate-700">
                            {cand.profileCompletionPct}% complete
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReviewCandidate(cand);
                            setIsReviewPanelOpen(true);
                          }}
                          className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs transition-colors inline-flex items-center space-x-1.5"
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>Review Documents</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* TODAY'S ACTIONS CARD: What Needs Attention */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E2E8F4] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Today's Actions — What Needs Attention
            </h2>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            {actionItems.length} Actionable Items
          </span>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : actionItems.length === 0 ? (
            <div className="py-10 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-xs text-slate-600 font-medium">
                No immediate blockers. All candidate qualification stages are progressing smoothly.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F4] -my-2">
              {actionItems.map((item) => (
                <div
                  key={item.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.type === 'doc_rejected' || item.type === 'final_test_locked'
                            ? 'bg-rose-500'
                            : item.type === 'speaking_test'
                            ? 'bg-emerald-500'
                            : item.type === 'bulk_upload'
                            ? 'bg-blue-500'
                            : item.type === 'dt_attempt_limit'
                            ? 'bg-orange-500'
                            : 'bg-amber-500'
                        }`}
                      />
                      {item.candidateName ? (
                        <>
                          <span className="font-bold text-slate-900">
                            {item.candidateName}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 font-medium">
                            {item.supplierName}
                          </span>
                        </>
                      ) : (
                        <span className="font-bold text-slate-900">
                          {item.supplierName}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 pl-4">{item.detail}</p>
                  </div>

                  {/* Actions */}
                  <div className="pl-4 sm:pl-0 flex items-center">
                    {item.type === 'speaking_test' && (
                      <button
                        type="button"
                        onClick={() => setSpeakingModalItem(item)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs flex items-center space-x-1.5 transition-colors"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Request Speaking Test</span>
                      </button>
                    )}

                    {item.type === 'final_test_locked' && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('my_candidates')}
                        className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs flex items-center space-x-1.5 transition-colors"
                      >
                        <span>View Candidate</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {(item.type === 'dt_cooling' ||
                      item.type === 'dt_attempt_limit' ||
                      item.type === 'bulk_upload') && (
                      <span className="text-[11px] text-slate-500 font-medium px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        Informational
                      </span>
                    )}

                    {item.type === 'doc_rejected' && (
                      <button
                        type="button"
                        onClick={() => handleNotifySupplier(item)}
                        className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold cursor-pointer shadow-2xs flex items-center space-x-1.5 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Notify Supplier</span>
                      </button>
                    )}

                    {item.type === 'st_pending' && (
                      <span className="text-[11px] text-slate-400 italic flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        Waiting on Academic Lead
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SPEAKING TEST REQUESTS TABLE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            My Speaking Test Requests (Gate 3)
          </h2>
          <span className="text-xs text-slate-400">
            {speakingRequests.length} requests initiated
          </span>
        </div>

        <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : speakingRequests.length === 0 ? (
            <div className="py-10 text-center">
              <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">
                No Speaking Test requests initiated yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Candidate Name</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Assigned Mentor</th>
                    <th className="py-3 px-4">Requested Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F4] text-slate-700">
                  {speakingRequests.map((r) => (
                    <tr key={r.id} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {r.candidateName}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.status === 'assigned'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {r.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">
                        {r.mentorName}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {r.requestedDate}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRM SPEAKING TEST REQUEST MODAL */}
      {speakingModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                Request Speaking Test Assessment
              </h3>
              <button
                type="button"
                onClick={() => setSpeakingModalItem(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3 text-xs space-y-1">
              <div>
                Candidate:{' '}
                <span className="font-bold text-slate-900">
                  {speakingModalItem.candidateName}
                </span>
              </div>
              <div>
                Target Clinical Role:{' '}
                <span className="font-semibold text-slate-800">
                  {speakingModalItem.targetRole}
                </span>
              </div>
              <div>
                Supplier Partner:{' '}
                <span className="font-medium text-slate-700">
                  {speakingModalItem.supplierName}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmSpeakingRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Optional Assessment Notes for Mentor
                </label>
                <textarea
                  rows={2}
                  value={speakingNotes}
                  onChange={(e) => setSpeakingNotes(e.target.value)}
                  placeholder="Special clinical handover notes, dialect preparation..."
                  className="w-full text-xs p-2 border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#E2E8F4]">
                <button
                  type="button"
                  onClick={() => setSpeakingModalItem(null)}
                  className="px-3 py-1.5 border border-[#E2E8F4] rounded-[6px] text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={requestingSpeaking}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 shadow-2xs"
                >
                  {requestingSpeaking ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DOCUMENT REVIEW PANEL (Parts 3 & 4) */}
      <DocumentReviewPanel
        candidate={selectedReviewCandidate}
        isOpen={isReviewPanelOpen}
        onClose={() => {
          setIsReviewPanelOpen(false);
          setSelectedReviewCandidate(null);
        }}
        onSuccess={() => {
          fetchOverviewData();
        }}
      />
    </div>
  );
};

export default CandidateRmOverviewTab;
