"use client";

import { useState, useEffect, useCallback, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Session } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';
import { FaSpinner, FaCheckCircle, FaTimesCircle, FaTrash } from 'react-icons/fa';

import Sidebar from '@/components/app/Sidebar';
import DocumentTabs from '@/components/app/DocumentTabs';
import UploadForm from '@/components/UploadForm';
import QuizGenerator from '@/components/QuizGenerator';
import ProgressTracker from '@/components/ProgressTracker';
import RevisionSheet from '@/components/RevisionSheet';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import AutoEnablePushNotifications from '@/components/AutoEnablePushNotifications';

import { motion } from 'framer-motion';
import type { DocumentInfo } from '@/lib/types';
import { DOCUMENT_STATUS } from '@/lib/constants';
import { ensureNotificationPermission, registerServiceWorker, subscribePush, sendSubscriptionToServer } from '@/lib/pushManager';
import { trackPageView } from '@/lib/trackPageView';
import { fetchUserStreak, type UserStreak } from '@/lib/streaks';
import { fetchUserPlan, type SubscriptionPlan } from '@/lib/subscriptions';
import ToastContainer, { useToast } from '@/components/ui/Toast';

function AppHomeContent() {
  const router = useRouter();
  const [supabase] = useState(() => createSupabaseBrowserClient());
  const [session, setSession] = useState<Session | null>(null);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [openDocumentIds, setOpenDocumentIds] = useState<Set<string>>(new Set());
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>('freemium');
  const searchParams = useSearchParams();
  const checkoutParam = searchParams.get('checkout');
  const searchParamsString = searchParams.toString();
  const [checkoutNotice, setCheckoutNotice] = useState<'partial' | 'pro' | 'cancel' | null>(null);
  const userId = session?.user?.id ?? null;
  const [, startDocumentTransition] = useTransition();
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    trackPageView('/app');
  }, []);

  useEffect(() => {
    if (!checkoutParam) {
      return;
    }

    if (checkoutParam === 'partial' || checkoutParam === 'pro' || checkoutParam === 'cancel') {
      setCheckoutNotice(checkoutParam);
    }

    const params = new URLSearchParams(searchParamsString);
    params.delete('checkout');
    params.delete('session_id');
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/app?${nextQuery}` : '/app', { scroll: false });
  }, [checkoutParam, router, searchParamsString]);

  useEffect(() => {
    if (!checkoutNotice) {
      return;
    }
    const timer = setTimeout(() => setCheckoutNotice(null), 8000);
    return () => clearTimeout(timer);
  }, [checkoutNotice]);

  const loadUserPlan = useCallback(async (): Promise<SubscriptionPlan> => {
    const planRow = await fetchUserPlan(supabase).catch(() => null);
    const plan = planRow?.plan;
    return plan === 'partial' || plan === 'pro' ? plan : 'freemium';
  }, [supabase]);

  const refreshUserPlan = useCallback(async (): Promise<SubscriptionPlan> => {
    const nextPlan = await loadUserPlan();
    setUserPlan(nextPlan);
    return nextPlan;
  }, [loadUserPlan]);

  const resyncUserPlan = useCallback(async (): Promise<SubscriptionPlan | null> => {
    try {
      const response = await fetch('/api/billing/resync', { method: 'POST' });
      if (!response.ok) {
        return null;
      }
      const data = await response.json() as { plan?: SubscriptionPlan };
      const plan = data?.plan;
      if (plan === 'freemium' || plan === 'partial' || plan === 'pro') {
        return plan;
      }
      return null;
    } catch (error) {
      console.warn('[billing] resyncUserPlan failed', error);
      return null;
    }
  }, []);

  useEffect(() => {
    if (checkoutNotice !== 'partial' && checkoutNotice !== 'pro') {
      return;
    }

    setUserPlan(checkoutNotice);

    let cancelled = false;
    let retryTimer: number | null = null;

    const syncPlan = async () => {
      const fetchedPlan = await loadUserPlan();
      if (cancelled) return;
      if (fetchedPlan === checkoutNotice) {
        setUserPlan(fetchedPlan);
        return;
      }
      const resyncedPlan = await resyncUserPlan();
      if (cancelled) return;
      if (resyncedPlan) {
        setUserPlan(resyncedPlan);
      } else if (fetchedPlan !== checkoutNotice) {
        setUserPlan(fetchedPlan);
      }
    };

    void syncPlan();

    retryTimer = window.setTimeout(() => {
      void syncPlan();
    }, 4000);

    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [checkoutNotice, loadUserPlan, resyncUserPlan]);

  const refreshStreak = useCallback(async () => {
    if (!userId) {
      setStreak(null);
      return;
    }
    const data = await fetchUserStreak(supabase, userId);
    setStreak(data);
  }, [supabase, userId]);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setStreak(null);
      return;
    }
    (async () => {
      const data = await fetchUserStreak(supabase, userId);
      if (!cancelled) setStreak(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  // Mémorisation de fetchDocuments - supabase ne change jamais donc pas besoin de dépendance
  const fetchDocuments = useCallback(async (isInitialLoad = false): Promise<DocumentInfo[]> => {
    if (isInitialLoad) setIsLoadingDocs(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (isInitialLoad) setIsLoadingDocs(false);
      setDocuments([]);
      return [];
    }
    const { data: docs, error: fetchError } = await supabase
      .from('documents')
      .select('file_name, file_path, created_at, status, status_message')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (fetchError) {
      console.error("Erreur chargement DB:", fetchError);
      if (isInitialLoad) setIsLoadingDocs(false);
      return [];
    }
    
    const documentList = docs?.map(doc => ({
      name: doc.file_name,
      path: doc.file_path,
      created_at: doc.created_at,
      status: doc.status as DocumentInfo['status'],
      status_message: doc.status_message,
    })) ?? [];
    
    setDocuments(documentList);
    if (isInitialLoad) setIsLoadingDocs(false);
    return documentList;
  }, [supabase]);

  // Charger les documents quand la session est disponible
    useEffect(() => {
      if (session) {
        void fetchDocuments(true);
      }
    }, [session, fetchDocuments]);

  // Polling optimisé : seulement si des documents sont en traitement
  useEffect(() => {
    const isProcessing = documents.some(
      doc => doc.status === DOCUMENT_STATUS.PENDING || doc.status === DOCUMENT_STATUS.PROCESSING
    );
    
    if (!isProcessing) return;
    
    // Interval de polling (5 secondes)
    const interval = setInterval(() => {
        void fetchDocuments(false);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsCheckingAuth(false);
      if (!session) {
        router.push('/login');
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        router.push('/login');
      }
    });
    return () => subscription.unsubscribe();
  }, [supabase, router]);

  useEffect(() => {
    if (!session) {
      setUserPlan('freemium');
      return;
    }
    void refreshUserPlan();
  }, [session, refreshUserPlan]);

  // Auto-activer les notifications au premier chargement
  useEffect(() => {
    if (!session) return;

    const autoEnableNotifications = async () => {
      try {
        // Vérifier si déjà abonné
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();
        
        if (existingSubscription) {
          // Déjà abonné, ne rien faire
          return;
        }

        // Tenter d'activer automatiquement
        const permitted = await ensureNotificationPermission();
        if (!permitted || permitted === 'denied') return; // Permission refusée, on n'insiste pas

        const reg = await registerServiceWorker('/sw.js');
        if (!reg) return;

        // Attendre que le SW soit bien prêt
        await new Promise(resolve => setTimeout(resolve, 500));

        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapid) return;

        const sub = await subscribePush(reg, vapid);
        await sendSubscriptionToServer(sub);
        
        console.log('✓ Notifications activées automatiquement');
      } catch (error) {
        // En cas d'erreur, on ne fait rien (silencieux)
        console.log('Notifications non activées automatiquement:', error);
      }
    };

    // Attendre 2 secondes après la connexion pour laisser le temps au SW de s'initialiser
    const timer = setTimeout(autoEnableNotifications, 2000);
    return () => clearTimeout(timer);
  }, [session]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Ne laisse aucune donnée de l'utilisateur dans les caches de l'appareil
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
    } catch {
      // Cache indisponible : rien à nettoyer
    }
    setSession(null);
    setStreak(null);
    setUserPlan('freemium');
  };

  const handleCreateNew = () => {
    setShowUploadForm(true);
    setActiveDocumentId(null);
  };

  const handleSelectDocument = (documentId: string) => {
    startDocumentTransition(() => {
      setActiveDocumentId(documentId);
      setShowUploadForm(false);
      // Ajouter le document aux documents ouverts s'il n'y est pas déjà
      setOpenDocumentIds((prev) => new Set(prev).add(documentId));
    });
    // Rafraîchir les données du document et re-rendre la section
    void fetchDocuments(false);
  };

  const handleCloseDocument = (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDocumentIds(prev => {
      const next = new Set(prev);
      next.delete(documentId);
      return next;
    });

    setActiveDocumentId(prevActive => {
      if (prevActive !== documentId) {
        return prevActive;
      }
      const remainingIds = Array.from(openDocumentIds).filter(id => id !== documentId);
      const nextActive = remainingIds[0] ?? null;
      if (!nextActive) {
        setShowUploadForm(false);
      }
      return nextActive;
    });

    void fetchDocuments(false);
  };

  const handleUploadSuccess = async () => {
    setShowUploadForm(false);
    const refreshed = await fetchDocuments(false);
    const latestDoc = refreshed[0];
    if (!latestDoc) {
      return;
    }
    const docId = latestDoc.path || latestDoc.name;
    if (!docId) {
      return;
    }
    setActiveDocumentId(docId);
    setOpenDocumentIds(prev => new Set(prev).add(docId));
  };

  const handleDeleteDocument = useCallback(async (documentPath: string) => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir supprimer ce document et ses données associées ? Cette action est irréversible.`
      )
    ) {
      return;
    }
    setDeletingPath(documentPath);
    try {
      // 1. Supprimer les sections
      const { error: deleteSectionsError } = await supabase
        .from('document_sections')
        .delete()
        .eq('document_path', documentPath);
      if (deleteSectionsError) throw deleteSectionsError;

      // 2. Supprimer la ligne de la table 'documents'
      const { error: deleteDocError } = await supabase
        .from('documents')
        .delete()
        .eq('file_path', documentPath);
      if (deleteDocError) throw deleteDocError;

      // 3. Supprimer le fichier PDF du Storage
      const { error: deleteFileError } = await supabase.storage
        .from('pdfs')
        .remove([documentPath]);
      if (deleteFileError) throw deleteFileError;

      // 4. Retirer de l'état local
      setOpenDocumentIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentPath);
        return newSet;
      });

      // 5. Si c'était le document actif, fermer l'onglet
      if (activeDocumentId === documentPath) {
        const remainingIds = Array.from(openDocumentIds).filter(id => id !== documentPath);
        if (remainingIds.length > 0) {
          setActiveDocumentId(remainingIds[0]);
        } else {
          setActiveDocumentId(null);
        }
      }

      // 6. Rafraîchir la liste
      await fetchDocuments(false);
    } catch (err: unknown) {
      console.error('Erreur suppression:', err);
      const message = err instanceof Error ? err.message : 'Une erreur est survenue lors de la suppression.';
      showToast(message, 'error');
    } finally {
      setDeletingPath(null);
    }
  }, [supabase, activeDocumentId, openDocumentIds, fetchDocuments, showToast]);

  // Afficher un loader pendant la vérification de l'authentification
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

  // Si pas de session, rediriger (le useEffect s'en charge)
  if (!session) {
    return null;
  }

  return (
    <>
      <ToastContainer toasts={toasts} onClose={removeToast} />
      <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row relative">
      {/* Overlay mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden pointer-events-auto"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        session={session}
        isMinimized={isSidebarMinimized}
        onToggleMinimize={() => setIsSidebarMinimized(!isSidebarMinimized)}
        onCreateNew={handleCreateNew}
        onLogout={handleLogout}
        supabase={supabase}
        documents={documents}
        isLoadingDocs={isLoadingDocs}
        onDeleteSuccess={() => { void fetchDocuments(false); }}
        onSelectDocument={handleSelectDocument}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        streak={streak}
        userPlan={userPlan}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Mobile Header avec burger */}
        <div className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 hover:bg-gray-100 rounded-md"
            aria-label="Menu"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-lg font-heading font-bold text-brand-dark">SheetOfPaper</span>
          <div className="w-10" /> {/* Spacer pour centrer le titre */}
        </div>

        {/* Document Tabs */}
        <DocumentTabs
          documents={documents}
          activeDocumentId={activeDocumentId}
          onSelectDocument={handleSelectDocument}
          onCloseDocument={handleCloseDocument}
          onCreateNew={handleCreateNew}
          openDocumentIds={openDocumentIds}
        />

        {checkoutNotice && (
          <div
            className={`mx-4 mt-4 rounded-lg border px-4 py-3 text-sm sm:mx-6 ${
              checkoutNotice === 'cancel'
                ? 'border-yellow-200 bg-yellow-50 text-yellow-800'
                : 'border-green-200 bg-green-50 text-green-800'
            }`}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>
                {checkoutNotice === 'partial' && (
                  <>Plan Partiel activé&nbsp;! Les quotas confort sont maintenant disponibles.</>
                )}
                {checkoutNotice === 'pro' && (
                  <>Plan Sérénité activé&nbsp;! Toutes les fonctionnalités avancées sont débloquées.</>
                )}
                {checkoutNotice === 'cancel' && (
                  <>Paiement annulé. Aucun changement n&apos;a été effectué.</>
                )}
              </span>
              <div className="flex items-center gap-2">
                {checkoutNotice !== 'cancel' && (
                  <button
                    type="button"
                    onClick={() => router.push('/settings')}
                    className="rounded-md border border-current px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                  >
                    Gérer mon abonnement
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCheckoutNotice(null)}
                  className="rounded-md border border-transparent bg-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-inherit hover:bg-white/70"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="h-full p-6">
            {showUploadForm ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="max-w-4xl mx-auto">
                  <h2 className="text-2xl font-heading font-bold text-brand-dark mb-6">
                    Nouveau document
                  </h2>
                  <UploadForm
                    session={session}
                    supabase={supabase}
                    onUploadSuccess={handleUploadSuccess}
                  />
                </div>
              </motion.div>
            ) : activeDocumentId ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="max-w-6xl mx-auto">
                  {/* En-tête du document */}
                  {(() => {
                    const activeDoc = documents.find(d => (d.path || d.name) === activeDocumentId);
                    if (!activeDoc) return null;

                    const getStatusIcon = () => {
                      if (activeDoc.status === DOCUMENT_STATUS.PENDING || activeDoc.status === DOCUMENT_STATUS.PROCESSING) {
                        return <FaSpinner className="w-5 h-5 text-yellow-600 animate-spin" />;
                      }
                      if (activeDoc.status === DOCUMENT_STATUS.FAILED) {
                        return <FaTimesCircle className="w-5 h-5 text-red-600" />;
                      }
                      return <FaCheckCircle className="w-5 h-5 text-green-600" />;
                    };

                    const getStatusText = () => {
                      if (activeDoc.status === DOCUMENT_STATUS.PENDING || activeDoc.status === DOCUMENT_STATUS.PROCESSING) {
                        return 'En cours d\'analyse';
                      }
                      if (activeDoc.status === DOCUMENT_STATUS.FAILED) {
                        return 'Échec';
                      }
                      return 'Prêt';
                    };

                    const formatDate = (dateString: string) => {
                      const date = new Date(dateString);
                      return date.toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      });
                    };

                    const isDeleting = deletingPath === activeDoc.path;

                    return (
                      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h2 className="text-2xl font-heading font-bold text-brand-dark">
                                {activeDoc.name}
                              </h2>
                              {getStatusIcon()}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-2">
                                <span className="font-medium">Statut:</span>
                                <span>{getStatusText()}</span>
                              </span>
                              <span className="flex items-center gap-2">
                                <span className="font-medium">Déposé le:</span>
                                <span>{formatDate(activeDoc.created_at)}</span>
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteDocument(activeDoc.path)}
                            disabled={isDeleting || deletingPath !== null}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Supprimer le document"
                          >
                            <FaTrash className="w-4 h-4" />
                            <span>{isDeleting ? 'Suppression...' : 'Supprimer'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {(() => {
                    const activeDoc = documents.find(d => (d.path || d.name) === activeDocumentId);
                    if (!activeDoc) return null;

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Sidebar gauche avec ProgressTracker */}
                        <div className="lg:col-span-1">
                          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                            <ProgressTracker 
                              key={activeDoc.path}
                              supabase={supabase} 
                              documentPath={activeDoc.path} 
                            />
                          </div>
                        </div>

                        {/* Zone principale avec Quiz Generator */}
                        <div className="lg:col-span-2">
                          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6 mb-6">
                            <QuizGenerator 
                              key={activeDoc.path}
                              documents={documents} 
                              isLoading={isLoadingDocs}
                              activeDocumentPath={activeDoc.path}
                              onActivity={refreshStreak}
                            />
                          </div>
                          <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                            <RevisionSheet
                              documentPath={activeDoc.path}
                              onActivity={refreshStreak}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="max-w-6xl mx-auto"
              >
                <div className="text-center py-12">
                  <h2 className="text-3xl font-heading font-bold text-brand-dark mb-4">
                    Bienvenue sur SheetOfPaper
                  </h2>
                  <p className="text-gray-600 mb-8">
                    Créez un nouveau document ou sélectionnez un document existant pour commencer
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="px-6 py-3 bg-brand-yellow hover:bg-brand-yellow-dark text-brand-dark font-semibold rounded-full transition-colors"
                    style={{ backgroundColor: '#fbbf1d' }}
                  >
                    Créer un nouveau document
                  </button>
                </div>

                {documents.length > 0 && (
                  <div className="mt-12">
                    <h3 className="text-xl font-heading font-bold text-brand-dark mb-4">
                      Documents récents
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {documents.slice(0, 6).map((doc) => {
                        const docId = doc.path || doc.name;
                        return (
                          <button
                            key={docId}
                            onClick={() => handleSelectDocument(docId)}
                            className="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-brand-yellow hover:shadow-md transition-all"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span className="text-sm font-semibold text-brand-dark truncate">
                                {doc.name}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
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
