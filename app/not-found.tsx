import Link from 'next/link';
import ErrorState from '@/components/ui/ErrorState';

export default function NotFound() {
  return (
    <ErrorState
      title="Page introuvable"
      description="Cette page n'existe pas ou a été déplacée."
    >
      <Link
        href="/"
        className="rounded-lg bg-brand-yellow px-5 py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-yellow-dark"
      >
        Retour à l&apos;accueil
      </Link>
    </ErrorState>
  );
}
