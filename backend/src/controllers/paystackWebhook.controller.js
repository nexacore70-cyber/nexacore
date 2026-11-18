import crypto from 'node:crypto';
import { prisma } from '../db.js';

// Paystack test-mode transfer events. Never trust client-provided transfer status.
export async function paystackWebhook(req, res) {
  const key = process.env.PAYSTACK_SECRET_KEY || '';
  if (!key.startsWith('sk_test_') || !Buffer.isBuffer(req.body)) return res.sendStatus(503);
  const signature = req.get('x-paystack-signature') || '';
  const expected = crypto.createHmac('sha512', key).update(req.body).digest('hex');
  if (!/^[a-f0-9]{128}$/i.test(signature) || !crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) return res.sendStatus(401);
  let event;
  try { event = JSON.parse(req.body.toString('utf8')); } catch { return res.sendStatus(400); }
  const name = event?.event;
  if (!['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(name)) return res.sendStatus(200);
  const data = event?.data;
  const reference = String(data?.reference || '');
  if (!/^nxcwd_[a-zA-Z0-9_-]+$/.test(reference)) return res.sendStatus(200);
  try {
    const w = await prisma.withdrawal.findUnique({ where: { transferReference: reference } });
    if (!w) return res.sendStatus(200);
    if (Number(data.amount) !== Number(w.amountKobo) || String(data.currency || 'NGN') !== 'NGN') return res.sendStatus(409);
    if (name === 'transfer.success') {
      await prisma.withdrawal.updateMany({ where: { id: w.id, status: 'PROCESSING' }, data: { status: 'SUCCESS' } });
    } else {
      await prisma.$transaction(async tx => {
        const claimed = await tx.withdrawal.updateMany({ where: { id: w.id, status: 'PROCESSING' }, data: { status: 'FAILED' } });
        if (!claimed.count) return;
        const user = await tx.user.findUnique({ where: { id: w.userId }, select: { role: true } });
        if (user?.role !== 'TUTOR' && user?.role !== 'TALENT') throw new Error('Withdrawal owner role invalid');
        const wallet = user.role === 'TUTOR' ? tx.tutorWallet : tx.talentWallet;
        await wallet.update({ where: { userId: w.userId }, data: { availableKobo: { increment: w.amountKobo } } });
      });
    }
    return res.sendStatus(200);
  } catch (err) { console.error('Paystack webhook processing failed:', err); return res.sendStatus(500); }
}
