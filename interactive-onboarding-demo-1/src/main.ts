import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import IntroScreen from './components/IntroScreen';
import DemoWalkthrough from './components/DemoWalkthrough';
import SignupPrompt from './components/SignupPrompt';
import './styles/main.css';

const App = () => {
    const [step, setStep] = useState(0);

    const nextStep = () => {
        setStep(prevStep => prevStep + 1);
    };

    const renderStep = () => {
        switch (step) {
            case 0:
                return <IntroScreen onStart={nextStep} />;
            case 1:
                return <DemoWalkthrough onComplete={nextStep} />;
            case 2:
                return <SignupPrompt />;
            default:
                return null;
        }
    };

    return (
        <div className="app-container">
            {renderStep()}
        </div>
    );
};

ReactDOM.render(<App />, document.getElementById('root'));