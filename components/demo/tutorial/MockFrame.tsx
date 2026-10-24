import type { ReactNode } from 'react';

/** Fenêtre d'application simulée : barre de titre + contenu. Purement décoratif, les écrans à l'intérieur sont interactifs. */
export default function MockFrame({ title, children, tone = 'light' }: { title: string; children: ReactNode; tone?: 'light' | 'phone' }) {
  if (tone === 'phone') {
    return (
      <div className="mx-auto w-[280px] rounded-[2.2rem] border-[10px] border-brand-dark bg-white shadow-2xl sm:w-[300px]" role="group" aria-label={title}>
        <div className="mx-auto mt-1 h-1.5 w-16 rounded-full bg-gray-300" aria-hidden="true" />
        <div className="min-h-[430px] p-3">{children}</div>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl" role="group" aria-label={title}>
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
        <span className="ml-3 truncate rounded-md bg-white px-3 py-0.5 text-[11px] text-gray-500">sheetofpaper.app/app</span>
      </div>
      <div className="min-h-[360px] p-4 sm:p-5">{children}</div>
    </div>
  );
}
