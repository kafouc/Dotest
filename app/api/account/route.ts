import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { AccountDeletionError, deleteUserAccount } from '@/lib/accountDeletion';
import { cancelStripeSubscriptionsForAccount } from '@/lib/billing';
import { enforceRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';
import { internalError } from '@/lib/apiError';
import { parseJsonBody } from '@/lib/validation';

export const runtime = 'nodejs';

const deleteSchema = z.object({
  /** L'utilisateur doit retaper son adresse e-mail : évite une suppression accidentelle ou par un onglet resté ouvert */
  confirmEmail: z.string().trim().min(3).max(320),
});

/** DELETE /api/account : supprime le compte connecté et toutes ses données (RGPD, droit à l'effacement). */
export async function DELETE(req: Request) {
  try {
    const parsed = await parseJsonBody(req, deleteSchema);
    if (!parsed.ok) return parsed.response;

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    if ((user.email ?? '').toLowerCase() !== parsed.data.confirmEmail.toLowerCase()) {
      return NextResponse.json({ error: "L'adresse e-mail saisie ne correspond pas à celle du compte." }, { status: 400 });
    }

    await enforceRateLimit(supabase, user.id, 'account-delete');

    const admin = getSupabaseAdmin('account-deletion');
    if (!admin) return NextResponse.json({ error: 'Service momentanément indisponible.' }, { status: 503 });

    try {
      const report = await deleteUserAccount({
        admin,
        userId: user.id,
        cancelBilling: process.env.STRIPE_SECRET_KEY ? cancelStripeSubscriptionsForAccount : undefined,
      });
      return NextResponse.json({ deleted: true, ...report });
    } catch (error) {
      if (error instanceof AccountDeletionError && error.step === 'admin') {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error instanceof AccountDeletionError && error.step === 'billing') {
        return internalError(
          'account-delete-billing',
          error,
          "Nous n'avons pas pu résilier votre abonnement : rien n'a été supprimé. Réessayez dans un instant ou contactez-nous."
        );
      }
      throw error;
    }
  } catch (error) {
    const limited = rateLimitErrorResponse(error);
    if (limited) return limited;
    return internalError('account-delete', error, 'La suppression a échoué. Vos données ne sont peut-être pas toutes supprimées : relancez l’opération ou contactez-nous.');
  }
}
