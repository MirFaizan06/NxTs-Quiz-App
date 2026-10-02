import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    if (!(await enforceRateLimit('join', user!.id, 60, 8))) return NextResponse.json({ error: 'Too many join attempts. Please wait a minute.' }, { status: 429 });
    const admin = createSupabaseAdmin();
    const { data: quiz, error: quizError } = await admin.from('quizzes').select('id,status,max_players,allow_rejoin').eq('id', id).single();
    if (quizError || !quiz) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    const { count } = await admin.from('participants').select('id', { count: 'exact', head: true }).eq('quiz_id', id);
    const { data: existing } = await admin.from('participants').select('id').eq('quiz_id', id).eq('user_id', user!.id).maybeSingle();
    if (!existing && quiz.max_players && (count ?? 0) >= quiz.max_players) return NextResponse.json({ error: 'This quiz is full.' }, { status: 409 });
    const { data, error } = await admin.from('participants').upsert({ quiz_id: id, user_id: user!.id, last_seen_at: new Date().toISOString() }, { onConflict: 'quiz_id,user_id' }).select('id').single();
    if (error) throw error;
    return NextResponse.json({ participantId: data.id, quizId: id, rejoined: Boolean(existing) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to join quiz' }, { status: 400 });
  }
}
