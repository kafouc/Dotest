'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import FlashcardStudy from '@/components/FlashcardStudy';
import ProgressBar from '@/components/ui/ProgressBar';
import { DAILY_GOAL_OPTIONS, getReviewSummary, setDailyGoal, type ReviewSummary } from '@/lib/flashcards';
import { fetchUserStreak, type UserStreak } from '@/lib/streaks';
import { logger } from '@/lib/logger';
import { trackPageView } from '@/lib/trackPageView';

export default function ReviewTodayPage() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [studying, setStudying] = useState(false);

  const refresh = useCallback(async () => {
    const next = await getReviewSummary(supabase);
    if (next) setSummary(next);
    else setUnavailable(true);
    const { data } = await supabase.auth.getUser();
    if (data.user) setStreak(await fetchUserStreak(supabase, data.user.id));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    trackPageView('/review');
    void refresh();
  }, [refresh]);

  const changeGoal = async (goal: number) => {
    try {
      await setDailyGoal(supabase, goal);
      await refresh();
    } catch (error) {
      logger.error("Enregistrement de l'objectif échoué", error instanceof Error ? error : { error: String(error) });
    }
  };

  const goal = summary?.dailyGoal ?? 10;
  const done = summary?.reviewedToday ?? 0;
  const goalReached = done >= goal;
  const pending = (summary?.dueCount ?? 0) + (summary?.newCount ?? 0);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-brand-dark">À réviser aujourd&apos;hui</h1>
        <Link href="/app" className="text-sm font-medium text-brand-dark-light underline-offset-2 hover:underline">
          Retour à l&apos;application
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-600">Chargement…</p>
      ) : unavailable ? (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
          Le suivi quotidien n&apos;est pas encore activé sur cette installation. Vous pouvez quand même réviser vos cartes :
          <div className="mt-3">
            <FlashcardStudy limit={20} />
          </div>
        </div>
      ) : (
        <>
          <section className="rounded-xl bg-white p-5 shadow" aria-labelledby="goal-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="goal-title" className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  Objectif du jour
                </h2>
                <p className="mt-1 font-heading text-3xl font-bold text-brand-dark">
                  {Math.min(done, goal)}
                  <span className="text-lg font-semibold text-gray-500"> / {goal} cartes</span>
                </p>
              </div>
              {streak && streak.current_streak > 0 && (
                <p className="rounded-full bg-orange-50 px-3 py-1 text-sm font-semibold text-orange-700">
                  🔥 {streak.current_streak} jour{streak.current_streak > 1 ? 's' : ''} d&apos;affilée
                </p>
              )}
            </div>
            <div className="mt-3">
              <ProgressBar progress={Math.min(100, Math.round((done / goal) * 100))} color="green" />
            </div>
            <p className="mt-3 text-sm text-gray-600">
              {goalReached
                ? 'Objectif atteint, bravo ! Vous pouvez continuer si vous le souhaitez.'
                : `Encore ${goal - done} carte${goal - done > 1 ? 's' : ''} pour atteindre votre objectif.`}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-gray-600">Mon objectif :</span>
              {DAILY_GOAL_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => changeGoal(option)}
                  aria-pressed={goal === option}
                  className={`rounded-full border px-3 py-1 font-medium ${
                    goal === option ? 'border-brand-yellow bg-brand-yellow text-brand-dark' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-4 grid grid-cols-3 gap-3 text-center">
            <Stat label="À revoir" value={summary?.dueCount ?? 0} />
            <Stat label="Nouvelles" value={summary?.newCount ?? 0} />
            <Stat label="Tirées de vos erreurs" value={summary?.quizErrorDue ?? 0} />
          </section>

          <div className="mt-4">
            {pending === 0 ? (
              <div className="rounded-xl bg-white p-6 text-center shadow">
                <p className="font-medium text-brand-dark">Rien à réviser pour l&apos;instant.</p>
                <p className="mt-1 text-sm text-gray-600">
                  Faites un quiz : les questions ratées reviendront ici, espacées dans le temps. Ou{' '}
                  <Link href="/flashcards" className="underline">
                    générez des flashcards
                  </Link>{' '}
                  à partir d&apos;un document.
                </p>
              </div>
            ) : studying ? (
              <FlashcardStudy limit={Math.max(10, goal)} onActivity={refresh} />
            ) : (
              <button
                type="button"
                onClick={() => setStudying(true)}
                className="w-full rounded-xl bg-brand-yellow px-6 py-4 text-lg font-semibold text-brand-dark hover:bg-brand-yellow-dark"
              >
                {done > 0 ? 'Continuer la révision' : 'Commencer la révision'} ({pending} carte{pending > 1 ? 's' : ''})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow">
      <p className="font-heading text-2xl font-bold text-brand-dark">{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  );
}
