import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.middleware.js';
const router = Router();
router.use(requireAuth);
const fail = (res, status, message) => res.status(status).json({ message });
const isParticipant = (c, id) => c && (c.callerId === id || c.recipientId === id);
const selectCall = { id:true,callerId:true,recipientId:true,mode:true,status:true,createdAt:true,answeredAt:true,endedAt:true,caller:{select:{id:true,fullName:true,role:true}},recipient:{select:{id:true,fullName:true,role:true}} };
router.get('/me',(req,res)=>res.json({id:req.user.id}));
router.get('/people', async (req,res,next)=>{try{
 const q = String(req.query.q||'').trim();
 if(q.length<3 || q.length>80) return fail(res,400,'Enter at least three characters.');
 const users=await prisma.user.findMany({where:{id:{not:req.user.id},status:'ACTIVE',emailVerifiedAt:{not:null},OR:[{fullName:{contains:q,mode:'insensitive'}},{email:{equals:q,mode:'insensitive'}}]},select:{id:true,fullName:true,role:true},take:12});
 res.json({users});
}catch(e){next(e)}});
router.get('/',async(req,res,next)=>{try{
 const calls=await prisma.siteCall.findMany({where:{OR:[{callerId:req.user.id},{recipientId:req.user.id}]},select:selectCall,orderBy:{createdAt:'desc'},take:60});res.json({calls});
}catch(e){next(e)}});
router.post('/',async(req,res,next)=>{try{
 const {recipientId,mode}=req.body||{};
 if(typeof recipientId!=='string'||recipientId===req.user.id||!['audio','video'].includes(mode))return fail(res,400,'Invalid recipient or call mode.');
 const target=await prisma.user.findFirst({where:{id:recipientId,status:'ACTIVE',emailVerifiedAt:{not:null}},select:{id:true}});
 if(!target)return fail(res,404,'Recipient unavailable.');
 const pending=await prisma.siteCall.count({where:{status:{in:['RINGING','ACTIVE']},OR:[{callerId:req.user.id,recipientId},{callerId:recipientId,recipientId:req.user.id}]}});
 if(pending)return fail(res,409,'A call is already pending or active between these accounts.');
 const call=await prisma.siteCall.create({data:{callerId:req.user.id,recipientId,mode},select:selectCall});res.status(201).json({call});
}catch(e){next(e)}});
router.post('/:id/respond',async(req,res,next)=>{try{
 const {decision}=req.body||{};if(!['accept','decline'].includes(decision))return fail(res,400,'Invalid decision.');
 const result=await prisma.siteCall.updateMany({where:{id:req.params.id,recipientId:req.user.id,status:'RINGING'},data:decision==='accept'?{status:'ACTIVE',answeredAt:new Date()}:{status:'DECLINED',endedAt:new Date()}});
 if(!result.count)return fail(res,409,'Call not available to respond to.');res.json({ok:true});
}catch(e){next(e)}});
router.post('/:id/end',async(req,res,next)=>{try{
 const call=await prisma.siteCall.findUnique({where:{id:req.params.id},select:{callerId:true,recipientId:true}});
 if(!isParticipant(call,req.user.id))return fail(res,404,'Call not found.');
 await prisma.siteCall.updateMany({where:{id:req.params.id,status:{in:['RINGING','ACTIVE']}},data:{status:'ENDED',endedAt:new Date()}});res.json({ok:true});
}catch(e){next(e)}});
router.post('/:id/signals',async(req,res,next)=>{try{
 const call=await prisma.siteCall.findUnique({where:{id:req.params.id}});
 if(!isParticipant(call,req.user.id)||call.status!=='ACTIVE')return fail(res,403,'Call is not active.');
 const {kind,payload}=req.body||{};
 if(!['offer','answer','ice'].includes(kind)||!payload||typeof payload!=='object'||Array.isArray(payload)||JSON.stringify(payload).length>12000)return fail(res,400,'Invalid signal.');
 const recipientId=call.callerId===req.user.id?call.recipientId:call.callerId;
 const signal=await prisma.siteCallSignal.create({data:{callId:call.id,senderId:req.user.id,recipientId,kind,payload}});res.status(201).json({id:signal.id});
}catch(e){next(e)}});
router.get('/:id/signals',async(req,res,next)=>{try{
 const call=await prisma.siteCall.findUnique({where:{id:req.params.id}});
 if(!isParticipant(call,req.user.id)||call.status!=='ACTIVE')return fail(res,403,'Call is not active.');
 const after=typeof req.query.after==='string'&&Number.isFinite(Date.parse(req.query.after))?new Date(req.query.after):new Date(Date.now()-120000);
 const signals=await prisma.siteCallSignal.findMany({where:{callId:call.id,recipientId:req.user.id,createdAt:{gte:after}},orderBy:[{createdAt:'asc'},{id:'asc'}],take:100});res.json({signals});
}catch(e){next(e)}});
export default router;
