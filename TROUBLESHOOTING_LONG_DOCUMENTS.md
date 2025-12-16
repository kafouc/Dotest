# 🐛 Guide de dépannage - Document de 217 pages bloqué en traitement

## 🔍 Diagnostic du problème

Votre document de 217 pages est en cours d'analyse depuis 10+ minutes. Voici comment diagnostiquer et résoudre le problème.

---

## ✅ Étape 1: Vérifier l'état dans Supabase

1. Allez dans le **SQL Editor** de votre dashboard Supabase
2. Exécutez cette requête pour voir l'état du document:

```sql
SELECT 
  id,
  file_name,
  status,
  status_message,
  created_at,
  EXTRACT(EPOCH FROM (now() - created_at)) / 60 as minutes_elapsed
FROM documents
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;
```

**Interprétation des statuts:**
- `pending` → Document uploadé, en attente de traitement
- `processing` → Traitement en cours (extraction ou embeddings)
- `completed` → Terminé avec succès ✅
- `failed` → Erreur pendant le traitement ❌

---

## ✅ Étape 2: Vérifier les chunks créés

Un document de 217 pages devrait créer environ **2000-3000 chunks**. Vérifiez combien ont été indexés:

```sql
SELECT 
  document_path,
  COUNT(*) as chunks_created,
  MIN(created_at) as first_chunk,
  MAX(created_at) as last_chunk,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as seconds_elapsed
FROM document_sections
WHERE document_path LIKE '%votre_nom_fichier%'
GROUP BY document_path;
```

**Temps estimés:**
- 217 pages ≈ 2500 chunks
- Traitement par batch de 50 chunks
- Environ **50 batches** à traiter
- **Temps total estimé: 15-25 minutes** (selon la charge Cohere API)

---

## ✅ Étape 3: Vérifier les logs Vercel

Si vous êtes déployé sur Vercel:

1. Allez sur https://vercel.com/dashboard
2. Sélectionnez votre projet
3. Onglet **Functions** → Cherchez:
   - `/api/pdf/extract`
   - `/api/pdf/embed-batch`
4. Regardez les logs pour voir:
   - Messages d'erreur
   - Timeouts (max 300s configuré)
   - Limites de mémoire dépassées

---

## 🚨 Problèmes courants et solutions

### Problème 1: Timeout après 10 minutes (600s)
**Symptôme:** Document bloqué en `processing`

**Cause:** Vercel Free limite à 10s par fonction (Pro: 300s)

**Solution:**
```bash
# Vérifier votre plan Vercel
# Si Free → Upgrade vers Pro pour 300s max duration
```

### Problème 2: Erreur "Rate limit exceeded" (Cohere)
**Symptôme:** Document passe en `failed` avec message d'erreur

**Cause:** Trop de requêtes Cohere API

**Solution:**
```typescript
// Réduire BATCH_SIZE dans /app/api/pdf/embed-batch/route.ts
const BATCH_SIZE = 25; // Au lieu de 50
```

### Problème 3: Mémoire insuffisante
**Symptôme:** Fonction crash sans message clair

**Cause:** Document trop volumineux pour la mémoire allouée

**Solution:**
```json
// vercel.json - Augmenter la mémoire
{
  "functions": {
    "app/api/pdf/extract/route.ts": {
      "memory": 3008  // Maximum sur Vercel Pro
    }
  }
}
```

### Problème 4: Bucket "chunks" inexistant
**Symptôme:** Erreur "Bucket not found"

**Solution:**
1. Dashboard Supabase → Storage
2. Create bucket: `chunks`
3. Public: Non
4. Max size: 10 Mo

---

## 🔧 Actions immédiates

### 1. Vérifier si le traitement continue
```bash
# Exécuter dans SQL Editor toutes les 30 secondes
SELECT 
  COUNT(*) as chunks_indexed,
  MAX(created_at) as last_chunk_time
FROM document_sections
WHERE document_path LIKE '%votre_fichier%';
```

Si `chunks_indexed` augmente → Le traitement est en cours ✅
Si bloqué depuis 5+ min → Problème ❌

### 2. Forcer la réinitialisation du document
```sql
-- Supprimer le document bloqué
DELETE FROM documents WHERE id = VOTRE_DOCUMENT_ID AND user_id = auth.uid();

-- Supprimer les chunks partiels
DELETE FROM document_sections WHERE document_path LIKE '%votre_fichier%';
```

Puis **retéléversez** le document.

---

## 📊 Monitoring en temps réel

### Option 1: API de statut (nouveau)
```bash
# Appeler depuis votre navigateur ou curl
curl "http://localhost:3000/api/documents/status?id=VOTRE_DOCUMENT_ID"
```

Réponse:
```json
{
  "id": 123,
  "file_name": "cours.pdf",
  "status": "processing",
  "status_message": "Génération des embeddings (45%)...",
  "chunks_indexed": 1125,
  "elapsed_minutes": 12,
  "created_at": "2025-12-15T10:30:00Z"
}
```

### Option 2: SQL avec auto-refresh
```sql
-- Exécuter toutes les 10 secondes
SELECT 
  d.file_name,
  d.status,
  d.status_message,
  COUNT(ds.id) as chunks,
  ROUND(EXTRACT(EPOCH FROM (now() - d.created_at)) / 60) as minutes
FROM documents d
LEFT JOIN document_sections ds ON ds.document_path = d.file_path
WHERE d.user_id = auth.uid()
  AND d.status IN ('processing', 'pending')
GROUP BY d.id, d.file_name, d.status, d.status_message, d.created_at
ORDER BY d.created_at DESC;
```

---

## 🎯 Configuration recommandée pour gros documents

### vercel.json
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
  }
}
```

### Variables d'environnement
```bash
# .env.local
COHERE_API_KEY=votre_cle_cohere
GROQ_API_KEY=votre_cle_groq
NEXT_PUBLIC_SUPABASE_URL=votre_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle
```

---

## 📞 Support

Si le problème persiste après 30 minutes:

1. **Vérifier Cohere Dashboard:**
   - https://dashboard.cohere.com/usage
   - Limites de taux dépassées?

2. **Logs Vercel:**
   - Timeouts?
   - Erreurs mémoire?

3. **Réessayer avec un document plus petit:**
   - Testez avec 50 pages d'abord
   - Si ça fonctionne → Le problème vient de la taille

---

## ✅ Checklist de vérification

- [ ] Document existe dans la table `documents`
- [ ] Statut = `processing` (pas `failed`)
- [ ] Bucket `chunks` existe dans Supabase Storage
- [ ] Bucket `pdfs` a max size = 50 Mo
- [ ] Variables d'environnement configurées
- [ ] Vercel: Fonction maxDuration = 300s
- [ ] Cohere API Key valide
- [ ] Pas de rate limit sur Cohere

---

**Temps estimé total pour 217 pages: 15-25 minutes** ⏱️

Si après **30 minutes** le document n'est pas `completed`, supprimez-le et réessayez.
