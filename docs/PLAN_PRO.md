# Améliorations réservées aux forfaits payants (à faire plus tard)

Contexte : le projet tourne sur **Supabase Free** et **Vercel Hobby (gratuit)**. Ce fichier liste ce qui n'est pas possible
ou pas prudent avec ces forfaits, et ce qui change quand on passe à un forfait payant. Dernière mise à jour : 24/10/2026.

## Supabase Pro (≈ 25 $/mois par organisation)
| Amélioration | Pourquoi | Mise en œuvre |
|---|---|---|
| **Sauvegardes quotidiennes** (7 jours) | Le forfait Free n'en a aucune : une suppression ou une corruption est irrécupérable. | Automatique au passage en Pro. Ensuite, retirer ou garder `db-backup.yml` comme sauvegarde externe. |
| **Restauration à un instant donné (PITR)** | Revenir à la minute précédant une erreur. Module payant en plus (à partir de ≈ 100 $/mois). | Activer dans *Database > Backups*. |
| **Protection contre les mots de passe compromis** | Avertissement du linter de sécurité (`auth_leaked_password_protection`). Indisponible en Free. | *Authentication > Sign In / Providers > Email > Prevent use of leaked passwords*. En attendant : contrôle Pwned Passwords côté inscription (voir ci-dessous). |
| **Pas de mise en pause automatique** | Un projet Free inactif 7 jours est mis en pause (c'est déjà arrivé à `bouuum`). | Inclus. En Free : visite régulière, ou tâche de maintien d'activité. |
| **Environnement de préproduction** (branches Supabase) | Tester migrations et fonctions sans toucher la production. | `create_branch` (facturé à l'heure). En Free : second projet gratuit dédié aux tests. |
| **Plus de ressources** | Free : 500 Mo de base, 1 Go de stockage, 2 CPU partagés. Les embeddings (1024 dimensions) grossissent vite. | Pro : 8 Go de base, 100 Go de stockage, taille de calcul au choix. Surveiller `pg_database_size`. |
| **Journaux conservés plus longtemps** | Free : 1 jour. Difficile d'enquêter après coup. | Pro : 7 jours. Complément gratuit : journal applicatif JSON (déjà en place) + drain Vercel. |
| **SMTP personnalisé / limites d'e-mails** | Le SMTP intégré est limité en volume. | Configurer un fournisseur (Resend, Brevo…) dans *Authentication > SMTP*. Possible aussi en Free. |
| **Support et SLA** | Pas de support garanti en Free. | Pro : support par e-mail. |

## Vercel Pro (≈ 20 $/mois par membre)
| Amélioration | Pourquoi |
|---|---|
| **Cron plus fréquents** | Hobby : une exécution par jour au plus. C'est pourquoi les tâches planifiées sont dans la base (`pg_cron`). |
| **Durée maximale des fonctions** | `vercel.json` demande 300 s pour `/api/pdf/extract` ; Hobby plafonne plus bas (60 s à 300 s selon la configuration Fluid). Les gros documents peuvent expirer. À vérifier dans les journaux. |
| **Alertes et observabilité** | Notifications d'erreurs, journaux plus longs, drains. |
| **Usage commercial** | Les conditions du forfait Hobby limitent l'usage à du non commercial : **à revoir dès que l'abonnement Stripe est vendu**. |
| **Protection du déploiement (mots de passe, SSO)** sur les prévisualisations | Utile pour la préproduction. |

## À faire dès maintenant, sans payer (palliatifs)
- Sauvegarde hebdomadaire chiffrée : `.github/workflows/db-backup.yml` + stockage S3 gratuit (voir `docs/OPERATIONS.md`).
- Contrôle des mots de passe compromis à l'inscription (API Pwned Passwords en k-anonymat) dans `components/AuthForm.tsx`.
- Alertes par webhook Slack/Discord stockées dans le Vault (migration `ops_monitoring`).
- Surveiller la taille de la base : `select pg_size_pretty(pg_database_size(current_database()));` (limite Free : 500 Mo).
- Garder les routes lourdes sous les durées Hobby : traitement par lots, reprise des documents bloqués.

## Décisions à prendre au passage en payant
1. Passer Supabase en Pro **avant** d'ouvrir à beaucoup d'utilisateurs : sans sauvegarde, une erreur coûte toutes les données.
2. Passer Vercel en Pro **dès les premiers paiements Stripe** (conditions d'utilisation).
3. Remplacer la préproduction de fortune par une branche Supabase et un environnement Vercel « Preview » dédié.
