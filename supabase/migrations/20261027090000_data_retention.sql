-- ============================================================
-- Conservation limitée des données (RGPD, principe de minimisation)
--
--   mesure d'audience (pages vues, sessions, événements analytiques) : 13 mois (durée maximale recommandée par la CNIL)
--   journaux d'activité, usage IA, événements d'export : 24 mois (les agrégats journaliers metrics_daily_* sont conservés)
--
-- Les quotas du forfait se calculent sur la semaine et le mois en cours : 24 mois d'historique suffisent largement.
-- ============================================================

create or replace function public.purge_old_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_page_views bigint;
  v_events bigint;
  v_sessions bigint;
  v_activity bigint;
  v_usage bigint;
  v_exports bigint;
begin
  delete from public.page_views where visited_at < now() - interval '13 months';
  get diagnostics v_page_views = row_count;

  delete from public.analytics_events where created_at < now() - interval '13 months';
  get diagnostics v_events = row_count;

  delete from public.analytics_sessions where started_at < now() - interval '13 months';
  get diagnostics v_sessions = row_count;

  delete from public.activity_events where occurred_at < now() - interval '24 months';
  get diagnostics v_activity = row_count;

  delete from public.metrics_ai_usage_events where occurred_at < now() - interval '24 months';
  get diagnostics v_usage = row_count;

  delete from public.export_events where created_at < now() - interval '24 months';
  get diagnostics v_exports = row_count;

  return jsonb_build_object(
    'page_views', v_page_views, 'analytics_events', v_events, 'analytics_sessions', v_sessions,
    'activity_events', v_activity, 'metrics_ai_usage_events', v_usage, 'export_events', v_exports
  );
end;
$$;

revoke all on function public.purge_old_analytics() from public, anon, authenticated;
grant execute on function public.purge_old_analytics() to service_role;

select cron.schedule('purge-old-analytics', '30 3 * * *', $job$select public.purge_old_analytics()$job$);
