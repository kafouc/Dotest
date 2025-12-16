"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { createSupabaseBrowserClient } from '@/lib/supabaseClient';

type UsageRow = {
  usage_date: string;
  provider?: string | null;
  total_requests?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  total_tokens?: number | null;
  estimated_cost?: number | null;
};

type DocumentRow = {
  usage_date: string;
  documents_imported?: number | null;
  documents_processed?: number | null;
  sections_created?: number | null;
};

type UserRow = {
  usage_date: string;
  active_users?: number | null;
  active_users_7d?: number | null;
  active_users_30d?: number | null;
  new_users?: number | null;
};

type HomepageRow = {
  usage_date: string;
  view_count?: number | null;
};

type MetricsState = {
  usageRows: UsageRow[];
  documentRows: DocumentRow[];
  userRows: UserRow[];
  homepageRows: HomepageRow[];
};

type AdminDashboardRealtimeProps = {
  since: string;
  daysWindow: number;
  initialData: MetricsState;
};

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const tokenFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short', day: 'numeric' });

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value));
}

function buildAggregates(metrics: MetricsState) {
  const { usageRows, documentRows, userRows, homepageRows } = metrics;

  const totalRequests = usageRows.reduce((sum, row) => sum + toNumber(row.total_requests), 0);
  const totalPromptTokens = usageRows.reduce((sum, row) => sum + toNumber(row.prompt_tokens), 0);
  const totalCompletionTokens = usageRows.reduce((sum, row) => sum + toNumber(row.completion_tokens), 0);
  const totalEstimatedCost = usageRows.reduce((sum, row) => sum + toNumber(row.estimated_cost), 0);

  const totalDocumentsImported = documentRows.reduce((sum, row) => sum + toNumber(row.documents_imported), 0);
  const totalDocumentsProcessed = documentRows.reduce((sum, row) => sum + toNumber(row.documents_processed), 0);
  const totalSectionsCreated = documentRows.reduce((sum, row) => sum + toNumber(row.sections_created), 0);

  const latestUserMetrics = userRows[0];
  const activeUsers = toNumber(latestUserMetrics?.active_users);
  const activeUsers7d = toNumber(latestUserMetrics?.active_users_7d);
  const activeUsers30d = toNumber(latestUserMetrics?.active_users_30d);
  const newUsers = toNumber(latestUserMetrics?.new_users);

  const homepageViewsTotal = homepageRows.reduce((sum, row) => sum + toNumber(row.view_count), 0);

  const providerBreakdown = usageRows.reduce<Record<string, { requests: number; tokens: number; cost: number }>>((acc, row) => {
    const provider = row.provider ?? 'inconnu';
    if (!acc[provider]) {
      acc[provider] = { requests: 0, tokens: 0, cost: 0 };
    }
    acc[provider].requests += toNumber(row.total_requests);
    const tokens = row.total_tokens ?? toNumber(row.prompt_tokens) + toNumber(row.completion_tokens);
    acc[provider].tokens += toNumber(tokens);
    acc[provider].cost += toNumber(row.estimated_cost);
    return acc;
  }, {});

  const usageByDay = usageRows.reduce<Record<string, { requests: number; cost: number }>>((acc, row) => {
    const date = row.usage_date;
    if (!acc[date]) {
      acc[date] = { requests: 0, cost: 0 };
    }
    acc[date].requests += toNumber(row.total_requests);
    acc[date].cost += toNumber(row.estimated_cost);
    return acc;
  }, {});

  const usageTimeline = Object.entries(usageByDay)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 14);

  return {
    totalRequests,
    totalPromptTokens,
    totalCompletionTokens,
    totalEstimatedCost,
    totalDocumentsImported,
    totalDocumentsProcessed,
    totalSectionsCreated,
    activeUsers,
    activeUsers7d,
    activeUsers30d,
    newUsers,
    homepageViewsTotal,
    providerBreakdown,
    usageTimeline,
    documentRows,
  };
}

