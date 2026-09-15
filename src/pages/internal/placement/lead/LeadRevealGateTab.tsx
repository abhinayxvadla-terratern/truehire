import React, { useState, useEffect } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  RevealGateCard,
  RevealGateApplication,
} from '../components/RevealGateCard';
import { Search, Check, ShieldCheck } from 'lucide-react';
import { confirmPlacement } from '../../../../utils/placementConfirmation';

export const LeadRevealGateTab: React.FC = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<RevealGateApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchRevealApplications = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id,
          candidate_id,
          job_id,
          status,
          updated_at,
          created_at,
          reveal_gate_conditions,
          supplier_id,
          candidates:candidate_id (first_name, last_name),
          job_requirements:job_id (
            title,
            employer_id,
            employers:employer_id (id, company_name, user_id)
          ),
          suppliers:supplier_id (company_name)
        `)
        .in('status', ['offer_sent', 'reveal_gate'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const mapped: RevealGateApplication[] = (data || []).map((app: any) => {
        const c = app.candidates;
        const cName = c
          ? `${c.first_name || ''} ${c.last_name || ''}`.trim() ||
            `Candidate #${app.candidate_id.slice(0, 6)}`
          : `Candidate #${app.candidate_id.slice(0, 6)}`;

        const updatedDate = new Date(app.updated_at || Date.now());
        const daysDiff = Math.max(
          0,
          Math.floor((Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        return {
          id: app.id,
          candidate_id: app.candidate_id,
          candidate_name: cName,
          job_id: app.job_id,
          job_title: app.job_requirements?.title || 'Healthcare Position',
          employer_id: app.job_requirements?.employer_id || '',
          employer_name:
            app.job_requirements?.employers?.company_name || 'Hospital Facility',
          supplier_id: app.supplier_id,
          supplier_name: app.suppliers?.company_name || 'Direct Candidate',
          status: app.status,
          days_in_offer: daysDiff,
          reveal_gate_conditions: app.reveal_gate_conditions || {
            offer_letter: false,
            deposit: false,
            consent: false,
          },
          created_at: app.created_at,
          updated_at: app.updated_at,
        };
      });

      setApplications(mapped);
    } catch (err) {
      console.error('Error fetching reveal gate applications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevealApplications();
  }, []);

  const handleConditionToggle = async (
    applicationId: string,
    key: 'offer_letter' | 'deposit' | 'consent',
    newValue: boolean
  ) => {
    const target = applications.find((a) => a.id === applicationId);
    if (!target) return;

    const currentConditions = target.reveal_gate_conditions || {
      offer_letter: false,
      deposit: false,
      consent: false,
    };

    const updated = {
      ...currentConditions,
      [key]: newValue,
    };

    // If at least one condition is met, move to 'reveal_gate' status if was 'offer_sent'
    const newStatus =
      target.status === 'offer_sent' ? 'reveal_gate' : target.status;

    try {
      const { error } = await supabase
        .from('job_applications')
        .update({
          reveal_gate_conditions: updated,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);

      if (error) throw error;

      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId
            ? { ...app, reveal_gate_conditions: updated, status: newStatus }
            : app
        )
      );

      showToast(`Condition '${key.replace('_', ' ')}' updated.`);
    } catch (err: any) {
      alert(`Failed to update condition: ${err.message}`);
    }
  };

  const handleCompleteRevealGate = async (application: RevealGateApplication) => {
    if (!user) return;

    try {
      await confirmPlacement({
        supabase,
        applicationId: application.id,
        candidateId: application.candidate_id,
        jobId: application.job_id,
        jobTitle: application.job_title,
        employerId: application.employer_id,
        supplierId: application.supplier_id,
        confirmedByUserId: user.id,
      });

      showToast('Placement confirmed. Reveal Gate completed successfully.');
      fetchRevealApplications();
    } catch (err: any) {
      alert(`Error completing Reveal Gate: ${err.message}`);
    }
  };

  const filteredApplications = applications.filter((app) => {
    if (statusFilter !== 'all' && app.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = app.job_title.toLowerCase().includes(q);
      const matchEmp = app.employer_name.toLowerCase().includes(q);
      const matchSup = (app.supplier_name || '').toLowerCase().includes(q);
      const matchId = app.candidate_id.toLowerCase().includes(q);
      if (!matchTitle && !matchEmp && !matchSup && !matchId) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] shadow-lg text-xs font-medium flex items-center space-x-2 animate-in fade-in slide-in-from-bottom-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Gate 5: Reveal Gate Coordination
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Verify contractual terms, escrow deposits, and candidate consents before confirming official hospital placements.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search candidate #ID, position, hospital, or supplier..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[6px] focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full py-1.5 px-3 text-xs border border-[#E2E8F4] rounded-[6px] text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#1B3270]"
            >
              <option value="all">All Stage Statuses</option>
              <option value="offer_sent">Offer Sent</option>
              <option value="reveal_gate">Reveal Gate Active</option>
            </select>
          </div>
        </div>
      </div>

      {/* Application Cards List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 bg-white border border-[#E2E8F4] rounded-[10px] animate-pulse"
            />
          ))}
        </div>
      ) : filteredApplications.length === 0 ? (
        <div className="bg-white border border-[#E2E8F4] rounded-[10px] py-16 px-4 text-center shadow-2xs">
          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">
            No applications in Reveal Gate
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Candidates who receive official hospital offers (`offer_sent` or `reveal_gate`) will appear here for prerequisite condition verification.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApplications.map((app) => (
            <RevealGateCard
              key={app.id}
              application={app}
              onConditionToggle={handleConditionToggle}
              onCompleteRevealGate={handleCompleteRevealGate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LeadRevealGateTab;
