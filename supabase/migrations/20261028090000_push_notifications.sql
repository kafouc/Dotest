-- ============================================================
-- Notifications push : bienvenue, rappel du matin, révision espacée, rappel du soir
--
-- 1. user_settings : préférences (3 types activables, heures du matin et du soir, fuseau horaire).
-- 2. push_subscriptions.welcomed_at : la notification de bienvenue n'est envoyée qu'une fois par appareil.
-- 3. notification_log : une seule notification d'un type donné par jour et par utilisateur (clé unique).
--    `claim_notification` réserve l'envoi de façon atomique : deux exécutions simultanées ne peuvent pas envoyer en double.
-- 4. notification_candidates(now) : qui doit recevoir quoi à cet instant, dans son fuseau horaire.
-- 5. trigger_push_notifications() + pg_cron : appelle toutes les 15 minutes /api/cron/notifications (URL et secret dans le Vault).
--
-- Activation (une fois, dans l'éditeur SQL) :
--   select vault.create_secret('https://sheetofpaper.app/api/cron/notifications', 'notify_cron_url');
--   select vault.create_secret('<valeur de NOTIFY_CRON_SECRET ou METRICS_CRON_SECRET sur Vercel>', 'notify_cron_secret');
-- ============================================================

-- ---------- 1. Préférences ----------
alter table public.user_settings add column if not exists notify_morning boolean not null default true;
alter table public.user_settings add column if not exists notify_spaced boolean not null default true;
alter table public.user_settings add column if not exists notify_evening boolean not null default true;
alter table public.user_settings add column if not exists morning_hour smallint not null default 8;
alter table public.user_settings add column if not exists evening_hour smallint not null default 19;
alter table public.user_settings add column if not exists timezone text not null default 'Europe/Paris';

alter table public.user_settings drop constraint if exists user_settings_hours_check;
alter table public.user_settings add constraint user_settings_hours_check
  check (morning_hour between 5 and 11 and evening_hour between 17 and 22);

-- ---------- 2. Bienvenue ----------
alter table public.push_subscriptions add column if not exists welcomed_at timestamptz;
-- Les abonnements existants ont déjà été accueillis (ou l'ont été par l'ancienne version) : pas de rattrapage
update public.push_subscriptions set welcomed_at = coalesce(welcomed_at, now()) where welcomed_at is null;

-- ---------- 3. Journal ----------
create table if not exists public.notification_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('morning', 'spaced', 'evening')),
  local_day date not null,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, local_day)
);
create index if not exists idx_notification_log_sent on public.notification_log (sent_at);

alter table public.notification_log enable row level security;
revoke all on table public.notification_log from anon, authenticated;

create or replace function public.claim_notification(p_user_id uuid, p_kind text, p_local_day date)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  insert into public.notification_log (user_id, kind, local_day)
  values (p_user_id, p_kind, p_local_day)
  on conflict (user_id, kind, local_day) do nothing
  returning id into v_id;
  return v_id is not null;
end;
$$;

