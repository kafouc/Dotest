# Pilotage : capacité gratuite, limites, administration, budget

> Tout ce qui est chiffré ici est une **approximation** (hypothèses indiquées). Les quotas des fournisseurs changent : vérifiez-les sur
> leurs pages de tarifs avant de vous y fier. Dernière mise à jour : 25/10/2026.

## 1. Combien d'utilisateurs en mode gratuit ?

Le goulot dépend de la ressource ; le plus bas des quatre donne la capacité réelle.

| Ressource (forfait gratuit) | Limite approximative | Ce que ça donne |
|---|---|---|
| **Base Supabase Free** | 500 Mo | Un document de 100 pages ≈ 300 segments ≈ 3 Mo (texte + vecteur 1024 dimensions + index). Soit **≈ 150 documents de 100 pages, ou ≈ 400 documents courts (30 pages)** pour toute l'application. |
| **Stockage Supabase Free** | 1 Go | ≈ 200 fichiers de 5 Mo. |
| **IA Groq (palier gratuit)** | ≈ 8 000 jetons/min, ≈ 1 000 requêtes/jour, partagés par tous | Un quiz ≈ 6 000 jetons : **1 à 2 générations par minute, ≈ 150 à 300 par jour**. Ce palier est le plus restrictif : 30 élèves qui génèrent en même temps le saturent. |
| **Vercel Hobby** | ≈ 1 M d'appels de fonctions/mois, 100 Go de transfert | ≈ 10 000 sessions d'utilisation par mois : ne limite pas avant plusieurs centaines d'utilisateurs actifs. |
| **Supabase Auth** | 50 000 utilisateurs actifs/mois | Pas un frein. |

**En pratique** : environ **100 à 200 inscrits actifs dans le mois, 30 à 60 actifs par jour**, avant de toucher la base (500 Mo) ou Groq. Les quiz en direct d'un
enseignant ne passent pas par l'IA et sont peu coûteux ; c'est la génération par l'IA qui sature.

Autres limites gratuites à connaître :
- Un projet Supabase Free **est mis en pause après 7 jours d'inactivité**.
- Pas de sauvegarde automatique en Free (la CI fait une sauvegarde hebdomadaire chiffrée).
- Les durées de fonctions Hobby sont plus courtes que les 300 s demandées dans `vercel.json` : les très gros documents peuvent expirer.
- **Vercel Hobby interdit l'usage commercial** : dès que vous vendez des abonnements, passez à Vercel Pro (20 $/mois).

Surveiller la taille de la base : `select pg_size_pretty(pg_database_size(current_database()));`

## 2. Nombre maximum de pages d'un document

- **Dans le code** (`lib/constants.ts`, `FILE_LIMITS`) : **50 Mo et 500 pages**. Message affiché dans l'application et dans le tutoriel.
- **Sur la page Tarifs** : « 100 pages max/document » pour tous les forfaits. **Les deux ne sont pas d'accord.**
- **Vérification réelle** : seule la taille (50 Mo) est contrôlée, **dans le navigateur** (`components/UploadForm.tsx`). Aucun contrôle côté serveur du nombre de
  pages ni de la taille : un utilisateur qui contourne l'interface peut envoyer plus. Les 500 pages ne sont qu'une indication.
- **Limite pratique en gratuit** : le traitement (extraction + vecteurs) est limité par la durée des fonctions Vercel Hobby et par Jina/Groq ; comptez **≈ 100 à 200
  pages de façon fiable**, jusqu'à 500 avec des échecs possibles. Un document de 500 pages ≈ 15 Mo de base à lui seul.
- **Recommandation** : décider d'un chiffre unique (par exemple 100 pages en freemium, 300 en Partiel, 500 en Sérénité), l'écrire dans `FILE_LIMITS` par forfait,
  l'appliquer côté serveur (`/api/pdf/extract`) et corriger `Pricing.tsx`. À faire sur demande.

## 3. Entrer dans la page admin

