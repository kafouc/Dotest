-- Requête SQL pour vérifier l'état du traitement d'un document
-- À exécuter dans le SQL Editor de Supabase

-- 1. Voir les documents en cours de traitement
SELECT 
  id,
  file_name,
  status,
  status_message,
  created_at,
  EXTRACT(EPOCH FROM (now() - created_at)) / 60 as minutes_elapsed
FROM documents
WHERE status IN ('pending', 'processing')
  AND user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;

-- 2. Compter les chunks créés pour un document spécifique
-- Remplacez 'VOTRE_FILE_PATH' par le chemin du fichier
SELECT 
  document_path,
  COUNT(*) as chunk_count,
  MIN(created_at) as first_chunk_at,
  MAX(created_at) as last_chunk_at,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as seconds_to_process
FROM document_sections
WHERE document_path LIKE '%votre_nom_de_fichier%'
GROUP BY document_path;

-- 3. Voir tous les documents récents
SELECT 
  id,
  file_name,
  status,
  status_message,
  created_at
FROM documents
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- 4. Progression estimée (si disponible)
SELECT 
  d.id,
  d.file_name,
  d.status,
  d.status_message,
  COUNT(ds.id) as chunks_indexed,
  d.created_at
FROM documents d
LEFT JOIN document_sections ds ON ds.document_path = d.file_path
WHERE d.user_id = auth.uid()
  AND d.status IN ('processing', 'completed')
GROUP BY d.id, d.file_name, d.status, d.status_message, d.created_at
ORDER BY d.created_at DESC
LIMIT 5;
