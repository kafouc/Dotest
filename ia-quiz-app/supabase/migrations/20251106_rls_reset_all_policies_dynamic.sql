-- Drop dynamique de TOUTES les policies sur quiz_sessions puis policy ouverte
-- Utiliser pour forcer la disparition de 42P17 puis réappliquer rls_reset_all.sql

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname='public' and tablename='quiz_sessions'
  loop
    execute format('drop policy %I on public.quiz_sessions', pol.policyname);
  end loop;

  create policy qs_debug_public_select
    on public.quiz_sessions for select
    using (true);
end $$;
