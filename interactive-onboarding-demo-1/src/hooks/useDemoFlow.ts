import { useState } from 'react';

const useDemoFlow = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isDemoActive, setIsDemoActive] = useState(false);

    const startDemo = () => {
        setIsDemoActive(true);
        setCurrentStep(0);
    };

    const nextStep = () => {
        setCurrentStep((prevStep) => prevStep + 1);
    };

    const endDemo = () => {
        setIsDemoActive(false);
        setCurrentStep(0);
    };

    return {
        currentStep,
        isDemoActive,
        startDemo,
        nextStep,
        endDemo,
    };
};

export default useDemoFlow;