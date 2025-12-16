const STORAGE_KEY_PREFIX = 'sop-page-view:';
const SESSION_STORAGE_KEY = 'sop-session-id';

function getOrCreateSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

export async function trackPageView(route: string, metadata?: Record<string, unknown>): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const cacheKey = `${STORAGE_KEY_PREFIX}${route}`;
    if (window.sessionStorage.getItem(cacheKey)) {
      return;
    }
    window.sessionStorage.setItem(cacheKey, '1');
  } catch {
    // sessionStorage not accessible (private mode); continue without dedupe
  }

  const sessionId = getOrCreateSessionId();
  const payload = {
    route,
    sessionId,
    metadata: metadata ?? undefined,
    referrer: document.referrer || undefined,
    userAgent: navigator.userAgent || undefined,
  };

  const body = JSON.stringify(payload);

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/analytics/page-view', blob);
      if (sent) return;
    }
  } catch {
    // sendBeacon may throw; fallback to fetch
  }

  try {
    await fetch('/api/analytics/page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[trackPageView] échec envoi', error);
    }
  }
}
