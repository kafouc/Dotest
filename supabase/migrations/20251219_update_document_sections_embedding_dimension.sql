-- Met à jour la dimension des embeddings pour utiliser jina-embeddings-v3 (1024)
BEGIN;

-- Autorise temporairement les valeurs NULL sur la colonne d'embedding et remet à zéro les anciens vecteurs.
ALTER TABLE public.document_sections
  ALTER COLUMN embedding DROP NOT NULL;

UPDATE public.document_sections
SET embedding = NULL
WHERE embedding IS NOT NULL;

-- Ajuste la dimension du vecteur stocké.
ALTER TABLE public.document_sections
  ALTER COLUMN embedding TYPE vector(1024);

-- Met à jour la fonction de correspondance pour accepter la nouvelle dimension.
CREATE OR REPLACE FUNCTION public.match_document_sections(
  query_embedding vector(1024),
  match_threshold double precision DEFAULT 0,
  match_count integer DEFAULT 10,
  p_user_id uuid DEFAULT NULL,
  p_document_path text DEFAULT NULL,
  p_page_start integer DEFAULT NULL,
  p_page_end integer DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  content text,
  document_path text,
  similarity double precision,
  page_start integer,
  page_end integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  effective_limit integer := LEAST(GREATEST(match_count, 1), 200);
BEGIN
  RETURN QUERY
  SELECT
    ds.id,
    ds.content,
    ds.document_path,
    1 - (ds.embedding <=> query_embedding) AS similarity,
    ds.page_start,
    ds.page_end
  FROM public.document_sections AS ds
  WHERE ds.embedding IS NOT NULL
    AND (p_user_id IS NULL OR ds.user_id = p_user_id)
    AND (p_document_path IS NULL OR ds.document_path = p_document_path)
    AND (p_page_start IS NULL OR ds.page_end IS NULL OR ds.page_end >= p_page_start)
    AND (p_page_end IS NULL OR ds.page_start IS NULL OR ds.page_start <= p_page_end)
    AND (
      match_threshold IS NULL
      OR 1 - (ds.embedding <=> query_embedding) >= match_threshold
    )
  ORDER BY ds.embedding <=> query_embedding
  LIMIT effective_limit;
END;
$$;

COMMIT;
