import type { Metadata } from 'next';
import Link from 'next/link';
import ConsentPreferencesButton from '@/components/consent/ConsentPreferencesButton';

export const metadata: Metadata = {
  title: 'Politique de confidentialité - Sheet of Paper',
  description: 'Quelles données Sheet of Paper collecte, pourquoi, combien de temps, et comment exercer vos droits.',
  alternates: { canonical: 'https://sheetofpaper.app/confidentialite' },
};

const UPDATED = '24 octobre 2026';

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-gray-800">
      <Link href="/" className="text-sm text-brand-dark-light underline-offset-2 hover:underline">
        ← Retour à l&apos;accueil
      </Link>
      <h1 className="mt-4 font-heading text-3xl font-bold text-brand-dark">Politique de confidentialité</h1>
      <p className="mt-1 text-sm text-gray-500">Dernière mise à jour : {UPDATED}</p>

      <Section title="En bref">
        <ul className="list-disc space-y-1 pl-5">
          <li>Nous collectons le minimum : votre e-mail, vos documents et ce que vous créez avec.</li>
          <li>Les élèves d&apos;une séance en direct n&apos;ont pas de compte : un simple pseudo suffit, sans e-mail.</li>
          <li>Vos documents ne servent jamais à entraîner des modèles d&apos;IA et ne sont pas revendus.</li>
          <li>Vous pouvez exporter ou supprimer toutes vos données en un clic depuis <Link href="/settings" className="underline">Paramètres</Link>.</li>
          <li>La mesure d&apos;audience n&apos;est activée qu&apos;avec votre accord.</li>
        </ul>
      </Section>

      <Section title="1. Qui est responsable de vos données ?">
        <p>
          Le service Sheet of Paper (sheetofpaper.app) est édité par <strong>Mathieu Coulibaly</strong>
          {' '}[statut juridique et adresse postale à compléter avant publication]. Contact pour toute question relative aux données personnelles :{' '}
          <a href="mailto:kafoumathieu.coulibaly@gmail.com" className="underline">kafoumathieu.coulibaly@gmail.com</a>.
        </p>
      </Section>

      <Section title="2. Quelles données, pourquoi, sur quelle base légale ?">
        <Table
          head={['Données', 'Finalité', 'Base légale', 'Conservation']}
          rows={[
            ['E-mail, mot de passe (chiffré), date d’inscription', 'Créer et sécuriser votre compte', 'Exécution du contrat', 'Jusqu’à la suppression du compte'],
            ['Documents importés, texte extrait, fiches, quiz, cartes de révision, résultats', 'Fournir le service', 'Exécution du contrat', 'Jusqu’à suppression par vous ou du compte'],
            ['Forfait, identifiant client Stripe, factures', 'Facturation et obligations comptables', 'Contrat et obligation légale', 'Factures : 10 ans (obligation légale) ; le reste jusqu’à suppression du compte'],
            ['Pseudo et réponses d’une séance en direct', 'Faire jouer la séance, produire les résultats pour l’enseignant', 'Exécution du contrat avec l’enseignant', 'Tant que l’enseignant conserve la séance ; supprimé avec son compte'],
            ['Compteurs d’usage (quiz générés, quotas), journaux techniques', 'Appliquer les limites du forfait, sécurité, prévention des abus', 'Intérêt légitime', 'Jusqu’à 24 mois ; journaux techniques quelques jours'],
            ['Abonnement aux notifications (appareil), préférences de rappel et fuseau horaire', 'Vous envoyer, à l’heure choisie, les rappels de révision que vous avez activés', 'Consentement', 'Jusqu’à désactivation ou suppression du compte'],
            ['Pages vues, appareil, pays (empreinte de l’adresse IP, jamais l’adresse en clair)', 'Mesurer et améliorer le service', 'Consentement', '13 mois maximum'],
          ]}
        />
        <p className="mt-3">
          Nous ne recueillons ni données bancaires (elles restent chez Stripe), ni données sensibles. Merci de ne pas importer de documents contenant des informations
          médicales, judiciaires ou relatives à des tiers sans nécessité.
        </p>
      </Section>

      <Section title="3. Intelligence artificielle : ce qui est envoyé à nos prestataires">
        <p>
          Pour générer un quiz, une fiche ou des thèmes, des <strong>extraits de vos documents</strong> et votre demande sont envoyés à nos prestataires d&apos;IA
          (Groq pour la rédaction, Jina AI pour la recherche dans vos documents). Seuls les extraits utiles à la demande sont transmis, pas la totalité du fichier.
          Nous n&apos;utilisons pas vos documents pour entraîner de modèles ; ces prestataires les traitent selon leurs propres engagements contractuels.
          Les questions générées sont produites par une IA et peuvent comporter des erreurs : chaque question cite l&apos;extrait de votre document qui la justifie pour que vous puissiez la vérifier.
        </p>
      </Section>

      <Section title="4. Nos prestataires (sous-traitants)">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Supabase</strong> : base de données, authentification et stockage des fichiers, hébergés dans l&apos;Union européenne (Irlande).</li>
          <li><strong>Vercel</strong> : hébergement de l&apos;application et, avec votre accord, mesure d&apos;audience.</li>
          <li><strong>Groq</strong> et <strong>Jina AI</strong> : traitements d&apos;IA décrits ci-dessus.</li>
          <li><strong>Stripe</strong> : paiement des abonnements.</li>
        </ul>
        <p className="mt-2">
          Certains de ces prestataires sont établis ou traitent des données hors de l&apos;Union européenne (notamment aux États-Unis). Ces transferts reposent sur les
          mécanismes prévus par le RGPD (clauses contractuelles types ou cadre de protection des données UE-États-Unis).
        </p>
      </Section>

      <Section title="5. Élèves et mineurs">
        <p>
          Une séance en direct ne demande à l&apos;élève qu&apos;un pseudo : ni nom, ni e-mail. Nous recommandons aux élèves de ne pas utiliser leur nom complet.
          L&apos;enseignant qui organise la séance est responsable de son usage avec ses élèves (information des familles, cadre de l&apos;établissement).
          La création d&apos;un compte est réservée aux personnes d&apos;au moins 15 ans, ou avec l&apos;accord d&apos;un parent ou d&apos;un représentant légal.
        </p>
      </Section>

      <Section title="6. Cookies et mesure d’audience">
        <p>
          Nous utilisons uniquement les éléments nécessaires au fonctionnement (session de connexion, préférence de consentement). La mesure d&apos;audience
          (Vercel Analytics et notre suivi des pages) n&apos;est activée que si vous l&apos;acceptez, et vous pouvez changer d&apos;avis à tout moment.
        </p>
        <div className="mt-3"><ConsentPreferencesButton /></div>
      </Section>

      <Section title="7. Vos droits">
        <p>Vous pouvez à tout moment :</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li><strong>accéder à vos données et les récupérer</strong> : Paramètres, « Exporter mes données » (fichier JSON et liens vers vos documents) ;</li>
          <li><strong>supprimer votre compte et toutes vos données</strong> : Paramètres, « Supprimer mon compte » (documents, fichiers, vecteurs, cartes, résultats, abonnements aux notifications) ; l&apos;abonnement payant est résilié ; seules les factures sont conservées, comme la loi l&apos;impose ;</li>
          <li>rectifier, limiter ou vous opposer à un traitement, retirer un consentement : par e-mail à l&apos;adresse ci-dessus ; nous répondons sous un mois.</li>
        </ul>
        <p className="mt-2">
          En cas de désaccord, vous pouvez saisir la CNIL (<a href="https://www.cnil.fr" className="underline" rel="noopener noreferrer">cnil.fr</a>).
        </p>
      </Section>

      <Section title="8. Sécurité">
        <p>
          Connexions chiffrées (HTTPS), mots de passe chiffrés, accès aux données restreint par compte (sécurité au niveau des lignes de la base), clés d&apos;API gardées côté serveur.
          Aucun système n&apos;est infaillible : en cas de violation de données susceptible de vous nuire, nous vous en informerons ainsi que la CNIL dans les délais légaux.
        </p>
      </Section>

      <Section title="9. Modifications">
        <p>Cette politique peut évoluer. La date de dernière mise à jour figure en haut de la page ; les changements importants vous seront signalés dans l&apos;application.</p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-heading text-xl font-bold text-brand-dark">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed sm:text-base">{children}</div>
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 text-left text-xs sm:text-sm">
        <thead className="bg-gray-50">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="border-b border-gray-200 px-3 py-2 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]} className="align-top">
              {row.map((cell, i) => (
                <td key={i} className="border-b border-gray-100 px-3 py-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
