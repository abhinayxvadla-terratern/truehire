/**
 * TerraTern Central Label and Naming Mappings
 * Ensures UI language consistency across all public and internal dashboards.
 */

export function getGateLabel(gate_type: string): string {
  const labels: Record<string, string> = {
    dt: 'Diagnostic Test',
    doc_verification: 'Document Verification',
    speaking_test: 'Speaking Test',
    bootcamp: 'Interview Bootcamp',
    assessment: 'Final Assessment',
  };
  return labels[gate_type] ?? gate_type;
}

export function getCandidateStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    onboarding: 'Getting Started',
    in_progress: 'In Qualification',
    interview_ready: 'Interview Ready',
    placed: 'Placed',
  };
  return labels[status] ?? status;
}

export function getApplicationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    applied: 'Applied',
    shortlisted: 'Shortlisted',
    interview_scheduled: 'Interview Scheduled',
    interviewed: 'Interviewed',
    selected: 'Selected',
    offer_sent: 'Offer Sent',
    reveal_gate: 'Reveal Gate',
    placed: 'Placed',
    rejected: 'Not Progressed',
  };
  return labels[status] ?? status;
}

export function getReviewStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_required: 'Not Required',
    pending: 'Pending Review',
    approved: 'Approved',
    queried: 'Clarification Needed',
  };
  return labels[status] ?? status;
}

export function getAcademicRequestStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending_assignment: 'Awaiting Mentor Assignment',
    assigned: 'Mentor Assigned',
    in_progress: 'In Progress',
    pending_review: 'Awaiting Review',
    completed: 'Completed',
  };
  return labels[status] ?? status;
}

export function getDocumentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_uploaded: 'Not Uploaded',
    pending: 'Uploaded — Awaiting Review',
    under_review: 'Under Review',
    verified: 'Verified',
    rejected: 'Rejected',
  };
  return labels[status] ?? status;
}

export function getSupplierTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    basic: 'Basic',
    verified: 'Verified',
    audited: 'Audited',
  };
  return labels[tier] ?? tier;
}

export function getJobStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    paused: 'Paused',
    closed: 'Closed',
  };
  return labels[status] ?? status;
}

export function getOfferingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    training: 'Training Programme',
    language_course: 'Language Course',
  };
  return labels[type] ?? type;
}

export function getEntityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    candidate: 'Candidate',
    supplier: 'Supplier',
    employer: 'Employer',
    application: 'Application',
  };
  return labels[type] ?? type;
}

export function getNoteTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    session: 'Session Note',
    flag: 'At-Risk Flag',
    general: 'General Note',
  };
  return labels[type] ?? type;
}

export function getInviteTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    internal: 'Internal Team Invite',
    supplier: 'Supplier Invite',
    employer: 'Employer Invite',
  };
  return labels[type] ?? type;
}
