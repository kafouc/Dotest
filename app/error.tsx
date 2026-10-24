'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import ErrorState from '@/components/ui/ErrorState';
import { logger } from '@/lib/logger';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    logger.error('[ui] erreur non gérée', error, { digest: error.digest });
  }, [error]);

  return (
    <ErrorState
      title="Une erreur est survenue"
      description="Un problème inattendu est survenu. Vous pouvez réessayer ou revenir à l'accueil."
      reference={error.digest}
    >
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-brand-yellow px-5 py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark"
      >
        Réessayer
      </button>
      <Link
        href="/"
        className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-brand-dark hover:bg-gray-50"
      >
        Retour à l&apos;accueil
      </Link>
    </ErrorState>
  );
}
