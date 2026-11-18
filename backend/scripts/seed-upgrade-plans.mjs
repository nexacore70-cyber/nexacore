import 'dotenv/config';
import { prisma } from '../src/db.js';
const plans = [['basic','Basic',500000], ['pro','Pro',1500000], ['premium','Premium',3000000]];
try {
  for (const [id,name,priceKobo] of plans) {
    await prisma.upgradePlan.upsert({ where: { id }, create: { id, name, priceKobo, durationDays: 30, active: true }, update: { name, priceKobo, durationDays: 30, active: true } });
  }
  console.log('Test upgrade plans configured.');
} finally { await prisma.$disconnect(); }