export default function AdminDashboardRealtime({ since, daysWindow, initialData }: AdminDashboardRealtimeProps) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const mountedRef = useRef(true);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [metrics, setMetrics] = useState<MetricsState>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number>(Date.now());

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const refreshData = useCallback(
    async ({ silent } = { silent: false }) => {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      try {
        const usageLimit = Math.max(daysWindow * 4, 40);
        const [{ data: usageData, error: usageError }, { data: documentData, error: documentError }, { data: userData, error: userError }, { data: homepageData, error: homepageError }] = await Promise.all([
          supabase
            .from('metrics_daily_usage')
            .select('*')
            .gte('usage_date', since)
            .order('usage_date', { ascending: false })
            .limit(usageLimit),
          supabase
            .from('metrics_daily_documents')
            .select('*')
            .gte('usage_date', since)
            .order('usage_date', { ascending: false })
            .limit(daysWindow),
          supabase
            .from('metrics_daily_users')
            .select('*')
            .gte('usage_date', since)
            .order('usage_date', { ascending: false })
            .limit(daysWindow),
          supabase
            .from('metrics_homepage_views')
            .select('*')
            .gte('usage_date', since)
            .order('usage_date', { ascending: false })
            .limit(daysWindow),
        ]);

        if (usageError || documentError || userError || homepageError) {
          throw usageError ?? documentError ?? userError ?? homepageError;
        }

        if (!mountedRef.current) return;

        setMetrics({
          usageRows: usageData ?? [],
          documentRows: documentData ?? [],
          userRows: userData ?? [],
          homepageRows: homepageData ?? [],
        });
        setLastUpdatedAt(Date.now());
      } catch (err) {
        if (!mountedRef.current) return;
        const message = err instanceof Error ? err.message : 'Impossible de rafraîchir les métriques.';
        setError(message);
      } finally {
        if (!silent && mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [daysWindow, since, supabase],
  );

  useEffect(() => {
    refreshData({ silent: true }).catch(() => {
      /* handled dans refreshData */
    });
  }, [refreshData]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) return;
      refreshTimeoutRef.current = setTimeout(() => {
        refreshData({ silent: true }).finally(() => {
          refreshTimeoutRef.current = null;
        });
      }, 750);
    };

    const tables = [
      'metrics_daily_usage',
      'metrics_daily_documents',
      'metrics_daily_users',
      'metrics_homepage_views',
    ];

    const channel = supabase.channel('admin-dashboard-updates');
    tables.forEach((table) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
    });
    channel.subscribe();

    const intervalId = setInterval(() => {
      refreshData({ silent: true });
    }, 60_000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(intervalId);
    };
  }, [refreshData, supabase]);

  const aggregates = useMemo(() => buildAggregates(metrics), [metrics]);

  const lastUpdatedLabel = useMemo(() => {
    const delta = Date.now() - lastUpdatedAt;
    if (Number.isNaN(delta)) return '';
    if (delta < 90_000) {
      return 'à l’instant';
    }
    const minutes = Math.round(delta / 60_000);
    return `il y a ${minutes} min`;
  }, [lastUpdatedAt]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex flex-1 flex-col bg-gray-50">
        <div className="mx-auto w-full max-w-6xl space-y-10 px-4 pb-14 pt-24 sm:px-6 lg:px-12 lg:pt-14">
          <header className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Administration</span>
                <h1 className="text-3xl font-heading font-bold text-brand-dark">Tableau de bord</h1>
                <p className="text-sm text-brand-dark-lighter">
                  Synthèse des usages Sheet of Paper (IA, documents, utilisateurs) mise à jour en temps réel.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-brand-dark-lighter">
                <span>Dernière mise à jour&nbsp;: {lastUpdatedLabel}</span>
                {loading && (
                  <span className="inline-flex items-center gap-1 text-brand-teal">
                    <LoadingSpinner size="sm" /> Rafraîchissement…
                  </span>
                )}
              </div>
            </div>
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </div>
            )}
          </header>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Requêtes IA</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(aggregates.totalRequests)}</div>
              <div className="mt-1 text-xs text-brand-dark-lighter">
                {tokenFormatter.format(aggregates.totalPromptTokens + aggregates.totalCompletionTokens)} tokens
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Coût estimé</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{currencyFormatter.format(aggregates.totalEstimatedCost)}</div>
              <div className="mt-1 text-xs text-brand-dark-lighter">IA (Groq + Cohere)</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Documents importés</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(aggregates.totalDocumentsImported)}</div>
              <div className="mt-1 text-xs text-brand-dark-lighter">
                {numberFormatter.format(aggregates.totalDocumentsProcessed)} traités · {numberFormatter.format(aggregates.totalSectionsCreated)} segments
              </div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Vues vitrine</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(aggregates.homepageViewsTotal)}</div>
              <div className="mt-1 text-xs text-brand-dark-lighter">https://sheetofpaper.com/</div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-brand-dark">Utilisateurs actifs</h2>
                <span className="text-xs text-brand-dark-lighter">Dernière mesure</span>
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-dark-lighter">Actifs (24h)</dt>
                  <dd className="mt-1 text-xl font-semibold text-brand-dark">{numberFormatter.format(aggregates.activeUsers)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-dark-lighter">Actifs (7 jours)</dt>
                  <dd className="mt-1 text-xl font-semibold text-brand-dark">{numberFormatter.format(aggregates.activeUsers7d)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-dark-lighter">Actifs (30 jours)</dt>
                  <dd className="mt-1 text-xl font-semibold text-brand-dark">{numberFormatter.format(aggregates.activeUsers30d)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-dark-lighter">Nouveaux (24h)</dt>
                  <dd className="mt-1 text-xl font-semibold text-brand-dark">{numberFormatter.format(aggregates.newUsers)}</dd>
                </div>
              </dl>
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-brand-dark">Répartition IA par fournisseur</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-brand-dark-lighter">
                      <th className="py-2">Fournisseur</th>
                      <th className="py-2">Requêtes</th>
                      <th className="py-2">Tokens</th>
                      <th className="py-2">Coût estimé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(aggregates.providerBreakdown).map(([provider, data]) => (
                      <tr key={provider} className="odd:bg-gray-50">
                        <td className="py-2 font-medium text-brand-dark">{provider}</td>
                        <td className="py-2">{numberFormatter.format(data.requests)}</td>
                        <td className="py-2">{tokenFormatter.format(data.tokens)}</td>
                        <td className="py-2">{currencyFormatter.format(data.cost)}</td>
                      </tr>
                    ))}
                    {Object.keys(aggregates.providerBreakdown).length === 0 && (
                      <tr>
                        <td className="py-4 text-center text-xs text-brand-dark-lighter" colSpan={4}>
                          Aucune donnée IA enregistrée sur la période.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-brand-dark">Chronologie IA (14 jours)</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-brand-dark-lighter">
                      <th className="py-2">Date</th>
                      <th className="py-2">Requêtes</th>
                      <th className="py-2">Coût estimé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregates.usageTimeline.map(([date, stats]) => (
                      <tr key={date} className="odd:bg-gray-50">
                        <td className="py-2 font-medium text-brand-dark">{formatDate(date)}</td>
                        <td className="py-2">{numberFormatter.format(stats.requests)}</td>
                        <td className="py-2">{currencyFormatter.format(stats.cost)}</td>
                      </tr>
                    ))}
                    {aggregates.usageTimeline.length === 0 && (
                      <tr>
                        <td className="py-4 text-center text-xs text-brand-dark-lighter" colSpan={3}>
                          Pas encore de requêtes enregistrées.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-brand-dark">Documents par jour</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-brand-dark-lighter">
                      <th className="py-2">Date</th>
                      <th className="py-2">Importés</th>
                      <th className="py-2">Traités</th>
                      <th className="py-2">Segments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.documentRows.slice(0, 14).map((row) => (
                      <tr key={row.usage_date} className="odd:bg-gray-50">
                        <td className="py-2 font-medium text-brand-dark">{formatDate(row.usage_date)}</td>
                        <td className="py-2">{numberFormatter.format(toNumber(row.documents_imported))}</td>
                        <td className="py-2">{numberFormatter.format(toNumber(row.documents_processed))}</td>
                        <td className="py-2">{numberFormatter.format(toNumber(row.sections_created))}</td>
                      </tr>
                    ))}
                    {metrics.documentRows.length === 0 && (
                      <tr>
                        <td className="py-4 text-center text-xs text-brand-dark-lighter" colSpan={4}>
                          Aucun document traité sur la période.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
