import { describe, expect, it } from 'vitest';
import { summarizeViolation } from '@/lib/cspReport';
import { POST } from '@/app/api/csp-report/route';

describe('rapports CSP', () => {
  it('résume l’ancien format et retire paramètres et fragments d’URL (données personnelles possibles)', () => {
    const v = summarizeViolation({
      'csp-report': {
        'effective-directive': 'script-src-elem',
        'blocked-uri': 'https://tracker.example.com/t.js?uid=42#x',
        'document-uri': 'https://sheetofpaper.app/app?token=secret',
        'line-number': 12,
      },
    });
    expect(v).toMatchObject({ directive: 'script-src-elem', blocked: 'https://tracker.example.com/t.js', document: 'https://sheetofpaper.app/app', line: 12 });
    expect(JSON.stringify(v)).not.toContain('secret');
  });

  it('comprend le format de la Reporting API', () => {
    expect(summarizeViolation([{ type: 'csp-violation', body: { effectiveDirective: 'img-src', blockedURL: 'https://x.test/a.png' } }])).toMatchObject({ directive: 'img-src', blocked: 'https://x.test/a.png' });
  });

  it('ignore ce qui n’est pas un rapport', () => {
    expect(summarizeViolation(null)).toBeNull();
    expect(summarizeViolation({ autre: 1 })).toBeNull();
  });

  it('répond 204 sans rien exécuter, même pour un corps invalide ou trop gros', async () => {
    const send = (body: string) => POST(new Request('http://localhost/api/csp-report', { method: 'POST', body, headers: { 'x-forwarded-for': '1.2.3.4' } }));
    expect((await send('pas du json')).status).toBe(204);
    expect((await send('x'.repeat(20_000))).status).toBe(204);
    expect((await send(JSON.stringify({ 'csp-report': { 'blocked-uri': 'inline' } }))).status).toBe(204);
  });
});
