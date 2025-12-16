import Link from 'next/link';

type AccessRestrictedProps = {
  userEmail?: string | null;
  redirectHref?: string;
};

function buildSqlSnippet(email?: string | null): string {
  const safeEmail = email ?? 'votre-email@domaine.com';
  return `SELECT id, email FROM auth.users WHERE email = '${safeEmail}';`;
}

export default function AccessRestricted({ userEmail, redirectHref = '/app' }: AccessRestrictedProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="max-w-lg space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-heading font-semibold text-brand-dark">Accès restreint</h1>
          <p className="text-sm text-gray-600">
            Votre compte n&apos;est pas encore autorisé à consulter cette section administrateur.
          </p>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            Ajoutez votre identifiant utilisateur Supabase dans la table <code>admin_users</code> pour obtenir l&apos;accès.
          </p>
          <ol className="list-decimal space-y-2 pl-5 text-left">
            <li>
              Récupérez votre <span className="font-mono">user_id</span> via la console Supabase&nbsp;:
              <span className="block font-mono text-xs text-gray-500">{buildSqlSnippet(userEmail)}</span>
            </li>
            <li>
              Insérez le <span className="font-mono">user_id</span> dans <span className="font-mono">public.admin_users</span>&nbsp;:
              <span className="block font-mono text-xs text-gray-500">{`INSERT INTO public.admin_users (user_id, role) VALUES ('votre-id', 'owner');`}</span>
            </li>
          </ol>
          <p>Une fois ajouté, rechargez cette page pour accéder au tableau de bord.</p>
        </div>
        <div className="text-center text-xs text-gray-500">
          <Link href={redirectHref} className="underline hover:text-brand-teal">
            Retour à l&apos;application
          </Link>
        </div>
      </div>
    </div>
  );
}
