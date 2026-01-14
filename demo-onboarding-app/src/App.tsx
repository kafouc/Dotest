import React, { useState } from 'react';
import Home from './pages/Home';
import './styles/global.css';

const App: React.FC = () => {
  const [showTutorial, setShowTutorial] = useState(false);

  const handleStartClick = () => {
    setShowTutorial(true);
  };

  const closeTutorial = () => {
    setShowTutorial(false);
  };

  return (
    <div>
      <Home onStartClick={handleStartClick} />
      {showTutorial && <TutorialModal onClose={closeTutorial} />}
    </div>
  );
};

export default App;