'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import QuizAttempt from '@/components/QuizAttempt';
import type { QuizQuestion } from '@/lib/quiz.types';

type ChallengeData = {
  quiz: QuizQuestion[];
  score: number;
  total: number;
  authorName: string | null;
  createdAt: string;
  shareCode: string;
};

export default function ChallengePage() {
  const params = useParams();
  const router = useRouter();
  const code = ((params?.code as string) || '').trim().toUpperCase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);

  useEffect(() => {
    if (!code) {
      setError('Défi introuvable.');
      setLoading(false);
      return;
    }

    let active = true;
    const fetchChallenge = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/challenge/${encodeURIComponent(code)}`, {
          cache: 'no-store',
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: 'Défi introuvable.' }));
          throw new Error(payload?.error || 'Défi introuvable.');
        }

        const data = (await response.json()) as ChallengeData;
        if (!active) return;
        setChallenge(data);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Défi introuvable.';
        setError(message);
        setChallenge(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchChallenge();
    return () => {
      active = false;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-yellow-light via-brand-teal-light to-white">
        <p className="text-gray-700 text-sm">Chargement du défi...</p>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-yellow-light via-brand-teal-light to-white p-4">
        <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full text-center">
          <h1 className="text-xl font-heading font-bold text-brand-dark mb-3">Défi indisponible</h1>
          <p className="text-sm text-gray-600 mb-4">{error ?? 'Nous ne trouvons pas ce quiz partagé. Vérifie le lien ou demande un nouveau défi.'}</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full px-4 py-2 bg-brand-yellow text-brand-dark rounded-md font-semibold hover:bg-brand-yellow-dark"
          >
            Retourner à l&apos;accueil
          </button>
        </div>
      </div>
    );
  }

  const title = challenge.authorName
    ? `${challenge.authorName} a obtenu ${challenge.score}/${challenge.total}`
    : `Un ami a obtenu ${challenge.score}/${challenge.total}`;

  const subtitle = challenge.authorName
    ? `Arriveras-tu à battre ${challenge.authorName} ?`
    : 'Arriveras-tu à battre ce score ?';

  const signupRedirect = `/signup?redirect=/challenge/${challenge.shareCode}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-yellow-light via-brand-teal-light to-white p-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-xl p-6 sm:p-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-brand-dark mb-3">
            Défie un ami
          </h1>
          <p className="text-lg font-semibold text-brand-teal-dark mb-2">{title}</p>
          <p className="text-sm sm:text-base text-gray-600">{subtitle}</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
          <QuizAttempt
            quizQuestions={challenge.quiz}
            context={{ num_questions: challenge.total }}
            onQuizEnd={() => router.push('/')}
            gateResults={{
              requireAuth: true,
              signupRedirect,
              headline: 'Crée ton compte pour dévoiler ton score',
              message: 'Inscris-toi gratuitement pour voir ton résultat, sauvegarder ta progression et continuer ton entraînement.',
              ctaLabel: 'Je crée mon compte',
            }}
            enableShareChallenge={false}
          />
        </div>
      </div>
    </div>
  );
}
