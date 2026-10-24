'use client';

import { useCallback, useEffect, useState } from 'react';
import { ensureNotificationPermission, registerServiceWorker, sendSubscriptionToServer, subscribePush } from '@/lib/pushManager';
import { isIosDevice } from '@/lib/pushPrompt';
import { logger } from '@/lib/logger';

export type PushPermission = NotificationPermission | 'unsupported';

export type EnableResult = { ok: true; welcomed: boolean } | { ok: false; reason: 'denied' | 'unsupported' | 'not-ready' | 'error'; message: string };

/**
 * État et actions des notifications push de l'appareil courant. Partagé par la carte « Activer les rappels » de l'application
 * et par les Paramètres : une seule logique d'activation et de désactivation.
 * `enable()` doit être appelée directement depuis un clic (le navigateur l'exige pour demander l'autorisation).
 */
export function usePushNotifications() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<PushPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const hasNotification = typeof window !== 'undefined' && 'Notification' in window;
    const hasPush = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window;
    setSupported(hasNotification && hasPush);
    setPermission(hasNotification ? Notification.permission : 'unsupported');
    setIos(isIosDevice(navigator.userAgent, navigator.maxTouchPoints));
    setStandalone(
      window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as Navigator & { standalone?: boolean }).standalone === true
    );
    if (hasNotification && hasPush) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        setSubscribed(Boolean(subscription));
      } catch {
        setSubscribed(false);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async (): Promise<EnableResult> => {
    setBusy(true);
    try {
      const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapid) return { ok: false, reason: 'unsupported', message: "Les notifications ne sont pas configurées sur ce site." };

      // L'autorisation est demandée en premier, pendant le geste de l'utilisateur
      const permitted = await ensureNotificationPermission();
      setPermission(permitted);
      if (permitted !== 'granted') {
        return {
          ok: false,
          reason: 'denied',
          message: permitted === 'denied' ? 'Notifications refusées. Vous pourrez les autoriser dans les réglages de votre navigateur.' : 'Autorisation non accordée.',
        };
      }

      const registration = await registerServiceWorker('/sw.js');
      if (!registration) return { ok: false, reason: 'unsupported', message: "Ce navigateur ne permet pas d'activer les rappels." };

      // Laisse au service worker le temps de devenir actif (premier chargement)
      await new Promise((resolve) => setTimeout(resolve, 500));

      const subscription = await subscribePush(registration, vapid);
      const { welcomed } = await sendSubscriptionToServer(subscription);
      setSubscribed(true);
      return { ok: true, welcomed };
    } catch (error) {
      logger.error('Activation des notifications échouée', error instanceof Error ? error : { error: String(error) });
      const message = error instanceof Error ? error.message : "L'activation a échoué.";
      return {
        ok: false,
        reason: message.includes('Service Worker non actif') ? 'not-ready' : 'error',
        message: message.includes('Service Worker non actif') ? 'Le service finit de démarrer : réessayez dans quelques secondes.' : message,
      };
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async (): Promise<boolean> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        // Retire l'appareil de la base AVANT de se désabonner, sinon le serveur continuerait d'y écrire
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => undefined);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      return true;
    } catch (error) {
      logger.error('Désactivation des notifications échouée', error instanceof Error ? error : { error: String(error) });
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { ready, supported, permission, subscribed, busy, ios, standalone, enable, disable, refresh };
}
