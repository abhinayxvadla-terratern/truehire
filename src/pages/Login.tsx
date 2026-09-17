import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { getInternalDashboardPath, getExternalDashboardPath, isInternalPath } from '../utils/internalRouting';
import { Eye, EyeOff } from 'lucide-react';
import { AuthLayout } from '../components/layout/AuthLayout';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile, refreshSession } = useAuth();

  // Read role from query param (?role=candidate | employer | supplier)
  const searchParams = new URLSearchParams(location.search);
  const initialRole = searchParams.get('role') || 'candidate';
  const [selectedRole, setSelectedRole] = useState<'candidate' | 'employer' | 'supplier'>(
    initialRole === 'employer' || initialRole === 'supplier' ? initialRole : 'candidate'
  );

  // Sync state if URL changes
  useEffect(() => {
    const roleParam = new URLSearchParams(location.search).get('role');
    if (roleParam === 'employer' || roleParam === 'supplier' || roleParam === 'candidate') {
      setSelectedRole(roleParam);
    }
  }, [location.search]);

  // Listen for redirection error (e.g. unauthorized area access)
  useEffect(() => {
    if (location.state?.error) {
      setErrorMessage(location.state.error);
    }
  }, [location.state]);

  // If already logged in with a profile, redirect to appropriate dashboard
  useEffect(() => {
    if (session && profile) {
      if (profile.is_internal) {
        navigate(getInternalDashboardPath(profile.internal_role), { replace: true });
        return;
      }
      const from = (location.state as any)?.from?.pathname;
      if (from && from !== '/login' && !isInternalPath(from)) {
        navigate(from, { replace: true });
      } else {
        navigate(getExternalDashboardPath(profile.role), { replace: true });
      }
    }
  }, [session, profile, navigate, location]);

  const handleRoleChange = (role: 'candidate' | 'employer' | 'supplier') => {
    setSelectedRole(role);
    navigate(`/login?role=${role}`, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Enter both email and password.');
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message || 'Invalid login credentials.');
        setLoading(false);
        return;
      }

      if (data?.user) {
        // Synchronize active session and profile into AuthContext
        const { profile: userProfile } = await refreshSession();

        if (userProfile?.is_internal) {
          navigate(getInternalDashboardPath(userProfile.internal_role), { replace: true });
        } else if (userProfile?.role) {
          navigate(getExternalDashboardPath(userProfile.role), { replace: true });
        } else {
          // If profile not yet populated, route to complete registration with selected role
          navigate(`/register?role=${selectedRole}`, { replace: true });
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your TerraTern account"
      bottomLinks={
        <div>
          Don&apos;t have an account?{' '}
          <Link
            to={`/register?role=${selectedRole}`}
            className="text-[#2952A3] font-medium hover:underline"
          >
            Register as {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}
          </Link>
        </div>
      }
    >
      {/* Role Switcher tabs */}
      <div className="flex bg-[#F8FAFD] p-1 rounded-[8px] border border-[#E2E8F4] mb-5">
        {(['candidate', 'employer', 'supplier'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => handleRoleChange(r)}
            className={`flex-1 py-1.5 text-[12px] font-medium rounded-[6px] capitalize transition-all cursor-pointer ${
              selectedRole === r
                ? 'bg-white text-[#1B3270] shadow-xs font-semibold'
                : 'text-[#94A3B8] hover:text-[#4A5568]'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-[12px] font-medium text-[#1B3270] mb-1.5"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errorMessage) setErrorMessage(null);
            }}
            placeholder="e.g. name@example.com"
            className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-[12px] font-medium text-[#1B3270] mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="••••••••"
              className="w-full h-[44px] px-3.5 pr-10 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#4A5568] cursor-pointer"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
            </button>
          </div>
        </div>

        {/* Inline Error Display */}
        {errorMessage && (
          <div className="text-[12px] text-[#EF4444] bg-[#FEF2F2] border border-[#EF4444]/20 rounded-[8px] p-2.5">
            {errorMessage}
          </div>
        )}

        {/* Sign In Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-[44px] bg-[#1B3270] hover:bg-[#2952A3] text-white text-[14px] font-semibold rounded-[8px] transition-colors duration-150 shadow-xs disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer mt-6"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span>Sign In</span>
          )}
        </button>

        {/* Internal Team Access Shortcut */}
        <div className="mt-5 pt-4 border-t border-[#E2E8F4] text-center">
          <Link
            to="/internal/login"
            className="inline-flex items-center space-x-1 text-xs font-semibold text-[#1B3270] hover:text-[#2952A3] hover:underline"
          >
            <span>TerraTern Staff &amp; Team Access →</span>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
};

export default Login;
