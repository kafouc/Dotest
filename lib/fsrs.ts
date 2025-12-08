/**
 * FSRS-inspired spaced repetition scheduler
 * Minimal, modernized approximation for Sheet of Paper
 * Computes Stability (S), Interval (I), and Retrievability (R)
 * References: https://github.com/open-spaced-repetition/fsrs4anki
 */

export type Rating = 0 | 1 | 2 | 3 | 4; // 0=Again, 1=Hard, 2=Good, 3=Easy, 4=Perfect

export type CardState = {
  stability: number; // days
  difficulty: number; // 1..10
  interval: number; // days
  lastReviewed: string; // ISO
};

export type ScheduleResult = {
  nextIntervalDays: number;
  nextReviewAt: string; // ISO
  newStability: number;
  newDifficulty: number;
  retrievabilityNow: number; // 0..1
};

const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

/**
 * Retrievability R(t) ≈ exp(-t / S)
 * Where t is elapsed days since last review, S is stability in days.
 */
export function retrievabilityAt(elapsedDays: number, stabilityDays: number): number {
  if (stabilityDays <= 0) return 0;
  const R = Math.exp(-elapsedDays / stabilityDays);
  return clamp(R, 0, 1);
}

/**
 * Update difficulty using rating.
 * Lower rating increases difficulty slightly, higher lowers it.
 */
function updateDifficulty(prev: number, rating: Rating): number {
  const delta = (2 - rating) * 0.2; // again->+0.4, perfect->-0.4
  return clamp(prev + delta, 1, 10);
}

/**
 * Update stability S using rating and current retrievability.
 * FSRS-inspired: multiplicative growth when recalled, shrink when failed.
 */
function updateStability(prevS: number, rating: Rating, R: number): number {
  if (prevS <= 0) prevS = 1; // seed
  if (rating === 0) {
    // Forgot: reduce stability depending on R
    const factor = 0.5 + 0.4 * R; // 0.5..0.9
    return clamp(prevS * factor, 0.5, 3650);
  }
  // Remembered: increase stability based on rating and current R
  const boost = 1 + (0.3 + 0.1 * rating) * (1 - R); // up to ~1.7
  return clamp(prevS * boost, 1, 3650);
}

/**
 * Compute next interval as a function of stability and difficulty.
 */
function nextIntervalDays(stability: number, difficulty: number): number {
  const base = stability; // target interval ~S
  const diffFactor = 1 - (difficulty - 5) * 0.05; // 5→1.0, 10→0.75, 1→1.2
  const interval = clamp(base * diffFactor, 1, 3650);
  // Round to sensible whole days
  return Math.round(interval);
}

/**
 * Schedule a card review after rating.
 */
export function scheduleReview(state: CardState, rating: Rating, now = new Date()): ScheduleResult {
  const last = new Date(state.lastReviewed);
  const elapsedMs = now.getTime() - last.getTime();
  const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24));

  const Rnow = retrievabilityAt(elapsedDays, state.stability);
  const newS = updateStability(state.stability, rating, Rnow);
  const newD = updateDifficulty(state.difficulty, rating);
  const intervalDays = nextIntervalDays(newS, newD);

  const next = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);

  return {
    nextIntervalDays: intervalDays,
    nextReviewAt: next.toISOString(),
    newStability: newS,
    newDifficulty: newD,
    retrievabilityNow: Rnow,
  };
}

/**
 * Compute current metrics R and whether S implies strong memory (R>0.9).
 */
export function getMetrics(state: CardState, now = new Date()): { R: number; S: number; strong: boolean } {
  const last = new Date(state.lastReviewed);
  const elapsedMs = now.getTime() - last.getTime();
  const elapsedDays = Math.max(0, elapsedMs / (1000 * 60 * 60 * 24));
  const R = retrievabilityAt(elapsedDays, state.stability);
  return { R, S: state.stability, strong: R > 0.9 };
}

/**
 * Initialize a new card state.
 */
export function initCardState(now = new Date()): CardState {
  return {
    stability: 1,
    difficulty: 5,
    interval: 1,
    lastReviewed: now.toISOString(),
  };
}
