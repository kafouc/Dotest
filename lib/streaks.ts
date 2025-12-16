import type { SupabaseClient } from '@supabase/supabase-js';

type RpcArgs = {
  p_user_id: string;
  p_activity_at?: string;
};

/**
 * Enregistre une activité utilisateur auprès de Supabase pour maintenir la flamme quotidienne.
 * Les erreurs sont journalisées mais n'interrompent pas le flux principal.
 */
export async function touchUserStreak(
  supabase: SupabaseClient,
  userId: string,
  activityAt: Date | string = new Date()
): Promise<void> {
  if (!userId) return;

  try {
    const iso = activityAt instanceof Date ? activityAt.toISOString() : activityAt;
    const { error } = await supabase.rpc('update_user_streak', {
      p_user_id: userId,
      p_activity_at: iso,
    } satisfies RpcArgs);
    if (error) {
      console.warn('[streaks] update_user_streak RPC failed:', error);
    }
  } catch (err) {
    console.warn('[streaks] Unexpected error while touching streak:', err);
  }
}

export type UserStreak = {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  last_activity_at: string | null;
};

/**
 * Récupère la flamme de l'utilisateur authentifié (via RPC). Retourne null si aucune donnée.
 */
export async function fetchUserStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<UserStreak | null> {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error) {
      if (error.code && ['PGRST116', 'PGRST117', 'PGRST103'].includes(error.code)) {
        return null;
      }
      console.warn('[streaks] fetchUserStreak error:', error);
      return null;
    }
    return data as unknown as UserStreak;
  } catch (err) {
    console.warn('[streaks] Unexpected error while fetching streak:', err);
    return null;
  }
}
