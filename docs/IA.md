# Chaîne IA : modèles, recherche, génération, évaluation

## Modèles (lib/constants.ts → `AI_MODELS`)
| Usage | Modèle par défaut | Variable pour le changer (Vercel) |
|---|---|---|
| Quiz | `openai/gpt-oss-120b` | `GROQ_MODEL_QUIZ` |
| Fiche de révision | `openai/gpt-oss-120b` | `GROQ_MODEL_SUMMARY` |
| Thèmes | `openai/gpt-oss-20b` | `GROQ_MODEL_THEMES` |
| Embeddings | `jina-embeddings-v3` (1024 dim.) | — (changer = ré-indexer tous les documents) |
| Reclassement | `jina-reranker-v2-base-multilingual` | `JINA_RERANK_MODEL` |

**Pourquoi ce changement (24/10/2026)** : Groq a arrêté `qwen/qwen3-32b` (17/07/2026) et `llama-3.1-8b-instant` (16/08/2026),
les modèles que l'application utilisait : toute génération échouait. Pour qu'un retrait futur ne coûte qu'un changement de variable :
- `scripts/check-models.mjs` (`npm run check:models`) vérifie que les modèles configurés existent encore ; il est lancé chaque lundi par
  `.github/workflows/model-check.yml` (secret GitHub `GROQ_API_KEY`). GitHub vous écrit si le contrôle échoue.
