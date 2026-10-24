'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { fetchUserPlan, type SubscriptionPlan } from '@/lib/subscriptions';
import { CLASS_LIMITS } from '@/lib/constants';
import { createClass, isClassLimitError, isClassesUnavailable, listClasses, setClassArchived, type ClassRow } from '@/lib/classes';
import { confirmDialog } from '@/components/ui/confirm';
import ToastContainer, { useToast } from '@/components/ui/Toast';
import { trackPageView } from '@/lib/trackPageView';

export default function ClassesPage() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { toasts, showToast, removeToast } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [plan, setPlan] = useState<SubscriptionPlan>('freemium');
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setClasses(await listClasses(supabase));
    } catch (error) {
      if (isClassesUnavailable(error as { code?: string; message?: string })) setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    trackPageView('/classes');
    void load();
    fetchUserPlan(supabase)
      .then((row) => {
        const p = row?.plan;
        if (p === 'partial' || p === 'pro') setPlan(p);
      })
      .catch(() => undefined);
  }, [supabase, load]);

  const limit = CLASS_LIMITS[plan];
  const atLimit = classes.length >= limit;

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createClass(supabase, { name, level });
      setName('');
      setLevel('');
      await load();
      showToast('Classe créée.', 'success');
    } catch (error) {
      const e = error as { code?: string; message?: string };
      showToast(isClassLimitError(e) ? `Votre forfait permet ${limit} classe${limit > 1 ? 's' : ''} active${limit > 1 ? 's' : ''}.` : "Impossible de créer la classe.", 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (row: ClassRow) => {
    const ok = await confirmDialog({
      title: `Archiver « ${row.name} » ?`,
      message: "La classe disparaît de la liste et libère une place dans votre forfait. L'historique est conservé.",
      confirmLabel: 'Archiver',
    });
    if (!ok) return;
    try {
      await setClassArchived(supabase, row.id, true);
      await load();
    } catch {
      showToast("Impossible d'archiver la classe.", 'error');
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-brand-dark">Mes classes</h1>
        <Link href="/app" className="text-sm font-medium text-brand-dark-light underline-offset-2 hover:underline">
          Retour à l&apos;application
        </Link>
      </div>

      {unavailable ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          L&apos;espace enseignant n&apos;est pas encore activé sur cette installation.
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-600">
            Rattachez vos séances de quiz en direct à une classe pour suivre les résultats séance après séance et comparer la progression.
            Les élèves restent anonymes : seul le pseudo choisi à l&apos;entrée de la séance est enregistré.
          </p>

          <form onSubmit={handleCreate} className="mb-6 rounded-xl bg-white p-4 shadow">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Nouvelle classe</h2>
            <div className="flex flex-wrap gap-3">
              <label className="min-w-[10rem] flex-1 text-sm">
                <span className="mb-1 block text-gray-700">Nom</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required placeholder="4e B – Physique" className="w-full rounded-md border px-3 py-2" />
              </label>
              <label className="w-40 text-sm">
                <span className="mb-1 block text-gray-700">Niveau (facultatif)</span>
                <input value={level} onChange={(e) => setLevel(e.target.value)} maxLength={40} placeholder="Quatrième" className="w-full rounded-md border px-3 py-2" />
              </label>
              <button
                type="submit"
                disabled={saving || atLimit || !name.trim()}
                className="self-end rounded-md bg-brand-yellow px-4 py-2 font-semibold text-brand-dark hover:bg-brand-yellow-dark disabled:opacity-50"
              >
                Créer
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {classes.length}/{limit} classe{limit > 1 ? 's' : ''} active{limit > 1 ? 's' : ''} avec votre forfait.
              {atLimit && (
                <>
                  {' '}
                  <Link href="/settings" className="font-medium underline">
                    Passer à un forfait supérieur
                  </Link>
                </>
              )}
            </p>
          </form>

          {loading ? (
            <p className="text-gray-600">Chargement…</p>
          ) : classes.length === 0 ? (
            <div className="rounded-xl bg-white p-6 text-center shadow">
              <p className="font-medium text-brand-dark">Aucune classe pour le moment.</p>
              <p className="mt-1 text-sm text-gray-600">Créez-en une, puis choisissez-la au moment de lancer une séance en direct.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {classes.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow">
                  <Link href={`/classes/${row.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-heading font-bold text-brand-dark">{row.name}</p>
                    <p className="text-xs text-gray-500">{row.level ?? 'Niveau non précisé'}</p>
                  </Link>
                  <Link href={`/classes/${row.id}`} className="rounded-md bg-brand-yellow px-3 py-1.5 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark">
                    Résultats
                  </Link>
                  <button type="button" onClick={() => handleArchive(row)} className="text-sm text-gray-500 underline-offset-2 hover:underline">
                    Archiver
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
