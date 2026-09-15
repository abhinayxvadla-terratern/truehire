import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Globe,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Copy,
  Check,
  Camera,
  Loader2,
  ChevronDown,
  X,
  Search,
  Users,
  Info,
  UserCheck,
  Plus,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

interface EmployerProfileTabProps {
  employer: any;
  currentUserRole?: 'admin' | 'member';
  onRefresh: () => void;
}

type ProfileSection = 'identity' | 'contact' | 'hiring_needs' | 'account' | 'team';

const COMMON_COUNTRIES = [
  'Germany',
  'Austria',
  'Switzerland',
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
  'United Kingdom',
  'United States',
  'Canada',
  'United Arab Emirates',
  'Saudi Arabia',
  'Poland',
  'Romania',
  'Spain',
  'Italy',
  'France',
  'Netherlands',
];

const HEALTHCARE_ROLES = [
  { id: 'Nursing (General)', label: 'Nursing (General)' },
  { id: 'Nursing (Specialised)', label: 'Nursing (Specialised)' },
  { id: 'Care Work', label: 'Care Work' },
  { id: 'Ausbildung', label: 'Ausbildung' },
  { id: 'Allied Health', label: 'Allied Health' },
  { id: 'Other', label: 'Other' },
];

const COMPANY_SIZE_OPTIONS = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
];

const ANNUAL_HIRING_VOLUME_OPTIONS = [
  { value: '1-5 placements per year', label: '1-5 placements per year' },
  { value: '6-20 placements per year', label: '6-20 placements per year' },
  { value: '21-50 placements per year', label: '21-50 placements per year' },
  { value: '50+ placements per year', label: '50+ placements per year' },
];

