import { redirect } from 'next/navigation';
import AccessRestricted from '@/components/admin/AccessRestricted';
import AdminDashboardRealtime from '@/components/admin/AdminDashboardRealtime';
import { createSupabaseServerClient } from '@/lib/supabaseServerClient';

const DAYS_WINDOW = 30;

export default async function AdminDashboard() {
  const supabase = await createSupabaseServerClient();

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

  const initialData = {
    usageRows: usageRes.data ?? [],
    documentRows: documentsRes.data ?? [],
    userRows: usersRes.data ?? [],
    homepageRows: homepageRes.data ?? [],
  };

  return (
    <AdminDashboardRealtime
      since={since}
      daysWindow={DAYS_WINDOW}
      initialData={initialData}
    />
  );
}
