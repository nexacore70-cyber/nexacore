import { Router } from "express";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "../db.js";
import { sendVerificationEmail, sendWelcomeEmail } from "../utils/email.js";

const router = Router();
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const random = () => crypto.randomBytes(32).toString("hex");
const frontend = () => (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/$/, "");
const backend = () => (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
const configs = {
  google: { clientId: "GOOGLE_CLIENT_ID", secret: "GOOGLE_CLIENT_SECRET", auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token", jwks: "https://www.googleapis.com/oauth2/v3/certs" },
  microsoft: { clientId: "MICROSOFT_CLIENT_ID", secret: "MICROSOFT_CLIENT_SECRET", auth: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", token: "https://login.microsoftonline.com/common/oauth2/v2.0/token", jwks: "https://login.microsoftonline.com/common/discovery/v2.0/keys" },
};
function config(provider) {
  const entry = configs[provider];
  if (!entry) return null;
  const clientId = process.env[entry.clientId], secret = process.env[entry.secret];
  return clientId && secret ? { ...entry, clientId, secret } : null;
}
function redirectError(res, message) { return res.redirect(`${frontend()}/oauth/callback?error=${encodeURIComponent(message)}`); }

router.get("/:provider/start", async (req, res) => {
  try {
    const provider = req.params.provider, c = config(provider);
    if (!c) return res.status(503).json({ message: "This sign-in provider is not configured." });
    const state = random();
    await prisma.oAuthFlow.create({ data: { stateHash: hash(state), provider, role: null, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    const params = new URLSearchParams({ client_id: c.clientId, response_type: "code", redirect_uri: `${backend()}/api/auth/oauth/${provider}/callback`, scope: "openid email profile", state, prompt: "select_account" });
    res.redirect(`${c.auth}?${params}`);
  } catch (error) { console.error("OAuth start:", error); res.status(500).json({ message: "Could not begin sign in." }); }
});

router.get("/:provider/callback", async (req, res) => {
  const provider = req.params.provider, c = config(provider);
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!c || !state || !code || state.length > 256 || code.length > 4096) return redirectError(res, "Sign-in was cancelled or invalid.");
  try {
    // Atomic state consumption blocks callback replay.
    const flow = await prisma.oAuthFlow.findUnique({ where: { stateHash: hash(state) } });
    if (!flow || flow.provider !== provider || flow.expiresAt < new Date()) return redirectError(res, "Sign-in request expired.");
    const claimed = await prisma.oAuthFlow.deleteMany({ where: { stateHash: hash(state), provider, expiresAt: { gt: new Date() } } });
    if (claimed.count !== 1) return redirectError(res, "Sign-in request already used.");
    const body = new URLSearchParams({ client_id: c.clientId, client_secret: c.secret, grant_type: "authorization_code", code, redirect_uri: `${backend()}/api/auth/oauth/${provider}/callback` });
    const response = await fetch(c.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return redirectError(res, "Identity provider could not verify sign-in.");
    const tokens = await response.json();
    if (typeof tokens.id_token !== "string") return redirectError(res, "Identity provider did not return identity proof.");
    const opts = { audience: c.clientId, clockTolerance: 30 };
    if (provider === "google") opts.issuer = ["https://accounts.google.com", "accounts.google.com"];
    const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(c.jwks)), opts);
    if (provider === "microsoft") {
      // The common endpoint is multi-tenant: constrain the issuer to the token's GUID tenant.
      if (typeof payload.tid !== "string" || !/^[0-9a-f-]{36}$/i.test(payload.tid) || payload.iss !== `https://login.microsoftonline.com/${payload.tid}/v2.0`) return redirectError(res, "Invalid Microsoft issuer.");
    }
    if (typeof payload.sub !== "string" || !payload.sub) return redirectError(res, "Identity subject missing.");
    const identity = await prisma.oAuthIdentity.findUnique({ where: { provider_subject: { provider, subject: payload.sub } }, include: { user: true } });
    let user = identity?.user;
    let createdNewUser = false;
    if (!user) {
      // Do not automatically link to an existing account based on email (account takeover risk).
      const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const emailVerified = provider === "google" ? payload.email_verified === true : false;
      if (!email) return redirectError(res, "Identity provider did not supply an email address.");
      if (await prisma.user.findUnique({ where: { email } })) return redirectError(res, "This email already has an account. Sign in using its existing method.");
      user = await prisma.user.create({ data: { email, fullName: String(payload.name || email.split("@")[0]).slice(0,100), passwordHash: await (await import("bcrypt")).default.hash(random(),12), role: null, status: emailVerified ? "ACTIVE" : "PENDING", emailVerifiedAt: emailVerified ? new Date() : null, oauthIdentities: { create: { provider, subject: payload.sub } } } });
      createdNewUser = true;
    }
    if (user.status !== "ACTIVE" || !user.emailVerifiedAt) {
      if (!user.emailVerifiedAt && provider === "microsoft") {
        const verificationToken = random();
        await prisma.emailVerificationToken.create({ data: { tokenHash: hash(verificationToken), userId: user.id, expiresAt: new Date(Date.now() + 30*60_000) } });
        try { await sendVerificationEmail({ email: user.email, fullName: user.fullName, token: verificationToken }); }
        catch (error) { console.error("Microsoft verification email failed:", error.message); return redirectError(res, "Account created, but verification email failed. Use resend verification."); }
        return redirectError(res, "Verify your email using the link we sent, then sign in again with Microsoft.");
      }
      return redirectError(res, "Account is not active.");
    }
    if (createdNewUser) {
      try { await sendWelcomeEmail({ email: user.email, fullName: user.fullName }); }
      catch (error) { console.error("OAuth welcome email delivery failed:", error.message); }
    }
    const ticket = random();
    await prisma.oAuthTicket.create({ data: { ticketHash: hash(ticket), userId: user.id, expiresAt: new Date(Date.now() + 60_000) } });
    res.redirect(`${frontend()}/oauth/callback?ticket=${encodeURIComponent(ticket)}`);
  } catch (error) { console.error("OAuth callback:", error); return redirectError(res, "Sign-in could not be completed."); }
});

router.post("/exchange", async (req, res) => {
  const ticket = req.body?.ticket;
  if (typeof ticket !== "string" || !/^[0-9a-f]{64}$/.test(ticket)) return res.status(400).json({ message: "Invalid sign-in ticket." });
  try {
    const record = await prisma.oAuthTicket.findUnique({ where: { ticketHash: hash(ticket) } });
    if (!record || record.expiresAt <= new Date()) return res.status(401).json({ message: "Sign-in ticket expired." });
    const claimed = await prisma.oAuthTicket.deleteMany({ where: { ticketHash: hash(ticket), expiresAt: { gt: new Date() } } });
    if (claimed.count !== 1) return res.status(401).json({ message: "Sign-in ticket already used." });
    const user = await prisma.user.findUnique({ where: { id: record.userId } });
    if (!user || user.status !== "ACTIVE" || !user.emailVerifiedAt) return res.status(403).json({ message: "Account is inactive." });
    const sessionId = crypto.randomUUID();
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) throw new Error("JWT_SECRET is not configured securely");
    const token = jwt.sign({ sid: sessionId }, secret, { algorithm: "HS256", subject: user.id, expiresIn: "7d" });
    const expiresAt = new Date(Date.now() + 7*24*60*60*1000);
    await prisma.session.create({ data: { id: sessionId, userId: user.id, tokenHash: hash(token), expiresAt } });
    return res.json({ token, expiresAt: expiresAt.toISOString(), user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role, status: user.status, onboardingCompletedAt: user.onboardingCompletedAt } });
  } catch (error) { console.error("OAuth exchange:", error); return res.status(500).json({ message: "Sign-in could not be completed." }); }
});
export default router;
