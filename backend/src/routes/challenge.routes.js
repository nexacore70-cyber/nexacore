import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth);
const clean = (v,max) => typeof v === "string" ? v.trim().slice(0,max) : "";
const handler = (res,e) => { console.error("Challenge API error:",e.message); return res.status(500).json({message:"Unable to complete challenge request."}); };
const canPublish = u => ["ADMIN","TUTOR"].includes(u.role);
const isModerator = u => u.role === "ADMIN";
const publicChallenge = {id:true,title:true,description:true,category:true,deadline:true,createdAt:true,creatorId:true,status:true};

router.get("/",async(req,res)=>{
 try{
  const challenges=await prisma.challenge.findMany({
   where:{OR:[{status:"PUBLISHED"},{creatorId:req.user.id}]},
   select:{...publicChallenge,_count:{select:{submissions:true}}},
   orderBy:{createdAt:"desc"},take:100
  });
  res.json({challenges});
 }catch(e){handler(res,e);}
});
router.post("/",async(req,res)=>{
 if(!canPublish(req.user))return res.status(403).json({message:"Only Tutors and Admins can create challenges."});
 const title=clean(req.body?.title,120),description=clean(req.body?.description,4000),category=clean(req.body?.category,50);
 const deadline=new Date(req.body?.deadline);
 if(title.length<5||description.length<20||!category||!Number.isFinite(deadline.getTime())||deadline<=new Date())
  return res.status(400).json({message:"Provide a title, description, category and future deadline."});
 try{
  const challenge=await prisma.challenge.create({data:{title,description,category,deadline,creatorId:req.user.id,status:"PUBLISHED"}});
  res.status(201).json({challenge});
 }catch(e){handler(res,e);}
});
router.get("/leaderboard/global",async(req,res)=>{
 try{
  const entries=await prisma.challengeSubmission.groupBy({
   by:["userId"],where:{status:"APPROVED"},_sum:{score:true},_count:{_all:true},
   orderBy:{_sum:{score:"desc"}},take:50
  });
  const users=await prisma.user.findMany({where:{id:{in:entries.map(e=>e.userId)}},select:{id:true,fullName:true}});
  const names=new Map(users.map(u=>[u.id,u.fullName]));
  res.json({leaderboard:entries.map(e=>({userId:e.userId,name:names.get(e.userId)||"Member",points:e._sum.score||0,completed:e._count._all}))});
 }catch(e){handler(res,e);}
});
router.get("/:id",async(req,res)=>{
 try{
  const challenge=await prisma.challenge.findUnique({where:{id:req.params.id},select:publicChallenge});
  if(!challenge || (challenge.status!=="PUBLISHED" && challenge.creatorId!==req.user.id))return res.status(404).json({message:"Challenge not found."});
  const submission=await prisma.challengeSubmission.findUnique({where:{challengeId_userId:{challengeId:challenge.id,userId:req.user.id}}});
  res.json({challenge,mySubmission:submission});
 }catch(e){handler(res,e);}
});
router.post("/:id/submit",async(req,res)=>{
 const summary=clean(req.body?.summary,3000),url=clean(req.body?.projectUrl,500);
 if(summary.length<20)return res.status(400).json({message:"Describe your work in at least 20 characters."});
 if(url){
  try{const parsed=new URL(url);if(!["https:","http:"].includes(parsed.protocol))throw Error("protocol");}
  catch{return res.status(400).json({message:"Provide a valid HTTP or HTTPS project link."});}
 }
 try{
  const challenge=await prisma.challenge.findUnique({where:{id:req.params.id}});
  if(!challenge||challenge.status!=="PUBLISHED")return res.status(404).json({message:"Challenge not available."});
  if(challenge.deadline<=new Date())return res.status(409).json({message:"Challenge deadline has passed."});
  if(challenge.creatorId===req.user.id)return res.status(403).json({message:"You cannot submit to your own challenge."});
  const existing=await prisma.challengeSubmission.findUnique({where:{challengeId_userId:{challengeId:challenge.id,userId:req.user.id}}});
  if(existing?.status==="APPROVED")return res.status(409).json({message:"Approved submissions cannot be edited."});
  const submission=await prisma.challengeSubmission.upsert({
   where:{challengeId_userId:{challengeId:challenge.id,userId:req.user.id}},
   create:{challengeId:challenge.id,userId:req.user.id,summary,projectUrl:url||null},
   update:{summary,projectUrl:url||null,status:"PENDING",score:null,feedback:null,reviewedAt:null}
  });
  res.status(existing?200:201).json({submission});
 }catch(e){handler(res,e);}
});
router.get("/:id/submissions",async(req,res)=>{
 try{
  const challenge=await prisma.challenge.findUnique({where:{id:req.params.id}});
  if(!challenge)return res.status(404).json({message:"Challenge not found."});
  if(challenge.creatorId!==req.user.id&&!isModerator(req.user))return res.status(403).json({message:"Not authorized to review submissions."});
  const submissions=await prisma.challengeSubmission.findMany({where:{challengeId:challenge.id},orderBy:{createdAt:"desc"},take:200,
   select:{id:true,userId:true,summary:true,projectUrl:true,status:true,score:true,feedback:true,createdAt:true,user:{select:{fullName:true}}}});
  res.json({submissions});
 }catch(e){handler(res,e);}
});
router.patch("/:id/submissions/:submissionId",async(req,res)=>{
 const status=req.body?.status,score=req.body?.score,feedback=clean(req.body?.feedback,1000);
 if(!["APPROVED","REJECTED"].includes(status)|| (status==="APPROVED" && (!Number.isInteger(score)||score<0||score>100)))
  return res.status(400).json({message:"Choose APPROVED with a score 0–100, or REJECTED."});
 try{
  const challenge=await prisma.challenge.findUnique({where:{id:req.params.id}});
  if(!challenge)return res.status(404).json({message:"Challenge not found."});
  if(challenge.creatorId!==req.user.id&&!isModerator(req.user))return res.status(403).json({message:"Not authorized."});
  const result=await prisma.challengeSubmission.updateMany({
   where:{id:req.params.submissionId,challengeId:challenge.id},
   data:{status,score:status==="APPROVED"?score:null,feedback,reviewedAt:new Date()}
  });
  if(!result.count)return res.status(404).json({message:"Submission not found."});
  res.json({updated:true});
 }catch(e){handler(res,e);}
});
export default router;
