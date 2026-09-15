import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { AuthLayout } from '../components/layout/AuthLayout';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

interface PartnerInviteDetails {
  valid: boolean;
  invite_type?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  company_name?: string;
  entity_id?: string;
}

export const EmployerInvite: React.FC = () => {
  const { token: paramToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const token = paramToken || searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<PartnerInviteDetails | null>(null);
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
        setInvalidMessage('This invite link is invalid or has expired. Contact your TerraTern representative.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_partner_invite_details', {
          p_token: token,
        });

        if (error) {
          console.error('Error fetching partner invite details:', error);
          // Fallback direct check against pending_invites
          const { data: directInvite, error: directErr } = await supabase
            .from('pending_invites')
            .select('*')
            .eq('token', token)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .maybeSingle();

          if (directErr || !directInvite) {
            setInvalidMessage('This invite link is invalid or has expired. Contact your TerraTern representative.');
            return;
          }

          let compName = 'Authorized Healthcare Employer';
          if (directInvite.entity_id) {
            const { data: emp } = await supabase.from('employers').select('company_name').eq('id', directInvite.entity_id).maybeSingle();
            if (emp?.company_name) compName = emp.company_name;
          }

          setInvite({
            valid: true,
            invite_type: directInvite.invite_type || 'employer',
            first_name: directInvite.first_name,
            last_name: directInvite.last_name,
            email: directInvite.email,
            company_name: compName,
            entity_id: directInvite.entity_id,
          });
          setFirstName(directInvite.first_name || '');
          setLastName(directInvite.last_name || '');
          return;
        }

        const details = data as unknown as PartnerInviteDetails;
        if (!details || !details.valid || details.invite_type !== 'employer') {
          setInvalidMessage('This invite link is invalid or has expired. Contact your TerraTern representative.');
        } else {
          setInvite(details);
          setFirstName(details.first_name || '');
          setLastName(details.last_name || '');
        }
      } catch (err: any) {
        console.error('Employer invite verification error:', err);
        setInvalidMessage('This invite link is invalid or has expired. Contact your TerraTern representative.');
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
      setFormError('Missing invitation information.');
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

      // 1. Sign up external employer auth user
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
        // If user already registered, attempt login
        if (authError.message.toLowerCase().includes('already registered')) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: invite.email,
            password,
          });

          if (signInError) {
            setFormError('An account with this email already exists. Enter your existing password to link this company, or sign in.');
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
        setFormError('Could not finalize credentials. Try again.');
        setSubmitting(false);
        return;
      }

      // 2. Claim partner invite via RPC
      const { data: claimData, error: claimError } = await supabase.rpc('claim_partner_invite', {
        p_token: token,
        p_user_id: userId,
      });

      if (claimError) {
        console.warn('RPC claim error, falling back to direct table update:', claimError);
      }

      const claimResult = claimData as any;
      if (claimResult && claimResult.success === false) {
        console.warn('RPC returned false, executing direct update fallback:', claimResult.error);
      }

      // 3. Resolve employer ID
      let employerId = invite.entity_id;
      if (!employerId && invite.company_name) {
        const { data: foundEmp } = await supabase
          .from('employers')
          .select('id')
          .ilike('company_name', invite.company_name)
          .maybeSingle();
        if (foundEmp?.id) employerId = foundEmp.id;
      }

      // 4. Update employers table with user_id and is_admin_profile_id
      if (employerId) {
        await supabase
          .from('employers')
          .update({
            user_id: userId,
            is_admin_profile_id: userId,
            primary_contact_name: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
            contact_person: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
          })
          .eq('id', employerId);
      } else if (invite.company_name) {
        await supabase
          .from('employers')
          .update({
            user_id: userId,
            is_admin_profile_id: userId,
            primary_contact_name: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
            contact_person: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
          })
          .ilike('company_name', invite.company_name);
      }

      // 5. Look up created_by from pending_invites
      const { data: pendingInvite } = await supabase
        .from('pending_invites')
        .select('created_by')
        .eq('token', token)
        .maybeSingle();
      const createdBy = pendingInvite?.created_by || null;

      // 6. Insert employer_team_members row for the admin
      if (employerId) {
        await supabase.from('employer_team_members').upsert(
          {
            employer_id: employerId,
            profile_id: userId,
            invited_by: createdBy,
            email: invite.email,
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            role: 'admin',
            invite_status: 'accepted',
          },
          { onConflict: 'employer_id, email' }
        );
      }

      // 7. Explicit update to pending_invites (used = true, used_at = now())
      await supabase
        .from('pending_invites')
        .update({
          used: true,
          used_at: new Date().toISOString(),
        })
        .eq('token', token);

      // 8. Insert/Upsert into profiles
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: invite.email,
        role: 'employer',
        is_internal: false,
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.warn('Profile upsert warning:', profileError);
      }

      // 9. Dispatch notification for all Placement Leads
      const { data: leads } = await supabase
        .from('profiles')
        .select('id')
        .eq('internal_role', 'placement_lead');

      if (leads && leads.length > 0) {
        const compName = invite.company_name || 'An employer';
        const notifications = leads.map((l) => ({
          user_id: l.id,
          title: 'New Employer Account Created',
          message: `${compName} has created an employer account. Assign an account manager.`,
          type: 'general',
          read: false,
          sent_by: userId,
        }));
        await supabase.from('notifications').insert(notifications);
      }

      // 10. Refresh auth session state
      await refreshProfile();

      setSuccess(true);
      setTimeout(() => {
        navigate('/employer');
      }, 1500);
    } catch (err: any) {
      console.error('Error during employer onboarding submission:', err);
      setFormError(err.message || 'An unexpected error occurred during account setup.');
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Accept invitation"
      subtitle={invite?.company_name ? `Join ${invite.company_name} on TerraTern` : 'Complete your healthcare employer setup'}
      bottomLinks={
        <div>
          Already configured?{' '}
          <button
            type="button"
            onClick={() => navigate('/login?role=employer')}
            className="text-[#2952A3] font-medium hover:underline cursor-pointer"
          >
            Sign in
          </button>
        </div>
      }
    >
      {loading ? (
        <div className="py-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#1B3270] animate-spin mx-auto" />
          <p className="text-[12px] text-[#94A3B8] font-medium">
            Validating employer invitation...
          </p>
        </div>
      ) : invalidMessage ? (
        <div className="text-center py-6 space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-[14px] font-bold text-[#1B3270]">
              Invalid or Expired Link
            </h3>
            <p className="text-[12px] text-[#4A5568] leading-relaxed">
              {invalidMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="h-[40px] px-5 bg-[#1B3270] text-white text-[13px] font-semibold rounded-[8px] hover:bg-[#2952A3] transition-colors cursor-pointer"
          >
            Go to Sign In
          </button>
        </div>
      ) : success ? (
        <div className="text-center py-8 space-y-3">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-[15px] font-bold text-[#1B3270]">
            Welcome to TerraTern
          </h3>
          <p className="text-[12px] text-[#4A5568]">
            Your employer account has been configured. Redirecting to your employer dashboard...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {invite?.company_name && (
            <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3 text-center mb-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#94A3B8] block">
                Healthcare Facility
              </span>
              <span className="text-[14px] font-bold text-[#1B3270]">
                {invite.company_name}
              </span>
            </div>
          )}

          {formError && (
            <div className="p-2.5 bg-[#FEF2F2] border border-[#EF4444]/20 rounded-[8px] text-[12px] text-[#EF4444]">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
                First Name
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Maria"
                className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Santos"
                className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
              Email Address
            </label>
            <input
              type="email"
              readOnly
              disabled
              value={invite?.email || ''}
              className="w-full h-[44px] px-3.5 text-[14px] bg-[#F8FAFD] border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#4A5568] cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
              Create Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#1B3270] mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full h-[44px] px-3.5 text-[14px] bg-white border-[1.5px] border-[#E2E8F4] rounded-[8px] text-[#1B3270] placeholder-[#94A3B8] outline-none transition-all duration-150 focus:border-[#1B3270] focus:ring-3 focus:ring-[#1B3270]/10"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-[44px] bg-[#1B3270] hover:bg-[#2952A3] text-white text-[14px] font-semibold rounded-[8px] transition-colors duration-150 shadow-xs flex items-center justify-center disabled:opacity-60 cursor-pointer mt-5"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>
      )}
    </AuthLayout>
  );
};

export default EmployerInvite;
