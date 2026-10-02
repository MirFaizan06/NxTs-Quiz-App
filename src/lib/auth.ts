import { createSupabaseServer } from './supabase-server';

export async function getUser() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function requireUser() {
  const result = await getUser();
  if (!result.user) throw new Error('Unauthorized');
  return { supabase: result.supabase, user: result.user };
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || profile.role !== 'admin') throw new Error('Admin access required');
  return { supabase, user, profile };
}
