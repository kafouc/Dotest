"use client";

import { useState, useEffect } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { FaBell, FaBellSlash, FaArrowLeft, FaCheck, FaTimes } from 'react-icons/fa';
import {
  ensureNotificationPermission,
  registerServiceWorker,
  subscribePush,
  sendSubscriptionToServer,
} from '@/lib/pushManager';

export default function SettingsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [session, setSession] = useState<Session | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied'>('default');

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/app')}
            className="flex items-center gap-2 text-brand-dark hover:text-brand-teal mb-4 transition-colors"
          >
            <FaArrowLeft className="w-4 h-4" />
            <span>Retour</span>
          </button>
          
          <h1 className="text-3xl font-heading font-bold text-brand-dark">Paramètres</h1>
          <p className="text-gray-600 mt-2">Gérez vos préférences et notifications</p>
        </div>

        {/* Notifications Section */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-brand-teal/10 rounded-lg">
              {notificationsEnabled ? (
                <FaBell className="w-6 h-6 text-brand-teal" />
              ) : (
                <FaBellSlash className="w-6 h-6 text-gray-400" />
              )}
            </div>
            
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-brand-dark mb-2">Notifications push</h2>
              <p className="text-gray-600 mb-4">
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
              <div className="flex gap-3">
                {!notificationsEnabled ? (
                  <button
                    onClick={handleEnableNotifications}
                    disabled={isProcessing || notificationStatus === 'denied'}
                    className="px-4 py-2 bg-brand-teal hover:bg-brand-teal-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <FaBell className="w-4 h-4" />
                    {isProcessing ? 'Activation...' : 'Activer les notifications'}
                  </button>
                ) : (
                  <button
                    onClick={handleDisableNotifications}
                    disabled={isProcessing}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
