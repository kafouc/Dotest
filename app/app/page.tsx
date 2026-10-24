"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { motion } from 'framer-motion';

import Sidebar from '@/components/app/Sidebar';
import DocumentTabs from '@/components/app/DocumentTabs';
import ActiveDocument from '@/components/app/ActiveDocument';
import WelcomePanel from '@/components/app/WelcomePanel';
import CheckoutNoticeBanner from '@/components/app/CheckoutNoticeBanner';
import OnboardingChecklist from '@/components/app/OnboardingChecklist';
import dynamic from 'next/dynamic';
import ToastContainer, { useToast } from '@/components/ui/Toast';
import { confirmDialog } from '@/components/ui/confirm';

import { useAuthSession } from '@/hooks/useAuthSession';
import { useCheckoutNotice } from '@/hooks/useCheckoutNotice';
import { useDocuments } from '@/hooks/useDocuments';
import { useDocumentTabs } from '@/hooks/useDocumentTabs';
import { useUserPlan } from '@/hooks/useUserPlan';
import { useUserStreak } from '@/hooks/useUserStreak';
import { useReviewSummary } from '@/hooks/useReviewSummary';
import { useOnboarding } from '@/hooks/useOnboarding';
import { trackPageView } from '@/lib/trackPageView';
import type { DocumentInfo } from '@/lib/types';

const UploadForm = dynamic(() => import('@/components/UploadForm'), {
  loading: () => <div className="h-40 animate-pulse rounded-lg bg-gray-100" role="status" aria-label="Chargement du formulaire d'import" />,
});
// Invites secondaires : chargées après l'affichage de l'application
const PWAInstallPrompt = dynamic(() => import('@/components/PWAInstallPrompt'), { ssr: false });
const AutoEnablePushNotifications = dynamic(() => import('@/components/AutoEnablePushNotifications'), { ssr: false });

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

