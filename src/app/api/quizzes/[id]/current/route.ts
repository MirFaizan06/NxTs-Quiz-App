import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-server';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireUser();
    const { id } = await params;
    const admin = createSupabaseAdmin();

    const { data: member } = await admin
      .from('participants')
      .select('id')
      .eq('quiz_id', id)
      .eq('user_id', user!.id)
      .maybeSingle();

    // FIXED: Included room_code in the selected columns
    const { data: quiz } = await admin
      .from('quizzes')
      .select('id, title, room_code, status, current_question, question_started_at, host_id')
      .eq('id', id)
      .single();

    if (!quiz) {
      return NextResponse.json({ error: 'The quiz was ended.' }, { status: 404 });
    }

    if (!member && quiz.host_id !== user!.id) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    const { data: qq } = await admin
      .from('quiz_questions')
      .select('question_id, position')
      .eq('quiz_id', id)
      .eq('position', quiz.current_question)
      .maybeSingle();

    if (!qq) {
      return NextResponse.json({ quiz, question: null });
    }

    const { data: q } = await admin
      .from('questions')
      .select('id, question_text, question_type, options, points, time_limit')
      .eq('id', qq.question_id)
      .single();

    return NextResponse.json({
      quiz,
      question: q ? { ...q, position: qq.position } : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unable to load' },
      { status: 400 }
    );
  }
}