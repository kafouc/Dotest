'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getReviewSummary, type ReviewSummary } from '@/lib/flashcards';

/** Compteurs de révision du jour. `null` tant que la migration review_today n'est pas appliquée. */
export function useReviewSummary(supabase: SupabaseClient, userId: string | null) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setSummary(null);
      return;
    }
    setSummary(await getReviewSummary(supabase));
  }, [supabase, userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, refreshSummary: refresh };
}
