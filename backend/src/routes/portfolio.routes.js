import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
const str=(v,max)=>typeof v==="string"?v.trim().slice(0,max):"";
const error=(res,e)=>{console.error("Portfolio API:",e.message);return res.status(500).json({message:"Portfolio request failed."});};
const publicUser={id:true,fullName:true,role:true};
const profileSelect={headline:true,bio:true,skills:true,availableForHire:true,updatedAt:true};
const projectSelect={id:true,title:true,description:true,projectUrl:true,challengeSubmissionId:true,createdAt:true};
const urlValid=(value)=>{if(!value)return true;try{return ["https:","http:"].includes(new URL(value).protocol)}catch{return false}};

router.get("/discover",async(req,res)=>{
 try{
  const profiles=await prisma.portfolioProfile.findMany({
   where:{availableForHire:true,user:{status:"ACTIVE",emailVerifiedAt:{not:null},role:{in:["TALENT","TUTOR"]}}},
   select:{userId:true,...profileSelect,user:{select:publicUser}},
   orderBy:{updatedAt:"desc"},take:50
  });
  res.json({profiles});
 }catch(e){error(res,e);}
});
router.get("/user/:userId",async(req,res)=>{
 try{
  const user=await prisma.user.findFirst({where:{id:req.params.userId,status:"ACTIVE",emailVerifiedAt:{not:null}},select:publicUser});
  if(!user)return res.status(404).json({message:"Portfolio not found."});
  const [profile,projects,achievements]=await Promise.all([
   prisma.portfolioProfile.findUnique({where:{userId:user.id},select:profileSelect}),
   prisma.portfolioProject.findMany({where:{userId:user.id},select:projectSelect,orderBy:{createdAt:"desc"},take:50}),
   prisma.challengeSubmission.findMany({where:{userId:user.id,status:"APPROVED",challenge:{status:"PUBLISHED"}},select:{id:true,score:true,reviewedAt:true,challenge:{select:{id:true,title:true,category:true}}},orderBy:{reviewedAt:"desc"},take:50})
  ]);
  if(!profile || !profile.availableForHire || !["TALENT","TUTOR"].includes(user.role))return res.status(404).json({message:"Portfolio not publicly available."});
  res.json({user,profile,projects,achievements});
 }catch(e){error(res,e);}
});
router.use(requireAuth);
router.get("/me",async(req,res)=>{
 try{
  const [profile,projects,achievements]=await Promise.all([
   prisma.portfolioProfile.findUnique({where:{userId:req.user.id},select:profileSelect}),
   prisma.portfolioProject.findMany({where:{userId:req.user.id},select:projectSelect,orderBy:{createdAt:"desc"},take:50}),
   prisma.challengeSubmission.findMany({where:{userId:req.user.id,status:"APPROVED"},select:{id:true,score:true,challenge:{select:{id:true,title:true,category:true}}},orderBy:{reviewedAt:"desc"},take:50})
  ]);
  res.json({user:{id:req.user.id,fullName:req.user.fullName,role:req.user.role},profile,projects,achievements});
 }catch(e){error(res,e);}
});
router.put("/me",async(req,res)=>{
 const headline=str(req.body?.headline,120),bio=str(req.body?.bio,2000);
 const skills=Array.isArray(req.body?.skills)?[...new Set(req.body.skills.filter(v=>typeof v==="string").map(v=>v.trim().slice(0,40)).filter(Boolean))].slice(0,20):[];
 const availableForHire=req.body?.availableForHire===true;
 if(availableForHire&&!["TALENT","TUTOR"].includes(req.user.role))return res.status(403).json({message:"Only approved Talent and Tutor accounts may advertise services."});
 try{
  const profile=await prisma.portfolioProfile.upsert({where:{userId:req.user.id},
   create:{userId:req.user.id,headline,bio,skills,availableForHire},
   update:{headline,bio,skills,availableForHire},select:profileSelect});
  res.json({profile});
 }catch(e){error(res,e);}
});
router.post("/me/projects",async(req,res)=>{
 const title=str(req.body?.title,120),description=str(req.body?.description,2000),projectUrl=str(req.body?.projectUrl,500);
 if(title.length<3||description.length<20||!urlValid(projectUrl))return res.status(400).json({message:"Provide a title, description (20+ characters), and valid project link."});
 try{
  const project=await prisma.portfolioProject.create({data:{userId:req.user.id,title,description,projectUrl:projectUrl||null},select:projectSelect});
  res.status(201).json({project});
 }catch(e){error(res,e);}
});
router.post("/me/achievements/:submissionId",async(req,res)=>{
 try{
  const sub=await prisma.challengeSubmission.findFirst({where:{id:req.params.submissionId,userId:req.user.id,status:"APPROVED"},include:{challenge:{select:{title:true,description:true}}}});
  if(!sub)return res.status(404).json({message:"Approved achievement not found."});
  const project=await prisma.portfolioProject.upsert({
   where:{challengeSubmissionId:sub.id},
   create:{userId:req.user.id,challengeSubmissionId:sub.id,title:sub.challenge.title,description:sub.summary,projectUrl:sub.projectUrl},
   update:{title:sub.challenge.title,description:sub.summary,projectUrl:sub.projectUrl},
   select:projectSelect
  });
  res.json({project});
 }catch(e){error(res,e);}
});
router.delete("/me/projects/:id",async(req,res)=>{
 try{
  const result=await prisma.portfolioProject.deleteMany({where:{id:req.params.id,userId:req.user.id}});
  if(!result.count)return res.status(404).json({message:"Project not found."});
  res.json({deleted:true});
 }catch(e){error(res,e);}
});
export default router;
