import React, { useState } from 'react';
import SignupDialog from './SignupDialog';
import TutorialOverlay from './TutorialOverlay';

const AppLayout: React.FC = () => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);

  const handleStartTutorial = () => {
    setIsTutorialOpen(true);
  };

  const handleTutorialComplete = () => {
    setIsTutorialOpen(false);
    setIsSignupOpen(true);
  };

  const handleSignupClose = () => {
    setIsSignupOpen(false);
  };

  return (
    <div>
      <h1>Bienvenue dans l'application !</h1>
      <button onClick={handleStartTutorial}>Commencer</button>
      {isTutorialOpen && <TutorialOverlay onComplete={handleTutorialComplete} />}
      {isSignupOpen && <SignupDialog onClose={handleSignupClose} />}
    </div>
  );
};

export default AppLayout;