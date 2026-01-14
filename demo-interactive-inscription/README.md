# Demo Interactive Inscription

## Description
Ce projet est une application interactive qui guide les utilisateurs à travers une démonstration de ses fonctionnalités. Après avoir cliqué sur le bouton "Commencer" sur la page d'accueil, les utilisateurs sont guidés à travers différentes étapes de la démonstration. À la fin de la démonstration, une demande d'inscription est présentée.

## Structure du Projet
Le projet est organisé comme suit :

- **public/index.html** : Page d'accueil de l'application avec la structure HTML de base.
- **src/main.tsx** : Point d'entrée de l'application, configurant le routeur et rendant le composant principal.
- **src/components/DemoFlow.tsx** : Composant gérant la démonstration interactive.
- **src/components/SignupPrompt.tsx** : Composant demandant à l'utilisateur de s'inscrire après la démonstration.
- **src/hooks/useInteractiveGuide.ts** : Hook personnalisé pour gérer l'état de la démonstration interactive.
- **src/pages/Home.tsx** : Composant représentant la page d'accueil avec le bouton "Commencer".
- **src/pages/Signup.tsx** : Composant représentant la page d'inscription avec le formulaire.
- **src/styles/global.css** : Styles globaux de l'application.
- **tsconfig.json** : Configuration TypeScript.
- **package.json** : Configuration npm.

## Installation
Pour installer les dépendances du projet, exécutez la commande suivante dans le répertoire racine du projet :

```
npm install
```

## Exécution
Pour démarrer l'application en mode développement, utilisez la commande suivante :

```
npm start
```

L'application sera accessible à l'adresse `http://localhost:3000`.

## Contribuer
Les contributions sont les bienvenues ! Veuillez soumettre une demande de tirage pour toute amélioration ou correction de bogue.

## License
Ce projet est sous licence MIT. Veuillez consulter le fichier LICENSE pour plus de détails.