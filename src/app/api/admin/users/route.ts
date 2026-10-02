import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-server';

export async function GET() {
  try {
    await requireAdmin();
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.from('profiles').select('id,name,username,role,created_at').order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to load users' }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { user: actor } = await requireAdmin();
    const body = await req.json();
    if (!body.userId || !['student', 'admin'].includes(body.role)) throw new Error('User and role are required');
    if (body.userId === actor!.id && body.role !== 'admin') throw new Error('You cannot remove your own admin access.');
    const admin = createSupabaseAdmin();
    const { data, error } = await admin.from('profiles').update({ role: body.role }).eq('id', body.userId).select('id,name,username,role').single();
    if (error) throw error;
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Unable to update role' }, { status: 400 });
  }
}
