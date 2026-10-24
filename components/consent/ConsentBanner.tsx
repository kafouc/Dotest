'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CONSENT_OPEN_EVENT, readConsent, writeConsent } from '@/lib/consent';

/** Bandeau de consentement : « Accepter » et « Refuser » ont la même importance, refuser est aussi simple qu'accepter. */
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readConsent() === null);
    const open = () => setVisible(true);
    window.addEventListener(CONSENT_OPEN_EVENT, open);
    return () => window.removeEventListener(CONSENT_OPEN_EVENT, open);
  }, []);

  if (!visible) return null;

  const choose = (analytics: boolean) => {
    writeConsent(analytics);
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-gray-200 bg-white p-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-700">
          <p id="consent-title" className="font-semibold text-brand-dark">
            Mesure d&apos;audience
          </p>
          <p className="mt-1">
            Avec votre accord, nous mesurons la fréquentation du site pour l&apos;améliorer. Sans accord, rien n&apos;est mesuré ; le service fonctionne de la même façon.{' '}
            <Link href="/confidentialite" className="underline">
              En savoir plus
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => choose(false)} className="rounded-full border border-gray-400 px-5 py-2 text-sm font-semibold text-brand-dark hover:bg-gray-50">
            Refuser
          </button>
          <button type="button" onClick={() => choose(true)} className="rounded-full bg-brand-yellow px-5 py-2 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark">
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
