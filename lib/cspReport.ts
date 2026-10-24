/** Résumé d'un rapport de violation CSP, sans données personnelles. */

type Violation = Record<string, unknown>;

/** Réduit un rapport (ancien format `csp-report` ou Reporting API) aux champs utiles et sans données personnelles. */
export function summarizeViolation(payload: unknown): Violation | null {
  const body = Array.isArray(payload) ? (payload[0] as { body?: Violation } | undefined)?.body : (payload as { 'csp-report'?: Violation } | null)?.['csp-report'];
  if (!body || typeof body !== 'object') return null;
  const pick = (...keys: string[]) => keys.map((k) => body[k]).find((v) => typeof v === 'string') as string | undefined;
  const strip = (url?: string) => (url ? url.split(/[?#]/)[0].slice(0, 200) : undefined);
  return {
    directive: pick('effective-directive', 'effectiveDirective', 'violated-directive', 'violatedDirective'),
    blocked: strip(pick('blocked-uri', 'blockedURL', 'blockedUri')),
    document: strip(pick('document-uri', 'documentURL', 'documentUri')),
    source: strip(pick('source-file', 'sourceFile')),
    line: body['line-number'] ?? body['lineNumber'],
  };
}
