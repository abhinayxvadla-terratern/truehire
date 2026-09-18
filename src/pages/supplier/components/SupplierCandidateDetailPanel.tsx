import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  ArrowLeft,
  Lock,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ChevronDown,
  ChevronUp,
  Upload,
  Plus,
  Trash2,
  Loader2,
  Building,
  GraduationCap,
  Award,
  Globe,
  Briefcase,
  User,
  Send,
} from 'lucide-react';
import {
  ALL_DOCUMENT_TYPES,
  DocumentSection,
  MANDATORY_DOC_COUNT,
  calculateProfileCompletion,
} from '../../../utils/documentTypes';

interface SupplierCandidateDetailPanelProps {
  candidateId: string;
  initialTab?: 'profile' | 'documents' | 'notes' | 'progress';
  onClose: () => void;
  onCandidateUpdated?: () => void;
}

export const SupplierCandidateDetailPanel: React.FC<SupplierCandidateDetailPanelProps> = ({
  candidateId,
  initialTab = 'profile',
  onClose,
  onCandidateUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'documents' | 'notes' | 'progress'>(initialTab);
  const [candidate, setCandidate] = useState<any | null>(null);
  const [currentProfile, setCurrentProfile] = useState<any | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierCompany, setSupplierCompany] = useState<string>('Your Supplier');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Profile Sections State
  const [personalInfo, setPersonalInfo] = useState<any>({});
  const [education, setEducation] = useState<any>({});
  const [professionalReg, setProfessionalReg] = useState<any>({});
  const [workEntries, setWorkEntries] = useState<any[]>([]);
  const [totalYearsExperience, setTotalYearsExperience] = useState<number | string>('');
  const [languageProficiency, setLanguageProficiency] = useState<any>({});

  // Accordion Expand States
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    personal: true,
    education: false,
    registration: false,
    experience: false,
    language: false,
  });

  // Edit Mode per Section
  const [editingSection, setEditingSection] = useState<Record<string, boolean>>({
    personal: false,
    education: false,
    registration: false,
    experience: false,
    language: false,
  });

  // Conflict state per Section
  const [conflictSection, setConflictSection] = useState<Record<string, { date: string; candidateUser: boolean } | null>>({
    personal: null,
    education: null,
    registration: null,
    experience: null,
    language: null,
  });

  const [savingSection, setSavingSection] = useState<string | null>(null);

  // Documents State
  const [documents, setDocuments] = useState<any[]>([]);
  const [docFilter, setDocFilter] = useState<'all' | DocumentSection>('all');
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);

  // Notes State
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Progress State
  const [gateResults, setGateResults] = useState<any[]>([]);
  const [dtAttempts, setDtAttempts] = useState<any[]>([]);
  const [speakingSchedule, setSpeakingSchedule] = useState<any | null>(null);
  const [speakingResult, setSpeakingResult] = useState<any | null>(null);
  const [bootcampCohort, setBootcampCohort] = useState<any | null>(null);
  const [bootcampAttendance, setBootcampAttendance] = useState<any[]>([]);
  const [bootcampSessions, setBootcampSessions] = useState<any[]>([]);
  const [finalAssessment, setFinalAssessment] = useState<any | null>(null);

  // Load Candidate Data & Profile info
  const loadData = async () => {
    try {
      setLoading(true);

      // Current Auth & Profile
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', session.user.id)
          .single();
        setCurrentProfile(prof);

        // Fetch supplier
        const { data: sup } = await supabase
          .from('suppliers')
          .select('id, company_name')
          .or(`user_id.eq.${session.user.id},is_admin_profile_id.eq.${session.user.id}`)
          .maybeSingle();

        if (sup) {
          setSupplierId(sup.id);
          if (sup.company_name) setSupplierCompany(sup.company_name);
        } else {
          const { data: tm } = await supabase
            .from('supplier_team_members')
            .select('supplier_id, suppliers(company_name)')
            .eq('profile_id', session.user.id)
            .maybeSingle();
          if (tm?.supplier_id) {
            setSupplierId(tm.supplier_id);
            if ((tm.suppliers as any)?.company_name) setSupplierCompany((tm.suppliers as any).company_name);
          }
        }
      }

      // 1. Candidate Info
      const { data: cand, error: candErr } = await supabase
        .from('candidates')
        .select('*')
        .eq('id', candidateId)
        .single();
      if (candErr) throw candErr;
      setCandidate(cand);
      setTotalYearsExperience(cand.total_years_experience || '');

      // 2. Personal Info
      const { data: pInfo } = await supabase
        .from('candidate_personal_info')
        .select('*')
        .eq('candidate_id', candidateId)
        .maybeSingle();
      if (pInfo) {
        setPersonalInfo(pInfo);
        // Check if last updated by candidate
        if (pInfo.updated_at && (!pInfo.updated_by || pInfo.updated_by === cand.user_id)) {
          setConflictSection((prev) => ({
            ...prev,
            personal: { date: new Date(pInfo.updated_at).toLocaleDateString(), candidateUser: true },
          }));
        }
      } else {
        setPersonalInfo({
          full_name: `${cand.first_name || ''} ${cand.last_name || ''}`.trim(),
          email_address: cand.email || '',
        });
      }

      // 3. Education
      const { data: edu } = await supabase
        .from('candidate_education')
        .select('*')
        .eq('candidate_id', candidateId)
        .maybeSingle();
      if (edu) {
        setEducation(edu);
        if (edu.updated_at && (!edu.updated_by || edu.updated_by === cand.user_id)) {
          setConflictSection((prev) => ({
            ...prev,
            education: { date: new Date(edu.updated_at).toLocaleDateString(), candidateUser: true },
          }));
        }
      }

      // 4. Professional Registration
      const { data: profReg } = await supabase
        .from('candidate_professional_registration')
        .select('*')
        .eq('candidate_id', candidateId)
        .maybeSingle();
      if (profReg) {
        setProfessionalReg(profReg);
        if (profReg.updated_at && (!profReg.updated_by || profReg.updated_by === cand.user_id)) {
          setConflictSection((prev) => ({
            ...prev,
            registration: { date: new Date(profReg.updated_at).toLocaleDateString(), candidateUser: true },
          }));
        }
      }

      // 5. Work Experience
      const { data: weData } = await supabase
        .from('candidate_work_experience')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('entry_order', { ascending: true });
      if (weData && weData.length > 0) {
        setWorkEntries(weData);
        const hasCandUpdate = weData.some((w) => w.updated_at && (!w.updated_by || w.updated_by === cand.user_id));
        if (hasCandUpdate) {
          setConflictSection((prev) => ({
            ...prev,
            experience: { date: new Date(weData[0].updated_at || weData[0].created_at).toLocaleDateString(), candidateUser: true },
          }));
        }
      }

      // 6. Language Proficiency
      const { data: lpData } = await supabase
        .from('candidate_language_proficiency')
        .select('*')
        .eq('candidate_id', candidateId)
        .maybeSingle();
      if (lpData) {
        setLanguageProficiency(lpData);
        if (lpData.updated_at && (!lpData.updated_by || lpData.updated_by === cand.user_id)) {
          setConflictSection((prev) => ({
            ...prev,
            language: { date: new Date(lpData.updated_at).toLocaleDateString(), candidateUser: true },
          }));
        }
      }

      // 7. Documents
      const { data: docs } = await supabase
        .from('documents')
        .select('*')
        .eq('candidate_id', candidateId);
      setDocuments(docs || []);

      // 8. Notes
      await loadNotes();

      // 9. Progress Gates
      const { data: gates } = await supabase
        .from('gate_results')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('evaluated_at', { ascending: false });
      setGateResults(gates || []);

      // 10. DT Attempts
      const { data: dtAtt } = await supabase
        .from('dt_attempts')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('started_at', { ascending: false });
      setDtAttempts(dtAtt || []);

      // 11. Speaking Test
      const { data: spSched } = await supabase
        .from('speaking_test_schedules')
        .select('*')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSpeakingSchedule(spSched);

      const { data: spRes } = await supabase
        .from('speaking_test_results')
        .select('id, candidate_id, overall_outcome, review_status, created_at')
        .eq('candidate_id', candidateId)
        .eq('review_status', 'approved')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSpeakingResult(spRes);

      // 12. Bootcamp
      const { data: cm } = await supabase
        .from('cohort_members')
        .select('cohort_id, cohorts(id, cohort_name, status)')
        .eq('candidate_id', candidateId)
        .maybeSingle();
      if (cm?.cohorts) {
        setBootcampCohort(cm.cohorts);
        const { data: bSessions } = await supabase
          .from('bootcamp_sessions')
          .select('id, session_date, title')
          .eq('cohort_id', cm.cohort_id);
        setBootcampSessions(bSessions || []);
      }

      const { data: bAtt } = await supabase
        .from('bootcamp_attendance')
        .select('*')
        .eq('candidate_id', candidateId)
        .eq('attended', true);
      setBootcampAttendance(bAtt || []);

      // 13. Final Assessment
      const { data: fa } = await supabase
        .from('final_test_attempts')
        .select('id, attempt_number, outcome, review_status, consecutive_fail_count, created_at')
        .eq('candidate_id', candidateId)
        .eq('review_status', 'approved')
        .order('attempt_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      setFinalAssessment(fa);

    } catch (err: any) {
      console.error('Error loading candidate detail:', err);
      showToast(err.message || 'Failed to load candidate details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_notes')
        .select('id, note, created_at, author_profile_id, profiles(full_name)')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setNotes(data || []);
    } catch (err) {
      console.error('Error loading notes:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [candidateId]);

  // Profile Lock Rule: interview_ready or placed
  const isProfileLocked = candidate?.status === 'interview_ready' || candidate?.status === 'placed';

  // Completion calculation
  const completionStats = useMemo(() => {
    return calculateProfileCompletion({
      personalInfo,
      education,
      professionalReg,
      workExperience: workEntries,
      totalYearsExperience,
      languageProficiency,
    });
  }, [personalInfo, education, professionalReg, workEntries, totalYearsExperience, languageProficiency]);

  // Sync profile completion % to candidate record
  const syncCandidateCompletion = async (newPct: number) => {
    try {
      await supabase
        .from('candidates')
        .update({
          profile_completion_pct: newPct,
          total_years_experience: Number(totalYearsExperience) || 0,
        })
        .eq('id', candidateId);
      setCandidate((prev: any) => prev ? { ...prev, profile_completion_pct: newPct } : prev);
      if (onCandidateUpdated) onCandidateUpdated();
    } catch (e) {
      console.error('Error syncing profile completion percentage:', e);
    }
  };

  // Section 1: Save Personal Info
  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId) return;

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
      showToast('Fill all mandatory fields in Personal Information.', 'error');
      return;
    }

    try {
      setSavingSection('personal');
      const payload = {
        candidate_id: candidateId,
        full_name: personalInfo.full_name,
        date_of_birth: personalInfo.date_of_birth,
        gender: personalInfo.gender,
        nationality: personalInfo.nationality,
        country_of_residence: personalInfo.country_of_residence,
        city_state: personalInfo.city_state,
        mobile_number: personalInfo.mobile_number,
        whatsapp_same_as_mobile: personalInfo.whatsapp_same_as_mobile ?? true,
        whatsapp_number: personalInfo.whatsapp_same_as_mobile ? null : personalInfo.whatsapp_number,
        email_address: candidate.email, // Always keep original candidate email
        passport_number: personalInfo.passport_number,
        passport_expiry_date: personalInfo.passport_expiry_date,
        updated_at: new Date().toISOString(),
        updated_by: currentProfile?.id || null,
      };

      const { error } = await supabase
        .from('candidate_personal_info')
        .upsert(payload, { onConflict: 'candidate_id' });
      if (error) throw error;

      // Update names on candidate table if altered
      const nameParts = personalInfo.full_name.trim().split(' ');
      const fName = nameParts[0] || candidate.first_name;
      const lName = nameParts.slice(1).join(' ') || candidate.last_name;
      await supabase
        .from('candidates')
        .update({
          first_name: fName,
          last_name: lName,
          nationality: personalInfo.nationality,
        })
        .eq('id', candidateId);

      const newStats = calculateProfileCompletion({
        personalInfo: payload,
        education,
        professionalReg,
        workExperience: workEntries,
        totalYearsExperience,
        languageProficiency,
      });

      await syncCandidateCompletion(newStats.pct);
      setEditingSection((prev) => ({ ...prev, personal: false }));
      setConflictSection((prev) => ({ ...prev, personal: null }));
      showToast('Personal information saved.');
    } catch (err: any) {
      console.error('Error saving personal info:', err);
      showToast(err.message || 'Failed to save personal info.', 'error');
    } finally {
      setSavingSection(null);
    }
  };

  // Section 2: Save Education
  const handleSaveEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId) return;

    if (
      !education.healthcare_profession ||
      !education.specialization ||
      !education.degree_title ||
      !education.college_university ||
      !education.year_of_completion ||
      !education.board_10th ||
      !education.board_12th
    ) {
      showToast('Fill all mandatory fields in Education.', 'error');
      return;
    }

    try {
      setSavingSection('education');
      const payload = {
        candidate_id: candidateId,
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
        internship_institution: education.internship_completed ? education.internship_institution : null,
        updated_at: new Date().toISOString(),
        updated_by: currentProfile?.id || null,
      };

      const { error } = await supabase
        .from('candidate_education')
        .upsert(payload, { onConflict: 'candidate_id' });
      if (error) throw error;

      const newStats = calculateProfileCompletion({
        personalInfo,
        education: payload,
        professionalReg,
        workExperience: workEntries,
        totalYearsExperience,
        languageProficiency,
      });

      await syncCandidateCompletion(newStats.pct);
      setEditingSection((prev) => ({ ...prev, education: false }));
      setConflictSection((prev) => ({ ...prev, education: null }));
      showToast('Education & Qualification saved.');
    } catch (err: any) {
      console.error('Error saving education:', err);
      showToast(err.message || 'Failed to save education details.', 'error');
    } finally {
      setSavingSection(null);
    }
  };

  // Section 3: Save Professional Registration
  const handleSaveProfessionalReg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId) return;

    if (
      !professionalReg.registration_council ||
      !professionalReg.registration_number ||
      !professionalReg.registration_issue_date ||
      !professionalReg.registration_valid_until
    ) {
      showToast('Fill all mandatory fields in Professional Registration.', 'error');
      return;
    }

    try {
      setSavingSection('registration');
      const payload = {
        candidate_id: candidateId,
        registration_council: professionalReg.registration_council,
        registration_number: professionalReg.registration_number,
        registration_issue_date: professionalReg.registration_issue_date,
        registration_valid_until: professionalReg.registration_valid_until,
        state_council_registration: professionalReg.state_council_registration || null,
        additional_professional_license: professionalReg.additional_professional_license || null,
        updated_at: new Date().toISOString(),
        updated_by: currentProfile?.id || null,
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

      await syncCandidateCompletion(newStats.pct);
      setEditingSection((prev) => ({ ...prev, registration: false }));
      setConflictSection((prev) => ({ ...prev, registration: null }));
      showToast('Professional Registration saved.');
    } catch (err: any) {
      console.error('Error saving registration:', err);
      showToast(err.message || 'Failed to save registration details.', 'error');
    } finally {
      setSavingSection(null);
    }
  };

  // Section 4: Save Work Experience
  const handleSaveWorkExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId) return;

    if (workEntries.length === 0) {
      showToast('Add at least one work experience entry.', 'error');
      return;
    }

    for (const [idx, w] of workEntries.entries()) {
      if (!w.employer_name || !w.job_title || !w.department_ward || !w.start_date) {
        showToast(`Fill mandatory fields for work entry #${idx + 1}.`, 'error');
        return;
      }
      if (!w.is_current_employer && !w.end_date) {
        showToast(`Provide end date for past employer #${idx + 1}.`, 'error');
        return;
      }
    }

    try {
      setSavingSection('experience');
      const numYears = Number(totalYearsExperience) || 0;

      // Update total years on candidate
      await supabase
        .from('candidates')
        .update({ total_years_experience: numYears })
        .eq('id', candidateId);

      // Re-insert work experience entries
      await supabase
        .from('candidate_work_experience')
        .delete()
        .eq('candidate_id', candidateId);

      const rowsToInsert = workEntries.map((w, idx) => ({
        candidate_id: candidateId,
        total_years_experience: numYears,
        is_current_employer: Boolean(w.is_current_employer),
        employer_name: w.employer_name,
        job_title: w.job_title,
        department_ward: w.department_ward,
        start_date: w.start_date,
        end_date: w.is_current_employer ? null : w.end_date || null,
        notice_period: w.is_current_employer ? w.notice_period || null : null,
        entry_order: idx + 1,
        updated_at: new Date().toISOString(),
        updated_by: currentProfile?.id || null,
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

      await syncCandidateCompletion(newStats.pct);
      setEditingSection((prev) => ({ ...prev, experience: false }));
      setConflictSection((prev) => ({ ...prev, experience: null }));
      showToast('Work Experience saved.');
    } catch (err: any) {
      console.error('Error saving work experience:', err);
      showToast(err.message || 'Failed to save work experience.', 'error');
    } finally {
      setSavingSection(null);
    }
  };

  // Section 5: Save German Language Proficiency
  const handleSaveLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateId) return;

    if (!languageProficiency.current_german_level) {
      showToast('Select current German language level.', 'error');
      return;
    }

    try {
      setSavingSection('language');
      const payload = {
        candidate_id: candidateId,
        current_german_level: languageProficiency.current_german_level,
        b1_certificate_obtained: Boolean(languageProficiency.b1_certificate_obtained),
        b1_certificate_date: languageProficiency.b1_certificate_obtained ? languageProficiency.b1_certificate_date || null : null,
        b2_certificate_obtained: Boolean(languageProficiency.b2_certificate_obtained),
        b2_certificate_date: languageProficiency.b2_certificate_obtained ? languageProficiency.b2_certificate_date || null : null,
        enrolled_in_german_course: Boolean(languageProficiency.enrolled_in_german_course),
        training_institute_name: languageProficiency.enrolled_in_german_course ? languageProficiency.training_institute_name : null,
        updated_at: new Date().toISOString(),
        updated_by: currentProfile?.id || null,
      };

      const { error } = await supabase
        .from('candidate_language_proficiency')
        .upsert(payload, { onConflict: 'candidate_id' });
      if (error) throw error;

      await supabase
        .from('candidates')
        .update({ language_level_self_reported: languageProficiency.current_german_level })
        .eq('id', candidateId);

      const newStats = calculateProfileCompletion({
        personalInfo,
        education,
        professionalReg,
        workExperience: workEntries,
        totalYearsExperience,
        languageProficiency: payload,
      });

      await syncCandidateCompletion(newStats.pct);
      setEditingSection((prev) => ({ ...prev, language: false }));
      setConflictSection((prev) => ({ ...prev, language: null }));
      showToast('German Language Proficiency saved.');
    } catch (err: any) {
      console.error('Error saving language proficiency:', err);
      showToast(err.message || 'Failed to save language details.', 'error');
    } finally {
      setSavingSection(null);
    }
  };

  // Tab 2: Document Upload & Notification
  const handleUploadDocument = async (docTypeConfig: any, file: File) => {
    if (!candidateId) return;

    try {
      setUploadingDocType(docTypeConfig.document_type);

      const cleanFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storagePath = `${candidateId}/${docTypeConfig.document_type}/${cleanFileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('candidate-documents')
        .upload(storagePath, file, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: publicUrlData } = supabase.storage
        .from('candidate-documents')
        .getPublicUrl(storagePath);

      const fileUrl = publicUrlData?.publicUrl || storagePath;

      // Upsert into documents table
      const docPayload = {
        candidate_id: candidateId,
        document_type: docTypeConfig.document_type,
        document_label: docTypeConfig.label,
        is_mandatory: docTypeConfig.is_mandatory,
        source_section: docTypeConfig.source_section,
        notes: docTypeConfig.notes,
        file_url: fileUrl,
        status: 'pending',
        uploaded_at: new Date().toISOString(),
        rejection_reason: null,
        verified_by: null,
        verified_at: null,
        verification_notes: null,
      };

      // Check if row already exists
      const existingDoc = documents.find((d) => d.document_type === docTypeConfig.document_type);
      if (existingDoc?.id) {
        const { error: updateErr } = await supabase
          .from('documents')
          .update(docPayload)
          .eq('id', existingDoc.id);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('documents')
          .insert(docPayload);
        if (insertErr) throw insertErr;
      }

      // 1. Notify Candidate
      if (candidate?.user_id) {
        await supabase.from('notifications').insert({
          user_id: candidate.user_id,
          title: 'Document Uploaded',
          message: `Your supplier uploaded ${docTypeConfig.label} on your behalf. Check your My Documents tab.`,
          type: 'general',
          read: false,
        });
      }

      // 2. Notify Candidate RM if assigned
      const { data: rmAssoc } = await supabase
        .from('rm_assignments')
        .select('rm_profile_id')
        .eq('entity_type', 'candidate')
        .eq('entity_id', candidateId)
        .eq('active', true)
        .maybeSingle();

      if (rmAssoc?.rm_profile_id) {
        const candFullName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Candidate';
        await supabase.from('notifications').insert({
          user_id: rmAssoc.rm_profile_id,
          title: 'Supplier Uploaded Document',
          message: `${supplierCompany} uploaded ${docTypeConfig.label} for ${candFullName}. Ready for review.`,
          type: 'general',
          read: false,
        });
      }

      // Refresh documents
      const { data: refreshedDocs } = await supabase
        .from('documents')
        .select('*')
        .eq('candidate_id', candidateId);
      setDocuments(refreshedDocs || []);

      showToast(`${docTypeConfig.label} uploaded successfully.`);
      if (onCandidateUpdated) onCandidateUpdated();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      showToast(err.message || 'Failed to upload document.', 'error');
    } finally {
      setUploadingDocType(null);
    }
  };

  // Tab 3: Notes Submit
  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !candidateId || !supplierId) return;

    try {
      setSavingNote(true);
      const { error } = await supabase.from('supplier_notes').insert({
        supplier_id: supplierId,
        candidate_id: candidateId,
        author_profile_id: currentProfile?.id || null,
        note: newNote.trim(),
      });
      if (error) throw error;

      setNewNote('');
      await loadNotes();
      showToast('Note added.');
    } catch (err: any) {
      console.error('Error saving note:', err);
      showToast(err.message || 'Failed to add note.', 'error');
    } finally {
      setSavingNote(false);
    }
  };

  // Documents mapping and stats
  const docsMap = useMemo(() => {
    const map: Record<string, any> = {};
    documents.forEach((d) => {
      map[d.document_type] = d;
    });
    return map;
  }, [documents]);

  const docStats = useMemo(() => {
    let verified = 0;
    let pending = 0;
    let notUploaded = 0;
    let rejected = 0;

    ALL_DOCUMENT_TYPES.forEach((t) => {
      const doc = docsMap[t.document_type];
      const st = doc?.status || 'not_uploaded';
      if (st === 'verified') verified++;
      else if (st === 'pending' || st === 'under_review') pending++;
      else if (st === 'rejected') rejected++;
      else notUploaded++;
    });

    const total = ALL_DOCUMENT_TYPES.length;
    const pct = Math.round((verified / total) * 100);

    return { verified, pending, notUploaded, rejected, total, pct };
  }, [docsMap]);

  // Filtered document types
  const filteredDocConfigs = useMemo(() => {
    if (docFilter === 'all') return ALL_DOCUMENT_TYPES;
    return ALL_DOCUMENT_TYPES.filter((t) => t.source_section === docFilter);
  }, [docFilter]);

  // Passport Warning check (<18 months)
  const isPassportNearExpiry = useMemo(() => {
    if (!personalInfo.passport_expiry_date) return false;
    const exp = new Date(personalInfo.passport_expiry_date).getTime();
    const threshold = Date.now() + 18 * 30 * 24 * 60 * 60 * 1000;
    return exp < threshold;
  }, [personalInfo.passport_expiry_date]);

  // Reg Valid Warning check (<12 months)
  const isRegNearExpiry = useMemo(() => {
    if (!professionalReg.registration_valid_until) return false;
    const exp = new Date(professionalReg.registration_valid_until).getTime();
    const threshold = Date.now() + 12 * 30 * 24 * 60 * 60 * 1000;
    return exp < threshold;
  }, [professionalReg.registration_valid_until]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B3270]" />
        <span className="text-xs text-slate-500 font-medium">Loading candidate details...</span>
      </div>
    );
  }

  const fullName = `${candidate?.first_name || ''} ${candidate?.last_name || ''}`.trim() || 'Candidate';
  const profilePct = candidate?.profile_completion_pct ?? completionStats.pct;

  return (
    <div className="flex flex-col h-full bg-slate-50 text-[#0F172A] relative">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-2.5 rounded-[8px] text-xs font-semibold shadow-lg transition-all animate-in slide-in-from-top-2 duration-200 flex items-center space-x-2 ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : toast.type === 'info'
              ? 'bg-amber-600 text-white'
              : 'bg-[#1B3270] text-white'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER (56px) */}
      <div className="h-14 px-6 bg-white border-b border-[#E2E8F4] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 hover:text-[#1B3270] bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-[6px] transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>
          <div className="h-4 w-[1px] bg-slate-200" />
          <h2 className="text-sm font-bold text-[#1B3270] truncate max-w-sm">{fullName}</h2>
        </div>

        {/* Sub-header Badges */}
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#1B3270]/10 text-[#1B3270] capitalize">
            {candidate?.target_role || 'Healthcare'}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            German {candidate?.language_level_self_reported || 'B1'}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-[#2952A3] border border-blue-200 capitalize">
            {candidate?.status?.replace('_', ' ') || 'Onboarding'}
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
              profilePct >= 100
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : profilePct >= 50
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            Profile {profilePct}% complete
          </span>
        </div>
      </div>

      {/* TAB BAR */}
      <div className="bg-white border-b border-[#E2E8F4] px-6 shrink-0 flex items-center space-x-6">
        {[
          { id: 'profile', label: 'Profile' },
          { id: 'documents', label: 'Documents' },
          { id: 'notes', label: 'Notes' },
          { id: 'progress', label: 'Progress' },
        ].map((t) => {
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-[#1B3270] text-[#1B3270]'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT AREA */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ========================================================================= */}
        {/* TAB 1: PROFILE */}
        {/* ========================================================================= */}
        {activeTab === 'profile' && (
          <div className="max-w-4xl mx-auto space-y-5">
            {/* PROFILE LOCK BANNER */}
            {isProfileLocked && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-[8px] flex items-center space-x-3 text-xs text-amber-900 font-medium">
                <Lock size={16} className="text-amber-700 shrink-0" />
                <span>Profile locked — candidate has completed qualification.</span>
              </div>
            )}

            {/* SECTION 1: PERSONAL INFORMATION */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-xs overflow-hidden">
              <div
                className="px-5 py-3.5 bg-slate-50/70 border-b border-[#E2E8F4] flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpandedSections((prev) => ({ ...prev, personal: !prev.personal }))}
              >
                <div className="flex items-center space-x-3">
                  <User size={16} className="text-[#1B3270]" />
                  <span className="text-xs font-bold text-[#1B3270]">1. Personal Information</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      completionStats.personalFilled >= 9
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : completionStats.personalFilled > 0
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {completionStats.personalFilled}/9 fields
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {!isProfileLocked && !editingSection.personal && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSections((prev) => ({ ...prev, personal: true }));
                        setEditingSection((prev) => ({ ...prev, personal: true }));
                      }}
                      className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                  {isProfileLocked && (
                    <span className="flex items-center space-x-1 text-[11px] text-slate-400">
                      <Lock size={12} />
                      <span>Locked</span>
                    </span>
                  )}
                  {expandedSections.personal ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {expandedSections.personal && (
                <div className="p-5">
                  {/* Conflict Banner */}
                  {editingSection.personal && conflictSection.personal && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-[8px] flex items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                        <span>
                          Last updated by the candidate on {conflictSection.personal.date}. Saving will overwrite their changes.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingSection((prev) => ({ ...prev, personal: false }))}
                        className="text-xs font-semibold text-amber-800 underline hover:text-amber-950 cursor-pointer ml-3 shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSavePersonal} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Full Name (as per passport) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.personal}
                          value={personalInfo.full_name || ''}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, full_name: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:border-[#1B3270]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Date of Birth <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          disabled={!editingSection.personal}
                          value={personalInfo.date_of_birth || ''}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, date_of_birth: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:border-[#1B3270]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Gender <span className="text-rose-500">*</span>
                        </label>
                        <select
                          disabled={!editingSection.personal}
                          value={personalInfo.gender || ''}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, gender: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:border-[#1B3270]"
                        >
                          <option value="">Select Gender</option>
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Nationality <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.personal}
                          value={personalInfo.nationality || ''}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, nationality: e.target.value })}
                          placeholder="e.g. Indian"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:border-[#1B3270]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Country of Residence <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.personal}
                          value={personalInfo.country_of_residence || ''}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, country_of_residence: e.target.value })}
                          placeholder="e.g. India"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:border-[#1B3270]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          City / State <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.personal}
                          value={personalInfo.city_state || ''}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, city_state: e.target.value })}
                          placeholder="e.g. Kochi, Kerala"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:border-[#1B3270]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Mobile Number (Country Code + Number) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.personal}
                          value={personalInfo.mobile_number || ''}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, mobile_number: e.target.value })}
                          placeholder="+91 9876543210"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:border-[#1B3270]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Email Address (Read-only)
                        </label>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={candidate.email || ''}
                          className="w-full px-3 py-2 border border-[#E2E8F4] bg-slate-100 text-slate-500 rounded-[6px] cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Passport Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.personal}
                          value={personalInfo.passport_number || ''}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, passport_number: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:border-[#1B3270]"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Passport Expiry Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          disabled={!editingSection.personal}
                          value={personalInfo.passport_expiry_date || ''}
                          onChange={(e) => setPersonalInfo({ ...personalInfo, passport_expiry_date: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600 focus:outline-none focus:border-[#1B3270]"
                        />
                        {isPassportNearExpiry && (
                          <span className="text-[11px] text-amber-700 font-medium block mt-1">
                            Warning: Passport expires in less than 18 months.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!editingSection.personal}
                          checked={personalInfo.whatsapp_same_as_mobile ?? true}
                          onChange={(e) =>
                            setPersonalInfo({
                              ...personalInfo,
                              whatsapp_same_as_mobile: e.target.checked,
                              whatsapp_number: e.target.checked ? null : personalInfo.whatsapp_number,
                            })
                          }
                          className="rounded text-[#1B3270]"
                        />
                        <span>WhatsApp number is the same as mobile number</span>
                      </label>

                      {!(personalInfo.whatsapp_same_as_mobile ?? true) && (
                        <div className="mt-2 max-w-sm">
                          <label className="block font-semibold text-slate-700 mb-1 text-xs">
                            WhatsApp Number
                          </label>
                          <input
                            type="text"
                            disabled={!editingSection.personal}
                            value={personalInfo.whatsapp_number || ''}
                            onChange={(e) => setPersonalInfo({ ...personalInfo, whatsapp_number: e.target.value })}
                            placeholder="+91 9876543210"
                            className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs disabled:bg-slate-50 disabled:text-slate-600"
                          />
                        </div>
                      )}
                    </div>

                    {editingSection.personal && (
                      <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingSection((prev) => ({ ...prev, personal: false }))}
                          className="px-3 py-1.5 border border-[#E2E8F4] hover:bg-slate-100 rounded-[6px] text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingSection === 'personal'}
                          className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1.5"
                        >
                          {savingSection === 'personal' && <Loader2 size={13} className="animate-spin" />}
                          <span>Save Personal Info</span>
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>

            {/* SECTION 2: EDUCATION & QUALIFICATION */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-xs overflow-hidden">
              <div
                className="px-5 py-3.5 bg-slate-50/70 border-b border-[#E2E8F4] flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpandedSections((prev) => ({ ...prev, education: !prev.education }))}
              >
                <div className="flex items-center space-x-3">
                  <GraduationCap size={16} className="text-[#1B3270]" />
                  <span className="text-xs font-bold text-[#1B3270]">2. Education & Qualification</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      completionStats.educationFilled >= 7
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : completionStats.educationFilled > 0
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {completionStats.educationFilled}/7 fields
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {!isProfileLocked && !editingSection.education && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSections((prev) => ({ ...prev, education: true }));
                        setEditingSection((prev) => ({ ...prev, education: true }));
                      }}
                      className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                  {isProfileLocked && (
                    <span className="flex items-center space-x-1 text-[11px] text-slate-400">
                      <Lock size={12} />
                      <span>Locked</span>
                    </span>
                  )}
                  {expandedSections.education ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {expandedSections.education && (
                <div className="p-5">
                  {editingSection.education && conflictSection.education && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-[8px] flex items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                        <span>
                          Last updated by the candidate on {conflictSection.education.date}. Saving will overwrite their changes.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingSection((prev) => ({ ...prev, education: false }))}
                        className="text-xs font-semibold text-amber-800 underline hover:text-amber-950 cursor-pointer ml-3 shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSaveEducation} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Healthcare Profession <span className="text-rose-500">*</span>
                        </label>
                        <select
                          disabled={!editingSection.education}
                          value={education.healthcare_profession || ''}
                          onChange={(e) => setEducation({ ...education, healthcare_profession: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        >
                          <option value="">Select Profession</option>
                          <option value="Nursing General">Nursing General</option>
                          <option value="Nursing Specialised">Nursing Specialised</option>
                          <option value="Physiotherapy">Physiotherapy</option>
                          <option value="Pharmacy">Pharmacy</option>
                          <option value="Medical Lab">Medical Lab</option>
                          <option value="Radiology">Radiology</option>
                          <option value="Dental">Dental</option>
                          <option value="Care Work">Care Work</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Specialization <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.education}
                          value={education.specialization || ''}
                          onChange={(e) => setEducation({ ...education, specialization: e.target.value })}
                          placeholder="e.g. Critical Care, OT, Pediatrics"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Degree / Diploma Title <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.education}
                          value={education.degree_title || ''}
                          onChange={(e) => setEducation({ ...education, degree_title: e.target.value })}
                          placeholder="e.g. B.Sc. Nursing"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          College / University Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.education}
                          value={education.college_university || ''}
                          onChange={(e) => setEducation({ ...education, college_university: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Year of Completion <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          disabled={!editingSection.education}
                          value={education.year_of_completion || ''}
                          onChange={(e) => setEducation({ ...education, year_of_completion: e.target.value })}
                          placeholder="YYYY"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            10th Board <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            disabled={!editingSection.education}
                            value={education.board_10th || ''}
                            onChange={(e) => setEducation({ ...education, board_10th: e.target.value })}
                            placeholder="CBSE / State"
                            className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">10th Year</label>
                          <input
                            type="number"
                            disabled={!editingSection.education}
                            value={education.year_10th || ''}
                            onChange={(e) => setEducation({ ...education, year_10th: e.target.value })}
                            placeholder="YYYY"
                            className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">
                            12th Board <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            disabled={!editingSection.education}
                            value={education.board_12th || ''}
                            onChange={(e) => setEducation({ ...education, board_12th: e.target.value })}
                            placeholder="CBSE / State"
                            className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">12th Year</label>
                          <input
                            type="number"
                            disabled={!editingSection.education}
                            value={education.year_12th || ''}
                            onChange={(e) => setEducation({ ...education, year_12th: e.target.value })}
                            placeholder="YYYY"
                            className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center space-x-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={!editingSection.education}
                          checked={Boolean(education.internship_completed)}
                          onChange={(e) =>
                            setEducation({
                              ...education,
                              internship_completed: e.target.checked,
                              internship_institution: e.target.checked ? education.internship_institution : '',
                            })
                          }
                          className="rounded text-[#1B3270]"
                        />
                        <span>Internship completed</span>
                      </label>

                      {education.internship_completed && (
                        <div className="mt-2 max-w-md">
                          <label className="block font-semibold text-slate-700 mb-1 text-xs">
                            Internship Institution Name
                          </label>
                          <input
                            type="text"
                            disabled={!editingSection.education}
                            value={education.internship_institution || ''}
                            onChange={(e) => setEducation({ ...education, internship_institution: e.target.value })}
                            placeholder="Hospital / Clinic Name"
                            className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] text-xs disabled:bg-slate-50 disabled:text-slate-600"
                          />
                        </div>
                      )}
                    </div>

                    {editingSection.education && (
                      <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingSection((prev) => ({ ...prev, education: false }))}
                          className="px-3 py-1.5 border border-[#E2E8F4] hover:bg-slate-100 rounded-[6px] text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingSection === 'education'}
                          className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1.5"
                        >
                          {savingSection === 'education' && <Loader2 size={13} className="animate-spin" />}
                          <span>Save Education</span>
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>

            {/* SECTION 3: PROFESSIONAL REGISTRATION */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-xs overflow-hidden">
              <div
                className="px-5 py-3.5 bg-slate-50/70 border-b border-[#E2E8F4] flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpandedSections((prev) => ({ ...prev, registration: !prev.registration }))}
              >
                <div className="flex items-center space-x-3">
                  <Award size={16} className="text-[#1B3270]" />
                  <span className="text-xs font-bold text-[#1B3270]">3. Professional Registration</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      completionStats.professionalFilled >= 4
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : completionStats.professionalFilled > 0
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {completionStats.professionalFilled}/4 fields
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {!isProfileLocked && !editingSection.registration && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSections((prev) => ({ ...prev, registration: true }));
                        setEditingSection((prev) => ({ ...prev, registration: true }));
                      }}
                      className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                  {isProfileLocked && (
                    <span className="flex items-center space-x-1 text-[11px] text-slate-400">
                      <Lock size={12} />
                      <span>Locked</span>
                    </span>
                  )}
                  {expandedSections.registration ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {expandedSections.registration && (
                <div className="p-5">
                  {editingSection.registration && conflictSection.registration && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-[8px] flex items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                        <span>
                          Last updated by the candidate on {conflictSection.registration.date}. Saving will overwrite their changes.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingSection((prev) => ({ ...prev, registration: false }))}
                        className="text-xs font-semibold text-amber-800 underline hover:text-amber-950 cursor-pointer ml-3 shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSaveProfessionalReg} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Registration Council / Body <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.registration}
                          value={professionalReg.registration_council || ''}
                          onChange={(e) => setProfessionalReg({ ...professionalReg, registration_council: e.target.value })}
                          placeholder="e.g. Kerala Nursing Council"
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Registration Number <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.registration}
                          value={professionalReg.registration_number || ''}
                          onChange={(e) => setProfessionalReg({ ...professionalReg, registration_number: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Registration Issue Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          disabled={!editingSection.registration}
                          value={professionalReg.registration_issue_date || ''}
                          onChange={(e) => setProfessionalReg({ ...professionalReg, registration_issue_date: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Registration Valid Until <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          disabled={!editingSection.registration}
                          value={professionalReg.registration_valid_until || ''}
                          onChange={(e) => setProfessionalReg({ ...professionalReg, registration_valid_until: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        />
                        {isRegNearExpiry && (
                          <span className="text-[11px] text-amber-700 font-medium block mt-1">
                            Warning: Registration expires in less than 12 months.
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          State Council Registration (optional)
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.registration}
                          value={professionalReg.state_council_registration || ''}
                          onChange={(e) => setProfessionalReg({ ...professionalReg, state_council_registration: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        />
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Additional Professional License (optional)
                        </label>
                        <input
                          type="text"
                          disabled={!editingSection.registration}
                          value={professionalReg.additional_professional_license || ''}
                          onChange={(e) => setProfessionalReg({ ...professionalReg, additional_professional_license: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        />
                      </div>
                    </div>

                    {editingSection.registration && (
                      <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingSection((prev) => ({ ...prev, registration: false }))}
                          className="px-3 py-1.5 border border-[#E2E8F4] hover:bg-slate-100 rounded-[6px] text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingSection === 'registration'}
                          className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1.5"
                        >
                          {savingSection === 'registration' && <Loader2 size={13} className="animate-spin" />}
                          <span>Save Registration</span>
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>

            {/* SECTION 4: WORK EXPERIENCE */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-xs overflow-hidden">
              <div
                className="px-5 py-3.5 bg-slate-50/70 border-b border-[#E2E8F4] flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpandedSections((prev) => ({ ...prev, experience: !prev.experience }))}
              >
                <div className="flex items-center space-x-3">
                  <Briefcase size={16} className="text-[#1B3270]" />
                  <span className="text-xs font-bold text-[#1B3270]">4. Work Experience</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      completionStats.experienceFilled >= 7
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : completionStats.experienceFilled > 0
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {completionStats.experienceFilled}/7 fields
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {!isProfileLocked && !editingSection.experience && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSections((prev) => ({ ...prev, experience: true }));
                        setEditingSection((prev) => ({ ...prev, experience: true }));
                      }}
                      className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                  {isProfileLocked && (
                    <span className="flex items-center space-x-1 text-[11px] text-slate-400">
                      <Lock size={12} />
                      <span>Locked</span>
                    </span>
                  )}
                  {expandedSections.experience ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {expandedSections.experience && (
                <div className="p-5">
                  {editingSection.experience && conflictSection.experience && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-[8px] flex items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                        <span>
                          Last updated by the candidate on {conflictSection.experience.date}. Saving will overwrite their changes.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingSection((prev) => ({ ...prev, experience: false }))}
                        className="text-xs font-semibold text-amber-800 underline hover:text-amber-950 cursor-pointer ml-3 shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSaveWorkExperience} className="space-y-4">
                    {/* Global Field */}
                    <div className="max-w-xs text-xs">
                      <label className="block font-semibold text-slate-700 mb-1">
                        Total Years of Experience <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        disabled={!editingSection.experience}
                        value={totalYearsExperience}
                        onChange={(e) => setTotalYearsExperience(e.target.value)}
                        placeholder="e.g. 3.5"
                        className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                      />
                    </div>

                    {/* Entries List */}
                    <div className="space-y-4 pt-2">
                      {workEntries.map((w, idx) => (
                        <div key={idx} className="p-4 border border-[#E2E8F4] rounded-[8px] bg-slate-50/50 relative text-xs">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-bold text-slate-700">Work Entry #{idx + 1}</span>
                            {editingSection.experience && workEntries.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setWorkEntries(workEntries.filter((_, i) => i !== idx));
                                }}
                                className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">
                                Employer / Hospital Name <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                disabled={!editingSection.experience}
                                value={w.employer_name || ''}
                                onChange={(e) => {
                                  const updated = [...workEntries];
                                  updated[idx] = { ...updated[idx], employer_name: e.target.value };
                                  setWorkEntries(updated);
                                }}
                                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] bg-white disabled:bg-slate-50 disabled:text-slate-600"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">
                                Job Title / Designation <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                disabled={!editingSection.experience}
                                value={w.job_title || ''}
                                onChange={(e) => {
                                  const updated = [...workEntries];
                                  updated[idx] = { ...updated[idx], job_title: e.target.value };
                                  setWorkEntries(updated);
                                }}
                                placeholder="Staff Nurse, Specialist, etc."
                                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] bg-white disabled:bg-slate-50 disabled:text-slate-600"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">
                                Department / Ward <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="text"
                                disabled={!editingSection.experience}
                                value={w.department_ward || ''}
                                onChange={(e) => {
                                  const updated = [...workEntries];
                                  updated[idx] = { ...updated[idx], department_ward: e.target.value };
                                  setWorkEntries(updated);
                                }}
                                placeholder="ICU, Emergency, General Ward"
                                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] bg-white disabled:bg-slate-50 disabled:text-slate-600"
                              />
                            </div>

                            <div>
                              <label className="block font-semibold text-slate-700 mb-1">
                                Start Date <span className="text-rose-500">*</span>
                              </label>
                              <input
                                type="date"
                                disabled={!editingSection.experience}
                                value={w.start_date || ''}
                                onChange={(e) => {
                                  const updated = [...workEntries];
                                  updated[idx] = { ...updated[idx], start_date: e.target.value };
                                  setWorkEntries(updated);
                                }}
                                className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] bg-white disabled:bg-slate-50 disabled:text-slate-600"
                              />
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-[#E2E8F4]/70">
                            <label className="flex items-center space-x-2 cursor-pointer mb-2">
                              <input
                                type="checkbox"
                                disabled={!editingSection.experience}
                                checked={Boolean(w.is_current_employer)}
                                onChange={(e) => {
                                  const updated = [...workEntries];
                                  updated[idx] = {
                                    ...updated[idx],
                                    is_current_employer: e.target.checked,
                                    end_date: e.target.checked ? null : updated[idx].end_date,
                                  };
                                  setWorkEntries(updated);
                                }}
                                className="rounded text-[#1B3270]"
                              />
                              <span className="font-semibold text-slate-700">Currently employed here</span>
                            </label>

                            {w.is_current_employer ? (
                              <div className="max-w-xs">
                                <label className="block font-semibold text-slate-700 mb-1">Notice Period</label>
                                <input
                                  type="text"
                                  disabled={!editingSection.experience}
                                  value={w.notice_period || ''}
                                  onChange={(e) => {
                                    const updated = [...workEntries];
                                    updated[idx] = { ...updated[idx], notice_period: e.target.value };
                                    setWorkEntries(updated);
                                  }}
                                  placeholder="e.g. 1 month / Immediate"
                                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] bg-white disabled:bg-slate-50 disabled:text-slate-600"
                                />
                              </div>
                            ) : (
                              <div className="max-w-xs">
                                <label className="block font-semibold text-slate-700 mb-1">
                                  End Date <span className="text-rose-500">*</span>
                                </label>
                                <input
                                  type="date"
                                  disabled={!editingSection.experience}
                                  value={w.end_date || ''}
                                  onChange={(e) => {
                                    const updated = [...workEntries];
                                    updated[idx] = { ...updated[idx], end_date: e.target.value };
                                    setWorkEntries(updated);
                                  }}
                                  className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] bg-white disabled:bg-slate-50 disabled:text-slate-600"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {editingSection.experience && (
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setWorkEntries([
                              ...workEntries,
                              {
                                employer_name: '',
                                job_title: '',
                                department_ward: '',
                                start_date: '',
                                end_date: null,
                                is_current_employer: false,
                                notice_period: null,
                                entry_order: workEntries.length + 1,
                              },
                            ]);
                          }}
                          className="px-3 py-1.5 border border-dashed border-[#1B3270]/40 text-[#1B3270] hover:bg-[#1B3270]/5 rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Add Another Work Entry</span>
                        </button>
                      </div>
                    )}

                    {editingSection.experience && (
                      <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingSection((prev) => ({ ...prev, experience: false }))}
                          className="px-3 py-1.5 border border-[#E2E8F4] hover:bg-slate-100 rounded-[6px] text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingSection === 'experience'}
                          className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1.5"
                        >
                          {savingSection === 'experience' && <Loader2 size={13} className="animate-spin" />}
                          <span>Save Work Experience</span>
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>

            {/* SECTION 5: GERMAN LANGUAGE PROFICIENCY */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] shadow-xs overflow-hidden">
              <div
                className="px-5 py-3.5 bg-slate-50/70 border-b border-[#E2E8F4] flex items-center justify-between cursor-pointer select-none"
                onClick={() => setExpandedSections((prev) => ({ ...prev, language: !prev.language }))}
              >
                <div className="flex items-center space-x-3">
                  <Globe size={16} className="text-[#1B3270]" />
                  <span className="text-xs font-bold text-[#1B3270]">5. German Language Proficiency</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      completionStats.languageFilled >= 3
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : completionStats.languageFilled > 0
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {completionStats.languageFilled}/3 fields
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  {!isProfileLocked && !editingSection.language && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSections((prev) => ({ ...prev, language: true }));
                        setEditingSection((prev) => ({ ...prev, language: true }));
                      }}
                      className="px-3 py-1 bg-[#1B3270] hover:bg-[#2952A3] text-white text-[11px] font-semibold rounded-[6px] transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                  {isProfileLocked && (
                    <span className="flex items-center space-x-1 text-[11px] text-slate-400">
                      <Lock size={12} />
                      <span>Locked</span>
                    </span>
                  )}
                  {expandedSections.language ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                </div>
              </div>

              {expandedSections.language && (
                <div className="p-5">
                  {editingSection.language && conflictSection.language && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-[8px] flex items-center justify-between text-xs text-amber-900">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                        <span>
                          Last updated by the candidate on {conflictSection.language.date}. Saving will overwrite their changes.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingSection((prev) => ({ ...prev, language: false }))}
                        className="text-xs font-semibold text-amber-800 underline hover:text-amber-950 cursor-pointer ml-3 shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSaveLanguage} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">
                          Current German Level <span className="text-rose-500">*</span>
                        </label>
                        <select
                          disabled={!editingSection.language}
                          value={languageProficiency.current_german_level || ''}
                          onChange={(e) => setLanguageProficiency({ ...languageProficiency, current_german_level: e.target.value })}
                          className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                        >
                          <option value="">Select Level</option>
                          <option value="No knowledge">No knowledge</option>
                          <option value="A1">A1</option>
                          <option value="A2">A2</option>
                          <option value="B1">B1</option>
                          <option value="B2">B2</option>
                          <option value="C1">C1</option>
                          <option value="C2">C2</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3 pt-2 text-xs">
                      {/* B1 Toggle */}
                      <div>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!editingSection.language}
                            checked={Boolean(languageProficiency.b1_certificate_obtained)}
                            onChange={(e) =>
                              setLanguageProficiency({
                                ...languageProficiency,
                                b1_certificate_obtained: e.target.checked,
                                b1_certificate_date: e.target.checked ? languageProficiency.b1_certificate_date : '',
                              })
                            }
                            className="rounded text-[#1B3270]"
                          />
                          <span className="font-semibold text-slate-700">B1 Certificate obtained?</span>
                        </label>

                        {languageProficiency.b1_certificate_obtained && (
                          <div className="mt-2 max-w-xs">
                            <label className="block font-semibold text-slate-700 mb-1">Certificate Date</label>
                            <input
                              type="date"
                              disabled={!editingSection.language}
                              value={languageProficiency.b1_certificate_date || ''}
                              onChange={(e) =>
                                setLanguageProficiency({ ...languageProficiency, b1_certificate_date: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                            />
                          </div>
                        )}
                      </div>

                      {/* B2 Toggle */}
                      <div>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!editingSection.language}
                            checked={Boolean(languageProficiency.b2_certificate_obtained)}
                            onChange={(e) =>
                              setLanguageProficiency({
                                ...languageProficiency,
                                b2_certificate_obtained: e.target.checked,
                                b2_certificate_date: e.target.checked ? languageProficiency.b2_certificate_date : '',
                              })
                            }
                            className="rounded text-[#1B3270]"
                          />
                          <span className="font-semibold text-slate-700">B2 Certificate obtained?</span>
                        </label>

                        {languageProficiency.b2_certificate_obtained && (
                          <div className="mt-2 max-w-xs">
                            <label className="block font-semibold text-slate-700 mb-1">Certificate Date</label>
                            <input
                              type="date"
                              disabled={!editingSection.language}
                              value={languageProficiency.b2_certificate_date || ''}
                              onChange={(e) =>
                                setLanguageProficiency({ ...languageProficiency, b2_certificate_date: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                            />
                          </div>
                        )}
                      </div>

                      {/* Enrolled in Course */}
                      <div>
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!editingSection.language}
                            checked={Boolean(languageProficiency.enrolled_in_german_course)}
                            onChange={(e) =>
                              setLanguageProficiency({
                                ...languageProficiency,
                                enrolled_in_german_course: e.target.checked,
                                training_institute_name: e.target.checked ? languageProficiency.training_institute_name : '',
                              })
                            }
                            className="rounded text-[#1B3270]"
                          />
                          <span className="font-semibold text-slate-700">Currently enrolled in German course?</span>
                        </label>

                        {languageProficiency.enrolled_in_german_course && (
                          <div className="mt-2 max-w-sm">
                            <label className="block font-semibold text-slate-700 mb-1">Training Institute Name</label>
                            <input
                              type="text"
                              disabled={!editingSection.language}
                              value={languageProficiency.training_institute_name || ''}
                              onChange={(e) =>
                                setLanguageProficiency({ ...languageProficiency, training_institute_name: e.target.value })
                              }
                              placeholder="e.g. Goethe-Institut"
                              className="w-full px-3 py-2 border border-[#E2E8F4] rounded-[6px] disabled:bg-slate-50 disabled:text-slate-600"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {editingSection.language && (
                      <div className="pt-3 border-t border-[#E2E8F4] flex items-center justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => setEditingSection((prev) => ({ ...prev, language: false }))}
                          className="px-3 py-1.5 border border-[#E2E8F4] hover:bg-slate-100 rounded-[6px] text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={savingSection === 'language'}
                          className="px-4 py-1.5 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1.5"
                        >
                          {savingSection === 'language' && <Loader2 size={13} className="animate-spin" />}
                          <span>Save Language</span>
                        </button>
                      </div>
                    )}
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DOCUMENTS */}
        {/* ========================================================================= */}
        {activeTab === 'documents' && (
          <div className="max-w-4xl mx-auto space-y-5">
            {/* Top Summary Card */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-[#1B3270]">Documents Status Overview</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    <strong className="text-emerald-700">{docStats.verified} verified</strong> ·{' '}
                    <strong className="text-amber-700">{docStats.pending} under review</strong> ·{' '}
                    <strong className="text-slate-500">{docStats.notUploaded} not uploaded</strong>
                    {docStats.rejected > 0 && (
                      <>
                        {' '}· <strong className="text-rose-600">{docStats.rejected} rejected</strong>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-[#1B3270]">{docStats.pct}% Verified</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    docStats.pct === 100 ? 'bg-emerald-500' : docStats.pct >= 50 ? 'bg-amber-500' : 'bg-[#1B3270]'
                  }`}
                  style={{ width: `${docStats.pct}%` }}
                />
              </div>
            </div>

            {/* Info Note */}
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-[8px] text-xs text-blue-900 flex items-center space-x-2">
              <Building size={15} className="text-[#2952A3] shrink-0" />
              <span>
                Documents you upload here are reviewed by the TerraTern team. Verified documents cannot be re-uploaded.
              </span>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'personal', label: 'Personal' },
                { id: 'education', label: 'Education' },
                { id: 'professional', label: 'Professional' },
                { id: 'experience', label: 'Experience' },
                { id: 'language', label: 'Language' },
              ].map((pill) => {
                const isActive = docFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setDocFilter(pill.id as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#1B3270] text-white'
                        : 'bg-white border border-[#E2E8F4] text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
            </div>

            {/* 18 Document Type Cards */}
            <div className="space-y-2.5">
              {filteredDocConfigs.map((docConfig) => {
                const doc = docsMap[docConfig.document_type];
                const status = doc?.status || 'not_uploaded';
                const isVerified = status === 'verified';
                const isUnderReview = status === 'pending' || status === 'under_review';
                const isRejected = status === 'rejected';
                const isUploading = uploadingDocType === docConfig.document_type;

                return (
                  <div
                    key={docConfig.document_type}
                    className="bg-white border border-[#E2E8F4] rounded-[8px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    {/* Left: Label & Helper */}
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-slate-800">{docConfig.label}</span>
                        {docConfig.is_mandatory && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Required
                          </span>
                        )}
                      </div>
                      {docConfig.notes && (
                        <p className="text-[11px] text-slate-400">{docConfig.notes}</p>
                      )}
                      {isRejected && doc?.rejection_reason && (
                        <p className="text-[11px] text-rose-600 font-medium">
                          Rejection Reason: {doc.rejection_reason}
                        </p>
                      )}
                    </div>

                    {/* Center & Right: Status & Actions */}
                    <div className="flex items-center space-x-3 shrink-0">
                      {/* Status Badge */}
                      {isVerified ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                          <CheckCircle2 size={12} />
                          <span>Verified</span>
                        </span>
                      ) : isUnderReview ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center space-x-1">
                          <Clock size={12} />
                          <span>Under Review</span>
                        </span>
                      ) : isRejected ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                          <AlertTriangle size={12} />
                          <span>Rejected</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                          Not Uploaded
                        </span>
                      )}

                      {/* File Link if exists */}
                      {doc?.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[#1B3270] hover:underline flex items-center space-x-1 font-semibold"
                        >
                          <FileText size={13} />
                          <span>View</span>
                        </a>
                      )}

                      {/* Action Button */}
                      {isVerified ? (
                        <span className="text-[11px] text-slate-400 italic">Locked</span>
                      ) : (
                        <label className="px-3 py-1.5 bg-white border border-[#1B3270] text-[#1B3270] hover:bg-[#1B3270]/5 rounded-[6px] text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer">
                          {isUploading ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Upload size={13} />
                          )}
                          <span>
                            {isUnderReview ? 'Replace' : isRejected ? 'Re-upload' : 'Upload for Candidate'}
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={isUploading}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadDocument(docConfig, file);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: NOTES */}
        {/* ========================================================================= */}
        {activeTab === 'notes' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Add Note Form */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-xs">
              <h3 className="text-xs font-bold text-[#1B3270] mb-2">Supplier Internal Note</h3>
              <p className="text-[11px] text-slate-500 mb-3">
                Notes are visible to your team and the TerraTern account manager. Not visible to the candidate.
              </p>
              <form onSubmit={handleSaveNote} className="space-y-3">
                <textarea
                  rows={3}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note about this candidate..."
                  className="w-full p-3 border border-[#E2E8F4] rounded-[6px] text-xs focus:outline-none focus:border-[#1B3270]"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingNote || !newNote.trim()}
                    className="px-4 py-2 bg-[#1B3270] hover:bg-[#2952A3] text-white rounded-[6px] text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    {savingNote ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                    <span>Save Note</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700">Notes History ({notes.length})</h4>
              {notes.length === 0 ? (
                <div className="p-8 text-center bg-white border border-[#E2E8F4] rounded-[10px] text-xs text-slate-400">
                  No notes yet. Add context about this candidate to share with your account manager.
                </div>
              ) : (
                notes.map((n) => (
                  <div key={n.id} className="p-4 bg-white border border-[#E2E8F4] rounded-[8px] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">
                        {n.profiles?.full_name || 'Team Member'}
                      </span>
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap">{n.note}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PROGRESS (READ-ONLY VIEW) */}
        {/* ========================================================================= */}
        {activeTab === 'progress' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* 5-GATE PROGRESS BAR */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-xs">
              <h3 className="text-xs font-bold text-[#1B3270] mb-4">Qualification Gate Pipeline</h3>
              <div className="grid grid-cols-5 gap-2 text-center text-xs">
                {[
                  { id: 'dt', label: '1. Diagnostic Test' },
                  { id: 'doc_verification', label: '2. Documents' },
                  { id: 'speaking_test', label: '3. Speaking Test' },
                  { id: 'bootcamp', label: '4. Bootcamp' },
                  { id: 'assessment', label: '5. Final Assessment' },
                ].map((g) => {
                  const passResult = gateResults.find((r) => r.gate_type === g.id && r.status === 'pass');
                  const failResult = gateResults.find((r) => r.gate_type === g.id && r.status === 'fail');
                  const inProgResult = gateResults.find((r) => r.gate_type === g.id && r.status === 'in_progress');

                  const isPassed = !!passResult;
                  const isFailed = !isPassed && !!failResult;
                  const isInProgress = !isPassed && !isFailed && !!inProgResult;

                  return (
                    <div key={g.id} className="p-3 rounded-[8px] border bg-slate-50/50 flex flex-col items-center justify-center space-y-1">
                      <span className="font-semibold text-[11px] text-slate-600 truncate w-full">{g.label}</span>
                      {isPassed ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Passed
                        </span>
                      ) : isInProgress ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          In Progress
                        </span>
                      ) : isFailed ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          Not Passed
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400 border border-slate-200">
                          Pending
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION: DIAGNOSTIC TEST */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
                <div>
                  <h4 className="text-xs font-bold text-[#1B3270]">Gate 1: Diagnostic Test</h4>
                  <p className="text-[11px] text-slate-400">Telemetry and attempt history</p>
                </div>
                {/* STRICT BOUNDARY: NO TAKE TEST BUTTON HERE */}
                <span className="text-[11px] font-medium text-slate-400 italic">
                  Candidate administered only
                </span>
              </div>

              {(() => {
                const latestDt = dtAttempts[0];
                const dtPass = dtAttempts.find((a) => a.passed === true);
                const count = dtAttempts.length;

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                      <span className="text-slate-500 block text-[11px]">Status</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {dtPass ? 'Passed' : count > 0 ? 'Not Passed' : 'Not Taken'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                      <span className="text-slate-500 block text-[11px]">Attempts Used</span>
                      <span className="font-bold text-slate-800 text-sm">{count} of 10 used</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                      <span className="text-slate-500 block text-[11px]">Best Score</span>
                      <span className="font-bold text-slate-800 text-sm">
                        {dtPass?.score_pct != null ? `${dtPass.score_pct}%` : latestDt?.score_pct != null ? `${latestDt.score_pct}%` : 'N/A'}
                      </span>
                    </div>

                    {latestDt?.cooling_until && new Date(latestDt.cooling_until) > new Date() && (
                      <div className="sm:col-span-3 p-3 bg-amber-50 border border-amber-200 rounded-[6px] text-amber-900 text-xs">
                        Cooling period active until {new Date(latestDt.cooling_until).toLocaleDateString()}.
                      </div>
                    )}

                    {count >= 10 && !dtPass && (
                      <div className="sm:col-span-3 p-3 bg-rose-50 border border-rose-200 rounded-[6px] text-rose-900 text-xs">
                        Attempt limit hit: Preparation period active.
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* SECTION: DOCUMENT VERIFICATION */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
                <div>
                  <h4 className="text-xs font-bold text-[#1B3270]">Gate 2: Document Verification</h4>
                  <p className="text-[11px] text-slate-400">
                    {docStats.verified} of {MANDATORY_DOC_COUNT} mandatory verified
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className="text-xs text-[#1B3270] font-semibold hover:underline cursor-pointer"
                >
                  Manage Documents →
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {ALL_DOCUMENT_TYPES.filter((t) => t.is_mandatory).map((t) => {
                  const doc = docsMap[t.document_type];
                  const st = doc?.status || 'not_uploaded';
                  return (
                    <div key={t.document_type} className="p-2.5 bg-slate-50 rounded-[6px] border border-[#E2E8F4] flex items-center justify-between">
                      <span className="truncate pr-2 text-slate-700 text-[11px]">{t.label}</span>
                      {st === 'verified' ? (
                        <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-slate-400 uppercase font-semibold shrink-0">
                          {st.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* SECTION: SPEAKING TEST */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
                <div>
                  <h4 className="text-xs font-bold text-[#1B3270]">Gate 3: Speaking Test</h4>
                  <p className="text-[11px] text-slate-400">Evaluation outcome</p>
                </div>
                <span className="text-[11px] font-medium text-slate-400 italic">
                  Evaluated by academic mentor
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                  <span className="text-slate-500 block text-[11px]">Status</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {speakingResult
                      ? speakingResult.overall_outcome === 'pass'
                        ? 'Passed'
                        : 'Did Not Pass'
                      : speakingSchedule
                      ? speakingSchedule.status === 'scheduled'
                        ? 'Scheduled'
                        : speakingSchedule.status === 'completed'
                        ? 'Pending Review'
                        : 'Not Scheduled'
                      : 'Not Scheduled'}
                  </span>
                </div>

                {speakingSchedule && (
                  <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                    <span className="text-slate-500 block text-[11px]">Scheduled Session</span>
                    <span className="font-semibold text-slate-800">
                      {speakingSchedule.proposed_date ? new Date(speakingSchedule.proposed_date).toLocaleDateString() : 'Date TBD'}{' '}
                      at {speakingSchedule.proposed_time || 'Time TBD'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION: INTERVIEW BOOTCAMP */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
                <div>
                  <h4 className="text-xs font-bold text-[#1B3270]">Gate 4: Interview Bootcamp</h4>
                  <p className="text-[11px] text-slate-400">Cohort engagement telemetry</p>
                </div>
                <span className="text-[11px] font-medium text-slate-400 italic">
                  Attendance recorded by mentor
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                  <span className="text-slate-500 block text-[11px]">Bootcamp Status</span>
                  <span className="font-bold text-slate-800 text-sm capitalize">
                    {bootcampCohort ? (bootcampCohort.status || 'In Progress') : 'Not Started'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                  <span className="text-slate-500 block text-[11px]">Assigned Cohort</span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {bootcampCohort?.cohort_name || 'Not assigned'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                  <span className="text-slate-500 block text-[11px]">Sessions Attended</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {bootcampAttendance.length} of {Math.max(bootcampSessions.length, 5)} attended
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION: FINAL ASSESSMENT */}
            <div className="bg-white border border-[#E2E8F4] rounded-[10px] p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#E2E8F4] pb-3">
                <div>
                  <h4 className="text-xs font-bold text-[#1B3270]">Gate 5: Final Assessment</h4>
                  <p className="text-[11px] text-slate-400">Final qualification review</p>
                </div>
                <span className="text-[11px] font-medium text-slate-400 italic">
                  Administered by Academic Lead
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                  <span className="text-slate-500 block text-[11px]">Assessment Outcome</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {candidate?.final_test_locked
                      ? 'Locked'
                      : finalAssessment
                      ? finalAssessment.outcome === 'pass'
                        ? 'Pass'
                        : 'Did Not Pass'
                      : 'Not Taken'}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 rounded-[6px] border border-[#E2E8F4]">
                  <span className="text-slate-500 block text-[11px]">Consecutive Fails</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {finalAssessment?.consecutive_fail_count || 0}
                  </span>
                </div>

                {candidate?.final_test_locked && (
                  <div className="sm:col-span-3 p-3 bg-rose-50 border border-rose-200 rounded-[6px] text-rose-900 text-xs">
                    Preparation period active. Candidate is locked until re-qualifying requirements are met.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
