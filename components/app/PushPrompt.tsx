'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { derivePushPromptState, readSnoozeUntil, snoozePushPrompt } from '@/lib/pushPrompt';

type Props = {
  /** L'utilisateur a au moins un document : c'est le bon moment pour proposer des rappels */
  hasContent: boolean;
};

/**
 * Invitation à activer les rappels en un clic, directement dans l'application (sans passer par les Paramètres).
 * Disparaît une fois les rappels activés, refusés dans le navigateur, ou repoussés (« Plus tard » : 7 jours).
 */
export default function PushPrompt({ hasContent }: Props) {
  const push = usePushNotifications();
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [now, setNow] = useState(0);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSnoozedUntil(readSnoozeUntil());
    setNow(Date.now());
  }, []);

  // Confirmation affichée quelques secondes après l'activation, puis la carte disparaît
  useEffect(() => {
    if (feedback?.tone !== 'ok') return;
    const timer = setTimeout(() => setFeedback(null), 7000);
    return () => clearTimeout(timer);
  }, [feedback]);

  if (!push.ready || now === 0) return null;

  if (feedback?.tone === 'ok') {
    return (
      <section role="status" className="mx-4 mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 sm:mx-6">
        <p className="font-semibold">Rappels activés 🎉</p>
        <p className="mt-1">
          Vous venez de recevoir une notification de bienvenue. Selon vos habitudes, vous aurez un rappel le matin, la révision des cartes à midi et un rappel le soir.{' '}
          <Link href="/settings" className="underline">
            Régler les rappels
          </Link>
        </p>
      </section>
    );
  }

  const state = derivePushPromptState({
    supported: push.supported,
    permission: push.permission,
    subscribed: push.subscribed,
    snoozedUntil,
    now,
    ios: push.ios,
    standalone: push.standalone,
    hasContent,
  });
  if (state === 'hidden') return null;

  const later = () => setSnoozedUntil(snoozePushPrompt());

  if (state === 'ios-install') {
    return (
      <section aria-labelledby="push-ios-title" className="mx-4 mt-4 rounded-xl border border-brand-yellow bg-brand-yellow-light p-4 sm:mx-6">
        <h2 id="push-ios-title" className="font-heading text-base font-bold text-brand-dark">
          Recevoir des rappels sur iPhone
        </h2>
        <p className="mt-1 text-sm text-brand-dark-light">
          Sur iPhone et iPad, les notifications fonctionnent une fois l&apos;application ajoutée à l&apos;écran d&apos;accueil : appuyez sur <strong>Partager</strong>, puis sur{' '}
          <strong>Sur l&apos;écran d&apos;accueil</strong>, et ouvrez l&apos;application depuis son icône.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/#installer" className="rounded-full bg-brand-yellow px-4 py-1.5 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark">
            Voir comment faire
          </Link>
          <button type="button" onClick={later} className="rounded-full border border-brand-dark-lighter bg-white px-4 py-1.5 text-sm font-medium text-brand-dark hover:bg-gray-50">
            Plus tard
          </button>
        </div>
      </section>
    );
  }

  const activate = async () => {
    setFeedback(null);
    const result = await push.enable();
    if (result.ok) setFeedback({ tone: 'ok', text: 'ok' });
    else setFeedback({ tone: 'error', text: result.message });
  };

  return (
    <section aria-labelledby="push-title" className="mx-4 mt-4 rounded-xl border border-brand-teal bg-brand-teal-light p-4 sm:mx-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl">
          🔔
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="push-title" className="font-heading text-base font-bold text-brand-dark">
            Ne ratez plus une révision
          </h2>
          <p className="mt-1 text-sm text-brand-dark-light">
            Un rappel le matin, la révision de vos cartes à midi et un rappel le soir, seulement quand c&apos;est utile. Vous gardez la main dans les Paramètres.
          </p>
          {feedback?.tone === 'error' && (
            <p role="alert" className="mt-2 text-sm text-red-700">
              {feedback.text}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={activate}
              disabled={push.busy}
              className="rounded-full bg-brand-teal px-5 py-2 text-sm font-semibold text-white hover:bg-brand-teal-dark disabled:opacity-60"
            >
              {push.busy ? 'Activation…' : 'Activer les rappels'}
            </button>
            <button type="button" onClick={later} disabled={push.busy} className="rounded-full border border-brand-dark-lighter bg-white px-4 py-2 text-sm font-medium text-brand-dark hover:bg-gray-50">
              Plus tard
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
