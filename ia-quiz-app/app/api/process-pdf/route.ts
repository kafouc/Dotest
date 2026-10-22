// app/api/process-pdf/route.ts

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const FUNCTION_NAME = 'embed-worker';

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error(
        "Les clés Supabase sont manquantes dans les variables d'environnement."
      );
    }

    const body = await req.json();
    const { filePath, documentId } = body;

    if (!filePath || !documentId) {
      return NextResponse.json(
        { error: 'Chemin du fichier ou ID de document manquant' },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    });

    // 1. L'appelant doit être connecté
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // 2. Le document doit appartenir à l'appelant et correspondre au chemin fourni
    const { data: doc } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .eq('file_path', filePath)
      .maybeSingle();
    if (!doc) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    }

    // 3. On transmet le JWT de l'utilisateur (et non la clé anon publique) :
    //    l'edge function revérifie l'identité et la propriété du document.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

    const functionResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ filePath, documentId }),
    });

    if (!functionResponse.ok) {
      const errorText = await functionResponse.text();
      console.error('Erreur Edge Function:', errorText);
      throw new Error(
        `Échec du démarrage de l'Edge Function. Statut: ${functionResponse.status}`
      );
    }

    return NextResponse.json(
      { success: true, message: 'Analyse démarrée en arrière-plan' },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('Erreur API Process PDF:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erreur interne lors du déclenchement de l'analyse.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
