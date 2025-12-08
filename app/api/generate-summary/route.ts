import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { CohereClient } from 'cohere-ai';
import Groq from 'groq-sdk';
import { EMBEDDING_CONFIG } from '@/lib/constants';

if (!process.env.COHERE_API_KEY) {
  throw new Error('La clé API COHERE_API_KEY est manquante');
}
const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

if (!process.env.GROQ_API_KEY) {
  throw new Error('La clé API GROQ_API_KEY est manquante');
}
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { documentPath } = (body || {}) as { documentPath?: string };
    if (!documentPath) {
      return NextResponse.json({ error: 'documentPath requis' }, { status: 400 });
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
          set(name: string, value: string, options) {
            cookies().set(name, value, options);
          },
          remove(name: string, options) {
            cookies().delete({ ...options, name });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

    // 1) Embedding d'une requête neutre pour récupérer des sections représentatives
    const embed = await cohere.embed({
      texts: ['Synthétise le document: points clés, définitions, formules, erreurs fréquentes, conseils, 5 questions d’auto-évaluation.'],
      model: 'embed-multilingual-v3.0',
      inputType: 'search_query',
    });
    // @ts-expect-error Cohere types not perfect
    const queryEmbedding = embed.embeddings?.[0];
    if (!queryEmbedding) throw new Error("Cohere n'a pas renvoyé d'embedding.");

    // 2) Récupération sections (RAG)
    const { data: sections, error: matchErr } = await supabase.rpc('match_document_sections', {
      query_embedding: queryEmbedding,
      match_threshold: EMBEDDING_CONFIG.MATCH_THRESHOLD,
      match_count: Math.max(EMBEDDING_CONFIG.MATCH_COUNT, 28),
      p_user_id: user.id,
      p_document_path: documentPath,
    });
    if (matchErr) throw new Error(matchErr.message);
    if (!sections || sections.length === 0) {
      return NextResponse.json({ error: 'Aucune section pertinente trouvée.' }, { status: 404 });
    }

    const context = (sections as { content: string }[])
      .map((s) => s.content)
      .join('\n\n---\n\n')
      .slice(0, 12000);

    // 3) Prompt résumé structuré
    const prompt = `
Tu es un excellent pédagogue. À partir du CONTEXTE ci-dessous, produis une fiche de révision concise et structurée.
Règles:
- Écris un JSON valide: { "summary": string, "key_points": string[], "definitions": string[], "formulas": string[], "pitfalls": string[], "tips": string[], "self_test": string[] }
- "summary": 120-200 mots maximum, sans redondance.
- "key_points": 5-8 items (phrases courtes).
- "definitions": 3-6 items (concept: définition).
- "formulas": 0-6 items (si applicable), en texte simple.
- "pitfalls": 3-6 erreurs fréquentes ou confusions à éviter.
- "tips": 3-6 conseils pratiques de mémorisation/application.
- "self_test": 5 questions d'auto-évaluation (claires et ciblées).
- N'inventes pas hors du CONTEXTE.
- Réponds uniquement avec l'objet JSON.

CONTEXTE:
"""
${context}
"""
`.trim();

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'Tu réponds uniquement avec un JSON valide.' },
        { role: 'user', content: prompt },
      ],
      model: 'llama-3.1-8b-instant',
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const text = completion.choices?.[0]?.message?.content;
    if (!text) throw new Error("L'IA n'a pas renvoyé de réponse.");

    type SummaryJSON = {
      summary?: unknown;
      key_points?: unknown;
      definitions?: unknown;
      formulas?: unknown;
      pitfalls?: unknown;
      tips?: unknown;
      self_test?: unknown;
    };
    let parsed: SummaryJSON;
    try {
      parsed = JSON.parse(text) as SummaryJSON;
    } catch {
      throw new Error('Réponse JSON mal formée pour la fiche de révision.');
    }

    const toText = (value: unknown): string => {
      if (value == null) return '';
      if (typeof value === 'string') return value.trim();
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (Array.isArray(value)) {
        const inner = value.map((v) => toText(v)).filter((s) => s.length > 0);
        return inner.join(' — ');
      }
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) return '';
        const lower = (k: string) => k.toLowerCase();
        const labelKeys = ['term','terme','concept','notion','mot','cle','clé','label','name','titre','topic','subject'];
        const defKeys = ['definition','définition','meaning','desc','description','explication','explanation','def','texte','text','value','content'];
        const lk = keys.find((k) => labelKeys.includes(lower(k)));
        const dk = keys.find((k) => defKeys.includes(lower(k)));
        if (lk || dk) {
          const left = lk ? toText(obj[lk]) : '';
          const right = dk ? toText(obj[dk]) : '';
          const combined = [left, right].filter((s) => s && s.length > 0).join(' — ');
          if (combined.length > 0) return combined;
        }
        const values = keys.map((k) => toText(obj[k])).filter((s) => s.length > 0);
        return values.join(' — ');
      }
      return '';
    };

    const sanitizeList = (v: unknown, max: number) =>
      (Array.isArray(v) ? v : [])
        .map((x) => toText(x))
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .slice(0, max);

    const result = {
      summary: toText(parsed?.summary),
      key_points: sanitizeList(parsed?.key_points, 8),
      definitions: sanitizeList(parsed?.definitions, 6),
      formulas: sanitizeList(parsed?.formulas, 6),
      pitfalls: sanitizeList(parsed?.pitfalls, 6),
      tips: sanitizeList(parsed?.tips, 6),
      self_test: sanitizeList(parsed?.self_test, 5),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    console.error('Erreur API Generate Summary:', error);
    const msg = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
