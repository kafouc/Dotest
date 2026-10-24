/**
 * Règles d'affichage de l'invitation « Activer les rappels » (fonctions pures, testées).
 *
 * Le navigateur n'accepte de demander l'autorisation qu'après un geste de l'utilisateur (clic), et Safari sur iPhone n'expose
 * les notifications que si le site est installé sur l'écran d'accueil. D'où une carte avec un vrai bouton plutôt qu'une demande
 * automatique qui échoue en silence.
 */

export const PUSH_PROMPT_SNOOZE_KEY = 'sop-push-prompt-snooze-until';
export const PUSH_PROMPT_SNOOZE_DAYS = 7;

export type PushPromptState = 'show' | 'ios-install' | 'hidden';

export type PushPromptInput = {
  /** Service worker, PushManager et Notification disponibles */
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  /** Date (ms) jusqu'à laquelle l'invitation est masquée, 0 si elle ne l'est pas */
  snoozedUntil: number;
  now: number;
  ios: boolean;
  standalone: boolean;
  /** L'utilisateur a déjà de la matière à réviser : moment pertinent pour proposer des rappels */
  hasContent: boolean;
};

export function derivePushPromptState(input: PushPromptInput): PushPromptState {
  if (!input.hasContent) return 'hidden';
  if (input.snoozedUntil > input.now) return 'hidden';
  if (input.subscribed || input.permission === 'denied') return 'hidden';
  // iPhone / iPad : les notifications web n'existent qu'une fois l'application ajoutée à l'écran d'accueil
  if (input.ios && !input.standalone) return 'ios-install';
  if (!input.supported) return 'hidden';
  return 'show';
}

export function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  // iPadOS se présente comme un Mac : seul le tactile le distingue
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function readSnoozeUntil(): number {
  try {
    const value = Number(window.localStorage.getItem(PUSH_PROMPT_SNOOZE_KEY));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function snoozePushPrompt(days = PUSH_PROMPT_SNOOZE_DAYS, now = Date.now()): number {
  const until = now + days * 24 * 60 * 60 * 1000;
  try {
    window.localStorage.setItem(PUSH_PROMPT_SNOOZE_KEY, String(until));
  } catch {
    // Stockage indisponible : l'invitation reviendra à la prochaine visite
  }
  return until;
}