- Si un appel échoue parce que le modèle n'existe plus, l'utilisateur reçoit un message clair (503) et une alerte
  `ai_model_unavailable` est enregistrée dans `ops_alerts` (envoyée au webhook s'il est configuré).
- Tarifs pour le « coût estimé » de l'admin : `GROQ_PRICES_PER_MILLION` dans `lib/aiUsage.ts` (à tenir à jour).

**Comparaison réelle du 24/10/2026** (`npm run eval:quiz`, 3 textes de référence, prompt v2) :

| Modèle | Quiz valides / demandés | Coût par quiz | Durée | Remarques |
|---|---|---|---|---|
| `openai/gpt-oss-120b` | 27/28 (96 %) | ≈ 0,0007 $ | 2 s | Fiable ; 1 question écartée (citation introuvable) ; instructions cachées ignorées |
| `openai/gpt-oss-20b` | 32/42 (76 %) avec schéma strict ; 18/28 sans | ≈ 0,0003 $ | 1 s | Erreurs `json_validate_failed` et 1 réponse mal formée ; retenu pour les **thèmes** seulement (5/5 valides) |
| `qwen/qwen3.8-27b` (aperçu) | 5/14 | plus cher (0,80 $ / 4,00 $ par M) | 2 s | Dépasse la limite de 1 000 jetons de sortie/min du palier gratuit : inutilisable |

Choix : **120b pour les quiz et les fiches** (le plus puissant disponible, et déjà le moins cher de sa catégorie : 0,15 $ / 0,60 $ par million de jetons),
**20b pour les thèmes**. Un quiz coûte moins d'un millième de dollar : la qualité prime sur le coût.

## Limites du palier gratuit de Groq (à connaître)
- **8 000 jetons par minute** et **1 000 requêtes par jour** par modèle, pour *tous* les utilisateurs de l'application réunis : environ 3 quiz par minute.
- Au-delà, Groq répond 429. L'application attend si le délai est court (≤ 12 s) puis réessaie une fois ; sinon l'utilisateur voit
  « Le service de génération est très sollicité. Réessayez dans N s » (code `ai-busy`).
- Le palier « Developer » de Groq (paiement à l'usage) lève ces plafonds : voir `docs/PLAN_PRO.md`.

Les modèles `openai/gpt-oss-*` sont des modèles de raisonnement : on règle `reasoning_effort: 'low'`, le raisonnement est exclu de la
réponse, et `max_completion_tokens` borne le coût (`AI_OUTPUT_LIMITS`). Le raisonnement compte dans ces jetons.

## Recherche dans les documents (lib/retrieval.ts)
1. Recherche **hybride** en base (`hybrid_search_document_sections`, migration `20261025090000_hybrid_search.sql`) : similarité vectorielle
   + mots-clés français (index plein texte), fusionnées par rang (RRF). 24 candidats.
2. **Reclassement** Jina des candidats, 8 passages gardés. Si le reclassement échoue, l'ordre de la recherche hybride est conservé.
3. Tant que la migration n'est pas appliquée, repli automatique sur `match_document_sections` (vecteurs seuls).
Le mode utilisé (`hybrid+rerank`, `hybrid`, `vector+rerank`, `vector`) est enregistré dans `metrics_ai_usage_events.metadata.retrieval`.

## Génération des quiz (lib/quizGeneration.ts)
- Passages **numérotés avec leurs pages** ; le modèle indique pour chaque question le passage (`source`) et une **citation copiée mot pour mot** (`citation`).
- Les modèles gpt-oss reçoivent un **schéma JSON strict** (`quizResponseFormat`) : la sortie est garantie conforme ; si Groq refuse quand même un JSON invalide
  (`json_validate_failed`), la génération est relancée.
- Contrôles côté serveur : citation retrouvée dans les passages (exacte, ou ≥ 85 % des mots dans l'ordre), bonne réponse désignant bien une proposition,
  doublons écartés, propositions **mélangées** (les modèles placent la bonne réponse en A ou B trop souvent).
- Une question dont la citation est introuvable est **écartée** : mieux vaut 4 questions vérifiables que 5 dont une inventée.
  Si moins de 60 % des questions survivent, une seconde passe complète le quiz sans reposer les mêmes questions.
- Chaque question porte `source` (pages) et `evidence` (extrait) : affichés après la réponse et dans les exports. `evidence` contient la réponse :
  elle est retirée des quiz partagés en live (`createSharedQuiz`, route `/api/live-quiz`, fonction SQL `get_public_quiz`).
- Les passages sont traités comme des **données** : le prompt demande d'ignorer toute instruction qu'ils contiennent.
- La fiche de révision indique les pages utilisées (`sources`, calculées par le serveur, jamais par l'IA).

## Coût
- Question ou thème déjà vu → embedding servi par un cache mémoire (1 h, 200 entrées par instance).
- Thèmes d'un document → cache mémoire 30 min (une réouverture ne repaie pas une génération et ne consomme pas le quota).
- Sorties plafonnées par `AI_OUTPUT_LIMITS` ; coût estimé par appel enregistré (`metrics_ai_usage_events.cost`, 4 décimales).

## Évaluer avant de changer (scripts/eval-quiz.ts)
```bash
GROQ_API_KEY=… npm run eval:quiz                                  # 3 textes de référence (evals/quiz/fixtures)
GROQ_API_KEY=… GROQ_MODEL_QUIZ=openai/gpt-oss-20b npm run eval:quiz -- --runs 3   # autre modèle, 3 essais
```
Mesures : questions produites/demandées, écartées (citation introuvable, réponse invalide, doublons), citations approximatives, répartition de la lettre
de la bonne réponse, coût, durée, et résistance à des instructions cachées dans le cours (`injection.json`). Détail dans `evals/results/` (non versionné).
Pour ajouter un cas : un fichier JSON dans `evals/quiz/fixtures/` avec des extraits de vos vrais cours.

## À étudier plus tard (changent l'indexation, à évaluer d'abord)
- `jina-embeddings-v5-*` (recommandé par Jina pour la production) et le paramètre `task` (`retrieval.query` / `retrieval.passage`) : gain probable,
  mais impose de ré-indexer tous les documents.
- Notation à la main d'un jeu de 20 documents réels pour comparer les modèles sur la qualité perçue, pas seulement sur les contrôles automatiques.
