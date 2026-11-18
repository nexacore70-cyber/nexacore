import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import bcrypt from 'bcrypt';
import { prisma } from '../src/db.js';

const EMAIL = 'nexacore70@gmail.com';
const rl = createInterface({ input: stdin, output: stdout });
try {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, role: true } });
  if (existing) throw new Error('This email already exists. No account was changed.');
  const confirm = (await rl.question(`Create a new ADMIN account for ${EMAIL}? Type CREATE: `)).trim();
  if (confirm !== 'CREATE') throw new Error('Cancelled.');
  console.log('Password input will be visible in this terminal. Ensure nobody is watching and clear terminal history afterward.');
  const password = await rl.question('Enter a NEW administrator password (at least 16 characters): ');
  if (password.length < 16 || password.length > 1024) throw new Error('Password must contain 16–1024 characters.');
  const repeated = await rl.question('Repeat new administrator password: ');
  if (password !== repeated) throw new Error('Passwords do not match.');
  const passwordHash = await bcrypt.hash(password, 12);
  const created = await prisma.user.create({
    data: {
      fullName: 'NexaCore Administrator',
      email: EMAIL,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    },
    select: { email: true, role: true, status: true, emailVerifiedAt: true },
  });
  console.log('Created administrator:', created.email, created.role, created.status);
  console.log('Remove this bootstrap script from deployed systems after successful verification.');
} catch (error) {
  console.error('Admin creation did not complete:', error.message);
  process.exitCode = 1;
} finally {
  rl.close();
  await prisma.$disconnect();
}
