import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function GET() {
  try {
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.rpc('list_public_lobbies');
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to load lobbies' }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await getUser();
    if (!user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
    if (!(await enforceRateLimit('join', user.id, 60, 8))) return NextResponse.json({ error: 'Too many join attempts. Please wait a minute.' }, { status: 429 });
    const { code } = await req.json();
    const admin = createSupabaseAdmin();
    const { data: quiz } = await admin.from('quizzes').select('id,status,is_public,max_players,allow_rejoin').eq('room_code', String(code || '').trim().toUpperCase()).single();
    if (!quiz) return NextResponse.json({ error: 'Lobby not found.' }, { status: 404 });
    const { count } = await admin.from('participants').select('id', { count: 'exact', head: true }).eq('quiz_id', quiz.id);
    if (quiz.max_players && (count ?? 0) >= quiz.max_players) return NextResponse.json({ error: 'This lobby is full.' }, { status: 409 });
    const { error } = await admin.from('participants').upsert({ quiz_id: quiz.id, user_id: user.id, last_seen_at: new Date().toISOString() }, { onConflict: 'quiz_id,user_id' });
    if (error) throw error;
    return NextResponse.json({ quizId: quiz.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to join lobby' }, { status: 400 });
  }
}
