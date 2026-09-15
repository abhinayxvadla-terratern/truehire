import React from 'react';
import { X, ArrowLeft, Check, AlertTriangle, ShieldCheck, Sparkles } from 'lucide-react';
import { getCandidateDisplay } from '../../utils/anonymization';

interface CandidateComparisonModalProps {
  candidates: any[];
  employer: any;
  interestMap: Record<string, { status: string; id?: string }>;
  onExpressInterest: (candidateId: string) => Promise<void>;
  onClose: () => void;
  submittingInterestId: string | null;
}

const LANGUAGE_RANKS: Record<string, number> = {
  'A1': 1,
  'A2': 2,
  'B1': 3,
  'B2': 4,
  'C1': 5,
  'C2': 6,
};

export const CandidateComparisonModal: React.FC<CandidateComparisonModalProps> = ({
  candidates,
  employer,
  interestMap,
  onExpressInterest,
  onClose,
  submittingInterestId,
}) => {
  if (!candidates || candidates.length === 0) return null;

  // Find best candidates for experience & language level
  const maxExperience = Math.max(
    ...candidates.map((c) => Number(c.total_years_experience || 0))
  );

  const getLangRank = (c: any) => {
    const level = (c.speaking_test_level || c.language_level_self_reported || 'B1')
      .toUpperCase()
      .trim();
    return LANGUAGE_RANKS[level] || 3;
  };

  const maxLangRank = Math.max(...candidates.map((c) => getLangRank(c)));

  const employerRoles = Array.isArray(employer?.healthcare_roles_hiring)
    ? employer.healthcare_roles_hiring.map((r: string) => r.toLowerCase())
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-[#E2E8F4] rounded-[12px] shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#E2E8F4] bg-[#F8FAFD] flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
          <div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] transition-colors mr-2"
              >
                <ArrowLeft size={15} />
                <span>Back to Candidates</span>
              </button>
              <h2 className="text-base sm:text-lg font-bold text-[#0F172A]">
                Candidate Comparison
              </h2>
            </div>
            <p className="text-xs text-[#4A5568] mt-1 ml-0 sm:ml-7">
              Compare up to {candidates.length} candidates side by side.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#94A3B8] hover:text-[#0F172A] rounded-full hover:bg-white transition-colors self-end sm:self-auto"
          >
            <X size={18} />
          </button>
        </div>

        {/* Comparison Matrix (Scrollable horizontally and vertically) */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="min-w-[640px]">
            {/* Grid Container */}
            <div
              className="grid gap-4 items-start"
              style={{
                gridTemplateColumns: `160px repeat(${candidates.length}, minmax(180px, 1fr))`,
              }}
            >
              {/* Row: Header / Candidate ID */}
              <div className="py-4 text-xs font-bold text-[#94A3B8] uppercase tracking-wider self-center">
                Candidate ID
              </div>
              {candidates.map((cand) => {
                const displayInfo = getCandidateDisplay(cand, 'applied');
                return (
                  <div
                    key={`id-${cand.id}`}
                    className="p-4 bg-[#F8FAFD] rounded-[8px] border border-[#E2E8F4] text-center"
                  >
                    <div className="w-9 h-9 mx-auto rounded-full bg-[#1B3270]/10 text-[#1B3270] flex items-center justify-center font-bold text-xs mb-1.5">
                      #{cand.id.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-bold text-[#1B3270] block">
                      {displayInfo.display}
                    </span>
                    <span className="text-[10px] text-[#94A3B8] block mt-0.5">
                      TerraTern Verified
                    </span>
                  </div>
                );
              })}

              {/* Row Divider */}
              <div className="col-span-full border-t border-[#E2E8F4] my-1" />

              {/* Row: Role Fit */}
              <div className="py-3 text-xs font-bold text-[#94A3B8] uppercase tracking-wider self-center">
                Role Fit
              </div>
              {candidates.map((cand) => {
                const roleMatch =
                  employerRoles.length === 0 ||
                  employerRoles.some(
                    (r: string) =>
                      cand.target_role &&
                      (r.includes(cand.target_role.toLowerCase()) ||
                        cand.target_role.toLowerCase().includes(r))
                  );

                return (
                  <div
                    key={`role-${cand.id}`}
                    className="py-3 px-3.5 text-center flex flex-col items-center justify-center space-y-1"
                  >
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#7EB3E8]/20 text-[#2952A3] capitalize">
                      {cand.target_role || 'Healthcare'}
                    </span>
                    {roleMatch ? (
                      <span className="text-[11px] font-semibold text-[#10B981] flex items-center space-x-1">
                        <Check size={12} />
                        <span>Matches your requirements</span>
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-[#F59E0B] flex items-center space-x-1">
                        <AlertTriangle size={12} />
                        <span>Role mismatch</span>
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Row Divider */}
              <div className="col-span-full border-t border-[#E2E8F4] my-1" />

              {/* Row: Language Level */}
              <div className="py-3 text-xs font-bold text-[#94A3B8] uppercase tracking-wider self-center">
                Language Level
              </div>
              {candidates.map((cand) => {
                const isBestLang = getLangRank(cand) === maxLangRank && maxLangRank > 1;
                const assessed = cand.speaking_test_level;
                const displayLevel = assessed || cand.language_level_self_reported || 'B1';

                return (
                  <div
                    key={`lang-${cand.id}`}
                    className={`py-3 px-3.5 rounded-[6px] text-center transition-colors ${
                      isBestLang ? 'bg-[#7EB3E8]/10 border border-[#7EB3E8]/30' : ''
                    }`}
                  >
                    <div className="inline-flex items-center space-x-1">
                      <span className="px-2.5 py-0.5 rounded-[4px] text-xs font-bold bg-[#1B3270] text-white">
                        {displayLevel}
                      </span>
                      {isBestLang && (
                        <span title="Highest language level" className="inline-flex items-center">
                          <Sparkles size={13} className="text-[#2952A3]" />
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#4A5568] block mt-1">
                      {assessed ? 'Assessed & Verified' : '(self-reported)'}
                    </span>
                  </div>
                );
              })}

              {/* Row Divider */}
              <div className="col-span-full border-t border-[#E2E8F4] my-1" />

              {/* Row: Gate Completion */}
              <div className="py-3 text-xs font-bold text-[#94A3B8] uppercase tracking-wider self-center">
                Gate Completion
              </div>
              {candidates.map((cand) => (
                <div key={`gates-${cand.id}`} className="py-3 px-2 text-center">
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                      <Check size={9} className="mr-0.5" /> DT
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                      <Check size={9} className="mr-0.5" /> Docs
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                      <Check size={9} className="mr-0.5" /> Speaking
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                      <Check size={9} className="mr-0.5" /> Bootcamp
                    </span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#10B981]/15 text-[#10B981]">
                      <Check size={9} className="mr-0.5" /> Final Test
                    </span>
                  </div>
                  <span className="text-[10px] text-[#10B981] font-semibold mt-1 block">
                    All 5 Gates Passed
                  </span>
                </div>
              ))}

              {/* Row Divider */}
              <div className="col-span-full border-t border-[#E2E8F4] my-1" />

              {/* Row: Speaking Test Level */}
              <div className="py-3 text-xs font-bold text-[#94A3B8] uppercase tracking-wider self-center">
                Speaking Test Level
              </div>
              {candidates.map((cand) => (
                <div key={`st-${cand.id}`} className="py-3 px-3.5 text-center">
                  <span className="text-xs font-bold text-[#1B3270]">
                    {cand.speaking_test_level ? `${cand.speaking_test_level} — Assessed` : 'Completed (diagnostic)'}
                  </span>
                </div>
              ))}

              {/* Row Divider */}
              <div className="col-span-full border-t border-[#E2E8F4] my-1" />

              {/* Row: Experience */}
              <div className="py-3 text-xs font-bold text-[#94A3B8] uppercase tracking-wider self-center">
                Experience
              </div>
              {candidates.map((cand) => {
                const expYears = cand.total_years_experience;
                const isBestExp =
                  expYears !== null &&
                  expYears !== undefined &&
                  Number(expYears) === maxExperience &&
                  maxExperience > 0;

                return (
                  <div
                    key={`exp-${cand.id}`}
                    className={`py-3 px-3.5 rounded-[6px] text-center transition-colors ${
                      isBestExp ? 'bg-[#7EB3E8]/10 border border-[#7EB3E8]/30' : ''
                    }`}
                  >
                    <span className="text-xs font-bold text-[#0F172A] inline-flex items-center space-x-1">
                      <span>
                        {expYears !== null && expYears !== undefined
                          ? `${expYears} ${Number(expYears) === 1 ? 'year' : 'years'}`
                          : 'Not specified'}
                      </span>
                      {isBestExp && (
                        <span title="Most clinical experience" className="inline-flex items-center">
                          <Sparkles size={13} className="text-[#2952A3]" />
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}

              {/* Row Divider */}
              <div className="col-span-full border-t border-[#E2E8F4] my-1" />

              {/* Row: Target Role */}
              <div className="py-3 text-xs font-bold text-[#94A3B8] uppercase tracking-wider self-center">
                Target Role
              </div>
              {candidates.map((cand) => (
                <div key={`target-${cand.id}`} className="py-3 px-3.5 text-center">
                  <span className="text-xs font-medium text-[#4A5568] capitalize">
                    {cand.target_role || 'Healthcare'}
                  </span>
                </div>
              ))}

              {/* Row Divider */}
              <div className="col-span-full border-t border-[#E2E8F4] my-1" />

              {/* Row: Interest Status / Action */}
              <div className="py-4 text-xs font-bold text-[#94A3B8] uppercase tracking-wider self-center">
                Interest Status
              </div>
              {candidates.map((cand) => {
                const interest = interestMap[cand.id];
                const status = interest?.status;
                const isSubmitting = submittingInterestId === cand.id;

                if (status === 'in_pipeline') {
                  return (
                    <div key={`action-${cand.id}`} className="py-4 px-3 text-center space-y-1">
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 px-3 text-xs font-semibold rounded-[6px] bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 cursor-default"
                      >
                        In Your Pipeline
                      </button>
                      <p className="text-[10px] text-[#4A5568]">
                        This candidate is in your Candidate Pipeline.
                      </p>
                    </div>
                  );
                }

                if (status === 'pending_facilitation') {
                  return (
                    <div key={`action-${cand.id}`} className="py-4 px-3 text-center space-y-1">
                      <button
                        type="button"
                        disabled
                        className="w-full py-2 px-3 text-xs font-semibold rounded-[6px] bg-gray-100 text-[#94A3B8] border border-gray-200 cursor-default"
                      >
                        Interest Expressed
                      </button>
                      <p className="text-[10px] text-[#4A5568]">
                        Our team is facilitating this. Check Expressed Interest tab.
                      </p>
                    </div>
                  );
                }

                return (
                  <div key={`action-${cand.id}`} className="py-4 px-3 text-center space-y-1">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => onExpressInterest(cand.id)}
                      className="w-full py-2 px-3 text-xs font-semibold rounded-[6px] border border-[#1B3270] text-[#1B3270] hover:bg-[#1B3270] hover:text-white transition-colors"
                    >
                      {isSubmitting ? 'Submitting...' : 'Express Interest'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E2E8F4] bg-[#F8FAFD] flex flex-col sm:flex-row items-center justify-between text-xs text-[#94A3B8] gap-2 flex-shrink-0">
          <div className="flex items-center space-x-1.5">
            <ShieldCheck size={14} className="text-[#1B3270]" />
            <span>Candidate identities are anonymized until you select them for interview.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-[#CBD5E1] text-[#4A5568] hover:bg-gray-50 rounded-[6px] font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
