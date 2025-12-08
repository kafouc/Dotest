import { NextResponse } from 'next/server';

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
    const { filePath, documentId, mimeType } = body as { filePath?: string; documentId?: number; mimeType?: string };

    if (!filePath || !documentId) {
      return NextResponse.json(
        { error: 'Chemin du fichier ou ID de document manquant' },
        { status: 400 }
      );
    }

    // Vérifie le type et détermine la stratégie de traitement
    const type = (mimeType || '').toLowerCase();
    const lowerPath = (filePath || '').toLowerCase();
    const supported = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    ];
    if (!supported.includes(type)) {
      // Fallback par extension si le type MIME est manquant côté navigateur
      if (lowerPath.endsWith('.pdf')) {
        // ok
      } else if (lowerPath.endsWith('.docx')) {
        // ok
      } else if (lowerPath.endsWith('.pptx')) {
        // ok
      } else {
      return NextResponse.json(
        { error: 'Type de fichier non pris en charge (PDF, DOCX, PPTX).' },
        { status: 415 }
      );
      }
    }

    // Pour .docx et .pptx, la fonction `embed-worker` doit extraire le texte
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

    const functionResponse = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ filePath, documentId, mimeType: type }),
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
    console.error('Erreur API Process File:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne lors du déclenchement de l\'analyse.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
