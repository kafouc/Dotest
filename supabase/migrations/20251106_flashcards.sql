-- Flashcards schema and RLS

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  document_path text, -- optional link to source document
  question text not null,
  answer text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_flashcards_user on public.flashcards(user_id);
create index if not exists idx_flashcards_doc on public.flashcards(document_path);

create table if not exists public.flashcard_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  grade int not null check (grade between 0 and 5),
  ease real not null default 2.5, -- SM-2 ease factor
  interval_days int not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  reviewed_at timestamptz not null default now()
);

create index if not exists idx_reviews_user_due on public.flashcard_reviews(user_id, due_at);
create index if not exists idx_reviews_card on public.flashcard_reviews(flashcard_id);

-- RLS
alter table public.flashcards enable row level security;
alter table public.flashcard_reviews enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='flashcards' and policyname='fc_owner_all'
  ) then
    create policy fc_owner_all on public.flashcards
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='flashcard_reviews' and policyname='fcr_owner_all'
  ) then
    create policy fcr_owner_all on public.flashcard_reviews
      for all using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;

-- Realtime (optionnel)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='flashcards'
  ) then
    execute 'alter publication supabase_realtime add table public.flashcards';
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='flashcard_reviews'
  ) then
    execute 'alter publication supabase_realtime add table public.flashcard_reviews';
  end if;
end $$;
