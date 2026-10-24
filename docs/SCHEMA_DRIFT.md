# Écart entre la production Supabase et `supabase/migrations/`

Projet de production : `quizz` (ref `azodrrhkjmfmpitptecl`, eu-west-1), constaté le 2026-10-24.

## Constats
- `supabase_migrations` n'enregistre que 13 migrations, alors que le dépôt en contient 30 : les autres ont été exécutées à la main (SQL editor). Le dépôt ne permet donc pas de reconstruire la base.
- Tables présentes en production et **absentes des migrations** :
  - utilisées par le code : `document_sections`, `users`, `api_rate_limits` (et la fonction `consume_rate_limit`, appliquée en production le 2026-10-24 mais utilisée seulement par la branche `claude/rate-limits-quotas`) ;
  - sans usage dans le code : `analytics_events` (44 lignes), `analytics_sessions` (13), `daily_stats` (0), `user_sessions` (0), `ocr_documents` (10), `ocr_chunks` (1312), `ocr_embeddings` (1312).
- Les 8 migrations RLS du 2025-11-06 (reset, debug, split…) sont des correctifs successifs ; seul l'état final en production fait foi.
- Toutes les tables ont la RLS activée. `api_rate_limits`, `embedding_rate_limits` et `quiz_challenges` n'ont aucune policy : c'est voulu (accès via la clé service role uniquement).

## Avertissements du linter de sécurité Supabase
- 7 fonctions `SECURITY DEFINER` exécutables par `anon` : `get_public_quiz`, `is_quiz_creator`, `is_session_creator`, `is_shared_quiz_active`, `join_session`, `list_active_session`, `submit_live_answer`. `join_session`, `list_active_session`, `submit_live_answer` et `get_public_quiz` sont probablement voulues (live quiz et partage) ; les helpers `is_*` devraient être réservés à `authenticated` ou aux policies.
- 11 fonctions `SECURITY DEFINER` exécutables par `authenticated`, dont `admin_list_user_activity`, `get_recent_activities` et `update_user_streak(p_user_id, …)` : vérifier qu'elles contrôlent `auth.uid()` (en particulier `update_user_streak`, qui accepte un `p_user_id`).
- Protection contre les mots de passe compromis désactivée (Auth → Password security).

## Plan de remise à plat (à faire avec `supabase db dump`, qui nécessite le mot de passe de la base)
1. `supabase link --project-ref azodrrhkjmfmpitptecl` puis `supabase db dump --schema public -f supabase/baseline.sql`.
2. Archiver les migrations actuelles dans `supabase/migrations/archive/`, ajouter le dump comme migration `0000_baseline`, puis `supabase migration repair` pour aligner l'historique.
3. Ne partir de ce baseline que pour les nouvelles migrations.
4. Décider du sort des tables `ocr_*` / `analytics_*` / `daily_stats` / `user_sessions` (sauvegarde puis suppression, ou conservation documentée).
