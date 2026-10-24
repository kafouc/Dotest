/** Étapes du tutoriel interactif (/demo) : textes uniquement, les écrans simulés sont dans components/demo/tutorial/screens.tsx. */

export type TutorialStepId = 'intro' | 'upload' | 'analysis' | 'generate' | 'quiz' | 'review' | 'teacher' | 'mobile' | 'final';

export type TutorialStep = {
  id: TutorialStepId;
  /** Numéro affiché devant le titre ("1."), absent pour l'introduction et la conclusion */
  label?: string;
  title: string;
  lead: string;
  bullets: string[];
  /** Ce que l'utilisateur peut essayer sur l'écran de droite */
  tryIt?: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'intro',
    title: 'Sheet of Paper en 2 minutes',
    lead: 'Ce tutoriel reprend, pas à pas, ce que vous ferez dans l’application. Les écrans à droite réagissent comme les vrais : cliquez dessus.',
    bullets: ['8 étapes, environ 2 minutes', 'Aucune inscription, aucune donnée enregistrée', 'Flèches du clavier ← → pour avancer'],
  },
  {
    id: 'upload',
    label: '1',
    title: 'Importez votre cours',
    lead: 'Un PDF, un Word ou un PowerPoint, jusqu’à 50 Mo et environ 500 pages. L’analyse démarre toute seule.',
    bullets: ['Glisser-déposer ou bouton « Parcourir »', 'Pas de fichier sous la main ? Un document d’exemple est proposé au premier lancement'],
    tryIt: 'Cliquez sur « Ajouter le fichier » pour voir l’import.',
  },
  {
    id: 'analysis',
    title: 'L’IA lit et indexe votre document',
    label: '2',
    lead: 'Le texte est découpé en passages, avec leurs numéros de page, puis indexé pour retrouver exactement ce dont chaque question a besoin.',
    bullets: ['Travail en arrière-plan : vous pouvez continuer à utiliser l’application', 'Un document bloqué se relance en un clic', 'Vos documents ne servent jamais à entraîner une IA'],
  },
  {
    id: 'generate',
    label: '3',
    title: 'Choisissez un thème, lancez le quiz',
    lead: 'L’IA propose des thèmes tirés de votre cours. Vous réglez le nombre de questions et le format : choix unique, choix multiples ou vrai/faux.',
    bullets: ['Génération en quelques secondes', 'La langue du cours est détectée automatiquement', 'Export PDF et partage en direct en un clic'],
    tryIt: 'Choisissez un thème puis cliquez sur « Générer le quiz ».',
  },
  {
    id: 'quiz',
    label: '4',
    title: 'Répondez : chaque question cite sa source',
    lead: 'Après chaque réponse, la justification et la phrase exacte du cours (avec sa page) s’affichent. Une question dont la citation est introuvable est écartée avant de vous être proposée.',
    bullets: ['Vous pouvez toujours vérifier dans votre cours', 'Les propositions sont mélangées : la bonne réponse n’est pas toujours en A'],
    tryIt: 'Répondez à la question pour voir la correction sourcée.',
  },
  {
    id: 'review',
    label: '5',
    title: 'Vos erreurs reviennent au bon moment',
    lead: 'Les questions ratées deviennent des cartes de révision, espacées dans le temps. Un objectif du jour et une série de jours vous gardent régulier.',
    bullets: ['Révision espacée : on revoit une notion juste avant de l’oublier', 'Objectif quotidien réglable : 5, 10, 20 ou 30 cartes'],
    tryIt: 'Retournez la carte, puis dites si vous la saviez.',
  },
  {
    id: 'teacher',
    label: '6',
    title: 'Enseignants : séances en direct',
    lead: 'Affichez le QR code : les élèves rejoignent avec un simple pseudo, sans compte. Vous suivez les réponses en temps réel, puis retrouvez l’historique par classe.',
    bullets: ['Résultats par question : repérez ce qu’il faut reprendre', 'Classes, historique, comparaison de deux séances, export Excel'],
    tryIt: 'Cliquez sur « Un élève rejoint » pour simuler une arrivée.',
  },
  {
    id: 'mobile',
    label: '7',
    title: 'Sur votre téléphone, avec des rappels',
    lead: 'Installez l’application sur l’écran d’accueil et activez les rappels en un geste : le matin, la révision espacée à midi, et le soir pour garder votre série.',
    bullets: ['Aucun store : l’installation prend une seconde', 'Vous choisissez les rappels et leurs heures dans les Paramètres'],
    tryIt: 'Touchez la notification pour la « recevoir ».',
  },
  {
    id: 'final',
    title: 'Prêt à essayer avec vos cours ?',
    lead: 'Créez votre compte gratuit pour importer vos propres documents, ou testez dès maintenant avec un texte de votre choix, sans compte.',
    bullets: ['Inscription en moins d’une minute, sans carte bancaire', 'Vos quiz, vos cartes et votre progression sont conservés'],
  },
];
