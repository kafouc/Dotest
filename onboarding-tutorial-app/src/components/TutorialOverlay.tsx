import React from 'react';

interface TutorialOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ isOpen, onClose, onComplete }) => {
  if (!isOpen) return null;

  const handleComplete = () => {
    onComplete();
    onClose();
  };

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-content">
        <h2>Bienvenue dans l'application !</h2>
        <p>Voici un petit tutoriel pour vous aider à démarrer.</p>
        <ol>
          <li>Étape 1 : Découvrez les fonctionnalités.</li>
          <li>Étape 2 : Apprenez à naviguer dans l'application.</li>
          <li>Étape 3 : Inscrivez-vous pour profiter de toutes les fonctionnalités.</li>
        </ol>
        <button onClick={handleComplete}>Terminer le tutoriel</button>
        <button onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
};

export default TutorialOverlay;