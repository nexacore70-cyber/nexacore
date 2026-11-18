import crypto from "node:crypto";
import bcrypt from "bcrypt";
import validator from "validator";
import { prisma } from "../db.js";
import { sendPasswordResetEmail } from "../utils/email.js";

const RESET_LIFETIME_MS = 30 * 60 * 1000;

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function forgotPassword(req, res) {
  try {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        message: "Enter a valid email address.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Use the same public response whether the account exists or not.
    const genericResponse = {
      message:
        "If an eligible account exists for that email, a password-reset link will be sent.",
    };

    if (!user || !user.emailVerifiedAt || user.status !== "ACTIVE") {
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_LIFETIME_MS);

    await prisma.$transaction(async (tx) => {
      // Make previously issued, unused reset links unusable.
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: { usedAt: new Date() },
      });

      await tx.passwordResetToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt,
        },
      });
    });

    try {
      await sendPasswordResetEmail({
        email: user.email,
        fullName: user.fullName,
        token: rawToken,
      });
    } catch (emailError) {
      // Never log the raw reset token.
      console.error(
        "Password-reset email delivery failed:",
        emailError.message
      );

      // Invalidate the token if delivery failed.
      await prisma.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null },
        data: { usedAt: new Date() },
      });

      return res.status(503).json({
        message: "The password service is temporarily unavailable.",
      });
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Forgot-password request failed:", error.message);

    return res.status(500).json({
      message: "The password service is temporarily unavailable.",
    });
  }
}

export async function resetPassword(req, res) {
  try {
    const token =
      typeof req.body?.token === "string"
        ? req.body.token.trim()
        : "";

    const password = req.body?.password;

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).json({
        message: "This password-reset link is invalid or has expired.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return res.status(400).json({
        message:
          "Password must contain at least 8 characters, including uppercase and lowercase letters, a number, and a symbol. It must not exceed 72 bytes.",
      });
    }

    const tokenHash = hashToken(token);
    const now = new Date();

    // Hash before the transaction so the transaction stays short.
    const passwordHash = await bcrypt.hash(password, 12);

    const changed = await prisma.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (
        !resetToken ||
        resetToken.usedAt ||
        resetToken.expiresAt <= now
      ) {
        return false;
      }

      // Claim the token atomically: only one request can use it.
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        return false;
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      // End all existing sessions after a password change.
      await tx.session.deleteMany({
        where: { userId: resetToken.userId },
      });

      // Invalidate any other outstanding reset links.
      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
        },
        data: { usedAt: now },
      });

      return true;
    });

    if (!changed) {
      return res.status(400).json({
        message: "This password-reset link is invalid or has expired.",
      });
    }

    return res.status(200).json({
      message: "Password updated successfully. Please sign in.",
    });
  } catch (error) {
    console.error("Password reset failed:", error.message);

    return res.status(500).json({
      message: "Your password could not be reset. Please try again.",
    });
  }
}