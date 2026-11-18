import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
router.use(requireAuth);
const error = (res, status, message) => res.status(status).json({ message });
const paid = async (tx, cohortId, userId) => tx.programmeApplication.findFirst({
  where: { cohortId, applicantId: userId, state: 'ACCEPTED', paidAt: { not: null }, payments: { some: { status: 'SUCCESS' } } },
  select: { id: true }
});
async function permission(cohortId, user) {
  const cohort = await prisma.programmeCohort.findUnique({ where: { id: cohortId }, select: { id: true, tutorId: true, kind: true, title: true } });
  if (!cohort) return null;
  const manager = cohort.tutorId === user.id || user.role === 'ADMIN';
  const enrollment = manager ? null : await paid(prisma, cohortId, user.id);
  return { cohort, manager, enrollment, allowed: manager || Boolean(enrollment) };
}
router.get('/:cohortId', async (req, res, next) => {
  try {
    const access = await permission(req.params.cohortId, req.user);
    if (!access?.allowed) return error(res, 403, 'Verified programme enrollment or Tutor access required.');
    const assignments = await prisma.programmeAssignment.findMany({ where: { cohortId: access.cohort.id }, orderBy: { createdAt: 'asc' }, include: { submissions: { where: access.manager ? {} : { applicantId: req.user.id }, select: { id: true, applicantId: true, content: true, feedback: true, score: true, submittedAt: true, reviewedAt: true } } } });
    return res.json({ programme: access.cohort, manager: access.manager, assignments });
  } catch (e) { next(e); }
});
router.post('/:cohortId/assignments', async (req, res, next) => {
  try {
    const access = await permission(req.params.cohortId, req.user);
    if (!access?.manager) return error(res, 403, 'Only this programme Tutor or Admin may create assignments.');
    const title = String(req.body?.title || '').trim();
    const instructions = String(req.body?.instructions || '').trim();
    if (!title || title.length > 160 || !instructions || instructions.length > 10000) return error(res, 400, 'Title and instructions required.');
    const assignment = await prisma.programmeAssignment.create({ data: { cohortId: access.cohort.id, title, instructions } });
    return res.status(201).json({ assignment });
  } catch (e) { next(e); }
});
router.post('/:cohortId/assignments/:assignmentId/submit', async (req, res, next) => {
  try {
    const access = await permission(req.params.cohortId, req.user);
    if (!access?.enrollment) return error(res, 403, 'Verified participant payment required.');
    const content = String(req.body?.content || '').trim();
    if (!content || content.length > 15000) return error(res, 400, 'Submission must contain 1–15000 characters.');
    const assignment = await prisma.programmeAssignment.findFirst({ where: { id: req.params.assignmentId, cohortId: access.cohort.id }, select: { id: true } });
    if (!assignment) return error(res, 404, 'Assignment not found.');
    const submission = await prisma.programmeSubmission.upsert({ where: { assignmentId_applicantId: { assignmentId: assignment.id, applicantId: req.user.id } }, create: { assignmentId: assignment.id, applicantId: req.user.id, content }, update: { content, feedback: null, score: null, reviewedAt: null, submittedAt: new Date() } });
    return res.json({ submission });
  } catch (e) { next(e); }
});
router.patch('/:cohortId/submissions/:submissionId/review', async (req, res, next) => {
  try {
    const access = await permission(req.params.cohortId, req.user);
    if (!access?.manager) return error(res, 403, 'Tutor or Admin access required.');
    const feedback = String(req.body?.feedback || '').trim();
    const score = req.body?.score;
    if (feedback.length > 10000 || (score !== null && score !== undefined && (!Number.isInteger(score) || score < 0 || score > 100))) return error(res, 400, 'Invalid feedback or score.');
    const submission = await prisma.programmeSubmission.findFirst({ where: { id: req.params.submissionId, assignment: { cohortId: access.cohort.id } } });
    if (!submission) return error(res, 404, 'Submission not found.');
    const updated = await prisma.programmeSubmission.update({ where: { id: submission.id }, data: { feedback, score: score ?? null, reviewedAt: new Date() } });
    return res.json({ submission: updated });
  } catch (e) { next(e); }
});
export default router;
