'use client';

import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getSession,
  getSessionParticipants,
  getSessionAnswers,
  type QuizSession,
  type SessionParticipant,
  type LiveAnswer,
  type SharedQuiz,
} from '@/lib/liveQuiz';
import { logger } from '@/lib/logger';

/**
 * Données d'une session live pour son créateur : chargement initial, puis mises à jour en temps réel
 * (participants, réponses, statut) sur un seul canal Realtime.
 */
export function useLiveSession(supabase: SupabaseClient, sessionId: string) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [quiz, setQuiz] = useState<SharedQuiz | null>(null);
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [answers, setAnswers] = useState<LiveAnswer[]>([]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();
        if (authErr || !user) {
          if (!cancelled) setError('Veuillez vous connecter pour accéder au dashboard.');
          return;
        }

        const sessionData = await getSession(supabase, sessionId);
        if (!sessionData) {
          if (!cancelled) setError('Session introuvable.');
          return;
        }

        const { data: quizData } = await supabase
          .from('shared_quizzes')
          .select('*')
          .eq('id', sessionData.shared_quiz_id)
          .single();

        const [participantsData, answersData] = await Promise.all([
          getSessionParticipants(supabase, sessionId),
          getSessionAnswers(supabase, sessionId),
        ]);

        if (cancelled) return;
        setSession(sessionData);
        if (quizData) setQuiz(quizData);
        setParticipants(participantsData);
        setAnswers(answersData);
      } catch (err) {
        const e = err as { message?: string; code?: string };
        logger.error('Dashboard load error', e instanceof Error ? e : { message: e?.message, code: e?.code });
        if (!cancelled) {
          setError(
            e?.message
              ? `Erreur lors du chargement: ${e.message}${e?.code ? ` (code ${e.code})` : ''}`
              : 'Erreur lors du chargement.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [supabase, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`live_dashboard_${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_participants', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as SessionParticipant;
          setParticipants((prev) => (prev.some((p) => p.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_answers', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const row = payload.new as LiveAnswer;
          setAnswers((prev) => (prev.some((a) => a.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${sessionId}` },
        (payload) => setSession(payload.new as QuizSession)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, sessionId]);

  return { loading, error, session, quiz, setQuiz, participants, answers };
}
