import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth);
const clean = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";
const fail = (res, e) => { console.error("Hiring API error:", e.message); return res.status(500).json({ message: "Hiring request failed." }); };
const isClient = u => u.role === "CLIENT";
const isProvider = u => ["TALENT", "TUTOR"].includes(u.role);
const fields = { id: true, clientId: true, providerId: true, title: true, description: true, budgetKobo: true, currency: true, status: true, createdAt: true, updatedAt: true, client: { select: { id: true, fullName: true } }, provider: { select: { id: true, fullName: true } } };

router.get("/mine", async (req, res) => {
  try {
    const requests = await prisma.hiringRequest.findMany({
      where: { OR: [{ clientId: req.user.id }, { providerId: req.user.id }] },
      select: fields, orderBy: { createdAt: "desc" }, take: 100
    });
    res.json({ requests });
  } catch (e) { fail(res, e); }
});

router.post("/", async (req, res) => {
  if (!isClient(req.user)) return res.status(403).json({ message: "Only Client accounts can send hiring requests." });
  const providerId = clean(req.body?.providerId, 100);
  const title = clean(req.body?.title, 120);
  const description = clean(req.body?.description, 3000);
  const budgetKobo = req.body?.budgetKobo;
  if (!providerId || title.length < 5 || description.length < 20 || !Number.isSafeInteger(budgetKobo) || budgetKobo < 10000 || budgetKobo > 2000000000)
    return res.status(400).json({ message: "Provide a provider, title, description and budget of at least NGN 100." });
  if (providerId === req.user.id) return res.status(400).json({ message: "You cannot hire yourself." });
  try {
    const provider = await prisma.user.findFirst({ where: { id: providerId, status: "ACTIVE", emailVerifiedAt: { not: null }, role: { in: ["TALENT", "TUTOR"] }, portfolioProfile: { is: { availableForHire: true } } }, select: { id: true } });
    if (!provider) return res.status(404).json({ message: "This professional is not available for hire." });
    const request = await prisma.hiringRequest.create({ data: { clientId: req.user.id, providerId, title, description, budgetKobo }, select: fields });
    res.status(201).json({ request });
  } catch (e) { fail(res, e); }
});

router.patch("/:id/decision", async (req, res) => {
  if (!isProvider(req.user)) return res.status(403).json({ message: "Only the invited professional may respond." });
  const status = req.body?.status;
  if (!["ACCEPTED", "DECLINED"].includes(status)) return res.status(400).json({ message: "Choose ACCEPTED or DECLINED." });
  try {
    const updated = await prisma.hiringRequest.updateMany({ where: { id: req.params.id, providerId: req.user.id, status: "PENDING" }, data: { status } });
    if (!updated.count) return res.status(409).json({ message: "Request unavailable or already answered." });
    res.json({ updated: true, status });
  } catch (e) { fail(res, e); }
});

router.patch("/:id/cancel", async (req, res) => {
  if (!isClient(req.user)) return res.status(403).json({ message: "Only the Client may cancel." });
  try {
    const updated = await prisma.hiringRequest.updateMany({ where: { id: req.params.id, clientId: req.user.id, status: "PENDING" }, data: { status: "CANCELLED" } });
    if (!updated.count) return res.status(409).json({ message: "Request unavailable or already answered." });
    res.json({ updated: true, status: "CANCELLED" });
  } catch (e) { fail(res, e); }
});
export default router;
