
import "dotenv/config";
import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import { prisma } from "../db.js";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }

  return secret;
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function login(req, res) {
  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const password = req.body.password;

    if (
      !validator.isEmail(email) ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        message: "Enter a valid email address and password.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Use the same message for unknown emails and incorrect passwords.
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        message: "Email or password is incorrect.",
      });
    }

    if (!user.emailVerifiedAt || user.status !== "ACTIVE") {
      return res.status(403).json({
        message: "Please verify your email before signing in.",
      });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sessionId = crypto.randomUUID();

    const token = jwt.sign(
      { sid: sessionId },
      getJwtSecret(),
      {
        algorithm: "HS256",
        subject: user.id,
        expiresIn: "7d",
      }
    );

    await prisma.session.create({
      data: {
        id: sessionId,
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt,
      },
    });

    return res.json({
      message: "Login successful.",
      token,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        onboardingCompletedAt: user.onboardingCompletedAt,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      message: "Login could not be completed.",
    });
  }
}

export async function getMe(req, res) {
  return res.json({ user: req.user });
}

export async function logout(req, res) {
  try {
    const authorization = req.headers.authorization;
    const token = authorization.slice("Bearer ".length).trim();

    await prisma.session.deleteMany({
      where: {
        tokenHash: hashToken(token),
        userId: req.user.id,
      },
    });

    return res.json({
      message: "You have been signed out.",
    });
  } catch (error) {
    console.error("Logout failed:", error.message);

    return res.status(500).json({
      message: "Logout could not be completed.",
    });
  }
}
