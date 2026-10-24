// app/api/pdf/extract/route.ts
// Route Next.js serverless pour l'extraction de texte depuis PDF, DOCX, PPTX
// Remplace: supabase/functions/embed-worker

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { extractText } from 'unpdf';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import PPT from 'ppt';
import { INTERNAL_AUTH_HEADER, signInternalRequest } from '@/lib/internalAuth';
import { enforceRateLimit, rateLimitErrorResponse } from '@/lib/rateLimit';
import { read as readCFB } from 'cfb';
import { EMBEDDING_CONFIG } from '@/lib/constants';

// Configuration pour gérer les gros fichiers
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes pour les gros fichiers
export const dynamic = 'force-dynamic';

// Configuration
const { CHUNK_SIZE, CHUNK_OVERLAP } = EMBEDDING_CONFIG;
const CHUNK_STORAGE_BUCKET = 'chunks';

// Types
interface ExtractPayload {
  filePath?: string;
  documentId: number;
  mimeType?: string;
}

interface TextSegment {
  text: string;
  page: number | null;
}

export interface ChunkPayload {
  content: string;
  pageStart: number | null;
  pageEnd: number | null;
}

// Fonction de découpage du texte
function createChunks(
  segments: TextSegment[],
  chunkSize: number,
  chunkOverlap: number
): ChunkPayload[] {
  if (chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap doit être plus petit que chunkSize');
  }

  const chunks: ChunkPayload[] = [];
  let buffer = '';
  let pageBuffer: number[] = [];
  let hasNewContent = false;

  const pushChunk = (length: number) => {
    const effectiveLength = Math.min(length, buffer.length);
    if (effectiveLength <= 0) {
      return;
    }

    const chunkText = buffer.slice(0, effectiveLength);
    const chunkPages = pageBuffer.slice(0, effectiveLength);
    const validPages = chunkPages.filter((p) => p > 0);
    const pageStart = validPages.length > 0 ? Math.min(...validPages) : null;
    const pageEnd = validPages.length > 0 ? Math.max(...validPages) : null;

    if (chunkText.trim().length === 0) {
      buffer = buffer.slice(effectiveLength);
      pageBuffer = pageBuffer.slice(effectiveLength);
      return;
    }

    chunks.push({
      content: chunkText,
      pageStart,
      pageEnd,
    });

    if (effectiveLength >= buffer.length) {
      buffer = '';
      pageBuffer = [];
    } else if (chunkOverlap > 0) {
      const start = Math.max(0, effectiveLength - chunkOverlap);
      buffer = buffer.slice(start);
      pageBuffer = pageBuffer.slice(start);
    } else {
      buffer = buffer.slice(effectiveLength);
      pageBuffer = pageBuffer.slice(effectiveLength);
    }
    hasNewContent = false;
  };

  const appendPiece = (piece: string, page: number | null) => {
    if (!piece) {
      return;
    }

    buffer += piece;
    const tag = page ?? -1;
    pageBuffer.push(...Array.from({ length: piece.length }, () => tag));
    hasNewContent = true;

    while (buffer.length >= chunkSize) {
      pushChunk(chunkSize);
    }
  };

  segments.forEach((segment) => {
    const text = segment.text?.trimEnd();
    if (!text || text.trim().length === 0) {
      return;
    }

    if (buffer.length > 0) {
      appendPiece('\n\n', segment.page);
    }

    appendPiece(text, segment.page);
  });

  if (hasNewContent && buffer.trim().length > 0) {
    pushChunk(buffer.length);
  }

  return chunks;
}

// Fonction pour extraire le texte d'un PDF
async function extractFromPDF(buffer: ArrayBuffer): Promise<string[]> {
  const uint8array = new Uint8Array(buffer);
  const { text: textPages } = await extractText(uint8array, {
    mergePages: false
  });
  return textPages.map((page) => page ?? '');
}

