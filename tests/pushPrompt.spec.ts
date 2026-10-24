import { describe, expect, it } from 'vitest';
import { derivePushPromptState, isIosDevice, type PushPromptInput } from '@/lib/pushPrompt';
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps';

const base: PushPromptInput = {
  supported: true, permission: 'default', subscribed: false, snoozedUntil: 0, now: 1_000_000,
  ios: false, standalone: false, hasContent: true,
};

describe('invitation « Activer les rappels »', () => {
  it('propose le bouton quand tout est réuni', () => {
    expect(derivePushPromptState(base)).toBe('show');
  });

  it('attend que l’utilisateur ait du contenu (pas de demande à un compte vide)', () => {
    expect(derivePushPromptState({ ...base, hasContent: false })).toBe('hidden');
  });

  it('ne s’affiche plus une fois activée, refusée dans le navigateur, ou repoussée', () => {
    expect(derivePushPromptState({ ...base, subscribed: true })).toBe('hidden');
    expect(derivePushPromptState({ ...base, permission: 'denied' })).toBe('hidden');
    expect(derivePushPromptState({ ...base, snoozedUntil: base.now + 1 })).toBe('hidden');
    expect(derivePushPromptState({ ...base, snoozedUntil: base.now - 1 })).toBe('show');
  });

  it('iPhone hors application installée : explique d’abord comment installer', () => {
    expect(derivePushPromptState({ ...base, ios: true, standalone: false, supported: false, permission: 'unsupported' })).toBe('ios-install');
    // Installée : les notifications existent, on propose le bouton
    expect(derivePushPromptState({ ...base, ios: true, standalone: true })).toBe('show');
  });

  it('navigateur sans notifications : rien à proposer', () => {
    expect(derivePushPromptState({ ...base, supported: false, permission: 'unsupported' })).toBe('hidden');
  });

  it('reconnaît iPhone, iPad et iPadOS (qui se présente comme un Mac)', () => {
    expect(isIosDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X)')).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIosDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIosDevice('Mozilla/5.0 (Linux; Android 14; Pixel 7)')).toBe(false);
  });
});

describe('étapes du tutoriel', () => {
  it('commence par une introduction, finit par une conclusion et garde des identifiants uniques', () => {
    expect(TUTORIAL_STEPS[0].id).toBe('intro');
    expect(TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1].id).toBe('final');
    expect(new Set(TUTORIAL_STEPS.map((s) => s.id)).size).toBe(TUTORIAL_STEPS.length);
  });

  it('numérote les étapes de 1 à N sans trou, et chaque étape a un titre, un texte et des points clés', () => {
    const labels = TUTORIAL_STEPS.map((s) => s.label).filter(Boolean);
    expect(labels).toEqual(labels.map((_, i) => String(i + 1)));
    for (const step of TUTORIAL_STEPS) {
      expect(step.title.length).toBeGreaterThan(5);
      expect(step.lead.length).toBeGreaterThan(30);
      expect(step.bullets.length).toBeGreaterThan(0);
    }
  });

  it('chaque étape interactive dit à l’utilisateur quoi essayer', () => {
    for (const id of ['upload', 'generate', 'quiz', 'review', 'teacher', 'mobile'] as const) {
      expect(TUTORIAL_STEPS.find((s) => s.id === id)?.tryIt).toBeTruthy();
    }
  });
});
