import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
const isManager = user => ["TUTOR", "ADMIN"].includes(user.role);
const bad = (res, message, status=400) => res.status(status).json({ message });
const kinds = ["BOOTCAMP", "INTERNSHIP"];
const validFee = n => Number.isSafeInteger(n) && n >= 100 && n <= 100000000;

router.get("/", async (req,res,next) => {
 try {
  const kind = req.query.kind;
  if (kind && !kinds.includes(kind)) return bad(res,"Invalid programme type.");
  const cohorts = await prisma.programmeCohort.findMany({where:{state:"OPEN",feeApprovalStatus:"APPROVED", ...(kind?{kind}:{})},select:{id:true,kind:true,title:true,description:true,startsAt:true,endsAt:true,capacity:true,approvedFeeKobo:true,tutor:{select:{fullName:true}},_count:{select:{applications:{where:{state:"ACCEPTED"}}}}},orderBy:{createdAt:"desc"},take:100});
  res.json({cohorts});
 } catch(e){next(e)}
});
router.use(requireAuth);
router.get("/mine", async (req,res,next) => {
 try {
  const [applications,managed] = await Promise.all([
   prisma.programmeApplication.findMany({where:{applicantId:req.user.id},include:{cohort:{select:{id:true,title:true,kind:true,state:true,startsAt:true}}},orderBy:{appliedAt:"desc"}}),
   isManager(req.user)?prisma.programmeCohort.findMany({where:req.user.role==="ADMIN"?{}:{tutorId:req.user.id},include:{_count:{select:{applications:true}}},orderBy:{createdAt:"desc"}}):Promise.resolve([])
  ]);
  res.json({applications,managed});
 }catch(e){next(e)}
});
router.post("/", async (req,res,next) => {
 try {
  if(!isManager(req.user)) return bad(res,"Tutor or admin access required.",403);
  const {kind,title,description,capacity,startsAt,endsAt,proposedFeeKobo}=req.body||{};
  if(req.user.role!=="TUTOR")return bad(res,"Only Tutors may propose programmes.",403);
  if(!validFee(proposedFeeKobo))return bad(res,"A valid proposed fee in kobo is required.");
  if(!kinds.includes(kind)||typeof title!=="string"||!title.trim()||title.length>140||typeof description!=="string"||description.length>5000) return bad(res,"Valid type, title and description are required.");
  if(capacity!=null&&(!Number.isInteger(capacity)||capacity<1||capacity>10000))return bad(res,"Invalid capacity.");
  const start=startsAt?new Date(startsAt):null,end=endsAt?new Date(endsAt):null;
  if((start&&!Number.isFinite(start.getTime()))||(end&&!Number.isFinite(end.getTime()))||(start&&end&&end<=start))return bad(res,"Invalid dates.");
  const cohort=await prisma.programmeCohort.create({data:{tutorId:req.user.id,kind,title:title.trim(),description:description.trim(),capacity:capacity??null,startsAt:start,endsAt:end,proposedFeeKobo,feeApprovalStatus:"PENDING"}});
  res.status(201).json({cohort});
 }catch(e){next(e)}
});
router.patch("/:id/state", async(req,res,next)=>{
 try{
  if(!isManager(req.user))return bad(res,"Not authorized.",403);
  const {state}=req.body||{};
  if(!["DRAFT","OPEN","CLOSED"].includes(state))return bad(res,"Invalid state.");
  const updated=await prisma.programmeCohort.updateMany({where:{id:req.params.id,...(req.user.role==="ADMIN"?{}:{tutorId:req.user.id}),...(state==="OPEN"?{feeApprovalStatus:"APPROVED",approvedFeeKobo:{not:null}}:{})},data:{state}});
  if(!updated.count)return bad(res,"Cohort not found or access denied.",404);
  res.json({state});
 }catch(e){next(e)}
});
router.patch("/:id/fee",async(req,res,next)=>{try{
 if(req.user.role!=="TUTOR")return bad(res,"Tutor access required.",403);
 const fee=req.body?.proposedFeeKobo;
 if(!validFee(fee))return bad(res,"Invalid fee in kobo.");
 const updated=await prisma.programmeCohort.updateMany({where:{id:req.params.id,tutorId:req.user.id,state:{not:"OPEN"}},data:{proposedFeeKobo:fee,approvedFeeKobo:null,feeApprovalStatus:"PENDING",feeApprovedAt:null,feeApprovedById:null,state:"DRAFT"}});
 if(!updated.count)return bad(res,"Programme not found or must be closed before fee revision.",409);
 res.json({feeApprovalStatus:"PENDING"});
}catch(e){next(e)}});
router.post("/:id/apply",async(req,res,next)=>{
 try{
  const motivation=req.body?.motivation;
  if(typeof motivation!=="string"||motivation.trim().length<10||motivation.length>3000)return bad(res,"Please provide a motivation (10–3000 characters).");
  const result=await prisma.$transaction(async tx=>{
   const cohort=await tx.programmeCohort.findUnique({where:{id:req.params.id}});
   if(!cohort||cohort.state!=="OPEN"||cohort.feeApprovalStatus!=="APPROVED")return {error:"Applications are closed.",code:404};
   if(cohort.tutorId===req.user.id)return {error:"You cannot apply to your own cohort.",code:403};
   const existing=await tx.programmeApplication.findUnique({where:{cohortId_applicantId:{cohortId:cohort.id,applicantId:req.user.id}}});
   if(existing)return {error:"You have already applied.",code:409};
   const application=await tx.programmeApplication.create({data:{cohortId:cohort.id,applicantId:req.user.id,motivation:motivation.trim()}});
   return {application};
  });
  if(result.error)return bad(res,result.error,result.code);
  res.status(201).json(result);
 }catch(e){if(e.code==="P2002")return bad(res,"You have already applied.",409);next(e)}
});
router.get("/:id/applications",async(req,res,next)=>{
 try{
  const cohort=await prisma.programmeCohort.findUnique({where:{id:req.params.id},select:{tutorId:true}});
  if(!cohort||(!isManager(req.user))||(req.user.role!=="ADMIN"&&cohort.tutorId!==req.user.id))return bad(res,"Access denied.",403);
  const applications=await prisma.programmeApplication.findMany({where:{cohortId:req.params.id},select:{id:true,motivation:true,state:true,appliedAt:true,applicant:{select:{id:true,fullName:true,email:true}}},orderBy:{appliedAt:"asc"}});
  res.json({applications});
 }catch(e){next(e)}
});
router.patch("/applications/:id",async(req,res,next)=>{
 try{
  const {state}=req.body||{};
  if(!["ACCEPTED","REJECTED"].includes(state))return bad(res,"Invalid decision.");
  const result=await prisma.$transaction(async tx=>{
   const application=await tx.programmeApplication.findUnique({where:{id:req.params.id},include:{cohort:true}});
   if(!application)return {error:"Application not found.",code:404};
   if(!isManager(req.user)||(req.user.role!=="ADMIN"&&application.cohort.tutorId!==req.user.id))return {error:"Access denied.",code:403};
   if(application.state!=="APPLIED")return {error:"Application already reviewed.",code:409};
   // Lock cohort to serialize capacity decisions across simultaneous requests.
   await tx.$queryRaw`SELECT id FROM "ProgrammeCohort" WHERE id = ${application.cohortId} FOR UPDATE`;
   if(state==="ACCEPTED"&&application.cohort.capacity!=null){
    const count=await tx.programmeApplication.count({where:{cohortId:application.cohortId,state:"ACCEPTED"}});
    if(count>=application.cohort.capacity)return {error:"Cohort is full.",code:409};
   }
   const updated=await tx.programmeApplication.update({where:{id:application.id},data:{state,reviewedAt:new Date()}});
   return {application:updated};
  });
  if(result.error)return bad(res,result.error,result.code);
  res.json(result);
 }catch(e){next(e)}
});
export default router;
