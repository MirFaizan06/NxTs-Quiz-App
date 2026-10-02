import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-server';
import { isQuizHost } from '@/lib/quiz-validation';

type RouteContext = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to update quiz';
  const status = message === 'Unauthorized' ? 401 : message === 'Admin access required' ? 403 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(req: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;
    const body = await req.json();

    if (body?.status !== 'finished') {
      return NextResponse.json({ error: 'Only ending a quiz is supported.' }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: quiz, error: lookupError } = await admin
      .from('quizzes')
      .select('id, host_id')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!quiz) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    if (!isQuizHost(quiz.host_id, user.id)) {
      return NextResponse.json({ error: 'Only the quiz host can end this quiz.' }, { status: 403 });
    }

    const { data: updatedQuiz, error } = await admin
      .from('quizzes')
      .update({ status: 'finished', ended_at: new Date().toISOString() })
      .eq('id', id)
      .eq('host_id', user.id)
      .select('id, status')
      .single();

    if (error) throw error;
    return NextResponse.json({ quiz: updatedQuiz });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_: Request, { params }: RouteContext) {
  try {
    const { user } = await requireAdmin();
    const { id } = await params;
    const admin = createSupabaseAdmin();
    const { data: quiz, error: lookupError } = await admin
      .from('quizzes')
      .select('id, host_id')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!quiz) return NextResponse.json({ error: 'Quiz not found.' }, { status: 404 });
    if (!isQuizHost(quiz.host_id, user.id)) {
      return NextResponse.json({ error: 'Only the quiz host can delete this quiz.' }, { status: 403 });
    }

    const { error } = await admin
      .from('quizzes')
      .delete()
      .eq('id', id)
      .eq('host_id', user.id);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}