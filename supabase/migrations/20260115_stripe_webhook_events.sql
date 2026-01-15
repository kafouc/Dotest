-- Idempotency tracking for Stripe webhooks

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  received_at timestamptz not null default now()
);

alter table public.stripe_webhook_events enable row level security;
