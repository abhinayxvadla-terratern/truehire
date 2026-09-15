# TerraTern Cross-Cutting Refinements Walkthrough

All 6 parts of the platform refinement and cross-cutting specifications have been implemented and verified. No mock data was added; all flows interact directly with Supabase, preserving existing functionality and adhering to TerraTern design tokens.

---

## 1. Candidate Anonymization Logic (3-Level Reveal Rule)

Implemented centralized anonymization utility in [`src/utils/anonymization.ts`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/utils/anonymization.ts):

| Level | State / Context | Display Name | Subtitle / Label | Contact / Supplier Data |
| :--- | :--- | :--- | :--- | :--- |
| **Level 1** | Talent Pool, Track Talent, and Employer views with status `applied` or `shortlisted` | `Candidate #[first 6 chars of ID uppercase]` | None | **Hidden** (no email, phone, supplier name) |
| **Level 2** | `interview_scheduled`, `interviewed`, `selected`, `offer_sent` (before `placed`) | `first_name + last_name` | `"Name shared for interview coordination"` | **Hidden** (no email, phone, supplier name) |
| **Level 3** | `placed` | `first_name + last_name` | `"Fully revealed — placement complete"` | **Revealed** (email & supplier company name unlocked) |
| **Internal Views** | Placement Lead, Super Admin, Candidate RM, Employer RM, Academic Lead, Mentor | `first_name + last_name` (or real profile name) | N/A | **Full Access** (all anonymization bypassed) |

### Files Updated
- [`src/utils/anonymization.ts`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/utils/anonymization.ts): Anonymization helper function and interface.
- [`src/pages/employer/EmployerTalentPoolTab.tsx`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/pages/employer/EmployerTalentPoolTab.tsx): Level 1 anonymization on talent cards and profile preview drawer.
- [`src/pages/employer/EmployerMyCandidatesTab.tsx`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/pages/employer/EmployerMyCandidatesTab.tsx): Levels 1, 2, and 3 reveal states with badge badges and supplier info on placement.
- [`src/pages/supplier/SupplierTrackTalentTab.tsx`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/pages/supplier/SupplierTrackTalentTab.tsx): Level 1 anonymization on interview-ready candidates.
- [`src/pages/internal/placement/employer_rm/EmployerRmPipelineTab.tsx`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/pages/internal/placement/employer_rm/EmployerRmPipelineTab.tsx): Light reveal tracking during interview coordination.

---

## 2. Supplier & Employer Invite Claim Flow

Refactored both partner onboarding pages:
- [`src/pages/SupplierInvite.tsx`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/pages/SupplierInvite.tsx)
- [`src/pages/EmployerInvite.tsx`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/pages/EmployerInvite.tsx)

### Capabilities
1. **Token Validation**: Reads `?token=[token]`, checks `pending_invites` for active, unexpired tokens (`used = false AND expires_at > now()`).
2. **Prominent Branding**: Displays the invited company name at the top of the card.
3. **Form Fields**:
   - First Name (pre-filled from invite, editable)
   - Last Name (pre-filled from invite, editable)
   - Email (pre-filled from invite, read-only and locked)
   - Password (minimum 8 characters)
   - Confirm Password
4. **Claim Execution**:
   - Creates/authenticates the Supabase auth user with updated names and non-internal role.
   - Links `user_id` on the `suppliers` or `employers` table via `claim_partner_invite` and direct fallback.
   - Marks `pending_invites` as `used = true` with `used_at = now()`.
   - Upserts `profiles` record with `is_internal = false`.
   - Refreshes session and automatically routes to `/supplier` or `/employer`.

---

## 3. Database Schema Updates

Applied all required columns to Supabase project `scedloztcwrbgtbvojvv`:
- `suppliers`: `created_by_internal (boolean, default false)`
- `employers`: `created_by_internal (boolean, default false)`
- `pending_invites`: `invite_type (text)`, `entity_id (uuid)`, `used_at (timestamptz)`
- `internal_notes`: `resolved (boolean, default false)`
- `notifications`: `sent_by (uuid, references profiles.id)`
- `job_applications`: `reveal_gate_conditions (jsonb, default '[]'::jsonb)`

---

## 4. Notification Routing (`notifyByRole`)

Created [`src/utils/notificationRouting.ts`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/utils/notificationRouting.ts) exporting `notifyByRole(supabase, internal_role, title, message, type, sent_by)` to fan out individual notification rows with specific `user_id`s rather than `user_id = null`.

Integrated into key workflow events:
- **Application Submission**: Notifies `employer_requirements_rm` and `placement_lead`.
- **Speaking Test Request**: Notifies `academic_lead` (`LeadCandidatePipelineTab.tsx`).
- **Interview Passed (`selected`)**: Notifies `placement_lead` and `employer_requirements_rm` (`EmployerRmPipelineTab.tsx`, `LeadEmployerPipelineTab.tsx`).
- **Speaking Test / Assessment Recorded**: Notifies `academic_lead` (`RecordSpeakingTestModal.tsx`, `RecordAssessmentModal.tsx`).
- **At-Risk Flag Raised**: Notifies `academic_lead` (`FlagAtRiskModal.tsx`).

---

## 5. Standardized Empty States

Created reusable component [`src/components/ui/EmptyState.tsx`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/components/ui/EmptyState.tsx) adhering to TerraTern design tokens:
- Centered layout with 48x48 rounded icon container (`border-[#E2E8F4] bg-slate-50`).
- 14px font-medium `#1B3270` title.
- 12px text `#94A3B8` subtitle.
- Optional primary button (`bg-[#1B3270] hover:bg-[#2952A3]`).

Applied to:
- `EmployerTalentPoolTab.tsx`
- `EmployerMyCandidatesTab.tsx`
- `SupplierTrackTalentTab.tsx`
- `LeadEmployerPipelineTab.tsx`

