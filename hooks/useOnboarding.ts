'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeOnboardingSteps, ONBOARDING_DISMISS_KEY, type OnboardingProgress } from '@/lib/onboarding';

const EMPTY: OnboardingProgress = { documents: 0, quizzesGenerated: 0, quizAttempts: 0, cardsReviewed: 0 };

async function count(supabase: SupabaseClient, table: string): Promise<number> {
  const { count: n } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return n ?? 0;
}

/** Avancement du parcours guidé, déduit des données réelles (aucune table dédiée). */
export function useOnboarding(supabase: SupabaseClient, userId: string | null, documentsCount: number) {
  const [progress, setProgress] = useState<OnboardingProgress>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (!userId) return;
    try {
      setDismissed(window.localStorage.getItem(ONBOARDING_DISMISS_KEY(userId)) === '1');
    } catch {
      setDismissed(false);
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [quizExports, attempts, reviews] = await Promise.all([
      supabase.from('export_events').select('*', { count: 'exact', head: true }).eq('kind', 'quiz_export'),
      count(supabase, 'quiz_attempts'),
      count(supabase, 'flashcard_reviews'),
    ]);
    setProgress({ documents: documentsCount, quizzesGenerated: quizExports.count ?? 0, quizAttempts: attempts, cardsReviewed: reviews });
    setLoaded(true);
  }, [supabase, userId, documentsCount]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (!userId) return;
    try {
      window.localStorage.setItem(ONBOARDING_DISMISS_KEY(userId), '1');
    } catch {
      // Stockage indisponible : le masquage ne durera que pour cette visite
    }
  }, [userId]);

  const steps = computeOnboardingSteps(progress);
  const completed = steps.filter((s) => s.done).length;
  return { steps, completed, total: steps.length, loaded, dismissed, dismiss, refresh };
}
