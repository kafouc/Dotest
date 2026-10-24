# Exploitation : sauvegardes, alertes, reprise

## Sauvegardes
**Constat (24/10/2026)** : l'organisation Supabase est sur le forfait **Free**, qui n'inclut ni sauvegarde automatique
ni restauration à un instant donné. Sans action, une suppression accidentelle ou une pause du projet est irrécupérable.

Deux options, non exclusives :
1. **Forfait Pro** : sauvegardes quotidiennes conservées 7 jours (la restauration à un instant donné est un module payant en plus).
2. **Dump chiffré planifié** (gratuit) : `.github/workflows/db-backup.yml`, chaque dimanche, vers un stockage S3 compatible
   (Cloudflare R2 offre 10 Go gratuits). Configuration des secrets en tête du fichier. Test manuel : onglet *Actions*,
   *Sauvegarde base de données*, *Run workflow*.

Test local : `SUPABASE_DB_URL=… BACKUP_PASSPHRASE=… ./scripts/backup-db.sh ./out`

**Restauration** :
```bash
gpg --batch --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -d backup-XXXX.sql.gz.gpg | gunzip > restore.sql
psql "$NOUVELLE_DB_URL" -f restore.sql   # sur un projet vierge ; vérifier d'abord sur un projet de test
```
**Non couvert** : les fichiers du Storage (bucket `pdfs`). Les documents originaux peuvent être réimportés par les utilisateurs ;
pour les sauvegarder : `supabase storage cp -r ss:///pdfs ./pdfs-backup` (CLI Supabase connecté).
Faites un essai de restauration au moins une fois : une sauvegarde jamais restaurée n'est pas une sauvegarde.

## Alertes (migration `20261024140000_ops_monitoring.sql`)
- Tâches `pg_cron` : reprise des documents bloqués (10 min), contrôle de santé (15 min), agrégation quotidienne des métriques (00:10 UTC).
- Les alertes sont écrites dans `ops_alerts` (lisible par les administrateurs). Pour les recevoir sur Slack ou Discord :
  ```sql
  select vault.create_secret('https://hooks.slack.com/services/…', 'ops_alert_webhook');
  -- changer l'URL plus tard : select vault.update_secret(id, 'nouvelle-url') from vault.secrets where name = 'ops_alert_webhook';
  ```
  L'URL reste dans le Vault de la base, jamais dans le dépôt.
- Alertes à activer côté services (aucun code) : Vercel (*Settings > Notifications* : échecs de déploiement, taux d'erreurs),
  Stripe (*Developers > Webhooks* : e-mail en cas d'échec de livraison), Supabase (*Reports*).

## Documents bloqués
- Un document dont l'état n'a pas changé depuis 45 min passe en `failed` (« Analyse interrompue »).
- L'interface propose **Relancer l'analyse** : le serveur supprime les segments déjà indexés puis recommence.
