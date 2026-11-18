import { prisma } from '../db.js';

export async function adminDashboardOverview(req, res) {
  try {
    const [users, students, tutors, clients, talents, pendingAccounts,
      enrollments, projects, pendingWithdrawals, pendingAssessments,
      payments, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'TUTOR' } }),
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.user.count({ where: { role: 'TALENT' } }),
      prisma.user.count({ where: { status: 'PENDING' } }),
      prisma.enrollment.count(),
      prisma.projectContract.count(),
      prisma.withdrawal.count({ where: { status: 'PENDING' } }),
      prisma.tutorAssessment.count({ where: { passed: null } }),
      prisma.payment.aggregate({
        where: { verifiedAt: { not: null }, currency: 'NGN' },
        _count: { _all: true }, _sum: { amountKobo: true }
      }),
      prisma.user.findMany({
        take: 6, orderBy: { createdAt: 'desc' },
        select: { id: true, fullName: true, email: true, role: true, status: true, createdAt: true }
      })
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({
      generatedAt: new Date().toISOString(),
      counts: { users, students, tutors, clients, talents, pendingAccounts, enrollments, projects, pendingWithdrawals, pendingAssessments, verifiedPayments: payments._count._all },
      verifiedPaymentInflowKobo: payments._sum.amountKobo || 0,
      recentUsers,
      notes: { verifiedPaymentInflowKobo: 'Sum of verified NGN payment records; not bank balance, net platform revenue or payouts.', pendingAssessments: 'Assessments without a recorded pass/fail outcome, not necessarily awaiting manual approval.' }
    });
  } catch (error) {
    console.error('Admin dashboard overview failed:', error);
    res.status(500).json({ message: 'Could not load database dashboard.' });
  }
}
