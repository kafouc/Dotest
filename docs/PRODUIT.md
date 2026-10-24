# Fonctions produit : enseignants, révision du jour, premier lancement, langues

Migrations à appliquer (dans l'éditeur SQL de Supabase, dans cet ordre) :
1. `supabase/migrations/20261026090000_review_today.sql` : révision du jour
2. `supabase/migrations/20261026100000_teacher_classes.sql` : classes et statistiques enseignant

Sans ces migrations, l'application continue de fonctionner : la page « Réviser aujourd'hui » se rabat sur l'ancienne liste de cartes,
l'espace « Mes classes » affiche « pas encore activé », et le partage en direct se fait sans classe.

## 1. Révision du jour (`/review`)
- Chaque **question de quiz ratée** devient une carte de révision (une seule par question et par utilisateur), avec la bonne réponse,
  la justification et la page source. Elle est espacée par le même algorithme que les flashcards.
- Page **À réviser aujourd'hui** : objectif quotidien (5, 10, 20 ou 30 cartes, mémorisé dans `user_settings`), progression du jour,
  série de jours, compteurs (à revoir, nouvelles, tirées de vos erreurs). Badge dans la barre latérale et carte sur l'accueil.
- La notation des cartes se fait avec des libellés (À revoir, Difficile, Bien, Facile) au lieu de chiffres de 0 à 5.
- `list_due_flashcards()` remplace une jointure faite dans le navigateur sur 200 cartes seulement.

## 2. Premier lancement
- Parcours en 4 étapes (document, quiz généré, quiz répondu, cartes révisées), **déduit des données réelles**, masquable.
- Bouton « Essayer avec un exemple » : crée un document de 3 pages déjà indexé (`POST /api/onboarding/sample`, un par compte, limité à 3 par jour).
- **Mesure** (requête à lancer dans l'éditeur SQL) :
```sql
with s as (select id, created_at from auth.users)
select count(*) as inscrits,
  count(*) filter (where exists (select 1 from documents d where d.user_id = s.id)) as avec_document,
  count(*) filter (where exists (select 1 from export_events e where e.user_id = s.id and e.kind = 'quiz_export')) as avec_quiz_genere,
  count(*) filter (where exists (select 1 from quiz_attempts a where a.user_id = s.id)) as avec_quiz_repondu,
  count(*) filter (where exists (select 1 from flashcard_reviews r where r.user_id = s.id)) as avec_revision
from s;
```
  **Référence avant le parcours guidé (24/10/2026)** : 57 inscrits, 31 (54 %) avec un document, 13 (23 %) avec un quiz généré, 17 (30 %) avec un quiz répondu,
  3 (5 %) avec une révision. Restreindre à `where created_at > '<date de mise en ligne>'` pour mesurer l'effet.

## 3. Espace enseignant (`/classes`)
- **Classes** (nom, niveau facultatif). Limite par forfait appliquée en base : 1 (freemium), 5 (partial), 30 (pro) classes actives ; une classe archivée libère une place.
- Au lancement d'une séance en direct, on choisit la classe ; les séances passées peuvent être **rattachées après coup**.
- Page d'une classe : **historique** des séances (participants, score moyen, questions traitées, réussite question par question, questions à reprendre),
  **élèves** (matrice élèves × séances, évolution, élèves à accompagner), **comparaison** de deux séances (écarts globaux ; question par question si c'est le même quiz),
  **export Excel**.
- **Vie privée** : les élèves restent anonymes. Aucune liste nominative n'est stockée ; la progression est suivie **par pseudo dans une classe**
  (il faut demander aux élèves d'utiliser toujours le même). Une liste d'élèves nominative serait possible plus tard, mais elle ajouterait des données
  personnelles de mineurs (information des familles, durée de conservation) : à décider avec un cadre juridique avant de l'ajouter.
- Les calculs sont faits en base (`class_sessions_summary`, `class_question_stats`, `class_students_progress`), sous la RLS de l'enseignant.

## 4. Langues
- La langue du cours est **détectée localement** (fréquence des mots courants : français, anglais, espagnol, allemand, italien, portugais, néerlandais)
  et le quiz, la fiche et les thèmes sont rédigés dans cette langue. Par défaut : français.
- **Pas encore fait** : l'interface (boutons, menus, messages) reste en français. Pour la traduire il faudra extraire les textes dans des fichiers de
  traduction (`next-intl` par exemple) : chantier de plusieurs jours, utile seulement si vous visez d'autres marchés.
