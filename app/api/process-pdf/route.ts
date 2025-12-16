// app/api/process-pdf/route.ts
// Route mise à jour pour utiliser les API routes Next.js au lieu des Edge Functions

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { filePath, documentId, mimeType } = body;

    if (!filePath || !documentId) {
      return NextResponse.json(
        { error: 'Chemin du fichier ou ID de document manquant' },
        { status: 400 }
      );
    }

    // Appeler notre nouvelle route d'extraction Next.js
    const extractUrl = new URL('/api/pdf/extract', req.url);
    
    const extractResponse = await fetch(extractUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        filePath, 
        documentId, 
        mimeType: mimeType || 'application/pdf' 
      }),
    });

    if (!extractResponse.ok) {
      const errorData = await extractResponse.json();
      throw new Error(
        errorData.error || `Échec de l'extraction. Statut: ${extractResponse.status}`
      );
    }

    const result = await extractResponse.json();

    return NextResponse.json(
      { 
        success: true, 
        message: 'Analyse démarrée en arrière-plan',
        chunks: result.chunks 
      },
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
