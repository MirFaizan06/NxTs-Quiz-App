import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { createSupabaseAdmin } from '@/lib/supabase-server';

function parseCsv(input: string) {
  const rows: string[][] = []; let row: string[] = []; let cell=''; let quoted=false;
  for(let i=0;i<input.length;i++){const c=input[i]; if(quoted){if(c==='"'&&input[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell='';}else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell='';}else if(c==='\r'){}else cell+=c;}
  row.push(cell); if(row.length>1||row[0])rows.push(row); return rows;
}
function csvCell(v: unknown){const s=typeof v==='string'?v:JSON.stringify(v??''); return `"${s.replaceAll('"','""')}"`;}

export async function GET(){
  try{await requireAdmin(); const admin=createSupabaseAdmin(); const {data,error}=await admin.from('questions').select('question_text,question_type,options,correct_answer,explanation,difficulty,points,time_limit,topic_id,topics(name)').order('created_at',{ascending:false}); if(error)throw error;
    const header=['question_text','question_type','options','correct_answer','explanation','difficulty','points','time_limit','topic_name'];
    const lines=[header.join(','),...(data??[]).map((q:any)=>[q.question_text,q.question_type,(q.options??[]).join(' | '),typeof q.correct_answer==='string'?q.correct_answer:JSON.stringify(q.correct_answer),q.explanation??'',q.difficulty,q.points,q.time_limit,q.topics?.name??''].map(csvCell).join(','))];
    return new NextResponse(lines.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="nxt-quiz-question-bank.csv"'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Export failed'},{status:400});}
}

export async function POST(req:Request){
  try{await requireAdmin(); const form=await req.formData(); const file=form.get('file'); if(!(file instanceof File))throw new Error('CSV file is required'); const rows=parseCsv(await file.text()); if(rows.length<2)throw new Error('CSV contains no questions.');
    const header=rows[0].map(x=>x.trim().toLowerCase()); const idx=(name:string)=>header.indexOf(name); const required=['question_text','question_type','options','correct_answer']; for(const h of required)if(idx(h)<0)throw new Error(`Missing column: ${h}`);
    const admin=createSupabaseAdmin(); const topicCache=new Map<string,string>(); const inserted=[];
    for(const r of rows.slice(1)){if(!r.some(Boolean))continue; const options=r[idx('options')].split('|').map(x=>x.trim()).filter(Boolean); if(options.length<2)throw new Error(`Invalid options for row ${rows.indexOf(r)+1}`); const type=(r[idx('question_type')]||'single') as 'single'|'multiple'|'boolean'; let correct:any=r[idx('correct_answer')]; if(type==='multiple')correct=correct.split('|').map((x:string)=>x.trim()).filter(Boolean); if(type==='boolean')correct=correct==='true'||correct==='True'?'True':'False'; let topic_id=null; const topicName=idx('topic_name')>=0?r[idx('topic_name')].trim():''; if(topicName){if(topicCache.has(topicName))topic_id=topicCache.get(topicName)!;else{let {data:t}=await admin.from('topics').select('id').ilike('name',topicName).maybeSingle(); if(!t){const created=await admin.from('topics').insert({name:topicName}).select('id').single(); t=created.data;} if(t){topic_id=t.id;topicCache.set(topicName,t.id);}}}
      const payload={question_text:r[idx('question_text')].trim(),question_type:type,options,correct_answer:correct,explanation:idx('explanation')>=0?r[idx('explanation')].trim()||null:null,difficulty:idx('difficulty')>=0&&r[idx('difficulty')].trim()?r[idx('difficulty')].trim():'medium',points:idx('points')>=0&&r[idx('points')]?Number(r[idx('points')]):100,time_limit:idx('time_limit')>=0&&r[idx('time_limit')]?Number(r[idx('time_limit')]):20,topic_id};
      if(!payload.question_text||!['single','multiple','boolean'].includes(payload.question_type)||!Number.isFinite(payload.points)||!Number.isFinite(payload.time_limit))throw new Error(`Invalid question data on row ${rows.indexOf(r)+1}`); const {data,error}=await admin.from('questions').insert(payload).select('id').single(); if(error)throw error; inserted.push(data.id);
    }
    return NextResponse.json({imported:inserted.length});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Import failed'},{status:400});}
}
