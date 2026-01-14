import React from 'react';

const SignupPrompt: React.FC = () => {
  return (
    <div className="signup-prompt">
      <h2>Inscrivez-vous pour continuer</h2>
      <p>Pour accéder à toutes les fonctionnalités de l'application, veuillez vous inscrire.</p>
      <button onClick={() => alert('Redirection vers la page d\'inscription...')}>
        S'inscrire
      </button>
    </div>
  );
};

export default SignupPrompt;