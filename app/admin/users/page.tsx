import { redirect } from 'next/navigation';
import AccessRestricted from '@/components/admin/AccessRestricted';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';
import { Flame } from 'lucide-react';

type AdminUserRow = {
  user_id: string;
  email: string;
  display_name: string | null;
  documents_count: number;
  quizzes_generated: number;
  revisions_generated: number;
  plan: string | null;
  challenges_shared: number;
  quiz_exports: number;
  summary_exports: number;
  live_recap_exports: number;
  excel_exports: number;
  created_at: string | null;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
};

type AdminUserOverviewRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  documents_count: number | null;
  quizzes_generated: number | null;
  revisions_generated: number | null;
  plan: string | null;
  challenges_shared: number | null;
  quiz_exports: number | null;
  summary_exports: number | null;
  live_recap_exports: number | null;
  excel_exports: number | null;
  created_at: string | null;
  current_streak: number | null;
  longest_streak: number | null;
  last_active_date: string | null;
};

const numberFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

export default async function AdminUsersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?redirect=/admin/users');
  }

  const { data: isAdminData, error: adminError } = await supabase.rpc('is_admin');
  if (adminError) {
    throw adminError;
  }

  const isAdmin = Boolean(isAdminData);
  if (!isAdmin) {
    return <AccessRestricted userEmail={user.email} redirectHref="/app" />;
  }

  const { data: overview, error: overviewError } = await supabase.rpc('admin_list_user_activity');
  if (overviewError) {
    throw overviewError;
  }

  const rawRows: AdminUserOverviewRow[] = Array.isArray(overview)
    ? (overview as AdminUserOverviewRow[])
    : [];

  const rows: AdminUserRow[] = rawRows.map((row) => ({
    user_id: row.user_id,
    email: row.email ?? '',
    display_name: row.display_name,
    documents_count: Number(row.documents_count ?? 0),
    quizzes_generated: Number(row.quizzes_generated ?? 0),
    revisions_generated: Number(row.revisions_generated ?? 0),
    plan: row.plan ?? null,
    challenges_shared: Number(row.challenges_shared ?? 0),
    quiz_exports: Number(row.quiz_exports ?? 0),
    summary_exports: Number(row.summary_exports ?? 0),
    live_recap_exports: Number(row.live_recap_exports ?? 0),
    excel_exports: Number(row.excel_exports ?? 0),
    created_at: row.created_at ?? null,
    current_streak: Number(row.current_streak ?? 0),
    longest_streak: Number(row.longest_streak ?? 0),
    last_active_date: row.last_active_date ?? null,
  }));

  const totalUsers = rows.length;
  const totalDocuments = rows.reduce((sum, row) => sum + row.documents_count, 0);
  const totalQuizzes = rows.reduce((sum, row) => sum + row.quizzes_generated, 0);
  const totalRevisions = rows.reduce((sum, row) => sum + row.revisions_generated, 0);
  const totalChallengesShared = rows.reduce((sum, row) => sum + row.challenges_shared, 0);
  const totalQuizExports = rows.reduce((sum, row) => sum + row.quiz_exports, 0);
  const totalSummaryExports = rows.reduce((sum, row) => sum + row.summary_exports, 0);
  const totalLiveRecapExports = rows.reduce((sum, row) => sum + row.live_recap_exports, 0);
  const totalExcelExports = rows.reduce((sum, row) => sum + row.excel_exports, 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex flex-1 flex-col bg-gray-50">
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-14 pt-24 sm:px-6 lg:px-12 lg:pt-14">
          <header className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand-teal">Administration</span>
            <h1 className="text-3xl font-heading font-bold text-brand-dark">Utilisateurs</h1>
            <p className="text-sm text-brand-dark-lighter">
              Vue détaillée des comptes et de leurs usages (documents, quiz générés, fiches de révision).
            </p>
          </header>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Utilisateurs</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalUsers)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Documents importés</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalDocuments)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Quiz générés</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalQuizzes)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Fiches de révision</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalRevisions)}</div>
            </div>
          </section>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Défis partagés</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalChallengesShared)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Quiz exportés</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalQuizExports)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Fiches exportées</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalSummaryExports)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Recaps live exportés</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalLiveRecapExports)}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-brand-dark-lighter">Exports Excel</div>
              <div className="mt-2 text-2xl font-semibold text-brand-dark">{numberFormatter.format(totalExcelExports)}</div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-brand-dark">Liste des utilisateurs</h2>
              <p className="text-xs text-brand-dark-lighter">Triés par date d&apos;inscription (plus récents en premier).</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs uppercase text-brand-dark-lighter">
                    <th className="px-6 py-3">Utilisateur</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Identifiant</th>
                    <th className="px-6 py-3">Plan</th>
                    <th className="px-6 py-3 text-right">Flamme</th>
                    <th className="px-6 py-3 text-right">Documents</th>
                    <th className="px-6 py-3 text-right">Quiz</th>
                    <th className="px-6 py-3 text-right">Révisions</th>
                    <th className="px-6 py-3 text-right">Défis partagés</th>
                    <th className="px-6 py-3 text-right">Quiz exportés</th>
                    <th className="px-6 py-3 text-right">Fiches exportées</th>
                    <th className="px-6 py-3 text-right">Recaps live</th>
                    <th className="px-6 py-3 text-right">Excel</th>
                    <th className="px-6 py-3">Inscription</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => (
                    <tr key={row.user_id} className="transition-colors hover:bg-brand-teal-light/40">
                      <td className="px-6 py-3 font-medium text-brand-dark">
                        {row.display_name ?? '—'}
                      </td>
                      <td className="px-6 py-3 text-brand-dark-lighter">{row.email}</td>
                      <td className="px-6 py-3 text-xs text-brand-dark-lighter">{row.user_id}</td>
                      <td className="px-6 py-3 text-brand-dark-lighter">{row.plan ?? '—'}</td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
                          <span className="font-semibold text-brand-dark">{row.current_streak}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-brand-dark-lighter">
                          {row.last_active_date
                            ? `Actif le ${dateFormatter.format(new Date(row.last_active_date))}`
                            : 'Aucune activité'}
                          {row.longest_streak > 0 ? ` · Record ${row.longest_streak}` : ''}
                        </p>
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-brand-dark">{numberFormatter.format(row.documents_count)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-brand-dark">{numberFormatter.format(row.quizzes_generated)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-brand-dark">{numberFormatter.format(row.revisions_generated)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-brand-dark">{numberFormatter.format(row.challenges_shared)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-brand-dark">{numberFormatter.format(row.quiz_exports)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-brand-dark">{numberFormatter.format(row.summary_exports)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-brand-dark">{numberFormatter.format(row.live_recap_exports)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-brand-dark">{numberFormatter.format(row.excel_exports)}</td>
                      <td className="px-6 py-3 text-brand-dark-lighter">
                        {row.created_at ? dateFormatter.format(new Date(row.created_at)) : '—'}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td className="px-6 py-10 text-center text-sm text-brand-dark-lighter" colSpan={13}>
                        Aucun utilisateur enregistré pour le moment.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
