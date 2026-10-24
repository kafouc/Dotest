/**
 * Journalisation minimale : une ligne JSON par événement côté serveur (filtrable dans les logs Vercel),
 * texte lisible côté navigateur. Les champs sensibles sont masqués avant écriture.
 * Niveau minimal : variable LOG_LEVEL (debug | info | warn | error), `info` par défaut.
 */
type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const REDACT = /(authorization|cookie|password|passwd|secret|token|api[-_]?key|email|embedding|content|signature)/i;

function minLevel(): number {
  const configured = (typeof process !== 'undefined' ? process.env?.LOG_LEVEL : undefined) as Level | undefined;
  return LEVELS[configured ?? 'info'] ?? LEVELS.info;
}

function redact(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > 4) return '[profondeur max]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACT.test(key) ? '[masqué]' : redact(val, depth + 1);
  }
  return out;
}

function serializeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack?.split('\n').slice(0, 6).join('\n'),
    ...(typeof (error as Error & { code?: unknown }).code === 'string' ? { code: (error as Error & { code: string }).code } : {}),
  };
}

function write(level: Level, message: string, extras: unknown[]): void {
  if (LEVELS[level] < minLevel()) return;

  const context: Record<string, unknown> = {};
  extras.forEach((extra, index) => {
    if (extra instanceof Error) context.error = serializeError(extra);
    else if (extra && typeof extra === 'object') Object.assign(context, redact(extra) as object);
    else if (extra !== undefined) context[`detail${index || ''}`] = String(extra).slice(0, 500);
  });

  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (typeof window === 'undefined') {
    sink(JSON.stringify({ level, time: new Date().toISOString(), message, ...context }));
  } else {
    sink(`[${level}] ${message}`, Object.keys(context).length ? context : '');
  }
}

export const logger = {
  debug: (message: string, ...extras: unknown[]) => write('debug', message, extras),
  info: (message: string, ...extras: unknown[]) => write('info', message, extras),
  warn: (message: string, ...extras: unknown[]) => write('warn', message, extras),
  error: (message: string, ...extras: unknown[]) => write('error', message, extras),
};
