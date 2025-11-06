-- ============================================================
-- Système de partage de quiz en temps réel (Prof/Élèves)
-- ============================================================

-- 1) Table des quiz partagés
create table if not exists public.shared_quizzes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  questions jsonb not null, -- Stocke toutes les questions du quiz
  share_code text unique not null, -- Code court pour rejoindre (ex: "ABC123")
  qr_code_url text, -- URL du QR code généré
  is_active boolean not null default true,
  max_participants int default null, -- Limite optionnelle de participants
  created_at timestamptz not null default now(),
  expires_at timestamptz -- Optionnel: expiration du partage
);

-- Index pour recherche rapide par code
create index if not exists idx_shared_quizzes_share_code 
  on public.shared_quizzes (share_code) where is_active = true;

-- 2) Table des sessions de quiz (une session = une instance d'un quiz partagé)
create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  shared_quiz_id uuid not null references public.shared_quizzes(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 3) Table des participants (élèves)
create table if not exists public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  nickname text not null, -- Pseudo de l'élève (pas besoin de compte)
  user_id uuid references auth.users(id) on delete set null, -- Optionnel si l'élève a un compte
  joined_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  unique(session_id, nickname) -- Un pseudo unique par session
);

-- 4) Table des réponses en temps réel
create table if not exists public.live_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  participant_id uuid not null references public.session_participants(id) on delete cascade,
  question_index int not null,
  answer text not null, -- Lettre choisie (A/B/C/D)
  answer_text text, -- Texte complet de la réponse
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  unique(session_id, participant_id, question_index) -- Une réponse par question par participant
);

-- Index pour récupération rapide des réponses par session
create index if not exists idx_live_answers_session 
  on public.live_answers (session_id, question_index);

create index if not exists idx_live_answers_participant 
  on public.live_answers (participant_id);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

alter table public.shared_quizzes enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.live_answers enable row level security;

-- Policies pour shared_quizzes
do $$
begin
  -- Le créateur peut tout faire sur ses quiz partagés
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='shared_quizzes' and policyname='sq_creator_all'
  ) then
    create policy sq_creator_all
      on public.shared_quizzes
      for all
      using (creator_id = auth.uid())
      with check (creator_id = auth.uid());
  end if;

  -- Tout le monde peut lire les quiz actifs (pour rejoindre)
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='shared_quizzes' and policyname='sq_public_read'
  ) then
    create policy sq_public_read
      on public.shared_quizzes
      for select
      using (is_active = true);
  end if;
end $$;

-- Policies pour quiz_sessions
do $$
begin
  -- Le créateur du quiz peut gérer les sessions
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='quiz_sessions' and policyname='qs_creator_all'
  ) then
    create policy qs_creator_all
      on public.quiz_sessions
      for all
      using (
        exists (
          select 1 from public.shared_quizzes sq
          where sq.id = quiz_sessions.shared_quiz_id
            and sq.creator_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1 from public.shared_quizzes sq
          where sq.id = quiz_sessions.shared_quiz_id
            and sq.creator_id = auth.uid()
        )
      );
  end if;

  -- Les participants peuvent lire les sessions auxquelles ils participent
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='quiz_sessions' and policyname='qs_participant_read'
  ) then
    create policy qs_participant_read
      on public.quiz_sessions
      for select
      using (
        exists (
          select 1 from public.session_participants sp
          where sp.session_id = quiz_sessions.id
            and (sp.user_id = auth.uid() or auth.uid() is null)
        )
      );
  end if;
end $$;

-- Policies pour session_participants
do $$
begin
  -- Le créateur du quiz peut voir tous les participants
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='session_participants' and policyname='sp_creator_read'
  ) then
    create policy sp_creator_read
      on public.session_participants
      for select
      using (
        exists (
          select 1 from public.quiz_sessions qs
          join public.shared_quizzes sq on sq.id = qs.shared_quiz_id
          where qs.id = session_participants.session_id
            and sq.creator_id = auth.uid()
        )
      );
  end if;

  -- Un participant peut s'inscrire et voir les autres participants
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='session_participants' and policyname='sp_public_join'
  ) then
    create policy sp_public_join
      on public.session_participants
      for insert
      with check (true); -- Tout le monde peut rejoindre (avec un pseudo unique)
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='session_participants' and policyname='sp_public_read'
  ) then
    create policy sp_public_read
      on public.session_participants
      for select
      using (true); -- Tout le monde peut voir les participants (transparence)
  end if;
end $$;

-- Policies pour live_answers
do $$
begin
  -- Le créateur du quiz peut voir toutes les réponses
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='live_answers' and policyname='la_creator_read'
  ) then
    create policy la_creator_read
      on public.live_answers
      for select
      using (
        exists (
          select 1 from public.quiz_sessions qs
          join public.shared_quizzes sq on sq.id = qs.shared_quiz_id
          where qs.id = live_answers.session_id
            and sq.creator_id = auth.uid()
        )
      );
  end if;

  -- Un participant peut créer et voir ses propres réponses
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='live_answers' and policyname='la_participant_own'
  ) then
    create policy la_participant_own
      on public.live_answers
      for all
      using (
        exists (
          select 1 from public.session_participants sp
          where sp.id = live_answers.participant_id
            and (sp.user_id = auth.uid() or auth.uid() is null)
        )
      )
      with check (
        exists (
          select 1 from public.session_participants sp
          where sp.id = live_answers.participant_id
            and (sp.user_id = auth.uid() or auth.uid() is null)
        )
      );
  end if;
end $$;

-- ============================================================
-- Realtime
-- ============================================================

do $$
begin
  -- Active Realtime pour toutes les tables
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='shared_quizzes'
  ) then
    execute 'alter publication supabase_realtime add table public.shared_quizzes';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='quiz_sessions'
  ) then
    execute 'alter publication supabase_realtime add table public.quiz_sessions';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='session_participants'
  ) then
    execute 'alter publication supabase_realtime add table public.session_participants';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='live_answers'
  ) then
    execute 'alter publication supabase_realtime add table public.live_answers';
  end if;
end $$;

-- ============================================================
-- Fonctions utilitaires
-- ============================================================

-- Génère un code de partage unique (6 caractères alphanumériques)
create or replace function public.generate_share_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Évite les caractères ambigus (0, O, 1, I)
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- Trigger pour générer automatiquement un share_code unique
create or replace function public.fn_generate_unique_share_code()
returns trigger
language plpgsql
as $$
declare
  new_code text;
  code_exists boolean;
begin
  if new.share_code is null then
    loop
      new_code := public.generate_share_code();
      select exists(select 1 from public.shared_quizzes where share_code = new_code) into code_exists;
      exit when not code_exists;
    end loop;
    new.share_code := new_code;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_shared_quizzes_generate_code on public.shared_quizzes;

create trigger trg_shared_quizzes_generate_code
before insert on public.shared_quizzes
for each row execute function public.fn_generate_unique_share_code();
