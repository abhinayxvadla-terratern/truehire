import { SupabaseClient } from '@supabase/supabase-js';

export interface SyncSupplierCandidatesResult {
  updatedCount: number;
  rmName: string;
}

/**
 * Assigns or reassigns an RM to candidates of a supplier.
 * Step 1: Updates candidates table.
 * Step 2: Notifies the newly assigned RM.
 * Step 3: Notifies each updated candidate (if they have an active user_id).
 */
export async function syncSupplierCandidatesRm(
  supabase: SupabaseClient,
  supplierId: string,
  newRmProfileId: string,
  isReassignment: boolean,
  assignedByUserId: string
): Promise<SyncSupplierCandidatesResult> {
  // 1. Fetch supplier info
  const { data: supplier } = await supabase
    .from('suppliers')
    .select('company_name')
    .eq('id', supplierId)
    .maybeSingle();
  const supplierName = supplier?.company_name || 'Supplier';

  // 2. Fetch RM profile info
  const { data: rmProfile } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', newRmProfileId)
    .maybeSingle();
  const rmName = rmProfile
    ? `${rmProfile.first_name || ''} ${rmProfile.last_name || ''}`.trim() || rmProfile.email
    : 'Account Manager';

  // 3. Find target candidates
  let candQuery = supabase
    .from('candidates')
    .select('id, user_id, first_name, last_name')
    .eq('supplier_id', supplierId);

  if (!isReassignment) {
    // Only update candidates that do not currently have an assigned RM
    candQuery = candQuery.is('assigned_rm_id', null);
  }

  const { data: targetCandidates, error: fetchErr } = await candQuery;
  if (fetchErr) throw fetchErr;

  const candidatesToUpdate = targetCandidates || [];
  const candidateIds = candidatesToUpdate.map((c) => c.id);

  if (candidateIds.length > 0) {
    // Step 1: Update candidates
    const { error: updateErr } = await supabase
      .from('candidates')
      .update({ assigned_rm_id: newRmProfileId })
      .in('id', candidateIds);
    if (updateErr) throw updateErr;

    // Step 2: Notify the RM
    const rmNotificationMessage = isReassignment
      ? `You have been assigned ${candidateIds.length} candidates from ${supplierName} following a reassignment.`
      : `${candidateIds.length} candidates from ${supplierName} have been assigned to you as their account manager.`;

    await supabase.from('notifications').insert({
      user_id: newRmProfileId,
      title: 'Candidates Assigned to You',
      message: rmNotificationMessage,
      type: 'general',
      read: false,
      sent_by: assignedByUserId,
    });

    // Step 3: Notify each candidate with user_id
    const candidatesWithUserId = candidatesToUpdate.filter((c) => !!c.user_id);
    if (candidatesWithUserId.length > 0) {
      const candidateNotifs = candidatesWithUserId.map((cand) => ({
        user_id: cand.user_id as string,
        title: 'Your Account Manager',
        message: isReassignment
          ? `Your account manager has been updated to ${rmName}.`
          : `TerraTern has assigned ${rmName} as your account manager. They will support you through your qualification.`,
        type: 'general',
        read: false,
        sent_by: assignedByUserId,
      }));

      await supabase.from('notifications').insert(candidateNotifs);
    }
  }

  return {
    updatedCount: candidateIds.length,
    rmName,
  };
}

/**
 * Manually assigns an RM to a direct candidate (no supplier).
 */
export async function assignDirectCandidateRm(
  supabase: SupabaseClient,
  candidateId: string,
  rmProfileId: string,
  assignedByUserId: string
): Promise<{ rmName: string; candidateName: string }> {
  // 1. Fetch candidate details
  const { data: candidate, error: candErr } = await supabase
    .from('candidates')
    .select('id, user_id, first_name, last_name')
    .eq('id', candidateId)
    .single();
  if (candErr) throw candErr;

  const candName = `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Direct Candidate';

  // 2. Fetch RM details
  const { data: rmProfile, error: rmErr } = await supabase
    .from('profiles')
    .select('first_name, last_name, email')
    .eq('id', rmProfileId)
    .single();
  if (rmErr) throw rmErr;

  const rmName = `${rmProfile.first_name || ''} ${rmProfile.last_name || ''}`.trim() || rmProfile.email;

  // 3. Update candidate assigned_rm_id
  const { error: updateErr } = await supabase
    .from('candidates')
    .update({ assigned_rm_id: rmProfileId })
    .eq('id', candidateId);
  if (updateErr) throw updateErr;

  // 4. Notify assigned RM (Note: zero "please" constraint)
  await supabase.from('notifications').insert({
    user_id: rmProfileId,
    title: 'Direct Candidate Assigned',
    message: `${candName} has been assigned to you directly. They have no supplier. Reach out and support them through their qualification.`,
    type: 'general',
    read: false,
    sent_by: assignedByUserId,
  });

  // 5. Notify candidate if they have an active user account
  if (candidate.user_id) {
    await supabase.from('notifications').insert({
      user_id: candidate.user_id,
      title: 'Your Account Manager',
      message: `TerraTern has assigned ${rmName} as your account manager. They will support you through your qualification.`,
      type: 'general',
      read: false,
      sent_by: assignedByUserId,
    });
  }

  return { rmName, candidateName: candName };
}
