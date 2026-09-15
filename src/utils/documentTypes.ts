export type DocumentSection =
  | 'personal'
  | 'education'
  | 'professional'
  | 'experience'
  | 'language'
  | 'general';

export interface DocumentTypeConfig {
  document_type: string;
  label: string;
  is_mandatory: boolean;
  source_section: DocumentSection;
  notes: string | null;
  condition_field?: string;
  condition_value?: string;
}

export const ALL_DOCUMENT_TYPES: DocumentTypeConfig[] = [
  // Personal
  {
    document_type: 'passport',
    label: 'Passport',
    is_mandatory: true,
    source_section: 'personal',
    notes: 'All pages with stamps',
  },
  {
    document_type: 'passport_photo',
    label: 'Passport-size Photograph',
    is_mandatory: true,
    source_section: 'personal',
    notes: 'White background',
  },
  {
    document_type: 'government_id',
    label: 'Aadhaar / Government ID',
    is_mandatory: true,
    source_section: 'personal',
    notes: null,
  },

  // Education
  {
    document_type: 'certificate_10th',
    label: '10th Certificate',
    is_mandatory: true,
    source_section: 'education',
    notes: null,
  },
  {
    document_type: 'certificate_12th',
    label: '12th Certificate',
    is_mandatory: true,
    source_section: 'education',
    notes: null,
  },
  {
    document_type: 'healthcare_degree',
    label: 'Nursing / Healthcare Degree or Diploma',
    is_mandatory: true,
    source_section: 'education',
    notes: null,
  },
  {
    document_type: 'mark_sheets',
    label: 'All Mark Sheets / Transcripts',
    is_mandatory: true,
    source_section: 'education',
    notes: 'All semesters / years',
  },
  {
    document_type: 'degree_completion',
    label: 'Degree Completion Certificate',
    is_mandatory: true,
    source_section: 'education',
    notes: null,
  },
  {
    document_type: 'internship_certificate',
    label: 'Internship Certificate',
    is_mandatory: false,
    source_section: 'education',
    notes: 'Required if internship was completed',
    condition_field: 'internship_completed',
    condition_value: 'true',
  },

  // Professional
  {
    document_type: 'professional_registration_cert',
    label: 'Professional Registration Certificate',
    is_mandatory: true,
    source_section: 'professional',
    notes: null,
  },
  {
    document_type: 'state_council_registration',
    label: 'State Council Registration',
    is_mandatory: false,
    source_section: 'professional',
    notes: null,
  },

  // Experience
  {
    document_type: 'experience_certificate',
    label: 'Experience Certificates',
    is_mandatory: true,
    source_section: 'experience',
    notes: 'One per employer',
  },
  {
    document_type: 'appointment_letter',
    label: 'Appointment / Offer Letter',
    is_mandatory: true,
    source_section: 'experience',
    notes: null,
  },
  {
    document_type: 'relieving_letter',
    label: 'Relieving Letter',
    is_mandatory: true,
    source_section: 'experience',
    notes: 'From previous employer(s)',
  },
  {
    document_type: 'salary_slips',
    label: 'Salary Slips',
    is_mandatory: true,
    source_section: 'experience',
    notes: 'Last 3 months',
  },

  // Language
  {
    document_type: 'german_b1_certificate',
    label: 'German B1 Certificate',
    is_mandatory: false,
    source_section: 'language',
    notes: 'Required if B1 obtained',
    condition_field: 'b1_certificate_obtained',
    condition_value: 'true',
  },
  {
    document_type: 'german_b2_certificate',
    label: 'German B2 Certificate',
    is_mandatory: false,
    source_section: 'language',
    notes: 'Required if B2 obtained',
    condition_field: 'b2_certificate_obtained',
    condition_value: 'true',
  },

  // General
  {
    document_type: 'updated_cv',
    label: 'Updated CV',
    is_mandatory: true,
    source_section: 'general',
    notes: 'English or Europass format',
  },
];

export const MANDATORY_DOC_COUNT = ALL_DOCUMENT_TYPES.filter((d) => d.is_mandatory).length;

export interface ProfileCalculationData {
  personalInfo?: any;
  education?: any;
  professionalReg?: any;
  workExperience?: any[];
  totalYearsExperience?: number | string | null;
  languageProficiency?: any;
}

