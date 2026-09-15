import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Building2, Lock, AlertTriangle, CheckCircle2, Loader2, ArrowRight, User, Mail } from 'lucide-react';

interface TeamInviteDetails {
  valid: boolean;
  id?: string;
  supplier_id?: string;
  company_name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  error?: string;
}

export const SupplierTeamInvite: React.FC = () => {
  const { token: paramToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const token = paramToken || searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<TeamInviteDetails | null>(null);
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setInvalidMessage('This invite link is invalid or has already been used.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Call RPC for security definer lookup
        const { data, error } = await supabase.rpc('get_team_invite_details', {
          p_token: token,
        });

        if (error || !data) {
          console.warn('RPC lookup error, checking direct table:', error);
          const { data: directData, error: directErr } = await supabase
            .from('supplier_team_members')
            .select('*, suppliers(company_name)')
            .eq('invite_token', token)
            .eq('invite_status', 'pending')
            .maybeSingle();

          if (directErr || !directData) {
            setInvalidMessage('This invite link is invalid or has already been used.');
            return;
          }

          setInvite({
            valid: true,
            id: directData.id,
            supplier_id: directData.supplier_id,
            company_name: (directData as any).suppliers?.company_name || 'Partner Company',
            email: directData.email,
            first_name: directData.first_name,
            last_name: directData.last_name,
            role: directData.role,
          });
          setFirstName(directData.first_name || '');
          setLastName(directData.last_name || '');
          return;
        }

        const details = data as TeamInviteDetails;
        if (!details.valid) {
          setInvalidMessage(details.error || 'This invite link is invalid or has already been used.');
        } else {
          setInvite(details);
          setFirstName(details.first_name || '');
          setLastName(details.last_name || '');
        }
      } catch (err: any) {
        console.error('Error verifying team invite token:', err);
        setInvalidMessage('This invite link is invalid or has already been used.');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!token || !invite || !invite.email) {
      setFormError('Missing invitation details.');
      return;
    }

    if (!firstName.trim()) {
      setFormError('First name is required.');
      return;
    }

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    try {
      setSubmitting(true);

      // 1. Sign up user via Supabase Auth
      let userId: string | null = null;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            role: 'supplier',
            is_internal: false,
          },
        },
      });

      if (authError) {
        if (authError.message.toLowerCase().includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: invite.email,
            password,
          });

          if (signInError) {
            setFormError('An account with this email already exists. Enter your existing password to accept this invite.');
            setSubmitting(false);
            return;
          }
          userId = signInData.user.id;
        } else {
          setFormError(authError.message);
          setSubmitting(false);
          return;
        }
      } else if (authData.user) {
        userId = authData.user.id;
      }

      if (!userId) {
        setFormError('Could not finalize account. Try again.');
        setSubmitting(false);
        return;
      }

      // 2. Accept invite via RPC
      const { error: acceptError } = await supabase.rpc('accept_team_invite', {
        p_token: token,
        p_user_id: userId,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
      });

      if (acceptError) {
        console.warn('RPC accept_team_invite warning, falling back to direct table update:', acceptError);

        // Fallback update to supplier_team_members
        await supabase
          .from('supplier_team_members')
          .update({
            profile_id: userId,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            invite_status: 'accepted',
          })
          .eq('invite_token', token);

        // Fallback profile upsert
        await supabase.from('profiles').upsert({
          id: userId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: invite.email,
          role: 'supplier',
          is_internal: false,
        });
      }

      // 3. Refresh auth session
      await refreshProfile();

      setSuccess(true);
      setTimeout(() => {
        navigate('/supplier');
      }, 1500);
    } catch (err: any) {
      console.error('Error during team onboarding submission:', err);
      setFormError(err.message || 'An unexpected error occurred during account setup.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
        <p className="mt-4 text-sm font-medium text-[#4A5568]">Verifying team invitation...</p>
      </div>
    );
  }

  if (invalidMessage || !invite) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[10px] border border-[#E2E8F4] p-8 shadow-sm text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-200">
            <AlertTriangle className="w-7 h-7 text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-[#0F172A] mb-2">Invalid or Expired Link</h2>
          <p className="text-sm text-[#4A5568] mb-6">
            {invalidMessage || 'This invite link is invalid or has already been used.'}
          </p>
          <button
            onClick={() => navigate('/login?role=supplier')}
            className="w-full bg-[#1B3270] hover:bg-[#2952A3] text-white font-semibold py-2.5 px-4 rounded-[6px] text-sm transition-colors"
          >
            Go to Supplier Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-[10px] border border-[#E2E8F4] p-8 shadow-sm">
        {/* Brand Header */}
        <div className="flex items-center space-x-3 mb-6 pb-6 border-b border-[#E2E8F4]">
          <div className="w-10 h-10 rounded-[8px] bg-[#1B3270]/10 flex items-center justify-center border border-[#1B3270]/20">
            <Building2 className="w-5 h-5 text-[#1B3270]" />
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wider text-[#10B981] uppercase">
              Team Member Invitation
            </span>
            <h1 className="text-base font-bold text-[#0F172A]">
              {invite.company_name}
            </h1>
          </div>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-[#0F172A]">Account Created Successfully!</h3>
            <p className="text-xs text-[#4A5568] mt-2">
              Welcome to the {invite.company_name} team portal. Redirecting to your dashboard...
            </p>
            <div className="mt-4 flex justify-center">
              <div className="w-6 h-6 border-2 border-[#1B3270]/20 border-t-[#1B3270] rounded-full animate-spin"></div>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h2 className="text-lg font-bold text-[#0F172A]">Join {invite.company_name}</h2>
              <p className="text-xs text-[#4A5568] mt-1">
                You've been invited to join {invite.company_name} on TerraTern. Create your account credentials to get started.
              </p>
            </div>

            {formError && (
              <div className="mb-5 p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Pre-filled Email */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
                  <input
                    type="email"
                    value={invite.email || ''}
                    readOnly
                    className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-[#E2E8F4] rounded-[6px] text-xs font-medium text-[#4A5568] cursor-not-allowed"
                  />
                </div>
              </div>

              {/* First Name & Last Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    First Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First Name"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Create Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-[6px] text-xs flex items-center justify-center space-x-2 transition-colors shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Setting Up My Account...</span>
                  </>
                ) : (
                  <>
                    <span>Set Up My Account</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
