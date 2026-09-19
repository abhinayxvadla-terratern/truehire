export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      academic_requests: {
        Row: {
          approval_notes: string | null
          approval_status: string | null
          approved_by: string | null
          assigned_mentor_id: string | null
          candidate_id: string
          created_at: string
          id: string
          notes: string | null
          request_type: string
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          approval_notes?: string | null
          approval_status?: string | null
          approved_by?: string | null
          assigned_mentor_id?: string | null
          candidate_id: string
          created_at?: string
          id?: string
          notes?: string | null
          request_type?: string
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          approval_notes?: string | null
          approval_status?: string | null
          approved_by?: string | null
          assigned_mentor_id?: string | null
          candidate_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          request_type?: string
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_requests_assigned_mentor_id_fkey"
            columns: ["assigned_mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_requests_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bootcamp_attendance: {
        Row: {
          attended: boolean | null
          candidate_id: string | null
          cohort_id: string | null
          created_at: string | null
          id: string
          marked_by: string | null
          notes: string | null
          session_id: string | null
        }
        Insert: {
          attended?: boolean | null
          candidate_id?: string | null
          cohort_id?: string | null
          created_at?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          session_id?: string | null
        }
        Update: {
          attended?: boolean | null
          candidate_id?: string | null
          cohort_id?: string | null
          created_at?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bootcamp_attendance_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bootcamp_attendance_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bootcamp_attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bootcamp_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "bootcamp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bootcamp_sessions: {
        Row: {
          cohort_id: string | null
          created_at: string | null
          created_by: string | null
          duration_minutes: number | null
          id: string
          notes: string | null
          session_date: string
          session_number: number
          session_time: string
          session_title: string
          status: string | null
          topic: string | null
          updated_at: string | null
        }
        Insert: {
          cohort_id?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          session_date: string
          session_number: number
          session_time: string
          session_title: string
          status?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Update: {
          cohort_id?: string | null
          created_at?: string | null
          created_by?: string | null
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          session_date?: string
          session_number?: number
          session_time?: string
          session_title?: string
          status?: string | null
          topic?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bootcamp_sessions_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bootcamp_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_cv_parses: {
        Row: {
          applied: boolean | null
          candidate_id: string | null
          created_at: string | null
          cv_file_url: string | null
          id: string
          parsed_data: Json | null
          raw_parsed_text: string | null
          status: string | null
        }
        Insert: {
          applied?: boolean | null
          candidate_id?: string | null
          created_at?: string | null
          cv_file_url?: string | null
          id?: string
          parsed_data?: Json | null
          raw_parsed_text?: string | null
          status?: string | null
        }
        Update: {
          applied?: boolean | null
          candidate_id?: string | null
          created_at?: string | null
          cv_file_url?: string | null
          id?: string
          parsed_data?: Json | null
          raw_parsed_text?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_cv_parses_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_education: {
        Row: {
          board_10th: string | null
          board_12th: string | null
          candidate_id: string | null
          college_university: string | null
          created_at: string | null
          degree_title: string | null
          healthcare_profession: string | null
          id: string
          internship_completed: boolean | null
          internship_institution: string | null
          specialization: string | null
          updated_at: string | null
          year_10th: number | null
          year_12th: number | null
          year_of_completion: number | null
        }
        Insert: {
          board_10th?: string | null
          board_12th?: string | null
          candidate_id?: string | null
          college_university?: string | null
          created_at?: string | null
          degree_title?: string | null
          healthcare_profession?: string | null
          id?: string
          internship_completed?: boolean | null
          internship_institution?: string | null
          specialization?: string | null
          updated_at?: string | null
          year_10th?: number | null
          year_12th?: number | null
          year_of_completion?: number | null
        }
        Update: {
          board_10th?: string | null
          board_12th?: string | null
          candidate_id?: string | null
          college_university?: string | null
          created_at?: string | null
          degree_title?: string | null
          healthcare_profession?: string | null
          id?: string
          internship_completed?: boolean | null
          internship_institution?: string | null
          specialization?: string | null
          updated_at?: string | null
          year_10th?: number | null
          year_12th?: number | null
          year_of_completion?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_education_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_language_proficiency: {
        Row: {
          b1_certificate_date: string | null
          b1_certificate_obtained: boolean | null
          b2_certificate_date: string | null
          b2_certificate_obtained: boolean | null
          candidate_id: string | null
          created_at: string | null
          current_german_level: string | null
          enrolled_in_german_course: boolean | null
          id: string
          training_institute_name: string | null
          updated_at: string | null
        }
        Insert: {
          b1_certificate_date?: string | null
          b1_certificate_obtained?: boolean | null
          b2_certificate_date?: string | null
          b2_certificate_obtained?: boolean | null
          candidate_id?: string | null
          created_at?: string | null
          current_german_level?: string | null
          enrolled_in_german_course?: boolean | null
          id?: string
          training_institute_name?: string | null
          updated_at?: string | null
        }
        Update: {
          b1_certificate_date?: string | null
          b1_certificate_obtained?: boolean | null
          b2_certificate_date?: string | null
          b2_certificate_obtained?: boolean | null
          candidate_id?: string | null
          created_at?: string | null
          current_german_level?: string | null
          enrolled_in_german_course?: boolean | null
          id?: string
          training_institute_name?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_language_proficiency_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_offerings: {
        Row: {
          candidate_id: string
          created_at: string
          gate_type_failed: string | null
          id: string
          offering_id: string
          status: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          gate_type_failed?: string | null
          id?: string
          offering_id: string
          status?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          gate_type_failed?: string | null
          id?: string
          offering_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_offerings_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_offerings_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_personal_info: {
        Row: {
          candidate_id: string | null
          city_state: string | null
          country_of_residence: string | null
          created_at: string | null
          date_of_birth: string | null
          email_address: string | null
          full_name: string | null
          gender: string | null
          id: string
          mobile_number: string | null
          nationality: string | null
          passport_expiry_date: string | null
          passport_number: string | null
          updated_at: string | null
          whatsapp_number: string | null
          whatsapp_same_as_mobile: boolean | null
        }
        Insert: {
          candidate_id?: string | null
          city_state?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email_address?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          mobile_number?: string | null
          nationality?: string | null
          passport_expiry_date?: string | null
          passport_number?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
          whatsapp_same_as_mobile?: boolean | null
        }
        Update: {
          candidate_id?: string | null
          city_state?: string | null
          country_of_residence?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email_address?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          mobile_number?: string | null
          nationality?: string | null
          passport_expiry_date?: string | null
          passport_number?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
          whatsapp_same_as_mobile?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_personal_info_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_professional_registration: {
        Row: {
          additional_professional_license: string | null
          candidate_id: string | null
          created_at: string | null
          id: string
          registration_council: string | null
          registration_issue_date: string | null
          registration_number: string | null
          registration_valid_until: string | null
          state_council_registration: string | null
          updated_at: string | null
        }
        Insert: {
          additional_professional_license?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          registration_council?: string | null
          registration_issue_date?: string | null
          registration_number?: string | null
          registration_valid_until?: string | null
          state_council_registration?: string | null
          updated_at?: string | null
        }
        Update: {
          additional_professional_license?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          registration_council?: string | null
          registration_issue_date?: string | null
          registration_number?: string | null
          registration_valid_until?: string | null
          state_council_registration?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_professional_registration_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_work_experience: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          department_ward: string | null
          employer_name: string | null
          end_date: string | null
          entry_order: number | null
          id: string
          is_current_employer: boolean | null
          job_title: string | null
          notice_period: string | null
          start_date: string | null
          total_years_experience: number | null
          updated_at: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          department_ward?: string | null
          employer_name?: string | null
          end_date?: string | null
          entry_order?: number | null
          id?: string
          is_current_employer?: boolean | null
          job_title?: string | null
          notice_period?: string | null
          start_date?: string | null
          total_years_experience?: number | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          department_ward?: string | null
          employer_name?: string | null
          end_date?: string | null
          entry_order?: number | null
          id?: string
          is_current_employer?: boolean | null
          job_title?: string | null
          notice_period?: string | null
          start_date?: string | null
          total_years_experience?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_work_experience_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          assigned_rm_id: string | null
          can_apply_to_jobs: boolean | null
          cohort_id: string | null
          consecutive_final_test_fails: number | null
          created_at: string
          dt_attempt_count: number | null
          dt_consecutive_fails: number | null
          dt_passed_at: string | null
          dt_total_fails_in_window: number | null
          email: string | null
          final_test_locked: boolean | null
          first_name: string | null
          id: string
          invite_token: string | null
          language_level_self_reported: string | null
          last_name: string | null
          nationality: string | null
          phone: string | null
          profile_completion_pct: number | null
          speaking_test_track: string | null
          status: string
          supplier_id: string | null
          target_role: string | null
          total_years_experience: number | null
          user_id: string | null
        }
        Insert: {
          assigned_rm_id?: string | null
          can_apply_to_jobs?: boolean | null
          cohort_id?: string | null
          consecutive_final_test_fails?: number | null
          created_at?: string
          dt_attempt_count?: number | null
          dt_consecutive_fails?: number | null
          dt_passed_at?: string | null
          dt_total_fails_in_window?: number | null
          email?: string | null
          final_test_locked?: boolean | null
          first_name?: string | null
          id?: string
          invite_token?: string | null
          language_level_self_reported?: string | null
          last_name?: string | null
          nationality?: string | null
          phone?: string | null
          profile_completion_pct?: number | null
          speaking_test_track?: string | null
          status?: string
          supplier_id?: string | null
          target_role?: string | null
          total_years_experience?: number | null
          user_id?: string | null
        }
        Update: {
          assigned_rm_id?: string | null
          can_apply_to_jobs?: boolean | null
          cohort_id?: string | null
          consecutive_final_test_fails?: number | null
          created_at?: string
          dt_attempt_count?: number | null
          dt_consecutive_fails?: number | null
          dt_passed_at?: string | null
          dt_total_fails_in_window?: number | null
          email?: string | null
          final_test_locked?: boolean | null
          first_name?: string | null
          id?: string
          invite_token?: string | null
          language_level_self_reported?: string | null
          last_name?: string | null
          nationality?: string | null
          phone?: string | null
          profile_completion_pct?: number | null
          speaking_test_track?: string | null
          status?: string
          supplier_id?: string | null
          target_role?: string | null
          total_years_experience?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidates_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cohort_members: {
        Row: {
          added_by: string | null
          candidate_id: string | null
          cohort_id: string | null
          id: string
          joined_at: string | null
          status: string | null
        }
        Insert: {
          added_by?: string | null
          candidate_id?: string | null
          cohort_id?: string | null
          id?: string
          joined_at?: string | null
          status?: string | null
        }
        Update: {
          added_by?: string | null
          candidate_id?: string | null
          cohort_id?: string | null
          id?: string
          joined_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohort_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_members_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohort_members_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
      cohorts: {
        Row: {
          approved_by: string | null
          bootcamp_end_date: string | null
          bootcamp_start_date: string | null
          created_at: string | null
          created_by: string | null
          id: string
          max_capacity: number | null
          mentor_id: string | null
          mentor_proposal_id: string | null
          name: string
          status: string | null
          track: string
          updated_at: string | null
        }
        Insert: {
          approved_by?: string | null
          bootcamp_end_date?: string | null
          bootcamp_start_date?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_capacity?: number | null
          mentor_id?: string | null
          mentor_proposal_id?: string | null
          name: string
          status?: string | null
          track: string
          updated_at?: string | null
        }
        Update: {
          approved_by?: string | null
          bootcamp_end_date?: string | null
          bootcamp_start_date?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          max_capacity?: number | null
          mentor_id?: string | null
          mentor_proposal_id?: string | null
          name?: string
          status?: string | null
          track?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cohorts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cohorts_mentor_proposal_id_fkey"
            columns: ["mentor_proposal_id"]
            isOneToOne: false
            referencedRelation: "mentor_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      cooling_periods: {
        Row: {
          candidate_id: string | null
          cooling_duration_days: number
          cooling_trigger: string | null
          created_at: string | null
          ends_at: string
          gate_type: string
          id: string
          started_at: string | null
          status: string | null
          triggered_by_attempt_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          cooling_duration_days: number
          cooling_trigger?: string | null
          created_at?: string | null
          ends_at: string
          gate_type: string
          id?: string
          started_at?: string | null
          status?: string | null
          triggered_by_attempt_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          cooling_duration_days?: number
          cooling_trigger?: string | null
          created_at?: string | null
          ends_at?: string
          gate_type?: string
          id?: string
          started_at?: string | null
          status?: string | null
          triggered_by_attempt_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cooling_periods_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          candidate_id: string
          condition_field: string | null
          condition_value: string | null
          document_label: string | null
          document_type: string
          file_url: string | null
          id: string
          is_mandatory: boolean | null
          notes: string | null
          rejection_reason: string | null
          source_section: string | null
          status: string
          uploaded_at: string | null
          verification_notes: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          candidate_id: string
          condition_field?: string | null
          condition_value?: string | null
          document_label?: string | null
          document_type: string
          file_url?: string | null
          id?: string
          is_mandatory?: boolean | null
          notes?: string | null
          rejection_reason?: string | null
          source_section?: string | null
          status?: string
          uploaded_at?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          candidate_id?: string
          condition_field?: string | null
          condition_value?: string | null
          document_label?: string | null
          document_type?: string
          file_url?: string | null
          id?: string
          is_mandatory?: boolean | null
          notes?: string | null
          rejection_reason?: string | null
          source_section?: string | null
          status?: string
          uploaded_at?: string | null
          verification_notes?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dt_answers: {
        Row: {
          answered_at: string | null
          attempt_id: string | null
          id: string
          is_correct: boolean | null
          question_id: string | null
          selected_option: string | null
        }
        Insert: {
          answered_at?: string | null
          attempt_id?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string | null
          selected_option?: string | null
        }
        Update: {
          answered_at?: string | null
          attempt_id?: string | null
          id?: string
          is_correct?: boolean | null
          question_id?: string | null
          selected_option?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "dt_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "dt_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      dt_attempts: {
        Row: {
          attempt_number: number
          auto_submitted: boolean | null
          candidate_id: string | null
          completed_at: string | null
          correct_answers: number | null
          created_at: string | null
          id: string
          passed: boolean | null
          score_pct: number | null
          started_at: string | null
          status: string | null
          time_limit_seconds: number | null
          timer_expires_at: string | null
          total_questions: number | null
        }
        Insert: {
          attempt_number?: number
          auto_submitted?: boolean | null
          candidate_id?: string | null
          completed_at?: string | null
          correct_answers?: number | null
          created_at?: string | null
          id?: string
          passed?: boolean | null
          score_pct?: number | null
          started_at?: string | null
          status?: string | null
          time_limit_seconds?: number | null
          timer_expires_at?: string | null
          total_questions?: number | null
        }
        Update: {
          attempt_number?: number
          auto_submitted?: boolean | null
          candidate_id?: string | null
          completed_at?: string | null
          correct_answers?: number | null
          created_at?: string | null
          id?: string
          passed?: boolean | null
          score_pct?: number | null
          started_at?: string | null
          status?: string | null
          time_limit_seconds?: number | null
          timer_expires_at?: string | null
          total_questions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dt_attempts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      dt_attempt_questions: {
        Row: {
          attempt_id: string
          created_at: string | null
          id: string
          position: number
          question_id: string
        }
        Insert: {
          attempt_id: string
          created_at?: string | null
          id?: string
          position: number
          question_id: string
        }
        Update: {
          attempt_id?: string
          created_at?: string | null
          id?: string
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dt_attempt_questions_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "dt_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dt_attempt_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "dt_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      dt_candidate_seen_questions: {
        Row: {
          candidate_id: string
          first_seen_at: string | null
          id: string
          last_seen_at: string | null
          question_id: string
          times_seen: number | null
        }
        Insert: {
          candidate_id: string
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          question_id: string
          times_seen?: number | null
        }
        Update: {
          candidate_id?: string
          first_seen_at?: string | null
          id?: string
          last_seen_at?: string | null
          question_id?: string
          times_seen?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dt_candidate_seen_questions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dt_candidate_seen_questions_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "dt_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      dt_question_audit: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          previous_data: Json | null
          question_id: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
          question_id?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
          question_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dt_question_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dt_question_audit_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "dt_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      dt_questions: {
        Row: {
          correct_option: string
          created_at: string | null
          difficulty_level: string
          id: string
          is_active: boolean | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_order: number
          question_text: string
          topic: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          correct_option: string
          created_at?: string | null
          difficulty_level: string
          id?: string
          is_active?: boolean | null
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_order: number
          question_text: string
          topic?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          correct_option?: string
          created_at?: string | null
          difficulty_level?: string
          id?: string
          is_active?: boolean | null
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question_order?: number
          question_text?: string
          topic?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dt_questions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_candidate_interests: {
        Row: {
          candidate_id: string | null
          created_at: string | null
          employer_id: string | null
          expressed_by: string | null
          facilitating_rm: string | null
          id: string
          linked_application_id: string | null
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string | null
          employer_id?: string | null
          expressed_by?: string | null
          facilitating_rm?: string | null
          id?: string
          linked_application_id?: string | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string | null
          created_at?: string | null
          employer_id?: string | null
          expressed_by?: string | null
          facilitating_rm?: string | null
          id?: string
          linked_application_id?: string | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_candidate_interests_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_candidate_interests_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_candidate_interests_expressed_by_fkey"
            columns: ["expressed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_candidate_interests_facilitating_rm_fkey"
            columns: ["facilitating_rm"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_candidate_interests_linked_application_id_fkey"
            columns: ["linked_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_rm_messages: {
        Row: {
          created_at: string | null
          employer_id: string | null
          id: string
          message: string
          read: boolean | null
          related_application_id: string | null
          related_job_id: string | null
          sender_display_name: string | null
          sender_profile_id: string | null
          sender_type: string
        }
        Insert: {
          created_at?: string | null
          employer_id?: string | null
          id?: string
          message: string
          read?: boolean | null
          related_application_id?: string | null
          related_job_id?: string | null
          sender_display_name?: string | null
          sender_profile_id?: string | null
          sender_type: string
        }
        Update: {
          created_at?: string | null
          employer_id?: string | null
          id?: string
          message?: string
          read?: boolean | null
          related_application_id?: string | null
          related_job_id?: string | null
          sender_display_name?: string | null
          sender_profile_id?: string | null
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_rm_messages_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_rm_messages_related_application_id_fkey"
            columns: ["related_application_id"]
            isOneToOne: false
            referencedRelation: "job_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_rm_messages_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "job_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_rm_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_team_members: {
        Row: {
          created_at: string | null
          email: string
          employer_id: string | null
          first_name: string
          id: string
          invite_status: string | null
          invite_token: string | null
          invited_by: string | null
          last_name: string
          profile_id: string | null
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          employer_id?: string | null
          first_name: string
          id?: string
          invite_status?: string | null
          invite_token?: string | null
          invited_by?: string | null
          last_name: string
          profile_id?: string | null
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          employer_id?: string | null
          first_name?: string
          id?: string
          invite_status?: string | null
          invite_token?: string | null
          invited_by?: string | null
          last_name?: string
          profile_id?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_team_members_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_team_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employer_team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      employers: {
        Row: {
          annual_hiring_volume: string | null
          company_name: string
          company_size: string | null
          country: string | null
          created_at: string
          created_by_internal: string | null
          description: string | null
          healthcare_roles_hiring: string[] | null
          id: string
          industry: string | null
          is_admin_profile_id: string | null
          location: string | null
          logo_url: string | null
          office_address: string | null
          onboarding_checklist: Json | null
          preferred_source_countries: string[] | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          subscription_tier: string
          user_id: string | null
          website_url: string | null
          year_established: number | null
        }
        Insert: {
          annual_hiring_volume?: string | null
          company_name: string
          company_size?: string | null
          country?: string | null
          created_at?: string
          created_by_internal?: string | null
          description?: string | null
          healthcare_roles_hiring?: string[] | null
          id?: string
          industry?: string | null
          is_admin_profile_id?: string | null
          location?: string | null
          logo_url?: string | null
          office_address?: string | null
          onboarding_checklist?: Json | null
          preferred_source_countries?: string[] | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          subscription_tier?: string
          user_id?: string | null
          website_url?: string | null
          year_established?: number | null
        }
        Update: {
          annual_hiring_volume?: string | null
          company_name?: string
          company_size?: string | null
          country?: string | null
          created_at?: string
          created_by_internal?: string | null
          description?: string | null
          healthcare_roles_hiring?: string[] | null
          id?: string
          industry?: string | null
          is_admin_profile_id?: string | null
          location?: string | null
          logo_url?: string | null
          office_address?: string | null
          onboarding_checklist?: Json | null
          preferred_source_countries?: string[] | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          subscription_tier?: string
          user_id?: string | null
          website_url?: string | null
          year_established?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employers_created_by_internal_fkey"
            columns: ["created_by_internal"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_is_admin_profile_id_fkey"
            columns: ["is_admin_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escalations: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          note: string
          raised_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          note: string
          raised_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          note?: string
          raised_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalations_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escalations_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      final_test_attempts: {
        Row: {
          attempt_number: number
          candidate_id: string | null
          cohort_id: string | null
          consecutive_fail_count: number | null
          created_at: string | null
          id: string
          max_score: number | null
          mentor_id: string | null
          mentor_notes: string | null
          offerings_required: boolean | null
          outcome: string | null
          pass_threshold_pct: number | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number | null
          score_pct: number | null
        }
        Insert: {
          attempt_number?: number
          candidate_id?: string | null
          cohort_id?: string | null
          consecutive_fail_count?: number | null
          created_at?: string | null
          id?: string
          max_score?: number | null
          mentor_id?: string | null
          mentor_notes?: string | null
          offerings_required?: boolean | null
          outcome?: string | null
          pass_threshold_pct?: number | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          score_pct?: number | null
        }
        Update: {
          attempt_number?: number
          candidate_id?: string | null
          cohort_id?: string | null
          consecutive_fail_count?: number | null
          created_at?: string | null
          id?: string
          max_score?: number | null
          mentor_id?: string | null
          mentor_notes?: string | null
          offerings_required?: boolean | null
          outcome?: string | null
          pass_threshold_pct?: number | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number | null
          score_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "final_test_attempts_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_test_attempts_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_test_attempts_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_test_attempts_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_results: {
        Row: {
          attempt_number: number
          candidate_id: string
          created_at: string
          gate_type: string
          id: string
          notes: string | null
          recorded_by: string | null
          review_status: string
          score: number | null
          status: string
        }
        Insert: {
          attempt_number?: number
          candidate_id: string
          created_at?: string
          gate_type: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          review_status?: string
          score?: number | null
          status: string
        }
        Update: {
          attempt_number?: number
          candidate_id?: string
          created_at?: string
          gate_type?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          review_status?: string
          score?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "gate_results_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_results_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_messages: {
        Row: {
          created_at: string | null
          id: string
          message: string
          read: boolean | null
          recipient_id: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          sender_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message: string
          read?: boolean | null
          recipient_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sender_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string
          read?: boolean | null
          recipient_id?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notes: {
        Row: {
          author_id: string
          candidate_id: string
          created_at: string
          id: string
          is_escalation: boolean
          note: string
          note_type: string
          resolved: boolean | null
          session_id: string | null
        }
        Insert: {
          author_id: string
          candidate_id: string
          created_at?: string
          id?: string
          is_escalation?: boolean
          note: string
          note_type: string
          resolved?: boolean | null
          session_id?: string | null
        }
        Update: {
          author_id?: string
          candidate_id?: string
          created_at?: string
          id?: string
          is_escalation?: boolean
          note?: string
          note_type?: string
          resolved?: boolean | null
          session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          is_primary: boolean | null
          profile_id: string
          role: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_primary?: boolean | null
          profile_id: string
          role: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_primary?: boolean | null
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_user_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          candidate_id: string
          created_at: string
          employer_feedback: string | null
          feedback_submitted_at: string | null
          fit_score: number | null
          id: string
          interview_date: string | null
          interview_format: string | null
          interview_notes: string | null
          interview_time: string | null
          job_id: string
          rejected_at: string | null
          rejection_reason: string | null
          reveal_gate_conditions: Json | null
          status: string
          submitted_by: string
          supplier_id: string | null
          updated_at: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          employer_feedback?: string | null
          feedback_submitted_at?: string | null
          fit_score?: number | null
          id?: string
          interview_date?: string | null
          interview_format?: string | null
          interview_notes?: string | null
          interview_time?: string | null
          job_id: string
          rejected_at?: string | null
          rejection_reason?: string | null
          reveal_gate_conditions?: Json | null
          status?: string
          submitted_by: string
          supplier_id?: string | null
          updated_at?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          employer_feedback?: string | null
          feedback_submitted_at?: string | null
          fit_score?: number | null
          id?: string
          interview_date?: string | null
          interview_format?: string | null
          interview_notes?: string | null
          interview_time?: string | null
          job_id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          reveal_gate_conditions?: Json | null
          status?: string
          submitted_by?: string
          supplier_id?: string | null
          updated_at?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_applications_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      job_requirements: {
        Row: {
          created_at: string
          current_submissions: number
          description: string | null
          duplicated_from: string | null
          employer_id: string
          expiry_date: string | null
          id: string
          is_template: boolean | null
          location: string
          role_type: string
          status: string
          submission_cap: number
          title: string
        }
        Insert: {
          created_at?: string
          current_submissions?: number
          description?: string | null
          duplicated_from?: string | null
          employer_id: string
          expiry_date?: string | null
          id?: string
          is_template?: boolean | null
          location: string
          role_type: string
          status?: string
          submission_cap?: number
          title: string
        }
        Update: {
          created_at?: string
          current_submissions?: number
          description?: string | null
          duplicated_from?: string | null
          employer_id?: string
          expiry_date?: string | null
          id?: string
          is_template?: boolean | null
          location?: string
          role_type?: string
          status?: string
          submission_cap?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_requirements_duplicated_from_fkey"
            columns: ["duplicated_from"]
            isOneToOne: false
            referencedRelation: "job_requirements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_requirements_employer_id_fkey"
            columns: ["employer_id"]
            isOneToOne: false
            referencedRelation: "employers"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_assignments: {
        Row: {
          active: boolean
          assigned_at: string
          assigned_by: string
          candidate_id: string
          id: string
          mentor_id: string
        }
        Insert: {
          active?: boolean
          assigned_at?: string
          assigned_by: string
          candidate_id: string
          id?: string
          mentor_id: string
        }
        Update: {
          active?: boolean
          assigned_at?: string
          assigned_by?: string
          candidate_id?: string
          id?: string
          mentor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_assignments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_assignments_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_proposals: {
        Row: {
          approval_notes: string | null
          approved_by: string | null
          candidate_id: string | null
          cohort_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          proposal_type: string
          proposed_by: string | null
          proposed_mentor_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_by?: string | null
          candidate_id?: string | null
          cohort_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          proposal_type: string
          proposed_by?: string | null
          proposed_mentor_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_by?: string | null
          candidate_id?: string | null
          cohort_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          proposal_type?: string
          proposed_by?: string | null
          proposed_mentor_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentor_proposals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_proposals_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_proposals_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentor_proposals_proposed_mentor_id_fkey"
            columns: ["proposed_mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          sent_by: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          sent_by?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          sent_by?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offerings: {
        Row: {
          applicable_gate: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          type: string
        }
        Insert: {
          applicable_gate?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price: number
          type: string
        }
        Update: {
          applicable_gate?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          type?: string
        }
        Relationships: []
      }
      pending_invites: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          entity_id: string | null
          expires_at: string
          first_name: string
          id: string
          internal_role: string | null
          invite_type: string | null
          last_name: string
          token: string
          used: boolean
          used_at: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          entity_id?: string | null
          expires_at?: string
          first_name: string
          id?: string
          internal_role?: string | null
          invite_type?: string | null
          last_name: string
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          entity_id?: string | null
          expires_at?: string
          first_name?: string
          id?: string
          internal_role?: string | null
          invite_type?: string | null
          last_name?: string
          token?: string
          used?: boolean
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          internal_role: string | null
          is_internal: boolean
          last_name: string
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          id: string
          internal_role?: string | null
          is_internal?: boolean
          last_name: string
          phone?: string | null
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          internal_role?: string | null
          is_internal?: boolean
          last_name?: string
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      rm_assignments: {
        Row: {
          active: boolean
          assigned_by: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          notes: string | null
          request_notes: string | null
          requested_by: string | null
          rm_profile_id: string
        }
        Insert: {
          active?: boolean
          assigned_by: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          notes?: string | null
          request_notes?: string | null
          requested_by?: string | null
          rm_profile_id: string
        }
        Update: {
          active?: boolean
          assigned_by?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          notes?: string | null
          request_notes?: string | null
          requested_by?: string | null
          rm_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rm_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_assignments_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rm_assignments_rm_profile_id_fkey"
            columns: ["rm_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_audit: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string | null
          criterion_id: string | null
          id: string
          new_data: Json | null
          previous_data: Json | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string | null
          criterion_id?: string | null
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string | null
          criterion_id?: string | null
          id?: string
          new_data?: Json | null
          previous_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "rubric_audit_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_audit_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "speaking_test_rubric_criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_test_results: {
        Row: {
          academic_request_id: string | null
          candidate_id: string | null
          created_at: string | null
          id: string
          language_level_assessed: string | null
          max_possible_score: number | null
          mentor_id: string | null
          mentor_notes: string | null
          overall_outcome: string | null
          pass_threshold_pct: number | null
          review_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          schedule_id: string | null
          score_pct: number | null
          total_score: number | null
        }
        Insert: {
          academic_request_id?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          language_level_assessed?: string | null
          max_possible_score?: number | null
          mentor_id?: string | null
          mentor_notes?: string | null
          overall_outcome?: string | null
          pass_threshold_pct?: number | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          schedule_id?: string | null
          score_pct?: number | null
          total_score?: number | null
        }
        Update: {
          academic_request_id?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          language_level_assessed?: string | null
          max_possible_score?: number | null
          mentor_id?: string | null
          mentor_notes?: string | null
          overall_outcome?: string | null
          pass_threshold_pct?: number | null
          review_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          schedule_id?: string | null
          score_pct?: number | null
          total_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "speaking_test_results_academic_request_id_fkey"
            columns: ["academic_request_id"]
            isOneToOne: false
            referencedRelation: "academic_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_test_results_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_test_results_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_test_results_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_test_results_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "speaking_test_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_test_rubric_criteria: {
        Row: {
          created_at: string | null
          criterion_name: string
          description: string | null
          id: string
          is_active: boolean | null
          max_score: number
          order_position: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          criterion_name: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_score?: number
          order_position: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          criterion_name?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          max_score?: number
          order_position?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speaking_test_rubric_criteria_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_test_rubric_scores: {
        Row: {
          created_at: string | null
          criterion_id: string | null
          id: string
          notes: string | null
          result_id: string | null
          score: number
        }
        Insert: {
          created_at?: string | null
          criterion_id?: string | null
          id?: string
          notes?: string | null
          result_id?: string | null
          score: number
        }
        Update: {
          created_at?: string | null
          criterion_id?: string | null
          id?: string
          notes?: string | null
          result_id?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "speaking_test_rubric_scores_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "speaking_test_rubric_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_test_rubric_scores_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "speaking_test_results"
            referencedColumns: ["id"]
          },
        ]
      }
      speaking_test_schedules: {
        Row: {
          academic_request_id: string | null
          approval_notes: string | null
          approved_by: string | null
          candidate_id: string | null
          created_at: string | null
          duration_minutes: number | null
          id: string
          mentor_id: string | null
          mentor_proposal_id: string | null
          proposed_by: string | null
          proposed_date: string
          proposed_time: string
          reschedule_reason: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          academic_request_id?: string | null
          approval_notes?: string | null
          approved_by?: string | null
          candidate_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          mentor_id?: string | null
          mentor_proposal_id?: string | null
          proposed_by?: string | null
          proposed_date: string
          proposed_time: string
          reschedule_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          academic_request_id?: string | null
          approval_notes?: string | null
          approved_by?: string | null
          candidate_id?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          mentor_id?: string | null
          mentor_proposal_id?: string | null
          proposed_by?: string | null
          proposed_date?: string
          proposed_time?: string
          reschedule_reason?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speaking_test_schedules_academic_request_id_fkey"
            columns: ["academic_request_id"]
            isOneToOne: false
            referencedRelation: "academic_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_test_schedules_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_test_schedules_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_test_schedules_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_test_schedules_mentor_proposal_id_fkey"
            columns: ["mentor_proposal_id"]
            isOneToOne: false
            referencedRelation: "mentor_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speaking_test_schedules_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_bulk_uploads: {
        Row: {
          created_at: string | null
          failed_rows: number | null
          file_name: string | null
          id: string
          results: Json | null
          status: string | null
          successful_rows: number | null
          supplier_id: string | null
          total_rows: number | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          failed_rows?: number | null
          file_name?: string | null
          id?: string
          results?: Json | null
          status?: string | null
          successful_rows?: number | null
          supplier_id?: string | null
          total_rows?: number | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          failed_rows?: number | null
          file_name?: string | null
          id?: string
          results?: Json | null
          status?: string | null
          successful_rows?: number | null
          supplier_id?: string | null
          total_rows?: number | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bulk_uploads_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bulk_uploads_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_documents: {
        Row: {
          created_at: string | null
          document_label: string
          document_type: string
          file_url: string | null
          id: string
          is_mandatory: boolean | null
          notes: string | null
          rejection_reason: string | null
          status: string | null
          supplier_id: string | null
          uploaded_at: string | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_label: string
          document_type: string
          file_url?: string | null
          id?: string
          is_mandatory?: boolean | null
          notes?: string | null
          rejection_reason?: string | null
          status?: string | null
          supplier_id?: string | null
          uploaded_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_label?: string
          document_type?: string
          file_url?: string | null
          id?: string
          is_mandatory?: boolean | null
          notes?: string | null
          rejection_reason?: string | null
          status?: string | null
          supplier_id?: string | null
          uploaded_at?: string | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_documents_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_notes: {
        Row: {
          author_profile_id: string | null
          candidate_id: string | null
          created_at: string | null
          id: string
          note: string
          supplier_id: string | null
        }
        Insert: {
          author_profile_id?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          note: string
          supplier_id?: string | null
        }
        Update: {
          author_profile_id?: string | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          note?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_notes_author_profile_id_fkey"
            columns: ["author_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_notes_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_team_members: {
        Row: {
          created_at: string | null
          email: string
          first_name: string
          id: string
          invite_status: string | null
          invite_token: string | null
          invited_by: string | null
          last_name: string
          profile_id: string | null
          role: string
          supplier_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          first_name: string
          id?: string
          invite_status?: string | null
          invite_token?: string | null
          invited_by?: string | null
          last_name: string
          profile_id?: string | null
          role?: string
          supplier_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          first_name?: string
          id?: string
          invite_status?: string | null
          invite_token?: string | null
          invited_by?: string | null
          last_name?: string
          profile_id?: string | null
          role?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_team_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_team_members_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          company_name: string
          company_type: string
          compliance_declared: boolean
          compliance_declared_at: string | null
          country_of_operation: string | null
          created_at: string
          created_by_internal: string | null
          description: string | null
          healthcare_roles_focus: string[] | null
          id: string
          is_admin_profile_id: string | null
          logo_url: string | null
          no_fee_policy_confirmed: boolean
          no_fee_policy_confirmed_at: string | null
          office_address: string | null
          onboarding_checklist: Json | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          registration_number: string | null
          source_countries: string[] | null
          tier: string
          user_id: string | null
          website_url: string | null
          year_established: number | null
        }
        Insert: {
          company_name: string
          company_type: string
          compliance_declared?: boolean
          compliance_declared_at?: string | null
          country_of_operation?: string | null
          created_at?: string
          created_by_internal?: string | null
          description?: string | null
          healthcare_roles_focus?: string[] | null
          id?: string
          is_admin_profile_id?: string | null
          logo_url?: string | null
          no_fee_policy_confirmed?: boolean
          no_fee_policy_confirmed_at?: string | null
          office_address?: string | null
          onboarding_checklist?: Json | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          registration_number?: string | null
          source_countries?: string[] | null
          tier?: string
          user_id?: string | null
          website_url?: string | null
          year_established?: number | null
        }
        Update: {
          company_name?: string
          company_type?: string
          compliance_declared?: boolean
          compliance_declared_at?: string | null
          country_of_operation?: string | null
          created_at?: string
          created_by_internal?: string | null
          description?: string | null
          healthcare_roles_focus?: string[] | null
          id?: string
          is_admin_profile_id?: string | null
          logo_url?: string | null
          no_fee_policy_confirmed?: boolean
          no_fee_policy_confirmed_at?: string | null
          office_address?: string | null
          onboarding_checklist?: Json | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          registration_number?: string | null
          source_countries?: string[] | null
          tier?: string
          user_id?: string | null
          website_url?: string | null
          year_established?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_internal_fkey"
            columns: ["created_by_internal"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_is_admin_profile_id_fkey"
            columns: ["is_admin_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dt_question_pool_stats: {
        Row: {
          active_count: number | null
          difficulty_level: string | null
          inactive_count: number | null
          total_count: number | null
        }
      }
    }
    Functions: {
      record_candidate_seen_questions: {
        Args: {
          p_candidate_id: string
          p_question_ids: string[]
        }
        Returns: undefined
      }
      accept_employer_team_invite: {
        Args: {
          p_first_name: string
          p_last_name: string
          p_token: string
          p_user_id: string
        }
        Returns: Json
      }
      accept_team_invite: {
        Args: {
          p_first_name: string
          p_last_name: string
          p_token: string
          p_user_id: string
        }
        Returns: Json
      }
      claim_invite_token: {
        Args: { p_token: string; p_user_id: string }
        Returns: boolean
      }
      claim_partner_invite: {
        Args: { p_token: string; p_user_id: string }
        Returns: Json
      }
      compute_fit_score: {
        Args: { p_candidate_id: string; p_job_id: string }
        Returns: number
      }
      delete_candidate: {
        Args: { target_candidate_id: string }
        Returns: boolean
      }
      finalize_supplier_onboarding: {
        Args: {
          p_email: string
          p_first_name: string
          p_last_name: string
          p_profile_id: string
          p_supplier_id: string
          p_token: string
        }
        Returns: Json
      }
      get_auth_candidate_id: { Args: never; Returns: string }
      get_auth_employer_id: { Args: never; Returns: string }
      get_auth_supplier_id: { Args: never; Returns: string }
      get_employer_team_invite_details: {
        Args: { p_token: string }
        Returns: Json
      }
      get_internal_role: { Args: never; Returns: string }
      get_invite_details: {
        Args: { p_token: string }
        Returns: {
          candidate_id: string
          first_name: string
          last_name: string
          supplier_company_name: string
          target_role: string
        }[]
      }
      get_my_candidate_id: { Args: never; Returns: string }
      get_my_employer_id: { Args: never; Returns: string }
      get_my_employer_role: { Args: never; Returns: string }
      get_my_supplier_id: { Args: never; Returns: string }
      get_partner_invite_details: { Args: { p_token: string }; Returns: Json }
      get_team_invite_details: { Args: { p_token: string }; Returns: Json }
      has_role: { Args: { check_role: string }; Returns: boolean }
      is_internal: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
