-- ============================================================
-- Recherche hybride dans les documents : similarité vectorielle + mots-clés (français),
-- fusionnées par rang (Reciprocal Rank Fusion). La recherche vectorielle seule rate les termes
-- précis (formules, noms propres, sigles) ; la recherche par mots-clés rate les paraphrases.
--
-- Le reclassement final est fait côté application (Jina reranker).
-- L'application retombe sur match_document_sections tant que cette migration n'est pas appliquée.
-- ============================================================

-- Colonne de recherche plein texte, calculée par la base (aucun changement d'écriture dans l'application)
alter table public.document_sections
  add column if not exists fts tsvector
  generated always as (to_tsvector('french', coalesce(content, ''))) stored;

create index if not exists idx_document_sections_fts on public.document_sections using gin (fts);

create or replace function public.hybrid_search_document_sections(
  query_embedding vector,
  query_text text,
  match_count integer default 24,
  p_user_id uuid default null,
  p_document_path text default null,
  p_page_start integer default null,
  p_page_end integer default null,
  vector_threshold double precision default 0.2
)
returns table (
  id bigint,
  content text,
  document_path text,
  page_start integer,
  page_end integer,
  similarity double precision,
  text_rank real,
  rrf_score double precision
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  with params as (
    select
      least(greatest(coalesce(match_count, 24), 1), 100) as n,
      -- Requête « OU » : une question en langage naturel ne doit pas exiger tous les mots à la fois
      nullif(replace(plainto_tsquery('french', coalesce(query_text, ''))::text, ' & ', ' | '), '')::tsquery as tsq
  ),
  filtered as (
    select ds.id, ds.content, ds.document_path, ds.page_start, ds.page_end, ds.embedding, ds.fts
    from public.document_sections ds
    where ds.embedding is not null
      and (p_user_id is null or ds.user_id = p_user_id)
      and (p_document_path is null or ds.document_path = p_document_path)
      and (p_page_start is null or ds.page_end is null or ds.page_end >= p_page_start)
      and (p_page_end is null or ds.page_start is null or ds.page_start <= p_page_end)
  ),
  vec as (
    select f.id,
           1 - (f.embedding <=> query_embedding) as similarity,
           row_number() over (order by f.embedding <=> query_embedding) as rnk
    from filtered f
    where 1 - (f.embedding <=> query_embedding) >= coalesce(vector_threshold, 0)
    order by f.embedding <=> query_embedding
    limit (select n * 2 from params)
  ),
  kw as (
    select f.id,
           ts_rank_cd(f.fts, p.tsq) as text_rank,
           row_number() over (order by ts_rank_cd(f.fts, p.tsq) desc) as rnk
    from filtered f, params p
    where p.tsq is not null and f.fts @@ p.tsq
    order by text_rank desc
    limit (select n * 2 from params)
  )
  select f.id, f.content, f.document_path, f.page_start, f.page_end,
         v.similarity,
         coalesce(k.text_rank, 0)::real as text_rank,
         coalesce(1.0 / (60 + v.rnk), 0) + coalesce(1.0 / (60 + k.rnk), 0) as rrf_score
  from filtered f
  left join vec v on v.id = f.id
  left join kw k on k.id = f.id
  where v.id is not null or k.id is not null
  order by rrf_score desc
  limit (select n from params);
$$;

-- Appelée avec la session de l'utilisateur (RLS appliquée) : pas d'accès pour les visiteurs
revoke all on function public.hybrid_search_document_sections(vector, text, integer, uuid, text, integer, integer, double precision) from public, anon;
grant execute on function public.hybrid_search_document_sections(vector, text, integer, uuid, text, integer, integer, double precision) to authenticated, service_role;

-- ------------------------------------------------------------
-- Les questions peuvent maintenant porter une citation (`evidence`) qui contient la réponse :
-- elle ne doit jamais être servie aux élèves d'un quiz partagé.
-- ------------------------------------------------------------
create or replace function public.get_public_quiz(p_share_code text)
returns jsonb
language sql
stable security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id', sq.id,
    'title', sq.title,
    'share_code', sq.share_code,
    'questions', coalesce(
      (
        select jsonb_agg(q - 'reponse_correcte' - 'reponses_correctes' - 'justification' - 'evidence' order by ord)
        from jsonb_array_elements(sq.questions) with ordinality as t(q, ord)
      ),
      '[]'::jsonb
    )
  )
  from public.shared_quizzes sq
  where sq.share_code = upper(p_share_code)
    and sq.is_active = true
    and (sq.expires_at is null or sq.expires_at > now());
$$;
