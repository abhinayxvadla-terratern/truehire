import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  ShieldCheck,
  UserPlus,
  Copy,
  Check,
  Camera,
  Loader2,
  ChevronDown,
  X,
  Search,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface SupplierProfileTabProps {
  supplier: any;
  currentUserRole?: 'admin' | 'member';
  onRefresh: () => void;
}

type ProfileSection = 'identity' | 'contact' | 'specialisation' | 'compliance' | 'team';

const COMMON_COUNTRIES = [
  'India',
  'Philippines',
  'Vietnam',
  'Nepal',
  'Nigeria',
  'Kenya',
  'Indonesia',
  'Colombia',
  'Tunisia',
  'Egypt',
  'Morocco',
  'Ghana',
  'Brazil',
  'Germany',
  'Austria',
  'Switzerland',
  'United Kingdom',
  'United States',
  'Canada',
  'United Arab Emirates',
  'Saudi Arabia',
];

const HEALTHCARE_ROLES = [
  { id: 'Nursing (General)', label: 'Nursing (General)' },
  { id: 'Nursing (Specialised)', label: 'Nursing (Specialised)' },
  { id: 'Care Work', label: 'Care Work' },
  { id: 'Ausbildung', label: 'Ausbildung (Nursing Apprentice)' },
  { id: 'Allied Health', label: 'Allied Health' },
  { id: 'Other', label: 'Other Healthcare Roles' },
];

const COMPLIANCE_DOC_TEMPLATES = [
  {
    type: 'business_registration_certificate',
    label: 'Business Registration Certificate',
    notes: 'Official commercial registry excerpt or certificate of incorporation.',
  },
  {
    type: 'recruitment_license',
    label: 'Recruitment License / Permit',
    notes: 'National or state overseas recruitment / staffing license.',
  },
  {
    type: 'ral_compliance_declaration',
    label: 'RAL Faire Anwerbung Pflege — Compliance Declaration',
    notes: 'Signed declaration of compliance with German ethical recruitment standards.',
  },
  {
    type: 'gdpr_data_protection_policy',
    label: 'GDPR Data Protection Policy',
    notes: 'Company privacy and data processing policy compliant with EU GDPR.',
  },
  {
    type: 'ethical_recruitment_policy',
    label: 'Ethical Recruitment Policy',
    notes: 'Institutional code of ethics covering employer-pays principles and zero candidate fees.',
  },
];

