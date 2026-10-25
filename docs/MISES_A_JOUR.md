# Journal des mises à jour (22 – 24 octobre 2026)

Tout est en production (branche `main`, PR #2 puis #10) sauf mention contraire. Classé par thème ; le détail technique est dans l'historique git.

## Sécurité
- Durcissement des routes API, de Stripe, des policies et fonctions SQL ; en-têtes de sécurité ; CSP en mode « rapport seul » (`/api/csp-report`) ; middleware qui vérifie l'utilisateur avec `getUser`.
- Quiz en direct : la correction est calculée côté base, les élèves ne reçoivent plus les bonnes réponses ; limitation de débit sur `join_session`.
- Service worker sans cache de données privées ; validation `zod` de toutes les entrées d'API ; erreurs d'API génériques (pas de fuite de détails) ; logger structuré.
- Plan par défaut à l'inscription sans e-mail codé en dur (les administrateurs s'ajoutent maintenant à la main, voir `docs/PILOTAGE.md`).
- **Toujours ouvert** : le fichier `.env` avec de vraies clés est dans l'historique public du dépôt. À faire : changer les clés (Stripe live, Supabase service role, Groq, Jina), retirer `.env` du dépôt, purger l'historique.

## Limites et quotas
- Limitation de débit persistante par utilisateur et par IP (table `api_rate_limits`), plafonds par minute et par jour selon le forfait sur toutes les routes IA (`RATE_LIMITS` dans `lib/constants.ts`).
- Quotas hebdomadaires et mensuels de quiz et de fiches par forfait (`PLAN_LIMITS`).

## IA
- Modèles Groq remplacés (les anciens étaient arrêtés) : `gpt-oss-120b` pour quiz et fiches, `gpt-oss-20b` pour les thèmes, modifiables par variable Vercel (`GROQ_MODEL_*`). Contrôle hebdomadaire des modèles par la CI.
- Schéma JSON strict, nouvel essai si le JSON est invalide, gestion des limites Groq (429), alerte d'exploitation si un modèle disparaît.
- Recherche hybride (vectorielle + texte) avec reclassement ; citations de sources vérifiées (page réelle, jamais inventée) ; outil d'évaluation `scripts/eval-quiz.ts`.
- Langue du cours détectée automatiquement : quiz, fiches et thèmes sont écrits dans la langue du document.
- Découpage du texte aux fins de paragraphe ou de phrase.

## Produit
- **Révision du jour** (`/review`) : file unifiée (cartes + questions de quiz ratées), objectif quotidien, série de jours.
- **Premier lancement** : parcours guidé en 4 étapes et document d'exemple.
- **Espace enseignant** (`/classes`) : classes, historique des séances, progression par pseudo, comparaison de deux séances, export Excel.
- **Essai sans compte** (`/essai`) : un vrai mini-quiz de 3 questions avec sources.
- **Tutoriel interactif** (`/demo`, refait le 24/10) : 9 étapes avant l'inscription.
- **Installation sur téléphone** : section sur la page d'accueil, lien dans le menu, question dans la FAQ.
- **Rappels en un clic** : carte dans l'application, case facultative « Rappels de révision » dans le bandeau de consentement (indépendante de l'audience).

## Notifications push
- Bienvenue, rappel du matin, révision espacée à midi, rappel du soir ; planification par `pg_cron` toutes les 15 minutes, fuseau horaire de l'utilisateur, journal anti-doublon (`docs/NOTIFICATIONS.md`).
- **À faire de votre côté pour qu'elles partent** : secrets Vault `notify_cron_url` et `notify_cron_secret`, variable Vercel `NOTIFY_CRON_SECRET`, redéploiement.

## RGPD
- Politique de confidentialité, bandeau de consentement (audience refusable aussi simplement qu'acceptable), export des données, suppression de compte, conservation limitée (migration `data_retention`).
- **À compléter** : l'identité de l'éditeur (placeholders) dans `/confidentialite`.

## Facturation Stripe
- `unpaid` n'a plus accès ; paiements asynchrones (SEPA) ; factures payées/échouées ; relecture de l'abonnement chez Stripe (événements dans le désordre) ; période de grâce sur `past_due` ; TVA automatique et CGV derrière des variables ; chaque événement traité une seule fois.
- **À faire** : activer les événements dans Stripe (`npm run stripe:webhook-events -- --apply`, clé valide requise) ; `STRIPE_PRICE_PRO` manque sur Vercel (`docs/FACTURATION.md`).

## Qualité et exploitation
- Next.js 15.5 / React 19 ; `/app` et le tableau de bord live découpés en hooks et composants ; pages d'erreur ; dialogues accessibles.
- Tests : 224 tests unitaires, tests de bout en bout Playwright (ordinateur + mobile), CI GitHub (vérifications, e2e, sauvegarde de la base, contrôle des modèles), Dependabot.
- Exploitation : relance automatique des documents en échec, sauvegarde chiffrée de la base, alertes (`docs/OPERATIONS.md`).
- Dépôt nettoyé, documentation dans `docs/`, améliorations réservées aux forfaits payants dans `docs/PLAN_PRO.md`.

## Reste à faire (récapitulatif)
1. Changer les clés exposées et purger `.env` de l'historique.
2. Secrets des notifications (Vault + Vercel).
3. Événements Stripe et `STRIPE_PRICE_PRO`.
4. Identité de l'éditeur dans `/confidentialite`.
5. Secret GitHub `GROQ_API_KEY`.
6. Décider de la limite de pages (100 affichées, 500 dans le code : voir `docs/PILOTAGE.md`).
7. Tests manuels en production : connexion, paiement, suppression de compte, notifications sur téléphone.
