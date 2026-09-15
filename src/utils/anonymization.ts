export interface CandidateDisplayInfo {
  display: string;
  level: 1 | 2 | 3;
  label: string | null;
  email?: string | null;
  supplierName?: string | null;
}

/**
 * 3-Level Candidate Anonymization Rule
 * 
 * LEVEL 1 — FULLY ANONYMOUS:
 * When to use: Talent Pool, in any employer view for applications with status IN ('applied', 'shortlisted')
 * What to show: "Candidate #[first 6 chars of candidate.id uppercase]"
 * Never show: name, email, phone, supplier name
 * 
 * LEVEL 2 — LIGHT REVEAL (interview coordination):
 * When to use: Employer's My Candidates tab and Employer RM's Pipeline tab when application status = 'interview_scheduled' or beyond (before 'placed')
 * What to show: Candidate first_name + last_name only
 * Subtitle: "Name shared for interview coordination"
 * 
 * LEVEL 3 — FULL REVEAL (post placement):
 * When to use: application status = 'placed' only
 * What to show: full candidate name + email + supplier company name
 * Subtitle: "Fully revealed — placement complete"
 */
export function getCandidateDisplay(
  candidate: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    supplier_name?: string | null;
    suppliers?: { company_name?: string | null } | null;
  },
  applicationStatus?: string | null
): CandidateDisplayInfo {
  const id = (candidate.id || '').substring(0, 6).toUpperCase();
  const fullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();
  const candidateEmail = candidate.email || null;
  const supplierName =
    candidate.supplier_name || candidate.suppliers?.company_name || null;

  if (!applicationStatus || ['applied', 'shortlisted'].includes(applicationStatus)) {
    return {
      display: `Candidate #${id}`,
      level: 1,
      label: null,
    };
  }

  if (applicationStatus === 'placed') {
    return {
      display: fullName || `Candidate #${id}`,
      level: 3,
      label: 'Fully revealed — placement complete',
      email: candidateEmail,
      supplierName,
    };
  }

  // interview_scheduled and beyond (not placed)
  return {
    display: fullName || `Candidate #${id}`,
    level: 2,
    label: 'Name shared for interview coordination',
  };
}
