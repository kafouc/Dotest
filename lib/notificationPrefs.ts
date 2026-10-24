import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_NOTIFICATION_PREFS, EVENING_HOURS, MORNING_HOURS, type NotificationPrefs } from '@/lib/notifications';

/** Préférences de notification (table user_settings, une ligne par utilisateur, créée à la première modification). */

const COLUMNS = 'notify_morning, notify_spaced, notify_evening, morning_hour, evening_hour, timezone';

export async function loadNotificationPrefs(supabase: SupabaseClient): Promise<NotificationPrefs> {
  const { data, error } = await supabase.from('user_settings').select(COLUMNS).maybeSingle();
  if (error || !data) return { ...DEFAULT_NOTIFICATION_PREFS };
  return { ...DEFAULT_NOTIFICATION_PREFS, ...(data as Partial<NotificationPrefs>) };
}

/** Valide une modification avant l'écriture (la base refuse de toute façon les heures hors plage). */
export function sanitizePrefsChange(change: Partial<NotificationPrefs>): Partial<NotificationPrefs> {
  const clean: Partial<NotificationPrefs> = {};
  if (typeof change.notify_morning === 'boolean') clean.notify_morning = change.notify_morning;
  if (typeof change.notify_spaced === 'boolean') clean.notify_spaced = change.notify_spaced;
  if (typeof change.notify_evening === 'boolean') clean.notify_evening = change.notify_evening;
  if (typeof change.morning_hour === 'number' && (MORNING_HOURS as readonly number[]).includes(change.morning_hour)) clean.morning_hour = change.morning_hour;
  if (typeof change.evening_hour === 'number' && (EVENING_HOURS as readonly number[]).includes(change.evening_hour)) clean.evening_hour = change.evening_hour;
  return clean;
}

export async function saveNotificationPrefs(supabase: SupabaseClient, change: Partial<NotificationPrefs>): Promise<void> {
  const clean = sanitizePrefsChange(change);
  if (Object.keys(clean).length === 0) return;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Utilisateur non authentifié');
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: userData.user.id, ...clean, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}
