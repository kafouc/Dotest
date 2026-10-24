'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchUserStreak, type UserStreak } from '@/lib/streaks';

export function useUserStreak(supabase: SupabaseClient, userId: string | null) {
  const [streak, setStreak] = useState<UserStreak | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setStreak(null);
      return;
    }
    fetchUserStreak(supabase, userId).then((data) => {
      if (!cancelled) setStreak(data);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const refreshStreak = useCallback(async () => {
    if (!userId) {
      setStreak(null);
      return;
    }
    setStreak(await fetchUserStreak(supabase, userId));
  }, [supabase, userId]);

  return { streak, refreshStreak };
}
