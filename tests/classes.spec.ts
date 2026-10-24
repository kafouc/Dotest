import { describe, it, expect, vi } from 'vitest';
import {
  alignQuestionStats,
  buildStudentMatrix,
  chronological,
  compareSessions,
  formatDelta,
  formatPercent,
  hardestQuestions,
  studentTrend,
  studentsNeedingHelp,
} from '@/lib/classStats';
import {
  assignSessionToClass,
  getClassSessions,
  getStudentsProgress,
  isClassLimitError,
  isClassesUnavailable,
  listUnassignedSessions,
  type ClassSessionSummary,
  type QuestionStat,
  type StudentProgress,
} from '@/lib/classes';

const session = (id: string, date: string, over: Partial<ClassSessionSummary> = {}): ClassSessionSummary => ({
  session_id: id, shared_quiz_id: 'quiz-1', quiz_title: 'Combustion', status: 'completed',
  started_at: date, completed_at: null, created_at: date, question_count: 5,
  participants: 20, answers: 90, avg_score_pct: 60, completion_pct: 90, ...over,
});

const student = (nickname: string, avg: number | null, scores: [string, number | null][]): StudentProgress => ({
  nickname, sessions_count: scores.length, avg_score_pct: avg, last_session_at: null,
  scores: scores.map(([session_id, score_pct]) => ({ session_id, score_pct, answered: 5 })),
});

describe('statistiques de classe', () => {
  const s1 = session('s1', '2026-10-01T08:00:00Z');
  const s2 = session('s2', '2026-10-08T08:00:00Z', { avg_score_pct: 72, participants: 22, completion_pct: 95 });
  const s3 = session('s3', '2026-10-15T08:00:00Z', { shared_quiz_id: 'quiz-2', avg_score_pct: 55 });

  it('classe les séances de la plus ancienne à la plus récente', () => {
    expect(chronological([s3, s1, s2]).map((s) => s.session_id)).toEqual(['s1', 's2', 's3']);
  });

  it('construit la matrice élèves × séances, avec les absences à null', () => {
    const { columns, rows } = buildStudentMatrix(
      [student('Ana', 80, [['s1', 70], ['s3', 90]]), student('Bob', 40, [['s2', 40]])],
      [s3, s1, s2]
    );
    expect(columns.map((c) => c.session_id)).toEqual(['s1', 's2', 's3']);
    expect(rows[0].cells).toEqual([70, null, 90]);
    expect(rows[1].cells).toEqual([null, 40, null]);
  });

  it('calcule l’évolution d’un élève entre ses deux dernières séances', () => {
    expect(studentTrend(student('A', 70, [['s1', 50], ['s2', 70]]))).toEqual({ direction: 'up', delta: 20 });
    expect(studentTrend(student('A', 70, [['s1', 70], ['s2', 50]]))).toEqual({ direction: 'down', delta: -20 });
    expect(studentTrend(student('A', 70, [['s1', 70], ['s2', 71]])).direction).toBe('flat');
    expect(studentTrend(student('A', 70, [['s1', 70]])).direction).toBe('none');
    expect(studentTrend(student('A', 70, [['s1', null], ['s2', 60]])).direction).toBe('none');
  });

  it('repère les élèves à accompagner (moyenne basse ou baisse nette)', () => {
    const list = [
      student('Faible', 35, [['s1', 35]]),
      student('EnBaisse', 70, [['s1', 90], ['s2', 60]]),
      student('Stable', 75, [['s1', 74], ['s2', 76]]),
    ];
    expect(studentsNeedingHelp(list).map((s) => s.nickname)).toEqual(['Faible', 'EnBaisse']);
  });

  it('compare deux séances et détecte un quiz identique', () => {
    expect(compareSessions(s1, s2)).toEqual({ participants: 2, avgScore: 12, completion: 5, sameQuiz: true });
    expect(compareSessions(s1, s3).sameQuiz).toBe(false);
  });

  it('aligne les questions de deux séances du même quiz', () => {
    const a: QuestionStat[] = [
      { question_index: 0, question: 'Q1', answers: 20, correct: 10, success_pct: 50 },
      { question_index: 1, question: 'Q2', answers: 0, correct: 0, success_pct: null },
    ];
    const b: QuestionStat[] = [
      { question_index: 0, question: 'Q1', answers: 20, correct: 15, success_pct: 75 },
      { question_index: 1, question: 'Q2', answers: 10, correct: 5, success_pct: 50 },
    ];
    expect(alignQuestionStats(a, b)).toEqual([
      { index: 0, question: 'Q1', a: 50, b: 75, delta: 25 },
      { index: 1, question: 'Q2', a: null, b: 50, delta: null },
    ]);
  });

  it('liste les questions les plus ratées, en ignorant celles avec trop peu de réponses', () => {
    const stats: QuestionStat[] = [
      { question_index: 0, question: 'facile', answers: 10, correct: 9, success_pct: 90 },
      { question_index: 1, question: 'dure', answers: 10, correct: 2, success_pct: 20 },
      { question_index: 2, question: 'peu de données', answers: 2, correct: 0, success_pct: 0 },
    ];
    expect(hardestQuestions(stats).map((q) => q.question)).toEqual(['dure', 'facile']);
  });

  it('formate pourcentages et écarts', () => {
    expect(formatPercent(66.6)).toBe('67 %');
    expect(formatPercent(null)).toBe('—');
    expect(formatDelta(12)).toBe('+12 pts');
    expect(formatDelta(-3.4)).toBe('-3.4 pts');
    expect(formatDelta(0)).toBe('= 0 pts');
  });
});

