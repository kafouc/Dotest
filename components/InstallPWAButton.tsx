"use client";

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>; 
};

export default function InstallPWAButton({ className = '' }: { className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Si déjà installé, masquer
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setCanInstall(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

  if (!canInstall) {
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
