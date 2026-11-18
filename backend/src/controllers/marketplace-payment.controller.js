import crypto from 'node:crypto';
import { prisma } from '../db.js';

const BASE = 'https://api.paystack.co';
const prices = { basic: 500000, pro: 1500000, premium: 3000000 }; // kobo / 30 days
const fail = (res, e) => { console.error('Marketplace payment:', e.message); return res.status(e.httpStatus || 500).json({ message: e.httpStatus ? e.message : 'Payment operation failed.' }); };
const bad = (message, httpStatus = 400) => Object.assign(new Error(message), { httpStatus });
const ref = (prefix) => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;
function key() {
  const value = process.env.PAYSTACK_SECRET_KEY;
  if (!value?.startsWith('sk_test_')) throw bad('Marketplace payments require a Paystack TEST secret key.', 503);
  return value;
}
async function paystack(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, { ...options, headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json' } });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.status) throw bad('Paystack request failed: ' + (json.message || response.status), 502);
  return json.data;
}
async function initialize({ email, amountKobo, reference, metadata, callback }) {
  return paystack('/transaction/initialize', { method: 'POST', body: JSON.stringify({ email, amount: amountKobo, currency: 'NGN', reference, metadata, callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}${callback}` }) });
}
async function verify(reference, amountKobo, metadataType) {
  const tx = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (tx.status !== 'success' || tx.reference !== reference || tx.amount !== amountKobo || tx.currency !== 'NGN' || tx.metadata?.type !== metadataType) throw bad('Paystack has not verified this payment.', 409);
  return tx;
}
function role(req, name) { if (req.user.role !== name) throw bad(`${name} account required.`, 403); }
function id(value) { if (typeof value !== 'string' || value.length < 5 || value.length > 120) throw bad('Invalid identifier.'); return value; }
function projectView(p) { return { id: p.id, title: p.title, amountKobo: p.amountKobo, currency: p.currency, status: p.status, clientId: p.clientId, talentId: p.talentId, paidAt: p.paidAt, approvedAt: p.approvedAt }; }

export async function createProject(req, res) {
  try {
    role(req, 'CLIENT');
    const talentId = id(req.body?.talentId);
    const title = String(req.body?.title || '').trim();
    const amountKobo = req.body?.amountKobo;
    if (title.length < 5 || title.length > 200 || !Number.isSafeInteger(amountKobo) || amountKobo < 10000 || amountKobo > 1000000000) throw bad('Provide a title (5–200 characters) and project amount in kobo (₦100–₦10,000,000).');
    const talent = await prisma.user.findUnique({ where: { id: talentId } });
    if (!talent || !['TALENT', 'TUTOR'].includes(talent.role) || talent.status !== 'ACTIVE' || !talent.emailVerifiedAt) throw bad('Select an active verified Talent.', 404);
    const project = await prisma.projectContract.create({ data: { clientId: req.user.id, talentId, title, amountKobo } });
    res.status(201).json({ project: projectView(project) });
  } catch (e) { fail(res, e); }
}
export async function listProjects(req, res) {
  try {
    if (!['CLIENT', 'TALENT', 'TUTOR'].includes(req.user.role)) throw bad('Client or Talent account required.', 403);
    const where = req.user.role === 'CLIENT' ? { clientId: req.user.id } : { talentId: req.user.id };
    const projects = await prisma.projectContract.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json({ projects: projects.map(projectView) });
  } catch (e) { fail(res, e); }
}
export async function initializeProject(req, res) {
  try {
    role(req, 'CLIENT');
    const project = await prisma.projectContract.findUnique({ where: { id: id(req.params.id) } });
    if (!project || project.clientId !== req.user.id) throw bad('Project not found.', 404);
    if (project.status !== 'AWAITING_PAYMENT') throw bad('Project has already been paid or completed.', 409);
    const reference = project.paymentReference || ref('nxcproject');
    if (!project.paymentReference) {
      const claimed = await prisma.projectContract.updateMany({ where: { id: project.id, status: 'AWAITING_PAYMENT', paymentReference: null }, data: { paymentReference: reference } });
      if (!claimed.count) throw bad('Project checkout already started. Refresh and retry.', 409);
    }
    const checkout = await initialize({ email: req.user.email, amountKobo: project.amountKobo, reference, metadata: { type: 'PROJECT', projectId: project.id, clientId: req.user.id }, callback: '/client/payments' });
    res.json({ authorizationUrl: checkout.authorization_url, reference, amountKobo: project.amountKobo });
  } catch (e) { fail(res, e); }
}
// Atomic, idempotent settlement shared by user-initiated verification and signed webhooks.
async function fundVerifiedProject(project) {
  return prisma.$transaction(async (db) => {
    const claimed = await db.projectContract.updateMany({
      where: { id: project.id, status: 'AWAITING_PAYMENT', paymentReference: project.paymentReference },
      data: { status: 'PAID', paidAt: new Date() },
    });
    if (claimed.count === 1) {
      const talentShare = BigInt(project.amountKobo - Math.floor(project.amountKobo / 10));
      await db.talentWallet.upsert({
        where: { userId: project.talentId },
        create: { userId: project.talentId, pendingKobo: talentShare },
        update: { pendingKobo: { increment: talentShare } },
      });
      await db.walletTransaction.create({
        data: { userId: project.talentId, projectId: project.id,
          kind: 'PROJECT_PENDING_CREDIT', amountKobo: talentShare,
          reference: `project_pending_${project.id}` },
      });
    }
    return db.projectContract.findUnique({ where: { id: project.id } });
  });
}

// Call only after checking the raw-body Paystack signature. Re-verify with Paystack API.
export async function processPaystackProjectWebhook(event) {
  if (event?.event !== 'charge.success') return;
  const reference = event?.data?.reference;
  if (typeof reference !== 'string' || reference.length > 120) return;
  const project = await prisma.projectContract.findUnique({ where: { paymentReference: reference } });
  if (!project || project.status !== 'AWAITING_PAYMENT') return;
  const tx = await verify(reference, project.amountKobo, 'PROJECT');
  if (tx.metadata?.projectId !== project.id || tx.metadata?.clientId !== project.clientId) {
    throw bad('Paystack webhook metadata mismatch.', 409);
  }
  const client = await prisma.user.findUnique({ where: { id: project.clientId }, select: { email: true } });
  if (!client || tx.customer?.email?.toLowerCase() !== client.email.toLowerCase()) {
    throw bad('Paystack payer mismatch.', 409);
  }
  await fundVerifiedProject(project);
}

export async function verifyProject(req, res) {
  try {
    role(req, 'CLIENT');
    const project = await prisma.projectContract.findUnique({ where: { id: id(req.params.id) } });
    if (!project || project.clientId !== req.user.id) throw bad('Project not found.', 404);
    if (!project.paymentReference) throw bad('No checkout found.', 409);
    if (project.status !== 'AWAITING_PAYMENT') return res.json({ verified: true, project: projectView(project) });
    const tx = await verify(project.paymentReference, project.amountKobo, 'PROJECT');
    if (tx.metadata?.projectId !== project.id || tx.metadata?.clientId !== req.user.id) throw bad('Payment metadata mismatch.', 409);
    const result = await fundVerifiedProject(project);
    res.json({ verified: true, project: projectView(result), platformCommissionKobo: Math.floor(project.amountKobo / 10), talentShareKobo: project.amountKobo - Math.floor(project.amountKobo / 10), payoutEnabled: false });
  } catch (e) { fail(res, e); }
}
export async function markDelivered(req, res) {
  try {
    if (!['TALENT', 'TUTOR'].includes(req.user.role)) throw bad('Professional account required.', 403);
    const claimed = await prisma.projectContract.updateMany({ where: { id: id(req.params.id), talentId: req.user.id, status: 'PAID' }, data: { status: 'DELIVERED' } });
    if (!claimed.count) throw bad('Only a paid project can be submitted for Client approval.', 409);
    res.json({ delivered: true });
  } catch (e) { fail(res, e); }
}
export async function approveProject(req, res) {
  try {
    role(req, 'CLIENT');
    const project = await prisma.projectContract.findUnique({ where: { id: id(req.params.id) } });
    if (!project || project.clientId !== req.user.id) throw bad('Project not found.', 404);
    const talentShare = BigInt(project.amountKobo - Math.floor(project.amountKobo / 10));
    await prisma.$transaction(async (db) => {
      const claimed = await db.projectContract.updateMany({ where: { id: project.id, clientId: req.user.id, status: 'DELIVERED' }, data: { status: 'APPROVED', approvedAt: new Date() } });
      if (!claimed.count) throw bad('Project must be delivered and awaiting approval.', 409);
      const moved = await db.talentWallet.updateMany({ where: { userId: project.talentId, pendingKobo: { gte: talentShare } }, data: { pendingKobo: { decrement: talentShare }, availableKobo: { increment: talentShare } } });
      if (!moved.count) throw bad('Wallet pending balance does not match the project.', 409);
      await db.walletTransaction.create({ data: { userId: project.talentId, projectId: project.id, kind: 'PROJECT_APPROVED_RELEASE', amountKobo: talentShare, reference: `project_release_${project.id}` } });
    });
    res.json({ approved: true, talentAvailableKobo: Number(talentShare), payoutEnabled: false });
  } catch (e) { fail(res, e); }
}
export async function wallet(req, res) {
  try {
    if (!['TALENT', 'TUTOR'].includes(req.user.role)) throw bad('Professional account required.', 403);
    const w = await prisma.talentWallet.findUnique({ where: { userId: req.user.id } });
    const history = await prisma.walletTransaction.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ pendingKobo: String(w?.pendingKobo ?? 0), availableKobo: String(w?.availableKobo ?? 0), history: history.map(t => ({ ...t, amountKobo: String(t.amountKobo) })), withdrawalsEnabled: false });
  } catch (e) { fail(res, e); }
}
export async function plans(_req, res) { res.json({ plans: Object.entries(prices).map(([id, priceKobo]) => ({ id, name: id[0].toUpperCase() + id.slice(1), priceKobo, durationDays: 30, currency: 'NGN' })) }); }
export async function initializeUpgrade(req, res) {
  try {
    role(req, 'TALENT');
    const planId = String(req.body?.planId || '').toLowerCase();
    if (!Object.hasOwn(prices, planId)) throw bad('Choose Basic, Pro or Premium.');
    const plan = await prisma.upgradePlan.findUnique({ where: { id: planId } });
    if (!plan?.active || plan.priceKobo !== prices[planId] || plan.durationDays !== 30) throw bad('Upgrade plans have not been configured by the administrator.', 503);
    const reference = ref('nxcupgrade');
    const subscription = await prisma.upgradeSubscription.create({ data: { userId: req.user.id, planId, paymentReference: reference } });
    const checkout = await initialize({ email: req.user.email, amountKobo: prices[planId], reference, metadata: { type: 'UPGRADE', subscriptionId: subscription.id, userId: req.user.id, planId }, callback: '/talent/subscription' });
    res.json({ authorizationUrl: checkout.authorization_url, reference, amountKobo: prices[planId] });
  } catch (e) { fail(res, e); }
}
export async function verifyUpgrade(req, res) {
  try {
    role(req, 'TALENT');
    const reference = id(req.body?.reference);
    const sub = await prisma.upgradeSubscription.findUnique({ where: { paymentReference: reference }, include: { plan: true } });
    if (!sub || sub.userId !== req.user.id) throw bad('Upgrade not found.', 404);
    if (sub.status === 'ACTIVE') return res.json({ verified: true, endsAt: sub.endsAt, planId: sub.planId });
    const tx = await verify(reference, sub.plan.priceKobo, 'UPGRADE');
    if (tx.metadata?.subscriptionId !== sub.id || tx.metadata?.userId !== req.user.id || tx.metadata?.planId !== sub.planId) throw bad('Upgrade metadata mismatch.', 409);
    const result = await prisma.$transaction(async (db) => {
      const claimed = await db.upgradeSubscription.updateMany({ where: { id: sub.id, status: 'PENDING' }, data: { status: 'PROCESSING' } });
      if (!claimed.count) throw bad('Upgrade verification is already being processed.', 409);
      const now = new Date();
      const latest = await db.upgradeSubscription.findFirst({ where: { userId: req.user.id, status: 'ACTIVE' }, orderBy: { endsAt: 'desc' } });
      const start = latest?.endsAt > now ? latest.endsAt : now;
      const end = new Date(start.getTime() + 30 * 86400000);
      return db.upgradeSubscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE', startsAt: start, endsAt: end } });
    });
    res.json({ verified: true, planId: result.planId, startsAt: result.startsAt, endsAt: result.endsAt });
  } catch (e) { fail(res, e); }
}
