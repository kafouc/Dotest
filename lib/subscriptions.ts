import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

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
    if (error.code === 'PGRST116' || error.code === '406') {
      return null;
    }
    console.warn('[subscriptions] fetchUserPlan failed:', error);
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
  if (typeof window !== 'undefined') {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.warn('[subscriptions] missing Supabase admin credentials');
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'subscription-service',
      },
    },
  });
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
    console.warn('[subscriptions] setUserPlanAdmin failed:', error);
    return null;
  }

  return data as UserPlan;
}
