import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Helper to fan out notifications to all active internal staff with a specified internal_role
 */
export async function notifyByRole(
  supabase: SupabaseClient,
  internal_role: string,
  title: string,
  message: string,
  type: string,
  sent_by?: string | null
): Promise<void> {
  try {
    // Get all active internal users with this role
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('internal_role', internal_role)
      .eq('is_internal', true);

    if (error || !users || users.length === 0) return;

    const notifications = users.map((user) => ({
      user_id: user.id,
      title,
      message,
      type,
      read: false,
      sent_by: sent_by || null,
    }));

    await supabase.from('notifications').insert(notifications);
  } catch (err) {
    console.error(`Error notifying role ${internal_role}:`, err);
  }
}
