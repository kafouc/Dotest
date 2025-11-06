'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { createSharedQuiz, createQuizSession } from '@/lib/liveQuiz';
import QRCode from 'qrcode';

type QuizQuestion = {
  question: string;
  options: { [key: string]: string };
  reponse_correcte: string;
  justification?: string;
};

type Props = {
  quizTitle: string;
  questions: QuizQuestion[];
};

export default function ShareQuizButton({ quizTitle, questions }: Props) {
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [loading, setLoading] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleShare = async () => {
    try {
      setLoading(true);

      // 🔍 VÉRIFICATION: L'utilisateur est-il connecté ?
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        alert(
          '⚠️ Vous devez être connecté pour partager un quiz.\n\n' +
          'Veuillez vous déconnecter puis vous reconnecter.\n' +
          'Si le problème persiste, rechargez la page (Ctrl+Shift+R).'
        );
        console.error('Erreur auth:', authError || 'Aucun utilisateur');
        setLoading(false);
        return;
      }

      console.log('✅ Utilisateur connecté:', user.id);

      // 1. Créer le quiz partagé
      const sharedQuiz = await createSharedQuiz(supabase, {
        title: quizTitle,
        questions: questions,
      });

      // 2. Créer une session
      const session = await createQuizSession(supabase, sharedQuiz.id);

      // 3. Générer le QR code
      const joinUrl = `${window.location.origin}/join/${sharedQuiz.share_code}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 300,
        margin: 2,
      });

      setShareCode(sharedQuiz.share_code);
      setQrCodeUrl(qrDataUrl);
      setSessionId(session.id);
    } catch (error) {
      console.error('Erreur partage quiz:', error);
      alert('Impossible de partager le quiz.');
    } finally {
      setLoading(false);
    }
  };

  if (shareCode && qrCodeUrl && sessionId) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full">
          <h3 className="text-xl font-bold text-brand-purple-dark mb-4">
            Quiz Partagé !
          </h3>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-2">Code de partage</p>
              <p className="text-3xl font-mono font-bold text-brand-purple">
                {shareCode}
              </p>
            </div>

            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeUrl} alt="QR Code" className="rounded-lg" />
            </div>

            <p className="text-sm text-gray-600 text-center">
              Les élèves peuvent scanner ce QR code ou entrer le code sur{' '}
              <span className="font-mono text-brand-purple">
                {window.location.origin}/join
              </span>
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  window.open(`/live-dashboard/${sessionId}`, '_blank');
                }}
                className="flex-1 px-4 py-2 bg-brand-purple text-white rounded-md hover:bg-brand-purple-dark"
              >
                Ouvrir le Dashboard
              </button>
              <button
                type="button"
                onClick={() => {
                  setShareCode(null);
                  setQrCodeUrl(null);
                  setSessionId(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={loading}
      className="px-4 py-2 bg-brand-pink text-white rounded-md hover:bg-brand-pink-dark disabled:opacity-50 flex items-center gap-2"
    >
      <span>📱</span>
      {loading ? 'Partage en cours...' : 'Partager en temps réel'}
    </button>
  );
}
