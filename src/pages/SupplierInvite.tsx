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

export const SupplierInvite: React.FC = () => {
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
        // Direct query or RPC verification
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

          let compName = 'Authorized Supplier';
          if (directInvite.entity_id) {
            const { data: sup } = await supabase.from('suppliers').select('company_name').eq('id', directInvite.entity_id).maybeSingle();
            if (sup?.company_name) compName = sup.company_name;
          }

          setInvite({
            valid: true,
            invite_type: directInvite.invite_type || 'supplier',
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
        if (!details || !details.valid || details.invite_type !== 'supplier') {
          setInvalidMessage('This invite link is invalid or has expired. Contact your TerraTern representative.');
        } else {
          setInvite(details);
          setFirstName(details.first_name || '');
          setLastName(details.last_name || '');
        }
      } catch (err: any) {
        console.error('Invite verification error:', err);
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

      // 1. Sign up external supplier auth user
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

      // 3. Resolve supplier ID
      let supplierId = invite.entity_id;
      if (!supplierId && invite.company_name) {
        const { data: foundSup } = await supabase
          .from('suppliers')
          .select('id')
          .ilike('company_name', invite.company_name)
          .maybeSingle();
        if (foundSup?.id) supplierId = foundSup.id;
      }

      // 4. Update suppliers table with user_id and is_admin_profile_id
      if (supplierId) {
        await supabase
          .from('suppliers')
          .update({
            user_id: userId,
            is_admin_profile_id: userId,
            primary_contact_name: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
            contact_person: `${firstName.trim()} ${lastName.trim()}`.trim() || undefined,
          })
          .eq('id', supplierId);
      }

      // 5. Insert/Upsert into profiles
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: invite.email,
        role: 'supplier',
        is_internal: false,
        updated_at: new Date().toISOString(),
      });

      if (profileError) {
        console.warn('Profile upsert warning:', profileError);
      }

      // 6. Finalize supplier onboarding (team member, 5 documents, lead notifications, checklist)
      if (supplierId) {
        const { error: rpcErr } = await supabase.rpc('finalize_supplier_onboarding', {
          p_supplier_id: supplierId,
          p_profile_id: userId,
          p_email: invite.email,
          p_first_name: firstName.trim(),
          p_last_name: lastName.trim(),
          p_token: token,
        });

        if (rpcErr) {
          console.warn('RPC finalize_supplier_onboarding error, running direct client fallback:', rpcErr);

          // Direct fallback 1: Insert admin into supplier_team_members
          await supabase.from('supplier_team_members').upsert(
            {
              supplier_id: supplierId,
              profile_id: userId,
              email: invite.email,
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              role: 'admin',
              invite_status: 'accepted',
            },
            { onConflict: 'supplier_id, email' }
          );

          // Direct fallback 2: Initialize 5 compliance documents
          const docTypes = [
            { type: 'business_registration_certificate', label: 'Business Registration Certificate' },
            { type: 'recruitment_license', label: 'Recruitment License / Permit' },
            { type: 'ral_compliance_declaration', label: 'RAL Faire Anwerbung Pflege — Compliance Declaration' },
            { type: 'gdpr_data_protection_policy', label: 'GDPR Data Protection Policy' },
            { type: 'ethical_recruitment_policy', label: 'Ethical Recruitment Policy' },
          ];

          for (const dt of docTypes) {
            await supabase.from('supplier_documents').upsert(
              {
                supplier_id: supplierId,
                document_type: dt.type,
                document_label: dt.label,
                is_mandatory: true,
                status: 'not_uploaded',
              },
              { onConflict: 'supplier_id, document_type' }
            );
          }

          // Direct fallback 3: Placement Lead notification
          const { data: leads } = await supabase
            .from('profiles')
            .select('id')
            .eq('internal_role', 'placement_lead');

          if (leads && leads.length > 0) {
            const notifications = leads.map((l) => ({
              user_id: l.id,
              title: 'New Supplier Account Created',
              message: `${invite.company_name || 'New Supplier'} has created a supplier account. Assign an account manager.`,
              type: 'general',
              read: false,
              sent_by: userId,
            }));
            await supabase.from('notifications').insert(notifications);
          }
        }
      }

      // 7. Explicit update to pending_invites (used = true, used_at = now())
      await supabase
        .from('pending_invites')
        .update({
          used: true,
          used_at: new Date().toISOString(),
        })
        .eq('token', token);

      // 8. Refresh auth session state
      await refreshProfile();

      setSuccess(true);
      setTimeout(() => {
        navigate('/supplier');
      }, 1500);
    } catch (err: any) {
      console.error('Error during onboarding submission:', err);
      setFormError(err.message || 'An unexpected error occurred during account setup.');
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Accept invitation"
      subtitle={invite?.company_name ? `Join ${invite.company_name} on TerraTern` : 'Complete your supplier partner setup'}
      bottomLinks={
        <div>
          Already configured?{' '}
          <button
            type="button"
            onClick={() => navigate('/login?role=supplier')}
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
            Validating partner invitation...
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
            Your partner account has been configured. Redirecting to your supplier dashboard...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {invite?.company_name && (
            <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3 text-center mb-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[#94A3B8] block">
                Partner Organization
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

export default SupplierInvite;
