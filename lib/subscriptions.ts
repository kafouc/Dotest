import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { logger } from './logger';

export type SubscriptionPlan = 'freemium' | 'partial' | 'pro';

export type UserPlan = {
  user_id: string;
  plan: SubscriptionPlan;
  assigned_at: string;
  updated_at: string;
  assigned_by: string | null;
  metadata: Record<string, unknown> | null;
};

export function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return value === 'freemium' || value === 'partial' || value === 'pro';
}

export async function fetchUserPlan(supabase: SupabaseClient): Promise<UserPlan | null> {
  const { data, error } = await supabase
    .from('user_plans')
    .select('*')
    .single();

  if (error) {
    // PGRST116: no rows, PGRST205: table not found - both silent
    if (error.code === 'PGRST116' || error.code === '406' || error.code === 'PGRST205') {
      return null;
    }
    logger.warn('[subscriptions] fetchUserPlan failed:', error);
    return null;
  }

  if (!data || !isSubscriptionPlan(data.plan)) {
    return null;
  }

  return {
    user_id: data.user_id,
    plan: data.plan,
    assigned_at: data.assigned_at,
    updated_at: data.updated_at,
    assigned_by: data.assigned_by ?? null,
    metadata: data.metadata ?? null,
  };
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  return getSupabaseAdmin('subscription-service');
}

export async function setUserPlanAdmin(
  userId: string,
  plan: SubscriptionPlan,
  assignedBy?: string | null,
): Promise<UserPlan | null> {
  const client = getSupabaseAdminClient();
  if (!client) return null;

  const { data, error } = await client.rpc('set_user_plan', {
    p_user_id: userId,
    p_plan: plan,
    p_assigned_by: assignedBy ?? null,
  });

  if (error) {
    logger.warn('[subscriptions] setUserPlanAdmin failed:', error);
    return null;
  }

  return data as UserPlan;
}
