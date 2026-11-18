import { prepareTutorQuestions } from '../services/tutor-ai-preparation.js';
import { prisma } from '../db.js';
import { randomInt } from 'node:crypto';
const KNOWLEDGE_MS = 30 * 60 * 1000;
const AUDIO_MS = 10 * 60 * 1000;
const clean = s => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
const shuffle = xs => { const a=[...xs]; for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;};
function similarity(a,b) {
  a=clean(a); b=clean(b);
  if(!a && !b)return 100;
  const prev=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){
    const curr=[i];
    for(let j=1;j<=b.length;j++)curr[j]=Math.min(curr[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
    prev.splice(0,prev.length,...curr);
  }
  return Math.max(0,100*(1-prev[b.length]/Math.max(a.length,b.length,1)));
}
const own = async(req,id)=>prisma.tutorAssessment.findFirst({where:{id,userId:req.user.id},include:{questions:true,audioAnswers:true}});
const fail = (res, error) => {
  console.error("\n========== TUTOR ASSESSMENT ERROR ==========");
  console.error("Name:", error?.name);
  console.error("Code:", error?.code);
  console.error("Message:", error?.message);
  console.error("Stack:", error?.stack);
  console.error("============================================\n");

  return res.status(500).json({
    message: "Unable to complete the assessment operation.",
    code: error?.code || "TUTOR_ASSESSMENT_ERROR",
  });
};
// Only the explicitly confirmed course stored against this account can be assessed.
export async function getTeachingSubject(req,res){
 try{
  if(req.user.role!=='TUTOR')return res.status(403).json({message:'Tutor account required.'});
  const saved=await prisma.tutorSubjectSelection.findUnique({where:{userId:req.user.id}});
  const banks=await prisma.tutorQuestion.findMany({where:{approved:true},select:{subject:true},distinct:['subject']});
  const audio=await prisma.tutorAudioTask.findMany({where:{approved:true},select:{subject:true},distinct:['subject']});
  const availableSubjects=[...new Set([...banks,...audio].map(x=>x.subject).filter(Boolean))].sort();
  return res.json({subject:saved?.subject||'',availableSubjects});
 }catch(e){return fail(res,e)}
}
export async function saveTeachingSubject(req,res){
 try{
  if(req.user.role!=='TUTOR')return res.status(403).json({message:'Tutor account required.'});
  const subject=String(req.body?.subject||'').trim();
  if(!subject||subject.length>100)return res.status(400).json({message:'Choose a teaching course.'});
  const existing=await prisma.tutorSubjectSelection.findUnique({where:{userId:req.user.id}});
  if(existing&&existing.subject!==subject)return res.status(409).json({message:'Your confirmed teaching course cannot be changed here. Contact support to request a change.'});
  // A subject must be defined in the assessment catalogue; no invented course names.
  const known=await prisma.tutorQuestion.findFirst({where:{subject},select:{id:true}});
  if(!known)return res.status(400).json({message:'This teaching course is not available in the assessment catalogue. Contact support.'});
  const saved=await prisma.tutorSubjectSelection.upsert({where:{userId:req.user.id},create:{userId:req.user.id,subject},update:{}});
  return res.json({subject:saved.subject});
 }catch(e){return fail(res,e)}
}
export async function startAssessment(req,res){
 try{
  if(req.user.role!=='TUTOR')return res.status(403).json({message:'Tutor account required.'});
  const selection=await prisma.tutorSubjectSelection.findUnique({where:{userId:req.user.id}});
  if(!selection?.subject)return res.status(409).json({message:'No teaching course has been confirmed for this account. Choose and save a course first.'});
  const subject=selection.subject;
  if(req.body?.subject&&String(req.body.subject).trim()!==subject)return res.status(403).json({message:'Assessment subject must match your registered teaching course.'});
  const existing=await prisma.tutorAssessment.findFirst({where:{userId:req.user.id,status:{in:['KNOWLEDGE','AUDIO']}},orderBy:{createdAt:'desc'}});
  if(existing)return res.status(409).json({message:'Finish your existing assessment first.',assessmentId:existing.id});
  const [questions,audio]=await Promise.all([prisma.tutorQuestion.findMany({where:{subject,approved:true}}),prisma.tutorAudioTask.findMany({where:{subject,approved:true}})]);
  if(questions.length<60||audio.length<4){ if(questions.length<60) await prepareTutorQuestions(subject); return res.status(409).json({message:'AI has prepared draft questions where needed. They require factual review and approval, and four reviewed audio recordings are required before the assessment can start.'}); }
  const chosen=shuffle(questions).slice(0,60), selectedAudio=shuffle(audio).slice(0,4);
  const assessment=await prisma.tutorAssessment.create({data:{userId:req.user.id,subject,questions:{create:chosen.map(q=>({questionId:q.id,prompt:q.prompt,choices:q.choices,correctIndex:q.correctIndex}))},audioAnswers:{create:selectedAudio.map(t=>({taskId:t.id,audioUrl:t.audioUrl,transcript:t.transcript}))}}});
  return res.status(201).json({assessmentId:assessment.id,deadline:new Date(assessment.knowledgeStartedAt.getTime()+KNOWLEDGE_MS).toISOString()});
 }catch(e){return fail(res,e)}
}
export async function getAssessment(req,res){
 try{
  const a=await own(req,req.params.id);if(!a)return res.status(404).json({message:'Not found'});
  if(req.user.role!=='TUTOR')return res.status(403).json({message:'Tutor account required.'});
  if(a.status==='KNOWLEDGE')return res.json({id:a.id,subject:a.subject,status:a.status,deadline:new Date(a.knowledgeStartedAt.getTime()+KNOWLEDGE_MS),questions:a.questions.map(q=>({id:q.id,prompt:q.prompt,choices:q.choices}))});
  if(a.status==='AUDIO')return res.json({id:a.id,subject:a.subject,status:a.status,deadline:new Date(a.audioStartedAt.getTime()+AUDIO_MS),tasks:a.audioAnswers.map(t=>({id:t.id,audioUrl:t.audioUrl}))});
  return res.json({id:a.id,status:a.status,knowledgeScore:a.knowledgeScore,audioScore:a.audioScore,finalScore:a.finalScore,passed:a.passed});
 }catch(e){return fail(res,e)}
}
export async function submitKnowledge(req,res){
 try{
  const a=await own(req,req.params.id);if(!a)return res.status(404).json({message:'Not found'});
  if(a.status!=='KNOWLEDGE')return res.status(409).json({message:'Knowledge exam already submitted.'});
  if(a.questions.length!==60)return res.status(409).json({message:'Assessment question set is incomplete.'});
  const answers=req.body?.answers||{};
  const expired=Date.now()>new Date(a.knowledgeStartedAt).getTime()+KNOWLEDGE_MS;
  if(expired && Date.now()>new Date(a.knowledgeStartedAt).getTime()+KNOWLEDGE_MS+15000) return res.status(409).json({message:'Knowledge timer expired. Contact support to resolve this attempt.'});
  const score=a.questions.reduce((n,q)=>n+(Number.isInteger(answers[q.id])&&answers[q.id]===q.correctIndex?1:0),0)/60*100;
  const now=new Date();
  await prisma.$transaction(async tx=>{
   for(const q of a.questions)await tx.tutorAssessmentQuestion.update({where:{id:q.id},data:{answerIndex:Number.isInteger(answers[q.id])?answers[q.id]:null}});
   await tx.tutorAssessment.update({where:{id:a.id},data:{knowledgeScore:score,status:'AUDIO',audioStartedAt:now}});
  });
  return res.json({knowledgeScore:score,audioDeadline:new Date(now.getTime()+AUDIO_MS)});
 }catch(e){return fail(res,e)}
}
export async function submitAudio(req,res){
 try{
  const a=await own(req,req.params.id);if(!a)return res.status(404).json({message:'Not found'});
  if(a.status!=='AUDIO')return res.status(409).json({message:'Audio exam already submitted.'});
  if(a.audioAnswers.length!==4)return res.status(409).json({message:'Audio task set is incomplete.'});
  const answers=req.body?.answers||{};
  if(Date.now()>new Date(a.audioStartedAt).getTime()+AUDIO_MS+15000) return res.status(409).json({message:'Audio timer expired. Contact support to resolve this attempt.'});
  const scored=a.audioAnswers.map(t=>({id:t.id,answer:String(answers[t.id]||'').slice(0,10000),score:similarity(answers[t.id],t.transcript)}));
  const audioScore=scored.reduce((n,x)=>n+x.score,0)/4;
  const finalScore=(a.knowledgeScore||0)*0.7+audioScore*0.3;
  const passed=(a.knowledgeScore||0)>=60&&audioScore>=60&&finalScore>=60;
  await prisma.$transaction(async tx=>{
   for(const s of scored)await tx.tutorAssessmentAudio.update({where:{id:s.id},data:{answer:s.answer,score:s.score}});
   await tx.tutorAssessment.update({where:{id:a.id},data:{audioScore,finalScore,passed,status:'REVIEW'}});
  });
  return res.json({knowledgeScore:a.knowledgeScore,audioScore,finalScore,passed,status:'REVIEW',message:'Submitted for administrator review; passing does not automatically approve a Tutor.'});
 }catch(e){return fail(res,e)}
}
export async function logIncident(req,res){
 try{
  const a=await own(req,req.params.id);if(!a)return res.status(404).json({message:'Not found'});
  const allowed=['TAB_HIDDEN','WINDOW_BLUR','FULLSCREEN_EXIT','COPY_ATTEMPT','PASTE_ATTEMPT'];
  if(!allowed.includes(req.body?.kind))return res.status(400).json({message:'Invalid incident'});
  await prisma.tutorAssessmentIncident.create({data:{assessmentId:a.id,kind:req.body.kind}});
  return res.status(204).end();
 }catch(e){return fail(res,e)}
}
