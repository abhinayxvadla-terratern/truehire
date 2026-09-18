import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getInternalDashboardPath } from '../../utils/internalRouting';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';

export const InternalLogin: React.FC = () => {
  const navigate = useNavigate();
  const { session, profile, refreshProfile } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-redirect if already signed in as internal staff
  useEffect(() => {
    if (session && profile?.is_internal) {
      navigate(getInternalDashboardPath(profile.internal_role), { replace: true });
    }
  }, [session, profile, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      // 1. Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        setErrorMessage(authError.message || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setErrorMessage('Authentication failed. No user returned.');
        setLoading(false);
        return;
      }

      // 2. Fetch profiles row for auth.uid()
      const { data: profileRow, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching internal profile:', profileError);
        await supabase.auth.signOut();
        setErrorMessage('Failed to verify team authorization. Contact team lead.');
        setLoading(false);
        return;
      }

      // 3. Check is_internal = true
      if (!profileRow || !profileRow.is_internal) {
        await supabase.auth.signOut();
        setErrorMessage('This login is for TerraTern internal team only.');
        setLoading(false);
        return;
      }

      // Refresh AuthContext profile
      await refreshProfile();

      // 4. Route based on internal_role
      const targetRoute = getInternalDashboardPath(profileRow.internal_role);
      navigate(targetRoute, { replace: true });
    } catch (err: any) {
      console.error('Unexpected error during internal sign in:', err);
      setErrorMessage(err.message || 'An unexpected error occurred.');
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Team Access"
      subtitle="Authorized TerraTern personnel only"
      badge="Team Access"
      bottomLinks={
        <p className="text-[11px] text-[#94A3B8]">
          Unauthorized access attempts are monitored and logged.
        </p>
      }
    >
      {/* Super Admin Credentials Helper */}
      <div className="mb-4 p-3.5 bg-slate-50 border border-[#E2E8F4] rounded-[8px] text-xs">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-1.5 text-slate-800 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#1B3270]" />
            <span>Default Super Admin Credentials</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setEmail('admin@terratern.com');
              setPassword('Admin@123456');
              if (errorMessage) setErrorMessage(null);
            }}
            className="text-[11px] font-semibold text-[#1B3270] hover:text-[#2952A3] underline cursor-pointer"
          >
            Auto-fill
          </button>
        </div>
        <div className="space-y-0.5 text-slate-600 font-mono text-[11px]">
          <div>Email: <span className="text-slate-900 font-semibold">admin@terratern.com</span></div>
          <div>Password: <span className="text-slate-900 font-semibold">Admin@123456</span></div>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-4 text-[12px] text-[#EF4444] bg-[#FEF2F2] border border-[#EF4444]/20 rounded-[8px] p-2.5">
          {errorMessage}
        </div>
      )}

      {/* Sign In Form */}
      <form onSubmit={handleSignIn} className="space-y-4">
        <div>
          <label className="block text-[12px] font-medium text-[#1B3270] mb-1.5">
            Staff Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. name@terratern.com"
            className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
          />
        </div>

        <div>
          <label className="block text-[12px] font-medium text-[#1B3270] mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        <button
          type="submit"
          disabled={loading}
          className="w-full h-[44px] bg-[#1B3270] hover:bg-[#2952A3] text-white text-[14px] font-semibold rounded-[8px] transition-colors duration-150 shadow-xs flex items-center justify-center disabled:opacity-60 cursor-pointer mt-6"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span>Sign In</span>
          )}
        </button>
      </form>
    </AuthLayout>
  );
};

export default InternalLogin;

