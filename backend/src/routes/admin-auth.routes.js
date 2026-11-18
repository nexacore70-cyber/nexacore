import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";
import { prisma } from "../db.js";

const router = Router();
const cookieName = "nexacore_admin_sid";
const isProd = process.env.NODE_ENV === "production";
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex");
// Cross-site frontend/backend deployments require SameSite=None and HTTPS.
// Same-site deployments can retain Lax.
const sameSite = process.env.ADMIN_COOKIE_SAMESITE === "none" ? "none" : "lax";
const cookieOptions = { httpOnly: true, secure: isProd || sameSite === "none", sameSite, path: "/api/admin", maxAge: 12 * 60 * 60 * 1000 };
const cookie = (req) => {
  const pair = String(req.headers.cookie || "").split(";").map(s => s.trim()).find(s => s.startsWith(cookieName + "="));
  return pair ? pair.slice(cookieName.length + 1) : "";
};
const view = (user) => ({ sessionId: "server-managed", staffId: user.id, name: user.fullName, email: user.email, role: "SUPER_ADMIN", permissions: [], previewMode: false });

router.post("/login", rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-7", legacyHeaders: false }), async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password ?? req.body?.accessCode;
    if (!email || typeof password !== "string" || !password || password.length > 1024) return res.status(400).json({ message: "Enter email and password." });
    const user = await prisma.user.findUnique({ where: { email } });
    const valid = user && await bcrypt.compare(password, user.passwordHash);
    if (!valid || user.role !== "ADMIN" || user.status !== "ACTIVE" || !user.emailVerifiedAt) return res.status(401).json({ message: "Administrator authentication failed." });
    const token = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + cookieOptions.maxAge);
    await prisma.session.create({ data: { userId: user.id, tokenHash: hash(token), expiresAt } });
    res.cookie(cookieName, token, cookieOptions);
    return res.json({ session: view(user) });
  } catch (e) { console.error("Admin login error:", e); return res.status(500).json({ message: "Admin login is temporarily unavailable." }); }
});

export async function getAdmin(req) {
  const token = cookie(req);
  if (!/^[a-f0-9]{96}$/.test(token)) return null;
  const session = await prisma.session.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date() || session.user.role !== "ADMIN" || session.user.status !== "ACTIVE" || !session.user.emailVerifiedAt) return null;
  return session.user;
}
router.get("/session", async (req, res) => {
  try { const user = await getAdmin(req); if (!user) return res.status(401).json({ message: "Not authenticated." }); return res.json({ session: view(user) }); }
  catch (e) { console.error("Admin session error:", e); return res.status(500).json({ message: "Session unavailable." }); }
});
router.post("/logout", async (req, res) => {
  try { const token = cookie(req); if (/^[a-f0-9]{96}$/.test(token)) await prisma.session.deleteMany({ where: { tokenHash: hash(token) } }); }
  catch (e) { console.error("Admin logout error:", e); }
  res.clearCookie(cookieName, { httpOnly: true, secure: isProd, sameSite, path: "/api/admin" });
  return res.json({ message: "Signed out." });
});
export default router;
