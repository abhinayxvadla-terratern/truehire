import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Building2, Lock, AlertTriangle, CheckCircle2, Loader2, ArrowRight, User, Mail } from 'lucide-react';

interface EmployerTeamInviteDetails {
  valid: boolean;
  id?: string;
  employer_id?: string;
  company_name?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  error?: string;
}

export const EmployerTeamInvite: React.FC = () => {
  const { token: paramToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const token = paramToken || searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<EmployerTeamInviteDetails | null>(null);
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
        // 1. Call security definer RPC
        const { data, error } = await supabase.rpc('get_employer_team_invite_details', {
          p_token: token,
        });

        if (error || !data) {
          console.warn('RPC lookup error, checking direct table:', error);
          const { data: directData, error: directErr } = await supabase
            .from('employer_team_members')
            .select('*, employers(company_name)')
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
            employer_id: directData.employer_id || undefined,
            company_name: (directData as any).employers?.company_name || 'Employer Facility',
            email: directData.email,
            first_name: directData.first_name,
            last_name: directData.last_name,
            role: directData.role,
          });
          setFirstName(directData.first_name || '');
          setLastName(directData.last_name || '');
          return;
        }

        const details = data as unknown as EmployerTeamInviteDetails;
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
            role: 'employer',
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
      const { error: acceptError } = await supabase.rpc('accept_employer_team_invite', {
        p_token: token,
        p_user_id: userId,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
      });

      if (acceptError) {
        console.warn('RPC accept_employer_team_invite warning, falling back to direct table update:', acceptError);

        // Fallback update to employer_team_members
        await supabase
          .from('employer_team_members')
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
          role: 'employer',
          is_internal: false,
        });
      }

      setSuccess(true);
      await refreshProfile();

      setTimeout(() => {
        navigate('/employer');
      }, 1500);
    } catch (err: any) {
      console.error('Error during employer team onboarding:', err);
      setFormError(err.message || 'An unexpected error occurred. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mb-3" />
        <p className="text-sm font-medium text-[#4A5568]">Verifying your employer invitation...</p>
      </div>
    );
  }

  if (invalidMessage || !invite) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-8 max-w-md w-full shadow-md text-center">
          <div className="w-12 h-12 bg-[#EF4444]/10 rounded-full flex items-center justify-center mx-auto mb-4 text-[#EF4444]">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-lg font-bold text-[#0F172A] mb-2">Invitation Unavailable</h2>
          <p className="text-xs text-[#4A5568] leading-relaxed mb-6">
            {invalidMessage || 'This invite link is invalid or has already been used.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="w-full py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-[#E2E8F4] rounded-[12px] p-8 max-w-md w-full shadow-md text-center animate-in fade-in">
          <div className="w-12 h-12 bg-[#10B981]/15 rounded-full flex items-center justify-center mx-auto mb-4 text-[#10B981]">
            <CheckCircle2 size={28} />
          </div>
          <h2 className="text-lg font-bold text-[#0F172A] mb-2">Account Setup Complete!</h2>
          <p className="text-xs text-[#4A5568] leading-relaxed mb-4">
            You have successfully joined <strong>{invite.company_name}</strong> on TerraTern. Redirecting you to your Employer Dashboard...
          </p>
          <div className="flex justify-center">
            <Loader2 className="w-5 h-5 text-[#1B3270] animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFD] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#1B3270] text-white shadow-md mb-3">
          <Building2 size={24} />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#0F172A]">
          Join {invite.company_name}
        </h2>
        <p className="mt-1 text-xs text-[#4A5568]">
          You've been invited to collaborate on TerraTern as an employer team member.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-md border border-[#E2E8F4] rounded-[12px] sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-[6px] text-xs text-[#EF4444] font-medium flex items-start space-x-2">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Read-only Email */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="email"
                  readOnly
                  disabled
                  value={invite.email || ''}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAFD] border border-[#E2E8F4] rounded-[6px] text-[#4A5568] cursor-not-allowed font-medium"
                />
              </div>
            </div>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  First Name <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Password <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                Confirm Password <span className="text-[#EF4444]">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-xs flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Set Up My Account</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
