// app/api/process-pdf/route.ts
// Route mise à jour pour utiliser les API routes Next.js au lieu des Edge Functions

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const filePath = typeof body?.filePath === 'string' ? body.filePath : '';
    const documentId = Number(body?.documentId);
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : undefined;

    if (!filePath || !Number.isFinite(documentId)) {
      return NextResponse.json(
        { error: 'Chemin du fichier ou ID de document manquant' },
        { status: 400 }
      );
    }

    const processUrl = new URL('/api/process-file', req.url);

    const processResponse = await fetch(processUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Deprecated': 'Use /api/process-file',
        ...(req.headers.get('cookie') ? { Cookie: req.headers.get('cookie') as string } : {}),
      },
      body: JSON.stringify({ filePath, documentId, mimeType }),
    });

    const payload = await processResponse.json().catch(() => ({}));
    return NextResponse.json(payload, { status: processResponse.status });
  } catch (error: unknown) {
    console.error('Erreur API Process PDF:', error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erreur interne lors du déclenchement de l'analyse.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
