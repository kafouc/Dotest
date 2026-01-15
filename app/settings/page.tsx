"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { FaBell, FaBellSlash, FaArrowLeft, FaCheck, FaTimes } from 'react-icons/fa';
import {
  ensureNotificationPermission,
  registerServiceWorker,
  subscribePush,
  sendSubscriptionToServer,
} from '@/lib/pushManager';
import { fetchUserPlan, type SubscriptionPlan } from '@/lib/subscriptions';

function SettingsPageContent() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied'>('default');
  const [plan, setPlan] = useState<SubscriptionPlan>('freemium');
  const [isPlanLoading, setIsPlanLoading] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [billingAction, setBillingAction] = useState<'partial' | 'pro' | 'portal' | null>(null);
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get('checkout');
  const searchParamsString = searchParams.toString();
  const [checkoutNotice, setCheckoutNotice] = useState<{ type: 'success' | 'cancel'; plan?: SubscriptionPlan } | null>(null);
  const partialCheckoutUrl = process.env.NEXT_PUBLIC_STRIPE_PARTIAL_CHECKOUT_URL;
  const refreshPlan = useCallback(async () => {
    if (!session) {
      return;
    }
    try {
      const result = await fetchUserPlan(supabase);
      if (result?.plan) {
        setPlan(result.plan);
      }
    } catch (error) {
      console.error('Erreur actualisation abonnement:', error);
    }
  }, [session, supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingAuth(false);
      if (!session) {
        router.push('/login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        router.push('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  useEffect(() => {
    let cancelled = false;
    if (!session) {
      setPlan('freemium');
      setIsPlanLoading(false);
      return;
    }

    (async () => {
      setIsPlanLoading(true);
      setBillingError(null);
      try {
        const result = await fetchUserPlan(supabase);
        if (cancelled) return;
        setPlan(result?.plan ?? 'freemium');
      } catch (error) {
        console.error('Erreur chargement abonnement:', error);
        if (!cancelled) {
          setBillingError('Impossible de récupérer votre abonnement. Veuillez réessayer.');
        }
      } finally {
        if (!cancelled) setIsPlanLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, supabase]);

  useEffect(() => {
    if (!checkoutParam) {
      return;
    }

    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    if (checkoutParam === 'partial' || checkoutParam === 'pro') {
      setCheckoutNotice({ type: 'success', plan: checkoutParam });
      const syncPlan = async () => {
        setIsPlanLoading(true);
        try {
          await refreshPlan();
        } finally {
          setIsPlanLoading(false);
        }
      };
      syncPlan();
      retryTimer = setTimeout(syncPlan, 4000);
    } else if (checkoutParam === 'cancel') {
      setCheckoutNotice({ type: 'cancel' });
    }

    const cleanUrlTimer = setTimeout(() => {
      const params = new URLSearchParams(searchParamsString);
      params.delete('checkout');
      params.delete('session_id');
      const nextQuery = params.toString();
      router.replace(nextQuery ? `/settings?${nextQuery}` : '/settings', { scroll: false });
    }, 1500);

    return () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      clearTimeout(cleanUrlTimer);
    };
  }, [checkoutParam, refreshPlan, router, searchParamsString]);

  useEffect(() => {
    if (!checkoutNotice) {
      return;
    }
    const timer = setTimeout(() => setCheckoutNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [checkoutNotice]);

  // Vérifier l'état des notifications au chargement
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotificationStatus(Notification.permission);
      checkNotificationSubscription();
    }
  }, []);

  const checkNotificationSubscription = async () => {
    try {
      if (!('serviceWorker' in navigator)) return;
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setNotificationsEnabled(!!subscription);
    } catch (error) {
      console.error('Erreur vérification abonnement:', error);
    }
  };

  const handleEnableNotifications = async () => {
    setIsProcessing(true);
    try {
      const permitted = await ensureNotificationPermission();
      if (!permitted || permitted === 'denied') {
        alert('Vous devez autoriser les notifications pour activer cette fonctionnalité.');
        setIsProcessing(false);
        return;
      }

      const reg = await registerServiceWorker('/sw.js');
      if (!reg) {
        throw new Error('Échec enregistrement Service Worker');
      }

      // Attendre un peu pour s'assurer que le SW est bien actif
      await new Promise(resolve => setTimeout(resolve, 500));

      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) {
        throw new Error('VAPID public key manquante');
      }

      const sub = await subscribePush(reg, vapid);
      await sendSubscriptionToServer(sub);
      
      setNotificationsEnabled(true);
      setNotificationStatus('granted');
      alert('✓ Notifications activées avec succès !');
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : 'Erreur activation des notifications';
      
      if (errorMessage.includes('Service Worker non actif')) {
        alert('⏳ Le Service Worker est en cours d\'initialisation. Veuillez réessayer dans quelques secondes.');
      } else {
        alert('❌ ' + errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDisableNotifications = async () => {
    setIsProcessing(true);
    try {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker non supporté');
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        setNotificationsEnabled(false);
        alert('✓ Notifications désactivées');
      }
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : 'Erreur désactivation des notifications');
    } finally {
      setIsProcessing(false);
    }
  };
  if (isCheckingAuth) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-brand-dark">Chargement...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const planLabels: Record<SubscriptionPlan, string> = {
    freemium: 'Plan Gratuit',
    partial: 'Pass Partiel',
    pro: 'Passe Sérénité',
  };

  const planNotes: Record<SubscriptionPlan, string> = {
    freemium: '1 fiche de révision par semaine et 3 quiz par document (50/mois).',
    partial: 'Quotas confort pour chaque document et suivi optimisé.',
    pro: 'Limites étendues, sessions live jusqu’à 300 participants et priorisation.',
  };

  const startCheckout = async (targetPlan: 'partial' | 'pro') => {
    setBillingError(null);
    setBillingAction(targetPlan);
    try {
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Impossible de lancer le paiement.');
      }
      window.location.href = data.url as string;
    } catch (error) {
      console.error('Erreur checkout Stripe:', error);
      if (targetPlan === 'partial' && partialCheckoutUrl) {
        window.location.href = partialCheckoutUrl;
        return;
      }
      setBillingError(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setBillingAction(null);
    }
  };

  const openBillingPortal = async () => {
    setBillingError(null);
    setBillingAction('portal');
    try {
      const response = await fetch('/api/billing/create-portal-session', {
        method: 'POST',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || 'Portail de gestion indisponible.');
      }
      window.location.href = data.url as string;
    } catch (error) {
      console.error('Erreur portail Stripe:', error);
      setBillingError(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      setBillingAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <button
            onClick={() => router.push('/app')}
            className="flex items-center gap-2 text-brand-dark hover:text-brand-teal mb-3 sm:mb-4 transition-colors min-h-[40px]"
          >
            <FaArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>
          
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-brand-dark">Paramètres</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">Gérez vos préférences et notifications</p>
        </div>

        {/* Notifications Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="p-3 bg-brand-teal/10 rounded-lg">
              {notificationsEnabled ? (
                <FaBell className="w-5 h-5 sm:w-6 sm:h-6 text-brand-teal" />
              ) : (
                <FaBellSlash className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1 w-full">
              <h2 className="text-lg sm:text-xl font-semibold text-brand-dark mb-2">Notifications push</h2>
              <p className="text-sm sm:text-base text-gray-600 mb-4">
                Recevez des rappels pour réviser vos documents au moment optimal selon votre courbe d&apos;oubli (algorithme FSRS).
              </p>

              {/* Statut actuel */}
              <div className="mb-4 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700">Statut :</span>
                  {notificationsEnabled ? (
                    <span className="flex items-center gap-1 text-green-600 text-sm font-semibold">
                      <FaCheck className="w-3 h-3" />
                      Activées
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-gray-500 text-sm font-semibold">
                      <FaTimes className="w-3 h-3" />
                      Désactivées
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Permission navigateur :</span>
                  <span className={`text-sm font-semibold ${
                    notificationStatus === 'granted' ? 'text-green-600' : 
                    notificationStatus === 'denied' ? 'text-red-600' : 
                    'text-gray-500'
                  }`}>
                    {notificationStatus === 'granted' ? 'Accordée' : 
                     notificationStatus === 'denied' ? 'Refusée' : 
                     'Non demandée'}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                {!notificationsEnabled ? (
                  <button
                    onClick={handleEnableNotifications}
                    disabled={isProcessing || notificationStatus === 'denied'}
                    className="w-full sm:w-auto px-4 py-3 bg-brand-teal hover:bg-brand-teal-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <FaBell className="w-4 h-4" />
                    {isProcessing ? 'Activation...' : 'Activer les notifications'}
                  </button>
                ) : (
                  <button
                    onClick={handleDisableNotifications}
                    disabled={isProcessing}
                    className="w-full sm:w-auto px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <FaBellSlash className="w-4 h-4" />
                    {isProcessing ? 'Désactivation...' : 'Désactiver les notifications'}
                  </button>
                )}
              </div>

              {notificationStatus === 'denied' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-700">
                    ⚠️ Vous avez bloqué les notifications dans votre navigateur. 
                    Pour les activer, vous devez modifier les paramètres de votre navigateur.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {checkoutNotice && (
          <div
            className={`mb-4 flex flex-col gap-3 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between ${
              checkoutNotice.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-yellow-200 bg-yellow-50 text-yellow-800'
            }`}
          >
            <span>
              {checkoutNotice.type === 'success' ? (
                <>
                  Votre {checkoutNotice.plan ? planLabels[checkoutNotice.plan] : 'abonnement'} est activé&nbsp;! Si le statut ne s&apos;actualise pas immédiatement, patientez quelques secondes ou rafraîchissez cette page.
                </>
              ) : (
                <>Paiement annulé. Aucun changement n&apos;a été appliqué à votre abonnement.</>
              )}
            </span>
            <button
              type="button"
              onClick={() => setCheckoutNotice(null)}
              className="self-start rounded-md border border-current px-3 py-1 text-xs font-semibold uppercase tracking-wide"
            >
              Compris
            </button>
          </div>
        )}

        {/* Subscription Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-brand-dark mb-2">Abonnement</h2>
              {isPlanLoading ? (
                <p className="text-sm text-gray-500">Chargement de votre plan...</p>
              ) : (
                <>
                  <p className="text-sm text-gray-700">
                    Plan actuel : <span className="font-semibold text-brand-dark">{planLabels[plan]}</span>
                  </p>
                  <p className="mt-2 text-xs text-gray-500">{planNotes[plan]}</p>
                </>
              )}
              {billingError && (
                <p className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">{billingError}</p>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto min-w-[220px]">
              {plan === 'freemium' && (
                <>
                  <button
                    type="button"
                    onClick={() => startCheckout('partial')}
                    disabled={billingAction !== null}
                    className="w-full rounded-md bg-brand-yellow px-4 py-2 text-sm font-semibold text-brand-dark shadow hover:bg-brand-yellow-dark disabled:opacity-50"
                  >
                    {billingAction === 'partial' ? 'Redirection...' : 'Passer au Pass Partiel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => startCheckout('pro')}
                    disabled={billingAction !== null}
                    className="w-full rounded-md border border-brand-teal px-4 py-2 text-sm font-semibold text-brand-teal hover:bg-brand-teal/10 disabled:opacity-50"
                  >
                    {billingAction === 'pro' ? 'Redirection...' : 'Passer au Passe Sérénité'}
                  </button>
                </>
              )}
              {plan === 'partial' && (
                <>
                  <button
                    type="button"
                    onClick={() => startCheckout('pro')}
                    disabled={billingAction !== null}
                    className="w-full rounded-md bg-brand-yellow px-4 py-2 text-sm font-semibold text-brand-dark shadow hover:bg-brand-yellow-dark disabled:opacity-50"
                  >
                    {billingAction === 'pro' ? 'Redirection...' : 'Passer au plan Pro'}
                  </button>
                  <button
                    type="button"
                    onClick={openBillingPortal}
                    disabled={billingAction !== null}
                    className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    {billingAction === 'portal' ? 'Ouverture...' : 'Gérer / résilier mon abonnement'}
                  </button>
                </>
              )}
              {plan === 'pro' && (
                <button
                  type="button"
                  onClick={openBillingPortal}
                  disabled={billingAction !== null}
                  className="w-full rounded-md bg-brand-teal px-4 py-2 text-sm font-semibold text-white hover:bg-brand-teal-dark disabled:opacity-50"
                >
                  {billingAction === 'portal' ? 'Ouverture...' : 'Gérer / résilier mon abonnement'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Info FSRS */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">ℹ️ À propos des rappels</h3>
          <p className="text-sm text-blue-800">
            Les notifications utilisent l&apos;algorithme FSRS (Free Spaced Repetition Scheduler) pour optimiser 
            vos révisions. Vous serez notifié au moment idéal pour maximiser votre mémorisation à long terme.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageContent />
    </Suspense>
  );
}
