import "dotenv/config";
import nodemailer from "nodemailer";

const requiredSettings = [
  "EMAIL_HOST",
  "EMAIL_USER",
  "EMAIL_PASSWORD",
  "EMAIL_FROM",
];

export async function sendVerificationEmail({ email, fullName, token }) {
  const missing = requiredSettings.filter(
    (setting) => !process.env[setting]
  );

  if (missing.length > 0) {
    throw new Error(`Missing email configuration: ${missing.join(", ")}`);
  }

  const port = Number(process.env.EMAIL_PORT || 587);
  const secure = process.env.EMAIL_SECURE === "true";

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const verificationUrl =
    `${process.env.API_URL || "http://localhost:4000"}` +
    `/api/auth/verify-email?token=${encodeURIComponent(token)}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify your NexaCore account",
    text:
      `Hello ${fullName},\n\n` +
      `Verify your NexaCore account using this link:\n${verificationUrl}\n\n` +
      "This link expires in 30 minutes. If you did not create this account, ignore this email.",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Welcome to NexaCore, ${escapeHtml(fullName)}!</h2>
        <p>Please verify your email address to activate your account.</p>
        <p>
          <a href="${verificationUrl}"
             style="display:inline-block;padding:12px 20px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;">
            Verify email address
          </a>
        </p>
        <p>This link expires in 30 minutes.</p>
        <p>If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

export async function sendPasswordResetEmail({ email, fullName, token }) {
  const missing = requiredSettings.filter(
    (setting) => !process.env[setting]
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing email configuration: ${missing.join(", ")}`
    );
  }

  const port = Number(process.env.EMAIL_PORT || 587);
  const secure = process.env.EMAIL_SECURE === "true";

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  const frontendUrl = (
    process.env.FRONTEND_URL || "http://localhost:5173"
  ).replace(/\/+$/, "");

  const resetUrl =
    `${frontendUrl}/reset-password?token=` +
    encodeURIComponent(token);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Reset your NexaCore password",
    text:
      `Hello ${fullName},\n\n` +
      `Use this link to reset your NexaCore password:\n${resetUrl}\n\n` +
      "This link expires in 30 minutes and can only be used once. " +
      "If you did not request a password reset, ignore this email.",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>Password reset</h2>
        <p>Hello ${escapeHtml(fullName)},</p>
        <p>We received a request to reset your NexaCore password.</p>
        <p>
          <a href="${resetUrl}"
             style="display:inline-block;padding:12px 20px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px">
            Reset password
          </a>
        </p>
        <p>This link expires in 30 minutes and can only be used once.</p>
        <p>If you did not request this, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail({ email, fullName }) {
  const missing = requiredSettings.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing email configuration: ${missing.join(", ")}`);
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT || 587),
    secure: process.env.EMAIL_SECURE === "true",
    connectionTimeout: 10000,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD },
  });
  const url = (process.env.FRONTEND_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/+$/, "") + "/onboarding";
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Welcome to NexaCore — make your journey yours",
    text: `Hello ${fullName},\n\nWelcome to NexaCore! Your account is ready. Choose what you'd like to do, your interests, and complete your profile after signing in.\n\nGet started: ${url}\n\nThe NexaCore Team`,
    html: `<div style="background:#0a0a0a;padding:36px 18px;font-family:Arial,sans-serif;color:#f5f5f5"><div style="max-width:560px;margin:auto;background:#18181b;border-radius:18px;padding:32px"><h1 style="color:#ffffff">Welcome to <span style="color:#ef4444">NexaCore</span></h1><p>Hello ${escapeHtml(fullName)},</p><p>Your NexaCore account is ready. Choose your path, personalize your interests and build your profile.</p><p style="margin:32px 0"><a href="${url}" style="background:#dc2626;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Set up your account</a></p><p style="color:#a1a1aa;font-size:13px">You decide what to learn, teach, offer or hire. No role is selected for you.</p></div></div>`,
  });
}
