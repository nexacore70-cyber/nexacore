import { Router } from "express";
import { prisma } from "../db.js";
import { requireAdminSession } from "../middleware/admin-session.middleware.js";
const router=Router();
router.use(requireAdminSession);
router.get("/pending",async(req,res,next)=>{try{const programmes=await prisma.programmeCohort.findMany({where:{feeApprovalStatus:"PENDING"},include:{tutor:{select:{id:true,fullName:true,email:true}}},orderBy:{createdAt:"desc"},take:100});res.json({programmes});}catch(e){next(e)}});
router.patch("/:id/fee",async(req,res,next)=>{try{
 const {decision}=req.body||{};
 if(!["APPROVED","REJECTED"].includes(decision))return res.status(400).json({message:"Invalid decision."});
 const result=await prisma.$transaction(async tx=>{
  const p=await tx.programmeCohort.findUnique({where:{id:req.params.id}});
  if(!p)return {status:404,message:"Programme not found."};
  if(p.feeApprovalStatus!=="PENDING")return {status:409,message:"Fee already reviewed."};
  if(!Number.isSafeInteger(p.proposedFeeKobo)||p.proposedFeeKobo<100)return {status:409,message:"Invalid proposed fee."};
  // Admin must compare the fee to the relevant regular course before approving.
  if(decision==="APPROVED"&&req.body?.lowerThanCourseConfirmed!==true)return {status:400,message:"Confirm that the fee is lower than the comparable regular course."};
  const updated=await tx.programmeCohort.update({where:{id:p.id},data:{feeApprovalStatus:decision,approvedFeeKobo:decision==="APPROVED"?p.proposedFeeKobo:null,feeApprovedAt:new Date(),feeApprovedById:req.user.id,state:"DRAFT"}});
  await tx.adminAuditLog.create({data:{adminId:req.user.id,action:decision==="APPROVED"?"PROGRAMME_FEE_APPROVED":"PROGRAMME_FEE_REJECTED",targetType:"PROGRAMME",targetId:p.id,details:{proposedFeeKobo:p.proposedFeeKobo,decision}}});
  return {programme:updated};
 });
 if(result.status)return res.status(result.status).json({message:result.message});res.json(result);
}catch(e){next(e)}});
export default router;
