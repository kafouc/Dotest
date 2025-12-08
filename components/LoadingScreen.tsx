"use client";

import { motion } from 'framer-motion';

export default function LoadingScreen() {
  return (
    // Conteneur principal (prend tout l'écran, avec le fond sombre)
    <motion.div
      // Animation d'apparition/disparition
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      // Centre l'animation et applique le fond
      className="fixed inset-0 z-50 flex flex-col justify-center items-center loader-background"
    >
      {/* Cette structure HTML correspond aux sélecteurs CSS
        que vous avez fournis (#loader, #hill, #box)
      */}
      <div id="loader">
        <div id="hill"></div>
        <div id="box"></div>
      </div>
      
      {/* Texte optionnel (adapté au thème) */}
      <p className="mt-20 text-lg font-medium text-white/70 animate-pulse">
        Chargement...
      </p>
    </motion.div>
  );
}