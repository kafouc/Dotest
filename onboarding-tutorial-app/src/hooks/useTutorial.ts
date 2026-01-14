import { useState } from 'react';

const useTutorial = () => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const steps = [
    'Bienvenue dans l\'application ! Cliquez sur "Suivant" pour continuer.',
    'Voici comment utiliser la fonctionnalité A.',
    'Voici comment utiliser la fonctionnalité B.',
    'Merci d\'avoir suivi le tutoriel ! Cliquez sur "Terminer" pour vous inscrire.',
  ];

  const startTutorial = () => {
    setIsTutorialOpen(true);
    setCurrentStep(0);
  };

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const finishTutorial = () => {
    setIsTutorialOpen(false);
    setCurrentStep(0);
  };

  return {
    isTutorialOpen,
    currentStep,
    steps,
    startTutorial,
    nextStep,
    finishTutorial,
  };
};

export default useTutorial;