import type { Database } from '@/types/database';

/**
 * Types des tables dérivés du schéma réel (types/database.ts, généré depuis Supabase).
 * Servent à vérifier à la compilation que le code n'utilise que des colonnes qui existent :
 *   type ClassRow = Pick<Tables<'classes'>, 'id' | 'name'>   // erreur de compilation si la colonne est renommée en base
 */
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
export type RpcReturns<F extends keyof Database['public']['Functions']> = Database['public']['Functions'][F]['Returns'];
