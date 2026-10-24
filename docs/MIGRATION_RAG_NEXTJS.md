# Configuration Next.js pour fichiers volumineux

## Configuration requise pour gérer des PDFs de 500 pages (50 Mo)

### 1. next.config.mjs

Ajoutez ou modifiez les configurations suivantes :

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuration pour les API routes
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Augmente la limite de taille des requêtes
    },
    responseLimit: false, // Désactive la limite de réponse
  },

  // Configuration pour les fichiers volumineux
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
```

### 2. vercel.json

Si vous déployez sur Vercel, configurez :

```json
{
  "functions": {
    "app/api/pdf/extract/route.ts": {
      "maxDuration": 300,
      "memory": 3008
    },
    "app/api/pdf/embed-batch/route.ts": {
      "maxDuration": 300,
      "memory": 3008
    }
  },
  "api": {
    "bodyParser": {
      "sizeLimit": "50mb"
    }
  }
}
```

### 3. Variables d'environnement

Assurez-vous que ces variables sont bien définies :

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=votre_url_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon
SERVICE_ROLE_KEY=votre_service_role_key

# IA
COHERE_API_KEY=votre_cle_cohere
GROQ_API_KEY=votre_cle_groq
```

### 4. Supabase Storage - Configuration du bucket "pdfs"

Dans le dashboard Supabase > Storage > Buckets :

1. Cliquez sur le bucket `pdfs`
2. Settings > Maximum file size: **52428800** (50 Mo)
3. RLS Policy : Assurez-vous que les utilisateurs authentifiés peuvent uploader

### 5. Supabase Storage - Bucket "chunks"

Créez un bucket `chunks` pour stocker temporairement les fichiers JSON :

1. Storage > Create bucket
2. Name: `chunks`
3. Public: Non
4. Maximum file size: 10485760 (10 Mo)
5. Allowed MIME types: application/json

### 6. Installation des dépendances

```bash
npm install unpdf mammoth jszip cohere-ai
```

### 7. Base de données - Table document_sections

Vérifiez que la table existe avec les bonnes colonnes :

```sql
CREATE TABLE IF NOT EXISTS public.document_sections (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(1024), -- Dimension des vecteurs Cohere
  document_path text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index pour recherche vectorielle
CREATE INDEX IF NOT EXISTS document_sections_embedding_idx 
ON public.document_sections 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index pour filtrage par utilisateur
CREATE INDEX IF NOT EXISTS document_sections_user_id_idx 
ON public.document_sections(user_id);
```

### 8. Architecture de traitement

L'architecture a été migrée vers Next.js serverless :

```
Upload → /api/pdf/extract → Découpage en chunks → /api/pdf/embed-batch
                                                     ↓ (récursif par lots de 50)
                                                     Cohere Embeddings
                                                     ↓
                                                     Stockage dans document_sections
```

**Avantages :**
- ✅ Pas de limite de 10 Mo des Edge Functions
- ✅ Traitement par batch pour éviter les timeouts
- ✅ Support de PDFs jusqu'à 500 pages
- ✅ Progression visible en temps réel
- ✅ Meilleure gestion d'erreurs

### 9. Monitoring

Pour suivre l'avancement d'un document :

```sql
SELECT id, file_name, status, status_message, created_at
FROM documents
WHERE user_id = auth.uid()
ORDER BY created_at DESC;
```

### 10. Dépannage

**Erreur "Payload too large" :**
- Vérifiez `next.config.mjs` → `api.bodyParser.sizeLimit`
- Vérifiez Vercel settings → Function size limit

**Timeout pendant l'extraction :**
- Les routes ont `maxDuration: 300` (5 minutes)
- Si insuffisant, augmentez dans Vercel Pro/Enterprise

**Erreur Cohere "Rate limit" :**
- Le traitement par batch (50 chunks) respecte les limites
- Si nécessaire, réduisez `BATCH_SIZE` dans `/api/pdf/embed-batch/route.ts`

### 11. Migration depuis Edge Functions

Les anciennes Edge Functions ne sont **plus utilisées** :
- ❌ `supabase/functions/embed-worker` → ✅ `/api/pdf/extract`
- ❌ `supabase/functions/process-batch` → ✅ `/api/pdf/embed-batch`

Vous pouvez supprimer le dossier `supabase/functions` si vous le souhaitez.

### 12. Test de la migration

1. Téléversez un PDF volumineux (500 pages, ~50 Mo)
2. Vérifiez le statut dans la table `documents`
3. Suivez la progression via `status_message`
4. Une fois terminé, générez un quiz à partir de ce document

---

**Migration terminée ! L'application peut maintenant traiter des documents de 500 pages maximum. 🎉**