-- ---------- 4. Qui doit recevoir quoi ----------
-- Fenêtres : matin = heure choisie (8 h par défaut), révision espacée = 13 h, soir = heure choisie (19 h par défaut).
-- Le planificateur passe toutes les 15 minutes : la notification part au premier passage de l'heure concernée.
create or replace function public.notification_candidates(p_now timestamptz default now())
returns table (
  user_id uuid,
  kind text,
  local_day date,
  due_count integer,
  new_count integer,
  quiz_error_due integer,
  reviewed_today integer,
  daily_goal integer,
  current_streak integer
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with valid_zones as (
    select name from pg_timezone_names
  ),
  prefs as (
    select u.user_id,
           coalesce((select z.name from valid_zones z where z.name = coalesce(s.timezone, st.timezone)), 'Europe/Paris') as tz,
           coalesce(s.notify_morning, true) as notify_morning,
           coalesce(s.notify_spaced, true) as notify_spaced,
           coalesce(s.notify_evening, true) as notify_evening,
           coalesce(s.morning_hour, 8)::int as morning_hour,
           coalesce(s.evening_hour, 19)::int as evening_hour,
           coalesce(s.daily_goal, 10) as daily_goal,
           coalesce(st.current_streak, 0) as current_streak,
           st.last_active_date
    from (select distinct ps.user_id from public.push_subscriptions ps) u
    left join public.user_settings s on s.user_id = u.user_id
    left join public.user_streaks st on st.user_id = u.user_id
    where coalesce(st.should_notify, true)
  ),
  local as (
    select p.*,
           (p_now at time zone p.tz)::date as local_day,
           extract(hour from (p_now at time zone p.tz))::int as local_hour,
           (date_trunc('day', p_now at time zone p.tz) at time zone p.tz) as day_start
    from prefs p
  ),
  cards as (
    select l.user_id,
           count(*) filter (where lr.due_at is not null and lr.due_at <= p_now)::int as due_count,
           count(*) filter (where lr.due_at is null)::int as new_count,
           count(*) filter (where f.source = 'quiz_error' and (lr.due_at is null or lr.due_at <= p_now))::int as quiz_error_due
    from local l
    join public.flashcards f on f.user_id = l.user_id
    left join lateral (
      select r.due_at from public.flashcard_reviews r where r.flashcard_id = f.id order by r.reviewed_at desc limit 1
    ) lr on true
    group by l.user_id
  ),
  reviewed as (
    select l.user_id, count(*)::int as n
    from local l
    join public.flashcard_reviews r on r.user_id = l.user_id and r.reviewed_at >= l.day_start
    group by l.user_id
  ),
  joined as (
    select l.*, coalesce(c.due_count, 0) as due_count, coalesce(c.new_count, 0) as new_count,
           coalesce(c.quiz_error_due, 0) as quiz_error_due, coalesce(rv.n, 0) as reviewed_today,
           coalesce(l.last_active_date = l.local_day, false) as active_today
    from local l
    left join cards c on c.user_id = l.user_id
    left join reviewed rv on rv.user_id = l.user_id
  ),
  wanted as (
    select j.*, 'morning'::text as kind from joined j
      where j.notify_morning and j.local_hour = j.morning_hour and not j.active_today
    union all
    select j.*, 'spaced' from joined j
      where j.notify_spaced and j.local_hour = 13 and j.due_count >= 3 and j.reviewed_today < j.daily_goal
    union all
    select j.*, 'evening' from joined j
      where j.notify_evening and j.local_hour = j.evening_hour and not j.active_today
  )
  select w.user_id, w.kind, w.local_day, w.due_count, w.new_count, w.quiz_error_due, w.reviewed_today, w.daily_goal, w.current_streak
  from wanted w
  where not exists (
    select 1 from public.notification_log nl
    where nl.user_id = w.user_id and nl.kind = w.kind and nl.local_day = w.local_day
  )
  order by w.user_id, w.kind;
$$;

-- ---------- 5. Planification ----------
create or replace function public.trigger_push_notifications()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text;
  v_secret text;
  v_request bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_cron_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_cron_secret' limit 1;

  -- Non configuré : on ne fait rien (voir « Activation » en tête de fichier)
  if v_url is null or v_url = '' or v_secret is null or v_secret = '' then
    return null;
  end if;

  select net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  ) into v_request;
  return v_request;
end;
$$;

-- Nettoyage du journal : 60 jours suffisent (la clé unique ne sert que pour la journée en cours)
create or replace function public.purge_notification_log()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count bigint;
begin
  delete from public.notification_log where sent_at < now() - interval '60 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_notification(uuid, text, date) from public, anon, authenticated;
revoke all on function public.notification_candidates(timestamptz) from public, anon, authenticated;
revoke all on function public.trigger_push_notifications() from public, anon, authenticated;
revoke all on function public.purge_notification_log() from public, anon, authenticated;
grant execute on function public.claim_notification(uuid, text, date) to service_role;
grant execute on function public.notification_candidates(timestamptz) to service_role;
grant execute on function public.trigger_push_notifications() to service_role;
grant execute on function public.purge_notification_log() to service_role;

select cron.schedule('push-notifications', '*/15 * * * *', $job$select public.trigger_push_notifications()$job$);
select cron.schedule('purge-notification-log', '45 3 * * *', $job$select public.purge_notification_log()$job$);
