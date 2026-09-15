import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { Lock, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  partnerships_lead: 'Partnerships Lead',
  supplier_partnerships_associate: 'Supplier Partnerships Associate',
  employer_partnerships_associate: 'Employer Partnerships Associate',
  placement_lead: 'Placement Lead',
  candidate_supplier_rm: 'Candidate & Supplier RM',
  employer_requirements_rm: 'Employer Requirements RM',
  academic_lead: 'Academic Lead',
  mentor: 'Clinical & Language Mentor',
};

export const AcceptInvite: React.FC = () => {
  const { token: paramToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const token = paramToken || searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<any>(null);
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInvite = async () => {
      if (!token) {
        setInvalidMessage('This invite link is invalid or has expired. Contact your team lead.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('pending_invites')
          .select('*')
          .eq('token', token)
          .eq('used', false)
          .gt('expires_at', new Date().toISOString())
          .maybeSingle();

        if (error || !data) {
          setInvalidMessage('This invite link is invalid or has expired. Contact your team lead.');
        } else {
          setInvite(data);
        }
      } catch (err) {
        setInvalidMessage('This invite link is invalid or has expired. Contact your team lead.');
      } finally {
        setLoading(false);
      }
    };

    fetchInvite();
  }, [token]);

  const getInternalRoute = (internalRole?: string | null): string => {
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

  const handleSetUpAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

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

      // 1. Sign up user with invite email & password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            first_name: invite.first_name,
            last_name: invite.last_name,
            role: 'internal',
            is_internal: true,
            internal_role: invite.internal_role,
          },
        },
      });

      if (authError || !authData.user) {
        setFormError(authError?.message || 'Failed to create user credentials.');
        setSubmitting(false);
        return;
      }

      const newUserId = authData.user.id;

      // 2. Insert / upsert into profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: newUserId,
          first_name: invite.first_name,
          last_name: invite.last_name,
          email: invite.email,
          role: 'internal',
          is_internal: true,
          internal_role: invite.internal_role,
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error('Error creating internal profile record:', profileError);
        // Continue if profile trigger already created it
      }

      // 3. Mark invite as used
      await supabase
        .from('pending_invites')
        .update({ used: true })
        .eq('token', token);

      // 4. Refresh AuthContext
      await refreshProfile();

      // 5. Route to correct dashboard
      const destination = getInternalRoute(invite.internal_role);
      navigate(destination, { replace: true });
    } catch (err: any) {
      console.error('Unexpected error accepting invite:', err);
      setFormError(err.message || 'An unexpected error occurred while setting up account.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#1B3270]" />
          <p className="text-xs font-medium text-[#94A3B8]">Validating staff invitation token...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired message
  if (invalidMessage || !invite) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-[#E2E8F4] rounded-[10px] p-8 text-center shadow-[0_1px_4px_rgba(27,50,112,0.08)]">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[#1B3270] mb-2">Invitation Expired or Invalid</h2>
          <p className="text-sm text-[#64748B] leading-relaxed mb-6">
            {invalidMessage || 'This invite link is invalid or has expired. Contact your team lead.'}
          </p>
          <a
            href="/internal/login"
            className="inline-flex items-center space-x-2 text-xs font-semibold text-[#2952A3] hover:underline"
          >
            <span>Go to Staff Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  const roleTitle = ROLE_LABELS[invite.internal_role] || invite.internal_role;

  return (
    <div className="min-h-screen bg-[#F8FAFD] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-[460px] bg-white border border-[#E2E8F4] rounded-[10px] shadow-[0_1px_4px_rgba(27,50,112,0.08)] p-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <img
            src="/images/terratern-logo-horizontal.png?v=2"
            alt="TerraTern Logo"
            className="h-10 sm:h-11 w-auto object-contain mx-auto mb-2"
          />
          <h2 className="text-lg font-bold text-[#1B3270]">Accept Team Invitation</h2>
          <p className="text-xs text-[#64748B] mt-1">
            Complete your password setup to access institutional workspaces
          </p>
        </div>

        {/* Pre-filled Staff Profile Information */}
        <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4 mb-5 text-left">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E2E8F4]">
            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase">Designated Role</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#1B3270] text-white">
              {roleTitle}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-[#94A3B8] block text-[10px] uppercase">First Name</span>
              <span className="font-semibold text-[#1B3270]">{invite.first_name}</span>
            </div>
            <div>
              <span className="text-[#94A3B8] block text-[10px] uppercase">Last Name</span>
              <span className="font-semibold text-[#1B3270]">{invite.last_name}</span>
            </div>
            <div className="col-span-2">
              <span className="text-[#94A3B8] block text-[10px] uppercase">Authorized Email</span>
              <span className="font-mono text-xs text-[#1B3270]">{invite.email}</span>
            </div>
          </div>
        </div>

        {/* Form Error Alert */}
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-[6px] text-xs text-red-700 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{formError}</span>
          </div>
        )}

        {/* Password Setup Form */}
        <form onSubmit={handleSetUpAccount} className="space-y-4 text-left">
          <div>
            <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
              Create Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E2E8F4] rounded-[6px] text-sm text-[#1B3270] placeholder-[#94A3B8] focus:outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
              />
              <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#1B3270] uppercase tracking-wider mb-1.5">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full pl-10 pr-3.5 py-2.5 bg-white border border-[#E2E8F4] rounded-[6px] text-sm text-[#1B3270] placeholder-[#94A3B8] focus:outline-none focus:border-[#2952A3] focus:ring-1 focus:ring-[#2952A3]"
              />
              <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-3 pointer-events-none" />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-sm font-semibold rounded-[6px] transition-all shadow-[0_2px_8px_rgba(27,50,112,0.15)] flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer active:scale-[0.99] mt-3"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Configuring Profile...</span>
              </>
            ) : (
              <span>Set Up My Account</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
