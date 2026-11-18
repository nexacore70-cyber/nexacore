import { Router } from 'express';
import crypto from 'node:crypto';
import { processPaystackProjectWebhook } from '../controllers/marketplace-payment.controller.js';

const router = Router();
router.post('/', async (req, res) => {
  const secret = process.env.PAYSTACK_SECRET_KEY || '';
  if (!secret.startsWith('sk_test_') || !Buffer.isBuffer(req.body)) return res.sendStatus(503);
  const signature = req.get('x-paystack-signature') || '';
  const expected = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
  if (!/^[a-f0-9]{128}$/i.test(signature) ||
      !crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'))) {
    return res.sendStatus(401);
  }
  try {
    const event = JSON.parse(req.body.toString('utf8'));
    await processPaystackProjectWebhook(event);
    return res.sendStatus(200);
  } catch (error) {
    console.error('Paystack webhook processing failed:', error.message);
    return res.sendStatus(500); // Ask Paystack to retry transient failures.
  }
});
export default router;
