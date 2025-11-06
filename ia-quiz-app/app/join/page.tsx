'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { getSharedQuizByCode } from '@/lib/liveQuiz';

export default function JoinQuizPage() {
  const router = useRouter();
  const [shareCode, setShareCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const quiz = await getSharedQuizByCode(supabase, shareCode);
      
      if (!quiz) {
        setError('Code invalide ou quiz expiré.');
        setLoading(false);
        return;
      }

      // Rediriger vers la page de participation
      router.push(`/join/${shareCode.toUpperCase()}`);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la connexion.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 via-pink-100 to-blue-100 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-brand-purple-dark mb-6 text-center">
          Rejoindre un Quiz
        </h1>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Code du quiz
            </label>
            <input
              type="text"
              value={shareCode}
              onChange={(e) => setShareCode(e.target.value.toUpperCase())}
              placeholder="Ex: ABC123"
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-md text-center text-2xl font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand-purple"
              required
            />
          </div>

          {error && (
            <div className="p-3 bg-red-100 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || shareCode.length < 6}
            className="w-full px-6 py-3 bg-brand-purple text-white font-bold rounded-md hover:bg-brand-purple-dark disabled:opacity-50"
          >
            {loading ? 'Connexion...' : 'Rejoindre'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Scannez le QR code fourni par votre professeur ou entrez le code manuellement.
        </p>
      </div>
    </div>
  );
}
