import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from '@/lib/logger';

afterEach(() => vi.restoreAllMocks());

describe('logger', () => {
  it('écrit une ligne JSON avec niveau et message, et masque les champs sensibles', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('démarrage', { route: 'quiz', email: 'a@b.fr', apiKey: 'sk_123', nested: { token: 'x', ok: 1 } });
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line).toMatchObject({ level: 'info', message: 'démarrage', route: 'quiz', email: '[masqué]', apiKey: '[masqué]' });
    expect(line.nested).toEqual({ token: '[masqué]', ok: 1 });
  });

  it("sérialise une erreur avec nom, message et pile tronquée", () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('échec', new Error('boom'));
    const line = JSON.parse(spy.mock.calls[0][0] as string);
    expect(line.error.name).toBe('Error');
    expect(line.error.message).toBe('boom');
    expect(line.error.stack.split('\n').length).toBeLessThanOrEqual(6);
  });

  it('ignore debug au niveau par défaut', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('bruit');
    expect(spy).not.toHaveBeenCalled();
  });
});
