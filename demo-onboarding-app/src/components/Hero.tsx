import React from 'react';

const Hero: React.FC<{ onStart: () => void }> = ({ onStart }) => {
  return (
    <div className="hero">
      <h1>Bienvenue dans notre application !</h1>
      <p>Découvrez toutes les fonctionnalités que nous avons à offrir.</p>
      <button onClick={onStart}>Commencer</button>
    </div>
  );
};

export default Hero;