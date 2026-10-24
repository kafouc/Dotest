-- ============================================================
-- Révision du jour : cartes issues des erreurs de quiz, objectif quotidien, file d'attente unifiée
--
-- 1. flashcards.source / question_key : une question de quiz ratée devient une carte de révision (une seule
--    carte par question et par utilisateur grâce à la clé unique).
-- 2. user_settings.daily_goal : objectif quotidien de cartes révisées.
-- 3. list_due_flashcards() : cartes à réviser, déjà triées (retards d'abord, puis nouvelles), en une requête
--    (l'application faisait la jointure côté navigateur sur 200 cartes seulement).
-- 4. review_summary() : compteurs pour la page « À réviser aujourd'hui » et les badges.
-- ============================================================

alter table public.flashcards add column if not exists source text not null default 'generated';
alter table public.flashcards drop constraint if exists flashcards_source_check;
alter table public.flashcards add constraint flashcards_source_check check (source in ('generated', 'quiz_error'));
alter table public.flashcards add column if not exists question_key text;

-- Index unique ordinaire (et non partiel) : l'upsert de l'application cible (user_id, question_key).
-- Les valeurs NULL (cartes générées) ne sont jamais considérées comme des doublons.
create unique index if not exists uq_flashcards_user_question_key
  on public.flashcards (user_id, question_key);

create index if not exists idx_flashcard_reviews_card_reviewed
  on public.flashcard_reviews (flashcard_id, reviewed_at desc);
create index if not exists idx_flashcard_reviews_user_reviewed
  on public.flashcard_reviews (user_id, reviewed_at desc);

-- ---------- Réglages utilisateur ----------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_goal integer not null default 10 check (daily_goal between 1 and 200),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;
revoke all on table public.user_settings from anon;
grant select, insert, update on table public.user_settings to authenticated;

drop policy if exists user_settings_select_own on public.user_settings;
create policy user_settings_select_own on public.user_settings for select to authenticated using (user_id = auth.uid());
drop policy if exists user_settings_insert_own on public.user_settings;
create policy user_settings_insert_own on public.user_settings for insert to authenticated with check (user_id = auth.uid());
drop policy if exists user_settings_update_own on public.user_settings;
create policy user_settings_update_own on public.user_settings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Cartes à réviser ----------
create or replace function public.list_due_flashcards(
  p_document_path text default null,
  p_limit integer default 20
)
returns table (
  id uuid,
  document_path text,
  question text,
  answer text,
  created_at timestamptz,
  source text,
  due_at timestamptz
)
language sql
stable
set search_path = public, pg_temp
as $$
  select f.id, f.document_path, f.question, f.answer, f.created_at, f.source, last.due_at
  from public.flashcards f
  left join lateral (
    select r.due_at
    from public.flashcard_reviews r
    where r.flashcard_id = f.id
    order by r.reviewed_at desc
    limit 1
  ) last on true
  where f.user_id = auth.uid()
    and (p_document_path is null or f.document_path = p_document_path)
    and (last.due_at is null or last.due_at <= now())
  -- Retards les plus anciens d'abord, puis les cartes jamais vues (les plus récentes en dernier)
  order by last.due_at asc nulls last, f.created_at asc
  limit least(greatest(coalesce(p_limit, 20), 1), 200);
$$;

create or replace function public.review_summary(p_timezone text default 'Europe/Paris')
returns table (
  due_count integer,
  new_count integer,
  quiz_error_due integer,
  reviewed_today integer,
  daily_goal integer
)
language sql
stable
set search_path = public, pg_temp
as $$
  with cards as (
    select f.id, f.source, last.due_at
    from public.flashcards f
    left join lateral (
      select r.due_at from public.flashcard_reviews r
      where r.flashcard_id = f.id order by r.reviewed_at desc limit 1
    ) last on true
    where f.user_id = auth.uid()
  )
  select
    (select count(*) from cards where due_at is not null and due_at <= now())::integer,
    (select count(*) from cards where due_at is null)::integer,
    (select count(*) from cards where source = 'quiz_error' and (due_at is null or due_at <= now()))::integer,
    (select count(*) from public.flashcard_reviews r
      where r.user_id = auth.uid()
        and r.reviewed_at >= (date_trunc('day', now() at time zone p_timezone) at time zone p_timezone))::integer,
    coalesce((select s.daily_goal from public.user_settings s where s.user_id = auth.uid()), 10);
$$;

revoke all on function public.list_due_flashcards(text, integer) from public, anon;
revoke all on function public.review_summary(text) from public, anon;
grant execute on function public.list_due_flashcards(text, integer) to authenticated, service_role;
grant execute on function public.review_summary(text) to authenticated, service_role;
