import React, { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Briefcase,
  PlusCircle,
  Copy,
  Check,
  Clock,
  AlertCircle,
  Loader2,
  Mail,
  MapPin,
} from 'lucide-react';

export const OnboardEmployerTab: React.FC = () => {
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('Hospital & Healthcare');
  const [location, setLocation] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState('standard');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Success Link Panel
  const [createdInvite, setCreatedInvite] = useState<{
    companyName: string;
    contactName: string;
    link: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleOnboardEmployer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreatedInvite(null);

    const cleanCompany = companyName.trim();
    const cleanLocation = location.trim();
    const cleanFirst = contactFirstName.trim();
    const cleanLast = contactLastName.trim();
    const cleanEmail = contactEmail.trim().toLowerCase();

    if (!cleanCompany || !cleanLocation || !cleanFirst || !cleanLast || !cleanEmail) {
      setFormError('Fill out all required fields.');
      return;
    }

    if (!user) {
      setFormError('User session expired.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert into employers table
      const { data: newEmp, error: empError } = await supabase
        .from('employers')
        .insert({
          company_name: cleanCompany,
          industry: industry.trim() || null,
          location: cleanLocation,
          subscription_tier: subscriptionTier,
          created_by_internal: user.id,
          user_id: null,
        } as any)
        .select('id')
        .single();

      if (empError) throw empError;

      // 2. Insert into pending_invites table
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: inviteError } = await supabase.from('pending_invites').insert({
        first_name: cleanFirst,
        last_name: cleanLast,
        email: cleanEmail,
        invite_type: 'employer',
        entity_id: newEmp.id,
        internal_role: null,
        created_by: user.id,
        token,
        expires_at: expiresAt,
        used: false,
      });

      if (inviteError) throw inviteError;

      const fullUrl = `${window.location.origin}/employer-invite?token=${token}`;

      setCreatedInvite({
        companyName: cleanCompany,
        contactName: `${cleanFirst} ${cleanLast}`,
        link: fullUrl,
      });

      // Reset form
      setCompanyName('');
      setLocation('');
      setContactFirstName('');
      setContactLastName('');
      setContactEmail('');
    } catch (err: any) {
      setFormError(err.message || 'Failed to onboard employer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = (linkToCopy: string) => {
    navigator.clipboard.writeText(linkToCopy);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1B3270]">Onboard New Healthcare Employer</h1>
        <p className="text-sm text-slate-500 mt-1">
          Register an accredited German hospital network or care facility and generate their invitation link.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-5">
        <div className="flex items-center space-x-2 pb-3 border-b border-[#E2E8F4]">
          <Briefcase className="w-5 h-5 text-[#1B3270]" />
          <h2 className="text-base font-bold text-slate-800">
            Hospital Facility Details
          </h2>
        </div>

        {formError && (
          <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleOnboardEmployer} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Facility / Hospital Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Klinikum Frankfurt Höchst"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Location (City / State) *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Frankfurt am Main, Hessen"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Industry / Healthcare Domain
              </label>
              <input
                type="text"
                placeholder="e.g. University Hospital / Inpatient Care"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Subscription Tier *
              </label>
              <select
                value={subscriptionTier}
                onChange={(e) => setSubscriptionTier(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-800"
              >
                <option value="basic">Basic (Standard Sourcing)</option>
                <option value="standard">Standard (Dedicated Pipeline)</option>
                <option value="enterprise">Enterprise (Exclusive Hospital Cohorts)</option>
              </select>
            </div>
          </div>

          {/* Contact Details */}
          <div className="pt-3 border-t border-[#E2E8F4]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center space-x-1.5">
              <Mail className="w-4 h-4 text-[#2952A3]" />
              <span>Facility HR / Head of Nursing Contact</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="First name"
                  value={contactFirstName}
                  onChange={(e) => setContactFirstName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Last name"
                  value={contactLastName}
                  onChange={(e) => setContactLastName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Corporate Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="contact@organization.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#E2E8F4]">
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-5 bg-[#1B3270] hover:bg-[#2952A3] text-white font-semibold text-xs rounded-[6px] transition-colors shadow-2xs cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Onboarding Facility...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Create Account & Send Invite</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Invite Link Result Panel */}
        {createdInvite && (
          <div className="mt-4 p-4 rounded-[8px] bg-[#F0F4FF] border border-[#2952A3]/20 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#1B3270] flex items-center space-x-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>
                  Employer registered: {createdInvite.companyName} ({createdInvite.contactName})
                </span>
              </span>
              <span className="text-[11px] text-slate-500 flex items-center space-x-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Expires in 7 days</span>
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="text"
                readOnly
                value={createdInvite.link}
                className="flex-1 px-3 py-1.5 bg-white border border-[#E2E8F4] rounded-[6px] font-mono text-xs text-slate-700 select-all outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopyLink(createdInvite.link)}
                className="px-3 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Share this link with the employer contact. They will set up their account password and post staffing requirements.
            </p>

            <div className="p-3 bg-white border border-[#2952A3]/20 rounded-[6px] text-xs text-slate-600">
              <p className="font-semibold text-[#1B3270] mb-0.5">Next Steps & RM Allocation:</p>
              <p className="text-[11px] text-slate-500">
                After the employer creates their account, the Placement Team will be notified to assign an account manager.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