L'accès est une **liste blanche** : table `admin_users` (fonction `is_admin()`). Il n'y a pas de liste d'e-mails dans le code.
1. Créez-vous un compte normal sur le site et connectez-vous.
2. Dans l'éditeur SQL de Supabase, exécutez (remplacez l'e-mail) :
```sql
insert into public.admin_users (user_id)
select id from auth.users where email = 'votre-email@exemple.com'
on conflict do nothing;
```
3. Ouvrez `https://sheetofpaper.app/admin` (tableau de bord : usage, documents, utilisateurs, pages vues, coût estimé de l'IA) et `/admin/users` (liste des utilisateurs et de leur forfait).
Sans cette ligne, la page affiche « Accès restreint ». Seule la base (éditeur SQL, rôle `postgres`/service) peut ajouter un administrateur : c'est voulu.

## 4. Régler les limites et les services par forfait

Aujourd'hui trois forfaits existent : `freemium` (Découverte), `partial` (Pass Partiel, 2,99 €/7 jours), `pro` (Passe Sérénité, 4,99 €/mois).

| Quoi | Où | Déploiement |
|---|---|---|
| Quotas de quiz/fiches par semaine et par mois, participants en direct | `PLAN_LIMITS` dans `lib/constants.ts` | code → merge dans `main` |
| Débit par minute et plafond par jour des routes IA | `RATE_LIMITS` dans `lib/constants.ts` | idem |
| Nombre de classes par forfait | `CLASS_LIMITS` dans `lib/constants.ts` **et** le trigger SQL `enforce_class_limit` | code + nouvelle migration |
| Taille/pages de fichier | `FILE_LIMITS` dans `lib/constants.ts` (pas par forfait, pas côté serveur) | code |
| Textes de la page Tarifs | `components/landing/Pricing.tsx` (**écrits à la main**, non reliés aux constantes : à tenir à jour) | code |
| Prix et durée | tableau de bord Stripe ; identifiants dans les variables Vercel `STRIPE_PRICE_PARTIAL` et `STRIPE_PRICE_PRO` | variables + redéploiement |
| Changer le forfait d'un utilisateur à la main | fonction SQL `set_user_plan(p_user_id, p_plan, p_assigned_by)` | éditeur SQL |

Note : « 2 documents/semaine » et « 10 documents/semaine » sont affichés sur la page Tarifs mais **aucun code ne limite le nombre de documents importés** ; seuls les quiz, fiches et participants sont limités.

### Forfait annuel et établissements : ce qui manque
Ils n'existent pas encore. Le code reconnaît 3 forfaits (contrainte SQL `plan in ('freemium','partial','pro')`).

**Annuel (simple, ≈ 1 jour)** : créer dans Stripe un prix annuel pour chaque produit (par exemple Sérénité 49 €/an au lieu de 59,88 €, soit 2 mois offerts), ajouter
`STRIPE_PRICE_PRO_YEARLY` et le faire reconnaître dans `lib/billing.ts` comme le forfait `pro`, puis un sélecteur Mensuel/Annuel sur la page Tarifs. Aucune migration.

**Établissement (≈ 3 à 5 jours)** : deux modèles possibles.
- *Licence par enseignant* : un forfait `school` (limites élevées) attribué à N enseignants d'un même établissement, géré par un administrateur d'établissement.
- *Pack d'élèves* : un quota de participants en direct partagé (par exemple 100, 300 ou 1 000 élèves/an), consommé par les séances de tous les enseignants.
Dans les deux cas : table `organizations` (nom, siège, forfait, quota, date de fin) + `organization_members`, facturation par devis/facture ou prix Stripe « quantité »,
et `PLAN_LIMITS` lu depuis l'organisation. Les élèves restent anonymes, ce qui évite les données de mineurs.

Grille indicative à valider (à titre d'exemple) :

| Forfait | Prix | Documents | Quiz / fiches | Direct | Classes |
|---|---|---|---|---|---|
| Découverte | 0 € | selon décision | 3 quiz/sem./doc | 10 élèves | 1 |
| Pass Partiel | 2,99 €/7 j | idem | 10 | 15 | 5 |
| Sérénité | 4,99 €/mois ou ≈ 49 €/an | illimité | 50/mois | 300 | 30 |
| Établissement | ≈ 290 €/an les 5 enseignants, ou ≈ 190 € pour un pack de 300 élèves | illimité | 50/mois/enseignant | 300 par séance | 30 par enseignant |

## 5. Dépenses, gains, pertes (approximation)

### Aujourd'hui (tout en gratuit)
| Poste | Coût mensuel |
|---|---|
| Supabase Free, Vercel Hobby, Groq gratuit, Jina (jetons gratuits), GitHub, CI | **0 €** |
| Nom de domaine `sheetofpaper.app` | ≈ 1,2 € (≈ 15 €/an) |
| **Total** | **≈ 1 à 2 €/mois** |

Gains : je n'ai pas accès à votre tableau de bord Stripe ; à vérifier chez vous. Avec 57 inscrits au dernier relevé (24/10), les abonnés payants sont au mieux quelques-uns.
Pertes : ≈ 1 à 2 €/mois de domaine, plus **votre temps, qui n'est pas compté ici**.

### Coût par utilisateur (IA)
Tarifs Groq : 0,15 $/M jetons en entrée et 0,60 $/M en sortie (120b). Un quiz ≈ 0,002 $, une fiche ≈ 0,003 $, l'indexation d'un document de 100 pages ≈ 0,005 $ (Jina,
estimation). Un abonné Sérénité qui utilise ses quotas au maximum (50 quiz + 50 fiches/mois) coûte **≈ 0,25 €/mois** ; un usage normal, **0,02 à 0,10 €**. L'IA est négligeable
par rapport au prix de l'abonnement ; le risque est un abus, d'où les plafonds du § 4.

### Frais Stripe (cartes européennes, ≈ 1,5 % + 0,25 €)
- Pass Partiel 2,99 € → ≈ 0,30 € (10 %) ; Sérénité 4,99 € → ≈ 0,32 € (6 %) ; annuel 49 € → ≈ 1 € (2 %). Les petits montants sont pénalisés : l'annuel est plus rentable.

### Dès que vous vendez (infrastructure payante nécessaire)
| Poste | Coût mensuel |
|---|---|
| Vercel Pro (usage commercial) | ≈ 20 $ ≈ 19 € |
| Supabase Pro (sauvegardes, pas de pause, 8 Go) | ≈ 25 $ ≈ 23 € |
| Groq Developer (paiement à l'usage) | quelques € |
| **Total fixe** | **≈ 45 à 50 €/mois** |

**Seuil de rentabilité ≈ 11 abonnés Sérénité** (4,67 € net chacun, hors TVA et cotisations).

### Scénarios mensuels (hypothèses : 4 % d'inscrits payants, revenu moyen ≈ 5 € par payant et par mois ; Stripe ≈ 7 % ; IA ≈ 0,15 € par payant)
| Inscrits | Payants | Chiffre d'affaires | Stripe + IA | Infrastructure | Résultat avant impôts et cotisations |
|---|---|---|---|---|---|
| 100 | 4 | 20 € | ≈ 2 € | 0 € (gratuit, non conforme si commercial) | ≈ +18 € |
| 500 | 20 | 100 € | ≈ 10 € | ≈ 47 € | ≈ **+43 €** |
| 2 000 | 80 | 400 € | ≈ 40 € | ≈ 60 € (calcul Supabase plus gros) | ≈ **+300 €** |
| 10 000 | 400 | 2 000 € | ≈ 200 € | ≈ 150 € | ≈ **+1 650 €** |

À retrancher ensuite, selon votre statut : **TVA** (20 % si vous y êtes soumis, sinon franchise en base), **cotisations sociales** (≈ 12 à 22 % du chiffre d'affaires en
micro-entreprise), impôt sur le revenu, comptable. Un taux de conversion de 4 % est une hypothèse courante pour un freemium, pas une mesure : le vôtre peut être de 1 % comme de 8 %.
Au taux de 1 %, le seuil de rentabilité demande ≈ 1 100 inscrits.

### Où l'on perd de l'argent
- Passer en forfait payant (≈ 47 €/mois) **avant** d'avoir ≈ 11 abonnés : perte de ≈ 45 €/mois.
- Pass Partiel 2,99 € à la semaine : frais Stripe élevés (10 %) et usage par à-coups ; l'annuel et l'établissement sont les vraies sources de revenu.
- Abus d'IA sans plafond (déjà borné par `RATE_LIMITS`).
- Remboursements et litiges Stripe (≈ 15 € par litige).
- Les licences établissement demandent du temps commercial (devis, factures) : à tester avec un ou deux établissements avant de les automatiser.
