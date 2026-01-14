import React, { useState } from 'react';
import { useInteractiveGuide } from '../hooks/useInteractiveGuide';
import SignupPrompt from './SignupPrompt';

const DemoFlow: React.FC = () => {
    const { currentStep, nextStep, isComplete } = useInteractiveGuide();
    const [showSignup, setShowSignup] = useState(false);

    const handleNext = () => {
        if (currentStep === 'final') {
            setShowSignup(true);
        } else {
            nextStep();
        }
    };

    return (
        <div className="demo-flow">
            {showSignup ? (
                <SignupPrompt />
            ) : (
                <div>
                    <h2>Étape {currentStep}</h2>
                    <p>Voici une démonstration interactive de l'application.</p>
                    <button onClick={handleNext}>
                        {isComplete ? 'Terminer' : 'Suivant'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default DemoFlow;