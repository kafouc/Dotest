"use client";

import { useState } from 'react';

type Props = {
  visible: boolean;
  message: string;
};

type Plan = 'partial' | 'pro';

async function requestCheckout(plan: Plan): Promise<string> {
  const response = await fetch('/api/billing/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Impossible de démarrer le paiement.');
  }
  const data = await response.json();
  if (!data?.url) {
    throw new Error('URL Stripe manquante.');
  }
  return data.url as string;
}

export default function UpgradePrompt({ visible, message }: Props) {
  const [loadingPlan, setLoadingPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!visible) {
    return null;
  }

  const launchCheckout = async (plan: Plan) => {
    try {
      setLoadingPlan(plan);
      setError(null);
      const url = await requestCheckout(plan);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-brand-yellow/40 bg-brand-yellow-light/40 p-4 text-sm text-brand-dark shadow-sm">
      <p className="font-semibold text-brand-dark">{message}</p>
      <p className="mt-2 text-xs text-brand-dark-lighter">
        Passez à un plan supérieur pour continuer vos générations.
      </p>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-600 border border-red-200">{error}</p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => launchCheckout('partial')}
          disabled={loadingPlan !== null}
          className="flex-1 rounded-md bg-brand-yellow px-4 py-2 text-sm font-semibold text-brand-dark shadow hover:bg-brand-yellow-dark disabled:opacity-50"
        >
          {loadingPlan === 'partial' ? 'Redirection...' : 'Pass Partiel'}
        </button>
        <button
          type="button"
          onClick={() => launchCheckout('pro')}
          disabled={loadingPlan !== null}
          className="flex-1 rounded-md border border-brand-teal px-4 py-2 text-sm font-semibold text-brand-teal hover:bg-brand-teal/10 disabled:opacity-50"
        >
          {loadingPlan === 'pro' ? 'Redirection...' : 'Passe Sérénité'}
        </button>
      </div>
    </div>
  );
}
