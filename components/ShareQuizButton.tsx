'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { createSharedQuiz, createQuizSession } from '@/lib/liveQuiz';
import { listClasses, type ClassRow } from '@/lib/classes';
import type { QuizQuestion } from '@/lib/quiz.types';
import QRCode from 'qrcode';
import ToastContainer, { useToast } from '@/components/ui/Toast';

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
  const { toasts, showToast, removeToast } = useToast();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState('');

  // Classes de l'enseignant (liste vide si l'espace enseignant n'est pas activé : le partage fonctionne comme avant)
  useEffect(() => {
    listClasses(supabase).then(setClasses).catch(() => setClasses([]));
  }, [supabase]);

  const handleShare = async () => {
    try {
      setLoading(true);

      // 🔍 VÉRIFICATION: L'utilisateur est-il connecté ?
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        showToast('Connexion requise pour partager un quiz.', 'warning');
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
      const session = await createQuizSession(supabase, sharedQuiz.id, classId || null);

      // 3. Générer le QR code
      const joinUrl = `${window.location.origin}/join/${sharedQuiz.share_code}`;
      const qrDataUrl = await QRCode.toDataURL(joinUrl, {
        width: 300,
        margin: 2,
      });

      setShareCode(sharedQuiz.share_code);
      setQrCodeUrl(qrDataUrl);
      setSessionId(session.id);
      showToast('Quiz prêt à être partagé.', 'success');
    } catch (error) {
      const anyErr = error as { message?: string; code?: string };
      console.error('Erreur partage quiz:', anyErr);
      const friendlyMessage = anyErr?.message
        ? `Impossible de partager le quiz (${anyErr.message}).`
        : 'Impossible de partager le quiz pour le moment.';
      showToast(friendlyMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (shareCode && qrCodeUrl && sessionId) {
    return (
      <>
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md w-full">
          <h3 className="text-xl font-heading font-bold text-brand-dark mb-4">
            Quiz Partagé !
          </h3>

          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg text-center">
              <p className="text-sm text-gray-600 mb-2">Code de partage</p>
              <p className="text-3xl font-mono font-bold text-brand-yellow">
                {shareCode}
              </p>
            </div>

            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCodeUrl} alt="QR Code" className="rounded-lg" />
            </div>

            <p className="text-sm text-gray-600 text-center">
              Les élèves peuvent scanner ce QR code ou entrer le code sur{' '}
              <span className="font-mono text-brand-yellow">
                {window.location.origin}/join
              </span>
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  window.open(`/live-dashboard/${sessionId}`, '_blank');
                }}
                className="flex-1 px-4 py-2 bg-brand-yellow text-brand-dark rounded-md hover:bg-brand-yellow-dark font-semibold"
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
      </>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <span className="sr-only sm:not-sr-only">Classe</span>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={loading}
            aria-label="Classe de cette séance"
            className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
          >
            <option value="">Sans classe</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleShare}
          disabled={loading}
          className="px-4 py-2 bg-brand-teal text-white rounded-md hover:bg-brand-teal-dark disabled:opacity-50 flex items-center gap-2 font-semibold"
        >
          <span>📱</span>
          {loading ? 'Partage en cours...' : 'Partager en temps réel'}
        </button>
        {classes.length === 0 && (
          <Link href="/classes" className="text-xs text-gray-500 underline-offset-2 hover:underline">
            Créer une classe
          </Link>
        )}
      </div>
    </>
  );
}
