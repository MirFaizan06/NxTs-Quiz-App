import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { requireAdmin } from '@/lib/auth';
import { z } from 'zod';

const Question = z.object({ 
  question_text: z.string().min(1), 
  question_type: z.enum(['single', 'multiple', 'boolean']), 
  options: z.array(z.string()).min(2).max(6), 
  correct_answer: z.any(), 
  explanation: z.string().optional(), 
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'), 
  points: z.number().int().positive().default(100), 
  time_limit: z.number().int().min(5).max(300).default(20) 
});

const Payload = z.object({ 
  topic: z.string().min(1), 
  topic_id: z.string().uuid().nullable().optional(),
  count: z.number().int().min(1).max(20), 
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'), 
  focus: z.string().optional(),
  // Location scope inputs
  country: z.string().trim().optional(),
  state: z.string().trim().optional(),
  district: z.string().trim().optional()
});

export async function POST(req: Request) {
  try {
    await requireAdmin(); 
    if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured'); 
    
    const p = Payload.parse(await req.json()); 
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Build location scope string dynamically
    const locationParts = [p.district, p.state, p.country].filter(Boolean);
    const locationScope = locationParts.length > 0 
      ? `SPECIFIC REGIONAL SCOPE: ${locationParts.join(', ')}.` 
      : 'GLOBAL SCOPE: Use general international knowledge unless specified.';

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a rigorous quiz engine for academic and domain-specific subjects.

${locationScope}
When a regional scope is provided, questions for contextual topics (such as Geography, Economics, Education, Sociology, General Knowledge, and Law) MUST strictly reflect the geography, administration, economy, culture, and institutions of that specific region. Do NOT generalize to unintended countries or regions.

Output ONLY a valid JSON object matching this schema structure exactly. Do not include markdown code blocks or trailing text:
{
  "questions": [
    {
      "question_text": "The clear, self-contained question prompt string goes here.",
      "question_type": "single", 
      "options": ["Option A", "Option B", "Option C", "Option D"], 
      "correct_answer": "Option A",
      "explanation": "Concise technical reasoning.",
      "difficulty": "${p.difficulty}",
      "points": 100,
      "time_limit": 20
    }
  ]
}

Rules for fields:
1. "question_type" MUST be exactly one of: "single", "multiple", or "boolean".
2. For "single", "correct_answer" is a string matching exactly one item from options.
3. For "multiple", "correct_answer" is an array of strings containing all correct options.
4. For "boolean", "options" must be exactly ["True", "False"] and "correct_answer" must be either "True" or "False".`
        },
        {
          role: 'user',
          content: `Generate ${p.count} highly competitive, non-ambiguous questions about ${p.topic}.${
            locationParts.length > 0 ? ` Region: ${locationParts.join(', ')}.` : ''
          } Focus: ${p.focus || 'General concept mastery'}.`
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content || '{}'; 
    const parsed = JSON.parse(raw); 
    
    const questions = z.array(Question).parse(parsed.questions)
      .map(question => ({ ...question, topic_id: p.topic_id ?? null }));

    return NextResponse.json({ questions });
    
  } catch (e) { 
    return NextResponse.json(
      { error: e instanceof z.ZodError ? e.issues : (e instanceof Error ? e.message : 'Generation failed') }, 
      { status: 400 }
    ); 
  }
}