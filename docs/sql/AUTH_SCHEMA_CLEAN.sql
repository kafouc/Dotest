-- ============================================================
-- SCHÉMA D'AUTHENTIFICATION SUPABASE POUR SHEET OF PAPER
-- Projet: Plateforme de quiz et flashcards avec sessions en temps réel
-- Date: 2025-12-15
-- ============================================================

-- ⚠️⚠️⚠️ ATTENTION - DOCUMENT DE RÉFÉRENCE UNIQUEMENT ⚠️⚠️⚠️
--
-- CE FICHIER NE DOIT PAS ÊTRE EXÉCUTÉ !
--
-- Les tables auth.* sont gérées automatiquement par Supabase.
-- Vous n'avez PAS la permission de les créer ou modifier.
-- Ce fichier est un GUIDE pour comprendre le schéma existant.
--
-- Pour inspecter le schéma auth de votre base de données,
-- utilisez le fichier: AUTH_SCHEMA_INSPECT.sql
--
-- ============================================================

-- Ce fichier décrit les tables auth.* créées automatiquement par Supabase Auth
-- et les connexions avec vos tables publiques (shared_quizzes, etc.)

-- ============================================================
-- 1. TABLE PRINCIPALE: auth.users
-- ============================================================
-- Contient tous les utilisateurs de l'application
-- Créée automatiquement par Supabase Auth

