import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Invite } from './pages/Invite';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CandidateDashboard } from './pages/CandidateDashboard';
import { SupplierDashboard } from './pages/SupplierDashboard';
import { EmployerDashboard } from './pages/EmployerDashboard';
import { LandingPage } from './pages/LandingPage';
import { SupplierInvite } from './pages/SupplierInvite';
import { SupplierTeamInvite } from './pages/SupplierTeamInvite';
import { EmployerInvite } from './pages/EmployerInvite';
import { EmployerTeamInvite } from './pages/EmployerTeamInvite';

// Internal Team Auth & Workspaces
import { InternalLogin } from './pages/internal/InternalLogin';
import { AcceptInvite } from './pages/internal/AcceptInvite';
import { SuperAdminDashboard } from './pages/internal/admin/SuperAdminDashboard';
import { PartnershipsLeadDashboard } from './pages/internal/partnerships/lead/PartnershipsLeadDashboard';
import { SupplierAssociateDashboard } from './pages/internal/partnerships/supplier/SupplierAssociateDashboard';
import { EmployerAssociateDashboard } from './pages/internal/partnerships/employer/EmployerAssociateDashboard';
import { PlacementLeadDashboard } from './pages/internal/placement/lead/PlacementLeadDashboard';
import { CandidateRmDashboard } from './pages/internal/placement/candidate_rm/CandidateRmDashboard';
import { EmployerRmDashboard } from './pages/internal/placement/employer_rm/EmployerRmDashboard';
import { AcademicLeadDashboard } from './pages/internal/academic/lead/AcademicLeadDashboard';
import { MentorDashboard } from './pages/internal/academic/mentor/MentorDashboard';
import { InternalProtectedRoute } from './components/internal/InternalProtectedRoute';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public External Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/invite" element={<Invite />} />
          <Route path="/invite/:token" element={<Invite />} />
          <Route path="/supplier-invite" element={<SupplierInvite />} />
          <Route path="/supplier-invite/:token" element={<SupplierInvite />} />
          <Route path="/supplier-team-invite" element={<SupplierTeamInvite />} />
          <Route path="/supplier-team-invite/:token" element={<SupplierTeamInvite />} />
          <Route path="/employer-invite" element={<EmployerInvite />} />
          <Route path="/employer-invite/:token" element={<EmployerInvite />} />
          <Route path="/employer-team-invite" element={<EmployerTeamInvite />} />
          <Route path="/employer-team-invite/:token" element={<EmployerTeamInvite />} />

          {/* Public Landing Page */}
          <Route path="/" element={<LandingPage />} />

          {/* Protected External Dashboards wrapped in shared AppShell */}
          <Route element={<AppShell />}>
            <Route
              path="/candidate"
              element={
                <ProtectedRoute allowedRole="candidate">
                  <CandidateDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/supplier"
              element={
                <ProtectedRoute allowedRole="supplier">
                  <SupplierDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employer"
              element={
                <ProtectedRoute allowedRole="employer">
                  <EmployerDashboard />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* Internal Team Authentication */}
          <Route path="/internal/login" element={<InternalLogin />} />
          <Route path="/internal/accept-invite" element={<AcceptInvite />} />
          <Route path="/internal/accept-invite/:token" element={<AcceptInvite />} />

          {/* Super Admin Dashboard */}
          <Route
            path="/admin"
            element={
              <InternalProtectedRoute requiredRole="super_admin">
                <SuperAdminDashboard />
              </InternalProtectedRoute>
            }
          />

          {/* Internal Staff Role-Specific Workspaces */}
          <Route
            path="/internal/partnerships-lead"
            element={
              <InternalProtectedRoute requiredRole="partnerships_lead">
                <PartnershipsLeadDashboard />
              </InternalProtectedRoute>
            }
          />
          <Route
            path="/internal/partnerships-supplier"
            element={
              <InternalProtectedRoute requiredRole="supplier_partnerships_associate">
                <SupplierAssociateDashboard />
              </InternalProtectedRoute>
            }
          />
          <Route
            path="/internal/partnerships-employer"
            element={
              <InternalProtectedRoute requiredRole="employer_partnerships_associate">
                <EmployerAssociateDashboard />
              </InternalProtectedRoute>
            }
          />
          <Route
            path="/internal/placement-lead"
            element={
              <InternalProtectedRoute requiredRole="placement_lead">
                <PlacementLeadDashboard />
              </InternalProtectedRoute>
            }
          />
          <Route
            path="/internal/candidate-rm"
            element={
              <InternalProtectedRoute requiredRole="candidate_supplier_rm">
                <CandidateRmDashboard />
              </InternalProtectedRoute>
            }
          />
          <Route
            path="/internal/employer-rm"
            element={
              <InternalProtectedRoute requiredRole="employer_requirements_rm">
                <EmployerRmDashboard />
              </InternalProtectedRoute>
            }
          />
          <Route
            path="/internal/academic-lead"
            element={
              <InternalProtectedRoute requiredRole="academic_lead">
                <AcademicLeadDashboard />
              </InternalProtectedRoute>
            }
          />
          <Route
            path="/internal/mentor"
            element={
              <InternalProtectedRoute requiredRole="mentor">
                <MentorDashboard />
              </InternalProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
