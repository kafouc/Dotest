-- Create table for Web Push subscriptions
create table if not exists public.push_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  endpoint text,
  keys jsonb,
  raw jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Update trigger for updated_at
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; $$ language plpgsql;

drop trigger if exists trg_push_subscriptions_updated_at on public.push_subscriptions;
create trigger trg_push_subscriptions_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

-- RLS
alter table public.push_subscriptions enable row level security;

-- Policies: users can manage their own subscription
drop policy if exists "select own subscription" on public.push_subscriptions;
create policy "select own subscription" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "upsert own subscription" on public.push_subscriptions;
create policy "upsert own subscription" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "update own subscription" on public.push_subscriptions;
create policy "update own subscription" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