// Fonction pour extraire le texte d'un DOCX
async function extractFromDOCX(buffer: ArrayBuffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    let text = (result.value ?? '').toString();
    
    if (!text || text.trim().length === 0) {
      // Fallback: extraction manuelle via JSZip
      const zip = await JSZip.loadAsync(buffer);
      const docXml = zip.file('word/document.xml');
      const bodies: string[] = [];
      
      if (docXml) {
        const xml = await docXml.async('string');
        const plain = xml
          .replace(/<w:t[^>]*>/g, ' ')
          .replace(/<\/w:t>/g, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (plain) bodies.push(plain);
      }
      
      // Inclure entêtes/pieds
      for (const name of Object.keys(zip.files)) {
        if (/word\/(header\d+|footer\d+)\.xml$/.test(name)) {
          const file = zip.file(name);
          if (!file) continue;
          const xml = await file.async('string');
          const plain = xml
            .replace(/<w:t[^>]*>/g, ' ')
            .replace(/<\/w:t>/g, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (plain) bodies.push(plain);
        }
      }
      text = bodies.join('\n\n');
    }
    
    return text;
  } catch (error) {
    console.error('Erreur extraction DOCX:', error);
    throw new Error('Impossible d\'extraire le texte du fichier DOCX');
  }
}

// Fonction pour extraire le texte d'un PPTX
async function extractFromPPTX(buffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slidesFolder = zip.folder('ppt/slides');
  const slideFiles = slidesFolder 
    ? Object.keys(slidesFolder.files).filter((f) => f.endsWith('.xml')) 
    : [];
  
  const texts: string[] = [];
  for (const f of slideFiles) {
    const file = slidesFolder!.file(f);
    if (!file) continue;
    const xml = await file.async('string');
    const plain = xml
      .replace(/<a:t[^>]*>/g, ' ')
      .replace(/<\/a:t>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (plain) texts.push(plain);
  }
  
  return texts.join('\n\n');
}

async function extractFromPPT(buffer: ArrayBuffer): Promise<string[]> {
  try {
    const cfb = readCFB(Buffer.from(buffer), { type: 'buffer' });
    const presentation = PPT.parse_pptcfb(cfb, {});
    const toText = PPT?.utils && typeof PPT.utils.to_text === 'function'
      ? PPT.utils.to_text.bind(PPT.utils)
      : null;
    const rawSlides = toText ? (toText(presentation) as unknown[]) : [];

    return rawSlides
      .map((entry) => (typeof entry === 'string' ? entry : ''))
      .map((text) => text.replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 0);
  } catch (error) {
    console.error('Erreur extraction PPT:', error);
    throw new Error('Impossible d\'extraire le texte du fichier PPT');
  }
}

// Handler principal
export async function POST(req: Request) {
  let documentId: number | null = null;
  
  try {
    // 1. Vérifier la configuration Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnon || !supabaseServiceRole) {
      return NextResponse.json(
        { error: 'Configuration Supabase manquante' },
        { status: 503 }
      );
    }
    
    // 2. Créer les clients Supabase (session utilisateur + service admin)
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnon,
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
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    
    // 3. L'utilisateur doit être connecté : cette route utilise la clé service
    let authenticatedUserId: string | null = null;
    try {
      const { data } = await supabase.auth.getUser();
      authenticatedUserId = data.user?.id ?? null;
    } catch (authError) {
      console.warn('[PDF Extract] Impossible de récupérer la session utilisateur:', authError);
    }
    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }
    
    // 4. Parser le payload
    const body: ExtractPayload = await req.json().catch(() => ({} as ExtractPayload));
    const filePath = typeof body.filePath === 'string' ? body.filePath : undefined;
    const docId = Number(body.documentId);
    const mimeType = typeof body.mimeType === 'string' ? body.mimeType : undefined;
    documentId = docId;
    
    if (!Number.isFinite(documentId)) {
      return NextResponse.json(
        { error: 'Paramètres manquants (documentId)' },
        { status: 400 }
      );
    }
    
    // 5. Vérifier le document ciblé
    const { data: docData, error: docError } = await supabaseAdmin
      .from('documents')
      .select('user_id, file_path')
      .eq('id', documentId)
      .single();
    
    if (docError || !docData) {
      return NextResponse.json(
        { error: `Document introuvable: ${documentId}` },
        { status: 404 }
      );
    }
    
    if (docData.user_id !== authenticatedUserId) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
    }

    // Limitation de débit : au-delà, le document est marqué en échec avec un message clair
    // (sinon il resterait « en attente » indéfiniment côté interface).
    try {
      await enforceRateLimit(supabase, authenticatedUserId, 'document-process');
    } catch (limitError) {
      const limited = rateLimitErrorResponse(limitError);
      if (!limited) throw limitError;
      const message = limitError instanceof Error ? limitError.message : 'Limite atteinte.';
      await supabaseAdmin
        .from('documents')
        .update({ status: 'failed', status_message: message })
        .eq('id', documentId);
      return limited;
    }
    
    const storageFilePath = docData.file_path;
    if (filePath && storageFilePath !== filePath) {
      console.warn(`[PDF Extract] Doc ${documentId}: le chemin fourni (${filePath}) ne correspond pas au fichier enregistré (${storageFilePath}). Utilisation du chemin officiel.`);
    }
    
    // 5. Mettre à jour le statut du document
    const updateDocumentStatus = async (
      status: 'processing' | 'completed' | 'failed',
      message?: string
    ) => {
      await supabaseAdmin
        .from('documents')
        .update({ status, status_message: message || null })
        .eq('id', documentId);
    };
    
    await updateDocumentStatus('processing', 'Extraction du texte en cours...');
    
    // 6. Télécharger le fichier depuis Storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('pdfs')
      .download(storageFilePath);
      
    if (downloadError) {
      throw new Error(`Erreur téléchargement: ${downloadError.message}`);
    }
    
    const buffer = await fileData.arrayBuffer();
    
    // 7. Déterminer le type de fichier
    const lowerPath = (storageFilePath || '').toLowerCase();
    let type = (mimeType ?? '').toLowerCase();
    
    if (!type) {
      if (lowerPath.endsWith('.pdf')) {
        type = 'application/pdf';
      } else if (lowerPath.endsWith('.docx')) {
        type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (lowerPath.endsWith('.pptx')) {
        type = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      } else if (lowerPath.endsWith('.ppt')) {
        type = 'application/vnd.ms-powerpoint';
      }
    }
    
    if (!type) {
      throw new Error(`Type de fichier indéterminé pour ${storageFilePath}`);
    }
    
    // 8. Extraire le texte selon le type
    let text = '';
    
    await updateDocumentStatus('processing', `Analyse du fichier ${type.split('/')[1] || 'document'}...`);
    
    let segments: TextSegment[] = [];

    if (type === 'application/pdf') {
      const pages = await extractFromPDF(buffer);
      segments = pages.map((pageText, idx) => ({
        text: pageText ?? '',
        page: idx + 1,
      }));
    } else if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      text = await extractFromDOCX(buffer);
      segments = [{ text, page: null }];
    } else if (type === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      text = await extractFromPPTX(buffer);
      segments = [{ text, page: null }];
    } else if (
      type === 'application/vnd.ms-powerpoint' ||
      type === 'application/mspowerpoint' ||
      type === 'application/x-mspowerpoint' ||
      lowerPath.endsWith('.ppt')
    ) {
      const slides = await extractFromPPT(buffer);
      segments = slides.map((slideText, index) => ({
        text: slideText,
        page: index + 1,
      }));
    } else {
      throw new Error(`Type de fichier non pris en charge: ${type}`);
    }

    const aggregated = segments.map((s) => s.text).join('\n');
    if (!aggregated || aggregated.trim().length === 0) {
      throw new Error('Extraction du texte vide ou impossible');
    }
    
    // 9. Découper le texte en chunks
    await updateDocumentStatus('processing', 'Préparation des segments de texte...');
    const chunks = createChunks(segments, CHUNK_SIZE, CHUNK_OVERLAP);
    
    console.log(`[PDF Extract] Doc ${documentId}: ${chunks.length} chunks créés`);
    
    // 10. Sauvegarder les chunks dans le bucket temporaire
    const chunkFileName = `doc_${documentId}_chunks.json`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from(CHUNK_STORAGE_BUCKET)
      .upload(chunkFileName, JSON.stringify(chunks), {
        contentType: 'application/json',
        upsert: true,
      });
      
    if (uploadError) {
      throw new Error(`Erreur sauvegarde chunks: ${uploadError.message}`);
    }
    
    // 11. Déclencher le traitement optimisé par batch des embeddings
    await updateDocumentStatus('processing', 'Génération des embeddings (0%)...');
    
    // Lancer le traitement en arrière-plan via le handler interne
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || new URL(req.url).origin;

    const targetUrl = `${baseUrl}/api/pdf/embed-batch-optimized`;

    fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [INTERNAL_AUTH_HEADER]: signInternalRequest(`${documentId}:${chunkFileName}`),
      },
      body: JSON.stringify({
        documentId,
        chunkFilePath: chunkFileName,
        totalChunks: chunks.length,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[PDF Extract] Batch optimized failed:', errorData);
          throw new Error(`Embedding failed: ${JSON.stringify(errorData)}`);
        }
      })
      .catch(async (err) => {
        console.error('[PDF Extract] Erreur déclenchement batch optimisé:', err);
        // Update document status to failed
        if (documentId && supabaseAdmin) {
          try {
            await supabaseAdmin
              .from('documents')
              .update({
                status: 'failed',
                status_message: `Erreur embedding: ${err instanceof Error ? err.message : String(err)}`,
              })
              .eq('id', documentId);
            console.log(`[PDF Extract] Doc ${documentId} marqué comme failed`);
          } catch (updateErr) {
            console.error('[PDF Extract] Erreur mise à jour status:', updateErr);
          }
        }
      });
    
    // Logger l'activité pour le dashboard admin
    const { logActivity } = await import('@/lib/metricsLogger');
    await logActivity({
      eventType: 'document_processed',
      userId: docData.user_id ?? null,
      eventData: {
        documentId,
        filePath: storageFilePath,
        mimeType: type,
        chunkCount: chunks.length,
      },
    });
    
    return NextResponse.json({
      success: true,
      message: `Extraction réussie: ${chunks.length} segments créés`,
      chunks: chunks.length,
    });
    
  } catch (error: unknown) {
    console.error('[PDF Extract] Erreur:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erreur interne';
    
    // Mettre à jour le statut du document en cas d'erreur
    if (documentId) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (supabaseUrl && supabaseServiceRole) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        
        await supabaseAdmin
          .from('documents')
          .update({ status: 'failed', status_message: errorMessage })
          .eq('id', documentId);
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
