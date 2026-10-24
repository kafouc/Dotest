import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

/**
 * Suppression d'un compte et de toutes ses données.
 *
 * La base supprime en cascade la plupart des tables liées à auth.users. Ce module s'occupe de ce que la cascade ne couvre pas :
 *  - l'abonnement payant (résilié chez Stripe AVANT toute suppression, pour ne jamais continuer à facturer) ;
 *  - les fichiers du Storage (buckets `pdfs` et `chunks`) ;
 *  - les tables sans clé étrangère vers auth.users (documents, compteurs de limite, sessions) ;
 *  - enfin le compte d'authentification lui-même.
 * Les étapes sont idempotentes : en cas d'échec, l'utilisateur peut relancer la suppression.
 */

export type AccountDeletionDeps = {
  admin: SupabaseClient;
  userId: string;
  /** Résilie les abonnements Stripe du client (les factures restent conservées chez Stripe : obligation légale) */
  cancelBilling?: (stripeCustomerId: string) => Promise<void>;
};

export type AccountDeletionReport = {
  storageFilesRemoved: number;
  documentsRemoved: number;
  billingCancelled: boolean;
};

export class AccountDeletionError extends Error {
  step: 'admin' | 'billing' | 'storage' | 'database' | 'auth';
  constructor(step: AccountDeletionError['step'], message: string) {
    super(message);
    this.name = 'AccountDeletionError';
    this.step = step;
  }
}

const PAGE = 100;

/** Supprime tous les objets d'un dossier de bucket (pagination incluse) et renvoie leur nombre. */
async function removeFolder(admin: SupabaseClient, bucket: string, folder: string): Promise<number> {
  let removed = 0;
  for (let guard = 0; guard < 500; guard++) {
    const { data, error } = await admin.storage.from(bucket).list(folder, { limit: PAGE });
    if (error) throw new Error(`${bucket} : ${error.message}`);
    const files = (data ?? []).filter((item) => item.name);
    if (files.length === 0) break;
    const { error: removeError } = await admin.storage.from(bucket).remove(files.map((f) => `${folder}/${f.name}`));
    if (removeError) throw new Error(`${bucket} : ${removeError.message}`);
    removed += files.length;
    if (files.length < PAGE) break;
  }
  return removed;
}

export async function deleteUserAccount(deps: AccountDeletionDeps): Promise<AccountDeletionReport> {
  const { admin, userId, cancelBilling } = deps;
  const report: AccountDeletionReport = { storageFilesRemoved: 0, documentsRemoved: 0, billingCancelled: false };

  // 0. Un administrateur ne peut pas supprimer son compte ici (risque de perdre l'accès à l'administration)
  const { data: adminRow } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  if (adminRow) throw new AccountDeletionError('admin', 'Les comptes administrateurs ne peuvent pas être supprimés depuis cette page.');

  // 1. Facturation : si la résiliation échoue, on s'arrête avant de supprimer quoi que ce soit
  try {
    const { data: billing } = await admin.from('billing_customers').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
    const customerId = (billing as { stripe_customer_id?: string } | null)?.stripe_customer_id;
    if (customerId && !customerId.startsWith('tmp_') && cancelBilling) {
      await cancelBilling(customerId);
      report.billingCancelled = true;
    }
  } catch (error) {
    throw new AccountDeletionError('billing', error instanceof Error ? error.message : 'Résiliation de l’abonnement impossible.');
  }

  // 2. Fichiers
  try {
    report.storageFilesRemoved += await removeFolder(admin, 'pdfs', userId);
    const { data: docs } = await admin.from('documents').select('id').eq('user_id', userId);
    const chunkFiles = ((docs ?? []) as { id: number }[]).map((d) => `doc_${d.id}_chunks.json`);
    for (let i = 0; i < chunkFiles.length; i += 100) {
      await admin.storage.from('chunks').remove(chunkFiles.slice(i, i + 100));
    }
  } catch (error) {
    throw new AccountDeletionError('storage', error instanceof Error ? error.message : 'Suppression des fichiers impossible.');
  }

  // 3. Tables que la cascade ne couvre pas
  try {
    const { count } = await admin.from('documents').delete({ count: 'exact' }).eq('user_id', userId);
    report.documentsRemoved = count ?? 0;
    for (const table of ['api_rate_limits', 'user_sessions']) {
      const { error } = await admin.from(table).delete().eq('user_id', userId);
      if (error) logger.warn(`[account] purge ${table} impossible`, { message: error.message });
    }
    await admin.from('user_plans').update({ assigned_by: null }).eq('assigned_by', userId);
  } catch (error) {
    throw new AccountDeletionError('database', error instanceof Error ? error.message : 'Suppression des données impossible.');
  }

  // 4. Compte d'authentification : la base supprime alors en cascade le reste (cartes, quiz, résultats, classes, notifications…)
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) throw new AccountDeletionError('auth', authError.message);

  logger.info('[account] compte supprimé', { storageFilesRemoved: report.storageFilesRemoved, documentsRemoved: report.documentsRemoved });
  return report;
}
