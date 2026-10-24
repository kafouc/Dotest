-- Global embedding rate limiter (DB-backed)

create table if not exists public.embedding_rate_limits (
  slot_key text primary key,
  next_available_at timestamptz not null default now()
);

create or replace function public.acquire_embedding_slot(
  p_slot_key text,
  p_min_interval_ms integer
) returns bigint
language plpgsql
as $$
declare
  current_next timestamptz;
  now_ts timestamptz := now();
  wait_ms bigint;
begin
  insert into public.embedding_rate_limits(slot_key, next_available_at)
  values (p_slot_key, now_ts)
  on conflict (slot_key) do nothing;

  select next_available_at into current_next
  from public.embedding_rate_limits
  where slot_key = p_slot_key
  for update;

  if current_next > now_ts then
    wait_ms := floor(extract(epoch from (current_next - now_ts)) * 1000);
  else
    wait_ms := 0;
  end if;

  update public.embedding_rate_limits
  set next_available_at = greatest(current_next, now_ts) + (p_min_interval_ms || ' milliseconds')::interval
  where slot_key = p_slot_key;

  return wait_ms;
end;
$$;
