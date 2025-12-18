"use client";

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';

type Activity = {
  id: number;
  user_email: string | null;
  event_type: string;
  event_data: Record<string, unknown> | null;
  occurred_at: string;
};

const eventTypeLabels: Record<string, string> = {
  quiz_generated: '🎯 Quiz généré',
  summary_generated: '📝 Résumé généré',
  flashcards_generated: '🃏 Flashcards générées',
  document_uploaded: '📤 Document téléversé',
  document_processed: '✅ Document traité',
  challenge_created: '🏆 Défi créé',
  challenge_completed: '✨ Défi complété',
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'À l\'instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  if (diffHour < 24) return `Il y a ${diffHour}h`;
  return new Date(dateStr).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RecentActivitiesFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const fetchActivities = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_recent_activities', {
          p_limit: 20,
          p_offset: 0,
        });

        if (error) throw error;
        setActivities(data || []);
      } catch (err) {
        console.error('Erreur récupération activités:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();

    // Écoute en temps réel
    const channel = supabase
      .channel('public:activity_events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_events',
        },
        (payload) => {
          const newActivity = payload.new as Activity;
          setActivities((prev) => [newActivity, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-dark">Activités récentes</h2>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-dark">Activités récentes</h2>
      <div className="max-h-[500px] space-y-2 overflow-y-auto">
        {activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">Aucune activité récente</p>
        ) : (
          activities.map((activity) => {
            const label = eventTypeLabels[activity.event_type] || activity.event_type;
            const userEmail = activity.user_email || 'Anonyme';
            const timeAgo = formatTimeAgo(activity.occurred_at);

            let details = '';
            if (activity.event_data) {
              const data = activity.event_data;
              if (data.questionCount) details += ` (${data.questionCount} questions)`;
              if (data.cardCount) details += ` (${data.cardCount} cartes)`;
              if (data.chunkCount) details += ` (${data.chunkCount} segments)`;
              if (data.fileName) details += ` - ${data.fileName}`;
            }

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-md border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-brand-dark">{label}</span>
                    <span className="text-xs text-gray-500">{timeAgo}</span>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    {userEmail}
                    {details && <span className="text-gray-500">{details}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
