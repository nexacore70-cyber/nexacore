import { prisma } from '../db.js';
const asString = value => String(value ?? 0);
export async function financeOverview(_req, res) {
  try {
    const [payments, contracts, withdrawals, allocations] = await Promise.all([
      prisma.payment.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amountKobo: true } }),
      prisma.projectContract.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amountKobo: true } }),
      prisma.withdrawal.groupBy({ by: ['status'], _count: { _all: true }, _sum: { amountKobo: true } }),
      prisma.paymentAllocation.groupBy({ by: ['kind'], _count: { _all: true }, _sum: { amountKobo: true } }),
    ]);
    const pack = rows => rows.map(x => ({ status: x.status ?? x.kind, count: x._count._all, amountKobo: asString(x._sum.amountKobo) }));
    res.set('Cache-Control','no-store');
    res.json({ generatedAt: new Date().toISOString(), payments: pack(payments), contracts: pack(contracts), withdrawals: pack(withdrawals), allocations: pack(allocations), note: 'Database records, not confirmed bank settlements.' });
  } catch (error) {
    console.error('Admin finance overview:', error);
    res.status(500).json({message:'Could not load financial overview.'});
  }
}
