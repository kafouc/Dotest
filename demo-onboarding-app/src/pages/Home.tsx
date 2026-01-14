import React, { useState } from 'react';
import Hero from '../components/Hero';
import TutorialModal from '../components/TutorialModal';
import SignupPrompt from '../components/SignupPrompt';

const Home: React.FC = () => {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [isSignupPromptVisible, setIsSignupPromptVisible] = useState(false);

  const handleStartTutorial = () => {
    setIsTutorialOpen(true);
  };

  const handleTutorialComplete = () => {
    setIsTutorialOpen(false);
    setIsSignupPromptVisible(true);
  };

  return (
    <div>
      <Hero onStartTutorial={handleStartTutorial} />
      {isTutorialOpen && <TutorialModal onComplete={handleTutorialComplete} />}
      {isSignupPromptVisible && <SignupPrompt />}
    </div>
  );
};

export default Home;