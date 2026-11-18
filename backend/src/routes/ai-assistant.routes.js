import { Router } from "express";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/auth.middleware.js";

const router = Router();
router.use(requireAuth);
const reject = (res, code, message) => res.status(code).json({ message });

async function permitted(userId, contextType, contextId) {
  if (contextType === "personal") return contextId === userId;
  if (contextType === "call") {
    const call = await prisma.siteCall.findUnique({ where: { id: contextId }, select: { callerId: true, recipientId: true, status: true } });
    return Boolean(call && call.status === "ACTIVE" && [call.callerId, call.recipientId].includes(userId));
  }
  if (contextType === "classroom") {
    const cohort = await prisma.programmeCohort.findUnique({ where: { id: contextId }, select: { tutorId: true, applications: { where: { state: "ACCEPTED" }, select: { applicantId: true } } } });
    return Boolean(cohort && (cohort.tutorId === userId || cohort.applications.some(a => a.applicantId === userId)));
  }
  return false;
}

router.get("/me", (req, res) => res.json({ userId: req.user.id }));

router.post("/ask", async (req, res, next) => {
  try {
    const { contextType, contextId, question } = req.body || {};
    if (!["call", "classroom", "personal"].includes(contextType) || typeof contextId !== "string" || contextId.length > 100 || typeof question !== "string" || question.trim().length < 3 || question.length > 2000) {
      return reject(res, 400, "Enter a question (3–2000 characters) and a valid session.");
    }
    if (!(await permitted(req.user.id, contextType, contextId))) return reject(res, 403, "You do not have access to this AI session.");
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return reject(res, 503, "AI assistant is not configured by the site administrator.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", temperature: 0.3, max_tokens: 650,
          messages: [
            { role: "system", content: "You are the NexaCore AI assistant available to every authenticated account role. Help with learning, tutoring, hiring, projects, proposals, portfolios, client work, internships, bootcamps, planning and general questions. Answer clearly and concisely. If uncertain, say so. You only know what the user types; you cannot hear the meeting, see the screen, or access recordings. Do not claim otherwise." },
            { role: "user", content: question.trim() }
          ] })
      });
    } finally { clearTimeout(timer); }
    if (!response.ok) { console.error("AI upstream error", response.status); return reject(res, 502, "AI assistant is temporarily unavailable."); }
    const result = await response.json();
    const answer = result?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) return reject(res, 502, "AI returned no answer.");
    res.set("Cache-Control", "no-store");
    return res.json({ answer: answer.slice(0, 8000) });
  } catch (error) {
    if (error?.name === "AbortError") return reject(res, 504, "AI request timed out.");
    next(error);
  }
});
export default router;
