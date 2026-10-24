/**
 * Contenu des notifications push. Chaque message utilise les données réelles de l'utilisateur (cartes à revoir, série de jours)
 * et renvoie vers la page utile : un rappel ne sert que s'il mène directement à l'action.
 */

export type NotificationKind = 'welcome' | 'morning' | 'spaced' | 'evening' | 'test';

export type NotificationContext = {
  dueCount?: number;
  newCount?: number;
  quizErrorDue?: number;
  reviewedToday?: number;
  dailyGoal?: number;
  currentStreak?: number;
};

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
  icon: string;
  badge: string;
};

const ICON = '/icons/icon-192x192.png';
const BADGE = '/icons/icon-72x72.png';

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export function buildNotification(kind: NotificationKind, context: NotificationContext = {}): PushPayload {
  const due = context.dueCount ?? 0;
  const fresh = context.newCount ?? 0;
  const pending = due + fresh;
  const streak = context.currentStreak ?? 0;
  const errors = context.quizErrorDue ?? 0;
  const base = { icon: ICON, badge: BADGE };

  switch (kind) {
    case 'welcome':
      return {
        ...base,
        tag: 'welcome',
        url: '/settings',
        title: 'Bienvenue sur Sheet of Paper 👋',
        body: 'Rappels activés : un le matin, un à midi pour les cartes à revoir et un le soir. Réglez-les quand vous voulez dans Paramètres.',
      };

    case 'morning':
      return {
        ...base,
        tag: 'morning',
        url: pending > 0 ? '/review' : '/app',
        title: '☀️ Bonjour ! 5 minutes pour réviser ?',
        body:
          pending > 0
            ? `${pending} ${plural(pending, 'carte vous attend', 'cartes vous attendent')} aujourd’hui.${streak > 0 ? ` Série en cours : ${streak} ${plural(streak, 'jour', 'jours')}.` : ''}`
            : streak > 0
              ? `Votre série est à ${streak} ${plural(streak, 'jour', 'jours')} : gardez la flamme avec un petit quiz.`
              : 'Une courte session pour bien démarrer la journée ?',
      };

    case 'spaced':
      return {
        ...base,
        tag: 'spaced',
        url: '/review',
        title: '🧠 C’est le bon moment de réviser',
        body:
          `${due} ${plural(due, 'carte à revoir', 'cartes à revoir')} maintenant, juste avant de risquer de ${plural(due, 'l’oublier', 'les oublier')}.` +
          (errors > 0 ? ` Dont ${errors} tirée${errors > 1 ? 's' : ''} de vos erreurs de quiz.` : ''),
      };

    case 'evening':
      return {
        ...base,
        tag: 'evening',
        url: pending > 0 ? '/review' : '/app',
        title: streak > 0 ? '🔥 Votre série est en jeu' : '🌙 Une révision avant de dormir ?',
        body:
          streak > 0
            ? `Pas encore de révision aujourd’hui : une session et vous validez votre ${streak + 1}ᵉ jour d’affilée.`
            : 'Pas encore de révision aujourd’hui. Cinq minutes ce soir aident à retenir durablement.',
      };

    case 'test':
    default:
      return {
        ...base,
        tag: 'test',
        url: '/settings',
        title: 'Test réussi ✅',
        body: 'Les notifications fonctionnent sur cet appareil.',
      };
  }
}

/** Fuseaux horaires IANA acceptés (le navigateur en fournit un valide ; on refuse tout le reste). */
export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export type NotificationPrefs = {
  notify_morning: boolean;
  notify_spaced: boolean;
  notify_evening: boolean;
  morning_hour: number;
  evening_hour: number;
  timezone: string;
};

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  notify_morning: true,
  notify_spaced: true,
  notify_evening: true,
  morning_hour: 8,
  evening_hour: 19,
  timezone: 'Europe/Paris',
};

export const MORNING_HOURS = [6, 7, 8, 9, 10] as const;
export const EVENING_HOURS = [18, 19, 20, 21, 22] as const;
