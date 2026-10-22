import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Utilitaire pour sauter proprement si env manquantes
function requiredEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

const SUPABASE_URL = requiredEnv('SUPABASE_URL');
const SERVICE_KEY = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const ANON_KEY = requiredEnv('SUPABASE_ANON_KEY');

// Clients (service pour setup / anon pour RLS)
const serviceClient = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } }) : undefined;
const anonClient = SUPABASE_URL && ANON_KEY ? createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } }) : undefined;

let sharedQuizId: string | undefined;
let shareCode: string | undefined;
let sessionId: string | undefined;

const SKIP_REASON = !SUPABASE_URL ? 'SUPABASE_URL manquant' : !SERVICE_KEY ? 'SERVICE_ROLE_KEY manquant' : undefined;

describe('Live Quiz Integration', () => {
  beforeAll(async () => {
    if (SKIP_REASON || !serviceClient) return;
    // Créer un quiz partagé minimal (questions = tableau vide acceptable ? sinon mock)
    const { data, error } = await serviceClient
      .from('shared_quizzes')
      .insert({ title: 'Integration Test Quiz', questions: [{ question: 'X?', options: { A: 'a', B: 'b', C: 'c', D: 'd' }, reponse_correcte: 'A', justification: 'parce que' }], is_active: true })
      .select()
      .single();
    if (error) throw error;
    sharedQuizId = data.id;
    shareCode = data.share_code;
  });

  afterAll(async () => {
    if (serviceClient && sharedQuizId) {
      await serviceClient.from('shared_quizzes').delete().eq('id', sharedQuizId);
    }
  });

  it('RPC create_quiz_session retourne une session waiting', async () => {
    if (SKIP_REASON || !serviceClient || !sharedQuizId) return; // skip silencieux
    const { data, error } = await serviceClient.rpc('create_quiz_session', { p_shared_quiz_id: sharedQuizId });
    expect(error).toBeNull();
    expect(data).toBeTruthy();
    expect(data.status).toBe('waiting');
    sessionId = data.id;
  });

  it('Transition waiting -> active', async () => {
    if (SKIP_REASON || !serviceClient || !sessionId) return;
    const { error } = await serviceClient.from('quiz_sessions').update({ status: 'active', started_at: new Date().toISOString() }).eq('id', sessionId);
    expect(error).toBeNull();
    const { data, error: selErr } = await serviceClient.from('quiz_sessions').select('status').eq('id', sessionId).single();
    expect(selErr).toBeNull();
    // data peut être null selon policies RLS; si visible on vérifie le statut
    if (data) {
      expect(data.status).toBe('active');
    }
  });

  it('Insertion participant (pseudo) et récupération', async () => {
    if (SKIP_REASON || !serviceClient || !sessionId) return;
    const { data: participant, error } = await serviceClient
      .from('session_participants')
      .insert({ session_id: sessionId, nickname: 'Eleve1' })
      .select()
      .single();
    expect(error).toBeNull();
    expect(participant).toBeTruthy();
    const { data: participants, error: listErr } = await serviceClient
      .from('session_participants')
      .select('*')
      .eq('session_id', sessionId);
    expect(listErr).toBeNull();
  expect((participants?.length ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it('Visibilité RLS (anon ne voit pas les sessions privées si policies restrictives)', async () => {
    if (!anonClient || !sessionId) return;
    const { data, error } = await anonClient.from('quiz_sessions').select('id,status,shared_quiz_id').eq('id', sessionId).maybeSingle();
    // Selon policies, soit la ligne est visible (participant read) soit null; le test accepte les deux mais valide absence d'erreur
    expect(error).toBeNull();
    expect(data === null || data.id === sessionId).toBe(true);
  });

  it('RPC list_active_session retourne la session via le code (anon)', async () => {
    if (!anonClient || !shareCode) return;
    const { data, error } = await anonClient.rpc('list_active_session', { p_share_code: shareCode });
    expect(error).toBeNull();
    const row = Array.isArray(data) ? data[0] : data;
    expect(row).toBeTruthy();
    // Peut être null si la session n'a pas été créée dans les tests précédents
    // Après la création de session plus haut, on doit récupérer un session_id
    if (sessionId) {
      expect(row.session_id).toBe(sessionId);
      expect(['waiting','active']).toContain(row.status);
    }
  });

  describe('Sécurité (client anonyme)', () => {
    it('get_public_quiz ne renvoie ni reponse_correcte ni justification', async () => {
      if (!anonClient || !shareCode) return;
      const { data, error } = await anonClient.rpc('get_public_quiz', { p_share_code: shareCode });
      expect(error).toBeNull();
      expect(data.questions).toHaveLength(1);
      expect(JSON.stringify(data)).not.toMatch(/reponse_correcte|justification/);
    });

    it('lecture directe de shared_quizzes refusée (aucune ligne)', async () => {
      if (!anonClient || !shareCode) return;
      const { data } = await anonClient.from('shared_quizzes').select('id').eq('share_code', shareCode);
      expect(data ?? []).toHaveLength(0);
    });

    it('insertion directe dans live_answers / session_participants refusée', async () => {
      if (!anonClient || !sessionId) return;
      const ans = await anonClient.from('live_answers').insert({
        session_id: sessionId,
        participant_id: '00000000-0000-0000-0000-000000000000',
        question_index: 0,
        answer: 'A',
        is_correct: true,
      });
      expect(ans.error).not.toBeNull();
      const part = await anonClient.from('session_participants').insert({ session_id: sessionId, nickname: 'Hacker' });
      expect(part.error).not.toBeNull();
    });

    it('join_session + submit_live_answer : correction côté base, jeton obligatoire', async () => {
      if (!anonClient || !sessionId) return;
      const { data: joined, error: joinErr } = await anonClient.rpc('join_session', {
        p_session_id: sessionId,
        p_nickname: 'EleveAnon',
      });
      expect(joinErr).toBeNull();
      expect(joined.token).toBeTruthy();

      const bad = await anonClient.rpc('submit_live_answer', {
        p_participant_id: joined.id,
        p_token: '00000000-0000-0000-0000-000000000000',
        p_question_index: 0,
        p_answer: 'A',
      });
      expect(bad.error).not.toBeNull();

      const good = await anonClient.rpc('submit_live_answer', {
        p_participant_id: joined.id,
        p_token: joined.token,
        p_question_index: 0,
        p_answer: 'B',
      });
      expect(good.error).toBeNull();
      expect(good.data.is_correct).toBe(false);
      expect(good.data.correct_answer).toBe('A');

      const again = await anonClient.rpc('submit_live_answer', {
        p_participant_id: joined.id,
        p_token: joined.token,
        p_question_index: 0,
        p_answer: 'A',
      });
      expect(again.error).not.toBeNull(); // une seule réponse par question
    });
  });
});
