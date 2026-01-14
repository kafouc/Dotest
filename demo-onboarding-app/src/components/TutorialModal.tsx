import React from 'react';
import Modal from 'react-modal';

Modal.setAppElement('#root');

const TutorialModal = ({ isOpen, onRequestClose }) => {
  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      contentLabel="Tutorial"
      className="tutorial-modal"
      overlayClassName="tutorial-overlay"
    >
      <h2>Bienvenue dans notre application!</h2>
      <p>
        Ce tutoriel vous guidera à travers les fonctionnalités principales de l'application.
      </p>
      <ol>
        <li>Explorez les différentes sections de l'application.</li>
        <li>Utilisez le menu pour naviguer facilement.</li>
        <li>Inscrivez-vous pour sauvegarder vos préférences.</li>
      </ol>
      <button onClick={onRequestClose}>Terminer le tutoriel</button>
    </Modal>
  );
};

export default TutorialModal;