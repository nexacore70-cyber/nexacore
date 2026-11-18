import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
const failure = (res, status, message) => res.status(status).json({ message });
const key = () => {
  const value = process.env.PAYSTACK_SECRET_KEY || '';
  if (!/^sk_(test|live)_/.test(value)) throw new Error('PAYSTACK_NOT_CONFIGURED');
  return value;
};
async function paystack(path, options={}) {
  const response = await fetch(`https://api.paystack.co${path}`, {
    ...options, headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' }
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.status !== true) throw new Error('PAYSTACK_REQUEST_FAILED');
  return json.data;
}
const safe = (res, error) => {
  console.error('Programme payment error:', error);
  return failure(res, error.message === 'PAYSTACK_NOT_CONFIGURED' ? 503 : 502, 'Programme payment could not be processed.');
};
router.post('/initialize', async (req,res) => {
  try {
    const applicationId = String(req.body?.applicationId || '');
    if (!applicationId || applicationId.length > 100) return failure(res,400,'Valid application required.');
    const app = await prisma.programmeApplication.findUnique({where:{id:applicationId},include:{cohort:true,applicant:{select:{email:true}}}});
    if (!app || app.applicantId !== req.user.id) return failure(res,404,'Application not found.');
    if (app.state !== 'ACCEPTED' || app.cohort.feeApprovalStatus !== 'APPROVED' || !app.cohort.approvedFeeKobo || app.cohort.state !== 'OPEN') return failure(res,409,'Programme is not eligible for payment.');
    if (app.paidAt) return failure(res,409,'Application is already paid.');
    const pending = await prisma.programmePayment.findFirst({where:{applicationId,status:'PENDING'},orderBy:{createdAt:'desc'}});
    if (pending) return failure(res,409,'A payment is already pending. Verify it or contact support before retrying.');
    const reference = `nxcp_${crypto.randomBytes(16).toString('hex')}`;
    const amount = app.cohort.approvedFeeKobo;
    const callbackBase = process.env.PROGRAMME_PAYMENT_RETURN_URL;
    if (!callbackBase || !/^https?:\/\//.test(callbackBase)) return failure(res,503,'Programme payment return URL is not configured.');
    const callback = new URL(callbackBase);
    const initialized = await paystack('/transaction/initialize',{method:'POST',body:JSON.stringify({email:app.applicant.email,amount,currency:'NGN',reference,callback_url:callback.toString(),metadata:{applicationId,applicantId:req.user.id,cohortId:app.cohortId}})});
    await prisma.programmePayment.create({data:{applicationId,reference,amountKobo:amount}});
    res.json({authorizationUrl:initialized.authorization_url,reference,amountKobo:amount,currency:'NGN'});
  } catch(error) { safe(res,error); }
});
router.post('/verify',async(req,res)=>{
  try {
    const reference = String(req.body?.reference || '');
    if (!/^nxcp_[a-f0-9]{32}$/.test(reference)) return failure(res,400,'Invalid reference.');
    const payment = await prisma.programmePayment.findUnique({where:{reference},include:{application:{include:{cohort:true}}}});
    if (!payment || payment.application.applicantId !== req.user.id) return failure(res,404,'Payment not found.');
    if (payment.status === 'SUCCESS') return res.json({verified:true,accessActive:true});
    const txData = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (txData.status !== 'success' || txData.reference !== reference || txData.amount !== payment.amountKobo || txData.currency !== 'NGN' || txData.metadata?.applicationId !== payment.applicationId || txData.metadata?.applicantId !== req.user.id || txData.metadata?.cohortId !== payment.application.cohortId) return failure(res,409,'Payment could not be verified.');
    const result = await prisma.$transaction(async tx=>{
      // Serialize competing verification requests for this exact payment.
      await tx.$queryRaw`SELECT id FROM "ProgrammePayment" WHERE id = ${payment.id} FOR UPDATE`;
      const current = await tx.programmePayment.findUnique({where:{id:payment.id}});
      if (current.status === 'SUCCESS') return true;
      const application = await tx.programmeApplication.findUnique({where:{id:payment.applicationId},include:{cohort:true}});
      if (application.state !== 'ACCEPTED' || application.paidAt || application.cohort.approvedFeeKobo !== payment.amountKobo) throw new Error('PAYMENT_STATE_CHANGED');
      const platform = await tx.user.findUnique({where:{email:process.env.NEXACORE_PLATFORM_ACCOUNT_EMAIL || ''}});
      const tutor = await tx.user.findUnique({where:{id:application.cohort.tutorId}});
      if (!platform || platform.role !== 'ADMIN' || !tutor || tutor.role !== 'TUTOR') throw new Error('ALLOCATION_ACCOUNTS_MISSING');
      const platformShare = Math.floor(payment.amountKobo * 40 / 100);
      const tutorShare = payment.amountKobo - platformShare;
      await tx.programmePaymentAllocation.createMany({data:[{paymentId:payment.id,recipientId:platform.id,kind:'PLATFORM_PROGRAMME',amountKobo:platformShare},{paymentId:payment.id,recipientId:tutor.id,kind:'TUTOR_PROGRAMME',amountKobo:tutorShare}]});
      await tx.tutorWallet.upsert({where:{userId:tutor.id},create:{userId:tutor.id,availableKobo:BigInt(tutorShare)},update:{availableKobo:{increment:BigInt(tutorShare)}}});
      await tx.programmeApplication.update({where:{id:application.id},data:{paidAt:new Date()}});
      await tx.programmePayment.update({where:{id:payment.id},data:{status:'SUCCESS',verifiedAt:new Date()}});
      return true;
    });
    return res.json({verified:result,accessActive:result});
  } catch(error) { safe(res,error); }
});
router.get('/access/:applicationId',async(req,res)=>{
  try {
    const app = await prisma.programmeApplication.findUnique({where:{id:String(req.params.applicationId)},select:{applicantId:true,state:true,paidAt:true,cohort:{select:{id:true,title:true,kind:true,state:true}}}});
    if (!app || app.applicantId !== req.user.id) return failure(res,404,'Application not found.');
    const accessActive = app.state === 'ACCEPTED' && Boolean(app.paidAt);
    return res.json({accessActive,programme:accessActive?app.cohort:null});
  } catch(error) { safe(res,error); }
});
router.get('/mine',async(req,res)=>{
  try {
    const applications = await prisma.programmeApplication.findMany({where:{applicantId:req.user.id},select:{id:true,state:true,paidAt:true,cohort:{select:{id:true,kind:true,title:true,approvedFeeKobo:true}},payments:{select:{reference:true,status:true,amountKobo:true,createdAt:true},orderBy:{createdAt:'desc'}}}});
    res.json({applications});
  } catch(error) { safe(res,error); }
});
export default router;
