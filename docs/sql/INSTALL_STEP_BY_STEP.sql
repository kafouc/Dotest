-- ============================================
-- INSTALLATION ÉTAPE PAR ÉTAPE
-- ============================================
-- Si la migration complète échoue, exécutez ce script
-- Il installe le système morceau par morceau

-- ========================================
-- ÉTAPE 1 : Activer l'extension pgcrypto
-- ========================================
create extension if not exists pgcrypto;

-- ========================================
-- ÉTAPE 2 : Créer les tables
-- ========================================

-- Table 1 : Quiz partagés
create table if not exists public.shared_quizzes (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  questions jsonb not null,
  share_code text unique,
  qr_code_url text,
  is_active boolean not null default true,
  max_participants int default null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- Table 2 : Sessions de quiz
create table if not exists public.quiz_sessions (
  id uuid primary key default gen_random_uuid(),
  shared_quiz_id uuid not null references public.shared_quizzes(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'active', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Table 3 : Participants
create table if not exists public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  nickname text not null,
  user_id uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  unique(session_id, nickname)
);

-- Table 4 : Réponses en temps réel
create table if not exists public.live_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.quiz_sessions(id) on delete cascade,
  participant_id uuid not null references public.session_participants(id) on delete cascade,
  question_index int not null,
  answer text not null,
  answer_text text,
  is_correct boolean not null,
  submitted_at timestamptz not null default now(),
  answered_at timestamptz not null default now()
);

-- ========================================
-- ÉTAPE 3 : Index pour performances
-- ========================================

create index if not exists idx_shared_quizzes_share_code 
  on public.shared_quizzes (share_code) where is_active = true;

create index if not exists idx_shared_quizzes_creator 
  on public.shared_quizzes (creator_id);

create index if not exists idx_quiz_sessions_shared_quiz 
  on public.quiz_sessions (shared_quiz_id);

create index if not exists idx_session_participants_session 
  on public.session_participants (session_id);

create index if not exists idx_live_answers_session 
  on public.live_answers (session_id);

create index if not exists idx_live_answers_participant 
  on public.live_answers (participant_id);

-- ========================================
-- ÉTAPE 4 : Activer RLS
-- ========================================

alter table public.shared_quizzes enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.live_answers enable row level security;

-- ========================================
-- ÉTAPE 5 : Politiques RLS - shared_quizzes
-- ========================================

drop policy if exists "Créateurs peuvent voir leurs quiz" on public.shared_quizzes;
create policy "Créateurs peuvent voir leurs quiz"
  on public.shared_quizzes for select
  using (auth.uid() = creator_id);

drop policy if exists "Créateurs peuvent créer des quiz" on public.shared_quizzes;
create policy "Créateurs peuvent créer des quiz"
  on public.shared_quizzes for insert
  with check (auth.uid() = creator_id);

drop policy if exists "Créateurs peuvent modifier leurs quiz" on public.shared_quizzes;
create policy "Créateurs peuvent modifier leurs quiz"
  on public.shared_quizzes for update
  using (auth.uid() = creator_id);

drop policy if exists "Tout le monde peut voir les quiz actifs par code" on public.shared_quizzes;
create policy "Tout le monde peut voir les quiz actifs par code"
  on public.shared_quizzes for select
  using (is_active = true);

-- ========================================
-- ÉTAPE 6 : Politiques RLS - quiz_sessions
-- ========================================

drop policy if exists "Créateurs peuvent voir les sessions de leurs quiz" on public.quiz_sessions;
create policy "Créateurs peuvent voir les sessions de leurs quiz"
  on public.quiz_sessions for select
  using (
    exists (
      select 1 from public.shared_quizzes
      where shared_quizzes.id = quiz_sessions.shared_quiz_id
        and shared_quizzes.creator_id = auth.uid()
    )
  );

drop policy if exists "Créateurs peuvent créer des sessions" on public.quiz_sessions;
create policy "Créateurs peuvent créer des sessions"
  on public.quiz_sessions for insert
  with check (
    exists (
      select 1 from public.shared_quizzes
      where shared_quizzes.id = shared_quiz_id
        and shared_quizzes.creator_id = auth.uid()
    )
  );

drop policy if exists "Créateurs peuvent modifier leurs sessions" on public.quiz_sessions;
create policy "Créateurs peuvent modifier leurs sessions"
  on public.quiz_sessions for update
  using (
    exists (
      select 1 from public.shared_quizzes
      where shared_quizzes.id = quiz_sessions.shared_quiz_id
        and shared_quizzes.creator_id = auth.uid()
    )
  );

drop policy if exists "Participants peuvent voir leur session" on public.quiz_sessions;
create policy "Participants peuvent voir leur session"
  on public.quiz_sessions for select
  using (
    exists (
      select 1 from public.session_participants
      where session_participants.session_id = quiz_sessions.id
    )
  );

-- ========================================
-- ÉTAPE 7 : Politiques RLS - session_participants
-- ========================================

drop policy if exists "Tout le monde peut rejoindre une session" on public.session_participants;
create policy "Tout le monde peut rejoindre une session"
  on public.session_participants for insert
  with check (true);

drop policy if exists "Participants peuvent voir leur session" on public.session_participants;
create policy "Participants peuvent voir leur session"
  on public.session_participants for select
  using (
    exists (
      select 1 from public.quiz_sessions qs
      where qs.id = session_participants.session_id
    )
  );

drop policy if exists "Créateurs peuvent voir tous les participants" on public.session_participants;
create policy "Créateurs peuvent voir tous les participants"
  on public.session_participants for select
  using (
    exists (
      select 1 from public.quiz_sessions qs
      join public.shared_quizzes sq on sq.id = qs.shared_quiz_id
      where qs.id = session_participants.session_id
        and sq.creator_id = auth.uid()
    )
  );

-- ========================================
-- ÉTAPE 8 : Politiques RLS - live_answers
-- ========================================

drop policy if exists "Participants peuvent soumettre leurs réponses" on public.live_answers;
create policy "Participants peuvent soumettre leurs réponses"
  on public.live_answers for insert
  with check (
    exists (
      select 1 from public.session_participants
      where session_participants.id = participant_id
    )
  );

drop policy if exists "Participants peuvent voir leurs réponses" on public.live_answers;
create policy "Participants peuvent voir leurs réponses"
  on public.live_answers for select
  using (
    exists (
      select 1 from public.session_participants
      where session_participants.id = live_answers.participant_id
    )
  );

drop policy if exists "Créateurs peuvent voir toutes les réponses" on public.live_answers;
create policy "Créateurs peuvent voir toutes les réponses"
  on public.live_answers for select
  using (
    exists (
      select 1 from public.quiz_sessions qs
      join public.shared_quizzes sq on sq.id = qs.shared_quiz_id
      where qs.id = live_answers.session_id
        and sq.creator_id = auth.uid()
    )
  );

-- ========================================
-- ÉTAPE 9 : Fonction génération code
-- ========================================

create or replace function public.generate_share_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- ========================================
-- ÉTAPE 10 : Fonction trigger
-- ========================================

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

-- Fonction pour auto-remplir creator_id avec l'utilisateur connecté
create or replace function public.fn_set_creator_id()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.creator_id is null then
    new.creator_id := auth.uid();
  end if;
  return new;
end;
$$;

-- ========================================
-- ÉTAPE 11 : Créer les triggers
-- ========================================

drop trigger if exists trg_shared_quizzes_generate_code on public.shared_quizzes;

create trigger trg_shared_quizzes_generate_code
before insert on public.shared_quizzes
for each row execute function public.fn_generate_unique_share_code();

drop trigger if exists trg_shared_quizzes_set_creator on public.shared_quizzes;

create trigger trg_shared_quizzes_set_creator
before insert on public.shared_quizzes
for each row execute function public.fn_set_creator_id();

-- ========================================
-- ÉTAPE 12 : Activer Realtime
-- ========================================

-- Note : Si les tables sont déjà dans la publication, cette étape échouera
-- mais ce n'est pas grave, cela signifie que Realtime est déjà activé

do $$
begin
  -- Tenter d'ajouter quiz_sessions
  begin
    alter publication supabase_realtime add table public.quiz_sessions;
  exception when duplicate_object then
    raise notice 'quiz_sessions déjà dans supabase_realtime';
  end;

  -- Tenter d'ajouter session_participants
  begin
    alter publication supabase_realtime add table public.session_participants;
  exception when duplicate_object then
    raise notice 'session_participants déjà dans supabase_realtime';
  end;

  -- Tenter d'ajouter live_answers
  begin
    alter publication supabase_realtime add table public.live_answers;
  exception when duplicate_object then
    raise notice 'live_answers déjà dans supabase_realtime';
  end;
end $$;

-- ========================================
-- ✅ INSTALLATION TERMINÉE
-- ========================================

-- Vérification finale
select 
  'Tables créées' as etape,
  count(*) as nombre
from information_schema.tables
where table_schema = 'public'
  and table_name in ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
union all
select 
  'Politiques RLS' as etape,
  count(*) as nombre
from pg_policies
where tablename in ('shared_quizzes', 'quiz_sessions', 'session_participants', 'live_answers')
union all
select
  'Fonctions' as etape,
  count(*) as nombre
from pg_proc
where proname in ('generate_share_code', 'fn_generate_unique_share_code')
union all
select
  'Triggers' as etape,
  count(*) as nombre
from information_schema.triggers
where trigger_name = 'trg_shared_quizzes_generate_code';
