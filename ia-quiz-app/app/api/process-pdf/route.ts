// app/api/process-pdf/route.ts

import { NextResponse } from 'next/server';

// L'URL de votre Edge Function est fixe pour votre projet
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Le nom de la fonction que nous avons créée
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
        
        // Construction de l'URL de l'Edge Function
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`;

        // Appel à l'Edge Function, en passant les infos nécessaires
        const functionResponse = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Clé publique nécessaire pour appeler les fonctions (anonyme)
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 
            },
            body: JSON.stringify({ filePath, documentId }),
        });
        
        // L'Edge Function renvoie immédiatement un 200 si la tâche démarre
        if (!functionResponse.ok) {
            const errorText = await functionResponse.text();
            console.error("Erreur Edge Function:", errorText);
            throw new Error(`Échec du démarrage de l'Edge Function. Statut: ${functionResponse.status}`);
        }

        // Succès : La tâche est lancée en arrière-plan
        return NextResponse.json({ success: true, message: "Analyse démarrée en arrière-plan" }, { status: 200 });

    } catch (error: any) {
        console.error("Erreur API Process PDF:", error);
        return NextResponse.json({ error: error.message || "Erreur interne lors du déclenchement de l'analyse." }, { status: 500 });
    }
}