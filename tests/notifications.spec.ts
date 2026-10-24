import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildNotification, isValidTimeZone } from '@/lib/notifications';
import { sanitizePrefsChange } from '@/lib/notificationPrefs';
import { STRIPE_WEBHOOK_EVENTS } from '@/lib/billing';

describe('contenu des notifications', () => {
  it('bienvenue : annonce les trois rappels et renvoie vers les réglages', () => {
    const n = buildNotification('welcome');
    expect(n.title).toContain('Bienvenue');
    expect(n.body).toMatch(/matin.*midi.*soir/);
    expect(n.url).toBe('/settings');
  });

  it('matin : compte les cartes, mentionne la série, renvoie vers la révision', () => {
    const n = buildNotification('morning', { dueCount: 4, newCount: 2, currentStreak: 3 });
    expect(n.body).toContain('6 cartes vous attendent');
    expect(n.body).toContain('3 jours');
    expect(n.url).toBe('/review');
  });

  it('matin : accorde le singulier et propose l’application quand il n’y a aucune carte', () => {
    expect(buildNotification('morning', { dueCount: 1 }).body).toContain('1 carte vous attend');
    const empty = buildNotification('morning', { currentStreak: 1 });
    expect(empty.url).toBe('/app');
    expect(empty.body).toContain('1 jour');
  });

  it('révision espacée : nombre de cartes et part tirée des erreurs de quiz', () => {
    const n = buildNotification('spaced', { dueCount: 5, quizErrorDue: 2 });
    expect(n.body).toContain('5 cartes à revoir');
    expect(n.body).toContain('Dont 2 tirées de vos erreurs de quiz');
    expect(n.url).toBe('/review');
    expect(buildNotification('spaced', { dueCount: 3 }).body).not.toContain('erreurs');
  });

  it('soir : met la série en jeu, ou invite simplement à réviser', () => {
    expect(buildNotification('evening', { currentStreak: 4 }).body).toContain('5ᵉ jour');
    expect(buildNotification('evening', { currentStreak: 4 }).title).toContain('série');
    expect(buildNotification('evening', {}).title).toContain('avant de dormir');
  });

  it('chaque type a sa propre étiquette (le suivant remplace le précédent du même type)', () => {
    const tags = (['welcome', 'morning', 'spaced', 'evening', 'test'] as const).map((k) => buildNotification(k).tag);
    expect(new Set(tags).size).toBe(5);
    expect(buildNotification('morning').icon).toBe('/icons/icon-192x192.png');
  });
});

describe('fuseaux horaires et préférences', () => {
  it('accepte uniquement les fuseaux IANA valides', () => {
    expect(isValidTimeZone('Europe/Paris')).toBe(true);
    expect(isValidTimeZone('America/Martinique')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(42)).toBe(false);
    expect(isValidTimeZone('x'.repeat(100))).toBe(false);
  });

  it('ne laisse passer que des heures cohérentes (matin 6-10 h, soir 18-22 h) et des booléens', () => {
    expect(sanitizePrefsChange({ morning_hour: 7, evening_hour: 21, notify_spaced: false })).toEqual({ morning_hour: 7, evening_hour: 21, notify_spaced: false });
    expect(sanitizePrefsChange({ morning_hour: 3, evening_hour: 12 })).toEqual({});
    expect(sanitizePrefsChange({ notify_morning: 'oui' as never, timezone: 'Mars/Olympus' })).toEqual({});
  });
});

describe('événements Stripe', () => {
  it('le script de vérification lit la même liste que le code', () => {
    const script = readFileSync('scripts/stripe-webhook-events.mjs', 'utf8');
    expect(script).toContain('STRIPE_WEBHOOK_EVENTS');
    const source = readFileSync('lib/billing.ts', 'utf8');
    const block = source.match(/STRIPE_WEBHOOK_EVENTS = \[([\s\S]*?)\] as const/)?.[1] ?? '';
    expect([...block.matchAll(/'([a-z_.]+)'/g)].map((m) => m[1])).toEqual([...STRIPE_WEBHOOK_EVENTS]);
  });

  it('couvre tous les types d’événements traités par le webhook', () => {
    const source = readFileSync('lib/billing.ts', 'utf8');
    const handled = new Set([...source.matchAll(/event\.type === '([a-z_.]+)'/g)].map((m) => m[1]));
    for (const type of handled) expect(STRIPE_WEBHOOK_EVENTS as readonly string[]).toContain(type);
    expect(handled.size).toBeGreaterThanOrEqual(6);
  });
});