---

## 6. Session Persistence & Cross-Role Routing

Implemented centralized routing logic in [`src/utils/internalRouting.ts`](file:///c:/Users/abhin/OneDrive/Desktop/TerraTern/TrueHire/v1/src/utils/internalRouting.ts):

### Route Protection Rules
1. **Unauthenticated Users**:
   - Attempting internal routes (`/internal/*` or `/admin`) $\to$ redirected to `/internal/login`.
   - Attempting external protected routes (`/candidate`, `/supplier`, `/employer`) $\to$ redirected to `/login`.
   - Public routes (`/`, `/login`, `/register`, `/invite/*`, `/supplier-invite`, `/employer-invite`) remain open.
2. **External Users (`is_internal = false` or null)**:
   - Attempting `/internal/*` or `/admin` $\to$ automatically signed out and redirected to `/login` with error: `"You don't have access to this area."`
   - Accessing external dashboards $\to$ strictly routed to `/candidate`, `/supplier`, or `/employer` based on their profile role.
3. **Internal Staff (`is_internal = true`)**:
   - Attempting external dashboards (`/candidate`, `/supplier`, `/employer`) $\to$ redirected to their assigned internal workspace based on `internal_role`.
   - Visiting `/login` or `/internal/login` with active session $\to$ auto-redirected to their assigned internal workspace.
   - Attempting internal routes not assigned to them $\to$ redirected to their designated dashboard.

---

## 7. Mentor Dashboard Updates (`/internal/academic/mentor`)

Implemented all 5 parts of the Mentor Dashboard upgrade:

### Part 1: Tab Navigation
- Configured 4 top-level tabs: `Overview | My Candidates | My Cohorts | Session Notes`.
- Added query parameter synchronization (`?tab=...&cohortId=...`) with `onNavigateTab` prop propagation so contextual actions (such as jumping from a session note or candidate card directly to that cohort's attendance) work seamlessly.

### Part 2: Overview Tab
- **Stats Row**:
  - `Active Candidates`: Live count of active `mentor_assignments` for `auth.uid()`.
  - `Sessions This Week`: Live count of `bootcamp_sessions` for mentor cohorts scheduled between Monday and Sunday of the current week.
  - `Actions Required`: Real-time sum of items in the "What to Do Next" queue.
  - `Final Tests Pending`: Live count of `final_test_attempts` with `review_status = 'pending'` for this mentor.
- **"What to Do Next" Queue**:
  - `Cohort session today`: Displays cohort name, session number, title, and time with a "Mark Attendance" button opening the live attendance modal.
  - `Final Test pending review`: Informational notification when a mentee's assessment is awaiting Academic Lead review.
  - `Speaking Test queried`: Highlights Academic Lead clarification queries with an "Add Clarification" button opening the resubmission modal.
  - `Cooling period active`: Informational badge showing when a candidate's retake preparation period ends.
  - `Final Test locked`: Alerts the mentor when a candidate is locked after 3 consecutive failures and requires Academic Lead reset.

### Part 3: My Candidates Tab
- **Cohort Info Row**: Displays `"Cohort: [name] ([track badge])"` or `"No cohort assigned yet"` in muted text.
- **Cooling / Lock Indicators**: Amber badge for active assessment cooling periods with end date; Red badge for locked assessments.
- **Speaking Test Clarification Card**: Prominent amber card rendered when `speaking_test_results.review_status = 'queried'`, detailing the Academic Lead's query notes and offering a direct `"Add Clarification & Resubmit"` button.
- **Gate Actions**:
  - Quick link `"Mark attendance in [cohort name] →"` jumping to My Cohorts.
  - `"Start Bootcamp"` button for candidates not yet assigned to a cohort.
  - Red locked warning card when `final_test_locked = true`, preventing test recording until unlocked by Academic Lead.

### Part 4: My Cohorts Tab (New)
- **Directory View**: Lists cohorts assigned to this mentor (`mentor_id = auth.uid()`) with track badge (`Pass Track` / `Fail Track`), status badge, enrolled members count, completed vs total sessions, date range, progress bar, and "Manage" button.
- **Single Cohort View**:
  - **Members Table**: Displays member progress, attendance %, attempt counts, consecutive fail highlights (amber if $\ge 2$, red if locked).
  - **Sessions Timeline**: Supports scheduling sessions (`+ Add Session` modal with candidate notification), marking attendance (`bootcamp_attendance` upsert with conflict handling on `session_id,candidate_id`), marking sessions completed, and reviewing attendance logs.
  - **Final Assessment Administration**: Automatically unlocked once all cohort sessions are completed. Mentors can view previous attempt history, input 0–100 scores with automatic pass/fail thresholding, record mentor notes, and submit results which notify Academic Leads.

### Part 5: Session Notes Tab
- **Filters**: Note type filter pills (`All Notes`, `Session Notes`, `At-Risk Flags`, `General Notes`), assigned candidate dropdown, and date filters (`All Time`, `This Week`, `This Month`, `Custom` date pickers).
- **Columns**: `Candidate | Cohort | Note Type | Note Content | Session Date | Actions Required | Created At`.
- **Linked Sessions**: For session notes, displays clickable link `"Related session: [cohort name] — Session [n] — [date]"` navigating directly to cohort attendance.
- **Add Note Modal**: Dynamically pulls completed sessions for the selected candidate's cohort, enabling mentors to associate clinical and coaching notes directly with specific sessions.

---

## Verification Results

1. **TypeScript & Build**: Executed `npx tsc --noEmit` $\to$ Passed with **0 errors**.
2. **Dev Server**: Vite server active and serving on `http://localhost:3000` with hot-module replacement enabled.

