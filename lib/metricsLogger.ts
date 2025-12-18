import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let adminClient: SupabaseClient | null = null;
let adminInitAttempted = false;

function getAdminClient(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    return null;
  }
  if (adminClient) {
    return adminClient;
  }
  if (adminInitAttempted) {
    return null;
  }
  adminInitAttempted = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.warn('[metricsLogger] Supabase admin credentials manquants (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
    return null;
  }

  adminClient = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        'X-Client-Info': 'metrics-logger',
      },
    },
  });

  return adminClient;
}

export type PageViewEvent = {
  route: string;
  sessionId?: string | null;
  userId?: string | null;
  referrer?: string | null;
  userAgent?: string | null;
  country?: string | null;
  ipHash?: string | null;
  occurredAt?: Date | string | null;
  metadata?: Record<string, unknown> | null;
};

export type AiUsageEvent = {
  provider: string;
  model: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  cost?: number | null;
  metadata?: Record<string, unknown> | null;
  userId?: string | null;
  occurredAt?: Date | string | null;
};

const clampText = (value: string | null | undefined, maxLength = 500) => {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
};

export async function logPageView(event: PageViewEvent): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  const occurredAt = event.occurredAt instanceof Date
    ? event.occurredAt.toISOString()
    : event.occurredAt ?? new Date().toISOString();

  try {
    await client.from('page_views').insert({
      route: event.route,
      session_id: event.sessionId ?? null,
      user_id: event.userId ?? null,
      visited_at: occurredAt,
      referrer: clampText(event.referrer),
      user_agent: clampText(event.userAgent, 800),
      country: clampText(event.country, 8),
      ip_hash: event.ipHash ?? null,
      metadata: event.metadata ?? null,
    });
  } catch (error) {
    console.warn('[metricsLogger] Échec insertion page_view:', error);
  }
}

export async function recordAiUsage(event: AiUsageEvent): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  const occurredAt = event.occurredAt instanceof Date
    ? event.occurredAt.toISOString()
    : event.occurredAt ?? new Date().toISOString();

  const promptTokens = Number(event.promptTokens ?? 0) || 0;
  const completionTokens = Number(event.completionTokens ?? 0) || 0;
  const totalTokens = Number(
    event.totalTokens ?? promptTokens + completionTokens
  ) || 0;

  try {
    await client.from('metrics_ai_usage_events').insert({
      provider: event.provider,
      model: event.model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      latency_ms: event.latencyMs ?? null,
      cost: event.cost ?? null,
      metadata: event.metadata ?? null,
      user_id: event.userId ?? null,
      occurred_at: occurredAt,
    });
  } catch (error) {
    console.warn('[metricsLogger] Échec insertion metrics_ai_usage_events:', error);
  }
}

export type ActivityEvent = {
  eventType: string;
  userId?: string | null;
  eventData?: Record<string, unknown> | null;
  occurredAt?: Date | string | null;
};

export async function logActivity(event: ActivityEvent): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  const occurredAt = event.occurredAt instanceof Date
    ? event.occurredAt.toISOString()
    : event.occurredAt ?? new Date().toISOString();

  try {
    await client.from('activity_events').insert({
      event_type: event.eventType,
      user_id: event.userId ?? null,
      event_data: event.eventData ?? null,
      occurred_at: occurredAt,
    });
  } catch (error) {
    console.warn('[metricsLogger] Échec insertion activity_events:', error);
  }
}

export async function runDailyAggregation(targetDate?: string | Date): Promise<void> {
  const client = getAdminClient();
  if (!client) return;

  const pTargetDate = targetDate
    ? (targetDate instanceof Date ? targetDate.toISOString().slice(0, 10) : targetDate)
    : null;

  try {
    await client.rpc('run_daily_metrics_aggregation', {
      p_target_date: pTargetDate,
    });
  } catch (error) {
    console.warn('[metricsLogger] Échec exécution run_daily_metrics_aggregation:', error);
  }
}
