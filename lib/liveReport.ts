import type { LiveAnswer } from '@/lib/liveQuiz';
import type { QuizQuestion } from '@/lib/quiz.types';
import { escapeHtml, formatDuration, formatDateTime } from '@/lib/exporters';

/** Calculs et rapports d'une session live (fonctions pures, testables sans React). */

export type ParticipantSummary = {
  id: string;
  nickname: string;
  answered: number;
  correct: number;
  scorePercent: number;
  completionPercent: number;
  durationMs: number;
  firstAnswerAt: string | null;
  lastAnswerAt: string | null;
};

export type LiveExportArgs = {
  sessionTitle: string;
  shareCode?: string | null;
  generatedLabel: string;
  startedAt?: string;
  completedAt?: string;
  durationLabel?: string;
  participantSummaries: ParticipantSummary[];
  totalParticipants: number;
  totalQuestions: number;
  totalAnswers: number;
  questionStats: { correct: number; total: number }[];
  questions: QuizQuestion[];
  answers: LiveAnswer[];
};

export const LIVE_EXPORT_STYLES = `
.session-meta { list-style: none; padding: 0; margin: 0; }
.session-meta li { margin-bottom: 6px; font-size: 14px; color: #374151; }
.question-distribution { list-style: none; padding: 0; margin: 8px 0 0 0; }
.question-distribution li { margin-bottom: 4px; font-size: 13px; color: #1f2937; }
.question-distribution li strong { color: #f59e0b; margin-right: 6px; }
.question-note { margin-top: 10px; font-size: 13px; color: #4b5563; }
`;

export function formatCorrectAnswer(question: QuizQuestion): string {
  if ('reponses_correctes' in question) {
    return (question.reponses_correctes ?? []).map((choice) => {
      const key = choice.toString().toUpperCase();
      const options = question.options as Record<string, string>;
      const text = options[key] ?? options[key.toLowerCase()];
      return text ? `${key} – ${text}` : key;
    }).join(', ');
  }

  if ('reponse_correcte' in question) {
    if (question.reponse_correcte === 'VRAI' || question.reponse_correcte === 'FAUX') {
      const label = question.reponse_correcte === 'VRAI' ? 'Vrai' : 'Faux';
      const options = question.options as Record<string, string>;
      const text = options[question.reponse_correcte];
      return text ? text : label;
    }
    const key = question.reponse_correcte?.toString().toUpperCase() ?? '';
    const options = question.options as Record<string, string>;
    const text = options[key] ?? options[key.toLowerCase()];
    return text ? `${key} – ${text}` : key;
  }

  return '';
}

export function getOptionCounts(question: QuizQuestion, index: number, answers: LiveAnswer[]): Record<string, number> {
  const base = Object.keys(question.options ?? {}).reduce<Record<string, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {});

  answers
    .filter((answer) => answer.question_index === index)
    .forEach((answer) => {
      const normalized = (answer.answer ?? '').toString().trim().toUpperCase();
      const matchKey = Object.keys(question.options ?? {}).find((key) => key.toUpperCase() === normalized);
      if (matchKey) {
        base[matchKey] = (base[matchKey] ?? 0) + 1;
      }
    });

  return base;
}

