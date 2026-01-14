import React, { useState } from 'react';
import TutorialOverlay from '../components/TutorialOverlay';
import SignupDialog from '../components/SignupDialog';

const Home: React.FC = () => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);

  const handleStartTutorial = () => {
    setIsTutorialOpen(true);
  };

  const handleTutorialComplete = () => {
    setIsTutorialOpen(false);
    setIsSignupOpen(true);
  };

  return (
    <div>
      <h1>Bienvenue sur notre application</h1>
      <button onClick={handleStartTutorial}>Commencer</button>
      {isTutorialOpen && <TutorialOverlay onComplete={handleTutorialComplete} />}
      {isSignupOpen && <SignupDialog onClose={() => setIsSignupOpen(false)} />}
    </div>
  );
};

export default Home;