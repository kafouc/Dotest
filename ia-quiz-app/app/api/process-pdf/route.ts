// app/api/process-pdf/route.ts

import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const FUNCTION_NAME = 'embed-worker'; 

export async function POST(req: Request) {
    try {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error("Les clés Supabase sont manquantes dans les variables d'environnement.");
        }
        
        const body = await req.json();
        const { filePath, documentId } = body; 

        if (!filePath || !documentId) {
            return NextResponse.json({ error: 'Chemin du fichier ou ID de document manquant' }, { status: 400 });
        }
        
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

        const functionResponse = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 
            },
            body: JSON.stringify({ filePath, documentId }),
        });
        
        if (!functionResponse.ok) {
            const errorText = await functionResponse.text();
            console.error("Erreur Edge Function:", errorText);
            throw new Error(`Échec du démarrage de l'Edge Function. Statut: ${functionResponse.status}`);
        }

        return NextResponse.json({ success: true, message: "Analyse démarrée en arrière-plan" }, { status: 200 });

    } catch (error: unknown) { // <-- CORRECTION ICI (any -> unknown)
        console.error("Erreur API Process PDF:", error);
        // On vérifie le type de l'erreur
        const errorMessage = error instanceof Error ? error.message : "Erreur interne lors du déclenchement de l'analyse.";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}