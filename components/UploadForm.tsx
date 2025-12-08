"use client";

import { useState, useCallback } from 'react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { FILE_LIMITS } from '@/lib/constants';
import LoadingSpinner from './ui/LoadingSpinner';
import ProgressBar from './ui/ProgressBar';

// Props reçues de page.tsx
type UploadFormProps = {
  session: Session;
  supabase: SupabaseClient;
  onUploadSuccess: () => void; // Fonction pour rafraîchir la liste parente
};

export default function UploadForm({ session, supabase, onUploadSuccess }: UploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    // Vérification 1: Taille (2 Mo)
    if (file.size > FILE_LIMITS.MAX_SIZE_BYTES) {
      return `Le fichier est trop volumineux. Limite: ${FILE_LIMITS.MAX_SIZE_MB} Mo.`;
    }

    // Vérification 2: Type
    if (file.type !== 'application/pdf') {
      return 'Seuls les fichiers PDF sont acceptés.';
    }

    return null;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      e.target.value = '';
      return;
    }

    setFile(selectedFile);
    setError(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    const validationError = validateFile(droppedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setFile(droppedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier PDF.');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);
    setCurrentStep('Téléversement du fichier...');

    try {
      const userId = session.user.id;
      const filePath = `${userId}/${Date.now()}-${file.name}`;

      // 1: Upload vers Storage
      setUploadProgress(30);
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      setUploadProgress(60);
      setCurrentStep('Enregistrement de la tâche...');

      // 2: Insérer la tâche dans la table 'documents'
      const { data: insertData, error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: userId,
          file_path: filePath,
          file_name: file.name,
          status: 'pending',
        })
        .select('id')
        .single();
      if (insertError) throw new Error(`Erreur DB: ${insertError.message}`);

      setUploadProgress(80);
      setCurrentStep('Démarrage de l\'analyse...');

      // 3: Déclencher la fonction Edge
      const triggerResponse = await fetch('/api/process-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: filePath, documentId: insertData.id }),
      });
      if (!triggerResponse.ok) {
        throw new Error("Erreur lors du déclenchement de l'analyse.");
      }

      setUploadProgress(100);
      setCurrentStep('Succès !');
      setFile(null);

      // Petit délai pour voir la progression complète
      setTimeout(() => {
        onUploadSuccess();
        setUploadProgress(0);
        setCurrentStep('');
      }, 500);
    } catch (err: unknown) {
      console.error("Erreur UploadForm:", err);
      const errorMessage = err instanceof Error ? err.message : "Une erreur inconnue est survenue.";
      setError(errorMessage);
      setUploadProgress(0);
      setCurrentStep('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-heading font-semibold mb-4 text-brand-dark">Téléverser un Cours (PDF)</h2>
      <p className="text-sm text-gray-600 mb-4">
        Limite : {FILE_LIMITS.MAX_SIZE_MB} Mo et {FILE_LIMITS.MAX_PAGES} pages. L&apos;analyse est effectuée en arrière-plan.
      </p>

      {/* Zone de drag & drop */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors mb-4 ${
          isDragging
            ? 'border-brand-yellow bg-brand-yellow-light'
            : 'border-gray-300 hover:border-brand-yellow/50'
        }`}
      >
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          id="file-upload"
          className="hidden"
          aria-label="Sélectionner un fichier PDF"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center gap-2"
        >
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span className="text-sm font-medium text-gray-700">
            {file ? file.name : 'Glissez-déposez un PDF ici ou cliquez pour sélectionner'}
          </span>
          <span className="text-xs text-gray-500">
            PDF uniquement, max {FILE_LIMITS.MAX_SIZE_MB} Mo
          </span>
        </label>
      </div>

      {/* Bouton d'upload */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          className="flex-1 px-4 py-2 cursor-pointer bg-brand-teal hover:bg-brand-teal-dark text-white font-semibold rounded-md shadow-sm transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Téléversement...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <span>Téléverser et Analyser</span>
            </>
          )}
        </button>
      </div>

      {/* Barre de progression */}
      {uploading && (
        <div className="mt-4">
            <ProgressBar
            progress={uploadProgress}
            label={currentStep}
            showPercentage
            color="teal"
          />
        </div>
      )}

      {/* Messages d'erreur améliorés */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Erreur</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 transition-colors"
            aria-label="Fermer l'erreur"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}