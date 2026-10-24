import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// À lancer avec SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY (projet de dev de préférence).
const URL = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ready = Boolean(URL && ANON && SERVICE);

const opts = { auth: { autoRefreshToken: false, persistSession: false } };

describe.skipIf(!ready)('Sécurité : accès anonyme et utilisateur standard', () => {
  let anon: SupabaseClient;
  let user: SupabaseClient;
  let service: SupabaseClient;
  let userId: string;

  beforeAll(async () => {
    anon = createClient(URL!, ANON!, opts);
    service = createClient(URL!, SERVICE!, opts);
    const email = `security-${Date.now()}@example.test`;
    const password = 'Test-' + crypto.randomUUID();
    const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    userId = data.user.id;
    user = createClient(URL!, ANON!, opts);
    const { error: signInErr } = await user.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
  });

  afterAll(async () => {
    if (service && userId) {
      await service.from('admin_users').delete().eq('user_id', userId);
      await service.auth.admin.deleteUser(userId);
    }
  });

  const serviceOnly = [
    ['set_user_plan', { p_user_id: '00000000-0000-0000-0000-000000000000', p_plan: 'pro', p_assigned_by: null }],
    ['get_or_create_stripe_customer', { p_user_id: '00000000-0000-0000-0000-000000000000', p_email: 'x@y.z' }],
    ['run_daily_metrics_aggregation', { p_target_date: null }],
    ['get_user_activity', { p_user_id: '00000000-0000-0000-0000-000000000000' }],
    ['get_realtime_stats', {}],
    ['count_connected_users', {}],
    ['cleanup_expired_sessions', {}],
    ['acquire_embedding_slot', { p_slot_key: 'security-test', p_min_interval_ms: 1 }],
  ] as const;

  it.each(serviceOnly)('RPC %s refusée à un visiteur anonyme', async (fn, args) => {
    const { error } = await anon.rpc(fn, args as Record<string, unknown>);
    expect(error).not.toBeNull();
  });

  it.each(serviceOnly)('RPC %s refusée à un utilisateur connecté standard', async (fn, args) => {
    const { error } = await user.rpc(fn, args as Record<string, unknown>);
    expect(error).not.toBeNull();
  });

  it('un utilisateur ne peut pas se déclarer administrateur', async () => {
    const { error } = await user.from('admin_users').insert({ user_id: userId });
    expect(error).not.toBeNull();
    const { data } = await service.from('admin_users').select('user_id').eq('user_id', userId);
    expect(data ?? []).toHaveLength(0);
  });

  it('les RPC admin refusent un utilisateur non administrateur', async () => {
    expect((await user.rpc('admin_list_user_activity')).error).not.toBeNull();
    expect((await user.rpc('get_recent_activities', { p_limit: 5, p_offset: 0 })).error).not.toBeNull();
    expect((await anon.rpc('admin_list_user_activity')).error).not.toBeNull();
  });

  it('un utilisateur ne peut pas modifier directement sa flamme (streak)', async () => {
    const { error } = await user.from('user_streaks').insert({ user_id: userId, current_streak: 999, longest_streak: 999 });
    expect(error).not.toBeNull();
  });

  it('un utilisateur ne peut pas se donner un plan payant', async () => {
    await user.from('user_plans').insert({ user_id: userId, plan: 'pro' });
    const { data } = await service.from('user_plans').select('plan').eq('user_id', userId).maybeSingle();
    expect(data?.plan ?? 'freemium').not.toBe('pro');
  });

  it('tables internes illisibles par un visiteur anonyme', async () => {
    for (const table of ['quiz_challenges', 'analytics_sessions', 'analytics_events', 'embedding_rate_limits', 'admin_users', 'billing_customers']) {
      const { data } = await anon.from(table).select('*').limit(1);
      expect(data ?? [], table).toHaveLength(0);
    }
  });

  it('un visiteur anonyme ne peut pas écrire dans les tables analytics', async () => {
    expect((await anon.from('analytics_sessions').insert({})).error).not.toBeNull();
    expect((await anon.from('analytics_events').insert({})).error).not.toBeNull();
  });
});