export function buildLiveSessionExportHtml(args: LiveExportArgs): string {
  const metaItems = [
    args.shareCode ? `<li><strong>Code de partage :</strong> ${escapeHtml(args.shareCode)}</li>` : '',
    `<li><strong>Participants :</strong> ${escapeHtml(args.totalParticipants)}</li>`,
    `<li><strong>Questions :</strong> ${escapeHtml(args.totalQuestions)}</li>`,
    `<li><strong>Réponses reçues :</strong> ${escapeHtml(args.totalAnswers)}</li>`,
    args.startedAt ? `<li><strong>Début :</strong> ${escapeHtml(args.startedAt)}</li>` : '',
    args.completedAt ? `<li><strong>Fin :</strong> ${escapeHtml(args.completedAt)}</li>` : '',
    args.durationLabel ? `<li><strong>Durée :</strong> ${escapeHtml(args.durationLabel)}</li>` : '',
    `<li><strong>Rapport généré :</strong> ${escapeHtml(args.generatedLabel)}</li>`,
  ].filter(Boolean).join('');

  const participantsTable = args.participantSummaries.length
    ? `
      <table class="export-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Participant</th>
            <th>Réponses données</th>
            <th>Bonnes réponses</th>
            <th>Score</th>
            <th>Questions complétées</th>
            <th>Temps actif</th>
            <th>Première réponse</th>
            <th>Dernière réponse</th>
          </tr>
        </thead>
        <tbody>
          ${args.participantSummaries
            .map((participant, index) => {
              const first = participant.firstAnswerAt ? formatDateTime(new Date(participant.firstAnswerAt)) : '—';
              const last = participant.lastAnswerAt ? formatDateTime(new Date(participant.lastAnswerAt)) : '—';
              const duration = participant.durationMs > 0 ? formatDuration(participant.durationMs) : '—';
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(participant.nickname)}</td>
                  <td>${escapeHtml(`${participant.answered}/${args.totalQuestions}`)}</td>
                  <td>${escapeHtml(participant.correct)}</td>
                  <td>${escapeHtml(`${participant.scorePercent}%`)}</td>
                  <td>${escapeHtml(`${participant.completionPercent}%`)}</td>
                  <td>${escapeHtml(duration)}</td>
                  <td>${escapeHtml(first)}</td>
                  <td>${escapeHtml(last)}</td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    `
    : '<p>Aucun participant n’a encore répondu au quiz.</p>';

  const questionSections = args.questions
    .map((question, index) => {
      const stat = args.questionStats[index] ?? { correct: 0, total: 0 };
      const optionCounts = getOptionCounts(question, index, args.answers);
      const successRate = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
      const correctSet = new Set<string>();
      if ('reponses_correctes' in question) {
        (question.reponses_correctes ?? []).forEach((value) => value && correctSet.add(value.toString().toUpperCase()));
      } else if ('reponse_correcte' in question && question.reponse_correcte) {
        correctSet.add(question.reponse_correcte.toString().toUpperCase());
      }

      const distributionItems = Object.entries(question.options ?? {})
        .map(([key, value]) => {
          const normalizedKey = key.toString().toUpperCase();
          const count = optionCounts[key] ?? 0;
          const plural = count > 1 ? 's' : '';
          const isCorrect = correctSet.has(normalizedKey);
          return `
            <li>
              ${isCorrect ? '✅ ' : ''}<strong>${escapeHtml(normalizedKey)}</strong>
              ${value ? `– ${escapeHtml(value)}` : ''}
              — ${escapeHtml(`${count} réponse${plural}`)}
            </li>
          `;
        })
        .join('');

      const justification = question.justification
        ? `<p class="question-note"><strong>Justification :</strong> ${escapeHtml(question.justification)}</p>`
        : '';

      return `
        <section class="export-section">
          <h2>Question ${index + 1}</h2>
          <p><strong>Intitulé :</strong> ${escapeHtml(question.question)}</p>
          <p><strong>Bonne(s) réponse(s) :</strong> ${escapeHtml(formatCorrectAnswer(question) || '—')}</p>
          <p><strong>Taux de réussite :</strong> ${escapeHtml(`${successRate}%`)} (${escapeHtml(`${stat.correct}/${stat.total}`)} corrects)</p>
          <ul class="question-distribution">${distributionItems}</ul>
          ${justification}
        </section>
      `;
    })
    .join('');

  return `
    <header class="export-header">
      <div>
        <h1>${escapeHtml(args.sessionTitle)}</h1>
        <p>Rapport de session live</p>
      </div>
    </header>
    <section class="export-section">
      <h2>Résumé de session</h2>
      <ul class="session-meta">${metaItems}</ul>
    </section>
    <section class="export-section">
      <h2>Résultats par participant</h2>
      ${participantsTable}
    </section>
    ${questionSections}
  `;
}

export type QuestionStat = { questionIndex: number; correct: number; total: number };

export function computeQuestionStats(questions: QuizQuestion[], answers: LiveAnswer[]): QuestionStat[] {
  return questions.map((_, idx) => {
    const forQuestion = answers.filter((a) => a.question_index === idx);
    return { questionIndex: idx, correct: forQuestion.filter((a) => a.is_correct).length, total: forQuestion.length };
  });
}

export function computeParticipantSummaries(
  participants: { id: string; nickname: string }[],
  answers: LiveAnswer[],
  totalQuestions: number
): ParticipantSummary[] {
  return participants.map((participant) => {
    const participantAnswers = answers.filter((answer) => answer.participant_id === participant.id);
    const sorted = [...participantAnswers].sort((a, b) => new Date(a.answered_at).getTime() - new Date(b.answered_at).getTime());
    const first = sorted[0]?.answered_at ?? null;
    const last = sorted[sorted.length - 1]?.answered_at ?? null;
    const durationMs = first && last ? Math.max(0, new Date(last).getTime() - new Date(first).getTime()) : 0;
    const correct = participantAnswers.filter((answer) => answer.is_correct).length;
    const answered = participantAnswers.length;

    return {
      id: participant.id,
      nickname: participant.nickname,
      answered,
      correct,
      scorePercent: totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0,
      completionPercent: totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0,
      durationMs,
      firstAnswerAt: first,
      lastAnswerAt: last,
    };
  });
}
