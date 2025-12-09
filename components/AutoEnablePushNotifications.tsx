"use client";

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import {
  ensureNotificationPermission,
  registerServiceWorker,
  subscribePush,
  sendSubscriptionToServer,
} from '@/lib/pushManager';

/**
 * Composant pour auto-activer les notifications push au premier login
 * Affiche un toast discret et tente l'activation en arrière-plan
 */
export default function AutoEnablePushNotifications() {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    // Ne s'exécute qu'une fois au montage du composant
    let isMounted = true;

    const tryAutoEnable = async () => {
      // Vérifier si l'utilisateur est connecté
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !isMounted) return;

      // Vérifier si le navigateur supporte les notifications
      if (typeof window === 'undefined' || !('Notification' in window)) return;

      // Ne pas redemander si déjà refusé
      if (Notification.permission === 'denied') return;

      // Vérifier si déjà inscrit
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) return; // Déjà activé
        } catch (e) {
          console.log('Vérification subscription échouée', e);
        }
      }

      // Tenter l'activation automatique (sera refusée si l'utilisateur doit autoriser)
      if (!isMounted) return;

      try {
        const permitted = await ensureNotificationPermission();
        if (!permitted || permitted === 'denied') {
          // L'utilisateur a refusé ou le navigateur a bloqué
          return;
        }

        const reg = await registerServiceWorker('/sw.js');
        if (!reg) {
          throw new Error('Service Worker non enregistré');
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapid) {
          throw new Error('VAPID public key manquante');
        }

        const sub = await subscribePush(reg, vapid);
        await sendSubscriptionToServer(sub);

        if (isMounted) {
          setToastMessage('🔔 Notifications activées pour vos révisions !');
          setShowToast(true);
          setTimeout(() => setShowToast(false), 5000);
        }
      } catch (e) {
        // Silencieux en cas d'échec - l'utilisateur pourra activer manuellement dans Settings
        console.log('Auto-activation notifications échouée:', e);
      }
    };

    // Délai de 2 secondes pour ne pas bloquer le chargement initial
    const timer = setTimeout(tryAutoEnable, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [supabase]);

  if (!showToast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
      <div className="bg-brand-teal text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <span className="text-sm font-medium">{toastMessage}</span>
        <button
          onClick={() => setShowToast(false)}
          className="text-white/80 hover:text-white transition-colors"
          aria-label="Fermer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
