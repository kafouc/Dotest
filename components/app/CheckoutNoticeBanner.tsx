'use client';

import type { CheckoutNotice } from '@/hooks/useCheckoutNotice';

type Props = {
  notice: CheckoutNotice;
  onManageSubscription: () => void;
  onDismiss: () => void;
};

export default function CheckoutNoticeBanner({ notice, onManageSubscription, onDismiss }: Props) {
  return (
    <div
      role="status"
      className={`mx-4 mt-4 rounded-lg border px-4 py-3 text-sm sm:mx-6 ${
        notice === 'cancel'
          ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
          : 'border-green-200 bg-green-50 text-green-800'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {notice === 'partial' && <>Plan Partiel activé&nbsp;! Les quotas confort sont maintenant disponibles.</>}
          {notice === 'pro' && <>Plan Sérénité activé&nbsp;! Toutes les fonctionnalités avancées sont débloquées.</>}
          {notice === 'cancel' && <>Paiement annulé. Aucun changement n&apos;a été effectué.</>}
        </span>
        <div className="flex items-center gap-2">
          {notice !== 'cancel' && (
            <button
              type="button"
              onClick={onManageSubscription}
              className="rounded-md border border-current px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            >
              Gérer mon abonnement
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-md border border-transparent bg-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-inherit hover:bg-white/70"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
