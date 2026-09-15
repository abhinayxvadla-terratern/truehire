import { SupabaseClient } from '@supabase/supabase-js';

export interface PlacementConfirmationParams {
  supabase: SupabaseClient;
  applicationId: string;
  candidateId: string;
  jobId?: string | null;
  jobTitle: string;
  employerId: string;
  supplierId?: string | null;
  confirmedByUserId: string;
}

/**
 * Confirms a placement when all 3 reveal gate conditions are fulfilled:
 * 1. Updates job_applications.status = 'placed'
 * 2. Updates candidates.status = 'placed' (maintains can_apply_to_jobs)
 * 3. Fans out notifications to Candidate, Candidate RM, Employer team members, and Supplier
 */
export async function confirmPlacement({
  supabase,
  applicationId,
  candidateId,
  jobTitle,
  employerId,
  supplierId,
  confirmedByUserId,
}: PlacementConfirmationParams): Promise<void> {
  const now = new Date().toISOString();

  // 1. UPDATE job_applications status = 'placed'
  const { error: appErr } = await supabase
    .from('job_applications')
    .update({
      status: 'placed',
      updated_at: now,
    })
    .eq('id', applicationId);

  if (appErr) throw appErr;

  // 2. UPDATE candidates status = 'placed'
  const { error: candErr } = await supabase
    .from('candidates')
    .update({
      status: 'placed',
      updated_at: now,
    })
    .eq('id', candidateId);

  if (candErr) {
    console.warn('Could not update candidate status:', candErr);
  }

  // 3. Notify Candidate
  const { data: candData } = await supabase
    .from('candidates')
    .select('user_id, first_name, last_name')
    .eq('id', candidateId)
    .maybeSingle();

  if (candData?.user_id) {
    await supabase.from('notifications').insert({
      user_id: candData.user_id,
      title: 'Congratulations on Your Placement!',
      message: `Your placement for ${jobTitle} has been officially confirmed! Our team will coordinate your onboarding and relocation details.`,
      type: 'application_update',
      read: false,
      sent_by: confirmedByUserId,
    });
  }

  // 4. Notify Candidate / Supplier RM
  const rmRecipients = new Set<string>();

  // Check direct candidate RM assignment
  const { data: candRmAss } = await supabase
    .from('rm_assignments')
    .select('rm_profile_id')
    .eq('entity_type', 'candidate')
    .eq('entity_id', candidateId)
    .eq('active', true)
    .maybeSingle();

  if (candRmAss?.rm_profile_id) {
    rmRecipients.add(candRmAss.rm_profile_id);
  }

  // Check supplier RM assignment
  if (supplierId) {
    const { data: supRmAss } = await supabase
      .from('rm_assignments')
      .select('rm_profile_id')
      .eq('entity_type', 'supplier')
      .eq('entity_id', supplierId)
      .eq('active', true)
      .maybeSingle();

    if (supRmAss?.rm_profile_id) {
      rmRecipients.add(supRmAss.rm_profile_id);
    }
  }

  for (const rmProfileId of rmRecipients) {
    await supabase.from('notifications').insert({
      user_id: rmProfileId,
      title: 'Candidate Placed',
      message: `Candidate #${candidateId.slice(0, 6).toUpperCase()} has been confirmed placed for ${jobTitle}.`,
      type: 'application_update',
      read: false,
      sent_by: confirmedByUserId,
    });
  }

  // 5. Notify Employer & Employer team members
  if (employerId) {
    const employerRecipients = new Set<string>();

    const { data: emp } = await supabase
      .from('employers')
      .select('user_id, is_admin_profile_id')
      .eq('id', employerId)
      .maybeSingle();

    if (emp?.user_id) employerRecipients.add(emp.user_id);
    if (emp?.is_admin_profile_id) employerRecipients.add(emp.is_admin_profile_id);

    const { data: empTeam } = await supabase
      .from('employer_team_members')
      .select('profile_id')
      .eq('employer_id', employerId)
      .eq('invite_status', 'accepted');

    (empTeam || []).forEach((tm) => {
      if (tm.profile_id) employerRecipients.add(tm.profile_id);
    });

    if (employerRecipients.size > 0) {
      const empNotifs = Array.from(employerRecipients).map((uId) => ({
        user_id: uId,
        title: 'Placement Confirmed',
        message: `Placement confirmed for ${jobTitle}. Full candidate credentials and documentation are now unlocked in your Placements tab.`,
        type: 'application_update',
        read: false,
        sent_by: confirmedByUserId,
      }));
      await supabase.from('notifications').insert(empNotifs);
    }
  }

  // 6. Notify Supplier & Supplier team members
  if (supplierId) {
    const supplierRecipients = new Set<string>();

    const { data: sup } = await supabase
      .from('suppliers')
      .select('user_id')
      .eq('id', supplierId)
      .maybeSingle();

    if (sup?.user_id) supplierRecipients.add(sup.user_id);

    const { data: supTeam } = await supabase
      .from('supplier_team_members')
      .select('profile_id')
      .eq('supplier_id', supplierId)
      .eq('invite_status', 'accepted');

    (supTeam || []).forEach((tm) => {
      if (tm.profile_id) supplierRecipients.add(tm.profile_id);
    });

    if (supplierRecipients.size > 0) {
      const supNotifs = Array.from(supplierRecipients).map((uId) => ({
        user_id: uId,
        title: 'Candidate Placed',
        message: `Your candidate has been successfully placed with a German healthcare facility for ${jobTitle}. Check your Placements tab for details.`,
        type: 'application_update',
        read: false,
        sent_by: confirmedByUserId,
      }));
      await supabase.from('notifications').insert(supNotifs);
    }
  }
}
