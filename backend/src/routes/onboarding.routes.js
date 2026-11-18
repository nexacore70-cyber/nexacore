import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { CATALOGUE, CATALOGUE_CATEGORIES } from '../data/onboardingCatalogue.js';

const router = Router();
router.use(requireAuth);
const ROLES = ['STUDENT','TUTOR','TALENT','CLIENT','SERVICE_PROVIDER'];
const DESTINATIONS = {STUDENT:'/student/dashboard',TUTOR:'/tutor/assessment',TALENT:'/talent/dashboard',CLIENT:'/client/dashboard',SERVICE_PROVIDER:'/member/dashboard'};
const str = (value,max=500) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const unique = (value,max=30) => Array.isArray(value) ? [...new Set(value.filter(x=>typeof x==='string').map(x=>x.trim()).filter(Boolean))].slice(0,max) : [];
const allSkills = new Set(Object.values(CATALOGUE_CATEGORIES).flat());
const requiredSkills = new Set(['TUTOR','TALENT','SERVICE_PROVIDER']);
const interestChoices = {
 STUDENT:['Courses','Tutors','Study groups','Learning resources','Bootcamps','Internships','Scholarships','Events','Community'],
 TUTOR:['Teaching opportunities','Students seeking tutors','Teaching resources','Tutor community','Events','Industry updates'],
 TALENT:['Job opportunities','Client projects','Portfolio opportunities','Skills development','Networking','Industry updates'],
 CLIENT:['Talent profiles','Recommended professionals','Project proposals','Hiring resources','Industry updates'],
 SERVICE_PROVIDER:['Service requests','Potential clients','Business resources','Networking','Industry updates']
};
router.get('/catalogue',(_req,res)=>res.json({catalogue:CATALOGUE,categories:CATALOGUE_CATEGORIES,interests:interestChoices}));
router.get('/me',async(req,res)=>{
 try {
  const user=await prisma.user.findUnique({where:{id:req.user.id},select:{id:true,role:true,onboardingChoices:true,onboardingCompletedAt:true}});
  if(!user)return res.status(404).json({message:'Account not found'});
  res.json({user});
 }catch(error){console.error('[onboarding/me]',{code:error.code,message:error.message});res.status(500).json({message:'Could not load account setup. Check backend logs.'});}
});
router.post('/complete',async(req,res)=>{
 try {
  const user=await prisma.user.findUnique({where:{id:req.user.id},select:{id:true,role:true,onboardingCompletedAt:true}});
  if(!user)return res.status(401).json({message:'Sign in again'});
  if(user.role==='ADMIN')return res.status(403).json({message:'Administrator accounts cannot use public onboarding'});
  if(user.onboardingCompletedAt)return res.status(409).json({message:'Account setup is already complete. Please sign in again.'});
  const role=str(req.body?.role,30).toUpperCase();
  if(!ROLES.includes(role))return res.status(400).json({message:'Choose a valid account type'});
  if(user.role && user.role!==role)return res.status(403).json({message:'This account already has a different role'});
  const choices=unique(req.body?.choices,30);
  if(requiredSkills.has(role) && !choices.length)return res.status(400).json({message:'Select at least one relevant subject, skill or service'});
  if(choices.some(x=>!allSkills.has(x)))return res.status(400).json({message:'One or more selections are not in the NexaCore catalogue. Refresh the page.'});
  const subject=role==='TUTOR'?str(req.body?.teachingSubject,100):'';
  if(role==='TUTOR' && (!subject||!choices.includes(subject)))return res.status(400).json({message:'Choose a primary teaching subject from your selected subjects'});
  const interests=unique(req.body?.interests,12);
  if(interests.some(x=>!interestChoices[role].includes(x)))return res.status(400).json({message:'Invalid interests for this account type. Refresh the page.'});
  const p=req.body?.profile && typeof req.body.profile==='object' && !Array.isArray(req.body.profile)?req.body.profile:{};
  let profile={};
  if(role==='STUDENT')profile={learningGoal:str(p.learningGoal,500),level:str(p.level,40),location:str(p.location,120)};
  if(role==='TUTOR')profile={headline:str(p.headline,120),bio:str(p.bio,2000),experience:str(p.experience,100),qualification:str(p.qualification,200),teachingMode:str(p.teachingMode,80),portfolioUrl:str(p.portfolioUrl,500)};
  if(role==='TALENT')profile={headline:str(p.headline,120),bio:str(p.bio,2000),experience:str(p.experience,100),portfolioUrl:str(p.portfolioUrl,500),availability:str(p.availability,100)};
  if(role==='CLIENT')profile={companyName:str(p.companyName,120),projectType:str(p.projectType,120),preferredExperience:str(p.preferredExperience,80),bio:str(p.bio,1000)};
  if(role==='SERVICE_PROVIDER')profile={businessName:str(p.businessName,150),bio:str(p.bio,2000),experience:str(p.experience,100),serviceArea:str(p.serviceArea,120),portfolioUrl:str(p.portfolioUrl,500)};
  if(profile.portfolioUrl && !/^https:\/\//i.test(profile.portfolioUrl))return res.status(400).json({message:'Portfolio URL must start with https://'});
  const payload={selections:choices,primaryTeachingSubject:subject||null,interests,profile,version:3};
  // Never mark tutor onboarding complete without persisting the selected assessment subject.
  if(role==='TUTOR' && !prisma.tutorSubjectSelection)return res.status(503).json({code:'TUTOR_MODEL_MISSING',message:'Tutor subject model is unavailable. Run prisma generate and restart the backend.'});
  const saved=await prisma.$transaction(async tx=>{
   const updated=await tx.user.updateMany({where:{id:user.id,onboardingCompletedAt:null,role:user.role},data:{role,onboardingChoices:payload,onboardingCompletedAt:new Date()}});
   if(updated.count!==1)return false;
   if(role==='TUTOR')await tx.tutorSubjectSelection.upsert({where:{userId:user.id},create:{userId:user.id,subject},update:{subject}});
   return true;
  });
  if(!saved)return res.status(409).json({message:'Account setup was changed in another session. Refresh and try again.'});
  res.json({message:'Account setup complete',role,dashboard:DESTINATIONS[role]});
 }catch(error){
  console.error('[onboarding/complete]',{code:error.code,message:error.message,meta:error.meta});
  if(error.code==='P2021')return res.status(503).json({code:'DATABASE_TABLE_MISSING',message:'A required onboarding database table is missing. Ask the administrator to run the non-destructive database checks in the installation guide.'});
  if(error.code==='P2022')return res.status(503).json({code:'DATABASE_COLUMN_MISSING',message:'A required onboarding database column is missing. The database schema and Prisma Client are out of sync.'});
  if(error.code==='P2002')return res.status(409).json({code:'CONFLICT',message:'This account already has a conflicting setup record.'});
  return res.status(500).json({code:'ONBOARDING_SAVE_FAILED',message:'Could not save setup. Check the backend console for [onboarding/complete] and its Prisma error code.'});
 }
});
export default router;
