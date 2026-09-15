import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, InternalRole } from '../../context/AuthContext';
import { getInternalDashboardPath } from '../../utils/internalRouting';
import { Loader2 } from 'lucide-react';

interface InternalProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: InternalRole;
}

export const InternalProtectedRoute: React.FC<InternalProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { session, profile, loading, signOut } = useAuth();
  const location = useLocation();

  const isUnauthorizedExternalUser = !!session && (!profile || !profile.is_internal);

  useEffect(() => {
    if (isUnauthorizedExternalUser) {
      signOut();
    }
  }, [isUnauthorizedExternalUser, signOut]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1B3270]" />
          <span className="text-xs text-[#94A3B8] font-medium">
            Verifying internal authorization...
          </span>
        </div>
      </div>
    );
  }

  // 1. If not authenticated: redirect to internal login
  if (!session) {
    return <Navigate to="/internal/login" state={{ from: location }} replace />;
  }

  // 2. If authenticated as external user attempting internal route:
  // Sign them out and redirect to /login with error
  if (!profile || !profile.is_internal) {
    return (
      <Navigate
        to="/login"
        state={{ error: "You don't have access to this area." }}
        replace
      />
    );
  }

  // 3. If requiredRole is specified and does not match: redirect to user's assigned dashboard
  if (requiredRole && profile.internal_role !== requiredRole) {
    const fallback = getInternalDashboardPath(profile.internal_role);
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
};

export default InternalProtectedRoute;
