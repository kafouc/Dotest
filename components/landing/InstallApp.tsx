'use client';

import { useEffect, useState } from 'react';
import { isIosDevice } from '@/lib/pushPrompt';

type Platform = 'ios' | 'android' | 'desktop';

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/* ------------------------------ Pictogrammes ------------------------------ */
const iconProps = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

const ShareIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M5 11v8a2 2 0 002 2h10a2 2 0 002-2v-8" />
  </svg>
);
const PlusSquareIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);
const DotsIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="5" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="19" r="1.2" fill="currentColor" />
  </svg>
);
const DownloadIcon = () => (
  <svg {...iconProps}>
    <path d="M12 4v11M8 11l4 4 4-4" />
    <path d="M5 20h14" />
  </svg>
);
const SafariIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </svg>
);
const CheckIcon = () => (
  <svg {...iconProps}>
    <path d="M5 12l4 4 10-10" />
  </svg>
);

type Step = { icon: React.ReactNode; title: string; detail: string };

const STEPS: Record<Platform, { label: string; browser: string; steps: Step[]; note?: string }> = {
  ios: {
    label: 'iPhone / iPad',
    browser: 'Safari',
    steps: [
      { icon: <SafariIcon />, title: 'Ouvrez le site dans Safari', detail: 'Rendez-vous sur sheetofpaper.app avec Safari (l’installation ne fonctionne pas depuis Chrome sur iPhone).' },
      { icon: <ShareIcon />, title: 'Appuyez sur « Partager »', detail: 'Le carré avec une flèche vers le haut, en bas de l’écran (en haut sur iPad).' },
      { icon: <PlusSquareIcon />, title: 'Choisissez « Sur l’écran d’accueil »', detail: 'Faites défiler la liste vers le bas si besoin, puis appuyez sur « Sur l’écran d’accueil ».' },
      { icon: <CheckIcon />, title: 'Appuyez sur « Ajouter »', detail: 'L’icône apparaît sur votre écran d’accueil. Ouvrez toujours l’application depuis cette icône.' },
    ],
    note: 'Les rappels de révision n’arrivent sur iPhone qu’avec l’application installée et ouverte depuis son icône (iOS 16.4 ou plus).',
  },
  android: {
    label: 'Android',
    browser: 'Chrome',
    steps: [
      { icon: <SafariIcon />, title: 'Ouvrez le site dans Chrome', detail: 'Rendez-vous sur sheetofpaper.app avec Chrome (ou Edge, Samsung Internet).' },
      { icon: <DotsIcon />, title: 'Ouvrez le menu', detail: 'Les trois points en haut à droite du navigateur.' },
      { icon: <DownloadIcon />, title: 'Appuyez sur « Installer l’application »', detail: 'Sur certains téléphones : « Ajouter à l’écran d’accueil ».' },
      { icon: <CheckIcon />, title: 'Confirmez avec « Installer »', detail: 'L’icône Sheet of Paper est ajoutée à vos applications.' },
    ],
  },
  desktop: {
    label: 'Ordinateur',
    browser: 'Chrome ou Edge',
    steps: [
      { icon: <SafariIcon />, title: 'Ouvrez le site dans Chrome ou Edge', detail: 'Rendez-vous sur sheetofpaper.app.' },
      { icon: <DownloadIcon />, title: 'Cliquez sur l’icône d’installation', detail: 'Dans la barre d’adresse, à droite : un écran avec une flèche vers le bas. Sinon : menu ⋮ puis « Installer Sheet of Paper ».' },
      { icon: <CheckIcon />, title: 'Cliquez sur « Installer »', detail: 'L’application s’ouvre dans sa propre fenêtre, avec un raccourci sur votre ordinateur.' },
    ],
  },
};

const BENEFITS = [
  { icon: '⚡', text: 'Ouverture en un geste depuis l’écran d’accueil' },
  { icon: '📱', text: 'Plein écran, sans barre d’adresse : comme une vraie application' },
  { icon: '🔔', text: 'Rappels de révision : matin, midi et soir' },
  { icon: '🪶', text: 'Aucun téléchargement lourd, aucun store : une seconde suffit' },
];

export default function InstallApp() {
  const [platform, setPlatform] = useState<Platform>('android');
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (isIosDevice(ua, navigator.maxTouchPoints)) setPlatform('ios');
    else if (/Android/i.test(ua)) setPlatform('android');
    else setPlatform('desktop');

    setInstalled(window.matchMedia?.('(display-mode: standalone)').matches === true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const installNow = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallEvent(null);
  };

  const current = STEPS[platform];

  return (
    <section id="installer" aria-labelledby="install-title" className="relative py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-brand-teal-dark">Application mobile</p>
          <h2 id="install-title" className="mb-4 font-heading text-3xl font-bold text-brand-dark md:text-4xl lg:text-5xl">
            Installez Sheet of Paper sur votre téléphone
          </h2>
          <p className="text-base text-brand-dark-lighter md:text-xl">Gratuit, en 4 gestes, sans passer par un store.</p>
        </div>

        <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.4fr]">
          <ul className="grid gap-3 self-start sm:grid-cols-2 lg:grid-cols-1">
            {BENEFITS.map((benefit) => (
              <li key={benefit.text} className="flex items-start gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur">
                <span aria-hidden="true" className="text-2xl">{benefit.icon}</span>
                <span className="text-sm font-medium text-brand-dark md:text-base">{benefit.text}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-lg backdrop-blur md:p-7">
            {installed ? (
              <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-800">
                <CheckIcon /> Vous utilisez déjà l’application installée.
              </p>
            ) : (
              installEvent && (
                <button
                  type="button"
                  onClick={installNow}
                  className="mb-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand-yellow px-6 py-3 text-base font-semibold text-brand-dark shadow hover:bg-brand-yellow-dark"
                >
                  <DownloadIcon /> Installer en un clic
                </button>
              )
            )}

            <div role="tablist" aria-label="Votre appareil" className="mb-5 grid grid-cols-3 gap-1 rounded-full bg-gray-100 p-1">
              {(Object.keys(STEPS) as Platform[]).map((id) => (
                <button
                  key={id}
                  role="tab"
                  type="button"
                  id={`install-tab-${id}`}
                  aria-selected={platform === id}
                  aria-controls="install-panel"
                  onClick={() => setPlatform(id)}
                  className={`rounded-full px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${platform === id ? 'bg-white text-brand-dark shadow' : 'text-gray-600 hover:text-brand-dark'}`}
                >
                  {STEPS[id].label}
                </button>
              ))}
            </div>

            <div role="tabpanel" id="install-panel" aria-labelledby={`install-tab-${platform}`}>
              <p className="mb-4 text-sm text-gray-600">
                Navigateur conseillé : <strong>{current.browser}</strong>
              </p>
              <ol className="space-y-4">
                {current.steps.map((step, index) => (
                  <li key={step.title} className="flex items-start gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-yellow-light text-brand-dark">
                      {step.icon}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-dark">
                        <span className="mr-2 text-brand-teal-dark">{index + 1}.</span>
                        {step.title}
                      </p>
                      <p className="mt-0.5 text-sm text-gray-600">{step.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {current.note && (
                <p className="mt-5 rounded-xl bg-brand-yellow-light p-3 text-sm text-brand-dark">
                  <strong>À savoir :</strong> {current.note}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
