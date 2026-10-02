import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){try{const {supabase}=await requireUser();const {id}=await params;const {answer}=await req.json();const {data,error}=await supabase.rpc('submit_answer',{p_quiz_id:id,p_answer:answer});if(error)throw error;return NextResponse.json(data);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unable to submit'},{status:400})}}
