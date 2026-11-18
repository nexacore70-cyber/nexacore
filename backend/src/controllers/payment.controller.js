import "dotenv/config";
import { prisma } from "../db.js";
import { amountDue, getPricedCourse, newPaymentReference } from "../data/course-pricing.js";

const PAYSTACK_BASE = "https://api.paystack.co";
function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    const error = new Error("Paystack is not configured. Add PAYSTACK_SECRET_KEY to backend/.env.");
    error.status = 503; throw error;
  }
  return key;
}
async function paystack(path, options = {}) {
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options, headers: { Authorization: `Bearer ${secretKey()}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.status) {
    const error = new Error(data.message || "Paystack request failed."); error.status = 502; throw error;
  }
  return data.data;
}
function handleError(res, error) {
  console.error("Payment operation failed:", error.message);
  return res.status(error.status || 500).json({ message: error.status ? error.message : "Payment could not be processed. Please try again." });
}


// Only real verified Tutors assigned to this course are displayed.
export async function listCourseTutors(req, res) {
  try {
    const courseId = Number(req.params.courseId);
    if (!Number.isSafeInteger(courseId) || !getPricedCourse(courseId)) return res.status(404).json({ message: "Course not found." });
    const assignments = await prisma.courseTutor.findMany({
      where: { courseId, tutor: { role: "TUTOR", status: "ACTIVE", emailVerifiedAt: { not: null } } },
      include: { tutor: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });
    return res.json({ tutors: assignments.map(({ tutor }) => ({ id: tutor.id, name: tutor.fullName })) });
  } catch (error) { return handleError(res, error); }
}

export async function initializePayment(req, res) {
  try {
    if (req.user.role !== "STUDENT") return res.status(403).json({ message: "Only student accounts can enrol in courses." });
    const course = getPricedCourse(req.body?.courseId);
    if (!course) return res.status(400).json({ message: "Choose a valid course." });
    const plan = String(req.body?.plan || "full");
    if (!["full", "two-part", "three-part"].includes(plan)) return res.status(400).json({ message: "Choose a valid payment plan." });
    const currency = String(req.body?.currency || "NGN").toUpperCase();
    if (currency !== "NGN") return res.status(400).json({ message: "Paystack checkout currently supports NGN payments only." });
    const tutorId = String(req.body?.tutorId || "").trim();
    if (!tutorId) return res.status(400).json({ message: "Choose a Tutor before paying." });
    const assignment = await prisma.courseTutor.findUnique({
      where: { courseId_tutorId: { courseId: course.id, tutorId } }, include: { tutor: true },
    });
    if (!assignment || assignment.tutor.role !== "TUTOR" || assignment.tutor.status !== "ACTIVE" || !assignment.tutor.emailVerifiedAt)
      return res.status(409).json({ message: "This Tutor is not currently approved to teach the course." });
    const enrollment = await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: req.user.id, courseId: course.id } },
      create: { userId: req.user.id, courseId: course.id, tutorId, plan, currency },
      update: {},
    });
    // Tutor choice becomes immutable once checkout starts, including installment payments.
    if (enrollment.tutorId && enrollment.tutorId !== tutorId)
      return res.status(409).json({ message: "This course enrollment is assigned to another Tutor. Contact support to change it." });
    if (!enrollment.tutorId) {
      const existingPayments = await prisma.payment.count({ where: { enrollmentId: enrollment.id } });
      if (existingPayments) return res.status(409).json({ message: "Existing enrollment needs an administrator to confirm its Tutor before another payment." });
      await prisma.enrollment.update({ where: { id: enrollment.id }, data: { tutorId } });
    }
    if (enrollment.accessActive || enrollment.amountPaid >= course.amount) return res.status(409).json({ message: "This course has already been paid in full." });
    const amount = amountDue(course, plan, enrollment.amountPaid);
    if (!Number.isSafeInteger(amount) || amount <= 0) return res.status(400).json({ message: "There is no outstanding payment for this course." });
    if (enrollment.plan !== plan) await prisma.enrollment.update({ where: { id: enrollment.id }, data: { plan } });
    const platform = await prisma.user.findUnique({ where: { email: process.env.NEXACORE_PLATFORM_ACCOUNT_EMAIL || "" } });
    if (!platform || platform.role !== "ADMIN") return res.status(503).json({ message: "Platform settlement account is not configured." });
    const reference = newPaymentReference();
    await prisma.payment.create({ data: { userId: req.user.id, enrollmentId: enrollment.id, reference, amountKobo: amount * 100, currency, status: "PENDING" } });
    const initialized = await paystack("/transaction/initialize", { method: "POST", body: JSON.stringify({
      email: req.user.email, amount: amount * 100, currency, reference,
      callback_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/student/payments?course=${course.id}`,
      metadata: { userId: req.user.id, enrollmentId: enrollment.id, courseId: course.id, tutorId, plan },
    }) });
    return res.json({ authorizationUrl: initialized.authorization_url, reference, amount, currency, courseId: course.id });
  } catch (error) { return handleError(res, error); }
}

