-- ============================================================
-- Limitation de débit par utilisateur (fenêtre fixe, atomique)
--
-- Utilisée par les routes API qui appellent des services payants (Groq, Jina).
-- L'incrément et le contrôle de la limite se font dans UNE seule instruction SQL :
-- des requêtes simultanées ne peuvent pas dépasser la limite (pas de "check puis act").
-- Accès réservé au service role : le client ne peut ni lire ni remettre les compteurs à zéro.
-- ============================================================

create table if not exists public.api_rate_limits (
  user_id uuid not null,
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket, window_start)
);

create index if not exists idx_api_rate_limits_window on public.api_rate_limits (window_start);

-- RLS activée sans policy : aucun accès via l'API publique (le service role la contourne).
alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from anon, authenticated;

create or replace function public.consume_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
  v_retry integer;
begin
  if p_user_id is null or p_bucket is null or length(p_bucket) = 0 or length(p_bucket) > 100 then
    raise exception 'invalid rate limit key' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);

  -- Incrémente seulement si la limite n'est pas atteinte ; sinon aucune ligne n'est retournée.
  insert into public.api_rate_limits as r (user_id, bucket, window_start, count)
  values (p_user_id, p_bucket, v_window_start, 1)
  on conflict (user_id, bucket, window_start)
  do update set count = r.count + 1
  where r.count < p_limit
  returning r.count into v_count;

  -- Purge opportuniste des fenêtres anciennes (évite un job planifié)
  if random() < 0.01 then
    delete from public.api_rate_limits where window_start < v_now - interval '2 days';
  end if;

  v_retry := greatest(
    1,
    ceil(extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer
  );

  if v_count is null then
    return query select false, 0, v_retry;
  else
    return query select true, p_limit - v_count, v_retry;
  end if;
end;
$$;

revoke all on function public.consume_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer) to service_role;
