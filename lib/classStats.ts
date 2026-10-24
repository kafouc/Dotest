import type { ClassSessionSummary, QuestionStat, StudentProgress } from '@/lib/classes';

/** Calculs d'affichage de l'espace enseignant (fonctions pures). */

/** Séances triées de la plus ancienne à la plus récente (ordre des colonnes de la matrice et des courbes). */
export function chronological(sessions: ClassSessionSummary[]): ClassSessionSummary[] {
  return [...sessions].sort(
    (a, b) => new Date(a.started_at ?? a.created_at).getTime() - new Date(b.started_at ?? b.created_at).getTime()
  );
}

export type MatrixRow = { nickname: string; avg: number | null; cells: (number | null)[] };

/** Lignes élèves × colonnes séances (null = absent de la séance). */
export function buildStudentMatrix(students: StudentProgress[], sessions: ClassSessionSummary[]): { columns: ClassSessionSummary[]; rows: MatrixRow[] } {
  const columns = chronological(sessions);
  const rows = students.map((student) => {
    const byId = new Map(student.scores.map((s) => [s.session_id, s.score_pct]));
    return {
      nickname: student.nickname,
      avg: student.avg_score_pct,
      cells: columns.map((column) => (byId.has(column.session_id) ? byId.get(column.session_id) ?? null : null)),
    };
  });
  return { columns, rows };
}

export type Trend = { direction: 'up' | 'down' | 'flat' | 'none'; delta: number };

/** Évolution entre l'avant-dernière et la dernière séance où l'élève était présent (moins de 3 points : stable). */
export function studentTrend(student: Pick<StudentProgress, 'scores'>): Trend {
  const scores = student.scores.map((s) => s.score_pct).filter((v): v is number => v !== null);
  if (scores.length < 2) return { direction: 'none', delta: 0 };
  const delta = Math.round(scores[scores.length - 1] - scores[scores.length - 2]);
  if (Math.abs(delta) < 3) return { direction: 'flat', delta };
  return { direction: delta > 0 ? 'up' : 'down', delta };
}

/** Élèves à accompagner : moyenne sous le seuil, ou baisse nette à la dernière séance (au moins 10 points). */
export function studentsNeedingHelp(students: StudentProgress[], threshold = 50): StudentProgress[] {
  return students.filter((student) => {
    if (student.avg_score_pct !== null && student.avg_score_pct < threshold) return true;
    const trend = studentTrend(student);
    return trend.direction === 'down' && trend.delta <= -10;
  });
}

export type SessionComparison = {
  participants: number;
  avgScore: number;
  completion: number;
  sameQuiz: boolean;
};

/** Écarts de la séance B par rapport à la séance A (positif = B fait mieux). */
export function compareSessions(a: ClassSessionSummary, b: ClassSessionSummary): SessionComparison {
  return {
    participants: b.participants - a.participants,
    avgScore: Number((b.avg_score_pct - a.avg_score_pct).toFixed(1)),
    completion: Number((b.completion_pct - a.completion_pct).toFixed(1)),
    sameQuiz: a.shared_quiz_id === b.shared_quiz_id,
  };
}

export type AlignedQuestion = { index: number; question: string; a: number | null; b: number | null; delta: number | null };

/** Question par question, quand les deux séances utilisent le même quiz. */
export function alignQuestionStats(a: QuestionStat[], b: QuestionStat[]): AlignedQuestion[] {
  const byIndex = new Map(b.map((q) => [q.question_index, q]));
  return a.map((qa) => {
    const qb = byIndex.get(qa.question_index);
    const pa = qa.success_pct;
    const pb = qb?.success_pct ?? null;
    return {
      index: qa.question_index,
      question: qa.question,
      a: pa,
      b: pb,
      delta: pa !== null && pb !== null ? Number((pb - pa).toFixed(1)) : null,
    };
  });
}

/** Questions les plus ratées d'une séance (au moins 3 réponses), de la plus difficile à la moins difficile. */
export function hardestQuestions(stats: QuestionStat[], limit = 3): QuestionStat[] {
  return stats
    .filter((q) => q.answers >= 3 && q.success_pct !== null)
    .sort((x, y) => (x.success_pct as number) - (y.success_pct as number))
    .slice(0, limit);
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${Math.round(value)} %`;
}

export function formatDelta(value: number | null | undefined, unit = 'pts'): string {
  if (value === null || value === undefined) return '—';
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return `= 0 ${unit}`;
  return `${rounded > 0 ? '+' : ''}${rounded} ${unit}`;
}