export interface ProfileSectionStatus {
  personalComplete: boolean;
  educationComplete: boolean;
  professionalComplete: boolean;
  experienceComplete: boolean;
  languageComplete: boolean;
  personalFilled: number;
  educationFilled: number;
  professionalFilled: number;
  experienceFilled: number;
  languageFilled: number;
  totalFilled: number;
  totalMandatory: number;
  pct: number;
}

export function calculateProfileCompletion(data: ProfileCalculationData): ProfileSectionStatus {
  const p = data.personalInfo || {};
  const e = data.education || {};
  const pr = data.professionalReg || {};
  const weList = data.workExperience || [];
  const lp = data.languageProficiency || {};

  const isFilled = (val: any): boolean => {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (typeof val === 'number') return !isNaN(val);
    if (typeof val === 'boolean') return true;
    return Boolean(val);
  };

  // 1. Personal Info (9 mandatory fields)
  let pFilled = 0;
  if (isFilled(p.full_name)) pFilled++;
  if (isFilled(p.date_of_birth)) pFilled++;
  if (isFilled(p.gender)) pFilled++;
  if (isFilled(p.nationality)) pFilled++;
  if (isFilled(p.country_of_residence)) pFilled++;
  if (isFilled(p.city_state)) pFilled++;
  if (isFilled(p.mobile_number)) pFilled++;
  if (isFilled(p.passport_number)) pFilled++;
  if (isFilled(p.passport_expiry_date)) pFilled++;

  // 2. Education (7 mandatory fields)
  let eFilled = 0;
  if (isFilled(e.healthcare_profession)) eFilled++;
  if (isFilled(e.specialization)) eFilled++;
  if (isFilled(e.degree_title)) eFilled++;
  if (isFilled(e.college_university)) eFilled++;
  if (isFilled(e.year_of_completion)) eFilled++;
  if (isFilled(e.board_10th) || isFilled(e.year_10th)) eFilled++;
  if (isFilled(e.board_12th) || isFilled(e.year_12th)) eFilled++;

  // 3. Professional Registration (4 mandatory fields)
  let prFilled = 0;
  if (isFilled(pr.registration_council)) prFilled++;
  if (isFilled(pr.registration_number)) prFilled++;
  if (isFilled(pr.registration_issue_date)) prFilled++;
  if (isFilled(pr.registration_valid_until)) prFilled++;

  // 4. Work Experience (total_years + at least 1 full entry (6 fields) = 7)
  let weFilled = 0;
  const hasTotalYears = isFilled(data.totalYearsExperience) || (weList.length > 0 && isFilled(weList[0]?.total_years_experience));
  if (hasTotalYears) weFilled++;

  const firstEntry = weList[0];
  if (firstEntry) {
    if (firstEntry.is_current_employer !== undefined && firstEntry.is_current_employer !== null) weFilled++;
    if (isFilled(firstEntry.employer_name)) weFilled++;
    if (isFilled(firstEntry.job_title)) weFilled++;
    if (isFilled(firstEntry.department_ward)) weFilled++;
    if (isFilled(firstEntry.start_date)) weFilled++;
    const hasEndOrNotice = firstEntry.is_current_employer
      ? isFilled(firstEntry.notice_period)
      : isFilled(firstEntry.end_date);
    if (hasEndOrNotice) weFilled++;
  }

  // 5. German Language (3 mandatory fields)
  let lpFilled = 0;
  if (isFilled(lp.current_german_level)) lpFilled++;
  if (lp.b1_certificate_obtained !== undefined && lp.b1_certificate_obtained !== null) lpFilled++;
  if (lp.b2_certificate_obtained !== undefined && lp.b2_certificate_obtained !== null) lpFilled++;

  const totalMandatory = 30;
  const totalFilled = Math.min(totalMandatory, pFilled + eFilled + prFilled + weFilled + lpFilled);
  const pct = Math.round((totalFilled / totalMandatory) * 100);

  return {
    personalComplete: pFilled >= 9,
    educationComplete: eFilled >= 7,
    professionalComplete: prFilled >= 4,
    experienceComplete: weFilled >= 7,
    languageComplete: lpFilled >= 3,
    personalFilled: pFilled,
    educationFilled: eFilled,
    professionalFilled: prFilled,
    experienceFilled: weFilled,
    languageFilled: lpFilled,
    totalFilled,
    totalMandatory,
    pct,
  };
}
