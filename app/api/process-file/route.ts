// app/api/process-file/route.ts
// Route mise à jour pour utiliser la nouvelle architecture Next.js serverless
// Remplace l'appel aux Edge Functions Supabase par les API routes Next.js

import { NextResponse } from 'next/server';
import { parseJsonBody, processFileSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const parsedBody = await parseJsonBody(req, processFileSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const { filePath, documentId, mimeType } = parsedBody.data;

    // Vérifier le type de fichier supporté
    const type = (mimeType || '').toLowerCase();
    const lowerPath = (filePath || '').toLowerCase();
    const supported = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint',
      'application/mspowerpoint',
      'application/x-mspowerpoint',
    ];
    
    const isSupported = supported.includes(type) || 
                       lowerPath.endsWith('.pdf') || 
                       lowerPath.endsWith('.docx') || 
                       lowerPath.endsWith('.pptx') ||
                       lowerPath.endsWith('.ppt');

    if (!isSupported) {
      return NextResponse.json(
        { error: 'Type de fichier non pris en charge (PDF, DOCX, PPTX, PPT).' },
        { status: 415 }
      );
    }

    // Déterminer l'origine pour l'appel interne (dev -> localhost, prod -> domaine Vercel)
    const defaultDevPort = process.env.PORT ?? '3000';
    const devOrigin = `http://127.0.0.1:${defaultDevPort}`;
    const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
    const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL;

    const origin = configuredOrigin || vercelOrigin || devOrigin;
    const extractUrl = `${origin}/api/pdf/extract`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const extractResponse = await fetch(extractUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        filePath, 
        documentId, 
        mimeType: type 
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
    console.error('Erreur API Process File:', error);
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Erreur interne lors du déclenchement de l\'analyse.';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
