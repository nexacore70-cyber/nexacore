import { prisma } from '../db.js';

const allowedRoles = new Set(['STUDENT','TUTOR','CLIENT','TALENT','SERVICE_PROVIDER','ADMIN']);
const allowedStatuses = new Set(['PENDING','ACTIVE','SUSPENDED']);
const pickUser = { id:true, fullName:true, email:true, role:true, status:true, emailVerifiedAt:true, createdAt:true };
const fail = (res,error) => { console.error('Admin control:',error); return res.status(500).json({message:'Admin operation failed.'}); };
const audit = (tx,req,action,targetType,targetId,details={}) => tx.adminAuditLog.create({data:{adminId:req.user.id,action,targetType,targetId,details}});

export async function listUsers(req,res){
 try {
  const page = Math.max(1, Math.min(10000,Number(req.query.page)||1));
  const search = String(req.query.search||'').trim().slice(0,100);
  const where = search ? {OR:[{fullName:{contains:search,mode:'insensitive'}},{email:{contains:search,mode:'insensitive'}}]} : {};
  const [users,total]=await Promise.all([prisma.user.findMany({where,select:pickUser,orderBy:{createdAt:'desc'},skip:(page-1)*25,take:25}),prisma.user.count({where})]);
  res.set('Cache-Control','no-store');res.json({users,total,page,pageSize:25});
 }catch(e){fail(res,e)}
}
export async function updateUser(req,res){
 const {id}=req.params;const {status,role}=req.body||{};
 if(!allowedStatuses.has(status) && !allowedRoles.has(role)) return res.status(400).json({message:'Valid status or role required.'});
 if(status!==undefined&&!allowedStatuses.has(status))return res.status(400).json({message:'Invalid status.'});
 if(role!==undefined&&!allowedRoles.has(role))return res.status(400).json({message:'Invalid role.'});
 if(id===req.user.id) return res.status(403).json({message:'You cannot modify your own admin access.'});
 try{
  const updated=await prisma.$transaction(async tx=>{
   const before=await tx.user.findUnique({where:{id},select:pickUser});if(!before) return null;
   // Prevent role escalation and accidental lockout through this general-purpose endpoint.
   if(before.role==='ADMIN'||role==='ADMIN') throw Object.assign(new Error('Admin account changes require a separate privileged process.'),{http:403});
   const user=await tx.user.update({where:{id},data:{...(status!==undefined?{status}:{}),...(role!==undefined?{role}:{})},select:pickUser});
   if(status==='SUSPENDED') await tx.session.deleteMany({where:{userId:id}});
   await audit(tx,req,'USER_UPDATED','USER',id,{before:{role:before.role,status:before.status},after:{role:user.role,status:user.status}});
   return user;
  });
  if(!updated)return res.status(404).json({message:'User not found.'});res.json({user:updated});
 }catch(e){if(e.http)return res.status(e.http).json({message:e.message});fail(res,e)}
}
export async function deleteUser(req,res){
 const {id}=req.params;
 const {confirmation}=req.body||{};
 if(confirmation!==`DELETE ${id}`)return res.status(400).json({message:`Enter DELETE ${id} to confirm.`});
 if(id===req.user.id)return res.status(403).json({message:'You cannot delete your own account.'});
 try{
  const result=await prisma.$transaction(async tx=>{
   const user=await tx.user.findUnique({where:{id},select:pickUser});if(!user)return {notFound:true};
   if(user.role==='ADMIN')return {blocked:'Admin accounts require a separate privileged removal process.'};
   // Financial, assessment, or course relationships must be preserved for audit and dispute handling.
   const counts=await Promise.all([
    tx.payment.count({where:{userId:id}}),tx.enrollment.count({where:{userId:id}}),
    tx.paymentAllocation.count({where:{recipientId:id}}),tx.projectContract.count({where:{OR:[{clientId:id},{talentId:id}]}}),
    tx.withdrawal.count({where:{userId:id}}),tx.walletTransaction.count({where:{userId:id}}),
    tx.upgradeSubscription.count({where:{userId:id}}),tx.tutorAssessment.count({where:{userId:id}}),
    tx.courseTutor.count({where:{tutorId:id}}),tx.talentWallet.count({where:{userId:id}})
   ]);
   if(counts.some(Boolean))return {blocked:'This account has financial, course, or assessment records. Suspend it instead; deletion needs a retention-safe review.'};
   await audit(tx,req,'USER_DELETED','USER',id,{email:user.email,role:user.role});
   await tx.user.delete({where:{id}});
   return {deleted:true};
  });
  if(result.notFound)return res.status(404).json({message:'User not found.'});
  if(result.blocked)return res.status(409).json({message:result.blocked});
  res.json({deleted:true});
 }catch(e){fail(res,e)}
}
export async function listAssessmentBank(req,res){
 try{
  const subject=String(req.query.subject||'').trim().slice(0,120);
  const where=subject?{subject:{contains:subject,mode:'insensitive'}}:{};
  const [questions,audio]=await Promise.all([
   prisma.tutorQuestion.findMany({where,select:{id:true,subject:true,prompt:true,approved:true,createdAt:true},take:100,orderBy:{createdAt:'desc'}}),
   prisma.tutorAudioTask.findMany({where,select:{id:true,subject:true,audioUrl:true,approved:true},take:100})
  ]);
  res.json({questions,audio});
 }catch(e){fail(res,e)}
}
export async function approveAssessmentItem(req,res){
 const {type,id}=req.params;const {approved}=req.body||{};
 if(typeof approved!=='boolean')return res.status(400).json({message:'approved must be boolean.'});
 const model=type==='question'?'tutorQuestion':type==='audio'?'tutorAudioTask':null;
 if(!model)return res.status(400).json({message:'Invalid assessment item type.'});
 try{
  const result=await prisma.$transaction(async tx=>{
   const existing=await tx[model].findUnique({where:{id}});if(!existing)return null;
   const updated=await tx[model].update({where:{id},data:{approved}});
   await audit(tx,req,approved?'ASSESSMENT_APPROVED':'ASSESSMENT_REVOKED',type.toUpperCase(),id,{subject:updated.subject});
   return {id:updated.id,approved:updated.approved};
  });
  if(!result)return res.status(404).json({message:'Item not found.'});res.json(result);
 }catch(e){fail(res,e)}
}
export async function listAudit(req,res){
 try{const logs=await prisma.adminAuditLog.findMany({take:100,orderBy:{createdAt:'desc'}});res.json({logs});}catch(e){fail(res,e)}
}
