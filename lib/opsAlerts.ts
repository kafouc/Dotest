import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logger } from '@/lib/logger';

/**
 * Enregistre une alerte d'exploitation (table ops_alerts, envoyée au webhook par pg_cron si configuré).
 * Une même catégorie n'est enregistrée qu'une fois toutes les 6 heures. N'échoue jamais : une alerte
 * ratée ne doit pas faire échouer la requête de l'utilisateur.
 */
export async function raiseOpsAlert(kind: string, message: string, details?: Record<string, unknown>): Promise<void> {
  try {
    const admin = getSupabaseAdmin('ops-alerts');
    if (!admin) return;

    const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from('ops_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('kind', kind)
      .gte('created_at', since);
    if ((count ?? 0) > 0) return;

    await admin.from('ops_alerts').insert({ kind, message, details: details ?? null });
  } catch (error) {
    logger.warn('[ops-alerts] enregistrement impossible', error instanceof Error ? error : { error: String(error) });
  }
}

/** Le fournisseur signale que le modèle configuré n'existe plus ou a été retiré. */
export function isModelUnavailableError(error: unknown): boolean {
  const e = error as { status?: number; code?: string; message?: string; error?: { error?: { code?: string; message?: string } } } | null;
  if (!e) return false;
  const code = e.code ?? e.error?.error?.code ?? '';
  const message = `${e.message ?? ''} ${e.error?.error?.message ?? ''}`;
  return (
    code === 'model_decommissioned' ||
    code === 'model_not_found' ||
    /decommissioned|no longer supported|model_not_found|does not exist or you do not have access/i.test(message)
  );
}

/** À appeler dans le `catch` des routes IA : journalise, alerte, et renvoie true si c'était une panne de modèle. */
export async function handleModelFailure(route: string, model: string, error: unknown): Promise<boolean> {
  if (!isModelUnavailableError(error)) return false;
  logger.error(`[${route}] modèle IA indisponible`, error instanceof Error ? error : { error: String(error) }, { model });
  await raiseOpsAlert('ai_model_unavailable', `Le modèle IA « ${model} » n'est plus disponible (${route}). Mettre à jour la variable GROQ_MODEL_* sur Vercel.`, {
    route,
    model,
  });
  return true;
}
