'use client';

/**
 * Boîtes de dialogue impératives pour remplacer window.confirm / window.alert :
 *   if (!(await confirmDialog({ title: 'Supprimer ?', message: '…', danger: true }))) return;
 *   await infoDialog({ title: 'Installer l’application', message: '…' });
 * Montées à la demande dans document.body : aucun provider à ajouter.
 */
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

type DialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style destructif (bouton rouge) */
  danger?: boolean;
};

type DialogProps = DialogOptions & {
  showCancel: boolean;
  onClose: (result: boolean) => void;
};

function Dialog({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger, showCancel, onClose }: DialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose(false);
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="dialog-title" className="font-heading text-lg font-bold text-brand-dark">
          {title}
        </h2>
        <p id="dialog-message" className="mt-2 whitespace-pre-line text-sm text-brand-dark-light">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          {showCancel && (
            <button
              type="button"
              onClick={() => onClose(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-brand-dark hover:bg-gray-50"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onClose(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
              danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-brand-yellow text-brand-dark hover:bg-brand-yellow-dark'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function open(options: DialogOptions, showCancel: boolean): Promise<boolean> {
  if (typeof document === 'undefined') return Promise.resolve(false);

  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let closed = false;

    const onClose = (result: boolean) => {
      if (closed) return;
      closed = true;
      root.unmount();
      host.remove();
      resolve(result);
    };

    root.render(<Dialog {...options} showCancel={showCancel} onClose={onClose} />);
  });
}

export function confirmDialog(options: DialogOptions): Promise<boolean> {
  return open(options, true);
}

export async function infoDialog(options: Omit<DialogOptions, 'cancelLabel' | 'danger'>): Promise<void> {
  await open({ confirmLabel: 'OK', ...options }, false);
}
