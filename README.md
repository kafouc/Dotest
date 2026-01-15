# SheetOfPaper (ia-quiz-app)

Plateforme d’analyse de documents pour générer des quiz, fiches de révision et flashcards.

## Fonctionnalités clés
- Upload PDF / DOCX / PPTX / PPT
- Extraction texte + segmentation (chunks)
- Génération d’embeddings (Jina)
- Génération de quiz (Groq) + fiches de révision
- Notifications push (FSRS)
- Paiement Stripe (plans freemium / partiel / pro)

## Stack
- Next.js 14 (App Router)
- Supabase (Auth, Storage, DB, RPC)
- Stripe
- Jina embeddings
- Groq LLM
- Tailwind CSS

## Prérequis
- Node.js 18+
- Supabase (local ou projet distant)
- Clés Stripe, Jina, Groq

## Installation
```bash
npm install
```

## Démarrage (dev)
```bash
npm run dev
```

## Build
```bash
npm run build
npm start
```

## Variables d’environnement (extraits)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_PARTIAL
- STRIPE_PRICE_PRO
- GROQ_API_KEY
- JINA_API_KEY
- NEXT_PUBLIC_VAPID_PUBLIC_KEY
- VAPID_PRIVATE_KEY

## Dossiers importants
- app/api : routes API
- lib : logique métier
- supabase : migrations et fonctions
- components : UI

## Notes
- Le traitement des documents se fait via /api/process-file → /api/pdf/extract → /api/pdf/embed-batch-optimized.
- Les plans sont appliqués via la table user_plans et RPC set_user_plan.
