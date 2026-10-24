'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { fetchUserPlan, type SubscriptionPlan } from '@/lib/subscriptions';
import { logger } from '@/lib/logger';
import type { CheckoutNotice } from '@/hooks/useCheckoutNotice';

/**
 * Forfait de l'utilisateur. Après un paiement (notice partial|pro), le webhook Stripe peut arriver
 * avec un léger retard : on affiche tout de suite le forfait acheté, puis on le confirme auprès de
 * la base, avec une resynchronisation Stripe et une seconde vérification 4 s plus tard.
 */
export function useUserPlan(supabase: SupabaseClient, session: Session | null, checkoutNotice: CheckoutNotice | null) {
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>('freemium');

  const loadUserPlan = useCallback(async (): Promise<SubscriptionPlan> => {
    const planRow = await fetchUserPlan(supabase).catch(() => null);
    const plan = planRow?.plan;
    return plan === 'partial' || plan === 'pro' ? plan : 'freemium';
  }, [supabase]);

  const resyncUserPlan = useCallback(async (): Promise<SubscriptionPlan | null> => {
    try {
      const response = await fetch('/api/billing/resync', { method: 'POST' });
      if (!response.ok) return null;
      const data = (await response.json()) as { plan?: SubscriptionPlan };
      const plan = data?.plan;
      return plan === 'freemium' || plan === 'partial' || plan === 'pro' ? plan : null;
    } catch (error) {
      logger.warn('[billing] resyncUserPlan failed', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!session) {
      setUserPlan('freemium');
      return;
    }
    let cancelled = false;
    loadUserPlan().then((plan) => {
      if (!cancelled) setUserPlan(plan);
    });
    return () => {
      cancelled = true;
    };
  }, [session, loadUserPlan]);

  useEffect(() => {
    if (checkoutNotice !== 'partial' && checkoutNotice !== 'pro') return;

    setUserPlan(checkoutNotice);

    let cancelled = false;
    const syncPlan = async () => {
      const fetchedPlan = await loadUserPlan();
      if (cancelled) return;
      if (fetchedPlan === checkoutNotice) {
        setUserPlan(fetchedPlan);
        return;
      }
      const resyncedPlan = await resyncUserPlan();
      if (cancelled) return;
      setUserPlan(resyncedPlan ?? fetchedPlan);
    };

    void syncPlan();
    const retryTimer = window.setTimeout(() => void syncPlan(), 4000);

    return () => {
      cancelled = true;
      window.clearTimeout(retryTimer);
    };
  }, [checkoutNotice, loadUserPlan, resyncUserPlan]);

  return userPlan;
}
