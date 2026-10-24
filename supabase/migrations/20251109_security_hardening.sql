-- ============================================================
-- Durcissement sécurité (advisors Supabase + revue des policies)
-- ============================================================

-- 1) ÉLÉVATION DE PRIVILÈGES : n'importe quel utilisateur connecté pouvait s'ajouter lui-même
--    dans admin_users (policy admin_users_insert_self) puis lire toutes les données admin,
--    changer des plans et modifier la facturation. Les admins sont désormais ajoutés
--    uniquement via le service role / le SQL Editor.
drop policy if exists admin_users_insert_self on public.admin_users;
drop policy if exists admin_users_insert_service on public.admin_users;
create policy admin_users_insert_service on public.admin_users
  for insert with check (auth.role() = 'service_role');

-- 2) Tables analytics héritées (non utilisées par l'application) : policies publiques supprimées.
drop policy if exists "Anyone can manage their session" on public.analytics_sessions;
drop policy if exists "Anyone can insert events" on public.analytics_events;

-- 3) Streaks : l'écriture passe par la RPC update_user_streak (SECURITY DEFINER, qui vérifie l'appelant).
--    Plus d'écriture directe par l'utilisateur (il pouvait fixer son propre record).
drop policy if exists user_streaks_insert_self on public.user_streaks;
drop policy if exists user_streaks_update_self on public.user_streaks;

-- 4) Défis : lecture/écriture uniquement via les routes API (clé service). Plus de listing public.
drop policy if exists quiz_challenges_public_select on public.quiz_challenges;

-- 5) Table de limitation d'embeddings : RLS activée, accès service role uniquement.
alter table public.embedding_rate_limits enable row level security;

-- 6) Table de test oubliée
drop table if exists public._write_probe;

-- 7) Vue exécutée avec les droits de l'appelant (RLS de page_views appliquée)
alter view public.metrics_homepage_views set (security_invoker = true);

-- 8) Droits d'exécution des fonctions
do $$
declare
  r record;
begin
  -- Réservées au service role (appelées uniquement côté serveur avec la clé service, ou par des triggers)
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (array[
        'set_user_plan', 'get_or_create_stripe_customer', 'run_daily_metrics_aggregation',
        'mark_streak_reminder_sent', 'cleanup_expired_sessions',
        'count_active_users_today', 'count_connected_users', 'get_realtime_stats',
        'get_activity_stats', 'get_user_activity', 'search_ocr_chunks',
        'acquire_embedding_slot', 'handle_new_user_plan', 'fn_set_creator_id',
        'enforce_session_participant_limit'
      ])
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;

  -- Nécessitent un utilisateur connecté (le contrôle d'identité est fait dans la fonction)
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (array[
        'admin_list_user_activity', 'get_recent_activities', 'update_user_streak',
        'create_quiz_session', 'match_document_sections'
      ])
  loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;

  -- 9) search_path figé (évite le détournement par un schéma maîtrisé par l'appelant)
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = any (array[
        'count_active_users_today', 'count_connected_users', 'get_user_activity', 'fn_set_user_id',
        'get_realtime_stats', 'update_updated_at_column', 'increment_session_page_views',
        'acquire_embedding_slot', 'search_ocr_chunks', 'set_updated_at', 'generate_share_code',
        'fn_generate_unique_share_code', 'is_admin', 'fn_quiz_challenges_set_code',
        'set_updated_at_billing_customers', 'set_updated_at_user_plans', 'update_users_updated_at',
        'cleanup_expired_sessions', 'fn_set_creator_id', 'match_document_sections'
      ])
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', r.sig);
  end loop;
end $$;
