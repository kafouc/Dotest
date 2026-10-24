'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import ConsentPreferencesButton from '@/components/consent/ConsentPreferencesButton';

type Props = {
  supabase: SupabaseClient;
  email: string;
};

/** Droits RGPD : export des données, suppression du compte, préférences de cookies. */
export default function DataPrivacySection({ supabase, email }: Props) {
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!confirmOpen) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) setConfirmOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmOpen, deleting]);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/account/export');
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage({ tone: 'error', text: data?.error || "L'export a échoué." });
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sheet-of-paper-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage({ tone: 'ok', text: "Export téléchargé. Les liens vers vos fichiers d'origine expirent au bout d'une heure." });
    } catch {
      setMessage({ tone: 'error', text: "L'export a échoué. Vérifiez votre connexion." });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: typedEmail }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setDeleteError(data?.error || 'La suppression a échoué.');
        return;
      }
      try {
        if ('caches' in window) {
          const names = await caches.keys();
          await Promise.all(names.map((name) => caches.delete(name)));
        }
        window.localStorage.clear();
      } catch {
        // Nettoyage local impossible : sans importance, le compte n'existe plus
      }
      await supabase.auth.signOut().catch(() => undefined);
      window.location.assign('/compte-supprime');
    } catch {
      setDeleteError('La suppression a échoué. Vérifiez votre connexion et réessayez.');
    } finally {
      setDeleting(false);
    }
  };

  const emailMatches = typedEmail.trim().toLowerCase() === email.toLowerCase();

  return (
    <section aria-labelledby="privacy-title" className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 id="privacy-title" className="font-heading text-lg font-bold text-brand-dark">
        Vos données
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        Vous gardez la main sur vos données. Détails dans notre{' '}
        <Link href="/confidentialite" className="underline">
          politique de confidentialité
        </Link>
        .
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-brand-dark hover:bg-gray-50 disabled:opacity-50"
          >
            {exporting ? 'Préparation…' : 'Exporter mes données'}
          </button>
          <p className="mt-1 text-xs text-gray-500">Un fichier JSON avec vos documents, cartes, résultats et réglages, et des liens vers vos fichiers d&apos;origine.</p>
          {message && (
            <p role="status" className={`mt-2 text-sm ${message.tone === 'ok' ? 'text-green-700' : 'text-red-700'}`}>
              {message.text}
            </p>
          )}
        </div>

        <div>
          <ConsentPreferencesButton />
          <p className="mt-1 text-xs text-gray-500">Mesure d&apos;audience : désactivée tant que vous ne l&apos;avez pas acceptée.</p>
        </div>

        <div className="rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-900">Supprimer mon compte</p>
          <p className="mt-1 text-xs text-red-800">
            Supprime définitivement vos documents, fichiers, cartes, résultats et classes, et résilie votre abonnement. Seules les factures sont conservées (obligation légale). Action irréversible.
          </p>
          <button
            type="button"
            onClick={() => {
              setTypedEmail('');
              setDeleteError(null);
              setConfirmOpen(true);
            }}
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Supprimer mon compte…
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !deleting) setConfirmOpen(false);
          }}
        >
          <div role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-desc" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 id="delete-title" className="font-heading text-lg font-bold text-brand-dark">
              Supprimer définitivement votre compte ?
            </h3>
            <p id="delete-desc" className="mt-2 text-sm text-gray-700">
              Cette action ne peut pas être annulée. Pensez à exporter vos données d&apos;abord. Pour confirmer, saisissez votre adresse e-mail : <strong>{email}</strong>
            </p>
            <label htmlFor="confirm-email" className="sr-only">
              Adresse e-mail du compte
            </label>
            <input
              id="confirm-email"
              ref={inputRef}
              type="email"
              autoComplete="off"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="votre@email.fr"
            />
            {deleteError && (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmOpen(false)} disabled={deleting} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={!emailMatches || deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