function AppHomeContent() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const { toasts, showToast, removeToast } = useToast();

  const { session, isCheckingAuth, logout } = useAuthSession(supabase);
  const userId = session?.user?.id ?? null;
  const { notice: checkoutNotice, dismiss: dismissCheckoutNotice } = useCheckoutNotice();
  const userPlan = useUserPlan(supabase, session, checkoutNotice);
  const { streak, refreshStreak } = useUserStreak(supabase, userId);
  const { summary: reviewSummary, refreshSummary: refreshReviewSummary } = useReviewSummary(supabase, userId);
  const { documents, isLoadingDocs, fetchDocuments, deleteDocument, deletingPath, retryDocument } = useDocuments(supabase, session);
  const tabs = useDocumentTabs(fetchDocuments);

  const onboarding = useOnboarding(supabase, userId, documents.length);
  const [creatingSample, setCreatingSample] = useState(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    trackPageView('/app');
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const handleDeleteDocument = async (documentPath: string) => {
    const confirmed = await confirmDialog({
      title: 'Supprimer ce document ?',
      message: 'Le document et ses données associées seront supprimés. Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!confirmed) return;

    const result = await deleteDocument(documentPath);
    if (result.ok) {
      tabs.afterDelete(documentPath);
    } else {
      showToast(result.message, 'error');
    }
  };

  const handleRetryDocument = async (doc: DocumentInfo) => {
    const result = await retryDocument(doc);
    showToast(result.ok ? "Analyse relancée." : result.message, result.ok ? 'success' : 'error');
  };

  const handleCreateSample = async () => {
    setCreatingSample(true);
    try {
      const response = await fetch('/api/onboarding/sample', { method: 'POST' });
      const data = (await response.json().catch(() => null)) as { documentPath?: string; error?: string } | null;
      if (!response.ok || !data?.documentPath) {
        showToast(data?.error || "Impossible de créer le document d'exemple.", 'error');
        return;
      }
      await fetchDocuments(false);
      tabs.selectDocument(data.documentPath);
      void onboarding.refresh();
      showToast("Document d'exemple prêt : choisissez un thème et générez votre premier quiz.", 'success');
    } finally {
      setCreatingSample(false);
    }
  };

  // Une activité (quiz généré, carte révisée…) met à jour la série, les compteurs de révision et le parcours guidé
  const handleActivity = () => {
    void refreshStreak();
    void refreshReviewSummary();
    void onboarding.refresh();
  };

  const handleOpenFirstDocument = () => {
    const first = documents[0];
    if (first) tabs.selectDocument(first.path || first.name);
  };

  if (isCheckingAuth) {
    return (
      <>
        <ToastContainer toasts={toasts} onClose={removeToast} />
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-brand-dark">Chargement...</div>
        </div>
      </>
    );
  }

  // Sans session, useAuthSession redirige vers /login
  if (!session) return null;

  const activeDoc = documents.find((d) => (d.path || d.name) === tabs.activeDocumentId);

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row relative">
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden pointer-events-auto"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        <Sidebar
          session={session}
          isMinimized={isSidebarMinimized}
          onToggleMinimize={() => setIsSidebarMinimized(!isSidebarMinimized)}
          onCreateNew={tabs.createNew}
          onLogout={handleLogout}
          supabase={supabase}
          documents={documents}
          isLoadingDocs={isLoadingDocs}
          onDeleteSuccess={() => { void fetchDocuments(false); }}
          onSelectDocument={tabs.selectDocument}
          isMobileMenuOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          streak={streak}
          userPlan={userPlan}
          reviewPending={reviewSummary ? reviewSummary.dueCount + reviewSummary.newCount : 0}
        />

        <div className="flex-1 flex flex-col overflow-hidden w-full">
          <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-md"
              aria-label="Menu"
              aria-expanded={isMobileMenuOpen}
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-lg font-heading font-bold text-brand-dark">SheetOfPaper</span>
            <div className="w-10" />
          </div>

          <DocumentTabs
            documents={documents}
            activeDocumentId={tabs.activeDocumentId}
            onSelectDocument={tabs.selectDocument}
            onCloseDocument={tabs.closeDocument}
            onCreateNew={tabs.createNew}
            openDocumentIds={tabs.openDocumentIds}
          />

          {checkoutNotice && (
            <CheckoutNoticeBanner
              notice={checkoutNotice}
              onManageSubscription={() => router.push('/settings')}
              onDismiss={dismissCheckoutNotice}
            />
          )}

          {onboarding.loaded && !onboarding.dismissed && onboarding.completed < onboarding.total && (
            <OnboardingChecklist
              steps={onboarding.steps}
              hasDocuments={documents.length > 0}
              creatingSample={creatingSample}
              onUpload={tabs.createNew}
              onCreateSample={handleCreateSample}
              onOpenFirstDocument={handleOpenFirstDocument}
              onOpenReview={() => router.push('/review')}
              onDismiss={onboarding.dismiss}
            />
          )}

          <main className="flex-1 overflow-y-auto bg-white">
            <div className="h-full p-6">
              {tabs.showUploadForm ? (
                <motion.div {...fadeIn}>
                  <div className="max-w-4xl mx-auto">
                    <h2 className="text-2xl font-heading font-bold text-brand-dark mb-6">Nouveau document</h2>
                    <UploadForm session={session} supabase={supabase} onUploadSuccess={tabs.afterUpload} />
                  </div>
                </motion.div>
              ) : tabs.activeDocumentId ? (
                <motion.div {...fadeIn}>
                  {activeDoc && (
                    <ActiveDocument
                      supabase={supabase}
                      document={activeDoc}
                      documents={documents}
                      isLoadingDocs={isLoadingDocs}
                      deletingPath={deletingPath}
                      onDelete={handleDeleteDocument}
                      onRetry={handleRetryDocument}
                      onActivity={handleActivity}
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div {...fadeIn}>
                  <WelcomePanel
                    reviewSummary={reviewSummary}
                    documents={documents}
                    onCreateNew={tabs.createNew}
                    onSelectDocument={tabs.selectDocument}
                  />
                </motion.div>
              )}
            </div>
          </main>
        </div>
        <PWAInstallPrompt />
        <AutoEnablePushNotifications />
      </div>
    </>
  );
}

export default function AppHome() {
  return (
    <Suspense fallback={null}>
      <AppHomeContent />
    </Suspense>
  );
}
