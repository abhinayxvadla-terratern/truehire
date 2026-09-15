import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { getInternalDashboardPath, getExternalDashboardPath } from '../utils/internalRouting';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRole,
}) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-3 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
          <span className="text-xs text-[#94A3B8] font-medium">Loading TerraTern...</span>
        </div>
      </div>
    );
  }

  // 1. If no session: redirect to /login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. If session but no profile: redirect to /register
  if (!profile) {
    return <Navigate to="/register" state={{ from: location }} replace />;
  }

  // 3. If user is internal staff: redirect to their designated internal dashboard
  if (profile.is_internal) {
    return <Navigate to={getInternalDashboardPath(profile.internal_role)} replace />;
  }

  // 4. If allowedRole is specified and does not match: redirect to user's assigned role dashboard
  if (allowedRole && profile.role !== allowedRole) {
    return <Navigate to={getExternalDashboardPath(profile.role)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
