
import "dotenv/config";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }

  return secret;
}

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Please sign in to continue.",
      });
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      return res.status(401).json({
        message: "Please sign in to continue.",
      });
    }

    let payload;

    try {
      payload = jwt.verify(token, getJwtSecret(), {
        algorithms: ["HS256"],
      });
    } catch {
      return res.status(401).json({
        message: "Your session is invalid or has expired. Please sign in again.",
      });
    }

    if (
      typeof payload !== "object" ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string"
    ) {
      return res.status(401).json({
        message: "Invalid authentication token.",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !session ||
      session.id !== payload.sid ||
      session.userId !== payload.sub ||
      session.expiresAt <= new Date()
    ) {
      return res.status(401).json({
        message: "Your session is invalid or has expired. Please sign in again.",
      });
    }

    if (
      session.user.status !== "ACTIVE" ||
      !session.user.emailVerifiedAt
    ) {
      return res.status(403).json({
        message: "Your account is not active or your email is not verified.",
      });
    }

    req.user = {
      id: session.user.id,
      fullName: session.user.fullName,
      email: session.user.email,
      role: session.user.role,
      onboardingCompletedAt: session.user.onboardingCompletedAt,
      status: session.user.status,
    };

    req.sessionId = session.id;

    next();
  } catch (error) {
    console.error("Authentication middleware failed:", error.message);

    return res.status(500).json({
      message: "Authentication could not be completed.",
    });
  }
}