export const EmployerProfileTab: React.FC<EmployerProfileTabProps> = ({
  employer,
  currentUserRole = 'admin',
  onRefresh,
}) => {
  const { profile } = useAuth();
  const [activeSection, setActiveSection] = useState<ProfileSection>('identity');

  // --- Section 1: Company Identity State ---
  const [companyName, setCompanyName] = useState(employer?.company_name || '');
  const [industry, setIndustry] = useState(employer?.industry || '');
  const [companySize, setCompanySize] = useState(employer?.company_size || '');
  const [yearEstablished, setYearEstablished] = useState<string>(
    employer?.year_established ? String(employer.year_established) : ''
  );
  const [description, setDescription] = useState(employer?.description || '');
  const [websiteUrl, setWebsiteUrl] = useState(employer?.website_url || '');
  const [logoUrl, setLogoUrl] = useState(employer?.logo_url || '');
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Section 2: Contact Details State ---
  const [primaryContactName, setPrimaryContactName] = useState(
    employer?.primary_contact_name || ''
  );
  const [primaryContactPhone, setPrimaryContactPhone] = useState(
    employer?.primary_contact_phone || ''
  );
  const [officeAddress, setOfficeAddress] = useState(employer?.office_address || '');
  const [country, setCountry] = useState(employer?.country || employer?.location || 'Germany');
  const [countrySearch, setCountrySearch] = useState('');
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const [savingContact, setSavingContact] = useState(false);

  // --- Section 3: Hiring Needs State ---
  const [healthcareRoles, setHealthcareRoles] = useState<string[]>(
    Array.isArray(employer?.healthcare_roles_hiring)
      ? employer.healthcare_roles_hiring
      : []
  );
  const [preferredSourceCountries, setPreferredSourceCountries] = useState<string[]>(
    Array.isArray(employer?.preferred_source_countries)
      ? employer.preferred_source_countries
      : []
  );
  const [sourceCountrySearch, setSourceCountrySearch] = useState('');
  const [sourceCountryDropdownOpen, setSourceCountryDropdownOpen] = useState(false);
  const [annualHiringVolume, setAnnualHiringVolume] = useState(
    employer?.annual_hiring_volume || ''
  );
  const [savingHiringNeeds, setSavingHiringNeeds] = useState(false);

  // --- Section 4: Account & RM State ---
  const [assignedRm, setAssignedRm] = useState<any>(null);
  const [loadingRm, setLoadingRm] = useState(false);

  // --- Section 5: Team Members State ---
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedInviteLink, setGeneratedInviteLink] = useState<{
    name: string;
    url: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Modals for team member actions
  const [promoteModalMember, setPromoteModalMember] = useState<any | null>(null);
  const [removeModalMember, setRemoveModalMember] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Global Notification / Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Sync state when employer prop updates
  useEffect(() => {
    if (!employer) return;
    setCompanyName(employer.company_name || '');
    setIndustry(employer.industry || '');
    setCompanySize(employer.company_size || '');
    setYearEstablished(employer.year_established ? String(employer.year_established) : '');
    setDescription(employer.description || '');
    setWebsiteUrl(employer.website_url || '');
    setLogoUrl(employer.logo_url || '');

    setPrimaryContactName(employer.primary_contact_name || '');
    setPrimaryContactPhone(employer.primary_contact_phone || '');
    setOfficeAddress(employer.office_address || '');
    setCountry(employer.country || employer.location || 'Germany');

    setHealthcareRoles(
      Array.isArray(employer.healthcare_roles_hiring)
        ? employer.healthcare_roles_hiring
        : []
    );
    setPreferredSourceCountries(
      Array.isArray(employer.preferred_source_countries)
        ? employer.preferred_source_countries
        : []
    );
    setAnnualHiringVolume(employer.annual_hiring_volume || '');
  }, [employer]);

  // Load RM assignment
  const fetchAssignedRm = async () => {
    if (!employer?.id) return;
    try {
      setLoadingRm(true);
      const { data: assignment, error } = await supabase
        .from('rm_assignments')
        .select(`
          id,
          rm_profile_id,
          active,
          created_at,
          profiles:rm_profile_id (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq('entity_type', 'employer')
        .eq('entity_id', employer.id)
        .eq('active', true)
        .maybeSingle();

      if (!error && assignment) {
        setAssignedRm(assignment);
      } else {
        setAssignedRm(null);
      }
    } catch (err) {
      console.error('Error loading employer RM assignment:', err);
    } finally {
      setLoadingRm(false);
    }
  };

  // Load Team Members
  const fetchTeamMembers = async () => {
    if (!employer?.id) return;
    try {
      setLoadingTeam(true);
      const { data, error } = await supabase
        .from('employer_team_members')
        .select('*')
        .eq('employer_id', employer.id)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setTeamMembers(data);
      }
    } catch (err) {
      console.error('Error loading team members:', err);
    } finally {
      setLoadingTeam(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'account') {
      fetchAssignedRm();
    } else if (activeSection === 'team') {
      fetchTeamMembers();
    }
  }, [activeSection, employer?.id]);

  // --- Profile Completeness Calculation ---
  const calculateCompleteness = () => {
    let score = 0;
    // 6 Primary/Required Milestones (15% each = 90%)
    if (companyName?.trim()) score += 15;
    if (companySize) score += 15;
    if (primaryContactName?.trim()) score += 15;
    if (country) score += 15;
    if (healthcareRoles && healthcareRoles.length > 0) score += 15;
    if (annualHiringVolume) score += 15;

    // Optional Details (2% each = 10%)
    if (logoUrl) score += 2;
    if (industry?.trim()) score += 2;
    if (description?.trim()) score += 2;
    if (websiteUrl?.trim()) score += 2;
    if (primaryContactPhone?.trim()) score += 2;

    return Math.min(100, score);
  };

  const completeness = calculateCompleteness();

  // Helper to recompute onboarding checklist and update employers table
  const recomputeOnboardingChecklist = async () => {
    if (!employer?.id) return;
    try {
      // 1. profile_completed: company_name, company_size, primary_contact_name, country all non-null
      const profileCompleted = Boolean(
        companyName?.trim() &&
        companySize &&
        primaryContactName?.trim() &&
        country
      );

      // 2. rm_assigned
      const { count: rmCount } = await supabase
        .from('rm_assignments')
        .select('id', { count: 'exact', head: true })
        .eq('entity_type', 'employer')
        .eq('entity_id', employer.id)
        .eq('active', true);
      const rmAssigned = (rmCount || 0) > 0;

      // 3. first_requirement_posted
      const { count: reqCount } = await supabase
        .from('job_requirements')
        .select('id', { count: 'exact', head: true })
        .eq('employer_id', employer.id);
      const firstRequirementPosted = (reqCount || 0) >= 1;

      // 4. talent_pool_browsed
      const { count: interestCount } = await supabase
        .from('employer_candidate_interests')
        .select('id', { count: 'exact', head: true })
        .eq('employer_id', employer.id);
      const talentPoolBrowsed = (interestCount || 0) >= 1;

      // 5. first_placement
      let firstPlacement = false;
      const { data: myJobs } = await supabase
        .from('job_requirements')
        .select('id')
        .eq('employer_id', employer.id);
      const jobIds = (myJobs || []).map((j) => j.id);
      if (jobIds.length > 0) {
        const { count: placedCount } = await supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .in('job_id', jobIds)
          .eq('status', 'placed');
        firstPlacement = (placedCount || 0) >= 1;
      }

      const newChecklist = {
        profile_completed: profileCompleted,
        rm_assigned: rmAssigned,
        first_requirement_posted: firstRequirementPosted,
        talent_pool_browsed: talentPoolBrowsed,
        first_placement: firstPlacement,
      };

      await supabase
        .from('employers')
        .update({ onboarding_checklist: newChecklist })
        .eq('id', employer.id);
    } catch (err) {
      console.error('Error updating onboarding checklist:', err);
    }
  };

  // --- SAVE SECTION 1: COMPANY IDENTITY ---
  const handleSaveIdentity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      alert('Company Name is required.');
      return;
    }
    if (!companySize) {
      alert('Company Size is required.');
      return;
    }
    if (websiteUrl && !websiteUrl.match(/^https?:\/\/.+/i) && !websiteUrl.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)) {
      alert('Enter a valid website URL (e.g., https://example.com or example.com).');
      return;
    }

    try {
      setSavingIdentity(true);
      let formattedUrl = websiteUrl.trim();
      if (formattedUrl && !formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = `https://${formattedUrl}`;
      }

      const { error } = await supabase
        .from('employers')
        .update({
          company_name: companyName.trim(),
          industry: industry.trim() || null,
          company_size: companySize,
          year_established: yearEstablished ? parseInt(yearEstablished, 10) : null,
          description: description.trim() || null,
          website_url: formattedUrl || null,
        })
        .eq('id', employer.id);

      if (error) throw error;

      await recomputeOnboardingChecklist();
      showToast('Company identity saved.');
      onRefresh();
    } catch (err: any) {
      console.error('Error saving company identity:', err);
      alert('Failed to save company identity: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingIdentity(false);
    }
  };

  // --- LOGO UPLOAD ---
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employer?.id) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Logo image must be smaller than 2MB.');
      return;
    }

    const ext = file.name.split('.').pop() || 'png';
    const filePath = `${employer.id}/logo.${ext}`;

    try {
      setUploadingLogo(true);
      const { error: uploadErr } = await supabase.storage
        .from('employer-assets')
        .upload(filePath, file, {
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadErr) throw uploadErr;

      const { data: publicData } = supabase.storage
        .from('employer-assets')
        .getPublicUrl(filePath);

      const publicUrl = `${publicData.publicUrl}?t=${Date.now()}`;

      const { error: updateErr } = await supabase
        .from('employers')
        .update({ logo_url: publicUrl })
        .eq('id', employer.id);

      if (updateErr) throw updateErr;

      setLogoUrl(publicUrl);
      showToast('Company logo updated successfully.');
      onRefresh();
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      alert('Failed to upload logo: ' + (err.message || 'Unknown error'));
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // --- SAVE SECTION 2: CONTACT DETAILS ---
  const handleSaveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryContactName.trim()) {
      alert('Primary Contact Name is required.');
      return;
    }
    if (!country) {
      alert('Country is required.');
      return;
    }

    try {
      setSavingContact(true);
      const { error } = await supabase
        .from('employers')
        .update({
          primary_contact_name: primaryContactName.trim(),
          primary_contact_phone: primaryContactPhone.trim() || null,
          office_address: officeAddress.trim() || null,
          country: country,
          location: country,
        })
        .eq('id', employer.id);

      if (error) throw error;

      await recomputeOnboardingChecklist();
      showToast('Contact details saved.');
      onRefresh();
    } catch (err: any) {
      console.error('Error saving contact details:', err);
      alert('Failed to save contact details: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingContact(false);
    }
  };

  // --- SAVE SECTION 3: HIRING NEEDS ---
  const handleToggleRole = (roleId: string) => {
    setHealthcareRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId]
    );
  };

  const handleAddSourceCountry = (c: string) => {
    if (!preferredSourceCountries.includes(c)) {
      setPreferredSourceCountries((prev) => [...prev, c]);
    }
    setSourceCountrySearch('');
    setSourceCountryDropdownOpen(false);
  };

  const handleRemoveSourceCountry = (c: string) => {
    setPreferredSourceCountries((prev) => prev.filter((item) => item !== c));
  };

  const handleSaveHiringNeeds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (healthcareRoles.length === 0) {
      alert('Select at least one healthcare role you hire for.');
      return;
    }
    if (!annualHiringVolume) {
      alert('Annual Hiring Volume is required.');
      return;
    }

    try {
      setSavingHiringNeeds(true);
      const { error } = await supabase
        .from('employers')
        .update({
          healthcare_roles_hiring: healthcareRoles,
          preferred_source_countries: preferredSourceCountries,
          annual_hiring_volume: annualHiringVolume,
        })
        .eq('id', employer.id);

      if (error) throw error;

      await recomputeOnboardingChecklist();
      showToast('Hiring needs saved.');
      onRefresh();
    } catch (err: any) {
      console.error('Error saving hiring needs:', err);
      alert('Failed to save hiring needs: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingHiringNeeds(false);
    }
  };

  // --- SECTION 5: INVITE TEAM MEMBER (ADMIN ONLY) ---
  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);

    if (!inviteFirstName.trim() || !inviteLastName.trim() || !inviteEmail.trim()) {
      setInviteError('Provide first name, last name, and a valid email address.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(inviteEmail.trim())) {
      setInviteError('Enter a valid email address.');
      return;
    }

    const formattedEmail = inviteEmail.trim().toLowerCase();

    try {
      setGeneratingInvite(true);

      // 1. Check if email already exists in employer_team_members for this employer
      const { data: existingTeam } = await supabase
        .from('employer_team_members')
        .select('id, invite_status')
        .eq('employer_id', employer.id)
        .eq('email', formattedEmail)
        .maybeSingle();

      if (existingTeam) {
        if (existingTeam.invite_status === 'accepted') {
          setInviteError('A team member with this email is already an active member of your organization.');
        } else {
          setInviteError('An invitation for this email is already pending. You can resend or manage it in the table below.');
        }
        setGeneratingInvite(false);
        return;
      }

      // 2. Check if email is already in profiles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('email', formattedEmail)
        .maybeSingle();

      if (existingProfile) {
        setInviteError('A user account with this email already exists on TerraTern.');
        setGeneratingInvite(false);
        return;
      }

      // 3. Generate token & insert into employer_team_members
      const token = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      const { error: insertErr } = await supabase
        .from('employer_team_members')
        .insert({
          employer_id: employer.id,
          invited_by: profile?.id,
          email: formattedEmail,
          first_name: inviteFirstName.trim(),
          last_name: inviteLastName.trim(),
          role: 'member',
          invite_status: 'pending',
          invite_token: token,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      const inviteUrl = `${window.location.origin}/employer-team-invite?token=${token}`;
      setGeneratedInviteLink({
        name: `${inviteFirstName.trim()} ${inviteLastName.trim()}`,
        url: inviteUrl,
      });

      setInviteFirstName('');
      setInviteLastName('');
      setInviteEmail('');
      showToast('Invite created successfully.');
      fetchTeamMembers();
    } catch (err: any) {
      console.error('Error generating invite:', err);
      setInviteError(err.message || 'Failed to generate invitation link.');
    } finally {
      setGeneratingInvite(false);
    }
  };

  // Resend Invite (Regenerate token)
  const handleResendInvite = async (member: any) => {
    try {
      const newToken = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

      const { error } = await supabase
        .from('employer_team_members')
        .update({
          invite_token: newToken,
          created_at: new Date().toISOString(),
        })
        .eq('id', member.id);

      if (error) throw error;

      const inviteUrl = `${window.location.origin}/employer-team-invite?token=${newToken}`;
      setGeneratedInviteLink({
        name: `${member.first_name} ${member.last_name}`,
        url: inviteUrl,
      });
      showToast('Invite link regenerated.');
      fetchTeamMembers();
    } catch (err: any) {
      console.error('Error resending invite:', err);
      alert('Failed to resend invite: ' + (err.message || 'Unknown error'));
    }
  };

  // Cancel Pending Invite (DELETE)
  const handleCancelInvite = async (memberId: string) => {
    if (!confirm('Are you sure you want to cancel this pending invitation?')) return;
    try {
      const { error } = await supabase
        .from('employer_team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      showToast('Invitation cancelled.');
      fetchTeamMembers();
    } catch (err: any) {
      console.error('Error cancelling invite:', err);
      alert('Failed to cancel invite: ' + (err.message || 'Unknown error'));
    }
  };

  // Promote Member to Admin
  const handleConfirmPromote = async () => {
    if (!promoteModalMember) return;
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('employer_team_members')
        .update({ role: 'admin' })
        .eq('id', promoteModalMember.id);

      if (error) throw error;

      showToast(`${promoteModalMember.first_name} promoted to Admin.`);
      setPromoteModalMember(null);
      fetchTeamMembers();
    } catch (err: any) {
      console.error('Error promoting member:', err);
      alert('Failed to promote member: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Remove Member (Set to deactivated)
  const handleConfirmRemove = async () => {
    if (!removeModalMember) return;
    try {
      setActionLoading(true);
      const { error } = await supabase
        .from('employer_team_members')
        .update({ invite_status: 'deactivated' })
        .eq('id', removeModalMember.id);

      if (error) throw error;

      showToast(`${removeModalMember.first_name} removed from organization.`);
      setRemoveModalMember(null);
      fetchTeamMembers();
    } catch (err: any) {
      console.error('Error removing member:', err);
      alert('Failed to remove member: ' + (err.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const filteredCountries = COMMON_COUNTRIES.filter((c) =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const filteredSourceCountries = COMMON_COUNTRIES.filter(
    (c) =>
      c.toLowerCase().includes(sourceCountrySearch.toLowerCase()) &&
      !preferredSourceCountries.includes(c)
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-[#10B981] text-white px-5 py-3 rounded-[8px] shadow-lg flex items-center space-x-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT SIDEBAR (200px FIXED) */}
        {/* ========================================================= */}
        <aside className="w-full md:w-[200px] flex-shrink-0 bg-white border border-[#E2E8F4] rounded-[10px] p-3 shadow-xs flex flex-col justify-between">
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveSection('identity')}
              className={`w-full text-left px-3.5 py-2.5 rounded-[6px] text-xs font-semibold transition-colors flex items-center justify-between ${
                activeSection === 'identity'
                  ? 'bg-[#1B3270] text-white'
                  : 'text-[#4A5568] hover:bg-[#F8FAFD] hover:text-[#1B3270]'
              }`}
            >
              <span>1. Company Identity</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('contact')}
              className={`w-full text-left px-3.5 py-2.5 rounded-[6px] text-xs font-semibold transition-colors flex items-center justify-between ${
                activeSection === 'contact'
                  ? 'bg-[#1B3270] text-white'
                  : 'text-[#4A5568] hover:bg-[#F8FAFD] hover:text-[#1B3270]'
              }`}
            >
              <span>2. Contact Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('hiring_needs')}
              className={`w-full text-left px-3.5 py-2.5 rounded-[6px] text-xs font-semibold transition-colors flex items-center justify-between ${
                activeSection === 'hiring_needs'
                  ? 'bg-[#1B3270] text-white'
                  : 'text-[#4A5568] hover:bg-[#F8FAFD] hover:text-[#1B3270]'
              }`}
            >
              <span>3. Hiring Needs</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('account')}
              className={`w-full text-left px-3.5 py-2.5 rounded-[6px] text-xs font-semibold transition-colors flex items-center justify-between ${
                activeSection === 'account'
                  ? 'bg-[#1B3270] text-white'
                  : 'text-[#4A5568] hover:bg-[#F8FAFD] hover:text-[#1B3270]'
              }`}
            >
              <span>4. Account</span>
            </button>

            {currentUserRole === 'admin' && (
              <button
                type="button"
                onClick={() => setActiveSection('team')}
                className={`w-full text-left px-3.5 py-2.5 rounded-[6px] text-xs font-semibold transition-colors flex items-center justify-between ${
                  activeSection === 'team'
                    ? 'bg-[#1B3270] text-white'
                    : 'text-[#4A5568] hover:bg-[#F8FAFD] hover:text-[#1B3270]'
                }`}
              >
                <span>5. Team Members</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                    activeSection === 'team'
                      ? 'bg-white/20 text-white'
                      : 'bg-[#1B3270]/10 text-[#1B3270]'
                  }`}
                >
                  Admin
                </span>
              </button>
            )}
          </nav>

          {/* Profile Completeness Bar at bottom of sidebar */}
          <div className="mt-8 pt-4 border-t border-[#E2E8F4]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[#0F172A]">Profile</span>
              <span className="font-bold text-[#1B3270]">{completeness}% complete</span>
            </div>
            <div className="w-full bg-[#E2E8F4] h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  completeness >= 80
                    ? 'bg-[#10B981]'
                    : completeness >= 40
                    ? 'bg-[#F59E0B]'
                    : 'bg-[#EF4444]'
                }`}
                style={{ width: `${completeness}%` }}
              ></div>
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-2 leading-relaxed">
              Complete your profile to accelerate requirements and placements.
            </p>
          </div>
        </aside>

        {/* ========================================================= */}
        {/* RIGHT: ACTIVE SECTION FORM */}
        {/* ========================================================= */}
        <main className="flex-1 w-full bg-white border border-[#E2E8F4] rounded-[10px] p-6 sm:p-8 shadow-xs">
          {/* ========================================================= */}
          {/* SECTION 1: COMPANY IDENTITY */}
          {/* ========================================================= */}
          {activeSection === 'identity' && (
            <form onSubmit={handleSaveIdentity} className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Company Identity</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Basic identifying details about your healthcare facility or hospital group.
                </p>
              </div>

              {/* Company Logo Upload */}
              <div className="p-4 bg-[#F8FAFD] rounded-[8px] border border-[#E2E8F4] flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-5">
                <div className="relative w-20 h-20 rounded-full border-2 border-[#1B3270]/20 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 shadow-xs">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Company Logo"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Building2 className="w-9 h-9 text-[#94A3B8]" />
                  )}
                  {uploadingLogo && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <span className="text-xs font-bold text-[#0F172A] block mb-1">
                    Company Logo
                  </span>
                  <p className="text-[11px] text-[#4A5568] mb-3">
                    Upload a square PNG, JPG, or SVG image (max 2MB).
                  </p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploadingLogo}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center space-x-2 px-3.5 py-1.5 border border-[#1B3270] text-[#1B3270] hover:bg-[#1B3270]/5 rounded-[6px] text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    <Camera size={14} />
                    <span>{logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                  </button>
                </div>
              </div>

              {/* Company Name */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Company Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. St. Elizabeth Hospital Group"
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                />
              </div>

              {/* Industry & Company Size Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Industry <span className="text-[#94A3B8] font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder='e.g. "Healthcare", "Hospital Group", "Care Home Provider"'
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Company Size <span className="text-[#EF4444]">*</span>
                  </label>
                  <select
                    required
                    value={companySize}
                    onChange={(e) => setCompanySize(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                  >
                    <option value="">Select company size...</option>
                    {COMPANY_SIZE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Year Established & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Year Established <span className="text-[#94A3B8] font-normal">(optional)</span>
                  </label>
                  <input
                    type="number"
                    min="1800"
                    max={new Date().getFullYear()}
                    value={yearEstablished}
                    onChange={(e) => setYearEstablished(e.target.value)}
                    placeholder="e.g. 1998"
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Website URL <span className="text-[#94A3B8] font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-3" />
                    <input
                      type="text"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://www.example.com"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                    />
                  </div>
                </div>
              </div>

              {/* About / Description */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[#0F172A]">
                    About / Description
                  </label>
                  <span
                    className={`text-[11px] ${
                      description.length > 500 ? 'text-[#EF4444] font-bold' : 'text-[#94A3B8]'
                    }`}
                  >
                    {description.length} / 500 characters
                  </span>
                </div>
                <textarea
                  rows={4}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your organisation, the types of roles you hire for, and your work environment."
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A] resize-none"
                />
              </div>

              {/* Save Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingIdentity}
                  className="px-6 py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-xs flex items-center space-x-2 disabled:opacity-50"
                >
                  {savingIdentity && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Company Identity</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* SECTION 2: CONTACT DETAILS */}
          {/* ========================================================= */}
          {activeSection === 'contact' && (
            <form onSubmit={handleSaveContact} className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Contact Details</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Direct contact information for staffing inquiries and candidate coordination.
                </p>
              </div>

              {/* Primary Contact Name */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Primary Contact Name <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={primaryContactName}
                  onChange={(e) => setPrimaryContactName(e.target.value)}
                  placeholder="e.g. Dr. Thomas Müller"
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                />
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Primary Contact Email <span className="text-[#94A3B8] font-normal">(read-only)</span>
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-3" />
                    <input
                      type="email"
                      readOnly
                      value={profile?.email || employer?.primary_contact_email || ''}
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-[#F8FAFD] border border-[#CBD5E1] rounded-[6px] text-[#4A5568] cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-1">
                    Synced with your authenticated account profile.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Primary Contact Phone <span className="text-[#94A3B8] font-normal">(optional)</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-3" />
                    <input
                      type="text"
                      value={primaryContactPhone}
                      onChange={(e) => setPrimaryContactPhone(e.target.value)}
                      placeholder="+49 151 23456789"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                    />
                  </div>
                </div>
              </div>

              {/* Office Address */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Office Address <span className="text-[#94A3B8] font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <MapPin className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-3" />
                  <textarea
                    rows={3}
                    value={officeAddress}
                    onChange={(e) => setOfficeAddress(e.target.value)}
                    placeholder="Street name & number, City, Postal code"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A] resize-none"
                  />
                </div>
              </div>

              {/* Country (Searchable Dropdown) */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Country <span className="text-[#EF4444]">*</span>
                </label>
                <div className="relative">
                  <div
                    onClick={() => setCountryDropdownOpen(!countryDropdownOpen)}
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] flex items-center justify-between cursor-pointer focus:border-[#1B3270]"
                  >
                    <span className={country ? 'text-[#0F172A]' : 'text-[#94A3B8]'}>
                      {country || 'Select Country...'}
                    </span>
                    <ChevronDown size={14} className="text-[#94A3B8]" />
                  </div>

                  {countryDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#CBD5E1] rounded-[6px] shadow-lg z-30 max-h-56 overflow-y-auto">
                      <div className="p-2 border-b border-[#E2E8F4] sticky top-0 bg-white">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder="Search countries..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded focus:outline-none focus:border-[#1B3270]"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="py-1">
                        {filteredCountries.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-[#94A3B8]">No countries found</div>
                        ) : (
                          filteredCountries.map((c) => (
                            <div
                              key={c}
                              onClick={() => {
                                setCountry(c);
                                setCountryDropdownOpen(false);
                                setCountrySearch('');
                              }}
                              className={`px-3.5 py-2 text-xs cursor-pointer hover:bg-[#F8FAFD] flex items-center justify-between ${
                                country === c ? 'bg-[#1B3270]/10 font-bold text-[#1B3270]' : 'text-[#4A5568]'
                              }`}
                            >
                              <span>{c}</span>
                              {country === c && <Check size={14} className="text-[#1B3270]" />}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingContact}
                  className="px-6 py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-xs flex items-center space-x-2 disabled:opacity-50"
                >
                  {savingContact && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Contact Details</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* SECTION 3: HIRING NEEDS */}
          {/* ========================================================= */}
          {activeSection === 'hiring_needs' && (
            <form onSubmit={handleSaveHiringNeeds} className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Hiring Needs</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Configure your recruitment preferences to receive best-fit candidate recommendations.
                </p>
              </div>

              {/* Healthcare Roles Checkboxes */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-2">
                  Healthcare Roles You Hire For <span className="text-[#EF4444]">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {HEALTHCARE_ROLES.map((role) => {
                    const isChecked = healthcareRoles.includes(role.id);
                    return (
                      <label
                        key={role.id}
                        className={`flex items-center space-x-3 p-3 rounded-[6px] border cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-[#1B3270]/5 border-[#1B3270] text-[#1B3270] font-semibold'
                            : 'bg-white border-[#CBD5E1] text-[#4A5568] hover:bg-[#F8FAFD]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRole(role.id)}
                          className="w-4 h-4 rounded text-[#1B3270] focus:ring-[#1B3270] border-gray-300"
                        />
                        <span className="text-xs">{role.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Preferred Source Countries (Multi-select searchable dropdown) */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Preferred Source Countries <span className="text-[#94A3B8] font-normal">(optional)</span>
                </label>
                <p className="text-[11px] text-[#4A5568] mb-2">
                  Countries from which you prefer to source international medical candidates.
                </p>

                {/* Selected Pills */}
                {preferredSourceCountries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {preferredSourceCountries.map((c) => (
                      <span
                        key={c}
                        className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#1B3270]/10 text-[#1B3270]"
                      >
                        <span>{c}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSourceCountry(c)}
                          className="hover:text-[#EF4444] transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <div
                    onClick={() => setSourceCountryDropdownOpen(!sourceCountryDropdownOpen)}
                    className="w-full px-3.5 py-2 text-xs bg-white border border-[#CBD5E1] rounded-[6px] flex items-center justify-between cursor-pointer focus:border-[#1B3270]"
                  >
                    <span className="text-[#94A3B8]">Add a preferred source country...</span>
                    <ChevronDown size={14} className="text-[#94A3B8]" />
                  </div>

                  {sourceCountryDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#CBD5E1] rounded-[6px] shadow-lg z-30 max-h-56 overflow-y-auto">
                      <div className="p-2 border-b border-[#E2E8F4] sticky top-0 bg-white">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            value={sourceCountrySearch}
                            onChange={(e) => setSourceCountrySearch(e.target.value)}
                            placeholder="Search countries to add..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#E2E8F4] rounded focus:outline-none focus:border-[#1B3270]"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div className="py-1">
                        {filteredSourceCountries.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-[#94A3B8]">
                            No additional countries found
                          </div>
                        ) : (
                          filteredSourceCountries.map((c) => (
                            <div
                              key={c}
                              onClick={() => handleAddSourceCountry(c)}
                              className="px-3.5 py-2 text-xs cursor-pointer hover:bg-[#F8FAFD] text-[#4A5568] flex items-center justify-between"
                            >
                              <span>{c}</span>
                              <Plus size={14} className="text-[#94A3B8]" />
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Annual Hiring Volume */}
              <div>
                <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                  Annual Hiring Volume <span className="text-[#EF4444]">*</span>
                </label>
                <select
                  required
                  value={annualHiringVolume}
                  onChange={(e) => setAnnualHiringVolume(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                >
                  <option value="">Select annual hiring volume...</option>
                  {ANNUAL_HIRING_VOLUME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Save Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingHiringNeeds}
                  className="px-6 py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-xs flex items-center space-x-2 disabled:opacity-50"
                >
                  {savingHiringNeeds && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Hiring Needs</span>
                </button>
              </div>
            </form>
          )}

          {/* ========================================================= */}
          {/* SECTION 4: ACCOUNT (READ-ONLY) */}
          {/* ========================================================= */}
          {activeSection === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Account & Subscription</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Subscription plan details and your dedicated TerraTern Account Manager.
                </p>
              </div>

              {/* SUBSCRIPTION TIER CARD */}
              <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider block">
                      Subscription Plan
                    </span>
                    <h3 className="text-base font-bold text-[#0F172A] mt-0.5">
                      Your current tier: {employer?.subscription_tier || 'Standard'}
                    </h3>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#1B3270]/10 text-[#1B3270] uppercase tracking-wider self-start sm:self-auto">
                    {employer?.subscription_tier || 'Standard'} Tier
                  </span>
                </div>

                <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-3.5 flex items-start space-x-3">
                  <Info className="w-4 h-4 text-[#1B3270] flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-[#4A5568] leading-relaxed">
                    Subscription details and volume commitments are managed directly by the TerraTern team.
                    Contact your dedicated account manager for upgrades, adjustments, or additional service allocations.
                  </p>
                </div>
              </div>

              {/* ASSIGNED ACCOUNT MANAGER CARD */}
              {loadingRm ? (
                <div className="py-8 flex justify-center">
                  <Loader2 className="w-6 h-6 text-[#1B3270] animate-spin" />
                </div>
              ) : assignedRm?.profiles ? (
                /* Assigned RM Card: White card, green left border */
                <div className="bg-white border border-[#E2E8F4] border-l-4 border-l-[#10B981] rounded-[10px] p-6 shadow-xs">
                  <div className="flex items-center space-x-2 text-[#10B981] mb-2">
                    <UserCheck size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Your Account Manager
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-[#0F172A]">
                    {assignedRm.profiles.first_name} {assignedRm.profiles.last_name}
                  </h4>
                  <div className="flex items-center space-x-2 text-xs text-[#4A5568] mt-1 mb-3">
                    <Mail size={13} className="text-[#94A3B8]" />
                    <a
                      href={`mailto:${assignedRm.profiles.email}`}
                      className="text-[#1B3270] hover:underline"
                    >
                      {assignedRm.profiles.email}
                    </a>
                  </div>
                  <p className="text-xs text-[#4A5568] leading-relaxed pt-2 border-t border-[#F1F5F9]">
                    Your dedicated account manager coordinates your candidate pipeline, organizes interviews, and handles placement compliance.
                  </p>
                </div>
              ) : (
                /* Unassigned RM Card: Amber card */
                <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[10px] p-6 shadow-xs">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-[#D97706] flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-[#92400E]">
                        Account manager not yet assigned
                      </h4>
                      <p className="text-xs text-[#B45309] mt-1 leading-relaxed">
                        The TerraTern team will assign a dedicated relationship manager shortly. You will receive an in-app notification and email confirmation once assigned.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 5: TEAM MEMBERS */}
          {/* ========================================================= */}
          {activeSection === 'team' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-lg font-bold text-[#0F172A]">Team Members</h2>
                <p className="text-xs text-[#4A5568] mt-0.5">
                  Manage colleague access to your employer portal, job requirements, and candidate applications.
                </p>
              </div>

              {/* ADMIN ONLY: INVITE FORM */}
              {currentUserRole === 'admin' && (
                <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[10px] p-5 shadow-xs">
                  <h3 className="text-xs font-bold text-[#1B3270] uppercase tracking-wider mb-3 flex items-center space-x-2">
                    <UserPlus size={15} />
                    <span>Invite Team Member</span>
                  </h3>

                  <form onSubmit={handleGenerateInvite} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">
                          First Name <span className="text-[#EF4444]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={inviteFirstName}
                          onChange={(e) => setInviteFirstName(e.target.value)}
                          placeholder="e.g. Maria"
                          className="w-full px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">
                          Last Name <span className="text-[#EF4444]">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={inviteLastName}
                          onChange={(e) => setInviteLastName(e.target.value)}
                          placeholder="e.g. Schmidt"
                          className="w-full px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">
                          Email Address <span className="text-[#EF4444]">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="e.g. maria@hospital.de"
                          className="w-full px-3 py-2 text-xs bg-white border border-[#CBD5E1] rounded-[6px] focus:outline-none focus:border-[#1B3270] text-[#0F172A]"
                        />
                      </div>
                    </div>

                    {inviteError && (
                      <p className="text-xs text-[#EF4444] font-medium">{inviteError}</p>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={generatingInvite}
                        className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-xs flex items-center space-x-2 disabled:opacity-50"
                      >
                        {generatingInvite && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Generate Invite Link</span>
                      </button>
                    </div>
                  </form>

                  {/* Generated Invite Link Card */}
                  {generatedInviteLink && (
                    <div className="mt-4 p-4 bg-white border border-[#10B981] rounded-[8px] animate-in fade-in">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-[#10B981]">
                          Invite created for {generatedInviteLink.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(generatedInviteLink.url)}
                          className="inline-flex items-center space-x-1 text-xs font-semibold text-[#1B3270] hover:text-[#2952A3]"
                        >
                          {copiedLink ? <Check size={14} className="text-[#10B981]" /> : <Copy size={14} />}
                          <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                        </button>
                      </div>
                      <div className="p-2.5 bg-[#F8FAFD] rounded border border-[#E2E8F4] font-mono text-[11px] text-[#4A5568] break-all select-all">
                        {generatedInviteLink.url}
                      </div>
                      <p className="text-[11px] text-[#94A3B8] mt-1.5">
                        Share this unique link with your colleague to let them configure their password and access your employer portal.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TEAM MEMBERS TABLE */}
              <div>
                <h3 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-3">
                  Organization Members ({teamMembers.length})
                </h3>

                {loadingTeam ? (
                  <div className="py-8 flex justify-center">
                    <Loader2 className="w-6 h-6 text-[#1B3270] animate-spin" />
                  </div>
                ) : teamMembers.length === 0 ? (
                  <div className="p-8 text-center bg-[#F8FAFD] rounded-[8px] border border-dashed border-[#CBD5E1]">
                    <Users className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
                    <p className="text-xs font-medium text-[#4A5568]">No team members registered yet.</p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      Invite your colleagues to collaborate on hiring and candidate reviews.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-[#E2E8F4] rounded-[8px]">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#F8FAFD] border-b border-[#E2E8F4] text-[#4A5568] font-semibold">
                        <tr>
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Joined / Invited</th>
                          {currentUserRole === 'admin' && <th className="py-3 px-4 text-right">Actions</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F4] text-[#0F172A]">
                        {teamMembers.map((member) => {
                          const isMe = member.profile_id === profile?.id;
                          return (
                            <tr key={member.id} className="hover:bg-[#F8FAFD]/60">
                              <td className="py-3.5 px-4 font-medium">
                                <div>
                                  <span className="text-[#0F172A]">
                                    {member.first_name} {member.last_name}
                                  </span>
                                  {isMe && (
                                    <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#1B3270]/10 text-[#1B3270]">
                                      You
                                    </span>
                                  )}
                                  <div className="text-[11px] text-[#94A3B8]">{member.email}</div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                                    member.role === 'admin'
                                      ? 'bg-[#1B3270]/10 text-[#1B3270]'
                                      : 'bg-gray-100 text-[#4A5568]'
                                  }`}
                                >
                                  {member.role}
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                                    member.invite_status === 'accepted'
                                      ? 'bg-[#10B981]/15 text-[#10B981]'
                                      : member.invite_status === 'pending'
                                      ? 'bg-[#F59E0B]/15 text-[#F59E0B]'
                                      : 'bg-[#EF4444]/15 text-[#EF4444]'
                                  }`}
                                >
                                  {member.invite_status}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-[#4A5568]">
                                {formatDate(member.created_at)}
                              </td>

                              {currentUserRole === 'admin' && (
                                <td className="py-3.5 px-4 text-right">
                                  {isMe ? (
                                    <span className="text-[11px] text-[#94A3B8] italic">No actions</span>
                                  ) : member.invite_status === 'accepted' ? (
                                    <div className="flex items-center justify-end space-x-2">
                                      {member.role !== 'admin' && (
                                        <button
                                          type="button"
                                          onClick={() => setPromoteModalMember(member)}
                                          className="text-[11px] font-semibold text-[#1B3270] hover:text-[#2952A3]"
                                        >
                                          Promote to Admin
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => setRemoveModalMember(member)}
                                        className="text-[11px] font-semibold text-[#EF4444] hover:text-[#DC2626]"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ) : member.invite_status === 'pending' ? (
                                    <div className="flex items-center justify-end space-x-2">
                                      <button
                                        type="button"
                                        onClick={() => handleResendInvite(member)}
                                        className="text-[11px] font-semibold text-[#1B3270] hover:text-[#2952A3]"
                                      >
                                        Resend
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleCancelInvite(member.id)}
                                        className="text-[11px] font-semibold text-[#EF4444] hover:text-[#DC2626]"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-[#94A3B8]">Deactivated</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ========================================================= */}
      {/* CONFIRM PROMOTE TO ADMIN MODAL */}
      {/* ========================================================= */}
      {promoteModalMember && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] max-w-sm w-full p-6 shadow-xl animate-in fade-in">
            <h3 className="text-base font-bold text-[#0F172A]">Promote to Admin?</h3>
            <p className="text-xs text-[#4A5568] mt-2 leading-relaxed">
              Are you sure you want to promote <strong>{promoteModalMember.first_name} {promoteModalMember.last_name}</strong> to Admin? They will have full authority to invite colleagues, promote users, and update company settings.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setPromoteModalMember(null)}
                className="px-4 py-2 border border-[#CBD5E1] text-[#4A5568] rounded-[6px] text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmPromote}
                className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold transition-colors flex items-center space-x-1"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Promote</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* CONFIRM REMOVE MEMBER MODAL */}
      {/* ========================================================= */}
      {removeModalMember && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-[10px] max-w-sm w-full p-6 shadow-xl animate-in fade-in">
            <h3 className="text-base font-bold text-[#0F172A]">Remove Team Member?</h3>
            <p className="text-xs text-[#4A5568] mt-2 leading-relaxed">
              Are you sure you want to remove <strong>{removeModalMember.first_name} {removeModalMember.last_name}</strong> from your employer team? They will immediately lose access to this dashboard and requirement pipelines.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setRemoveModalMember(null)}
                className="px-4 py-2 border border-[#CBD5E1] text-[#4A5568] rounded-[6px] text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRemove}
                className="px-4 py-2 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-[6px] text-xs font-semibold transition-colors flex items-center space-x-1"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Remove Member</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
