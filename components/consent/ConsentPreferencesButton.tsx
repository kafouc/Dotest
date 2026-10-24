'use client';

import { openConsentPreferences } from '@/lib/consent';

export default function ConsentPreferencesButton({ className = '' }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openConsentPreferences}
      className={className || 'rounded-full border border-gray-400 px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-gray-50'}
    >
      Gérer mes préférences de cookies
    </button>
  );
}
