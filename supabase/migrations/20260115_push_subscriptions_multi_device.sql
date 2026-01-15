-- Allow multiple push subscriptions per user (multi-device support)

alter table public.push_subscriptions
  add column if not exists id uuid default gen_random_uuid();

update public.push_subscriptions
set id = gen_random_uuid()
where id is null;

alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_pkey;

alter table public.push_subscriptions
  add primary key (id);

create unique index if not exists push_subscriptions_endpoint_key
  on public.push_subscriptions (endpoint);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);
