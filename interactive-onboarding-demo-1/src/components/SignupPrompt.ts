import React from 'react';

const SignupPrompt: React.FC = () => {
    return (
        <div className="signup-prompt">
            <h2>Inscrivez-vous pour continuer</h2>
            <p>Pour profiter pleinement de notre application, veuillez vous inscrire.</p>
            <form>
                <label htmlFor="email">Email:</label>
                <input type="email" id="email" name="email" required />
                
                <label htmlFor="password">Mot de passe:</label>
                <input type="password" id="password" name="password" required />
                
                <button type="submit">S'inscrire</button>
            </form>
        </div>
    );
};

export default SignupPrompt;