export async function verifyPayment(req, res) {
  try {
    const reference = String(req.body?.reference || req.query?.reference || "").trim();
    if (!reference || reference.length > 150) return res.status(400).json({ message: "A valid payment reference is required." });
    const payment = await prisma.payment.findUnique({ where: { reference }, include: { enrollment: true } });
    if (!payment || payment.userId !== req.user.id) return res.status(404).json({ message: "Payment reference not found." });
    if (payment.status === "SUCCESS") {
      return res.json({ verified: true, courseId: payment.enrollment.courseId, amountPaid: payment.enrollment.amountPaid, accessActive: payment.enrollment.accessActive, status: payment.enrollment.status });
    }
    const transaction = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (transaction.status !== "success" || transaction.reference !== payment.reference || transaction.amount !== payment.amountKobo || transaction.currency !== payment.currency) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
      return res.status(400).json({ verified: false, message: "Paystack could not confirm this payment." });
    }
    if (transaction.metadata?.userId !== req.user.id || transaction.metadata?.enrollmentId !== payment.enrollmentId || transaction.metadata?.tutorId !== payment.enrollment.tutorId) return res.status(400).json({ verified: false, message: "Payment metadata did not match this account." });
    const course = getPricedCourse(payment.enrollment.courseId);
    if (!course) return res.status(400).json({ message: "Course is no longer available." });
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.payment.findUnique({ where: { id: payment.id }, include: { enrollment: true } });
      if (current.status === "SUCCESS") return current;
      const tutor = current.enrollment.tutorId ? await tx.courseTutor.findUnique({ where: { courseId_tutorId: { courseId: current.enrollment.courseId, tutorId: current.enrollment.tutorId } }, include: { tutor: true } }) : null;
      const platform = await tx.user.findUnique({ where: { email: process.env.NEXACORE_PLATFORM_ACCOUNT_EMAIL || "" } });
      if (!tutor || tutor.tutor.role !== "TUTOR" || !platform || platform.role !== "ADMIN") throw new Error("Payment allocation cannot be recorded: missing Tutor or platform account.");
      const platformShare = Math.floor(transaction.amount * 40 / 100);
      await tx.paymentAllocation.createMany({ data: [
        { paymentId: current.id, recipientId: platform.id, kind: "PLATFORM_COURSE", amountKobo: platformShare },
        { paymentId: current.id, recipientId: tutor.tutorId, kind: "TUTOR_COURSE", amountKobo: transaction.amount - platformShare },
      ], skipDuplicates: true });
      // The tutor's wallet is credited exactly once, inside the same transaction
      // as the payment SUCCESS transition. All allocations remain auditable.
      // Payment status is checked under a conditional update before wallet credit.
      const nextPaid = Math.min(course.amount, current.enrollment.amountPaid + Math.floor(transaction.amount / 100));
      const fullyPaid = nextPaid >= course.amount;
      const claimed = await tx.payment.updateMany({ where: { id: current.id, status: { not: "SUCCESS" } }, data: { status: "SUCCESS", verifiedAt: new Date() } });
      if (claimed.count !== 1) return await tx.payment.findUnique({ where: { id: current.id }, include: { enrollment: true } });
      await tx.tutorWallet.upsert({
        where: { userId: tutor.tutorId },
        create: { userId: tutor.tutorId, availableKobo: BigInt(transaction.amount - platformShare) },
        update: { availableKobo: { increment: BigInt(transaction.amount - platformShare) } },
      });
      const updatedEnrollment = await tx.enrollment.update({ where: { id: current.enrollmentId }, data: { amountPaid: nextPaid, status: fullyPaid ? "PAID" : "PARTIALLY_PAID", accessActive: true } });
      return { ...current, enrollment: updatedEnrollment };
    });
    return res.json({ verified: true, courseId: result.enrollment.courseId, amountPaid: result.enrollment.amountPaid, accessActive: result.enrollment.accessActive, status: result.enrollment.status, coursePrice: course.amount });
  } catch (error) { return handleError(res, error); }
}

export async function getMyEnrollments(req, res) {
  try {
    const enrollments = await prisma.enrollment.findMany({ where: { userId: req.user.id }, include: { selectedTutor: { select: { id: true, fullName: true } }, payments: { orderBy: { createdAt: "desc" }, select: { reference: true, amountKobo: true, currency: true, status: true, verifiedAt: true, createdAt: true } } }, orderBy: { updatedAt: "desc" } });
    return res.json({ enrollments });
  } catch (error) { return handleError(res, error); }
}
