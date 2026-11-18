import { prisma } from '../db.js';
const unique = items => [...new Set(items)];
async function chat(messages) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY is not configured on the backend.');
  const r = await fetch('https://api.openai.com/v1/chat/completions', { method:'POST', headers:{ Authorization:`Bearer ${key}`, 'Content-Type':'application/json' }, body:JSON.stringify({model:process.env.TUTOR_AI_MODEL || 'gpt-4o-mini',response_format:{type:'json_object'},temperature:0.8,messages}) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'AI question generation failed');
  return JSON.parse(data.choices[0].message.content);
}
export async function prepareTutorQuestions(subject) {
  const existing = await prisma.tutorQuestion.findMany({where:{subject,approved:true}});
  if (existing.length >= 60) return;
  const seen = new Set(existing.map(q=>q.prompt.trim().toLowerCase()));
  for (let batch=0; batch<6 && seen.size<65; batch++) {
    const result = await chat([{role:'system',content:'You are an expert examiner. Return JSON object {questions:[{prompt:string,choices:[string,string,string,string],correctIndex:integer}]}. Make 15 challenging, scenario-based, unambiguous, technically accurate multiple-choice questions. Exactly one correct answer per question. Avoid trick wording, duplicate concepts and superficial distractors. Never include markdown.'},{role:'user',content:`Subject: ${subject}. Batch ${batch+1}. Generate 15 varied questions at intermediate and advanced difficulty. Previously used prompts: ${JSON.stringify([...seen].slice(-70))}`}]);
    for (const q of result.questions || []) {
      if (typeof q.prompt!=='string'||q.prompt.length<25||!Array.isArray(q.choices)||q.choices.length!==4||!q.choices.every(x=>typeof x==='string'&&x.length>1)||new Set(q.choices.map(x=>x.toLowerCase())).size!==4||!Number.isInteger(q.correctIndex)||q.correctIndex<0||q.correctIndex>3) continue;
      const fingerprint=q.prompt.trim().toLowerCase();if(seen.has(fingerprint))continue;
      await prisma.tutorQuestion.create({data:{subject,prompt:q.prompt,choices:q.choices,correctIndex:q.correctIndex,approved:false}});
      seen.add(fingerprint);
    }
  }
  return {draftCount:seen.size};
}
