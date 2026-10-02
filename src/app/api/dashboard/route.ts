import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export async function GET() {
  try {
    const { supabase } = await requireUser();
    const { data, error } = await supabase.rpc('get_student_dashboard');
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to load dashboard' }, { status: 400 });
  }
}
