'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export type CheckoutNotice = 'partial' | 'pro' | 'cancel';

/**
 * Lit ?checkout=partial|pro|cancel (retour de Stripe), le retire de l'URL
 * et expose le message à afficher pendant 8 secondes.
 */
export function useCheckoutNotice() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get('checkout');
  const searchParamsString = searchParams.toString();
  const [notice, setNotice] = useState<CheckoutNotice | null>(null);

  useEffect(() => {
    if (!checkoutParam) return;

    if (checkoutParam === 'partial' || checkoutParam === 'pro' || checkoutParam === 'cancel') {
      setNotice(checkoutParam);
    }

    const params = new URLSearchParams(searchParamsString);
    params.delete('checkout');
    params.delete('session_id');
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/app?${nextQuery}` : '/app', { scroll: false });
  }, [checkoutParam, router, searchParamsString]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  return { notice, dismiss: () => setNotice(null) };
}
