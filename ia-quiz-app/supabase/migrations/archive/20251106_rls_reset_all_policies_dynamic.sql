-- ARCHIVE: Drop dynamique de toutes les policies quiz_sessions pour diagnostiquer 42P17
-- Conserver uniquement comme référence historique. Ne pas exécuter en production.

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
