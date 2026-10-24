'use client';

import type { OnboardingStep } from '@/lib/onboarding';

type Props = {
  steps: OnboardingStep[];
  hasDocuments: boolean;
  creatingSample: boolean;
  onUpload: () => void;
  onCreateSample: () => void;
  onOpenFirstDocument: () => void;
  onOpenReview: () => void;
  onDismiss: () => void;
};

export default function OnboardingChecklist({
  steps,
  hasDocuments,
  creatingSample,
  onUpload,
  onCreateSample,
  onOpenFirstDocument,
  onOpenReview,
  onDismiss,
}: Props) {
  const completed = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  return (
    <section
      aria-labelledby="onboarding-title"
      className="mx-4 mt-4 rounded-xl border border-brand-yellow bg-brand-yellow-light p-4 sm:mx-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="onboarding-title" className="font-heading text-base font-bold text-brand-dark">
            Démarrage : {completed}/{steps.length} étapes
          </h2>
          <p className="text-sm text-brand-dark-light">Votre premier quiz en moins de deux minutes.</p>
        </div>
        <button type="button" onClick={onDismiss} className="text-xs font-medium text-brand-dark-light underline-offset-2 hover:underline">
          Masquer
        </button>
      </div>

      <ol className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                step.done ? 'bg-green-600 text-white' : next?.id === step.id ? 'bg-brand-yellow text-brand-dark' : 'bg-white text-gray-400'
              }`}
            >
              {step.done ? '✓' : steps.indexOf(step) + 1}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${step.done ? 'text-gray-500 line-through' : 'text-brand-dark'}`}>
                {step.title}
                {step.done && <span className="sr-only"> (terminé)</span>}
              </p>
              {next?.id === step.id && (
                <>
                  <p className="text-xs text-brand-dark-light">{step.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {step.id === 'document' && (
                      <>
                        <button type="button" onClick={onUpload} className="rounded-full bg-brand-yellow px-4 py-1.5 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark">
                          Importer mon cours
                        </button>
                        <button
                          type="button"
                          onClick={onCreateSample}
                          disabled={creatingSample}
                          className="rounded-full border border-brand-dark-lighter bg-white px-4 py-1.5 text-sm font-medium text-brand-dark hover:bg-gray-50 disabled:opacity-60"
                        >
                          {creatingSample ? 'Préparation…' : 'Essayer avec un exemple'}
                        </button>
                      </>
                    )}
                    {(step.id === 'quiz' || step.id === 'answer') && hasDocuments && (
                      <button type="button" onClick={onOpenFirstDocument} className="rounded-full bg-brand-yellow px-4 py-1.5 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark">
                        Ouvrir mon document
                      </button>
                    )}
                    {step.id === 'review' && (
                      <button type="button" onClick={onOpenReview} className="rounded-full bg-brand-yellow px-4 py-1.5 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark">
                        Aller aux révisions
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
