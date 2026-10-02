import { createSupabaseAdmin } from './supabase-server';

export async function enforceRateLimit(bucket: string, subject: string, windowSeconds: number, max: number) {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc('rate_limit', {
    p_bucket: bucket,
    p_subject: subject,
    p_window_seconds: windowSeconds,
    p_max: max,
  });
  if (error) throw error;
  return data === true;
}
