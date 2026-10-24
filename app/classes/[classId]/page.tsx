'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import {
  assignSessionToClass,
  getClass,
  getClassSessions,
  getQuestionStats,
  getStudentsProgress,
  listUnassignedSessions,
  type ClassRow,
  type ClassSessionSummary,
  type QuestionStat,
  type StudentProgress,
  type UnassignedSession,
} from '@/lib/classes';
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
import { downloadJsonWorkbook, formatDateTime } from '@/lib/exporters';
import { logger } from '@/lib/logger';
import ToastContainer, { useToast } from '@/components/ui/Toast';

type Tab = 'sessions' | 'students' | 'compare';

const sessionDate = (s: ClassSessionSummary) => new Date(s.started_at ?? s.created_at);
const dateLabel = (s: ClassSessionSummary) => sessionDate(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

function Bar({ value, tone = 'yellow' }: { value: number | null; tone?: 'yellow' | 'teal' }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100" role="presentation">
      <div className={`h-full rounded-full ${tone === 'yellow' ? 'bg-brand-yellow' : 'bg-brand-teal'}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function ClassDetailPage() {
  const params = useParams();
  const classId = (params?.classId as string) || '';
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { toasts, showToast, removeToast } = useToast();

  const [klass, setKlass] = useState<ClassRow | null>(null);
  const [sessions, setSessions] = useState<ClassSessionSummary[]>([]);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [unassigned, setUnassigned] = useState<UnassignedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('sessions');
  const [openSession, setOpenSession] = useState<string | null>(null);
  const [openStats, setOpenStats] = useState<QuestionStat[]>([]);
  const [cmpA, setCmpA] = useState('');
  const [cmpB, setCmpB] = useState('');
  const [cmpStats, setCmpStats] = useState<{ a: QuestionStat[]; b: QuestionStat[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const [row, sess, stud, free] = await Promise.all([
        getClass(supabase, classId),
        getClassSessions(supabase, classId),
        getStudentsProgress(supabase, classId),
        listUnassignedSessions(supabase).catch(() => []),
      ]);
      if (!row) {
        setError('Classe introuvable.');
        return;
      }
      setKlass(row);
      setSessions(sess);
      setStudents(stud);
      setUnassigned(free);
    } catch (e) {
      logger.error('Chargement de la classe échoué', e instanceof Error ? e : { e: String(e) });
      setError('Impossible de charger cette classe.');
    } finally {
      setLoading(false);
    }
  }, [supabase, classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ordered = useMemo(() => chronological(sessions), [sessions]);
  const matrix = useMemo(() => buildStudentMatrix(students, sessions), [students, sessions]);
  const needHelp = useMemo(() => studentsNeedingHelp(students), [students]);

  // Détail d'une séance : réussite question par question
  useEffect(() => {
    if (!openSession) return;
    let cancelled = false;
    getQuestionStats(supabase, classId, openSession).then((stats) => {
      if (!cancelled) setOpenStats(stats);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, classId, openSession]);

  // Comparaison : statistiques des deux séances choisies
  useEffect(() => {
    if (!cmpA || !cmpB) {
      setCmpStats(null);
      return;
    }
    let cancelled = false;
    Promise.all([getQuestionStats(supabase, classId, cmpA), getQuestionStats(supabase, classId, cmpB)]).then(([a, b]) => {
      if (!cancelled) setCmpStats({ a, b });
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, classId, cmpA, cmpB]);

  const sessionA = sessions.find((s) => s.session_id === cmpA);
  const sessionB = sessions.find((s) => s.session_id === cmpB);
  const comparison = sessionA && sessionB ? compareSessions(sessionA, sessionB) : null;

  const handleAssign = async (sessionId: string) => {
    try {
      await assignSessionToClass(supabase, sessionId, classId);
      await load();
      showToast('Séance rattachée à la classe.', 'success');
    } catch {
      showToast('Impossible de rattacher la séance.', 'error');
    }
  };

  const handleExport = async () => {
    try {
      await downloadJsonWorkbook(`classe-${(klass?.name ?? 'classe').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, [
        {
          name: 'Séances',
          rows: ordered.map((s) => ({
            Date: formatDateTime(sessionDate(s)),
            Quiz: s.quiz_title,
            Participants: s.participants,
            'Score moyen (%)': s.avg_score_pct,
            'Questions traitées (%)': s.completion_pct,
          })),
        },
        {
          name: 'Élèves',
          rows: matrix.rows.map((row) => ({
            Pseudo: row.nickname,
            'Moyenne (%)': row.avg ?? '',
            ...Object.fromEntries(matrix.columns.map((c, i) => [`${dateLabel(c)} – ${c.quiz_title}`.slice(0, 60), row.cells[i] ?? ''])),
          })),
        },
      ]);
    } catch {
      showToast("L'export a échoué.", 'error');
    }
  };

  if (loading) return <p className="p-6 text-gray-600">Chargement…</p>;
  if (error || !klass) {
    return (
      <div className="mx-auto max-w-xl p-6">
        <p className="text-red-700">{error ?? 'Classe introuvable.'}</p>
        <Link href="/classes" className="mt-3 inline-block underline">
          Retour aux classes
        </Link>
      </div>
    );
  }

  const avgOverall = sessions.length ? sessions.reduce((n, s) => n + s.avg_score_pct, 0) / sessions.length : null;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/classes" className="text-sm text-brand-dark-light underline-offset-2 hover:underline">
            ← Mes classes
          </Link>
          <h1 className="font-heading text-2xl font-bold text-brand-dark">{klass.name}</h1>
          <p className="text-sm text-gray-600">
            {klass.level ? `${klass.level} · ` : ''}
            {sessions.length} séance{sessions.length > 1 ? 's' : ''} · {students.length} élève{students.length > 1 ? 's' : ''} (pseudos)
            {avgOverall !== null ? ` · moyenne ${formatPercent(avgOverall)}` : ''}
          </p>
        </div>
        {sessions.length > 0 && (
          <button type="button" onClick={handleExport} className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50">
            Exporter (Excel)
          </button>
        )}
      </div>

      {unassigned.length > 0 && (
        <details className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-medium text-brand-dark">
            {unassigned.length} séance{unassigned.length > 1 ? 's' : ''} passée{unassigned.length > 1 ? 's' : ''} sans classe : les rattacher ici
          </summary>
          <ul className="mt-3 space-y-2">
            {unassigned.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  {s.title} <span className="text-gray-500">· {new Date(s.created_at).toLocaleDateString('fr-FR')}</span>
                </span>
                <button type="button" onClick={() => handleAssign(s.id)} className="shrink-0 rounded-md bg-brand-yellow px-3 py-1 font-semibold text-brand-dark hover:bg-brand-yellow-dark">
                  Rattacher
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {sessions.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center shadow">
          <p className="font-medium text-brand-dark">Aucune séance dans cette classe.</p>
          <p className="mt-1 text-sm text-gray-600">
            Générez un quiz, cliquez sur « Partager en direct » et choisissez cette classe : les résultats apparaîtront ici.
          </p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Résultats de la classe" className="mb-4 flex gap-2 border-b border-gray-200">
            {([['sessions', 'Séances'], ['students', 'Élèves'], ['compare', 'Comparer']] as [Tab, string][]).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                type="button"
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${tab === id ? 'border-brand-yellow text-brand-dark' : 'border-transparent text-gray-500 hover:text-brand-dark'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'sessions' && (
            <ul className="space-y-3">
              {sessions.map((s) => (
                <li key={s.session_id} className="rounded-xl bg-white p-4 shadow">
                  <button type="button" className="w-full text-left" onClick={() => setOpenSession(openSession === s.session_id ? null : s.session_id)} aria-expanded={openSession === s.session_id}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-heading font-bold text-brand-dark">{s.quiz_title}</p>
                      <p className="text-xs text-gray-500">{sessionDate(s).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' })}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-3 text-center text-sm">
                      <div><p className="text-lg font-bold">{s.participants}</p><p className="text-xs text-gray-500">participants</p></div>
                      <div><p className="text-lg font-bold">{formatPercent(s.avg_score_pct)}</p><p className="text-xs text-gray-500">score moyen</p></div>
                      <div><p className="text-lg font-bold">{formatPercent(s.completion_pct)}</p><p className="text-xs text-gray-500">questions traitées</p></div>
                    </div>
                    <div className="mt-2"><Bar value={s.avg_score_pct} /></div>
                  </button>
                  {openSession === s.session_id && (
                    <div className="mt-3 border-t pt-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Réussite par question</p>
                      <ol className="space-y-2 text-sm">
                        {openStats.map((q) => (
                          <li key={q.question_index}>
                            <div className="flex justify-between gap-3">
                              <span className="min-w-0 truncate">{q.question_index + 1}. {q.question}</span>
                              <span className="shrink-0 font-semibold">{formatPercent(q.success_pct)}</span>
                            </div>
                            <Bar value={q.success_pct} tone="teal" />
                          </li>
                        ))}
                      </ol>
                      {hardestQuestions(openStats).length > 0 && (
                        <p className="mt-3 rounded-md bg-orange-50 p-2 text-xs text-orange-800">
                          À reprendre en cours : {hardestQuestions(openStats).map((q) => `question ${q.question_index + 1} (${formatPercent(q.success_pct)})`).join(', ')}.
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {tab === 'students' && (
            <div>
              {needHelp.length > 0 && (
                <p className="mb-3 rounded-md bg-orange-50 p-3 text-sm text-orange-800">
                  À accompagner : {needHelp.map((s) => s.nickname).join(', ')} (moyenne sous 50 % ou baisse nette à la dernière séance).
                </p>
              )}
              <div className="overflow-x-auto rounded-xl bg-white shadow">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2">Pseudo</th>
                      <th className="px-3 py-2">Moyenne</th>
                      <th className="px-3 py-2">Évolution</th>
                      {matrix.columns.map((c) => (
                        <th key={c.session_id} className="px-3 py-2" title={c.quiz_title}>{dateLabel(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map((row, i) => {
                      const trend = studentTrend(students[i]);
                      return (
                        <tr key={row.nickname} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{row.nickname}</td>
                          <td className="px-3 py-2">{formatPercent(row.avg)}</td>
                          <td className={`px-3 py-2 ${trend.direction === 'up' ? 'text-green-700' : trend.direction === 'down' ? 'text-red-700' : 'text-gray-500'}`}>
                            {trend.direction === 'none' ? '—' : `${trend.direction === 'up' ? '↗' : trend.direction === 'down' ? '↘' : '→'} ${formatDelta(trend.delta)}`}
                          </td>
                          {row.cells.map((cell, j) => (
                            <td key={j} className={`px-3 py-2 ${cell === null ? 'text-gray-300' : cell < 50 ? 'text-red-700' : 'text-gray-900'}`}>
                              {cell === null ? '·' : `${cell} %`}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-gray-500">Les élèves sont reconnus par leur pseudo : demandez-leur d&apos;utiliser toujours le même pour suivre leur progression.</p>
            </div>
          )}

          {tab === 'compare' && (
            <div>
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                {([['Séance A (référence)', cmpA, setCmpA], ['Séance B (à comparer)', cmpB, setCmpB]] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
                  <label key={label} className="text-sm">
                    <span className="mb-1 block text-gray-700">{label}</span>
                    <select value={value} onChange={(e) => setter(e.target.value)} className="w-full rounded-md border px-3 py-2">
                      <option value="">Choisir…</option>
                      {ordered.map((s) => (
                        <option key={s.session_id} value={s.session_id}>{dateLabel(s)} – {s.quiz_title}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              {comparison && sessionA && sessionB ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-xl bg-white shadow">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-3 py-2"></th><th className="px-3 py-2">A</th><th className="px-3 py-2">B</th><th className="px-3 py-2">Écart</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b"><td className="px-3 py-2">Participants</td><td className="px-3 py-2">{sessionA.participants}</td><td className="px-3 py-2">{sessionB.participants}</td><td className="px-3 py-2">{formatDelta(comparison.participants, '')}</td></tr>
                        <tr className="border-b"><td className="px-3 py-2">Score moyen</td><td className="px-3 py-2">{formatPercent(sessionA.avg_score_pct)}</td><td className="px-3 py-2">{formatPercent(sessionB.avg_score_pct)}</td><td className={`px-3 py-2 font-semibold ${comparison.avgScore > 0 ? 'text-green-700' : comparison.avgScore < 0 ? 'text-red-700' : ''}`}>{formatDelta(comparison.avgScore)}</td></tr>
                        <tr><td className="px-3 py-2">Questions traitées</td><td className="px-3 py-2">{formatPercent(sessionA.completion_pct)}</td><td className="px-3 py-2">{formatPercent(sessionB.completion_pct)}</td><td className="px-3 py-2">{formatDelta(comparison.completion)}</td></tr>
                      </tbody>
                    </table>
                  </div>

                  {cmpStats && comparison.sameQuiz ? (
                    <div className="rounded-xl bg-white p-4 shadow">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Question par question (même quiz)</p>
                      <ol className="space-y-3 text-sm">
                        {alignQuestionStats(cmpStats.a, cmpStats.b).map((q) => (
                          <li key={q.index}>
                            <div className="flex justify-between gap-3">
                              <span className="min-w-0 truncate">{q.index + 1}. {q.question}</span>
                              <span className={`shrink-0 font-semibold ${q.delta !== null && q.delta > 0 ? 'text-green-700' : q.delta !== null && q.delta < 0 ? 'text-red-700' : ''}`}>{formatDelta(q.delta)}</span>
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-500">
                              <div>A : {formatPercent(q.a)}<Bar value={q.a} /></div>
                              <div>B : {formatPercent(q.b)}<Bar value={q.b} tone="teal" /></div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : (
                    <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
                      Ces deux séances utilisent des quiz différents : la comparaison porte sur les résultats globaux. Relancez le même quiz pour comparer question par question.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">Choisissez deux séances pour voir l&apos;évolution des résultats.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
