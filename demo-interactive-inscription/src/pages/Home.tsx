import React from 'react';
import { useHistory } from 'react-router-dom';
import DemoFlow from '../components/DemoFlow';
import SignupPrompt from '../components/SignupPrompt';

const Home: React.FC = () => {
    const history = useHistory();
    const [isDemoActive, setDemoActive] = React.useState(false);

    const startDemo = () => {
        setDemoActive(true);
    };

    const handleSignup = () => {
        history.push('/signup');
    };

    return (
        <div className="home-container">
            <h1>Bienvenue sur notre application</h1>
            <button onClick={startDemo}>Commencer</button>
            {isDemoActive && <DemoFlow onComplete={handleSignup} />}
            <SignupPrompt />
        </div>
    );
};

export default Home;