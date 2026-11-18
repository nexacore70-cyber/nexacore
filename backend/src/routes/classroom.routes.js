import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.middleware.js";
const router = Router();
router.use(requireAuth);
const error = (res, status, message) => res.status(status).json({ message });
async function access(cohortId, userId) {
  const cohort = await prisma.programmeCohort.findUnique({where:{id:cohortId},select:{id:true,title:true,tutorId:true,state:true,applications:{where:{state:"ACCEPTED"},select:{applicantId:true}}}});
  if (!cohort || (cohort.tutorId !== userId && !cohort.applications.some(a=>a.applicantId===userId))) return null;
  return cohort;
}
router.get("/:id/participants", async(req,res,next)=>{try{
  const cohort=await access(req.params.id,req.user.id);
  if(!cohort)return error(res,403,"You are not enrolled in this classroom.");
  const ids=[cohort.tutorId,...cohort.applications.map(a=>a.applicantId)];
  const users=await prisma.user.findMany({where:{id:{in:ids}},select:{id:true,fullName:true}});
  res.json({cohort:{id:cohort.id,title:cohort.title,tutorId:cohort.tutorId},participants:users});
}catch(e){next(e)}});
router.post("/:id/signals",async(req,res,next)=>{try{
  const cohort=await access(req.params.id,req.user.id);
  if(!cohort)return error(res,403,"Not enrolled.");
  const {recipientId,kind,payload}=req.body||{};
  if(typeof recipientId!=="string"||recipientId===req.user.id||!([cohort.tutorId,...cohort.applications.map(a=>a.applicantId)].includes(recipientId)))return error(res,400,"Invalid recipient.");
  if(!["offer","answer","ice","hangup"].includes(kind)||!payload||typeof payload!=="object"||Array.isArray(payload)||JSON.stringify(payload).length>12000)return error(res,400,"Invalid signal.");
  const signal=await prisma.classroomSignal.create({data:{cohortId:cohort.id,senderId:req.user.id,recipientId,kind,payload}});
  res.status(201).json({id:signal.id});
}catch(e){next(e)}});
router.get("/:id/signals",async(req,res,next)=>{try{
  const cohort=await access(req.params.id,req.user.id);
  if(!cohort)return error(res,403,"Not enrolled.");
  const after=typeof req.query.after==="string"?req.query.after:"";
  const since=after&&Number.isFinite(Date.parse(after))?new Date(after):new Date(Date.now()-120000);
  const signals=await prisma.classroomSignal.findMany({where:{cohortId:cohort.id,recipientId:req.user.id,createdAt:{gte:since}},orderBy:[{createdAt:"asc"},{id:"asc"}],take:100});
  res.json({signals,serverTime:new Date().toISOString()});
}catch(e){next(e)}});
export default router;
