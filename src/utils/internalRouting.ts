import { InternalRole, UserRole } from '../context/AuthContext';

/**
 * Returns the designated internal dashboard path for a given internal role.
 */
export const getInternalDashboardPath = (
  internalRole?: InternalRole | string | null
): string => {
  switch (internalRole) {
    case 'super_admin':
      return '/admin';
    case 'partnerships_lead':
      return '/internal/partnerships-lead';
    case 'supplier_partnerships_associate':
      return '/internal/partnerships-supplier';
    case 'employer_partnerships_associate':
      return '/internal/partnerships-employer';
    case 'placement_lead':
      return '/internal/placement-lead';
    case 'candidate_supplier_rm':
      return '/internal/candidate-rm';
    case 'employer_requirements_rm':
      return '/internal/employer-rm';
    case 'academic_lead':
      return '/internal/academic-lead';
    case 'mentor':
      return '/internal/mentor';
    default:
      return '/admin';
  }
};

/**
 * Returns the external dashboard path for candidates, suppliers, and employers.
 */
export const getExternalDashboardPath = (
  role?: UserRole | string | null
): string => {
  switch (role) {
    case 'candidate':
      return '/candidate';
    case 'supplier':
      return '/supplier';
    case 'employer':
      return '/employer';
    default:
      return '/login';
  }
};

/**
 * Determines whether a URL path belongs to the internal staff area.
 */
export const isInternalPath = (pathname: string): boolean => {
  return pathname.startsWith('/internal') || pathname.startsWith('/admin');
};
