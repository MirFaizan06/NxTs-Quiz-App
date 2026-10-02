import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { supabase } = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { data, error } = await supabase.rpc('record_quiz_event', {
      p_quiz_id: id,
      p_event_type: body.eventType || 'heartbeat',
      p_metadata: body.metadata || {},
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to record event' }, { status: 400 });
  }
}
