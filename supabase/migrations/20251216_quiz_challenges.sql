-- Quiz challenges allow learners to share a finished quiz via sharable link
create table if not exists public.quiz_challenges (
  id uuid primary key default gen_random_uuid(),
  share_code text unique not null,
  quiz jsonb not null,
  score int not null,
  total int not null,
  author_name text,
  created_at timestamptz not null default now()
);

-- Reuse existing share code generator to guarantee uniqueness
create index if not exists idx_quiz_challenges_share_code on public.quiz_challenges (share_code);

create or replace function public.fn_quiz_challenges_set_code()
returns trigger
language plpgsql
as $$
declare
  new_code text;
  exists_code boolean;
begin
  if new.share_code is not null then
    return new;
  end if;

  loop
    new_code := public.generate_share_code();
    select exists(select 1 from public.quiz_challenges where share_code = new_code) into exists_code;
    exit when not exists_code;
  end loop;

  new.share_code := new_code;
  return new;
end;
$$;

drop trigger if exists trg_quiz_challenges_set_code on public.quiz_challenges;
create trigger trg_quiz_challenges_set_code
before insert on public.quiz_challenges
for each row execute function public.fn_quiz_challenges_set_code();

-- Grant select to anon for public access, insert/update limited to service role only via RPC/API
alter table public.quiz_challenges enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'quiz_challenges'
      and policyname = 'quiz_challenges_public_select'
  ) then
    create policy quiz_challenges_public_select
      on public.quiz_challenges
      for select
      using (true);
  end if;
end $$;

revoke all on public.quiz_challenges from public;
