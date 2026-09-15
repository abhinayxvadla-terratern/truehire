import React, { useState } from 'react';
import {
  CheckCircle2,
  FileCheck,
  CreditCard,
  UserCheck,
  Building2,
  ArrowRight,
  Clock,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

export interface RevealGateConditions {
  offer_letter?: boolean;
  deposit?: boolean;
  consent?: boolean;
}

export interface RevealGateApplication {
  id: string;
  candidate_id: string;
  candidate_name?: string;
  job_id: string;
  job_title: string;
  employer_id: string;
  employer_name: string;
  supplier_id?: string | null;
  supplier_name?: string;
  status: string;
  days_in_offer?: number;
  reveal_gate_conditions?: RevealGateConditions | null;
  created_at?: string;
  updated_at?: string;
}

interface RevealGateCardProps {
  application: RevealGateApplication;
  onConditionToggle: (
    applicationId: string,
    key: 'offer_letter' | 'deposit' | 'consent',
    newValue: boolean
  ) => Promise<void>;
  onCompleteRevealGate: (application: RevealGateApplication) => Promise<void>;
}

export const RevealGateCard: React.FC<RevealGateCardProps> = ({
  application,
  onConditionToggle,
  onCompleteRevealGate,
}) => {
  const [toggling, setToggling] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const conditions = application.reveal_gate_conditions || {
    offer_letter: false,
    deposit: false,
    consent: false,
  };

  const isOfferLetterDone = Boolean(conditions.offer_letter);
  const isDepositDone = Boolean(conditions.deposit);
  const isConsentDone = Boolean(conditions.consent);

  const allConditionsMet =
    isOfferLetterDone && isDepositDone && isConsentDone;

  const candidateIdShort = application.candidate_id
    ? application.candidate_id.slice(0, 6).toUpperCase()
    : 'UNKNOWN';

  const handleToggle = async (key: 'offer_letter' | 'deposit' | 'consent', current: boolean) => {
    try {
      setToggling(key);
      await onConditionToggle(application.id, key, !current);
    } finally {
      setToggling(null);
    }
  };

  const handleComplete = async () => {
    if (!allConditionsMet || completing) return;
    try {
      setCompleting(true);
      await onCompleteRevealGate(application);
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-2xs space-y-4 hover:border-slate-300 transition-colors">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E2E8F4] pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 text-slate-800 rounded border border-slate-200">
              Candidate #{candidateIdShort}
            </span>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                application.status === 'placed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : application.status === 'reveal_gate'
                  ? 'bg-indigo-100 text-indigo-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {application.status === 'reveal_gate'
                ? 'Reveal Gate Active'
                : application.status === 'offer_sent'
                ? 'Offer Sent'
                : application.status}
            </span>
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            {application.job_title}
          </h3>
        </div>

        <div className="flex items-center space-x-2 text-xs text-slate-600">
          <Building2 className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-800">
            {application.employer_name}
          </span>
          {application.days_in_offer !== undefined && (
            <span className="flex items-center text-slate-400 pl-2 border-l border-slate-200 text-[11px]">
              <Clock className="w-3 h-3 mr-1" />
              {application.days_in_offer}d in stage
            </span>
          )}
        </div>
      </div>

      {/* Checklist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Condition 1: Offer Letter */}
        <div
          onClick={() => !toggling && handleToggle('offer_letter', isOfferLetterDone)}
          className={`p-3 rounded-[8px] border transition-all cursor-pointer select-none flex items-start space-x-3 ${
            isOfferLetterDone
              ? 'bg-emerald-50/50 border-emerald-300'
              : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="pt-0.5">
            {toggling === 'offer_letter' ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : isOfferLetterDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1.5">
              <FileCheck className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-800">
                Offer Letter Generated
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Contract prepared & terms confirmed
            </p>
          </div>
        </div>

        {/* Condition 2: Employer Deposit */}
        <div
          onClick={() => !toggling && handleToggle('deposit', isDepositDone)}
          className={`p-3 rounded-[8px] border transition-all cursor-pointer select-none flex items-start space-x-3 ${
            isDepositDone
              ? 'bg-emerald-50/50 border-emerald-300'
              : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="pt-0.5">
            {toggling === 'deposit' ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : isDepositDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1.5">
              <CreditCard className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-800">
                Employer Deposit Received
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Escrow payment verified in full
            </p>
          </div>
        </div>

        {/* Condition 3: Candidate Consent */}
        <div
          onClick={() => !toggling && handleToggle('consent', isConsentDone)}
          className={`p-3 rounded-[8px] border transition-all cursor-pointer select-none flex items-start space-x-3 ${
            isConsentDone
              ? 'bg-emerald-50/50 border-emerald-300'
              : 'bg-slate-50/80 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="pt-0.5">
            {toggling === 'consent' ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : isConsentDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <div className="w-4 h-4 rounded border border-slate-300 bg-white" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center space-x-1.5">
              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-800">
                Candidate Consent Obtained
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Signed declaration & acceptance
            </p>
          </div>
        </div>
      </div>

      {/* Completion Bar */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500 flex items-center">
          <ShieldCheck className="w-4 h-4 mr-1.5 text-[#1B3270]" />
          <span>
            {allConditionsMet
              ? 'All three conditions verified. Ready for final placement.'
              : 'Toggle each prerequisite as verified to unlock final placement.'}
          </span>
        </div>

        {allConditionsMet && application.status !== 'placed' && (
          <button
            type="button"
            onClick={handleComplete}
            disabled={completing}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-xs font-bold transition-all shadow-sm flex items-center justify-center space-x-2 cursor-pointer animate-in fade-in"
          >
            {completing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Finalizing Placement...</span>
              </>
            ) : (
              <>
                <span>Confirm Placement</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
