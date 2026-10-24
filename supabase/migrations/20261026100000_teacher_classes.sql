-- ============================================================
-- Espace enseignant : classes, historique des séances live, progression des élèves
--
-- Les élèves restent anonymes (pseudo choisi à l'entrée de la séance) : aucune liste nominative n'est stockée
-- ni exposée. La progression d'un élève est suivie par pseudo à l'intérieur d'une classe.
--
-- 1. classes : une classe appartient à un enseignant ; le nombre de classes dépend du forfait.
-- 2. quiz_sessions.class_id : rattache une séance live à une classe (contrôle de propriété par trigger).
-- 3. create_quiz_session(quiz, classe) : même fonction, avec la classe en option.
-- 4. class_sessions_summary / class_question_stats / class_students_progress : agrégats calculés en base
--    (pas de limite de 1000 lignes côté API), sous la RLS de l'enseignant.
-- ============================================================

-- ---------- 1. Classes ----------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  level text check (level is null or char_length(level) <= 40),
  archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_classes_owner on public.classes (owner_id, archived, created_at desc);

alter table public.classes enable row level security;
revoke all on table public.classes from anon;
grant select, insert, update, delete on table public.classes to authenticated;

drop policy if exists classes_select_own on public.classes;
create policy classes_select_own on public.classes for select to authenticated using (owner_id = auth.uid());
drop policy if exists classes_insert_own on public.classes;
create policy classes_insert_own on public.classes for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists classes_update_own on public.classes;
create policy classes_update_own on public.classes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists classes_delete_own on public.classes;
create policy classes_delete_own on public.classes for delete to authenticated using (owner_id = auth.uid());

-- Limite par forfait : 1 classe (freemium), 5 (partial), 30 (pro) ; les classes archivées ne comptent pas
create or replace function public.enforce_class_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_plan text;
  v_limit integer;
  v_count integer;
begin
  if new.archived then
    return new;
  end if;

  select coalesce((select up.plan from public.user_plans up where up.user_id = new.owner_id), 'freemium') into v_plan;
  v_limit := case v_plan when 'pro' then 30 when 'partial' then 5 else 1 end;

  select count(*) into v_count
  from public.classes c
  where c.owner_id = new.owner_id and not c.archived and c.id is distinct from new.id;

  if v_count >= v_limit then
    raise exception 'Nombre maximal de classes atteint pour ce plan (%).', v_plan using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_classes_limit on public.classes;
create trigger trg_classes_limit
  before insert or update of archived on public.classes
  for each row execute function public.enforce_class_limit();

-- ---------- 2. Séances rattachées à une classe ----------
alter table public.quiz_sessions add column if not exists class_id uuid references public.classes (id) on delete set null;
create index if not exists idx_quiz_sessions_class on public.quiz_sessions (class_id) where class_id is not null;

create or replace function public.check_session_class_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.class_id is not null
     and (tg_op = 'INSERT' or new.class_id is distinct from old.class_id)
     and not exists (select 1 from public.classes c where c.id = new.class_id and c.owner_id = auth.uid()) then
    raise exception 'permission denied: cette classe ne vous appartient pas' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_quiz_sessions_class_owner on public.quiz_sessions;
create trigger trg_quiz_sessions_class_owner
  before insert or update of class_id on public.quiz_sessions
  for each row execute function public.check_session_class_owner();

-- ---------- 3. Création d'une séance, avec classe optionnelle ----------
drop function if exists public.create_quiz_session(uuid);

create or replace function public.create_quiz_session(p_shared_quiz_id uuid, p_class_id uuid default null)
returns public.quiz_sessions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.quiz_sessions;
begin
  if not exists (
    select 1 from public.shared_quizzes sq
    where sq.id = p_shared_quiz_id and sq.creator_id = auth.uid()
  ) then
    raise exception 'permission denied: only creator can create a session for this quiz'
      using errcode = '42501';
  end if;

  if p_class_id is not null and not exists (
    select 1 from public.classes c where c.id = p_class_id and c.owner_id = auth.uid()
  ) then
    raise exception 'permission denied: cette classe ne vous appartient pas' using errcode = '42501';
  end if;

  insert into public.quiz_sessions (shared_quiz_id, status, class_id)
  values (p_shared_quiz_id, 'waiting', p_class_id)
  returning * into v_session;

  return v_session;
end;
$$;

revoke all on function public.create_quiz_session(uuid, uuid) from public, anon;
grant execute on function public.create_quiz_session(uuid, uuid) to authenticated, service_role;

-- ---------- 4. Agrégats ----------
-- Une réponse par élève et par question (contrainte unique) : le score d'un élève = bonnes réponses / nombre de questions.
create or replace function public.class_sessions_summary(p_class_id uuid)
returns table (
  session_id uuid,
  shared_quiz_id uuid,
  quiz_title text,
  status text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz,
  question_count integer,
  participants integer,
  answers integer,
  avg_score_pct numeric,
  completion_pct numeric
)
language sql
stable
set search_path = public, pg_temp
as $$
  with sess as (
    select qs.id, qs.shared_quiz_id, sq.title, qs.status, qs.started_at, qs.completed_at, qs.created_at,
           coalesce(jsonb_array_length(sq.questions), 0) as qn
    from public.quiz_sessions qs
    join public.shared_quizzes sq on sq.id = qs.shared_quiz_id
    where qs.class_id = p_class_id
      and exists (select 1 from public.classes c where c.id = p_class_id and c.owner_id = auth.uid())
  ),
  per as (
    select s.id as session_id, sp.id as participant_id,
           count(la.question_index) as answered,
           count(*) filter (where la.is_correct) as correct
    from sess s
    join public.session_participants sp on sp.session_id = s.id
    left join public.live_answers la on la.participant_id = sp.id and la.session_id = s.id
    group by s.id, sp.id
  )
  select s.id, s.shared_quiz_id, s.title, s.status, s.started_at, s.completed_at, s.created_at, s.qn,
         count(p.participant_id)::integer,
         coalesce(sum(p.answered), 0)::integer,
         case when count(p.participant_id) = 0 or s.qn = 0 then 0
              else round(avg(p.correct::numeric / s.qn * 100), 1) end,
         case when count(p.participant_id) = 0 or s.qn = 0 then 0
              else round(avg(p.answered::numeric / s.qn * 100), 1) end
  from sess s
  left join per p on p.session_id = s.id
  group by s.id, s.shared_quiz_id, s.title, s.status, s.started_at, s.completed_at, s.created_at, s.qn
  order by coalesce(s.started_at, s.created_at) desc;
$$;

create or replace function public.class_question_stats(p_class_id uuid, p_session_id uuid)
returns table (
  question_index integer,
  question text,
  answers integer,
  correct integer,
  success_pct numeric
)
language sql
stable
set search_path = public, pg_temp
as $$
  select (q.ord - 1)::integer,
         q.elem ->> 'question',
         count(la.id)::integer,
         (count(la.id) filter (where la.is_correct))::integer,
         case when count(la.id) = 0 then null
              else round((count(la.id) filter (where la.is_correct))::numeric / count(la.id) * 100, 1) end
  from public.quiz_sessions qs
  join public.shared_quizzes sq on sq.id = qs.shared_quiz_id
  cross join lateral jsonb_array_elements(sq.questions) with ordinality as q(elem, ord)
  left join public.live_answers la on la.session_id = qs.id and la.question_index = q.ord - 1
  where qs.id = p_session_id
    and qs.class_id = p_class_id
    and exists (select 1 from public.classes c where c.id = p_class_id and c.owner_id = auth.uid())
  group by q.ord, q.elem
  order by q.ord;
$$;

create or replace function public.class_students_progress(p_class_id uuid)
returns table (
  nickname text,
  sessions_count integer,
  avg_score_pct numeric,
  last_session_at timestamptz,
  scores jsonb
)
language sql
stable
set search_path = public, pg_temp
as $$
  with sess as (
    select qs.id, coalesce(qs.started_at, qs.created_at) as sort_at,
           coalesce(jsonb_array_length(sq.questions), 0) as qn
    from public.quiz_sessions qs
    join public.shared_quizzes sq on sq.id = qs.shared_quiz_id
    where qs.class_id = p_class_id
      and exists (select 1 from public.classes c where c.id = p_class_id and c.owner_id = auth.uid())
  ),
  per as (
    select s.id as session_id, s.sort_at, s.qn,
           lower(btrim(sp.nickname)) as student_key, sp.nickname,
           count(la.question_index) as answered,
           count(*) filter (where la.is_correct) as correct
    from sess s
    join public.session_participants sp on sp.session_id = s.id
    left join public.live_answers la on la.participant_id = sp.id and la.session_id = s.id
    group by s.id, s.sort_at, s.qn, sp.id, sp.nickname
  )
  select min(p.nickname),
         count(*)::integer,
         round(avg(case when p.qn > 0 then p.correct::numeric / p.qn * 100 end), 1),
         max(p.sort_at),
         jsonb_agg(
           jsonb_build_object(
             'session_id', p.session_id,
             'score_pct', case when p.qn > 0 then round(p.correct::numeric / p.qn * 100) end,
             'answered', p.answered
           ) order by p.sort_at
         )
  from per p
  group by p.student_key
  order by avg(case when p.qn > 0 then p.correct::numeric / p.qn * 100 end) desc nulls last, min(p.nickname);
$$;

revoke all on function public.class_sessions_summary(uuid) from public, anon;
revoke all on function public.class_question_stats(uuid, uuid) from public, anon;
revoke all on function public.class_students_progress(uuid) from public, anon;
grant execute on function public.class_sessions_summary(uuid) to authenticated, service_role;
grant execute on function public.class_question_stats(uuid, uuid) to authenticated, service_role;
grant execute on function public.class_students_progress(uuid) to authenticated, service_role;
