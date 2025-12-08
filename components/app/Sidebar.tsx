"use client";

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { DocumentInfo } from '@/lib/types';
import DocumentList from '@/components/DocumentList';

type SidebarProps = {
  session: Session;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onCreateNew: () => void;
  onLogout: () => void;
  supabase: SupabaseClient;
  documents: DocumentInfo[];
  isLoadingDocs: boolean;
  onDeleteSuccess: () => void;
  onSelectDocument: (documentId: string) => void;
};

export default function Sidebar({ 
  session, 
  isMinimized, 
  onToggleMinimize, 
  onCreateNew, 
  onLogout,
  supabase,
  documents,
  isLoadingDocs,
  onDeleteSuccess,
  onSelectDocument,
}: SidebarProps) {
  return (
    <aside
      className={`bg-white border-r border-gray-200 transition-all duration-300 flex flex-col ${
        isMinimized ? 'w-16' : 'w-80'
      }`}
    >
      {/* Header avec logo et bouton minimize */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!isMinimized && (
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/brand/logo/paper_logo.svg"
              alt="Sheet of Paper"
              width={24}
              height={24}
              className="h-6 w-auto"
            />
            <span className="text-lg font-heading font-bold text-brand-dark">SheetOfPaper</span>
          </Link>
        )}
        {isMinimized && (
          <div className="w-full flex justify-center">
            <Image
              src="/brand/logo/paper_logo.svg"
              alt="Sheet of Paper"
              width={24}
              height={24}
              className="h-6 w-auto"
            />
          </div>
        )}
        <button
          onClick={onToggleMinimize}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          aria-label={isMinimized ? 'Agrandir la sidebar' : 'Réduire la sidebar'}
        >
          <svg
            className={`w-5 h-5 text-gray-600 transition-transform ${isMinimized ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Encart utilisateur */}
      <div className={`p-4 border-b border-gray-200 ${isMinimized ? 'px-2' : ''}`}>
        {isMinimized ? (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-brand-yellow flex items-center justify-center text-brand-dark font-semibold text-sm">
              {session.user.email?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center text-brand-dark font-semibold">
              {session.user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-dark truncate">{session.user.email}</p>
              <p className="text-xs text-gray-500">Utilisateur</p>
            </div>
          </div>
        )}
      </div>

      {/* Bouton créer nouvelle fenêtre */}
      <div className={`p-4 ${isMinimized ? 'px-2' : ''}`}>
        <button
          onClick={onCreateNew}
          className={`w-full flex items-center gap-3 px-4 py-3 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-full transition-colors ${
            isMinimized ? 'justify-center px-3' : ''
          }`}
          style={{ backgroundColor: '#fbbf1d' }}
          aria-label="Créer un nouveau document"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {!isMinimized && <span>Nouveau document</span>}
        </button>
      </div>

      {/* Liste des documents */}
      {!isMinimized && (
        <div className="flex-1 overflow-y-auto border-b border-gray-200">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Tous les documents
            </h3>
            <DocumentList
              supabase={supabase}
              documents={documents}
              isLoading={isLoadingDocs}
              onDeleteSuccess={onDeleteSuccess}
              onSelectDocument={onSelectDocument}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className={`${isMinimized ? 'px-2' : 'px-4'} py-4`}>
        <Link
          href="/flashcards"
          className={`flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ${
            isMinimized ? 'justify-center px-2' : ''
          }`}
          title={isMinimized ? 'Flashcards' : ''}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          {!isMinimized && <span>Flashcards</span>}
        </Link>
      </nav>

      {/* Bouton déconnexion */}
      <div className={`p-4 border-t border-gray-200 ${isMinimized ? 'px-2' : ''}`}>
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full transition-colors ${
            isMinimized ? 'justify-center px-3' : ''
          }`}
          aria-label="Se déconnecter"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {!isMinimized && <span>Se déconnecter</span>}
        </button>
      </div>
    </aside>
  );
}

