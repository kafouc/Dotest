import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase avec la clé service role (contourne la RLS) : serveur uniquement.
 * Un client est créé par valeur de `clientInfo` ; l'absence de configuration n'est pas mémorisée,
 * donc une variable ajoutée ensuite est prise en compte sans redémarrer le processus.
 */
const clients = new Map<string, SupabaseClient>();

export function getSupabaseAdmin(clientInfo: string): SupabaseClient | null {
  if (typeof window !== 'undefined') return null;

  const cached = clients.get(clientInfo);
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.warn(`[${clientInfo}] Identifiants admin Supabase manquants (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).`);
    return null;
  }

  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': clientInfo } },
  });
  clients.set(clientInfo, client);
  return client;
}
