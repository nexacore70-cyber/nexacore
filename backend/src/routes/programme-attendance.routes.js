import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
const fail = (res, code, message) => res.status(code).json({ message });
async function access(cohortId, user) {
  const cohort = await prisma.programmeCohort.findUnique({ where: { id: cohortId }, select: { id: true, tutorId: true } });
  if (!cohort) return null;
  const manager = cohort.tutorId === user.id || user.role === 'ADMIN';
  const participant = manager ? null : await prisma.programmeApplication.findFirst({
    where: { cohortId, applicantId: user.id, state: 'ACCEPTED', paidAt: { not: null }, payments: { some: { status: 'SUCCESS' } } }, select: { id: true }
  });
  return { cohort, manager, participant };
}
router.get('/:cohortId', async (req, res, next) => {
  try {
    const a = await access(req.params.cohortId, req.user);
    if (!a) return fail(res, 404, 'Programme not found.');
    if (!a.manager && !a.participant) return fail(res, 403, 'Programme access required.');
    const sessions = await prisma.programmeAttendanceSession.findMany({
      where: { cohortId: a.cohort.id }, orderBy: { heldAt: 'desc' },
      include: { records: { where: a.manager ? {} : { applicantId: req.user.id }, select: { applicantId: true, present: true, markedAt: true } } }
    });
    return res.json({ sessions, manager: a.manager });
  } catch (e) { next(e); }
});
router.post('/:cohortId/sessions', async (req, res, next) => {
  try {
    const a = await access(req.params.cohortId, req.user);
    if (!a?.manager) return fail(res, 403, 'Only the programme Tutor or Admin may create sessions.');
    const title = String(req.body?.title || '').trim();
    const heldAt = new Date(req.body?.heldAt);
    if (!title || title.length > 160 || Number.isNaN(heldAt.getTime())) return fail(res, 400, 'Valid title and session date required.');
    const session = await prisma.programmeAttendanceSession.create({ data: { cohortId: a.cohort.id, title, heldAt } });
    return res.status(201).json({ session });
  } catch (e) { next(e); }
});
router.put('/:cohortId/sessions/:sessionId/attendance/:applicantId', async (req, res, next) => {
  try {
    const a = await access(req.params.cohortId, req.user);
    if (!a?.manager) return fail(res, 403, 'Only the programme Tutor or Admin may mark attendance.');
    if (typeof req.body?.present !== 'boolean') return fail(res, 400, 'present must be a boolean.');
    const session = await prisma.programmeAttendanceSession.findFirst({ where: { id: req.params.sessionId, cohortId: a.cohort.id }, select: { id: true } });
    if (!session) return fail(res, 404, 'Session not found.');
    const eligible = await prisma.programmeApplication.findFirst({ where: { cohortId: a.cohort.id, applicantId: req.params.applicantId, state: 'ACCEPTED', paidAt: { not: null }, payments: { some: { status: 'SUCCESS' } } }, select: { id: true } });
    if (!eligible) return fail(res, 409, 'Applicant does not have verified programme enrollment.');
    const record = await prisma.programmeAttendanceRecord.upsert({
      where: { sessionId_applicantId: { sessionId: session.id, applicantId: req.params.applicantId } },
      create: { sessionId: session.id, applicantId: req.params.applicantId, present: req.body.present },
      update: { present: req.body.present, markedAt: new Date() }
    });
    return res.json({ record });
  } catch (e) { next(e); }
});
export default router;
