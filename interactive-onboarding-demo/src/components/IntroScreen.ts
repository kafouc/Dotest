import React from 'react';

const IntroScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => {
    return (
        <div className="intro-screen">
            <h1>Bienvenue dans notre application!</h1>
            <p>
                Cette application vous permet de gérer vos tâches de manière efficace. 
                Cliquez sur le bouton ci-dessous pour commencer une démonstration interactive.
            </p>
            <button onClick={onStart}>Commencer</button>
        </div>
    );
};

export default IntroScreen;