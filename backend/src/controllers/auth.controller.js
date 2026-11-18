import crypto from "node:crypto";
import bcrypt from "bcrypt";
import validator from "validator";
import { prisma } from "../db.js";
import { sendVerificationEmail } from "../utils/email.js";
import { getPricedCourse } from "../data/course-pricing.js";

export const register = async (req, res) => {

  try {
    const fullName =
      typeof req.body.fullName === "string"
        ? req.body.fullName.trim()
        : "";

    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const password = req.body.password;

    // Identity is created without any role, course, or assessment.
    if (!fullName || !email || typeof password !== "string") {
      return res.status(400).json({
        message: "Full name, email, and password are required.",
      });
    }

    if (fullName.length > 100) {
      return res.status(400).json({
        message: "Full name must be 100 characters or fewer.",
      });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({
        message: "Enter a valid email address.",
      });
    }

    if (
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and no more than 72 bytes.",
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        passwordHash,
        role: null,
      },
    });


    const rawToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    await prisma.emailVerificationToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    try {
      await sendVerificationEmail({
        email: user.email,
        fullName: user.fullName,
        token: rawToken,
      });
    } catch (mailError) {
      console.error("Verification delivery failed:", mailError);
      return res.status(503).json({
        message: "Account created, but verification email could not be delivered. Use Resend verification when email service is available.",
        verificationPending: true,
      });
    }


    return res.status(201).json({
      message:
        "Account created. Check your email for a verification link.",
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    // Never delete an account after a mail transport failure. A pending
    // account can request a new verification token safely.
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration failed:", {
  name: error.name,
  message: error.message,
  code: error.code,
  cause: error.cause,
  stack: error.stack,
});

    if (
      error.message?.startsWith("Missing email configuration:") ||
      error.code === "EAUTH" ||
      error.code === "ECONNECTION" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ESOCKET" ||
      error.code === "ENETUNREACH"
    ) {
      return res.status(503).json({
        message:
          "Email delivery is not configured or is temporarily unavailable. Please try again later.",
      });
    }

    return res.status(500).json({
      message: "Registration could not be completed.",
    });
  }
};

export const verifyEmail = async (req, res) => {
  const frontendUrl = (
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");

  try {
    const token = req.query.token;

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.redirect(
        `${frontendUrl}/verify-email?status=invalid`
      );
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const now = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const verificationToken =
        await tx.emailVerificationToken.findUnique({
          where: { tokenHash },
        });

      if (
        !verificationToken ||
        verificationToken.usedAt ||
        verificationToken.expiresAt <= now
      ) {
        return null;
      }

      const claimed = await tx.emailVerificationToken.updateMany({
        where: {
          id: verificationToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        return null;
      }

      const user = await tx.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerifiedAt: now,
          status: "ACTIVE",
        },
        select: { role: true },
      });

      return { verified: true, role: user.role };
    });

    if (!result?.verified) {
      return res.redirect(`${frontendUrl}/verify-email?status=invalid`);
    }
    const roleQuery = result.role
      ? `&role=${encodeURIComponent(String(result.role).toLowerCase())}`
      : "";
    return res.redirect(`${frontendUrl}/verify-email?status=success${roleQuery}`);
  } catch (error) {
    console.error("Email verification failed:", error.message);

    return res.redirect(
      `${frontendUrl}/verify-email?status=error`
    );
  }
};

// Re-send verification only for accounts that have not yet been verified.
// The response is deliberately generic to avoid disclosing registered addresses.
export const resendVerificationEmail = async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!validator.isEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
  const responseMessage = "If an unverified account exists, a verification email will be sent.";
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.emailVerifiedAt) return res.json({ message: responseMessage });
    const latest = await prisma.emailVerificationToken.findFirst({
      where: { userId: user.id }, orderBy: { expiresAt: "desc" },
    });
    // Limit requests to once per minute, including failed delivery attempts.
    if (latest && latest.expiresAt > new Date(Date.now() + 29 * 60 * 1000)) {
      return res.status(429).json({ message: "Please wait one minute before requesting another email." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.emailVerificationToken.create({ data: {
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }});
    await sendVerificationEmail({ email: user.email, fullName: user.fullName, token });
    return res.json({ message: responseMessage });
  } catch (error) {
    console.error("Resend verification failed:", error.message);
    return res.status(503).json({ message: "Unable to send email. Please check the email service configuration and try again." });
  }
};
