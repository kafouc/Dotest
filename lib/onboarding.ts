import type { TextSegment } from '@/lib/chunking';

/**
 * Premier lancement : document d'exemple et étapes du parcours guidé.
 * Le texte est original et court (3 pages) : assez pour un premier quiz de qualité, sans coût d'indexation notable.
 */

export const SAMPLE_DOCUMENT_NAME = "Exemple - La photosynthèse.txt";

export const SAMPLE_PAGES: TextSegment[] = [
  {
    page: 1,
    text: `La photosynthèse est le processus par lequel les plantes vertes, les algues et certaines bactéries transforment l'énergie lumineuse en énergie chimique. Elle se déroule principalement dans les feuilles, à l'intérieur de petits organites appelés chloroplastes. Ces chloroplastes contiennent un pigment vert, la chlorophylle, qui absorbe surtout la lumière rouge et la lumière bleue et réfléchit la lumière verte, ce qui explique la couleur des feuilles.

Pour réaliser la photosynthèse, la plante a besoin de trois ressources : de l'eau, du dioxyde de carbone et de la lumière. L'eau est puisée dans le sol par les racines puis acheminée jusqu'aux feuilles. Le dioxyde de carbone de l'air pénètre dans la feuille par de minuscules ouvertures nommées stomates. La lumière est captée par la chlorophylle.`,
  },
  {
    page: 2,
    text: `La photosynthèse se déroule en deux grandes étapes. Pendant la phase lumineuse, qui a lieu dans les membranes des chloroplastes, l'énergie de la lumière sert à décomposer des molécules d'eau. Cette réaction libère du dioxygène, qui est rejeté dans l'atmosphère, et fournit l'énergie nécessaire à la suite du processus.

Pendant la seconde étape, appelée cycle de Calvin, la plante utilise cette énergie pour fixer le dioxyde de carbone et fabriquer du glucose, un sucre simple. Le cycle de Calvin n'a pas besoin de lumière directe, mais il dépend des produits de la phase lumineuse. L'équation bilan de la photosynthèse s'écrit : 6 CO2 + 6 H2O + énergie lumineuse donne C6H12O6 + 6 O2.`,
  },
  {
    page: 3,
    text: `Le glucose produit par la photosynthèse a plusieurs usages. Une partie est utilisée immédiatement par la plante comme source d'énergie pour la respiration cellulaire. Une autre partie est transformée en amidon pour être stockée, par exemple dans les tubercules de pomme de terre ou les graines. Le glucose sert aussi à fabriquer la cellulose, qui constitue les parois des cellules végétales.

La photosynthèse est essentielle à la vie sur Terre. Elle produit le dioxygène que respirent la plupart des êtres vivants et elle absorbe du dioxyde de carbone, un gaz à effet de serre. Elle est aussi à la base de presque toutes les chaînes alimentaires, car les herbivores se nourrissent de plantes et les carnivores se nourrissent d'herbivores. Plusieurs facteurs limitent la vitesse de la photosynthèse : l'intensité lumineuse, la température et la concentration en dioxyde de carbone.`,
  },
];

export type OnboardingProgress = {
  documents: number;
  quizzesGenerated: number;
  quizAttempts: number;
  cardsReviewed: number;
};

export type OnboardingStepId = 'document' | 'quiz' | 'answer' | 'review';

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  description: string;
  done: boolean;
};

export function computeOnboardingSteps(progress: OnboardingProgress): OnboardingStep[] {
  return [
    {
      id: 'document',
      title: 'Ajoutez un cours',
      description: 'Importez un PDF, un Word ou un PowerPoint, ou essayez avec un document d’exemple.',
      done: progress.documents > 0,
    },
    {
      id: 'quiz',
      title: 'Générez votre premier quiz',
      description: 'Ouvrez le document, choisissez un thème et lancez la génération : environ 5 secondes.',
      done: progress.quizzesGenerated > 0,
    },
    {
      id: 'answer',
      title: 'Répondez au quiz',
      description: 'Chaque question cite le passage du cours qui la justifie.',
      done: progress.quizAttempts > 0,
    },
    {
      id: 'review',
      title: 'Révisez vos erreurs',
      description: 'Les questions ratées reviennent dans « Réviser aujourd’hui », espacées dans le temps.',
      done: progress.cardsReviewed > 0,
    },
  ];
}

export const ONBOARDING_DISMISS_KEY = (userId: string) => `onboarding-dismissed-${userId}`;
