/**
 * Consentement à la mesure d'audience (RGPD / CNIL).
 * - Sans choix, ou en cas de refus : aucune mesure d'audience (ni Vercel Analytics, ni suivi de pages maison).
 * - Le choix est mémorisé dans le navigateur (localStorage), pas dans un cookie de suivi.
 * - Les fonctions nécessaires au service (connexion, quotas, paiement) ne dépendent pas de ce choix.
 */

export const CONSENT_KEY = 'sop-consent-v1';
export const CONSENT_CHANGED_EVENT = 'sop-consent-changed';
export const CONSENT_OPEN_EVENT = 'sop-consent-open';

/** `reminders` : l'utilisateur a demandé les rappels de révision depuis le bandeau (choix distinct de la mesure d'audience). */
export type ConsentState = { analytics: boolean; decidedAt: string; reminders?: boolean };

export function readConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.decidedAt !== 'string') return null;
    return { analytics: parsed.analytics, decidedAt: parsed.decidedAt, reminders: parsed.reminders === true };
  } catch {
    return null;
  }
}

export function writeConsent(analytics: boolean, reminders = false): ConsentState {
  const state: ConsentState = { analytics, decidedAt: new Date().toISOString(), reminders };
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(state));
  } catch {
    // Stockage indisponible : le choix vaut pour la page en cours seulement
  }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: state }));
  return state;
}

export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

/** Rouvre le bandeau pour modifier son choix (lien « Gérer les cookies »). */
export function openConsentPreferences(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

/** Rappels demandés depuis le bandeau : sert à finir l'activation à la première connexion, sans nouveau clic. */
export function wantsReminders(): boolean {
  return readConsent()?.reminders === true;
}
