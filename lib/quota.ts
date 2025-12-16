import type { SupabaseClient } from '@supabase/supabase-js';
import { PLAN_LIMITS } from './constants';
import { fetchUserPlan, type SubscriptionPlan } from './subscriptions';
import { countExportEvents } from './exportEvents';

const MS_IN_DAY = 86_400_000;
const WEEK_WINDOW_MS = 7 * MS_IN_DAY;
const MONTH_WINDOW_MS = 30 * MS_IN_DAY;

export type QuotaErrorCode =
  | 'revision-weekly-limit'
  | 'revision-monthly-limit'
  | 'quiz-weekly-limit'
  | 'quiz-monthly-limit'
  | 'live-participants-limit';

export class QuotaError extends Error {
  code: QuotaErrorCode;
  constructor(code: QuotaErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function resolvePlan(plan: SubscriptionPlan | null | undefined): SubscriptionPlan {
  if (plan === 'partial' || plan === 'pro') return plan;
  return 'freemium';
}

function toISOString(date: Date): string {
  return date.toISOString();
}

function monthlyLimit(plan: SubscriptionPlan, kind: 'quiz' | 'summary'): number | null {
  const limits = PLAN_LIMITS[plan];
  if (!limits) return null;
  if (kind === 'quiz') return limits.quizMonthlyCap as number | null;
  return limits.revisionMonthlyCap as number | null;
}

export async function ensureRevisionQuota(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const planRow = await fetchUserPlan(supabase);
  const plan = resolvePlan(planRow?.plan as SubscriptionPlan | null);
  const limits = PLAN_LIMITS[plan];
  if (!limits) return;

  const sinceWeek = toISOString(new Date(Date.now() - WEEK_WINDOW_MS));
  const weeklyCount = await countExportEvents(supabase, {
    userId,
    kind: 'summary_export',
    since: sinceWeek,
  });
  if (weeklyCount >= limits.revisionDocsPerWeek) {
    throw new QuotaError('revision-weekly-limit', 'Quota de fiches de révision hebdomadaire atteint.');
  }

  const monthlyCap = monthlyLimit(plan, 'summary');
  if (monthlyCap != null) {
    const sinceMonth = toISOString(new Date(Date.now() - MONTH_WINDOW_MS));
    const monthlyCount = await countExportEvents(supabase, {
      userId,
      kind: 'summary_export',
      since: sinceMonth,
    });
    if (monthlyCount >= monthlyCap) {
      throw new QuotaError('revision-monthly-limit', 'Quota mensuel de fiches de révision atteint.');
    }
  }
}

export async function ensureQuizQuota(
  supabase: SupabaseClient,
  userId: string,
  documentPath: string | null,
): Promise<void> {
  const planRow = await fetchUserPlan(supabase);
  const plan = resolvePlan(planRow?.plan as SubscriptionPlan | null);
  const limits = PLAN_LIMITS[plan];
  if (!limits) return;

  const sinceWeek = toISOString(new Date(Date.now() - WEEK_WINDOW_MS));
  const weeklyPerDoc = await countExportEvents(supabase, {
    userId,
    kind: 'quiz_export',
    since: sinceWeek,
    documentPath: documentPath ?? undefined,
  });
  if (weeklyPerDoc >= limits.quizPerDocumentPerWeek) {
    throw new QuotaError('quiz-weekly-limit', 'Quota hebdomadaire de quiz pour ce document atteint.');
  }

  const monthlyCap = monthlyLimit(plan, 'quiz');
  if (monthlyCap != null) {
    const sinceMonth = toISOString(new Date(Date.now() - MONTH_WINDOW_MS));
    const monthlyCount = await countExportEvents(supabase, {
      userId,
      kind: 'quiz_export',
      since: sinceMonth,
    });
    if (monthlyCount >= monthlyCap) {
      throw new QuotaError('quiz-monthly-limit', 'Quota mensuel de quiz atteint.');
    }
  }
}

export async function validateLiveParticipants(
  supabase: SupabaseClient,
  userId: string,
  desiredParticipants: number,
): Promise<void> {
  const planRow = await fetchUserPlan(supabase);
  const plan = resolvePlan(planRow?.plan as SubscriptionPlan | null);
  const limits = PLAN_LIMITS[plan];
  if (!limits) return;

  if (desiredParticipants > limits.liveParticipants) {
    throw new QuotaError('live-participants-limit', 'Nombre de participants live au-delà de votre plan.');
  }
}
