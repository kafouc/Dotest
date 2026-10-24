-- ============================================================
-- Exploitation : reprise des documents bloqués, alertes, agrégation planifiée
--
-- 1. documents.status_updated_at : horodatage du dernier changement d'état ou de progression.
--    Un document dont l'état n'a pas bougé depuis 45 min est considéré comme bloqué.
-- 2. recover_stuck_documents() : passe les documents bloqués en « failed » avec un message clair
--    (l'interface propose alors « Relancer l'analyse »).
-- 3. ops_alerts + check_ops_health() + notify_ops_alerts() : alertes envoyées à un webhook
--    (Slack / Discord) dont l'URL est stockée dans le Vault : aucun secret dans le dépôt.
--      select vault.create_secret('https://hooks.slack.com/…', 'ops_alert_webhook');
-- 4. pg_cron : reprise toutes les 10 min, contrôle toutes les 15 min, agrégation des métriques à 00:10 UTC
--    (les tables metrics_daily_* n'étaient jamais alimentées).
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;

-- ---------- 1. Horodatage d'état ----------
alter table public.documents add column if not exists status_updated_at timestamptz not null default now();
update public.documents set status_updated_at = created_at;

create or replace function public.touch_document_status()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.status_message is distinct from old.status_message then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_documents_status_updated on public.documents;
create trigger trg_documents_status_updated
  before insert or update on public.documents
  for each row execute function public.touch_document_status();

create index if not exists idx_documents_status_updated
  on public.documents (status_updated_at)
  where status in ('pending', 'processing');

-- ---------- 2. Alertes ----------
create table if not exists public.ops_alerts (
  id bigint generated always as identity primary key,
  kind text not null,
  message text not null,
  details jsonb,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists idx_ops_alerts_kind_created on public.ops_alerts (kind, created_at desc);

alter table public.ops_alerts enable row level security;
revoke all on table public.ops_alerts from anon, authenticated;
grant select on table public.ops_alerts to authenticated;
drop policy if exists ops_alerts_admin_read on public.ops_alerts;
create policy ops_alerts_admin_read on public.ops_alerts
  for select to authenticated
  using (public.is_admin());

-- ---------- 3. Fonctions ----------
create or replace function public.recover_stuck_documents(p_max_age interval default interval '45 minutes')
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  with stuck as (
    update public.documents
       set status = 'failed',
           status_message = 'Analyse interrompue (délai dépassé). Relancez l’analyse.'
     where status in ('pending', 'processing')
       and status_updated_at < now() - p_max_age
    returning id
  )
  select count(*) into v_count from stuck;

  if v_count > 0 then
    insert into public.ops_alerts (kind, message, details)
    values ('documents_stuck', v_count || ' document(s) bloqué(s) marqué(s) en échec', jsonb_build_object('count', v_count));
  end if;

  return v_count;
end;
$$;

create or replace function public.check_ops_health()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_failed integer;
  v_created integer := 0;
begin
  -- Série d'échecs d'analyse : au moins 5 en une heure, une alerte toutes les 6 h au plus
  select count(*) into v_failed
  from public.documents
  where status = 'failed' and status_updated_at > now() - interval '1 hour';

  if v_failed >= 5 and not exists (
    select 1 from public.ops_alerts where kind = 'documents_failing' and created_at > now() - interval '6 hours'
  ) then
    insert into public.ops_alerts (kind, message, details)
    values ('documents_failing', v_failed || ' analyses de documents ont échoué en 1 h', jsonb_build_object('count', v_failed));
    v_created := v_created + 1;
  end if;

  -- Conservation 90 jours
  delete from public.ops_alerts where created_at < now() - interval '90 days';

  return v_created;
end;
$$;

create or replace function public.notify_ops_alerts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_url text;
  v_row record;
  v_sent integer := 0;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets
  where name = 'ops_alert_webhook'
  limit 1;

  -- Pas de webhook configuré : les alertes restent consultables dans ops_alerts
  if v_url is null or v_url = '' then
    return 0;
  end if;

  for v_row in
    select id, message from public.ops_alerts where notified_at is null order by id limit 20
  loop
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object(
        'text', '[Sheet of Paper] ' || v_row.message,
        'content', '[Sheet of Paper] ' || v_row.message
      ),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
    update public.ops_alerts set notified_at = now() where id = v_row.id;
    v_sent := v_sent + 1;
  end loop;

  return v_sent;
end;
$$;

revoke all on function public.recover_stuck_documents(interval) from public, anon, authenticated;
revoke all on function public.check_ops_health() from public, anon, authenticated;
revoke all on function public.notify_ops_alerts() from public, anon, authenticated;
grant execute on function public.recover_stuck_documents(interval) to service_role;
grant execute on function public.check_ops_health() to service_role;
grant execute on function public.notify_ops_alerts() to service_role;

-- ---------- 4. Planification ----------
select cron.schedule('recover-stuck-documents', '*/10 * * * *', $job$select public.recover_stuck_documents()$job$);
select cron.schedule('ops-health', '*/15 * * * *', $job$select public.check_ops_health(); select public.notify_ops_alerts();$job$);
select cron.schedule('daily-metrics', '10 0 * * *', $job$select public.run_daily_metrics_aggregation()$job$);
