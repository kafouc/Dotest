import Link from 'next/link';

export const metadata = { title: 'Compte supprimé - Sheet of Paper', robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-2xl font-bold text-brand-dark">Votre compte a été supprimé</h1>
        <p className="mt-3 text-gray-700">
          Vos documents, fichiers, cartes de révision, résultats et classes ont été effacés, et votre abonnement a été résilié. Seules les factures sont conservées, comme la loi l&apos;impose.
        </p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-brand-yellow px-6 py-3 font-semibold text-brand-dark hover:bg-brand-yellow-dark">
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
