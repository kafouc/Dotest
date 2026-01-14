import React, { useState } from 'react';
import useInteractiveGuide from '../hooks/useInteractiveGuide';
import SignupPrompt from './SignupPrompt';

const DemoFlow: React.FC = () => {
    const { currentStep, nextStep, steps } = useInteractiveGuide();
    const [showSignup, setShowSignup] = useState(false);
    const isLastStep = currentStep >= steps.length - 1;

    const handleNext = () => {
        if (isLastStep) {
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
                    <h2>Étape {currentStep + 1}</h2>
                    <p>{steps[currentStep]}</p>
                    <button onClick={handleNext}>
                        {isLastStep ? 'Terminer' : 'Suivant'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default DemoFlow;