describe('accès aux classes', () => {
  it('détecte une migration absente et une limite de forfait', () => {
    expect(isClassesUnavailable({ code: '42P01' })).toBe(true);
    expect(isClassesUnavailable({ code: 'PGRST205', message: "Could not find the table 'public.classes' in the schema cache" })).toBe(true);
    expect(isClassesUnavailable({ code: '23505' })).toBe(false);
    expect(isClassLimitError({ code: 'P0001', message: 'Nombre maximal de classes atteint pour ce plan (freemium).' })).toBe(true);
    expect(isClassLimitError({ code: '42501' })).toBe(false);
  });

  it('convertit les nombres renvoyés en texte par la base', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ ...session('s1', '2026-10-01T08:00:00Z'), avg_score_pct: '61.5', completion_pct: '88.0' }], error: null });
    const [row] = await getClassSessions({ rpc } as never, 'c1');
    expect(rpc).toHaveBeenCalledWith('class_sessions_summary', { p_class_id: 'c1' });
    expect(row.avg_score_pct).toBe(61.5);
    expect(row.completion_pct).toBe(88);
  });

  it('tolère une progression sans scores', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ nickname: 'Ana', sessions_count: 1, avg_score_pct: '70.0', last_session_at: null, scores: null }], error: null });
    const [row] = await getStudentsProgress({ rpc } as never, 'c1');
    expect(row.scores).toEqual([]);
    expect(row.avg_score_pct).toBe(70);
  });

  it('liste les séances sans classe avec le titre du quiz', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 's1', created_at: '2026-10-01', status: 'completed', shared_quizzes: { title: 'Optique' } }, { id: 's2', created_at: '2026-10-02', status: 'completed', shared_quizzes: null }], error: null });
    const supabase = { from: () => ({ select: () => ({ is: () => ({ order: () => ({ limit }) }) }) }) };
    const rows = await listUnassignedSessions(supabase as never);
    expect(rows.map((r) => r.title)).toEqual(['Optique', 'Quiz']);
  });

  it('rattache une séance à une classe', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    await assignSessionToClass({ from: () => ({ update }) } as never, 's1', 'c1');
    expect(update).toHaveBeenCalledWith({ class_id: 'c1' });
    expect(eq).toHaveBeenCalledWith('id', 's1');
  });
});
