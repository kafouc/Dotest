import { useState } from 'react';

const useInteractiveGuide = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isGuideActive, setIsGuideActive] = useState(false);

    const steps = [
        'Bienvenue dans notre application !',
        'Voici comment naviguer dans l\'interface.',
        'Vous pouvez accéder à différentes fonctionnalités ici.',
        'N\'oubliez pas de vous inscrire pour profiter de toutes les fonctionnalités !',
    ];

    const startGuide = () => {
        setIsGuideActive(true);
        setCurrentStep(0);
    };

    const nextStep = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            endGuide();
        }
    };

    const endGuide = () => {
        setIsGuideActive(false);
        setCurrentStep(0);
    };

    return {
        currentStep,
        isGuideActive,
        steps,
        startGuide,
        nextStep,
        endGuide,
    };
};

export default useInteractiveGuide;