CREATE TABLE IF NOT EXISTS auth.users (
  -- Identifiants
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid,
  aud character varying(255),
  role character varying(255),
  
  -- Email et authentification
  email character varying(255) UNIQUE,
  encrypted_password character varying(255),
  email_confirmed_at timestamptz,
  
  -- Tokens de confirmation
  confirmation_token character varying(255),
  confirmation_sent_at timestamptz,
  confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
  
  -- Récupération de mot de passe
  recovery_token character varying(255),
  recovery_sent_at timestamptz,
  
  -- Changement d'email
  email_change character varying(255),
  email_change_token_new character varying(255),
  email_change_token_current character varying(255) DEFAULT '',
  email_change_sent_at timestamptz,
  email_change_confirm_status smallint DEFAULT 0 CHECK (email_change_confirm_status >= 0 AND email_change_confirm_status <= 2),
  
  -- Téléphone (optionnel, non utilisé dans votre projet)
  phone text DEFAULT NULL UNIQUE,
  phone_confirmed_at timestamptz,
  phone_change text DEFAULT '',
  phone_change_token character varying(255) DEFAULT '',
  phone_change_sent_at timestamptz,
  
  -- Ré-authentification
  reauthentication_token character varying(255) DEFAULT '',
  reauthentication_sent_at timestamptz,
  
  -- Métadonnées
  raw_app_meta_data jsonb,     -- Données de l'app (roles, etc.)
  raw_user_meta_data jsonb,    -- Données utilisateur (nom, avatar, etc.)
  
  -- Flags
  is_super_admin boolean,
  is_sso_user boolean NOT NULL DEFAULT false,
  is_anonymous boolean NOT NULL DEFAULT false,
  
  -- Gestion
  banned_until timestamptz,
  deleted_at timestamptz,
  
  -- Horodatage
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_sign_in_at timestamptz,
  invited_at timestamptz
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS users_instance_id_idx ON auth.users(instance_id);
CREATE INDEX IF NOT EXISTS users_email_idx ON auth.users(email);
CREATE INDEX IF NOT EXISTS users_is_anonymous_idx ON auth.users(is_anonymous);


-- ============================================================
-- 2. TABLE: auth.sessions
-- ============================================================
-- Gère les sessions actives des utilisateurs

CREATE TABLE IF NOT EXISTS auth.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Informations de session
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  refreshed_at timestamp without time zone,
  not_after timestamptz,
  
  -- Sécurité
  factor_id uuid,
  aal auth.aal_level,  -- Authentication Assurance Level (aal1, aal2, aal3)
  
  -- Métadonnées de connexion
  user_agent text,
  ip inet,
  tag text,
  
  -- OAuth (si utilisation de providers externes)
  oauth_client_id uuid REFERENCES auth.oauth_clients(id),
  scopes text CHECK (char_length(scopes) <= 4096),
  
  -- Refresh token security
  refresh_token_hmac_key text,
  refresh_token_counter bigint
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_not_after_idx ON auth.sessions(not_after);


-- ============================================================
-- 3. TABLE: auth.refresh_tokens
-- ============================================================
-- Stocke les tokens de rafraîchissement pour maintenir les sessions

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
  id bigserial PRIMARY KEY,
  instance_id uuid,
  
  -- Token
  token character varying(255) UNIQUE,
  user_id character varying(255),
  
  -- Relation à la session
  session_id uuid REFERENCES auth.sessions(id) ON DELETE CASCADE,
  
  -- Révocation et chaining
  revoked boolean DEFAULT false,
  parent character varying(255),
  
  -- Horodatage
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_instance_id_idx ON auth.refresh_tokens(instance_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_session_id_idx ON auth.refresh_tokens(session_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_token_idx ON auth.refresh_tokens(token);
CREATE INDEX IF NOT EXISTS refresh_tokens_updated_at_idx ON auth.refresh_tokens(updated_at DESC);


-- ============================================================
-- 4. TABLE: auth.identities
-- ============================================================
-- Gère les identités multiples (email + OAuth providers)

CREATE TABLE IF NOT EXISTS auth.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Provider info
  provider_id text NOT NULL,
  provider text NOT NULL,
  
  -- Données d'identité (JSON avec email, nom, avatar, etc.)
  identity_data jsonb NOT NULL,
  email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
  
  -- Horodatage
  last_sign_in_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(provider_id, provider)
);

CREATE INDEX IF NOT EXISTS identities_user_id_idx ON auth.identities(user_id);
CREATE INDEX IF NOT EXISTS identities_email_idx ON auth.identities(email);


-- ============================================================
-- 5. TABLES OAUTH (pour GitHub, Google, etc.)
-- ============================================================

-- auth.oauth_clients: Clients OAuth enregistrés
CREATE TABLE IF NOT EXISTS auth.oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_secret_hash text,
  registration_type auth.oauth_registration_type NOT NULL,
  redirect_uris text NOT NULL,
  grant_types text NOT NULL,
  
  -- Métadonnées client
  client_name text CHECK (char_length(client_name) <= 1024),
  client_uri text CHECK (char_length(client_uri) <= 2048),
  logo_uri text CHECK (char_length(logo_uri) <= 2048),
  client_type auth.oauth_client_type NOT NULL DEFAULT 'confidential'::auth.oauth_client_type,
  
  -- Horodatage
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);


-- ============================================================
-- 6. TABLE: auth.mfa_factors (Multi-Factor Authentication)
-- ============================================================
-- Pour l'authentification à deux facteurs (optionnel dans votre projet)

CREATE TABLE IF NOT EXISTS auth.mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Type de facteur (totp, webauthn, etc.)
  factor_type auth.factor_type NOT NULL,
  status auth.factor_status NOT NULL,
  friendly_name text,
  
  -- Secrets et données
  secret text,
  phone text,
  web_authn_credential jsonb,
  web_authn_aaguid uuid,
  
  -- Horodatage
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_challenged_at timestamptz UNIQUE,
  last_webauthn_challenge_data jsonb
);

CREATE INDEX IF NOT EXISTS mfa_factors_user_id_idx ON auth.mfa_factors(user_id);


-- ============================================================
-- 7. CONNEXION AVEC VOS TABLES PUBLIQUES
-- ============================================================

-- Vos tables publiques utilisent auth.users(id) comme clé étrangère:

-- A) Documents (via user_id)
-- Les documents uploadés par les utilisateurs
/*
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  status text CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at timestamptz DEFAULT now()
);
*/

-- B) Flashcards (via user_id)
-- Voir: supabase/migrations/20251106_flashcards.sql
/*
CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_path text,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz DEFAULT now()
);
*/

-- C) Quiz partagés (via creator_id)
-- Voir: supabase/migrations/20251106_live_quiz_system.sql
/*
CREATE TABLE public.shared_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  questions jsonb NOT NULL,
  share_code text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
*/

-- D) Quiz attempts (via user_id)
-- Voir: supabase/migrations/20251106_quiz_scoring.sql
/*
CREATE TABLE public.quiz_attempts (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total_questions integer NOT NULL,
  created_at timestamptz DEFAULT now()
);
*/

