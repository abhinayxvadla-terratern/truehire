import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  User,
  FileText,
  ExternalLink,
  AlertTriangle,
  Loader2,
  Award,
  ArrowLeft,
} from 'lucide-react';
import { ALL_DOCUMENT_TYPES } from '../../../utils/documentTypes';
import { formatDate } from '../../../utils/formatters';
import { QuestionReviewView } from '../../../components/candidate/dt/QuestionReviewView';

interface CandidateProfileDetailViewProps {
  candidateId: string;
  showAttentionAlert?: boolean;
}

export const CandidateProfileDetailView: React.FC<CandidateProfileDetailViewProps> = ({
  candidateId,
  showAttentionAlert = true,
}) => {
  const [loading, setLoading] = useState(true);
  const [candidate, setCandidate] = useState<any>(null);
  const [personalInfo, setPersonalInfo] = useState<any>(null);
  const [education, setEducation] = useState<any>(null);
  const [professionalReg, setProfessionalReg] = useState<any>(null);
  const [workExperience, setWorkExperience] = useState<any[]>([]);
  const [languageProficiency, setLanguageProficiency] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [dtAttempts, setDtAttempts] = useState<any[]>([]);
  const [activeCooling, setActiveCooling] = useState<any>(null);
  const [coolingPeriodsList, setCoolingPeriodsList] = useState<any[]>([]);
  const [offeringsAvailed, setOfferingsAvailed] = useState(false);
  const [selectedAttemptIdForReview, setSelectedAttemptIdForReview] = useState<string | null>(null);
  const [seenQuestions, setSeenQuestions] = useState<any[]>([]);
  const [poolStats, setPoolStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!candidateId) return;
      try {
        setLoading(true);

        const [
          candRes,
          pRes,
          eRes,
          prRes,
          weRes,
          lpRes,
          docsRes,
          dtAttRes,
          coolingRes,
          offRes,
          seenRes,
          poolStatsRes,
        ] = await Promise.all([
          supabase.from('candidates').select('*').eq('id', candidateId).maybeSingle(),
          supabase.from('candidate_personal_info').select('*').eq('candidate_id', candidateId).maybeSingle(),
          supabase.from('candidate_education').select('*').eq('candidate_id', candidateId).maybeSingle(),
          supabase.from('candidate_professional_registration').select('*').eq('candidate_id', candidateId).maybeSingle(),
          supabase.from('candidate_work_experience').select('*').eq('candidate_id', candidateId).order('entry_order', { ascending: true }),
          supabase.from('candidate_language_proficiency').select('*').eq('candidate_id', candidateId).maybeSingle(),
          supabase.from('documents').select('*').eq('candidate_id', candidateId),
          supabase.from('dt_attempts').select('*').eq('candidate_id', candidateId).order('attempt_number', { ascending: false }),
          supabase.from('cooling_periods').select('*').eq('candidate_id', candidateId).eq('gate_type', 'dt').order('started_at', { ascending: false }),
          supabase.from('candidate_offerings').select('*').eq('candidate_id', candidateId).eq('gate_type_failed', 'dt').eq('status', 'availed'),
          supabase.from('dt_candidate_seen_questions').select(`
            question_id,
            times_seen,
            first_seen_at,
            last_seen_at,
            dt_questions (
              id,
              difficulty_level,
              is_active
            )
          `).eq('candidate_id', candidateId),
          supabase.from('dt_question_pool_stats').select('*'),
        ]);

        const allCp = coolingRes.data || [];
        const activeCp = allCp.find((cp: any) => cp.status === 'active' && new Date(cp.ends_at) > new Date()) || null;

        setCandidate(candRes.data);
        setPersonalInfo(pRes.data);
        setEducation(eRes.data);
        setProfessionalReg(prRes.data);
        setWorkExperience(weRes.data || []);
        setLanguageProficiency(lpRes.data);
        setDocuments(docsRes.data || []);
        setDtAttempts(dtAttRes.data || []);
        setCoolingPeriodsList(allCp);
        setActiveCooling(activeCp);
        setOfferingsAvailed((offRes.data || []).length > 0);

        setSeenQuestions(seenRes.data || []);
        const statsMap: Record<string, number> = {};
        (poolStatsRes.data || []).forEach((row: any) => {
          if (row.difficulty_level) {
            statsMap[row.difficulty_level.toLowerCase()] = Number(row.active_count) || 0;
          }
        });
        setPoolStats(statsMap);
      } catch (err) {
        console.error('Error loading candidate profile details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [candidateId]);

  const handleOpenFile = async (fileUrl: string) => {
    try {
      let url = fileUrl;
      if (!fileUrl.startsWith('http')) {
        const { data, error } = await supabase.storage
          .from('candidate-documents')
          .createSignedUrl(fileUrl, 300);
        if (error || !data?.signedUrl) {
          throw error || new Error('Failed to get signed URL');
        }
        url = data.signedUrl;
      }
      window.open(url, '_blank');
    } catch (err) {
      console.error('Error opening file:', err);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-[#1B3270]" />
        <span className="text-xs">Loading Candidate Profile & Documents...</span>
      </div>
    );
  }

  // Documents map by type
  const docMap: Record<string, any> = {};
  const expDocs: any[] = [];
  documents.forEach((d) => {
    if (d.document_type === 'experience_certificate') {
      expDocs.push(d);
    } else {
      docMap[d.document_type] = d;
    }
  });

  // Calculate missing or rejected mandatory documents
  const attentionDocs = ALL_DOCUMENT_TYPES.filter((t) => {
    if (!t.is_mandatory) return false;
    if (t.document_type === 'experience_certificate') {
      return expDocs.length === 0 || expDocs.some((d) => d.status === 'rejected');
    }
    const doc = docMap[t.document_type];
    return !doc || doc.status === 'not_uploaded' || doc.status === 'rejected';
  });

  const completionPct = candidate?.profile_completion_pct ?? 0;

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
            Verified
          </span>
        );
      case 'under_review':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-100 text-sky-800">
            Under Review
          </span>
        );
      case 'pending':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
            Awaiting Review
          </span>
        );
      case 'rejected':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800">
            Rejected
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 text-slate-500">
            Not Uploaded
          </span>
        );
    }
  };

  if (selectedAttemptIdForReview) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedAttemptIdForReview(null)}
          className="inline-flex items-center space-x-1.5 text-xs text-[#2952A3] font-semibold hover:underline cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>Back to Candidate Details</span>
        </button>
        <QuestionReviewView
          attemptId={selectedAttemptIdForReview}
          readOnly={true}
          onBack={() => setSelectedAttemptIdForReview(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs text-slate-700">
      {/* 1. ATTENTION ALERT */}
      {showAttentionAlert && attentionDocs.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-[8px] flex items-center justify-between text-amber-900">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold text-xs">
              {attentionDocs.length} mandatory document{attentionDocs.length > 1 ? 's require' : ' requires'} attention
            </span>
          </div>
          <span className="text-[11px] text-amber-700 font-mono">
            ({attentionDocs.map((d) => d.label).slice(0, 2).join(', ')}
            {attentionDocs.length > 2 ? ` +${attentionDocs.length - 2} more` : ''})
          </span>
        </div>
      )}

      {/* 2. PROFILE SECTION */}
      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-5 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-[#1B3270]" />
            <h3 className="font-bold text-[#1B3270] text-sm">Candidate Profile</h3>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-slate-400 text-[11px]">Completion:</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                completionPct === 100
                  ? 'bg-emerald-100 text-emerald-800'
                  : completionPct >= 50
                  ? 'bg-blue-100 text-[#1B3270]'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {completionPct}% Complete
            </span>
          </div>
        </div>

        {/* 2A. Personal Info */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] text-slate-400">
            Personal Information
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50/70 rounded-[6px] border border-[#E2E8F4]">
            <div>
              <span className="text-[10px] text-slate-400 block">Full Name</span>
              <span className="font-semibold text-slate-800">
                {personalInfo?.full_name || `${candidate?.first_name || ''} ${candidate?.last_name || ''}`.trim() || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Date of Birth</span>
              <span className="font-medium text-slate-700">{personalInfo?.date_of_birth || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Gender</span>
              <span className="font-medium text-slate-700">{personalInfo?.gender || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Nationality</span>
              <span className="font-medium text-slate-700">{personalInfo?.nationality || candidate?.nationality || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Residence</span>
              <span className="font-medium text-slate-700">
                {personalInfo?.city_state ? `${personalInfo.city_state}, ` : ''}{personalInfo?.country_of_residence || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Mobile Number</span>
              <span className="font-medium text-slate-700">{personalInfo?.mobile_number || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">WhatsApp</span>
              <span className="font-medium text-slate-700">
                {personalInfo?.whatsapp_same_as_mobile ? 'Same as mobile' : personalInfo?.whatsapp_number || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Passport Number</span>
              <span className="font-mono font-medium text-slate-800">{personalInfo?.passport_number || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Passport Expiry</span>
              <span className="font-medium text-slate-700">{personalInfo?.passport_expiry_date || '—'}</span>
            </div>
          </div>
        </div>

        {/* 2B. Education & Qualification */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] text-slate-400">
            Education & Qualification
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50/70 rounded-[6px] border border-[#E2E8F4]">
            <div>
              <span className="text-[10px] text-slate-400 block">Healthcare Profession</span>
              <span className="font-semibold text-slate-800">
                {education?.healthcare_profession || candidate?.target_role || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Specialization</span>
              <span className="font-medium text-slate-700">{education?.specialization || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Degree / Diploma</span>
              <span className="font-medium text-slate-700">{education?.degree_title || '—'}</span>
            </div>
            <div className="sm:col-span-2">
              <span className="text-[10px] text-slate-400 block">College / University</span>
              <span className="font-medium text-slate-700">{education?.college_university || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Completion Year</span>
              <span className="font-medium text-slate-700">{education?.year_of_completion || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">10th Board & Year</span>
              <span className="font-medium text-slate-700">
                {education?.board_10th ? `${education.board_10th} (${education.year_10th || ''})` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">12th Board & Year</span>
              <span className="font-medium text-slate-700">
                {education?.board_12th ? `${education.board_12th} (${education.year_12th || ''})` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Internship Completed</span>
              <span className="font-medium text-slate-700">
                {education?.internship_completed ? `Yes — ${education.internship_institution || 'Hospital'}` : 'No'}
              </span>
            </div>
          </div>
        </div>

        {/* 2C. Professional Registration */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] text-slate-400">
            Professional Registration & Licensing
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50/70 rounded-[6px] border border-[#E2E8F4]">
            <div className="sm:col-span-2">
              <span className="text-[10px] text-slate-400 block">Registration Council / Body</span>
              <span className="font-semibold text-slate-800">{professionalReg?.registration_council || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Registration Number</span>
              <span className="font-mono font-medium text-slate-800">{professionalReg?.registration_number || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Issue Date</span>
              <span className="font-medium text-slate-700">{professionalReg?.registration_issue_date || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Valid Until</span>
              <span className="font-medium text-slate-700">{professionalReg?.registration_valid_until || '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">State Council Registration</span>
              <span className="font-medium text-slate-700">{professionalReg?.state_council_registration || '—'}</span>
            </div>
          </div>
        </div>

        {/* 2D. Work Experience */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] text-slate-400">
              Work Experience ({candidate?.total_years_experience || 0} years total)
            </h4>
          </div>
          {workExperience.length === 0 ? (
            <p className="text-slate-400 italic py-2 text-center">No work experience logged yet.</p>
          ) : (
            <div className="space-y-2">
              {workExperience.map((we, idx) => (
                <div
                  key={we.id || idx}
                  className="p-3 bg-slate-50/70 rounded-[6px] border border-[#E2E8F4] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{we.employer_name}</span>
                      {we.is_current_employer && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase bg-emerald-100 text-emerald-800">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {we.job_title} • {we.department_ward}
                    </p>
                  </div>
                  <div className="text-right sm:text-right text-[11px] text-slate-500">
                    <span>
                      {we.start_date} → {we.is_current_employer ? 'Present' : we.end_date}
                    </span>
                    {we.notice_period && (
                      <p className="text-[10px] text-slate-400">Notice: {we.notice_period}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2E. German Language Proficiency */}
        <div className="space-y-2">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] text-slate-400">
            German Language Proficiency
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50/70 rounded-[6px] border border-[#E2E8F4]">
            <div>
              <span className="text-[10px] text-slate-400 block">Current Level</span>
              <span className="font-bold text-[#1B3270]">
                {languageProficiency?.current_german_level || candidate?.language_level_self_reported || '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">B1 Certificate</span>
              <span className="font-medium text-slate-700">
                {languageProficiency?.b1_certificate_obtained
                  ? `Yes (${languageProficiency.b1_certificate_date || 'Certified'})`
                  : 'No'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">B2 Certificate</span>
              <span className="font-medium text-slate-700">
                {languageProficiency?.b2_certificate_obtained
                  ? `Yes (${languageProficiency.b2_certificate_date || 'Certified'})`
                  : 'No'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Enrolled in Course</span>
              <span className="font-medium text-slate-700">
                {languageProficiency?.enrolled_in_german_course
                  ? `Yes (${languageProficiency.training_institute_name || 'Active'})`
                  : 'No'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2.5 DIAGNOSTIC TEST (DT) SECTION */}
      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
          <div className="flex items-center space-x-2">
            <Award className="w-4 h-4 text-[#1B3270]" />
            <h3 className="font-bold text-[#1B3270] text-sm">Diagnostic Test (Gate 1)</h3>
          </div>
          <div>
            {candidate?.dt_passed_at ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Passed on {formatDate(candidate.dt_passed_at)}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                In Progress
              </span>
            )}
          </div>
        </div>

        {/* 5 Summary Telemetry Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
            <span className="text-[10px] text-slate-400 block font-medium">Attempt Count</span>
            <span className="text-base font-bold text-[#1B3270]">
              {candidate?.dt_attempt_count ?? 0} / 10
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
            <span className="text-[10px] text-slate-400 block font-medium">Consecutive Fails</span>
            <span className="text-base font-bold text-[#1B3270]">
              {candidate?.dt_consecutive_fails ?? 0}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
            <span className="text-[10px] text-slate-400 block font-medium">Total Fails (Window)</span>
            <span className="text-base font-bold text-[#1B3270]">
              {candidate?.dt_total_fails_in_window ?? 0}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
            <span className="text-[10px] text-slate-400 block font-medium">Cooling Active</span>
            <span className="text-xs font-bold text-slate-800">
              {activeCooling ? (
                <>
                  Yes —{' '}
                  {activeCooling.cooling_trigger === '3_consecutive'
                    ? '3 consecutive fails'
                    : activeCooling.cooling_trigger === '5_total'
                    ? '5 total fails'
                    : activeCooling.cooling_trigger === 'round_exhausted'
                    ? 'all 10 attempts used'
                    : activeCooling.cooling_trigger || 'cooling active'}{' '}
                  (ends {formatDate(activeCooling.ends_at)})
                </>
              ) : (
                'No'
              )}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
            <span className="text-[10px] text-slate-400 block font-medium">Offerings Availed</span>
            <span className="text-xs font-bold text-slate-800">
              {offeringsAvailed ? 'Yes' : 'No'}
            </span>
          </div>
        </div>

        {/* Seen Questions Telemetry */}
        {(() => {
          const seenByLevel: Record<string, number> = {
            beginner: 0,
            elementary: 0,
            intermediate: 0,
            upper_intermediate: 0,
          };

          seenQuestions.forEach((sq: any) => {
            const diff = sq.dt_questions?.difficulty_level?.toLowerCase();
            if (diff && seenByLevel[diff] !== undefined) {
              seenByLevel[diff] += 1;
            }
          });

          const totalUniqueSeen = seenQuestions.length;

          const TARGETS: Record<string, { label: string; required: number }> = {
            beginner: { label: 'Beginner', required: 30 },
            elementary: { label: 'Elementary', required: 30 },
            intermediate: { label: 'Intermediate', required: 30 },
            upper_intermediate: { label: 'Upper Intermediate', required: 60 },
          };

          const exhaustedLevels = Object.entries(TARGETS)
            .filter(([key]) => {
              const activeInPool = poolStats[key] || 0;
              return activeInPool > 0 && seenByLevel[key] >= activeInPool;
            })
            .map(([_, cfg]) => cfg.label);

          return (
            <div className="p-3.5 bg-slate-50 rounded-[6px] border border-[#E2E8F4] space-y-2">
              <div className="text-xs text-slate-700">
                <span className="font-semibold text-[#1B3270]">Diagnostic Test Questions Seen:</span>{' '}
                <span className="font-bold text-slate-900">{totalUniqueSeen}</span> unique questions (Beginner:{' '}
                {seenByLevel.beginner}/30 | Elementary: {seenByLevel.elementary}/30 | Intermediate:{' '}
                {seenByLevel.intermediate}/30 | Upper Int: {seenByLevel.upper_intermediate}/60)
              </div>

              {exhaustedLevels.length > 0 && (
                <div className="p-2.5 rounded-[6px] bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center space-x-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    {exhaustedLevels.join(', ')} pool exhausted — least-recently-seen questions will be reused for this level.
                  </span>
                </div>
              )}
            </div>
          );
        })()}

        {/* Attempts Table */}
        <div className="space-y-2 pt-1">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px] text-slate-400">
            Attempts Record
          </h4>
          {dtAttempts.length === 0 ? (
            <p className="text-slate-400 italic py-2 text-center text-xs">
              No diagnostic test attempts recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-[#E2E8F4] rounded-[6px] overflow-hidden">
              {dtAttempts.map((att) => (
                <div
                  key={att.id}
                  className="p-3 bg-white hover:bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-[#1B3270] min-w-[75px]">
                      Attempt {att.attempt_number}
                    </span>
                    <span className="text-slate-400">
                      {att.completed_at ? formatDate(att.completed_at) : formatDate(att.started_at)}
                    </span>
                    <span className="font-bold text-[#1B3270]">
                      {att.score_pct !== null ? `${att.score_pct}%` : 'In Progress'}
                    </span>
                    {att.status === 'completed' && (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          att.passed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {att.passed ? 'Pass' : 'Fail'}
                      </span>
                    )}
                    {(() => {
                      const cp = coolingPeriodsList.find((c) => c.triggered_by_attempt_id === att.id);
                      if (!cp) return null;
                      let badgeText = '';
                      if (cp.cooling_trigger === '3_consecutive') badgeText = '3 consecutive';
                      else if (cp.cooling_trigger === '5_total') badgeText = '5 total';
                      else if (cp.cooling_trigger === 'round_exhausted') badgeText = 'Round exhausted';
                      if (!badgeText) return null;
                      return (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          {badgeText}
                        </span>
                      );
                    })()}
                    {att.started_at && (() => {
                      const startMs = new Date(att.started_at).getTime();
                      const endMs = att.completed_at ? new Date(att.completed_at).getTime() : Date.now();
                      const elapsedSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
                      const mins = Math.floor(elapsedSec / 60);
                      const secs = elapsedSec % 60;
                      const timerUsed = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} / 30:00`;

                      if (att.auto_submitted) {
                        return (
                          <div className="flex items-center space-x-1.5 text-[11px]">
                            <span className="text-amber-600 font-medium">Auto-submitted (time expired)</span>
                            <span className="text-slate-400 font-mono text-[10px]">({timerUsed})</span>
                          </div>
                        );
                      }

                      if (att.status === 'completed') {
                        return (
                          <div className="flex items-center space-x-1.5 text-[11px]">
                            <span className="text-slate-600 font-medium">Completed in {mins} min {secs} sec</span>
                            <span className="text-slate-400 font-mono text-[10px]">({timerUsed})</span>
                          </div>
                        );
                      }

                      return null;
                    })()}
                  </div>

                  <div>
                    {att.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => setSelectedAttemptIdForReview(att.id)}
                        className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        View Answers
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. DOCUMENTS SECTION */}
      <div className="bg-white border border-[#E2E8F4] rounded-[8px] p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-[#1B3270]" />
            <h3 className="font-bold text-[#1B3270] text-sm">Documents (18 Types)</h3>
          </div>
          <span className="text-xs text-slate-500">
            {documents.filter((d) => d.status === 'verified').length} / 18 Verified
          </span>
        </div>

        <div className="divide-y divide-[#E2E8F4]">
          {ALL_DOCUMENT_TYPES.map((docConfig) => {
            // Special handling for experience certificate (which can have multiple uploads)
            if (docConfig.document_type === 'experience_certificate') {
              return (
                <div key={docConfig.document_type} className="py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-slate-800">{docConfig.label}</span>
                      <span className="ml-2 px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-rose-50 text-rose-700">
                        Required
                      </span>
                    </div>
                    {expDocs.length === 0 ? (
                      renderStatusBadge('not_uploaded')
                    ) : (
                      <span className="text-[11px] text-[#2952A3] font-semibold">
                        {expDocs.length} certificate{expDocs.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {expDocs.map((exp, eIdx) => (
                    <div
                      key={exp.id || eIdx}
                      className="ml-3 pl-2 border-l-2 border-[#E2E8F4] py-1 flex items-center justify-between text-[11px]"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-600 font-medium">
                          #{eIdx + 1}: {exp.notes || 'Employer Certificate'}
                        </span>
                        {exp.file_url && (
                          <button
                            type="button"
                            onClick={() => handleOpenFile(exp.file_url)}
                            className="text-[#2952A3] hover:underline inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <span>View</span>
                            <ExternalLink size={10} />
                          </button>
                        )}
                      </div>
                      {renderStatusBadge(exp.status)}
                    </div>
                  ))}
                </div>
              );
            }

            const doc = docMap[docConfig.document_type];
            const status = doc?.status || 'not_uploaded';

            return (
              <div
                key={docConfig.document_type}
                className="py-2.5 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-slate-800 truncate">
                      {docConfig.label}
                    </span>
                    {docConfig.is_mandatory ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase bg-rose-50 text-rose-700 shrink-0">
                        Required
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-medium uppercase bg-slate-100 text-slate-500 shrink-0">
                        Optional
                      </span>
                    )}
                  </div>

                  {docConfig.notes && (
                    <p className="text-[11px] text-slate-400 mt-0.5">{docConfig.notes}</p>
                  )}

                  {status === 'rejected' && doc?.rejection_reason && (
                    <p className="text-[11px] text-rose-600 font-medium mt-0.5">
                      Reason: {doc.rejection_reason}
                    </p>
                  )}

                  {doc?.file_url && (
                    <div className="mt-1">
                      <button
                        type="button"
                        onClick={() => handleOpenFile(doc.file_url)}
                        className="text-[#2952A3] hover:underline inline-flex items-center space-x-1 font-medium text-[11px] cursor-pointer"
                      >
                        <FileText size={11} />
                        <span>View Document</span>
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="shrink-0">{renderStatusBadge(status)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
