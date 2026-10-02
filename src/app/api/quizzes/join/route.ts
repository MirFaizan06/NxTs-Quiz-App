import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { isValidRoomCode, normalizeRoomCode } from '@/lib/quiz-validation';
import { enforceRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
  try {
    const { user } = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Please log in or sign up before joining a quiz.' },
        { status: 401 }
      );
    }

    if (!(await enforceRateLimit('join', user.id, 60, 8))) {
      return NextResponse.json({ error: 'Too many join attempts. Please wait a minute.' }, { status: 429 });
    }

    const body = await req.json();
    const rawCode = body?.code ?? body?.room_code ?? '';
    const normalizedCode = normalizeRoomCode(rawCode);

    if (!isValidRoomCode(normalizedCode)) {
      return NextResponse.json({ error: 'Enter a valid 6-character room code.' }, { status: 400 });
    }

    const admin = createSupabaseAdmin();

    const { data: quiz, error: quizErr } = await admin
      .from('quizzes')
      .select('id, title, status, room_code, max_players')
      .eq('room_code', normalizedCode)
      .maybeSingle();

    if (quizErr) {
      return NextResponse.json({ error: 'Unable to look up the room.' }, { status: 500 });
    }

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found. Please check the code.' }, { status: 404 });
    }

    const { count } = await admin.from('participants').select('id', { count: 'exact', head: true }).eq('quiz_id', quiz.id);
    const { data: existing } = await admin.from('participants').select('id').eq('quiz_id', quiz.id).eq('user_id', user.id).maybeSingle();
    if (!existing && quiz.max_players && (count ?? 0) >= quiz.max_players) {
      return NextResponse.json({ error: 'This quiz is full.' }, { status: 409 });
    }

    const { data: participant, error: partErr } = await admin
      .from('participants')
      .upsert(
        {
          quiz_id: quiz.id,
          user_id: user.id,
        },
        { onConflict: 'quiz_id,user_id' }
      )
      .select('id')
      .single();

    if (partErr) {
      return NextResponse.json({ error: partErr.message }, { status: 400 });
    }

    return NextResponse.json({ quizId: quiz.id, participantId: participant.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to join quiz' },
      { status: 500 }
    );
  }
}