import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-server';
export async function POST(_:Request,{params}:{params:Promise<{id:string}>}){try{const {user}=await requireUser();const {id}=await params;const admin=createSupabaseAdmin();const {data:quiz}=await admin.from('quizzes').select('id,status').eq('id',id).single();if(!quiz)return NextResponse.json({error:'Quiz not found'},{status:404});const {error}=await admin.from('participants').upsert({quiz_id:id,user_id:user!.id},{onConflict:'quiz_id,user_id'});if(error)throw error;return NextResponse.json({quizId:id});}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to join'},{status:400})}}