export const SupplierProfileTab: React.FC<SupplierProfileTabProps> = ({
  supplier,
  currentUserRole = 'admin',
  onRefresh,
}) => {
  const { profile, refreshProfile } = useAuth();
  const [activeSection, setActiveSection] = useState<ProfileSection>('identity');

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // ----------------------------------------------------
  // SECTION 1: IDENTITY STATE
  // ----------------------------------------------------
  const [logoUrl, setLogoUrl] = useState(supplier?.logo_url || '');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [companyName, setCompanyName] = useState(supplier?.company_name || '');
  const [companyType, setCompanyType] = useState(supplier?.company_type || 'placement_agency');
  const [registrationNumber, setRegistrationNumber] = useState(supplier?.registration_number || '');
  const [description, setDescription] = useState(supplier?.description || '');
  const [websiteUrl, setWebsiteUrl] = useState(supplier?.website_url || '');
  const [yearEstablished, setYearEstablished] = useState<string>(
    supplier?.year_established ? String(supplier.year_established) : ''
  );
  const [savingIdentity, setSavingIdentity] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // ----------------------------------------------------
  // SECTION 2: CONTACT STATE
  // ----------------------------------------------------
  const [primaryContactName, setPrimaryContactName] = useState(
    supplier?.primary_contact_name || supplier?.contact_person || ''
  );
  const primaryContactEmail = profile?.email || '';
  const [primaryContactPhone, setPrimaryContactPhone] = useState(
    supplier?.primary_contact_phone || ''
  );
  const [officeAddress, setOfficeAddress] = useState(supplier?.office_address || '');
  const [countryOfOperation, setCountryOfOperation] = useState(
    supplier?.country_of_operation || 'India'
  );
  const [savingContact, setSavingContact] = useState(false);

  // ----------------------------------------------------
  // SECTION 3: SPECIALISATION STATE
  // ----------------------------------------------------
  const [rolesFocus, setRolesFocus] = useState<string[]>(
    Array.isArray(supplier?.healthcare_roles_focus) ? supplier.healthcare_roles_focus : []
  );
  const [sourceCountries, setSourceCountries] = useState<string[]>(
    Array.isArray(supplier?.source_countries) ? supplier.source_countries : []
  );
  const [countrySearch, setCountrySearch] = useState('');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [savingSpecialisation, setSavingSpecialisation] = useState(false);

  // ----------------------------------------------------
  // SECTION 4: COMPLIANCE STATE
  // ----------------------------------------------------
  const [complianceDeclared, setComplianceDeclared] = useState(!!supplier?.compliance_declared);
  const [noFeeConfirmed, setNoFeeConfirmed] = useState(!!supplier?.no_fee_policy_confirmed);
  const [complianceDeclaredAt, setComplianceDeclaredAt] = useState<string | null>(
    supplier?.compliance_declared_at || null
  );
  const [noFeeConfirmedAt, setNoFeeConfirmedAt] = useState<string | null>(
    supplier?.no_fee_policy_confirmed_at || null
  );
  const [complianceDocs, setComplianceDocs] = useState<any[]>([]);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [assignedRm, setAssignedRm] = useState<any>(null);

  // ----------------------------------------------------
  // SECTION 5: TEAM MEMBERS STATE
  // ----------------------------------------------------
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    type: 'promote' | 'remove';
    member: any;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ----------------------------------------------------
  // PROFILE COMPLETENESS CALCULATION
  // ----------------------------------------------------
  const mandatoryFields = [
    !!companyName.trim(),
    !!companyType.trim(),
    !!primaryContactName.trim(),
    !!countryOfOperation.trim(),
    rolesFocus.length > 0,
    complianceDeclared,
    noFeeConfirmed,
  ];
  const filledCount = mandatoryFields.filter(Boolean).length;
  const completenessPct = Math.round((filledCount / mandatoryFields.length) * 100);

  // ----------------------------------------------------
  // INITIALIZATION & FETCHERS
  // ----------------------------------------------------
  useEffect(() => {
    if (supplier?.id) {
      fetchComplianceDocs();
      fetchAssignedRm();
      fetchTeamMembers();
    }
  }, [supplier?.id]);

  const fetchComplianceDocs = async () => {
    if (!supplier?.id) return;
    try {
      const { data, error } = await supabase
        .from('supplier_documents')
        .select('*')
        .eq('supplier_id', supplier.id);

      if (error) throw error;

      // If empty, initialize the 5 default templates in DB
      if (!data || data.length === 0) {
        const rowsToInsert = COMPLIANCE_DOC_TEMPLATES.map((t) => ({
          supplier_id: supplier.id,
          document_type: t.type,
          document_label: t.label,
          is_mandatory: true,
          status: 'not_uploaded',
        }));

        const { data: inserted, error: insErr } = await supabase
          .from('supplier_documents')
          .insert(rowsToInsert)
          .select();

        if (!insErr && inserted) {
          setComplianceDocs(inserted);
          return;
        }
      }

      setComplianceDocs(data || []);
    } catch (err) {
      console.error('Error fetching compliance docs:', err);
    }
  };

  const fetchAssignedRm = async () => {
    if (!supplier?.id) return;
    try {
      const { data, error } = await supabase
        .from('rm_assignments')
        .select(`
          id,
          active,
          created_at,
          rm_profile_id,
          profiles:rm_profile_id (
            id,
            first_name,
            last_name,
            email,
            phone
          )
        `)
        .eq('entity_type', 'supplier')
        .eq('entity_id', supplier.id)
        .eq('active', true)
        .maybeSingle();

      if (!error && data) {
        setAssignedRm(data);
      } else {
        setAssignedRm(null);
      }
    } catch (err) {
      console.error('Error fetching assigned RM:', err);
    }
  };

  const fetchTeamMembers = async () => {
    if (!supplier?.id) return;
    try {
      setLoadingTeam(true);
      const { data, error } = await supabase
        .from('supplier_team_members')
        .select('*')
        .eq('supplier_id', supplier.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setTeamMembers(data);
      }
    } catch (err) {
      console.error('Error fetching team members:', err);
    } finally {
      setLoadingTeam(false);
    }
  };

  // ----------------------------------------------------
  // SECTION 1: SAVE IDENTITY
  // ----------------------------------------------------
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !supplier?.id) return;

    if (file.size > 2 * 1024 * 1024) {
      showToast('Logo file size must be under 2MB.', 'error');
      return;
    }

    try {
      setUploadingLogo(true);
      const ext = file.name.split('.').pop() || 'png';
      const filePath = `${supplier.id}/logo.${ext}`;

      // Upload to supplier-assets bucket
      const { error: uploadErr } = await supabase.storage
        .from('supplier-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      // Get public url
      const { data: publicData } = supabase.storage
        .from('supplier-assets')
        .getPublicUrl(filePath);

      const publicUrl = publicData.publicUrl;

      // Update suppliers table
      const { error: updateErr } = await supabase
        .from('suppliers')
        .update({ logo_url: publicUrl })
        .eq('id', supplier.id);

      if (updateErr) throw updateErr;

      setLogoUrl(publicUrl);
      showToast('Company logo updated successfully.');
      onRefresh();
    } catch (err: any) {
      console.error('Logo upload error:', err);
      showToast(err.message || 'Failed to upload company logo.', 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      showToast('Company Name is required.', 'error');
      return;
    }

    if (websiteUrl.trim()) {
      try {
        const urlToCheck = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
        new URL(urlToCheck);
      } catch {
        showToast('Enter a valid website URL.', 'error');
        return;
      }
    }

    try {
      setSavingIdentity(true);
      const { error } = await supabase
        .from('suppliers')
        .update({
          company_name: companyName.trim(),
          company_type: companyType,
          registration_number: registrationNumber.trim() || null,
          description: description.trim() || null,
          website_url: websiteUrl.trim() || null,
          year_established: yearEstablished ? parseInt(yearEstablished, 10) : null,
        })
        .eq('id', supplier.id);

      if (error) throw error;

      showToast('Company identity saved.');
      await refreshProfile();
      onRefresh();
    } catch (err: any) {
      console.error('Save identity error:', err);
      showToast(err.message || 'Failed to save company identity.', 'error');
    } finally {
      setSavingIdentity(false);
    }
  };

  // ----------------------------------------------------
  // SECTION 2: SAVE CONTACT
  // ----------------------------------------------------
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryContactName.trim()) {
      showToast('Primary Contact Name is required.', 'error');
      return;
    }

    try {
      setSavingContact(true);
      const { error } = await supabase
        .from('suppliers')
        .update({
          primary_contact_name: primaryContactName.trim(),
          contact_person: primaryContactName.trim(),
          primary_contact_phone: primaryContactPhone.trim() || null,
          office_address: officeAddress.trim() || null,
          country_of_operation: countryOfOperation.trim() || null,
        })
        .eq('id', supplier.id);

      if (error) throw error;

      showToast('Contact details saved.');
      onRefresh();
    } catch (err: any) {
      console.error('Save contact error:', err);
      showToast(err.message || 'Failed to save contact details.', 'error');
    } finally {
      setSavingContact(false);
    }
  };

  // ----------------------------------------------------
  // SECTION 3: SAVE SPECIALISATION
  // ----------------------------------------------------
  const toggleRoleFocus = (roleId: string) => {
    setRolesFocus((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const toggleSourceCountry = (country: string) => {
    setSourceCountries((prev) =>
      prev.includes(country) ? prev.filter((c) => c !== country) : [...prev, country]
    );
  };

  const handleSaveSpecialisation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rolesFocus.length === 0) {
      showToast('Select at least one Healthcare Role focus.', 'error');
      return;
    }

    try {
      setSavingSpecialisation(true);
      const { error } = await supabase
        .from('suppliers')
        .update({
          healthcare_roles_focus: rolesFocus,
          source_countries: sourceCountries,
        })
        .eq('id', supplier.id);

      if (error) throw error;

      showToast('Specialisation details saved.');
      onRefresh();
    } catch (err: any) {
      console.error('Save specialisation error:', err);
      showToast(err.message || 'Failed to save specialisation.', 'error');
    } finally {
      setSavingSpecialisation(false);
    }
  };

  // ----------------------------------------------------
  // SECTION 4: COMPLIANCE ACTIONS
  // ----------------------------------------------------
  const handleToggleComplianceDeclared = async () => {
    const nextVal = !complianceDeclared;
    const nowIso = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          compliance_declared: nextVal,
          compliance_declared_at: nextVal ? nowIso : null,
        })
        .eq('id', supplier.id);

      if (error) throw error;
      setComplianceDeclared(nextVal);
      setComplianceDeclaredAt(nextVal ? nowIso : null);
      showToast(nextVal ? 'RAL compliance declaration confirmed.' : 'Declaration removed.');
      onRefresh();
    } catch (err: any) {
      console.error('Toggle declaration error:', err);
      showToast(err.message || 'Failed to update declaration.', 'error');
    }
  };

  const handleToggleNoFeeConfirmed = async () => {
    const nextVal = !noFeeConfirmed;
    const nowIso = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('suppliers')
        .update({
          no_fee_policy_confirmed: nextVal,
          no_fee_policy_confirmed_at: nextVal ? nowIso : null,
        })
        .eq('id', supplier.id);

      if (error) throw error;
      setNoFeeConfirmed(nextVal);
      setNoFeeConfirmedAt(nextVal ? nowIso : null);
      showToast(nextVal ? 'No-fee candidate policy confirmed.' : 'Policy confirmation removed.');
      onRefresh();
    } catch (err: any) {
      console.error('Toggle no-fee error:', err);
      showToast(err.message || 'Failed to update policy.', 'error');
    }
  };

  const handleUploadDocument = async (docType: string, file: File) => {
    if (!supplier?.id) return;
    try {
      setUploadingDocType(docType);
      const ext = file.name.split('.').pop() || 'pdf';
      const filePath = `${supplier.id}/compliance/${docType}.${ext}`;

      // Upload to supplier-documents storage bucket
      const { error: uploadErr } = await supabase.storage
        .from('supplier-documents')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      // Update supplier_documents row
      const { error: updateErr } = await supabase
        .from('supplier_documents')
        .upsert(
          {
            supplier_id: supplier.id,
            document_type: docType,
            document_label:
              COMPLIANCE_DOC_TEMPLATES.find((t) => t.type === docType)?.label || docType,
            file_url: filePath,
            status: 'pending',
            uploaded_at: new Date().toISOString(),
            is_mandatory: true,
            rejection_reason: null,
          },
          { onConflict: 'supplier_id, document_type' }
        );

      if (updateErr) throw updateErr;

      showToast('Document uploaded successfully. TerraTern review pending.');
      await fetchComplianceDocs();
      onRefresh();
    } catch (err: any) {
      console.error('Document upload error:', err);
      showToast(err.message || 'Failed to upload document.', 'error');
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleViewDoc = async (fileUrl: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('supplier-documents')
        .createSignedUrl(fileUrl, 300);

      if (error || !data?.signedUrl) {
        showToast('Could not generate document preview link.', 'error');
        return;
      }
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      console.error('Error viewing doc:', err);
      showToast('Failed to open document preview.', 'error');
    }
  };

  // ----------------------------------------------------
  // SECTION 5: TEAM MEMBER ACTIONS
  // ----------------------------------------------------
  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteFirstName.trim() || !inviteEmail.trim()) {
      showToast('First name and email are required.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      showToast('Enter a valid email address.', 'error');
      return;
    }

    try {
      setInviting(true);
      setGeneratedInviteLink(null);

      // 1. Check if email already in supplier_team_members for this supplier
      const { data: existingTeam } = await supabase
        .from('supplier_team_members')
        .select('id, invite_status')
        .eq('supplier_id', supplier.id)
        .ilike('email', inviteEmail.trim())
        .maybeSingle();

      if (existingTeam) {
        showToast('This email is already part of your team or has a pending invite.', 'error');
        return;
      }

      // 2. Check if email already in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', inviteEmail.trim())
        .maybeSingle();

      if (existingProfile) {
        showToast('An account with this email already exists on TerraTern.', 'error');
        return;
      }

      // 3. Generate token & insert team member
      const token = crypto.randomUUID();
      const { error: insertErr } = await supabase.from('supplier_team_members').insert({
        supplier_id: supplier.id,
        invited_by: profile?.id,
        email: inviteEmail.trim().toLowerCase(),
        first_name: inviteFirstName.trim(),
        last_name: inviteLastName.trim(),
        role: 'member',
        invite_status: 'pending',
        invite_token: token,
      });

      if (insertErr) throw insertErr;

      const fullInviteLink = `${window.location.origin}/supplier-team-invite?token=${token}`;
      setGeneratedInviteLink(fullInviteLink);
      showToast(`Invite generated for ${inviteFirstName.trim()}.`);
      setInviteFirstName('');
      setInviteLastName('');
      setInviteEmail('');
      await fetchTeamMembers();
    } catch (err: any) {
      console.error('Invite member error:', err);
      showToast(err.message || 'Failed to generate team invite.', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handlePromoteToAdmin = async (member: any) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('supplier_team_members')
        .update({ role: 'admin' })
        .eq('id', member.id);

      if (error) throw error;

      showToast(`${member.first_name} has been promoted to Admin.`);
      setConfirmModal(null);
      await fetchTeamMembers();
    } catch (err: any) {
      console.error('Promote error:', err);
      showToast(err.message || 'Failed to promote member.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (member: any) => {
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('supplier_team_members')
        .update({ invite_status: 'deactivated' })
        .eq('id', member.id);

      if (error) throw error;

      showToast(`${member.first_name}'s access has been deactivated.`);
      setConfirmModal(null);
      await fetchTeamMembers();
    } catch (err: any) {
      console.error('Deactivate error:', err);
      showToast(err.message || 'Failed to deactivate member.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResendLink = async (member: any) => {
    try {
      const newToken = crypto.randomUUID();
      const { error } = await supabase
        .from('supplier_team_members')
        .update({ invite_token: newToken })
        .eq('id', member.id);

      if (error) throw error;

      const link = `${window.location.origin}/supplier-team-invite?token=${newToken}`;
      setGeneratedInviteLink(link);
      showToast(`Regenerated invite link for ${member.first_name}.`);
      await fetchTeamMembers();
    } catch (err: any) {
      console.error('Resend error:', err);
      showToast(err.message || 'Failed to regenerate invite link.', 'error');
    }
  };

  const handleCancelInvite = async (member: any) => {
    if (!confirm(`Cancel and remove the pending invite for ${member.first_name}?`)) return;
    try {
      const { error } = await supabase
        .from('supplier_team_members')
        .delete()
        .eq('id', member.id);

      if (error) throw error;

      showToast('Pending invite removed.');
      await fetchTeamMembers();
    } catch (err: any) {
      console.error('Cancel error:', err);
      showToast(err.message || 'Failed to cancel invite.', 'error');
    }
  };

  const copyLink = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // ----------------------------------------------------
  // RENDER
  // ----------------------------------------------------
  return (
    <div className="w-full pb-12 animate-in fade-in duration-150">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-[8px] text-xs font-medium shadow-lg transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] border border-[#E2E8F4] max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-[#0F172A] mb-2">
              {confirmModal.type === 'promote'
                ? `Promote ${confirmModal.member.first_name} to Admin?`
                : `Remove ${confirmModal.member.first_name}'s Access?`}
            </h3>
            <p className="text-xs text-[#4A5568] leading-relaxed mb-6">
              {confirmModal.type === 'promote'
                ? `This will grant ${confirmModal.member.first_name} full administrative privileges, including team management and profile editing. Proceed?`
                : `This will immediately revoke ${confirmModal.member.first_name}'s access to the supplier dashboard. Their account will be deactivated.`}
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                disabled={actionLoading}
                className="px-4 py-2 border border-[#E2E8F4] rounded-[6px] text-xs font-medium text-[#4A5568] hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  confirmModal.type === 'promote'
                    ? handlePromoteToAdmin(confirmModal.member)
                    : handleRemoveMember(confirmModal.member)
                }
                disabled={actionLoading}
                className={`px-4 py-2 rounded-[6px] text-xs font-semibold text-white flex items-center space-x-1.5 ${
                  confirmModal.type === 'promote'
                    ? 'bg-[#1B3270] hover:bg-[#2952A3]'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{confirmModal.type === 'promote' ? 'Confirm Promotion' : 'Deactivate Access'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main 2-Column Layout */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* LEFT SIDEBAR (200px fixed) */}
        <aside className="w-full md:w-[200px] flex-shrink-0 bg-white rounded-[10px] border border-[#E2E8F4] p-3 flex flex-col justify-between shadow-xs sticky top-24">
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveSection('identity')}
              className={`w-full text-left px-3 py-2.5 rounded-[6px] text-xs font-medium transition-colors flex items-center space-x-2 ${
                activeSection === 'identity'
                  ? 'bg-[#1B3270]/10 text-[#1B3270] font-semibold'
                  : 'text-[#4A5568] hover:bg-gray-50'
              }`}
            >
              <Building2 className="w-4 h-4 text-[#1B3270]" />
              <span>Company Identity</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('contact')}
              className={`w-full text-left px-3 py-2.5 rounded-[6px] text-xs font-medium transition-colors flex items-center space-x-2 ${
                activeSection === 'contact'
                  ? 'bg-[#1B3270]/10 text-[#1B3270] font-semibold'
                  : 'text-[#4A5568] hover:bg-gray-50'
              }`}
            >
              <Mail className="w-4 h-4 text-[#1B3270]" />
              <span>Contact Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('specialisation')}
              className={`w-full text-left px-3 py-2.5 rounded-[6px] text-xs font-medium transition-colors flex items-center space-x-2 ${
                activeSection === 'specialisation'
                  ? 'bg-[#1B3270]/10 text-[#1B3270] font-semibold'
                  : 'text-[#4A5568] hover:bg-gray-50'
              }`}
            >
              <Globe className="w-4 h-4 text-[#1B3270]" />
              <span>Specialisation</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('compliance')}
              className={`w-full text-left px-3 py-2.5 rounded-[6px] text-xs font-medium transition-colors flex items-center space-x-2 ${
                activeSection === 'compliance'
                  ? 'bg-[#1B3270]/10 text-[#1B3270] font-semibold'
                  : 'text-[#4A5568] hover:bg-gray-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#1B3270]" />
              <span>Compliance</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('team')}
              className={`w-full text-left px-3 py-2.5 rounded-[6px] text-xs font-medium transition-colors flex items-center space-x-2 ${
                activeSection === 'team'
                  ? 'bg-[#1B3270]/10 text-[#1B3270] font-semibold'
                  : 'text-[#4A5568] hover:bg-gray-50'
              }`}
            >
              <UserPlus className="w-4 h-4 text-[#1B3270]" />
              <span>Team Members</span>
            </button>
          </nav>

          {/* Profile Completeness Bar at Bottom of Sidebar */}
          <div className="mt-8 pt-4 border-t border-[#E2E8F4]">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F172A] mb-1.5">
              <span>Profile Completeness</span>
              <span className="text-[#1B3270]">{completenessPct}%</span>
            </div>
            <div className="w-full bg-[#E2E8F4] h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#10B981] h-full transition-all duration-300 rounded-full"
                style={{ width: `${completenessPct}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-[#94A3B8] mt-1.5 leading-tight">
              {completenessPct === 100
                ? 'All mandatory fields completed'
                : `${filledCount} of ${mandatoryFields.length} mandatory sections filled`}
            </p>
          </div>
        </aside>

        {/* RIGHT: ACTIVE SECTION FORM */}
        <div className="flex-1 w-full">
          {/* ==================================================== */}
          {/* SECTION 1: COMPANY IDENTITY */}
          {/* ==================================================== */}
          {activeSection === 'identity' && (
            <div className="bg-white rounded-[10px] border border-[#E2E8F4] p-6 shadow-xs">
              <div className="mb-6 pb-4 border-b border-[#E2E8F4]">
                <h2 className="text-base font-bold text-[#0F172A]">Company Identity</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Update your official corporate credentials and public organisation overview.
                </p>
              </div>

              <form onSubmit={handleSaveIdentity} className="space-y-5">
                {/* Logo Upload */}
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-2">
                    Company Logo
                  </label>
                  <div className="flex items-center space-x-4">
                    <div className="relative w-16 h-16 rounded-full bg-[#F8FAFD] border-2 border-[#E2E8F4] flex items-center justify-center overflow-hidden group">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Company Logo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Building2 className="w-7 h-7 text-[#94A3B8]" />
                      )}
                      {uploadingLogo && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        ref={logoInputRef}
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="px-3 py-1.5 bg-white border border-[#E2E8F4] hover:bg-gray-50 text-[#0F172A] text-xs font-semibold rounded-[6px] transition-colors flex items-center space-x-1.5"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#1B3270]" />
                        <span>Upload Logo</span>
                      </button>
                      <p className="text-[11px] text-[#94A3B8] mt-1">
                        Square format, max 2MB (PNG, JPG, SVG).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Company Name & Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. IndieGerman Healthcare Placement"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Company Type *
                    </label>
                    <select
                      value={companyType}
                      onChange={(e) => setCompanyType(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                    >
                      <option value="placement_agency">Placement Agency</option>
                      <option value="language_school">Language School</option>
                      <option value="training_center">Training Center</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                {/* Registration Number & Year Established */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value)}
                      placeholder="e.g. CIN / License Number"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Year Established
                    </label>
                    <input
                      type="number"
                      min={1900}
                      max={new Date().getFullYear()}
                      value={yearEstablished}
                      onChange={(e) => setYearEstablished(e.target.value)}
                      placeholder="e.g. 2018"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                    />
                  </div>
                </div>

                {/* Website URL */}
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Website URL
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
                    <input
                      type="text"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                    />
                  </div>
                </div>

                {/* Description with Character Counter */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#0F172A]">
                      About / Description
                    </label>
                    <span className="text-[11px] text-[#94A3B8]">
                      {description.length}/500 characters
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    maxLength={500}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your company, your approach to candidate placement, and your experience in the healthcare sector."
                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingIdentity}
                    className="bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-[6px] text-xs flex items-center space-x-2 transition-colors shadow-sm"
                  >
                    {savingIdentity && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Company Identity</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ==================================================== */}
          {/* SECTION 2: CONTACT DETAILS */}
          {/* ==================================================== */}
          {activeSection === 'contact' && (
            <div className="bg-white rounded-[10px] border border-[#E2E8F4] p-6 shadow-xs">
              <div className="mb-6 pb-4 border-b border-[#E2E8F4]">
                <h2 className="text-base font-bold text-[#0F172A]">Contact Details</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Designate your organisation's primary liaison for TerraTern communication.
                </p>
              </div>

              <form onSubmit={handleSaveContact} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Primary Contact Name */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Primary Contact Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={primaryContactName}
                      onChange={(e) => setPrimaryContactName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                    />
                  </div>

                  {/* Readonly Auth Email */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Primary Contact Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
                      <input
                        type="email"
                        value={primaryContactEmail}
                        readOnly
                        className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-[#E2E8F4] rounded-[6px] text-xs text-[#4A5568] font-medium cursor-not-allowed"
                      />
                    </div>
                    <p className="text-[10px] text-[#94A3B8] mt-1">
                      Tied to authentication login credentials.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Primary Phone */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Primary Contact Phone
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
                      <input
                        type="text"
                        value={primaryContactPhone}
                        onChange={(e) => setPrimaryContactPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                      />
                    </div>
                  </div>

                  {/* Country of Operation */}
                  <div>
                    <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                      Country of Operation *
                    </label>
                    <select
                      value={countryOfOperation}
                      onChange={(e) => setCountryOfOperation(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                    >
                      {COMMON_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Office Address */}
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                    Office Address
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 absolute left-3 top-3 text-[#94A3B8]" />
                    <textarea
                      rows={3}
                      value={officeAddress}
                      onChange={(e) => setOfficeAddress(e.target.value)}
                      placeholder="Street, City, Postal Code, State"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingContact}
                    className="bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-[6px] text-xs flex items-center space-x-2 transition-colors shadow-sm"
                  >
                    {savingContact && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Contact Details</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ==================================================== */}
          {/* SECTION 3: SPECIALISATION */}
          {/* ==================================================== */}
          {activeSection === 'specialisation' && (
            <div className="bg-white rounded-[10px] border border-[#E2E8F4] p-6 shadow-xs">
              <div className="mb-6 pb-4 border-b border-[#E2E8F4]">
                <h2 className="text-base font-bold text-[#0F172A]">Clinical Specialisation & Sourcing</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Specify your candidate talent pool specialisations and geographic sourcing footprints.
                </p>
              </div>

              <form onSubmit={handleSaveSpecialisation} className="space-y-6">
                {/* Healthcare Roles Multi-Select */}
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-2">
                    Healthcare Roles Focus *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {HEALTHCARE_ROLES.map((role) => {
                      const isChecked = rolesFocus.includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className={`flex items-center space-x-2.5 p-3 rounded-[6px] border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-[#1B3270]/5 border-[#1B3270] text-[#1B3270]'
                              : 'bg-white border-[#E2E8F4] text-[#4A5568] hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleRoleFocus(role.id)}
                            className="rounded border-[#E2E8F4] text-[#1B3270] focus:ring-[#1B3270]"
                          />
                          <span className="text-xs font-medium">{role.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Source Countries Multi-Select */}
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-2">
                    Source Countries
                  </label>
                  <p className="text-[11px] text-[#94A3B8] mb-2">
                    Select countries from which you recruit and prepare candidates.
                  </p>

                  {/* Selected Country Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {sourceCountries.length === 0 ? (
                      <span className="text-xs text-[#94A3B8] italic">
                        No source countries selected yet.
                      </span>
                    ) : (
                      sourceCountries.map((c) => (
                        <span
                          key={c}
                          className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-[#1B3270]/10 text-[#1B3270] rounded-full text-xs font-medium"
                        >
                          <span>{c}</span>
                          <button
                            type="button"
                            onClick={() => toggleSourceCountry(c)}
                            className="hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Country Selector Dropdown */}
                  <div className="relative">
                    <div
                      onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] rounded-[6px] text-xs text-[#4A5568] flex items-center justify-between cursor-pointer hover:bg-gray-50"
                    >
                      <span>Add source countries...</span>
                      <ChevronDown className="w-4 h-4 text-[#94A3B8]" />
                    </div>

                    {isCountryDropdownOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-[#E2E8F4] rounded-[8px] shadow-lg max-h-56 overflow-y-auto p-2">
                        <div className="relative mb-2">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#94A3B8]" />
                          <input
                            type="text"
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder="Search countries..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded-[4px] outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          {COMMON_COUNTRIES.filter((c) =>
                            c.toLowerCase().includes(countrySearch.toLowerCase())
                          ).map((c) => {
                            const isSelected = sourceCountries.includes(c);
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => toggleSourceCountry(c)}
                                className={`w-full text-left px-2.5 py-1.5 rounded-[4px] text-xs flex items-center justify-between transition-colors ${
                                  isSelected
                                    ? 'bg-[#1B3270]/10 text-[#1B3270] font-semibold'
                                    : 'text-[#4A5568] hover:bg-gray-50'
                                }`}
                              >
                                <span>{c}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#1B3270]" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingSpecialisation}
                    className="bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-[6px] text-xs flex items-center space-x-2 transition-colors shadow-sm"
                  >
                    {savingSpecialisation && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Specialisation</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ==================================================== */}
          {/* SECTION 4: COMPLIANCE */}
          {/* ==================================================== */}
          {activeSection === 'compliance' && (
            <div className="space-y-6">
              {/* SUB-SECTION 1: DECLARATIONS */}
              <div className="bg-white rounded-[10px] border border-[#E2E8F4] p-6 shadow-xs">
                <div className="mb-6 pb-4 border-b border-[#E2E8F4]">
                  <h2 className="text-base font-bold text-[#0F172A]">Compliance Declarations</h2>
                  <p className="text-xs text-[#4A5568] mt-0.5">
                    Statutory German ethical recruitment standards and candidate fee protections.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Faire Anwerbung Pflege */}
                  <div className="p-4 rounded-[8px] border border-[#E2E8F4] bg-[#F8FAFD] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="max-w-xl">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#0F172A]">
                          Faire Anwerbung Pflege Deutschland Standard
                        </span>
                        {complianceDeclared && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#4A5568] mt-1 leading-relaxed">
                        I confirm that my recruitment practices comply with the Faire Anwerbung Pflege Deutschland standard.
                      </p>
                      {complianceDeclared && complianceDeclaredAt && (
                        <p className="text-[11px] text-emerald-700 font-medium mt-1">
                          Declared on {formatDate(complianceDeclaredAt)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleComplianceDeclared}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        complianceDeclared ? 'bg-[#10B981]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          complianceDeclared ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* No-Fee Policy */}
                  <div className="p-4 rounded-[8px] border border-[#E2E8F4] bg-[#F8FAFD] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="max-w-xl">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-[#0F172A]">
                          Zero-Fee Candidate Policy
                        </span>
                        {noFeeConfirmed && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#4A5568] mt-1 leading-relaxed">
                        I confirm that candidates are never charged fees for placement services or German recruitment facilitation.
                      </p>
                      {noFeeConfirmed && noFeeConfirmedAt && (
                        <p className="text-[11px] text-emerald-700 font-medium mt-1">
                          Declared on {formatDate(noFeeConfirmedAt)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleNoFeeConfirmed}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        noFeeConfirmed ? 'bg-[#10B981]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          noFeeConfirmed ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* SUB-SECTION 2: COMPLIANCE DOCUMENTS */}
              <div className="bg-white rounded-[10px] border border-[#E2E8F4] p-6 shadow-xs">
                <div className="mb-6 pb-4 border-b border-[#E2E8F4]">
                  <h2 className="text-base font-bold text-[#0F172A]">Compliance Documents</h2>
                  <p className="text-xs text-[#4A5568] mt-0.5">
                    Upload supporting compliance documents. These will be reviewed by the TerraTern team.
                  </p>
                </div>

                <div className="space-y-3.5">
                  {COMPLIANCE_DOC_TEMPLATES.map((tmpl) => {
                    const doc = complianceDocs.find((d) => d.document_type === tmpl.type);
                    const status = doc?.status || 'not_uploaded';
                    const isUploading = uploadingDocType === tmpl.type;

                    return (
                      <div
                        key={tmpl.type}
                        className="p-4 rounded-[8px] border border-[#E2E8F4] flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-gray-300 transition-colors"
                      >
                        {/* Left Info */}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-[#0F172A]">{tmpl.label}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              Mandatory
                            </span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8] mt-1">{tmpl.notes}</p>
                          {doc?.rejection_reason && (
                            <p className="text-[11px] text-rose-600 font-medium mt-1">
                              Rejection reason: {doc.rejection_reason}
                            </p>
                          )}
                        </div>

                        {/* Center Status Badge */}
                        <div className="flex items-center">
                          {status === 'verified' && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Verified</span>
                            </span>
                          )}
                          {(status === 'pending' || status === 'under_review') && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>Under Review</span>
                            </span>
                          )}
                          {status === 'rejected' && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Rejected</span>
                            </span>
                          )}
                          {status === 'not_uploaded' && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-[#94A3B8] border border-gray-200">
                              Not Uploaded
                            </span>
                          )}
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center space-x-2">
                          {doc?.file_url && (
                            <button
                              type="button"
                              onClick={() => handleViewDoc(doc.file_url)}
                              className="px-3 py-1.5 text-xs text-[#1B3270] hover:text-[#2952A3] font-medium flex items-center space-x-1"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>View File</span>
                            </button>
                          )}

                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              disabled={isUploading}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) handleUploadDocument(tmpl.type, f);
                              }}
                              className="hidden"
                            />
                            <span className="px-3 py-1.5 bg-white border border-[#E2E8F4] hover:bg-gray-50 text-[#0F172A] text-xs font-semibold rounded-[6px] transition-colors inline-flex items-center space-x-1.5 shadow-2xs">
                              {isUploading ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#1B3270]" />
                              ) : (
                                <Upload className="w-3.5 h-3.5 text-[#1B3270]" />
                              )}
                              <span>
                                {status === 'not_uploaded'
                                  ? 'Upload'
                                  : status === 'rejected'
                                  ? 'Re-upload'
                                  : 'Replace'}
                              </span>
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 p-3 bg-[#F8FAFD] rounded-[6px] border border-[#E2E8F4]">
                  <p className="text-[11px] text-[#4A5568] leading-relaxed">
                    ℹ Documents are reviewed by the TerraTern team. Verified documents contribute to your tier upgrade eligibility.
                  </p>
                </div>
              </div>

              {/* SUB-SECTION 3: VERIFICATION TIER & RM CARD */}
              <div className="bg-white rounded-[10px] border border-[#E2E8F4] p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#E2E8F4]">
                  <div>
                    <h2 className="text-base font-bold text-[#0F172A]">Verification Tier</h2>
                    <p className="text-xs text-[#4A5568] mt-0.5">
                      Your supplier partner rank determines hospital exposure and candidate visibility.
                    </p>
                  </div>
                  <div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${
                        supplier?.tier === 'audited'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : supplier?.tier === 'verified'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-gray-100 text-[#4A5568] border-gray-200'
                      }`}
                    >
                      {supplier?.tier || 'Basic'} Tier
                    </span>
                  </div>
                </div>

                {/* Tier Benefits Table */}
                <div className="overflow-x-auto mb-6">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[#E2E8F4] text-[#94A3B8]">
                        <th className="py-2.5 px-3 font-semibold">Tier</th>
                        <th className="py-2.5 px-3 font-semibold">Ranking</th>
                        <th className="py-2.5 px-3 font-semibold">Candidate Reveal</th>
                        <th className="py-2.5 px-3 font-semibold">Quota Cap</th>
                        <th className="py-2.5 px-3 font-semibold">Boosted Visibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F4] text-[#0F172A]">
                      <tr className={supplier?.tier === 'basic' || !supplier?.tier ? 'bg-[#1B3270]/5 font-semibold' : ''}>
                        <td className="py-2.5 px-3">Basic</td>
                        <td className="py-2.5 px-3">Standard</td>
                        <td className="py-2.5 px-3">Hidden</td>
                        <td className="py-2.5 px-3">Low</td>
                        <td className="py-2.5 px-3">No</td>
                      </tr>
                      <tr className={supplier?.tier === 'verified' ? 'bg-[#1B3270]/5 font-semibold' : ''}>
                        <td className="py-2.5 px-3">Verified</td>
                        <td className="py-2.5 px-3">Boosted</td>
                        <td className="py-2.5 px-3">Partial</td>
                        <td className="py-2.5 px-3">Medium</td>
                        <td className="py-2.5 px-3">Yes</td>
                      </tr>
                      <tr className={supplier?.tier === 'audited' ? 'bg-[#1B3270]/5 font-semibold' : ''}>
                        <td className="py-2.5 px-3">Audited</td>
                        <td className="py-2.5 px-3">Priority</td>
                        <td className="py-2.5 px-3">Full</td>
                        <td className="py-2.5 px-3">High</td>
                        <td className="py-2.5 px-3">Priority Exposure</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <p className="text-[11px] text-[#4A5568] leading-relaxed mb-6">
                  Your tier is reviewed and assigned by the TerraTern team. Complete your compliance documents and declarations to be considered for a tier upgrade. Contact your account manager for more information.
                </p>

                {/* Assigned Account Manager Card */}
                <div>
                  <h3 className="text-xs font-bold text-[#0F172A] mb-2">Assigned Account Manager</h3>
                  {assignedRm?.profiles ? (
                    <div className="p-4 rounded-[8px] bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block mb-0.5">
                          Your Account Manager
                        </span>
                        <p className="text-sm font-bold text-[#0F172A]">
                          {assignedRm.profiles.first_name} {assignedRm.profiles.last_name}
                        </p>
                        <p className="text-xs text-[#4A5568] mt-0.5 flex items-center space-x-2">
                          <span className="font-medium">{assignedRm.profiles.email}</span>
                          {assignedRm.profiles.phone && <span>• {assignedRm.profiles.phone}</span>}
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        Active RM
                      </span>
                    </div>
                  ) : (
                    <div className="p-4 rounded-[8px] bg-amber-50/70 border border-amber-200">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-bold text-amber-900">
                          Account manager not yet assigned.
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 mt-1">
                        You will be notified as soon as one is assigned by the TerraTern team.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== */}
          {/* SECTION 5: TEAM MEMBERS */}
          {/* ==================================================== */}
          {activeSection === 'team' && (
            <div className="space-y-6">
              {/* INVITE MEMBER FORM (Admin Only) */}
              {currentUserRole === 'admin' && (
                <div className="bg-white rounded-[10px] border border-[#E2E8F4] p-6 shadow-xs">
                  <div className="mb-6 pb-4 border-b border-[#E2E8F4]">
                    <h2 className="text-base font-bold text-[#0F172A]">Invite Team Member</h2>
                    <p className="text-xs text-[#4A5568] mt-0.5">
                      Generate an invitation link to onboard recruiters and coordinators to your supplier dashboard.
                    </p>
                  </div>

                  <form onSubmit={handleInviteMember} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                          First Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={inviteFirstName}
                          onChange={(e) => setInviteFirstName(e.target.value)}
                          placeholder="First Name"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                          Last Name
                        </label>
                        <input
                          type="text"
                          value={inviteLastName}
                          onChange={(e) => setInviteLastName(e.target.value)}
                          placeholder="Last Name"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#0F172A] mb-1.5">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="colleague@example.com"
                          className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F4] focus:border-[#1B3270] focus:ring-1 focus:ring-[#1B3270] rounded-[6px] text-xs text-[#0F172A] outline-none"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={inviting}
                        className="bg-[#1B3270] hover:bg-[#2952A3] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-[6px] text-xs flex items-center space-x-2 transition-colors shadow-sm"
                      >
                        {inviting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Generate Invite Link</span>
                      </button>
                    </div>
                  </form>

                  {/* Generated Link Box */}
                  {generatedInviteLink && (
                    <div className="mt-5 p-4 rounded-[8px] bg-[#F8FAFD] border border-[#1B3270]/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#1B3270]">
                          Invitation Link Ready
                        </span>
                        <button
                          type="button"
                          onClick={() => copyLink(generatedInviteLink)}
                          className="px-2.5 py-1 bg-[#1B3270] text-white text-[11px] font-semibold rounded-[4px] flex items-center space-x-1"
                        >
                          {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={generatedInviteLink}
                        className="w-full px-3 py-2 bg-white border border-[#E2E8F4] rounded-[6px] text-xs font-mono text-[#4A5568]"
                      />
                      <p className="text-[11px] text-[#94A3B8] mt-1.5">
                        Share this link with your team member. They can create their credentials and join your organisation.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TEAM MEMBERS LIST */}
              <div className="bg-white rounded-[10px] border border-[#E2E8F4] p-6 shadow-xs">
                <div className="mb-6 pb-4 border-b border-[#E2E8F4]">
                  <h2 className="text-base font-bold text-[#0F172A]">Active & Pending Team Members</h2>
                  <p className="text-xs text-[#4A5568] mt-0.5">
                    Roster of all staff with access to candidate pipeline and job pool.
                  </p>
                </div>

                {loadingTeam ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="w-6 h-6 text-[#1B3270] animate-spin" />
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="text-center py-10">
                    <UserPlus className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                    <p className="text-xs font-medium text-[#4A5568]">No team members registered yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#E2E8F4] text-[#94A3B8]">
                          <th className="py-2.5 px-3 font-semibold">Name</th>
                          <th className="py-2.5 px-3 font-semibold">Email</th>
                          <th className="py-2.5 px-3 font-semibold">Role</th>
                          <th className="py-2.5 px-3 font-semibold">Status</th>
                          <th className="py-2.5 px-3 font-semibold">Joined / Created</th>
                          {currentUserRole === 'admin' && (
                            <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F4] text-[#0F172A]">
                        {teamMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-gray-50/50">
                            <td className="py-3 px-3 font-medium">
                              {member.first_name} {member.last_name || ''}
                            </td>
                            <td className="py-3 px-3 text-[#4A5568]">{member.email}</td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  member.role === 'admin'
                                    ? 'bg-[#1B3270]/10 text-[#1B3270] border border-[#1B3270]/20'
                                    : 'bg-gray-100 text-[#4A5568] border border-gray-200'
                                }`}
                              >
                                {member.role === 'admin' ? 'Admin' : 'Member'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {member.invite_status === 'accepted' || member.invite_status === 'active' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Active
                                </span>
                              ) : member.invite_status === 'deactivated' ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-[#94A3B8] border border-gray-200">
                                  Deactivated
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  Invite Pending
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-[#94A3B8] text-[11px]">
                              {formatDate(member.created_at)}
                            </td>
                            {currentUserRole === 'admin' && (
                              <td className="py-3 px-3 text-right">
                                {member.invite_status === 'pending' ? (
                                  <div className="flex items-center justify-end space-x-2">
                                    <button
                                      type="button"
                                      onClick={() => handleResendLink(member)}
                                      className="text-xs text-[#1B3270] hover:underline font-medium"
                                    >
                                      Resend Link
                                    </button>
                                    <span className="text-[#94A3B8]">•</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCancelInvite(member)}
                                      className="text-xs text-rose-600 hover:underline font-medium"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : member.invite_status !== 'deactivated' && member.profile_id !== profile?.id ? (
                                  <div className="flex items-center justify-end space-x-2">
                                    {member.role !== 'admin' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmModal({ type: 'promote', member })}
                                          className="text-xs text-[#1B3270] hover:underline font-medium"
                                        >
                                          Promote to Admin
                                        </button>
                                        <span className="text-[#94A3B8]">•</span>
                                      </>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setConfirmModal({ type: 'remove', member })}
                                      className="text-xs text-rose-600 hover:underline font-medium"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-[#94A3B8] italic">No actions</span>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
