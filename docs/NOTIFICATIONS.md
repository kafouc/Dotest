# Notifications push

Quatre notifications, toutes configurables dans **Paramètres > Notifications push** :

| Notification | Quand | Contenu | Condition |
|---|---|---|---|
| **Bienvenue** | Dès l'activation sur un appareil (une seule fois par appareil) | Confirme que les rappels marchent et les présente | — |
| **Matin** | 8 h locale (6 h à 10 h au choix) | Nombre de cartes qui attendent + série en cours | Pas encore révisé aujourd'hui |
| **Révision espacée** | 13 h locale | « N cartes à revoir maintenant » + part tirée des erreurs de quiz | Au moins 3 cartes dues et objectif du jour non atteint |
| **Soir** | 19 h locale (18 h à 22 h au choix) | Série en jeu, ou invitation à réviser | Pas encore révisé aujourd'hui |

Au plus **une notification de chaque type par jour** et par utilisateur (clé unique en base). Un bouton « Envoyer une notification de test » est disponible dans les réglages.
Les heures sont calculées dans le **fuseau horaire du navigateur**, enregistré à l'activation.

## Fonctionnement
```
pg_cron (toutes les 15 min) → trigger_push_notifications() → pg_net → POST /api/cron/notifications (Vercel)
   → notification_candidates(now) : qui doit recevoir quoi, à son heure locale
   → claim_notification() : réserve l'envoi du jour (atomique, évite les doublons)
   → web-push vers chaque appareil ; un appareil qui a supprimé son abonnement (404/410) est retiré de la base
```
Le contenu vient de `lib/notifications.ts` (données réelles : cartes dues, série). Les clés VAPID sont déjà sur Vercel
(`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). Remplace la fonction Supabase `streak-reminder`, qui n'avait jamais été déployée.

## Activation (une seule fois)
1. Appliquer la migration `supabase/migrations/20261028090000_push_notifications.sql` (éditeur SQL de Supabase).
2. Dans le même éditeur, enregistrer l'adresse et le secret (ils restent dans le Vault de la base, pas dans le dépôt) :
```sql
select vault.create_secret('https://sheetofpaper.app/api/cron/notifications', 'notify_cron_url');
select vault.create_secret('<la valeur du secret>', 'notify_cron_secret');
```
   Le secret est `NOTIFY_CRON_SECRET` s'il existe sur Vercel, sinon `METRICS_CRON_SECRET` (déjà présent : la route accepte l'un ou l'autre).
3. Vérifier : `select * from cron.job where jobname = 'push-notifications';` puis, une heure plus tard,
   `select status, return_message from cron.job_run_details order by start_time desc limit 5;` et `select * from net._http_response order by created desc limit 5;`
   (code 200 attendu).

## Dépannage
- **Rien n'arrive** : `select public.trigger_push_notifications();` doit renvoyer un nombre (identifiant de requête). `null` = secrets du Vault absents.
- **401 dans `net._http_response`** : le secret du Vault ne correspond pas à celui de Vercel.
- **503** : clés VAPID absentes de l'environnement Vercel concerné.
- **Simuler une heure** (lecture seule) : `select * from notification_candidates('2026-10-30 07:00:00+00');` liste qui serait notifié à cet instant.
- **iPhone** : les notifications web n'existent que si le site est installé sur l'écran d'accueil (iOS 16.4 ou plus).
- Désactivation côté utilisateur : Paramètres > « Désactiver les notifications » retire aussi l'appareil de la base.
