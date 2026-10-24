'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_NOTIFICATION_PREFS, EVENING_HOURS, MORNING_HOURS, type NotificationPrefs } from '@/lib/notifications';
import { loadNotificationPrefs, saveNotificationPrefs } from '@/lib/notificationPrefs';

type Props = { supabase: SupabaseClient };

type ToggleKey = 'notify_morning' | 'notify_spaced' | 'notify_evening';

/** Choix des rappels : matin, révision espacée (13 h), soir, avec un bouton d'essai. */
export default function NotificationPreferences({ supabase }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadNotificationPrefs(supabase).then((loadedPrefs) => {
      if (!cancelled) {
        setPrefs(loadedPrefs);
        setLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const update = async (change: Partial<NotificationPrefs>) => {
    const previous = prefs;
    setPrefs({ ...prefs, ...change });
    setStatus(null);
    try {
      await saveNotificationPrefs(supabase, change);
      setStatus({ tone: 'ok', text: 'Préférences enregistrées.' });
    } catch {
      setPrefs(previous);
      setStatus({ tone: 'error', text: "Impossible d'enregistrer. Réessayez." });
    }
  };

  const sendTest = async () => {
    setTesting(true);
    setStatus(null);
    try {
      const response = await fetch('/api/push/test', { method: 'POST' });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setStatus(
        response.ok
          ? { tone: 'ok', text: 'Notification de test envoyée : elle devrait apparaître dans quelques secondes.' }
          : { tone: 'error', text: data?.error || "L'envoi du test a échoué." }
      );
    } catch {
      setStatus({ tone: 'error', text: "L'envoi du test a échoué. Vérifiez votre connexion." });
    } finally {
      setTesting(false);
    }
  };

  const rows: { key: ToggleKey; title: string; description: string; hours?: { key: 'morning_hour' | 'evening_hour'; options: readonly number[] } }[] = [
    {
      key: 'notify_morning',
      title: 'Rappel du matin',
      description: 'Les cartes qui vous attendent aujourd’hui, si vous n’avez pas encore révisé.',
      hours: { key: 'morning_hour', options: MORNING_HOURS },
    },
    {
      key: 'notify_spaced',
      title: 'Révision espacée (13 h)',
      description: 'Quand au moins 3 cartes sont à revoir : le bon moment avant de les oublier. Pas envoyée si votre objectif du jour est atteint.',
    },
    {
      key: 'notify_evening',
      title: 'Rappel du soir',
      description: 'Pour sauver votre série de jours, seulement si vous n’avez pas encore révisé aujourd’hui.',
      hours: { key: 'evening_hour', options: EVENING_HOURS },
    },
  ];

  return (
    <div className="mt-6 border-t border-gray-200 pt-4">
      <h3 className="text-base font-semibold text-brand-dark">Quels rappels recevoir ?</h3>
      <p className="mt-1 text-xs text-gray-500">Fuseau horaire détecté : {prefs.timezone}. Au plus une notification de chaque type par jour.</p>

      <ul className="mt-3 space-y-3">
        {rows.map((row) => (
          <li key={row.key} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <label htmlFor={row.key} className="text-sm font-medium text-gray-800">
                {row.title}
              </label>
              <p className="text-xs text-gray-500">{row.description}</p>
              {row.hours && prefs[row.key] && (
                <label className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                  Heure d&apos;envoi
                  <select
                    value={prefs[row.hours.key]}
                    onChange={(e) => update({ [row.hours!.key]: Number(e.target.value) } as Partial<NotificationPrefs>)}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                    disabled={!loaded}
                  >
                    {row.hours.options.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour} h
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <input
              id={row.key}
              type="checkbox"
              role="switch"
              checked={prefs[row.key]}
              disabled={!loaded}
              onChange={(e) => update({ [row.key]: e.target.checked } as Partial<NotificationPrefs>)}
              className="mt-1 h-5 w-5 shrink-0 accent-brand-teal"
            />
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendTest}
          disabled={testing}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-gray-50 disabled:opacity-50"
        >
          {testing ? 'Envoi…' : 'Envoyer une notification de test'}
        </button>
        {status && (
          <p role="status" className={`text-sm ${status.tone === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}
