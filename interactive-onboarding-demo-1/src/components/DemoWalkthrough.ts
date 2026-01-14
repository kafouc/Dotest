import React from 'react';
import { useDemoFlow } from '../hooks/useDemoFlow';

const DemoWalkthrough: React.FC = () => {
    const { currentStep, nextStep, previousStep } = useDemoFlow();

    const steps = [
        {
            title: 'Bienvenue dans l\'application!',
            content: 'Cette application vous permet de gérer vos tâches efficacement. Commençons par explorer les fonctionnalités principales.',
        },
        {
            title: 'Fonctionnalité 1',
            content: 'Voici comment vous pouvez ajouter une nouvelle tâche. Cliquez sur le bouton "Ajouter" pour commencer.',
        },
        {
            title: 'Fonctionnalité 2',
            content: 'Vous pouvez également marquer les tâches comme complètes. Cliquez sur la case à cocher à côté de la tâche.',
        },
        {
            title: 'Fonctionnalité 3',
            content: 'N\'oubliez pas de consulter votre tableau de bord pour un aperçu de vos tâches.',
        },
    ];

    return (
        <div className="demo-walkthrough">
            <h2>{steps[currentStep].title}</h2>
            <p>{steps[currentStep].content}</p>
            <div className="navigation">
                <button onClick={previousStep} disabled={currentStep === 0}>
                    Précédent
                </button>
                <button onClick={nextStep} disabled={currentStep === steps.length - 1}>
                    Suivant
                </button>
            </div>
        </div>
    );
};

export default DemoWalkthrough;