'use client';

import { useState } from 'react';
import type { QuizQuestion } from '@/lib/quiz.types';
import { correctAnswerText } from '@/lib/utils';
import { formatSource } from '@/lib/sourceLabel';

type Props = {
  questions: QuizQuestion[];
  onFinish: (score: number) => void;
};

/** Quiz de l'essai sans compte : une question à la fois, correction immédiate avec justification et source. */
export default function DemoQuiz({ questions, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const question = questions[index];
  if (!question) return null;

  const options = Object.entries(question.options as Record<string, string>);
  const correctLetter = String('reponse_correcte' in question ? question.reponse_correcte : '').toUpperCase();
  const answered = selected !== null;
  const isLast = index === questions.length - 1;
  const source = formatSource(question.source);

  const choose = (letter: string) => {
    if (answered) return;
    setSelected(letter);
    if (letter.toUpperCase() === correctLetter) setScore((s) => s + 1);
  };

  const next = () => {
    if (isLast) {
      onFinish(score);
      return;
    }
    setIndex(index + 1);
    setSelected(null);
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-lg sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500" aria-live="polite">
        Question {index + 1} sur {questions.length}
      </p>
      <h2 className="mt-2 font-heading text-lg font-bold text-brand-dark sm:text-xl">{question.question}</h2>

      <ul className="mt-4 space-y-2" role="list">
        {options.map(([letter, text]) => {
          const isCorrect = letter.toUpperCase() === correctLetter;
          const isChosen = selected === letter;
          let style = 'border-gray-200 bg-white hover:border-brand-yellow hover:bg-brand-yellow-light';
          if (answered && isCorrect) style = 'border-green-500 bg-green-50';
          else if (answered && isChosen) style = 'border-red-400 bg-red-50';
          else if (answered) style = 'border-gray-200 bg-white opacity-70';
          return (
            <li key={letter}>
              <button
                type="button"
                onClick={() => choose(letter)}
                disabled={answered}
                aria-pressed={isChosen}
                className={`flex w-full items-start gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors ${style}`}
              >
                <span className="font-bold text-brand-dark">{letter}</span>
                <span className="text-sm text-gray-800 sm:text-base">{text}</span>
                {answered && isCorrect && <span className="sr-only"> (bonne réponse)</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {answered && (
        <div className="mt-4 space-y-2 rounded-lg bg-gray-50 p-4 text-sm" aria-live="polite">
          <p className={`font-semibold ${selected?.toUpperCase() === correctLetter ? 'text-green-700' : 'text-red-700'}`}>
            {selected?.toUpperCase() === correctLetter ? 'Bonne réponse !' : `Raté. Bonne réponse : ${correctAnswerText(question)}`}
          </p>
          {question.justification && <p className="text-gray-700">{question.justification}</p>}
          {(question.evidence || source) && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Dans votre texte{source ? ` (${source})` : ''} :</span>
              {question.evidence ? <> «&nbsp;{question.evidence}&nbsp;»</> : null}
            </p>
          )}
          <button
            type="button"
            onClick={next}
            className="mt-2 rounded-full bg-brand-yellow px-5 py-2 font-semibold text-brand-dark hover:bg-brand-yellow-dark"
          >
            {isLast ? 'Voir mon résultat' : 'Question suivante'}
          </button>
        </div>
      )}
    </div>
  );
}
