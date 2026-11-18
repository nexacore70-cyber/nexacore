import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth);
const fail = (res, error) => { console.error("Contract integration error:", error.message); return res.status(500).json({ message: "Contract request failed." }); };
const fields = { id: true, hiringRequestId: true, clientId: true, talentId: true, title: true, amountKobo: true, currency: true, status: true, paidAt: true, approvedAt: true, createdAt: true };

// The Client can turn an accepted invitation into one unpaid contract.
// A unique DB constraint prevents duplicate contracts even under concurrent requests.
router.post("/from-hiring/:hiringId", async (req, res) => {
  if (req.user.role !== "CLIENT") return res.status(403).json({ message: "Only Clients can create project contracts." });
  try {
    const hiring = await prisma.hiringRequest.findUnique({ where: { id: req.params.hiringId } });
    if (!hiring || hiring.clientId !== req.user.id) return res.status(404).json({ message: "Hiring request not found." });
    if (hiring.status !== "ACCEPTED") return res.status(409).json({ message: "The invitation must be accepted first." });
    const existing = await prisma.projectContract.findUnique({ where: { hiringRequestId: hiring.id }, select: fields });
    if (existing) return res.json({ contract: existing, alreadyCreated: true });
    const provider = await prisma.user.findUnique({ where: { id: hiring.providerId }, select: { id: true, role: true, status: true, emailVerifiedAt: true } });
    if (!provider || !["TALENT", "TUTOR"].includes(provider.role) || provider.status !== "ACTIVE" || !provider.emailVerifiedAt) return res.status(409).json({ message: "Professional account is not currently eligible." });
    try {
      const contract = await prisma.projectContract.create({ data: { hiringRequestId: hiring.id, clientId: hiring.clientId, talentId: hiring.providerId, title: hiring.title, amountKobo: hiring.budgetKobo, currency: "NGN", status: "AWAITING_PAYMENT" }, select: fields });
      return res.status(201).json({ contract, alreadyCreated: false });
    } catch (error) {
      if (error.code === "P2002") {
        const contract = await prisma.projectContract.findUnique({ where: { hiringRequestId: hiring.id }, select: fields });
        if (contract) return res.json({ contract, alreadyCreated: true });
      }
      throw error;
    }
  } catch (error) { return fail(res, error); }
});

router.get("/mine", async (req, res) => {
  try {
    const contracts = await prisma.projectContract.findMany({ where: { OR: [{ clientId: req.user.id }, { talentId: req.user.id }] }, select: fields, orderBy: { createdAt: "desc" }, take: 100 });
    return res.json({ contracts });
  } catch (error) { return fail(res, error); }
});

export default router;
