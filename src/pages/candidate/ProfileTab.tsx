import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  GraduationCap,
  ClipboardList,
  Briefcase,
  Languages,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { DocumentUploadCard } from '../../components/candidate/DocumentUploadCard';
import {
  calculateProfileCompletion,
  ProfileSectionStatus,
} from '../../utils/documentTypes';

interface ProfileTabProps {
  candidate: any;
  onRefreshCandidate?: () => void;
}

type SectionKey = 'personal' | 'education' | 'professional' | 'experience' | 'language';

export const ProfileTab: React.FC<ProfileTabProps> = ({
  candidate,
  onRefreshCandidate,
}) => {
  const { user, profile } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionKey>('personal');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // CV Parser state
  const [parsingCv, setParsingCv] = useState(false);
  const [latestCvParse, setLatestCvParse] = useState<any>(null);
  const [cvParseError, setCvParseError] = useState<string | null>(null);
  const cvInputRef = useRef<HTMLInputElement | null>(null);

  // Profile Section Data states
  const [personalInfo, setPersonalInfo] = useState<any>({
    full_name: '',
    date_of_birth: '',
    gender: 'Female',
    nationality: candidate?.nationality || '',
    country_of_residence: 'India',
    city_state: '',
    mobile_number: '',
    country_code: '+91',
    whatsapp_same_as_mobile: true,
    whatsapp_number: '',
    email_address: profile?.email || user?.email || '',
    passport_number: '',
    passport_expiry_date: '',
  });

  const [education, setEducation] = useState<any>({
    healthcare_profession: candidate?.target_role || 'Nursing (General)',
    specialization: '',
    degree_title: 'B.Sc. Nursing',
    college_university: '',
    year_of_completion: new Date().getFullYear() - 2,
    board_10th: '',
    year_10th: new Date().getFullYear() - 8,
    board_12th: '',
    year_12th: new Date().getFullYear() - 6,
    internship_completed: true,
    internship_institution: '',
  });

  const [professionalReg, setProfessionalReg] = useState<any>({
    registration_council: '',
    registration_number: '',
    registration_issue_date: '',
    registration_valid_until: '',
    state_council_registration: '',
    additional_professional_license: '',
  });

  const [totalYearsExperience, setTotalYearsExperience] = useState<number | string>(
    candidate?.total_years_experience || 2
  );

  const [workEntries, setWorkEntries] = useState<any[]>([
    {
      id: undefined,
      is_current_employer: true,
      employer_name: '',
      job_title: 'Staff Nurse',
      department_ward: 'Intensive Care Unit (ICU)',
      start_date: '',
      end_date: '',
      notice_period: '30 days',
      entry_order: 1,
    },
  ]);

  const [languageProficiency, setLanguageProficiency] = useState<any>({
    current_german_level: candidate?.language_level_self_reported || 'B1',
    b1_certificate_obtained: false,
    b1_certificate_date: '',
    b2_certificate_obtained: false,
    b2_certificate_date: '',
    enrolled_in_german_course: false,
    training_institute_name: '',
  });

  // Uploaded documents map
  const [documentsMap, setDocumentsMap] = useState<Record<string, any>>({});
  const [experienceCerts, setExperienceCerts] = useState<any[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Fetch all profile data from Supabase
  const loadProfileData = async () => {
    if (!candidate?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Personal info
      const { data: pData } = await supabase
        .from('candidate_personal_info')
        .select('*')
        .eq('candidate_id', candidate.id)
        .maybeSingle();

      if (pData) {
        setPersonalInfo({
          ...pData,
          email_address: profile?.email || user?.email || pData.email_address,
          country_code: pData.mobile_number?.startsWith('+')
            ? pData.mobile_number.split(' ')[0]
            : '+91',
          mobile_number: pData.mobile_number?.startsWith('+')
            ? pData.mobile_number.split(' ').slice(1).join(' ')
            : pData.mobile_number || '',
        });
      } else {
        setPersonalInfo((prev: any) => ({
          ...prev,
          full_name: `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim(),
          nationality: candidate.nationality || prev.nationality,
          email_address: profile?.email || user?.email || '',
        }));
      }

      // 2. Education
      const { data: eData } = await supabase
        .from('candidate_education')
        .select('*')
        .eq('candidate_id', candidate.id)
        .maybeSingle();

      if (eData) {
        setEducation(eData);
      }

      // 3. Professional Registration
      const { data: prData } = await supabase
        .from('candidate_professional_registration')
        .select('*')
        .eq('candidate_id', candidate.id)
        .maybeSingle();

      if (prData) {
        setProfessionalReg(prData);
      }

      // 4. Work Experience
      const { data: weData } = await supabase
        .from('candidate_work_experience')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('entry_order', { ascending: true });

      if (weData && weData.length > 0) {
        setWorkEntries(weData);
        if (weData[0]?.total_years_experience !== null && weData[0]?.total_years_experience !== undefined) {
          setTotalYearsExperience(weData[0].total_years_experience);
        }
      }

      // 5. Language Proficiency
      const { data: lpData } = await supabase
        .from('candidate_language_proficiency')
        .select('*')
        .eq('candidate_id', candidate.id)
        .maybeSingle();

      if (lpData) {
        setLanguageProficiency(lpData);
      }

      // 6. Documents
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('candidate_id', candidate.id);

      const dMap: Record<string, any> = {};
      const expList: any[] = [];
      (docs || []).forEach((d) => {
        if (d.document_type === 'experience_certificate') {
          expList.push(d);
        } else {
          dMap[d.document_type] = d;
        }
      });
      setDocumentsMap(dMap);
      setExperienceCerts(expList);

      // 7. Latest CV parse
      const { data: cvParses } = await supabase
        .from('candidate_cv_parses')
        .select('*')
        .eq('candidate_id', candidate.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (cvParses && cvParses.length > 0) {
        setLatestCvParse(cvParses[0]);
      }
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [candidate?.id]);

  // Dynamic profile completion stats
  const completionStats: ProfileSectionStatus = calculateProfileCompletion({
    personalInfo,
    education,
    professionalReg,
    workExperience: workEntries,
    totalYearsExperience,
    languageProficiency,
  });

  // Recalculate and persist profile_completion_pct in candidates table
  const syncProfileCompletionPct = async (updatedPct: number) => {
    if (!candidate?.id) return;
    try {
      await supabase
        .from('candidates')
        .update({
          profile_completion_pct: updatedPct,
          total_years_experience: Number(totalYearsExperience) || 0,
        })
        .eq('id', candidate.id);
      if (onRefreshCandidate) {
        onRefreshCandidate();
      }
    } catch (err) {
      console.error('Error syncing profile completion percentage:', err);
    }
  };

  // CV Upload & Parse Handler
  const handleCvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !candidate?.id) return;

    try {
      setParsingCv(true);
      setCvParseError(null);

      // 1. Upload to candidate-cvs bucket
      const fileExt = file.name.split('.').pop() || 'pdf';
      const storagePath = `${candidate.id}/cv_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('candidate-cvs')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      // 2. Insert candidate_cv_parses row
      const { data: parseRow, error: insertErr } = await supabase
        .from('candidate_cv_parses')
        .insert({
          candidate_id: candidate.id,
          cv_file_url: uploadData.path,
          status: 'processing',
          applied: false,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      setLatestCvParse(parseRow);

      // 3. Call Edge Function: parse-cv
      try {
        const { error: fnErr } = await supabase.functions.invoke(
          'parse-cv',
          {
            body: {
              cv_file_url: uploadData.path,
              candidate_id: candidate.id,
            },
          }
        );

        if (fnErr) throw fnErr;
      } catch (fnErr) {
        console.warn('Edge function invoke fallback:', fnErr);
      }

      // Re-fetch latest parse record
      const { data: refreshedParse } = await supabase
        .from('candidate_cv_parses')
        .select('*')
        .eq('id', parseRow.id)
        .single();

      setLatestCvParse(refreshedParse);

      // If parsing completed, notify
      if (refreshedParse?.status === 'completed') {
        showToast('CV parsed successfully! Review and apply details below.');
      } else {
        showToast('CV uploaded. Fill in any missing details manually.');
      }
    } catch (err: any) {
      console.error('CV upload/parse error:', err);
      setCvParseError(
        err.message || 'Could not parse CV automatically. Fill in details manually.'
      );
    } finally {
      setParsingCv(false);
      if (cvInputRef.current) cvInputRef.current.value = '';
    }
  };

  // Apply parsed CV data to form state
  const handleApplyCvData = async (targetSection?: SectionKey) => {
    if (!latestCvParse?.parsed_data) return;
    const p = latestCvParse.parsed_data;

    // 1. Personal Info
    if (p.full_name) {
      setPersonalInfo((prev: any) => ({
        ...prev,
        full_name: p.full_name || prev.full_name,
        date_of_birth: p.date_of_birth || prev.date_of_birth,
        gender: p.gender || prev.gender,
        nationality: p.nationality || prev.nationality,
        country_of_residence: p.country_of_residence || prev.country_of_residence,
        city_state: p.city_state || prev.city_state,
        mobile_number: p.mobile || prev.mobile_number,
      }));
    }

    // 2. Education
    if (p.degree_title || p.healthcare_profession) {
      setEducation((prev: any) => ({
        ...prev,
        healthcare_profession: p.healthcare_profession || prev.healthcare_profession,
        specialization: p.specialization || prev.specialization,
        degree_title: p.degree_title || prev.degree_title,
        college_university: p.college_university || prev.college_university,
        year_of_completion: p.year_of_completion || prev.year_of_completion,
      }));
    }

    // 3. Professional Registration
    if (p.registration_number || p.registration_council) {
      setProfessionalReg((prev: any) => ({
        ...prev,
        registration_council: p.registration_council || prev.registration_council,
        registration_number: p.registration_number || prev.registration_number,
      }));
    }

    // 4. Work Experience
    if (Array.isArray(p.work_experience) && p.work_experience.length > 0) {
      const mapped = p.work_experience.map((w: any, idx: number) => ({
        id: undefined,
        is_current_employer: Boolean(w.is_current_employer),
        employer_name: w.employer_name || '',
        job_title: w.job_title || 'Staff Nurse',
        department_ward: w.department_ward || 'General Ward',
        start_date: w.start_date || '',
        end_date: w.end_date || '',
        notice_period: '30 days',
        entry_order: idx + 1,
      }));
      setWorkEntries(mapped);
    }

    // 5. Language
    if (p.current_german_level) {
      setLanguageProficiency((prev: any) => ({
        ...prev,
        current_german_level: p.current_german_level || prev.current_german_level,
        b1_certificate_obtained: Boolean(p.b1_obtained),
        b2_certificate_obtained: Boolean(p.b2_obtained),
      }));
    }

    // Mark parse as applied in database
    if (latestCvParse.id) {
      await supabase
        .from('candidate_cv_parses')
        .update({ applied: true })
        .eq('id', latestCvParse.id);
      setLatestCvParse((prev: any) => ({ ...prev, applied: true }));
    }

    showToast('Extracted details applied to profile. Review and save each section.');
    if (targetSection) {
      setActiveSection(targetSection);
    }
  };

  // Section 1: Save Personal Info
  const handleSavePersonalInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate?.id) return;

    // Validate mandatory
    const formattedMobile = `${personalInfo.country_code} ${personalInfo.mobile_number}`.trim();
    if (
      !personalInfo.full_name ||
      !personalInfo.date_of_birth ||
      !personalInfo.gender ||
      !personalInfo.nationality ||
      !personalInfo.country_of_residence ||
      !personalInfo.city_state ||
      !personalInfo.mobile_number ||
      !personalInfo.passport_number ||
      !personalInfo.passport_expiry_date
    ) {
      alert('Fill all mandatory fields in Personal Information.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        candidate_id: candidate.id,
        full_name: personalInfo.full_name,
        date_of_birth: personalInfo.date_of_birth,
        gender: personalInfo.gender,
        nationality: personalInfo.nationality,
        country_of_residence: personalInfo.country_of_residence,
        city_state: personalInfo.city_state,
        mobile_number: formattedMobile,
        whatsapp_same_as_mobile: personalInfo.whatsapp_same_as_mobile,
        whatsapp_number: personalInfo.whatsapp_same_as_mobile
          ? null
          : personalInfo.whatsapp_number,
        email_address: personalInfo.email_address,
        passport_number: personalInfo.passport_number,
        passport_expiry_date: personalInfo.passport_expiry_date,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('candidate_personal_info')
        .upsert(payload, { onConflict: 'candidate_id' });

      if (error) throw error;

      // Sync name back to candidates record if needed
      const nameParts = personalInfo.full_name.split(' ');
      const fName = nameParts[0] || candidate.first_name;
      const lName = nameParts.slice(1).join(' ') || candidate.last_name;
      await supabase
        .from('candidates')
        .update({
          first_name: fName,
          last_name: lName,
          nationality: personalInfo.nationality,
        })
        .eq('id', candidate.id);

      const newStats = calculateProfileCompletion({
        personalInfo: payload,
        education,
        professionalReg,
        workExperience: workEntries,
        totalYearsExperience,
        languageProficiency,
      });

      await syncProfileCompletionPct(newStats.pct);
      showToast('Personal information saved.');
    } catch (err: any) {
      console.error('Error saving personal info:', err);
      alert(err.message || 'Failed to save personal information.');
    } finally {
      setSaving(false);
    }
  };

  // Section 2: Save Education
  const handleSaveEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate?.id) return;

    if (
      !education.healthcare_profession ||
      !education.specialization ||
      !education.degree_title ||
      !education.college_university ||
      !education.year_of_completion ||
      !education.board_10th ||
      !education.board_12th
    ) {
      alert('Fill all mandatory fields in Education & Qualification.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        candidate_id: candidate.id,
        healthcare_profession: education.healthcare_profession,
        specialization: education.specialization,
        degree_title: education.degree_title,
        college_university: education.college_university,
        year_of_completion: Number(education.year_of_completion),
        board_10th: education.board_10th,
        year_10th: Number(education.year_10th) || null,
        board_12th: education.board_12th,
        year_12th: Number(education.year_12th) || null,
        internship_completed: Boolean(education.internship_completed),
        internship_institution: education.internship_completed
          ? education.internship_institution
          : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('candidate_education')
        .upsert(payload, { onConflict: 'candidate_id' });

      if (error) throw error;

      // Update target_role on candidate record
      await supabase
        .from('candidates')
        .update({ target_role: education.healthcare_profession })
        .eq('id', candidate.id);

      const newStats = calculateProfileCompletion({
        personalInfo,
        education: payload,
        professionalReg,
        workExperience: workEntries,
        totalYearsExperience,
        languageProficiency,
      });

      await syncProfileCompletionPct(newStats.pct);
      showToast('Education details saved.');
    } catch (err: any) {
      console.error('Error saving education:', err);
      alert(err.message || 'Failed to save education details.');
    } finally {
      setSaving(false);
    }
  };

  // Section 3: Save Professional Registration
  const handleSaveProfessionalReg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate?.id) return;

    if (
      !professionalReg.registration_council ||
      !professionalReg.registration_number ||
      !professionalReg.registration_issue_date ||
      !professionalReg.registration_valid_until
    ) {
      alert('Fill all mandatory fields in Professional Registration.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        candidate_id: candidate.id,
        registration_council: professionalReg.registration_council,
        registration_number: professionalReg.registration_number,
        registration_issue_date: professionalReg.registration_issue_date,
        registration_valid_until: professionalReg.registration_valid_until,
        state_council_registration: professionalReg.state_council_registration || null,
        additional_professional_license: professionalReg.additional_professional_license || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('candidate_professional_registration')
        .upsert(payload, { onConflict: 'candidate_id' });

      if (error) throw error;

      const newStats = calculateProfileCompletion({
        personalInfo,
        education,
        professionalReg: payload,
        workExperience: workEntries,
        totalYearsExperience,
        languageProficiency,
      });

      await syncProfileCompletionPct(newStats.pct);
      showToast('Registration details saved.');
    } catch (err: any) {
      console.error('Error saving registration:', err);
      alert(err.message || 'Failed to save registration details.');
    } finally {
      setSaving(false);
    }
  };

  // Section 4: Save Work Experience
  const handleSaveWorkExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate?.id) return;

    if (workEntries.length === 0) {
      alert('Add at least one work experience entry.');
      return;
    }

    for (const [idx, w] of workEntries.entries()) {
      if (!w.employer_name || !w.job_title || !w.department_ward || !w.start_date) {
        alert(`Complete mandatory fields for entry #${idx + 1}.`);
        return;
      }
      if (!w.is_current_employer && !w.end_date) {
        alert(`Provide an end date for past employer #${idx + 1}.`);
        return;
      }
    }

    try {
      setSaving(true);

      // 1. Update candidate total_years_experience
      const numYears = Number(totalYearsExperience) || 0;
      await supabase
        .from('candidates')
        .update({ total_years_experience: numYears })
        .eq('id', candidate.id);

      // 2. Sync entries: delete old entries and re-insert or update
      await supabase
        .from('candidate_work_experience')
        .delete()
        .eq('candidate_id', candidate.id);

      const rowsToInsert = workEntries.map((w, idx) => ({
        candidate_id: candidate.id,
        total_years_experience: numYears,
        is_current_employer: Boolean(w.is_current_employer),
        employer_name: w.employer_name,
        job_title: w.job_title,
        department_ward: w.department_ward,
        start_date: w.start_date,
        end_date: w.is_current_employer ? null : w.end_date || null,
        notice_period: w.is_current_employer ? w.notice_period : null,
        entry_order: idx + 1,
      }));

      const { data: inserted, error } = await supabase
        .from('candidate_work_experience')
        .insert(rowsToInsert)
        .select();

      if (error) throw error;
      setWorkEntries(inserted || []);

      const newStats = calculateProfileCompletion({
        personalInfo,
        education,
        professionalReg,
        workExperience: rowsToInsert,
        totalYearsExperience: numYears,
        languageProficiency,
      });

      await syncProfileCompletionPct(newStats.pct);
      showToast('Work experience saved.');
    } catch (err: any) {
      console.error('Error saving work experience:', err);
      alert(err.message || 'Failed to save work experience.');
    } finally {
      setSaving(false);
    }
  };

  // Section 5: Save German Language Proficiency
  const handleSaveLanguageProficiency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate?.id) return;

    if (!languageProficiency.current_german_level) {
      alert('Select your current German language level.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        candidate_id: candidate.id,
        current_german_level: languageProficiency.current_german_level,
        b1_certificate_obtained: Boolean(languageProficiency.b1_certificate_obtained),
        b1_certificate_date: languageProficiency.b1_certificate_obtained
          ? languageProficiency.b1_certificate_date || null
          : null,
        b2_certificate_obtained: Boolean(languageProficiency.b2_certificate_obtained),
        b2_certificate_date: languageProficiency.b2_certificate_obtained
          ? languageProficiency.b2_certificate_date || null
          : null,
        enrolled_in_german_course: Boolean(languageProficiency.enrolled_in_german_course),
        training_institute_name: languageProficiency.enrolled_in_german_course
          ? languageProficiency.training_institute_name
          : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('candidate_language_proficiency')
        .upsert(payload, { onConflict: 'candidate_id' });

      if (error) throw error;

      // Also update language_level_self_reported on candidates
      await supabase
        .from('candidates')
        .update({
          language_level_self_reported: languageProficiency.current_german_level,
        })
        .eq('id', candidate.id);

      const newStats = calculateProfileCompletion({
        personalInfo,
        education,
        professionalReg,
        workExperience: workEntries,
        totalYearsExperience,
        languageProficiency: payload,
      });

      await syncProfileCompletionPct(newStats.pct);
      showToast('Language details saved.');
    } catch (err: any) {
      console.error('Error saving language proficiency:', err);
      alert(err.message || 'Failed to save language details.');
    } finally {
      setSaving(false);
    }
  };

  // Helper to add new blank work entry
  const handleAddWorkEntry = () => {
    setWorkEntries((prev) => [
      ...prev,
      {
        id: undefined,
        is_current_employer: false,
        employer_name: '',
        job_title: '',
        department_ward: '',
        start_date: '',
        end_date: '',
        notice_period: '',
        entry_order: prev.length + 1,
      },
    ]);
  };

  // Helper to remove work entry
  const handleRemoveWorkEntry = (idx: number) => {
    if (workEntries.length <= 1) {
      alert('You must have at least one work experience entry.');
      return;
    }
    setWorkEntries((prev) => prev.filter((_, i) => i !== idx));
  };

  // Helper to check if passport expiry is < 18 months
  const isPassportExpiringSoon = () => {
    if (!personalInfo.passport_expiry_date) return false;
    const expiry = new Date(personalInfo.passport_expiry_date);
    const now = new Date();
    const diffMonths = (expiry.getFullYear() - now.getFullYear()) * 12 + (expiry.getMonth() - now.getMonth());
    return diffMonths < 18;
  };

  // Helper to check if registration expires in < 12 months
  const isRegistrationExpiringSoon = () => {
    if (!professionalReg.registration_valid_until) return false;
    const expiry = new Date(professionalReg.registration_valid_until);
    const now = new Date();
    const diffMonths = (expiry.getFullYear() - now.getFullYear()) * 12 + (expiry.getMonth() - now.getMonth());
    return diffMonths < 12;
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B3270]" />
        <span className="text-xs text-slate-400 mt-3 font-medium">
          Loading Candidate Profile...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1B3270] text-white px-4 py-2.5 rounded-[8px] text-xs font-semibold shadow-lg flex items-center space-x-2 animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 size={15} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* CV PARSER BANNER */}
      {(!latestCvParse || latestCvParse.status === 'failed') ? (
        <div className="bg-white border-l-4 border-l-[#2952A3] border border-[#E2E8F4] rounded-[10px] p-4 shadow-[0_1px_4px_rgba(27,50,112,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#E2E8F4]/60 text-[#2952A3] flex items-center justify-center shrink-0 mt-0.5">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1B3270]">
                Save time — upload your CV
              </h3>
              <p className="text-xs text-[#4A5568] mt-0.5">
                We will extract your details automatically. You can review and edit before saving.
              </p>
              {cvParseError && (
                <p className="text-xs text-rose-600 mt-1 font-medium flex items-center space-x-1">
                  <AlertCircle size={12} />
                  <span>{cvParseError}</span>
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 flex items-center space-x-2">
            <input
              ref={cvInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleCvFileChange}
            />
            <button
              type="button"
              disabled={parsingCv}
              onClick={() => cvInputRef.current?.click()}
              className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {parsingCv ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Parsing your CV... This takes a few seconds.</span>
                </>
              ) : (
                <>
                  <Upload size={13} />
                  <span>Upload & Parse CV</span>
                </>
              )}
            </button>
          </div>
        </div>
      ) : latestCvParse?.status === 'completed' && !latestCvParse?.applied ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-[10px] p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">
                CV parsed successfully.
              </h4>
              <p className="text-xs text-emerald-800 mt-0.5">
                Review the extracted details below or apply them directly to your profile.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => handleApplyCvData()}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-[6px] transition-colors cursor-pointer"
            >
              Apply to Profile
            </button>
            <button
              type="button"
              onClick={() => handleApplyCvData('personal')}
              className="px-3.5 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs font-medium rounded-[6px] transition-colors cursor-pointer"
            >
              Review section by section
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-[#94A3B8] flex items-center justify-between px-1">
          <span>
            CV parsed on{' '}
            {latestCvParse?.created_at
              ? new Date(latestCvParse.created_at).toLocaleDateString()
              : 'recently'}{' '}
            —{' '}
            <button
              type="button"
              onClick={() => cvInputRef.current?.click()}
              className="text-[#2952A3] hover:underline font-medium cursor-pointer"
            >
              Upload a new one
            </button>
          </span>
          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleCvFileChange}
          />
        </div>
      )}

      {/* MAIN LAYOUT: SIDEBAR (220px) + CONTENT AREA */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* LEFT SIDEBAR (220px fixed on md) */}
        <div className="w-full md:w-[220px] shrink-0 bg-white border border-[#E2E8F4] rounded-[10px] p-3 shadow-[0_1px_4px_rgba(27,50,112,0.04)] space-y-4">
          <div className="space-y-1">
            {/* Nav 1: Personal */}
            <button
              type="button"
              onClick={() => setActiveSection('personal')}
              className={`w-full text-left px-3 py-2.5 rounded-[6px] text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                activeSection === 'personal'
                  ? 'bg-[#F4F7FC] text-[#1B3270] font-bold border-l-3 border-[#1B3270]'
                  : 'text-[#4A5568] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <User size={14} className="shrink-0 text-[#2952A3]" />
                <span className="truncate">Personal Info</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  completionStats.personalComplete
                    ? 'bg-emerald-100 text-emerald-800'
                    : completionStats.personalFilled > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {completionStats.personalFilled}/9
              </span>
            </button>

            {/* Nav 2: Education */}
            <button
              type="button"
              onClick={() => setActiveSection('education')}
              className={`w-full text-left px-3 py-2.5 rounded-[6px] text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                activeSection === 'education'
                  ? 'bg-[#F4F7FC] text-[#1B3270] font-bold border-l-3 border-[#1B3270]'
                  : 'text-[#4A5568] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <GraduationCap size={14} className="shrink-0 text-[#2952A3]" />
                <span className="truncate">Education</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  completionStats.educationComplete
                    ? 'bg-emerald-100 text-emerald-800'
                    : completionStats.educationFilled > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {completionStats.educationFilled}/7
              </span>
            </button>

            {/* Nav 3: Registration */}
            <button
              type="button"
              onClick={() => setActiveSection('professional')}
              className={`w-full text-left px-3 py-2.5 rounded-[6px] text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                activeSection === 'professional'
                  ? 'bg-[#F4F7FC] text-[#1B3270] font-bold border-l-3 border-[#1B3270]'
                  : 'text-[#4A5568] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <ClipboardList size={14} className="shrink-0 text-[#2952A3]" />
                <span className="truncate">Registration</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  completionStats.professionalComplete
                    ? 'bg-emerald-100 text-emerald-800'
                    : completionStats.professionalFilled > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {completionStats.professionalFilled}/4
              </span>
            </button>

            {/* Nav 4: Work Experience */}
            <button
              type="button"
              onClick={() => setActiveSection('experience')}
              className={`w-full text-left px-3 py-2.5 rounded-[6px] text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                activeSection === 'experience'
                  ? 'bg-[#F4F7FC] text-[#1B3270] font-bold border-l-3 border-[#1B3270]'
                  : 'text-[#4A5568] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <Briefcase size={14} className="shrink-0 text-[#2952A3]" />
                <span className="truncate">Experience</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  completionStats.experienceComplete
                    ? 'bg-emerald-100 text-emerald-800'
                    : completionStats.experienceFilled > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {completionStats.experienceFilled}/7
              </span>
            </button>

            {/* Nav 5: Language */}
            <button
              type="button"
              onClick={() => setActiveSection('language')}
              className={`w-full text-left px-3 py-2.5 rounded-[6px] text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                activeSection === 'language'
                  ? 'bg-[#F4F7FC] text-[#1B3270] font-bold border-l-3 border-[#1B3270]'
                  : 'text-[#4A5568] hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <Languages size={14} className="shrink-0 text-[#2952A3]" />
                <span className="truncate">German Language</span>
              </div>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  completionStats.languageComplete
                    ? 'bg-emerald-100 text-emerald-800'
                    : completionStats.languageFilled > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {completionStats.languageFilled}/3
              </span>
            </button>
          </div>

          {/* Profile Completion Indicator */}
          <div className="pt-3 border-t border-[#E2E8F4]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-[#1B3270]">Profile Completion</span>
              <span className="font-bold text-[#1B3270]">{completionStats.pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  completionStats.pct === 100
                    ? 'bg-emerald-500'
                    : completionStats.pct >= 50
                    ? 'bg-[#2952A3]'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${completionStats.pct}%` }}
              />
            </div>
            <p className="text-[11px] text-[#94A3B8] mt-2 leading-tight">
              A complete profile improves your chances with employers.
            </p>
          </div>
        </div>

        {/* RIGHT CONTENT FORM AREA */}
        <div className="flex-1 w-full min-w-0 bg-white border border-[#E2E8F4] rounded-[12px] p-6 shadow-xs">
          {/* SECTION 1: PERSONAL INFORMATION */}
          {activeSection === 'personal' && (
            <form onSubmit={handleSavePersonalInfo} className="space-y-6">
              <div>
                <div className="flex items-center space-x-2">
                  <User className="text-[#1B3270] w-5 h-5" />
                  <h2 className="text-base font-bold text-[#1B3270]">
                    Personal Information
                  </h2>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Basic identity and contact details • 11 fields · 9 mandatory · 2 optional
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Full name */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={personalInfo.full_name || ''}
                    onChange={(e) =>
                      setPersonalInfo({ ...personalInfo, full_name: e.target.value })
                    }
                    placeholder="As per passport"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">As per passport</p>
                </div>

                {/* 2. Date of Birth */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Date of Birth <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={personalInfo.date_of_birth || ''}
                    onChange={(e) =>
                      setPersonalInfo({ ...personalInfo, date_of_birth: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                </div>

                {/* 3. Gender */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Gender <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={personalInfo.gender || 'Female'}
                    onChange={(e) =>
                      setPersonalInfo({ ...personalInfo, gender: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none bg-white"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* 4. Nationality */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nationality <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={personalInfo.nationality || ''}
                    onChange={(e) =>
                      setPersonalInfo({ ...personalInfo, nationality: e.target.value })
                    }
                    placeholder="e.g. Indian, Filipino"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                </div>

                {/* 5. Country of Residence */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current Country of Residence <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={personalInfo.country_of_residence || ''}
                    onChange={(e) =>
                      setPersonalInfo({
                        ...personalInfo,
                        country_of_residence: e.target.value,
                      })
                    }
                    placeholder="e.g. India, UAE"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                </div>

                {/* 6. City / State */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current City / State <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={personalInfo.city_state || ''}
                    onChange={(e) =>
                      setPersonalInfo({ ...personalInfo, city_state: e.target.value })
                    }
                    placeholder="e.g. Kochi, Kerala"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                </div>

                {/* 7. Mobile Number */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={personalInfo.country_code || '+91'}
                      onChange={(e) =>
                        setPersonalInfo({ ...personalInfo, country_code: e.target.value })
                      }
                      className="w-24 px-2.5 py-2 border border-[#E2E8F4] rounded-[6px] text-xs bg-white outline-none"
                    >
                      <option value="+91">+91 (IN)</option>
                      <option value="+49">+49 (DE)</option>
                      <option value="+63">+63 (PH)</option>
                      <option value="+971">+971 (AE)</option>
                      <option value="+44">+44 (UK)</option>
                      <option value="+1">+1 (US)</option>
                    </select>
                    <input
                      type="tel"
                      required
                      value={personalInfo.mobile_number || ''}
                      onChange={(e) =>
                        setPersonalInfo({ ...personalInfo, mobile_number: e.target.value })
                      }
                      placeholder="9876543210"
                      className="flex-1 px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">Include country code</p>
                </div>

                {/* 8. WhatsApp Number */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    WhatsApp Number
                  </label>
                  <div className="flex items-center space-x-2 mb-1.5">
                    <input
                      type="checkbox"
                      id="whatsapp_same"
                      checked={personalInfo.whatsapp_same_as_mobile}
                      onChange={(e) =>
                        setPersonalInfo({
                          ...personalInfo,
                          whatsapp_same_as_mobile: e.target.checked,
                          whatsapp_number: e.target.checked
                            ? ''
                            : personalInfo.whatsapp_number,
                        })
                      }
                      className="rounded text-[#1B3270] focus:ring-[#1B3270]"
                    />
                    <label htmlFor="whatsapp_same" className="text-xs text-slate-600">
                      Same as mobile number
                    </label>
                  </div>
                  {!personalInfo.whatsapp_same_as_mobile && (
                    <input
                      type="tel"
                      value={personalInfo.whatsapp_number || ''}
                      onChange={(e) =>
                        setPersonalInfo({
                          ...personalInfo,
                          whatsapp_number: e.target.value,
                        })
                      }
                      placeholder="+91 9876543210"
                      className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  )}
                </div>

                {/* 9. Email address */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    readOnly
                    value={personalInfo.email_address || ''}
                    className="w-full px-3 py-2 bg-slate-50 border border-[#E2E8F4] rounded-[6px] text-xs text-slate-500 cursor-not-allowed outline-none"
                  />
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">
                    Tied to your login account (cannot be changed)
                  </p>
                </div>

                {/* 10. Passport Number */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Passport Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={personalInfo.passport_number || ''}
                    onChange={(e) =>
                      setPersonalInfo({
                        ...personalInfo,
                        passport_number: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g. Z1234567"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none uppercase font-mono"
                  />
                </div>

                {/* 11. Passport Expiry Date */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Passport Expiry Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={personalInfo.passport_expiry_date || ''}
                    onChange={(e) =>
                      setPersonalInfo({
                        ...personalInfo,
                        passport_expiry_date: e.target.value,
                      })
                    }
                    className="w-full sm:w-1/2 px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                  {isPassportExpiringSoon() && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-[6px] mt-2 flex items-center space-x-1.5 font-medium">
                      <AlertCircle size={13} className="shrink-0 text-amber-600" />
                      <span>
                        Passport expires soon. Ensure it is valid for your visa and hospital application.
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* SECTION DOCUMENTS */}
              <div className="pt-6 border-t border-[#E2E8F4] space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1B3270]">Section Documents</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Upload verification documents for your identity and travel eligibility.
                  </p>
                </div>
                <div className="space-y-3">
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="passport"
                    label="Passport"
                    isMandatory={true}
                    notes="All pages with stamps"
                    sourceSection="personal"
                    existingDoc={documentsMap['passport']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, passport: d }))
                    }
                  />
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="passport_photo"
                    label="Passport-size Photograph"
                    isMandatory={true}
                    notes="White background"
                    sourceSection="personal"
                    existingDoc={documentsMap['passport_photo']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, passport_photo: d }))
                    }
                  />
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="government_id"
                    label="Aadhaar / Government ID"
                    isMandatory={true}
                    sourceSection="personal"
                    existingDoc={documentsMap['government_id']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, government_id: d }))
                    }
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Personal Information</span>
                </button>
              </div>
            </form>
          )}

          {/* SECTION 2: EDUCATION & QUALIFICATION */}
          {activeSection === 'education' && (
            <form onSubmit={handleSaveEducation} className="space-y-6">
              <div>
                <div className="flex items-center space-x-2">
                  <GraduationCap className="text-[#1B3270] w-5 h-5" />
                  <h2 className="text-base font-bold text-[#1B3270]">
                    Education & Qualification
                  </h2>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Academic background and healthcare degree • 9 fields · 7 mandatory · 2 optional
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Healthcare Profession */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Healthcare Profession <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={education.healthcare_profession || 'Nursing (General)'}
                    onChange={(e) =>
                      setEducation({ ...education, healthcare_profession: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs bg-white outline-none"
                  >
                    <option value="Nursing (General)">Nursing (General)</option>
                    <option value="Nursing (Specialised)">Nursing (Specialised)</option>
                    <option value="Physiotherapy">Physiotherapy</option>
                    <option value="Pharmacy">Pharmacy</option>
                    <option value="Medical Lab">Medical Lab</option>
                    <option value="Radiology">Radiology</option>
                    <option value="Dental">Dental</option>
                    <option value="Care Work">Care Work</option>
                    <option value="Other">Other</option>
                  </select>
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">Primary category</p>
                </div>

                {/* 2. Specialization */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Specialization / Stream <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={education.specialization || ''}
                    onChange={(e) =>
                      setEducation({ ...education, specialization: e.target.value })
                    }
                    placeholder="e.g. Critical Care, Med-Surg, Pediatrics"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                </div>

                {/* 3. Degree / Diploma Title */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Degree / Diploma Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={education.degree_title || ''}
                    onChange={(e) =>
                      setEducation({ ...education, degree_title: e.target.value })
                    }
                    placeholder="e.g. Bachelor of Science in Nursing (B.Sc.)"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                </div>

                {/* 4. College / University */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    College / University Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={education.college_university || ''}
                    onChange={(e) =>
                      setEducation({ ...education, college_university: e.target.value })
                    }
                    placeholder="e.g. Rajiv Gandhi University of Health Sciences"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                </div>

                {/* 5. Year of Completion */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Year of Completion <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min={1980}
                    max={new Date().getFullYear() + 2}
                    value={education.year_of_completion || ''}
                    onChange={(e) =>
                      setEducation({
                        ...education,
                        year_of_completion: parseInt(e.target.value) || '',
                      })
                    }
                    placeholder="YYYY"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                </div>

                {/* 6. 10th Board & Year */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    10th Board / Year <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      required
                      value={education.board_10th || ''}
                      onChange={(e) =>
                        setEducation({ ...education, board_10th: e.target.value })
                      }
                      placeholder="Board e.g. CBSE / State"
                      className="flex-1 px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                    <input
                      type="number"
                      required
                      min={1980}
                      max={new Date().getFullYear()}
                      value={education.year_10th || ''}
                      onChange={(e) =>
                        setEducation({
                          ...education,
                          year_10th: parseInt(e.target.value) || '',
                        })
                      }
                      placeholder="Year"
                      className="w-24 px-2.5 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                </div>

                {/* 7. 12th Board & Year */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    12th Board / Year <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      required
                      value={education.board_12th || ''}
                      onChange={(e) =>
                        setEducation({ ...education, board_12th: e.target.value })
                      }
                      placeholder="Board e.g. CBSE / State"
                      className="flex-1 px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                    <input
                      type="number"
                      required
                      min={1980}
                      max={new Date().getFullYear()}
                      value={education.year_12th || ''}
                      onChange={(e) =>
                        setEducation({
                          ...education,
                          year_12th: parseInt(e.target.value) || '',
                        })
                      }
                      placeholder="Year"
                      className="w-24 px-2.5 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                </div>

                {/* 8. Internship Completed Toggle */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Internship Completed? <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center space-x-4 pt-1">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="internship"
                        checked={education.internship_completed === true}
                        onChange={() =>
                          setEducation({ ...education, internship_completed: true })
                        }
                        className="text-[#1B3270] focus:ring-[#1B3270]"
                      />
                      <span className="text-xs text-slate-700 font-medium">Yes</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="internship"
                        checked={education.internship_completed === false}
                        onChange={() =>
                          setEducation({
                            ...education,
                            internship_completed: false,
                            internship_institution: '',
                          })
                        }
                        className="text-[#1B3270] focus:ring-[#1B3270]"
                      />
                      <span className="text-xs text-slate-700 font-medium">No</span>
                    </label>
                  </div>
                </div>

                {/* 9. Internship Institution (Conditional) */}
                {education.internship_completed && (
                  <div className="sm:col-span-2 animate-in fade-in duration-150">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Internship Institution
                    </label>
                    <input
                      type="text"
                      value={education.internship_institution || ''}
                      onChange={(e) =>
                        setEducation({
                          ...education,
                          internship_institution: e.target.value,
                        })
                      }
                      placeholder="Hospital or clinical training facility name"
                      className="w-full sm:w-1/2 px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* SECTION DOCUMENTS */}
              <div className="pt-6 border-t border-[#E2E8F4] space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1B3270]">Section Documents</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Upload your educational diplomas, certificates, and mark sheets.
                  </p>
                </div>
                <div className="space-y-3">
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="certificate_10th"
                    label="10th Certificate"
                    isMandatory={true}
                    sourceSection="education"
                    existingDoc={documentsMap['certificate_10th']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, certificate_10th: d }))
                    }
                  />
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="certificate_12th"
                    label="12th Certificate"
                    isMandatory={true}
                    sourceSection="education"
                    existingDoc={documentsMap['certificate_12th']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, certificate_12th: d }))
                    }
                  />
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="healthcare_degree"
                    label="Nursing / Healthcare Degree or Diploma"
                    isMandatory={true}
                    sourceSection="education"
                    existingDoc={documentsMap['healthcare_degree']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, healthcare_degree: d }))
                    }
                  />
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="mark_sheets"
                    label="All Mark Sheets / Transcripts"
                    isMandatory={true}
                    notes="All semesters / years"
                    sourceSection="education"
                    existingDoc={documentsMap['mark_sheets']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, mark_sheets: d }))
                    }
                  />
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="degree_completion"
                    label="Degree Completion Certificate"
                    isMandatory={true}
                    sourceSection="education"
                    existingDoc={documentsMap['degree_completion']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, degree_completion: d }))
                    }
                  />
                  {education.internship_completed && (
                    <DocumentUploadCard
                      candidateId={candidate.id}
                      documentType="internship_certificate"
                      label="Internship Certificate"
                      isMandatory={false}
                      notes="Required if internship was completed"
                      sourceSection="education"
                      existingDoc={documentsMap['internship_certificate']}
                      onDocUploaded={(d) =>
                        setDocumentsMap((prev) => ({ ...prev, internship_certificate: d }))
                      }
                    />
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Education Details</span>
                </button>
              </div>
            </form>
          )}

          {/* SECTION 3: PROFESSIONAL REGISTRATION */}
          {activeSection === 'professional' && (
            <form onSubmit={handleSaveProfessionalReg} className="space-y-6">
              <div>
                <div className="flex items-center space-x-2">
                  <ClipboardList className="text-[#1B3270] w-5 h-5" />
                  <h2 className="text-base font-bold text-[#1B3270]">
                    Professional Registration
                  </h2>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Statutory registration and licensing • 6 fields · 4 mandatory · 2 conditional
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Registration Council */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Registration Council / Body <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={professionalReg.registration_council || ''}
                    onChange={(e) =>
                      setProfessionalReg({
                        ...professionalReg,
                        registration_council: e.target.value,
                      })
                    }
                    placeholder="e.g. Kerala Nursing and Midwives Council"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">
                    Issuing authority e.g. State Nursing Council
                  </p>
                </div>

                {/* 2. Registration Number */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Registration Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={professionalReg.registration_number || ''}
                    onChange={(e) =>
                      setProfessionalReg({
                        ...professionalReg,
                        registration_number: e.target.value,
                      })
                    }
                    placeholder="e.g. KNMC-RN-48291"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none font-mono"
                  />
                </div>

                {/* 3. Issue Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Registration Issue Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={professionalReg.registration_issue_date || ''}
                    onChange={(e) =>
                      setProfessionalReg({
                        ...professionalReg,
                        registration_issue_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                </div>

                {/* 4. Valid Until */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Registration Valid Until <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={professionalReg.registration_valid_until || ''}
                    onChange={(e) =>
                      setProfessionalReg({
                        ...professionalReg,
                        registration_valid_until: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                  {isRegistrationExpiringSoon() && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded-[6px] mt-2 flex items-center space-x-1.5 font-medium">
                      <AlertCircle size={13} className="shrink-0 text-amber-600" />
                      <span>Registration expiring soon. Ensure renewal before visa processing.</span>
                    </p>
                  )}
                </div>

                {/* 5. State Council Registration */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    State Council Registration
                  </label>
                  <input
                    type="text"
                    value={professionalReg.state_council_registration || ''}
                    onChange={(e) =>
                      setProfessionalReg({
                        ...professionalReg,
                        state_council_registration: e.target.value,
                      })
                    }
                    placeholder="State council name and number if separate"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                  <p className="text-[10px] text-[#94A3B8] mt-0.5">
                    If separate from primary registration above
                  </p>
                </div>

                {/* 6. Additional License */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Additional Professional License
                  </label>
                  <input
                    type="text"
                    value={professionalReg.additional_professional_license || ''}
                    onChange={(e) =>
                      setProfessionalReg({
                        ...professionalReg,
                        additional_professional_license: e.target.value,
                      })
                    }
                    placeholder="e.g. BLS / ACLS certification"
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                  />
                </div>
              </div>

              {/* SECTION DOCUMENTS */}
              <div className="pt-6 border-t border-[#E2E8F4] space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1B3270]">Section Documents</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Upload statutory nursing registration and professional license certificates.
                  </p>
                </div>
                <div className="space-y-3">
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="professional_registration_cert"
                    label="Professional Registration Certificate"
                    isMandatory={true}
                    sourceSection="professional"
                    existingDoc={documentsMap['professional_registration_cert']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({
                        ...prev,
                        professional_registration_cert: d,
                      }))
                    }
                  />
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="state_council_registration"
                    label="State Council Registration"
                    isMandatory={false}
                    sourceSection="professional"
                    existingDoc={documentsMap['state_council_registration']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({
                        ...prev,
                        state_council_registration: d,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Registration Details</span>
                </button>
              </div>
            </form>
          )}

          {/* SECTION 4: WORK EXPERIENCE */}
          {activeSection === 'experience' && (
            <form onSubmit={handleSaveWorkExperience} className="space-y-6">
              <div>
                <div className="flex items-center space-x-2">
                  <Briefcase className="text-[#1B3270] w-5 h-5" />
                  <h2 className="text-base font-bold text-[#1B3270]">
                    Work Experience
                  </h2>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Employment history — minimum one entry required • 8 fields per entry · 6 mandatory · 2 conditional
                </p>
              </div>

              {/* GLOBAL FIELD: Total Years of Experience */}
              <div className="bg-[#F8FAFD] border border-[#E2E8F4] rounded-[8px] p-4">
                <label className="block text-xs font-bold text-[#1B3270] mb-1">
                  Total Years of Clinical Experience <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={totalYearsExperience}
                    onChange={(e) => setTotalYearsExperience(e.target.value)}
                    placeholder="e.g. 2.5"
                    className="w-32 px-3 py-2 bg-white border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none font-bold text-[#1B3270]"
                  />
                  <span className="text-xs text-[#4A5568]">years completed</span>
                </div>
              </div>

              {/* WORK ENTRIES (Repeatable) */}
              <div className="space-y-4">
                {workEntries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="border border-[#E2E8F4] rounded-[8px] p-4 bg-white shadow-2xs space-y-4 relative"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F4]">
                      <span className="text-xs font-bold text-[#1B3270]">
                        Employment Record #{idx + 1}
                      </span>
                      {workEntries.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveWorkEntry(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove entry"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Currently employed here? */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Currently Employed Here? <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center space-x-4 pt-0.5">
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`current_emp_${idx}`}
                              checked={entry.is_current_employer === true}
                              onChange={() => {
                                const copy = [...workEntries];
                                copy[idx].is_current_employer = true;
                                copy[idx].end_date = '';
                                setWorkEntries(copy);
                              }}
                              className="text-[#1B3270] focus:ring-[#1B3270]"
                            />
                            <span className="text-xs text-slate-700 font-medium">Yes (Current)</span>
                          </label>
                          <label className="flex items-center space-x-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name={`current_emp_${idx}`}
                              checked={entry.is_current_employer === false}
                              onChange={() => {
                                const copy = [...workEntries];
                                copy[idx].is_current_employer = false;
                                setWorkEntries(copy);
                              }}
                              className="text-[#1B3270] focus:ring-[#1B3270]"
                            />
                            <span className="text-xs text-slate-700 font-medium">No (Past)</span>
                          </label>
                        </div>
                      </div>

                      {/* Employer / Hospital Name */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Employer / Hospital Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={entry.employer_name || ''}
                          onChange={(e) => {
                            const copy = [...workEntries];
                            copy[idx].employer_name = e.target.value;
                            setWorkEntries(copy);
                          }}
                          placeholder="e.g. Apollo Hospital"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                        />
                      </div>

                      {/* Job Title */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Job Title / Designation <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={entry.job_title || ''}
                          onChange={(e) => {
                            const copy = [...workEntries];
                            copy[idx].job_title = e.target.value;
                            setWorkEntries(copy);
                          }}
                          placeholder="e.g. Staff Nurse / Senior Nurse"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                        />
                      </div>

                      {/* Department / Ward */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Department / Ward <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={entry.department_ward || ''}
                          onChange={(e) => {
                            const copy = [...workEntries];
                            copy[idx].department_ward = e.target.value;
                            setWorkEntries(copy);
                          }}
                          placeholder="e.g. ICU / CCU / Emergency Ward"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                        />
                      </div>

                      {/* Start Date */}
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Start Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={entry.start_date || ''}
                          onChange={(e) => {
                            const copy = [...workEntries];
                            copy[idx].start_date = e.target.value;
                            setWorkEntries(copy);
                          }}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                        />
                      </div>

                      {/* End Date (Conditional) */}
                      {!entry.is_current_employer && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            End Date <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={entry.end_date || ''}
                            onChange={(e) => {
                              const copy = [...workEntries];
                              copy[idx].end_date = e.target.value;
                              setWorkEntries(copy);
                            }}
                            className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                          />
                        </div>
                      )}

                      {/* Notice Period (Conditional) */}
                      {entry.is_current_employer && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 mb-1">
                            Notice Period / Availability
                          </label>
                          <input
                            type="text"
                            value={entry.notice_period || ''}
                            onChange={(e) => {
                              const copy = [...workEntries];
                              copy[idx].notice_period = e.target.value;
                              setWorkEntries(copy);
                            }}
                            placeholder="e.g. 30 days / Immediate / 3 months"
                            className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddWorkEntry}
                  className="w-full py-2.5 border-2 border-dashed border-[#E2E8F4] hover:border-[#2952A3] rounded-[8px] text-xs font-semibold text-[#2952A3] flex items-center justify-center space-x-1.5 transition-colors cursor-pointer bg-slate-50/50 hover:bg-slate-50"
                >
                  <Plus size={14} />
                  <span>+ Add Another Work Entry</span>
                </button>
              </div>

              {/* EXPERIENCE DOCUMENTS */}
              <div className="pt-6 border-t border-[#E2E8F4] space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1B3270]">Experience Documents</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Upload clinical experience certificates, appointment letters, and salary slips.
                  </p>
                </div>
                <div className="space-y-3">
                  {/* Multi-upload Experience certificates */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">
                        Experience Certificates (One per employer)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          // Trigger new upload card
                          setExperienceCerts((prev) => [
                            ...prev,
                            { id: null, document_type: 'experience_certificate', isNew: true },
                          ]);
                        }}
                        className="text-[11px] font-semibold text-[#2952A3] hover:underline flex items-center space-x-1"
                      >
                        <Plus size={12} />
                        <span>Add Another Certificate</span>
                      </button>
                    </div>

                    {experienceCerts.length === 0 ? (
                      <DocumentUploadCard
                        candidateId={candidate.id}
                        documentType="experience_certificate"
                        label="Experience Certificate #1"
                        isMandatory={true}
                        notes="Upload certificate for your employer"
                        sourceSection="experience"
                        isMultiExperience={true}
                        onDocUploaded={(d) => setExperienceCerts([d])}
                      />
                    ) : (
                      experienceCerts.map((expDoc, eIdx) => (
                        <DocumentUploadCard
                          key={expDoc.id || eIdx}
                          candidateId={candidate.id}
                          documentType="experience_certificate"
                          label={`Experience Certificate #${eIdx + 1}`}
                          isMandatory={eIdx === 0}
                          sourceSection="experience"
                          existingDoc={expDoc.id ? expDoc : null}
                          isMultiExperience={true}
                          onDocUploaded={(saved) => {
                            setExperienceCerts((prev) => {
                              const updated = [...prev];
                              updated[eIdx] = saved;
                              return updated;
                            });
                          }}
                          onDeleteDoc={async (docId) => {
                            await supabase.from('documents').delete().eq('id', docId);
                            setExperienceCerts((prev) => prev.filter((d) => d.id !== docId));
                          }}
                        />
                      ))
                    )}
                  </div>

                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="appointment_letter"
                    label="Appointment / Offer Letter"
                    isMandatory={true}
                    sourceSection="experience"
                    existingDoc={documentsMap['appointment_letter']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, appointment_letter: d }))
                    }
                  />
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="relieving_letter"
                    label="Relieving Letter"
                    isMandatory={true}
                    notes="From previous employer(s)"
                    sourceSection="experience"
                    existingDoc={documentsMap['relieving_letter']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, relieving_letter: d }))
                    }
                  />
                  <DocumentUploadCard
                    candidateId={candidate.id}
                    documentType="salary_slips"
                    label="Salary Slips"
                    isMandatory={true}
                    notes="Last 3 months"
                    sourceSection="experience"
                    existingDoc={documentsMap['salary_slips']}
                    onDocUploaded={(d) =>
                      setDocumentsMap((prev) => ({ ...prev, salary_slips: d }))
                    }
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Work Experience</span>
                </button>
              </div>
            </form>
          )}

          {/* SECTION 5: GERMAN LANGUAGE PROFICIENCY */}
          {activeSection === 'language' && (
            <form onSubmit={handleSaveLanguageProficiency} className="space-y-6">
              <div>
                <div className="flex items-center space-x-2">
                  <Languages className="text-[#1B3270] w-5 h-5" />
                  <h2 className="text-base font-bold text-[#1B3270]">
                    German Language Proficiency
                  </h2>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5">
                  Current level, certifications, and training • 7 fields · 3 mandatory · 4 conditional
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Current German Level */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Current German Language Level <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={languageProficiency.current_german_level || 'B1'}
                    onChange={(e) =>
                      setLanguageProficiency({
                        ...languageProficiency,
                        current_german_level: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs bg-white outline-none font-bold text-[#1B3270]"
                  >
                    <option value="No knowledge">No knowledge</option>
                    <option value="A1">A1 — Beginner</option>
                    <option value="A2">A2 — Elementary</option>
                    <option value="B1">B1 — Intermediate</option>
                    <option value="B2">B2 — Upper Intermediate</option>
                    <option value="C1">C1 — Advanced</option>
                    <option value="C2">C2 — Mastery</option>
                  </select>
                </div>

                {/* 2. B1 Certificate Obtained? */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    B1 Certificate Obtained? <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center space-x-4 pt-1">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="b1_obtained"
                        checked={languageProficiency.b1_certificate_obtained === true}
                        onChange={() =>
                          setLanguageProficiency({
                            ...languageProficiency,
                            b1_certificate_obtained: true,
                          })
                        }
                        className="text-[#1B3270] focus:ring-[#1B3270]"
                      />
                      <span className="text-xs text-slate-700 font-medium">Yes</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="b1_obtained"
                        checked={languageProficiency.b1_certificate_obtained === false}
                        onChange={() =>
                          setLanguageProficiency({
                            ...languageProficiency,
                            b1_certificate_obtained: false,
                            b1_certificate_date: '',
                          })
                        }
                        className="text-[#1B3270] focus:ring-[#1B3270]"
                      />
                      <span className="text-xs text-slate-700 font-medium">No</span>
                    </label>
                  </div>
                </div>

                {/* 3. B1 Certificate Date (Conditional) */}
                {languageProficiency.b1_certificate_obtained && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      B1 Certificate Date Obtained
                    </label>
                    <input
                      type="date"
                      value={languageProficiency.b1_certificate_date || ''}
                      onChange={(e) =>
                        setLanguageProficiency({
                          ...languageProficiency,
                          b1_certificate_date: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                )}

                {/* 4. B2 Certificate Obtained? */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    B2 Certificate Obtained? <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center space-x-4 pt-1">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="b2_obtained"
                        checked={languageProficiency.b2_certificate_obtained === true}
                        onChange={() =>
                          setLanguageProficiency({
                            ...languageProficiency,
                            b2_certificate_obtained: true,
                          })
                        }
                        className="text-[#1B3270] focus:ring-[#1B3270]"
                      />
                      <span className="text-xs text-slate-700 font-medium">Yes</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="b2_obtained"
                        checked={languageProficiency.b2_certificate_obtained === false}
                        onChange={() =>
                          setLanguageProficiency({
                            ...languageProficiency,
                            b2_certificate_obtained: false,
                            b2_certificate_date: '',
                          })
                        }
                        className="text-[#1B3270] focus:ring-[#1B3270]"
                      />
                      <span className="text-xs text-slate-700 font-medium">No</span>
                    </label>
                  </div>
                </div>

                {/* 5. B2 Certificate Date (Conditional) */}
                {languageProficiency.b2_certificate_obtained && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      B2 Certificate Date Obtained
                    </label>
                    <input
                      type="date"
                      value={languageProficiency.b2_certificate_date || ''}
                      onChange={(e) =>
                        setLanguageProficiency({
                          ...languageProficiency,
                          b2_certificate_date: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                )}

                {/* 6. Currently Enrolled in German Course? */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Currently Enrolled in German Course?
                  </label>
                  <div className="flex items-center space-x-4 pt-1">
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="enrolled_course"
                        checked={languageProficiency.enrolled_in_german_course === true}
                        onChange={() =>
                          setLanguageProficiency({
                            ...languageProficiency,
                            enrolled_in_german_course: true,
                          })
                        }
                        className="text-[#1B3270] focus:ring-[#1B3270]"
                      />
                      <span className="text-xs text-slate-700 font-medium">Yes</span>
                    </label>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="enrolled_course"
                        checked={languageProficiency.enrolled_in_german_course === false}
                        onChange={() =>
                          setLanguageProficiency({
                            ...languageProficiency,
                            enrolled_in_german_course: false,
                            training_institute_name: '',
                          })
                        }
                        className="text-[#1B3270] focus:ring-[#1B3270]"
                      />
                      <span className="text-xs text-slate-700 font-medium">No</span>
                    </label>
                  </div>
                </div>

                {/* 7. Training Institute Name (Conditional) */}
                {languageProficiency.enrolled_in_german_course && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Training Institute Name
                    </label>
                    <input
                      type="text"
                      value={languageProficiency.training_institute_name || ''}
                      onChange={(e) =>
                        setLanguageProficiency({
                          ...languageProficiency,
                          training_institute_name: e.target.value,
                        })
                      }
                      placeholder="Name of institute or online platform (e.g. Goethe-Institut, VHS)"
                      className="w-full sm:w-1/2 px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs focus:ring-1 focus:ring-[#1B3270] outline-none"
                    />
                  </div>
                )}
              </div>

              {/* SECTION DOCUMENTS */}
              <div className="pt-6 border-t border-[#E2E8F4] space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1B3270]">Section Documents</h3>
                  <p className="text-xs text-[#94A3B8]">
                    Upload certified German language certificates (Goethe, telc, ÖSD, ECL).
                  </p>
                </div>
                <div className="space-y-3">
                  {languageProficiency.b1_certificate_obtained && (
                    <DocumentUploadCard
                      candidateId={candidate.id}
                      documentType="german_b1_certificate"
                      label="German B1 Certificate"
                      isMandatory={false}
                      notes="Required if B1 obtained"
                      sourceSection="language"
                      existingDoc={documentsMap['german_b1_certificate']}
                      onDocUploaded={(d) =>
                        setDocumentsMap((prev) => ({ ...prev, german_b1_certificate: d }))
                      }
                    />
                  )}
                  {languageProficiency.b2_certificate_obtained && (
                    <DocumentUploadCard
                      candidateId={candidate.id}
                      documentType="german_b2_certificate"
                      label="German B2 Certificate"
                      isMandatory={false}
                      notes="Required if B2 obtained"
                      sourceSection="language"
                      existingDoc={documentsMap['german_b2_certificate']}
                      onDocUploaded={(d) =>
                        setDocumentsMap((prev) => ({ ...prev, german_b2_certificate: d }))
                      }
                    />
                  )}
                  {!languageProficiency.b1_certificate_obtained &&
                    !languageProficiency.b2_certificate_obtained && (
                      <p className="text-xs text-slate-400 italic py-2">
                        Mark B1 or B2 certificate as &quot;Yes&quot; above to upload your certificates.
                      </p>
                    )}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-[#1B3270] hover:bg-[#2952A3] text-white text-xs font-semibold rounded-[6px] transition-colors shadow-2xs inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 size={13} className="animate-spin" />}
                  <span>Save Language Details</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
