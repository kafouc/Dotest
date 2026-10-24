import type { ReactNode } from 'react';

type ErrorStateProps = {
  title: string;
  description: string;
  /** Référence technique à communiquer au support (digest d'erreur Next, requestId…) */
  reference?: string;
  children?: ReactNode;
};

export default function ErrorState({ title, description, reference, children }: ErrorStateProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-md text-center" role="alert">
        <h1 className="font-heading text-2xl font-bold text-brand-dark">{title}</h1>
        <p className="mt-3 text-brand-dark-light">{description}</p>
        {reference && (
          <p className="mt-2 text-xs text-brand-dark-lighter">
            Référence : <code>{reference}</code>
          </p>
        )}
        {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
      </div>
    </main>
  );
}
