import crypto from 'node:crypto';
import { prisma } from '../db.js';

// TEST MODE ONLY. Never enable live payouts by merely changing an environment variable.
const BASE = 'https://api.paystack.co';
const fail = (res, e) => { console.error('Payout:', e.message); res.status(e.status || 500).json({ message: e.status ? e.message : 'Payout request failed.' }); };
const error = (message, status = 400) => Object.assign(new Error(message), { status });
function testKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key?.startsWith('sk_test_')) throw error('Payouts require a Paystack test secret key.', 503);
  return key;
}
async function paystack(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, { ...options, headers: { Authorization: `Bearer ${testKey()}`, 'Content-Type': 'application/json' } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.status) throw error(json.message || 'Paystack API request failed.', 502);
  return json.data;
}
const isAdmin = req => req.user?.role === 'ADMIN';
function validAmount(value) {
  if (!Number.isSafeInteger(value) || value < 10000 || value > 1000000000) throw error('Amount must be an integer in kobo between ₦100 and ₦10,000,000.');
  return BigInt(value);
}
function safeWithdrawal(w) {
  return { id: w.id, userId: w.userId, amountKobo: String(w.amountKobo), status: w.status, transferReference: w.transferReference, createdAt: w.createdAt };
}
export async function banks(req, res) {
  try { return res.json({ banks: await paystack('/bank?country=nigeria&currency=NGN') }); } catch (e) { fail(res, e); }
}
export async function savePayoutAccount(req, res) {
  try {
    if (!['TALENT', 'TUTOR'].includes(req.user.role)) throw error('Tutor or Talent account required.', 403);
    const bankCode = String(req.body?.bankCode || '').trim();
    const accountNumber = String(req.body?.accountNumber || '').trim();
    if (!/^\d{3,6}$/.test(bankCode) || !/^\d{10}$/.test(accountNumber)) throw error('Provide a valid bank code and 10-digit account number.');
    const resolved = await paystack(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
    if (resolved.account_number !== accountNumber || !resolved.account_name) throw error('Paystack could not verify the bank account.', 409);
    const recipient = await paystack('/transferrecipient', { method: 'POST', body: JSON.stringify({ type: 'nuban', name: resolved.account_name, account_number: accountNumber, bank_code: bankCode, currency: 'NGN' }) });
    if (!recipient.recipient_code) throw error('Paystack did not return a transfer recipient.', 502);
    await prisma.payoutAccount.upsert({ where: { userId: req.user.id }, create: { userId: req.user.id, bankCode, accountLast4: accountNumber.slice(-4), accountName: resolved.account_name, recipientCode: recipient.recipient_code }, update: { bankCode, accountLast4: accountNumber.slice(-4), accountName: resolved.account_name, recipientCode: recipient.recipient_code } });
    return res.json({ verified: true, bankCode, accountLast4: accountNumber.slice(-4), accountName: resolved.account_name });
  } catch (e) { fail(res, e); }
}
export async function myPayoutAccount(req, res) {
  try {
    const account = await prisma.payoutAccount.findUnique({ where: { userId: req.user.id }, select: { bankCode: true, accountLast4: true, accountName: true, updatedAt: true } });
    res.json({ account });
  } catch (e) { fail(res, e); }
}
export async function requestTalentWithdrawal(req, res) {
  try {
    if (!['TALENT', 'TUTOR'].includes(req.user.role)) throw error('Tutor or Talent account required.', 403);
    testKey();
    const amount = validAmount(req.body?.amountKobo);
    const account = await prisma.payoutAccount.findUnique({ where: { userId: req.user.id } });
    if (!account) throw error('Verify a bank account before requesting a withdrawal.', 409);
    const withdrawal = await prisma.$transaction(async tx => {
      const wallet = req.user.role === 'TUTOR' ? tx.tutorWallet : tx.talentWallet;
      const reserved = await wallet.updateMany({ where: { userId: req.user.id, availableKobo: { gte: amount } }, data: { availableKobo: { decrement: amount } } });
      if (reserved.count !== 1) throw error('Insufficient available balance.', 409);
      return tx.withdrawal.create({ data: { userId: req.user.id, amountKobo: amount, status: 'PENDING', recipientCode: account.recipientCode } });
    });
    res.status(201).json({ withdrawal: safeWithdrawal(withdrawal), message: 'Withdrawal reserved. Awaiting administrator approval; no bank transfer has been sent.' });
  } catch (e) { fail(res, e); }
}
export async function myWithdrawals(req, res) {
  try {
    if (!['TALENT', 'TUTOR'].includes(req.user.role)) throw error('Tutor or Talent account required.', 403);
    const items = await prisma.withdrawal.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ withdrawals: items.map(safeWithdrawal) });
  } catch (e) { fail(res, e); }
}
export async function adminWithdrawals(req, res) {
  try {
    if (!isAdmin(req)) throw error('Administrator account required.', 403);
    const items = await prisma.withdrawal.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ withdrawals: items.map(safeWithdrawal) });
  } catch (e) { fail(res, e); }
}
export async function adminSendTransfer(req, res) {
  try {
    if (!isAdmin(req)) throw error('Administrator account required.', 403);
    testKey();
    const id = String(req.params.id);
    const withdrawal = await prisma.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) throw error('Withdrawal not found.', 404);
    if (withdrawal.status !== 'PENDING') throw error('Withdrawal is already being processed.', 409);
    if (!withdrawal.recipientCode) throw error('Withdrawal has no verified recipient.', 409);
    const reference = `nxcwd_${withdrawal.id}`;
    // Persist intent before network call; ambiguous failures remain PROCESSING for reconciliation.
    const claimed = await prisma.withdrawal.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'PROCESSING', transferReference: reference } });
    if (!claimed.count) throw error('Withdrawal was already claimed.', 409);
    try {
      const transfer = await paystack('/transfer', { method: 'POST', body: JSON.stringify({ source: 'balance', amount: Number(withdrawal.amountKobo), recipient: withdrawal.recipientCode, reference, reason: `NexaCore withdrawal ${id}` }) });
      res.json({ initiated: true, reference, paystackStatus: transfer.status, message: 'Transfer initiated in Paystack test mode. Funds remain reserved until confirmation.' });
    } catch (e) {
      console.error('Transfer initiation uncertain, reconcile reference:', reference, e.message);
      res.status(502).json({ message: 'Transfer initiation could not be confirmed. Do not retry blindly; reconcile this reference first.', reference });
    }
  } catch (e) { fail(res, e); }
}
export async function reconcileTransfer(req, res) {
  try {
    if (!isAdmin(req)) throw error('Administrator account required.', 403);
    const withdrawal = await prisma.withdrawal.findUnique({ where: { id: String(req.params.id) } });
    if (!withdrawal?.transferReference) throw error('No transfer reference exists.', 404);
    const transfer = await paystack(`/transfer/verify/${encodeURIComponent(withdrawal.transferReference)}`);
    if (transfer.reference !== withdrawal.transferReference || Number(transfer.amount) !== Number(withdrawal.amountKobo)) throw error('Paystack transfer details do not match.', 409);
    const state = String(transfer.status || '').toLowerCase();
    if (state === 'success') {
      await prisma.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'PROCESSING' }, data: { status: 'SUCCESS' } });
    } else if (['failed', 'reversed'].includes(state)) {
      await prisma.$transaction(async tx => {
        const claimed = await tx.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'PROCESSING' }, data: { status: 'FAILED' } });
        if (claimed.count) {
          const owner = await tx.user.findUnique({ where: { id: withdrawal.userId }, select: { role: true } });
          const wallet = owner?.role === 'TUTOR' ? tx.tutorWallet : tx.talentWallet;
          await wallet.update({ where: { userId: withdrawal.userId }, data: { availableKobo: { increment: withdrawal.amountKobo } } });
        }
      });
    }
    const current = await prisma.withdrawal.findUnique({ where: { id: withdrawal.id } });
    res.json({ withdrawal: safeWithdrawal(current), paystackStatus: state });
  } catch (e) { fail(res, e); }
}
export async function rejectWithdrawal(req, res) {
  try {
    if (!isAdmin(req)) throw error('Administrator account required.', 403);
    const id = String(req.params.id);
    await prisma.$transaction(async tx => {
      const w = await tx.withdrawal.findUnique({ where: { id } });
      if (!w) throw error('Withdrawal not found.', 404);
      const claimed = await tx.withdrawal.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'REJECTED' } });
      if (!claimed.count) throw error('Only unprocessed requests may be rejected.', 409);
      const owner = await tx.user.findUnique({ where: { id: w.userId }, select: { role: true } });
      const wallet = owner?.role === 'TUTOR' ? tx.tutorWallet : tx.talentWallet;
      await wallet.update({ where: { userId: w.userId }, data: { availableKobo: { increment: w.amountKobo } } });
    });
    res.json({ rejected: true, refundedToWallet: true });
  } catch (e) { fail(res, e); }
}

export async function myPayoutBalance(req, res) {
  try {
    if (!['TUTOR','TALENT'].includes(req.user.role)) throw error('Tutor or Talent account required.', 403);
    const wallet = req.user.role === 'TUTOR' ? prisma.tutorWallet : prisma.talentWallet;
    const balance = await wallet.findUnique({ where: { userId: req.user.id } });
    res.json({ role: req.user.role, availableKobo: String(balance?.availableKobo ?? 0n), pendingKobo: String(balance?.pendingKobo ?? 0n) });
  } catch (e) { fail(res, e); }
}
