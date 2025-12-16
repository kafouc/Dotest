"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Flame } from 'lucide-react';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { DocumentInfo } from '@/lib/types';
import type { UserStreak } from '@/lib/streaks';
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
  isMobileMenuOpen?: boolean;
  onCloseMobile?: () => void;
  streak?: UserStreak | null;
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
  isMobileMenuOpen = false,
  onCloseMobile,
  streak,
}: SidebarProps) {
  const currentStreak = streak?.current_streak ?? 0;
  const streakLabel = currentStreak > 0 ? `${currentStreak} jour${currentStreak > 1 ? 's' : ''}` : '0 jour';

  return (
    <aside
      className={`
        bg-white border-r border-gray-200 transition-all duration-300 flex flex-col
        fixed md:relative inset-y-0 left-0 z-50
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${isMinimized ? 'w-64 md:w-16' : 'w-64 md:w-80'}
      `}
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
        <div className="flex items-center gap-2">
          {/* Bouton fermer sur mobile */}
          {isMobileMenuOpen && onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="md:hidden p-1 hover:bg-gray-100 rounded transition-colors"
              aria-label="Fermer le menu"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {/* Bouton minimize desktop */}
          <button
            onClick={onToggleMinimize}
            className="hidden md:block p-1 hover:bg-gray-100 rounded transition-colors"
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
      </div>

      {/* Encart utilisateur */}
      <div className={`p-4 border-b border-gray-200 ${isMinimized ? 'px-2' : ''}`}>
        {isMinimized ? (
          <div className="flex justify-center">
            <div className="relative flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-brand-yellow flex items-center justify-center text-brand-dark font-semibold text-sm">
                {session.user.email?.[0]?.toUpperCase() || 'U'}
              </div>
              {currentStreak > 0 && (
                <div className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
                  {currentStreak > 99 ? '99+' : currentStreak}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-yellow flex items-center justify-center text-brand-dark font-semibold">
              {session.user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-brand-dark truncate">{session.user.email}</p>
              <div className="mt-1 flex items-center gap-1 text-xs text-orange-600">
                <Flame className="h-4 w-4" aria-hidden="true" />
                <span className="font-semibold leading-none">{streakLabel}</span>
                {streak?.last_active_date && (
                  <span className="text-[10px] text-gray-500">(dernière activité le {new Date(streak.last_active_date).toLocaleDateString('fr-FR')})</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bouton créer nouvelle fenêtre */}
      <div className={`p-4 ${isMinimized ? 'px-2' : ''}`}>
        <button
          onClick={() => {
            onCreateNew();
            onCloseMobile?.();
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-full transition-colors ${
            isMinimized ? 'md:justify-center md:px-3' : ''
          }`}
          style={{ backgroundColor: '#fbbf1d' }}
          aria-label="Créer un nouveau document"
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      <nav className={`${isMinimized ? 'px-2' : 'px-4'} py-4 space-y-2`}>
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ${
            isMinimized ? 'justify-center px-2' : ''
          }`}
          title={isMinimized ? 'Paramètres' : ''}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {!isMinimized && <span>Paramètres</span>}
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