-- E) Push subscriptions (via user_id)
-- Voir: supabase/migrations/20251208_push_subscriptions.sql
/*
CREATE TABLE public.push_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text,
  keys jsonb,
  created_at timestamptz DEFAULT now()
);
*/


-- ============================================================
-- 8. FONCTIONS UTILES
-- ============================================================

-- Récupérer l'utilisateur actuel (utilisé dans les RLS policies)
-- auth.uid() retourne l'UUID de l'utilisateur connecté
-- Exemple: SELECT auth.uid();

-- Récupérer l'email de l'utilisateur actuel
-- auth.email() retourne l'email
-- Exemple: SELECT auth.email();


-- ============================================================
-- 9. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Toutes vos tables publiques utilisent RLS avec auth.uid()
-- Exemple pour shared_quizzes:

/*
ALTER TABLE public.shared_quizzes ENABLE ROW LEVEL SECURITY;

-- Le créateur peut tout faire sur ses quiz
CREATE POLICY sq_creator_all ON public.shared_quizzes
  FOR ALL
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- Lecture publique des quiz actifs
CREATE POLICY sq_public_read ON public.shared_quizzes
  FOR SELECT
  USING (is_active = true);
*/


-- ============================================================
-- 10. MÉTADONNÉES UTILISATEUR (OPTIONNEL)
-- ============================================================

-- Vous pouvez stocker des infos supplémentaires dans raw_user_meta_data:
-- Exemple: nom d'affichage, avatar, préférences

/*
UPDATE auth.users
SET raw_user_meta_data = jsonb_build_object(
  'display_name', 'Mathieu Coulibaly',
  'avatar_url', 'https://example.com/avatar.jpg',
  'preferences', jsonb_build_object(
    'theme', 'dark',
    'notifications', true
  )
)
WHERE id = auth.uid();
*/

-- Accès aux métadonnées:
-- SELECT raw_user_meta_data->>'display_name' FROM auth.users WHERE id = auth.uid();


-- ============================================================
-- 11. RÉSUMÉ DES FLUX D'AUTHENTIFICATION
-- ============================================================

/*
1. INSCRIPTION (Sign Up)
   - L'utilisateur fournit email + password
   - Supabase crée une entrée dans auth.users
   - Un email de confirmation est envoyé
   - L'utilisateur clique sur le lien → email_confirmed_at est défini

2. CONNEXION (Sign In)
   - L'utilisateur fournit email + password
   - Supabase vérifie les credentials
   - Création d'une session dans auth.sessions
   - Génération d'un access_token et refresh_token
   - Le refresh_token est stocké dans auth.refresh_tokens

3. OAUTH (GitHub, Google)
   - Redirection vers le provider
   - Callback vers /auth/callback
   - Création ou mise à jour de auth.users
   - Création d'une entrée dans auth.identities
   - Création de la session

4. RÉCUPÉRATION DE MOT DE PASSE
   - L'utilisateur demande un reset
   - Supabase envoie un email avec recovery_token
   - L'utilisateur clique et définit un nouveau password

5. DÉCONNEXION
   - Supabase révoque la session (revoked = true dans refresh_tokens)
   - Suppression côté client des tokens
*/


-- ============================================================
-- 12. SÉCURITÉ ET BONNES PRATIQUES
-- ============================================================

/*
✅ Row Level Security (RLS) activé sur toutes les tables public.*
✅ Toutes les tables référencent auth.users(id) avec ON DELETE CASCADE
✅ Les policies utilisent auth.uid() pour identifier l'utilisateur
✅ Les tokens sont stockés de manière sécurisée (hashed)
✅ Les sessions sont rafraîchies automatiquement
✅ Support MFA (optionnel) pour sécurité renforcée
✅ Support OAuth pour connexions externes

⚠️ IMPORTANT:
- Ne jamais exposer les tables auth.* directement aux clients
- Toujours passer par l'API Supabase Auth
- Utiliser HTTPS en production
- Configurer les variables d'environnement correctement
- Activer la protection CSRF
*/


-- ============================================================
-- FIN DU SCHÉMA
-- ============================================================
-- Ce fichier est un résumé des tables auth.* créées par Supabase
-- Pour votre projet Sheet of Paper: quiz, flashcards et sessions en temps réel
-- Créé par: Mathieu Coulibaly (kafoumathieu.coulibaly@gmail.com)
-- ============================================================
