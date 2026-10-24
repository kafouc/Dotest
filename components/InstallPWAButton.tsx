"use client";

import { useEffect, useState } from 'react';
import { infoDialog } from '@/components/ui/confirm';

type BeforeInstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; 
};

export default function InstallPWAButton({ className = '' }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Détecter si déjà installé (standalone)
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);
    // rien à faire pour canInstall (supprimé)

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      // rien à faire après acceptation (canInstall supprimé)
      setDeferredPrompt(null);
      return;
    }
    // Fallback d'instruction quand beforeinstallprompt n'est pas disponible
    await infoDialog({
      title: 'Installer l’application',
      message:
        '• Android/Chrome : Menu ⋮ > Ajouter à l’écran d’accueil\n• iOS/Safari : Bouton Partager > Ajouter à l’écran d’accueil',
    });
  };

  // Afficher le bouton même si canInstall est false (fallback d'instruction),
  // sauf si déjà en mode standalone (app installée).
  if (isStandalone) {
    return null;
  }

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-md shadow-sm transition-colors min-h-[40px] ${className}`}
      aria-label="Installer l'application PWA"
    >
      Installer l&apos;application
    </button>
  );
}
