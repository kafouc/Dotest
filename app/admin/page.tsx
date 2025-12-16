import { redirect } from 'next/navigation';
import AccessRestricted from '@/components/admin/AccessRestricted';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const tokenFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const currencyFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const DAYS_WINDOW = 30;

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', day: 'numeric' }).format(new Date(value));
}

export default async function AdminDashboard() {
  const supabase = createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?redirect=/admin');
  }

  const { data: isAdminData, error: adminError } = await supabase.rpc('is_admin');
  const isAdmin = Boolean(isAdminData);
  if (adminError) {
    throw adminError;
  }

  if (!isAdmin) {
    return <AccessRestricted userEmail={user.email} />;
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - (DAYS_WINDOW - 1));
  const since = sinceDate.toISOString().slice(0, 10);

  const [usageRes, documentsRes, usersRes, homepageRes] = await Promise.all([
    supabase
      .from('metrics_daily_usage')
      .select('*')
      .gte('usage_date', since)
      .order('usage_date', { ascending: false })
      .limit(DAYS_WINDOW * 4),
    supabase
      .from('metrics_daily_documents')
      .select('*')
      .gte('usage_date', since)
      .order('usage_date', { ascending: false })
      .limit(DAYS_WINDOW),
    supabase
      .from('metrics_daily_users')
      .select('*')
      .gte('usage_date', since)
      .order('usage_date', { ascending: false })
      .limit(DAYS_WINDOW),
    supabase
      .from('metrics_homepage_views')
      .select('*')
      .gte('usage_date', since)
      .order('usage_date', { ascending: false })
      .limit(DAYS_WINDOW),
  ]);

  const usageRows = usageRes.data ?? [];
  const documentRows = documentsRes.data ?? [];
  const userRows = usersRes.data ?? [];
  const homepageRows = homepageRes.data ?? [];

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
    acc[provider].tokens += toNumber(row.total_tokens ?? (row.prompt_tokens ?? 0) + (row.completion_tokens ?? 0));
    acc[provider].cost += toNumber(row.estimated_cost);
    return acc;
  }, {});

  const usageByDay = usageRows.reduce<Record<string, { requests: number; cost: number }>>((acc, row) => {
    const date = row.usage_date as string;
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex flex-1 flex-col bg-gray-50">
        <div className="mx-auto w-full max-w-6xl space-y-10 px-4 pb-14 pt-24 sm:px-6 lg:px-12 lg:pt-14">
          <header className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Administration</span>
            <h1 className="text-3xl font-heading font-bold text-brand-dark">Tableau de bord</h1>
            <p className="text-sm text-brand-dark-lighter">
              Synthèse des usages Sheet of Paper (IA, documents, utilisateurs) sur les {DAYS_WINDOW} derniers jours.
            </p>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Requêtes IA</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalRequests)}</div>
              <div className="mt-1 text-xs text-brand-dark-lighter">{tokenFormatter.format(totalPromptTokens + totalCompletionTokens)} tokens</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Coût estimé</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{currencyFormatter.format(totalEstimatedCost)}</div>
              <div className="mt-1 text-xs text-brand-dark-lighter">IA (Groq + Cohere)</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Documents importés</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalDocumentsImported)}</div>
              <div className="mt-1 text-xs text-brand-dark-lighter">{numberFormatter.format(totalDocumentsProcessed)} traités · {numberFormatter.format(totalSectionsCreated)} segments</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Vues vitrine</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(homepageViewsTotal)}</div>
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
                  <dd className="mt-1 text-xl font-semibold text-brand-dark">{numberFormatter.format(activeUsers)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-dark-lighter">Actifs (7 jours)</dt>
                  <dd className="mt-1 text-xl font-semibold text-brand-dark">{numberFormatter.format(activeUsers7d)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-dark-lighter">Actifs (30 jours)</dt>
                  <dd className="mt-1 text-xl font-semibold text-brand-dark">{numberFormatter.format(activeUsers30d)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-brand-dark-lighter">Nouveaux (24h)</dt>
                  <dd className="mt-1 text-xl font-semibold text-brand-dark">{numberFormatter.format(newUsers)}</dd>
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
                    {Object.entries(providerBreakdown).map(([provider, data]) => (
                      <tr key={provider} className="odd:bg-gray-50">
                        <td className="py-2 font-medium text-brand-dark">{provider}</td>
                        <td className="py-2">{numberFormatter.format(data.requests)}</td>
                        <td className="py-2">{tokenFormatter.format(data.tokens)}</td>
                        <td className="py-2">{currencyFormatter.format(data.cost)}</td>
                      </tr>
                    ))}
                    {Object.keys(providerBreakdown).length === 0 && (
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
                    {usageTimeline.map(([date, stats]) => (
                      <tr key={date} className="odd:bg-gray-50">
                        <td className="py-2 font-medium text-brand-dark">{formatDate(date)}</td>
                        <td className="py-2">{numberFormatter.format(stats.requests)}</td>
                        <td className="py-2">{currencyFormatter.format(stats.cost)}</td>
                      </tr>
                    ))}
                    {usageTimeline.length === 0 && (
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
                    {documentRows.slice(0, 14).map((row) => (
                      <tr key={row.usage_date as string} className="odd:bg-gray-50">
                        <td className="py-2 font-medium text-brand-dark">{formatDate(row.usage_date as string)}</td>
                        <td className="py-2">{numberFormatter.format(toNumber(row.documents_imported))}</td>
                        <td className="py-2">{numberFormatter.format(toNumber(row.documents_processed))}</td>
                        <td className="py-2">{numberFormatter.format(toNumber(row.sections_created))}</td>
                      </tr>
                    ))}
                    {documentRows.length === 0 && (
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
