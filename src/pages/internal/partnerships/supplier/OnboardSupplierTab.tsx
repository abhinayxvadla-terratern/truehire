import React, { useState } from 'react';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../context/AuthContext';
import {
  Building2,
  PlusCircle,
  Copy,
  Check,
  Clock,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Mail,
} from 'lucide-react';

export const OnboardSupplierTab: React.FC = () => {
  const { user } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState('Placement Agency');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [contactFirstName, setContactFirstName] = useState('');
  const [contactLastName, setContactLastName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [complianceDeclared, setComplianceDeclared] = useState(false);
  const [noFeePolicyConfirmed, setNoFeePolicyConfirmed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Success Link Panel
  const [createdInvite, setCreatedInvite] = useState<{
    companyName: string;
    contactName: string;
    link: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleOnboardSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setCreatedInvite(null);

    const cleanCompany = companyName.trim();
    const cleanFirst = contactFirstName.trim();
    const cleanLast = contactLastName.trim();
    const cleanEmail = contactEmail.trim().toLowerCase();

    if (!cleanCompany || !cleanFirst || !cleanLast || !cleanEmail) {
      setFormError('Complete all required fields.');
      return;
    }

    if (!user) {
      setFormError('Authentication session missing.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert into suppliers table
      const { data: newSupplier, error: supError } = await supabase
        .from('suppliers')
        .insert({
          company_name: cleanCompany,
          company_type: companyType,
          registration_number: registrationNumber.trim() || null,
          tier: 'basic',
          compliance_declared: complianceDeclared,
          no_fee_policy_confirmed: noFeePolicyConfirmed,
          created_by_internal: user.id,
          user_id: null,
        } as any)
        .select('id')
        .single();

      if (supError) throw supError;

      // 2. Insert into pending_invites table
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: inviteError } = await supabase.from('pending_invites').insert({
        first_name: cleanFirst,
        last_name: cleanLast,
        email: cleanEmail,
        invite_type: 'supplier',
        entity_id: newSupplier.id,
        internal_role: null,
        created_by: user.id,
        token,
        expires_at: expiresAt,
        used: false,
      });

      if (inviteError) throw inviteError;

      const fullUrl = `${window.location.origin}/supplier-invite?token=${token}`;

      setCreatedInvite({
        companyName: cleanCompany,
        contactName: `${cleanFirst} ${cleanLast}`,
        link: fullUrl,
      });

      // Reset form
      setCompanyName('');
      setRegistrationNumber('');
      setContactFirstName('');
      setContactLastName('');
      setContactEmail('');
      setComplianceDeclared(false);
      setNoFeePolicyConfirmed(false);
    } catch (err: any) {
      setFormError(err.message || 'Failed to onboard supplier.');
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
        <h1 className="text-2xl font-bold text-[#1B3270]">Onboard New Supplier</h1>
        <p className="text-sm text-slate-500 mt-1">
          Register a regional talent sourcing partner and issue their account setup invitation link.
        </p>
      </div>

      {/* Form Card */}
      <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-2xs space-y-5">
        <div className="flex items-center space-x-2 pb-3 border-b border-[#E2E8F4]">
          <Building2 className="w-5 h-5 text-[#1B3270]" />
          <h2 className="text-base font-bold text-slate-800">
            Supplier Organization Details
          </h2>
        </div>

        {formError && (
          <div className="p-3 rounded-[6px] bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleOnboardSupplier} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Company Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Apex Global Healthcare Sourcing"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Company Type *
              </label>
              <select
                value={companyType}
                onChange={(e) => setCompanyType(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none bg-white text-slate-800"
              >
                <option value="Placement Agency">Placement Agency</option>
                <option value="Language School">Language School</option>
                <option value="Training Center">Training Center</option>
                <option value="University / Academy">University / Academy</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Registration / License Number (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. REG-DE-2026-88"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="pt-3 border-t border-[#E2E8F4]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3 flex items-center space-x-1.5">
              <Mail className="w-4 h-4 text-[#2952A3]" />
              <span>Primary Contact Person</span>
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
                  Work Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="contact@agency.com"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] focus:ring-1 focus:ring-[#1B3270] outline-none"
                />
              </div>
            </div>
          </div>

          {/* Compliance Toggles */}
          <div className="pt-3 border-t border-[#E2E8F4] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Initial Compliance Verification</span>
            </h3>

            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={complianceDeclared}
                onChange={(e) => setComplianceDeclared(e.target.checked)}
                className="mt-0.5 rounded text-[#1B3270] focus:ring-0"
              />
              <div>
                <p className="font-semibold text-slate-800">Compliance Declared</p>
                <p className="text-[11px] text-slate-400">
                  Check if candidate background checking protocols and regional licensing have been pre-verified.
                </p>
              </div>
            </label>

            <label className="flex items-start space-x-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={noFeePolicyConfirmed}
                onChange={(e) => setNoFeePolicyConfirmed(e.target.checked)}
                className="mt-0.5 rounded text-[#1B3270] focus:ring-0"
              />
              <div>
                <p className="font-semibold text-slate-800">No-Fee Policy Confirmed</p>
                <p className="text-[11px] text-slate-400">
                  Check if partner has verified adherence to the WHO ethical recruitment charter prohibiting candidate placement fees.
                </p>
              </div>
            </label>
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
                  <span>Onboarding Supplier...</span>
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
                  Supplier registered: {createdInvite.companyName} ({createdInvite.contactName})
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
              Share this link with the supplier contact. They will create their account and access the supplier dashboard.
            </p>

            <div className="p-3 bg-white border border-[#2952A3]/20 rounded-[6px] text-xs text-slate-600">
              <p className="font-semibold text-[#1B3270] mb-0.5">Next Steps & RM Allocation:</p>
              <p className="text-[11px] text-slate-500">
                After the supplier creates their account, the Placement Team will be notified to assign an account manager. The supplier will be notified once an account manager is assigned.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
