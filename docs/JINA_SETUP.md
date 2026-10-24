# Migration vers Jina Embeddings

1. Définir la variable d'environnement `JINA_API_KEY` (et éventuellement `JINA_API_URL` si vous utilisez un endpoint privé), puis redémarrer les services pour qu'elle soit prise en compte.
2. Exécuter la migration `supabase/migrations/20251219_update_document_sections_embedding_dimension.sql` afin d'ajuster la colonne `document_sections.embedding` à vector(1024) et mettre à jour la fonction `match_document_sections`.
3. Réindexer les documents existants (relancer l'upload ou un job de ré-embedding) car les anciens vecteurs sont remis à `NULL`.
4. Vérifier les routes `/api/pdf/embed-batch`, `/api/pdf/embed-batch-optimized`, `/api/embed`, `/api/generate-summary` et `/api/generate-quiz` pour confirmer que les embeddings Jina sont acceptés et que les métriques d'usage enregistrent le provider `jina`.
