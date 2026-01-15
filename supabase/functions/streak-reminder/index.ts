import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush, { type PushSubscription } from "npm:web-push@3";

const DEFAULT_TIMEZONE = "Europe/Paris";
const WINDOW_SEQUENCE = ["morning", "midday", "evening"] as const;

type ReminderWindow = typeof WINDOW_SEQUENCE[number];

type StreakRow = {
  user_id: string;
  current_streak: number | null;
  last_active_date: string | null;
  reminders_sent_today: number | null;
  last_reminder_day: string | null;
  last_reminder_window: ReminderWindow | null;
  timezone: string | null;
};

type SubscriptionRow = {
  user_id: string;
  endpoint: string | null;
  keys: { p256dh?: string | null; auth?: string | null } | null;
};

type ReminderCandidate = {
  userId: string;
  timezone: string;
  today: string;
  currentStreak: number;
  remindersSentToday: number;
};

type NotificationCopy = {
  title: string;
  body: string;
  url: string;
};

const WINDOW_COPY: Record<ReminderWindow, (current: number) => NotificationCopy> = {
  morning: (current) => ({
    title: "🔥 Ta flamme t'attend !",
    body: current > 0
      ? `Tu es à ${current} jour${current > 1 ? 's' : ''} de suite. Commence ta révision pour garder la flamme.`
      : "Débute ta série aujourd'hui avec une session de révision rapide !",
    url: "/app",
  }),
  midday: (current) => ({
    title: "🔥 Pause révision ?",
    body: current > 0
      ? `Ta flamme est à ${current} jour${current > 1 ? 's' : ''}. Une session maintenant et c'est gagné !`
      : "Profite de la pause de midi pour lancer ta première révision." ,
    url: "/app",
  }),
  evening: (current) => ({
    title: "🔥 Dernière chance pour garder ta flamme",
    body: current > 0
      ? `Encore un petit effort pour valider ton ${current + 1}ᵉ jour !`
      : "Pas encore de révision aujourd'hui. Lance-toi maintenant pour allumer ta flamme !",
    url: "/app",
  }),
};

function formatDateInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function hourInTimezone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hourPart = parts.find((p) => p.type === "hour");
  return hourPart ? Number.parseInt(hourPart.value, 10) : date.getUTCHours();
}

function inferWindow(timeZone: string, date: Date): ReminderWindow {
  const hour = hourInTimezone(date, timeZone);
  if (hour < 12) return "morning";
  if (hour < 18) return "midday";
  return "evening";
}

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const secret = Deno.env.get("STREAK_REMINDER_SECRET");
  if (secret) {
    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    if (authHeader !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublic = Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return new Response("Missing Supabase configuration", { status: 500 });
  }
  if (!vapidPublic || !vapidPrivate) {
    return new Response("Missing VAPID keys", { status: 500 });
  }

  webpush.setVapidDetails("mailto:support@sheetofpaper.app", vapidPublic, vapidPrivate);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const now = new Date();
    const url = new URL(req.url);
    const windowParam = (url.searchParams.get("window") || "").toLowerCase();
    const fallbackWindow = inferWindow(DEFAULT_TIMEZONE, now);
    const reminderWindow = WINDOW_SEQUENCE.includes(windowParam as ReminderWindow)
      ? (windowParam as ReminderWindow)
      : fallbackWindow;
    const targetIndex = WINDOW_SEQUENCE.indexOf(reminderWindow);

    const { data: streakRows, error: streakError } = await supabase
      .from("user_streaks")
      .select("user_id, current_streak, last_active_date, reminders_sent_today, last_reminder_day, last_reminder_window, timezone, should_notify")
      .eq("should_notify", true);

    if (streakError) {
      throw new Error(`Failed to load user_streaks: ${streakError.message}`);
    }

    const candidates: ReminderCandidate[] = [];
    for (const row of (streakRows ?? []) as (StreakRow & { should_notify: boolean })[]) {
      const tz = row.timezone || DEFAULT_TIMEZONE;
      const today = formatDateInTimezone(now, tz);
      const lastActive = row.last_active_date;
      if (lastActive === today) continue;

      const lastReminderDay = row.last_reminder_day ?? null;
      const remindersToday = lastReminderDay === today ? (row.reminders_sent_today ?? 0) : 0;
      if (remindersToday >= WINDOW_SEQUENCE.length) continue;
      if (lastReminderDay === today && row.last_reminder_window === reminderWindow) continue;
      if (remindersToday >= targetIndex + 1) continue;

      candidates.push({
        userId: row.user_id,
        timezone: tz,
        today,
        currentStreak: row.current_streak ?? 0,
        remindersSentToday: remindersToday,
      });
    }

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ window: reminderWindow, attempted: 0, sent: 0, message: "No users require reminders" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const userIds = candidates.map((c) => c.userId);
    const { data: subscriptionRows, error: subscriptionError } = await supabase
      .from("push_subscriptions")
      .select("user_id, endpoint, keys")
      .in("user_id", userIds);

    if (subscriptionError) {
      throw new Error(`Failed to load push_subscriptions: ${subscriptionError.message}`);
    }

    const subscriptions = new Map<string, SubscriptionRow[]>();
    for (const sub of subscriptionRows ?? []) {
      const row = sub as SubscriptionRow;
      if (!subscriptions.has(row.user_id)) {
        subscriptions.set(row.user_id, []);
      }
      subscriptions.get(row.user_id)!.push(row);
    }

    const results = {
      window: reminderWindow,
      attempted: candidates.length,
      sent: 0,
      skippedNoSubscription: 0,
      errors: [] as string[],
    };

    for (const candidate of candidates) {
      const userSubscriptions = subscriptions.get(candidate.userId) ?? [];
      if (userSubscriptions.length === 0) {
        results.skippedNoSubscription += 1;
        continue;
      }

      const notification = WINDOW_COPY[reminderWindow](candidate.currentStreak);
      const payload = JSON.stringify({
        title: notification.title,
        body: notification.body,
        icon: "/icons/icon-192x192.png",
        tag: `streak-${candidate.userId}`,
        url: notification.url,
        data: {
          url: notification.url,
          window: reminderWindow,
          streak: candidate.currentStreak,
        },
      });

      for (const subscriptionRow of userSubscriptions) {
        if (!subscriptionRow.endpoint || !subscriptionRow.keys?.p256dh || !subscriptionRow.keys?.auth) {
          continue;
        }

        const { p256dh, auth } = subscriptionRow.keys as { p256dh: string; auth: string };
        const pushSubscription: PushSubscription = {
          endpoint: subscriptionRow.endpoint,
          keys: {
            p256dh,
            auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload, {
            TTL: 60 * 60,
          });

          await supabase.rpc("mark_streak_reminder_sent", {
            p_user_id: candidate.userId,
            p_day: candidate.today,
            p_window: reminderWindow,
            p_sent_at: new Date().toISOString(),
          });

          results.sent += 1;
        } catch (error) {
          const status = typeof error === "object" && error && "statusCode" in error
            ? (error as { statusCode?: number }).statusCode
            : undefined;
          if (status === 410 || status === 404) {
            await supabase.from("push_subscriptions").delete().eq("endpoint", subscriptionRow.endpoint);
          }
          results.errors.push(`user ${candidate.userId}: ${(error as Error)?.message ?? "unknown error"}`);
        }
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("streak-reminder error", error);
    return new Response(JSON.stringify({ error: (error as Error)?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
