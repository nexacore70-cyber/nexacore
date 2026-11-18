import programmeAttendanceRoutes from './routes/programme-attendance.routes.js';
import programmeWorkspaceRoutes from './routes/programme-workspace.routes.js';

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { prisma } from "./db.js";
import authRoutes from "./routes/auth.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import { requireOnboardedWhenAuthenticated } from "./middleware/require-onboarded.middleware.js";
import paymentRoutes from "./routes/payment.routes.js";
import marketplacePaymentRoutes from "./routes/marketplace-payment.routes.js";
import tutorAssessmentRoutes from './routes/tutorAssessment.routes.js';

import adminAuthRoutes from "./routes/admin-auth.routes.js";
import adminControlRoutes from "./routes/adminControl.routes.js";
import adminFinanceRoutes from "./routes/adminFinance.routes.js";
import communityRoutes from "./routes/community.routes.js";
import challengeRoutes from "./routes/challenge.routes.js";
import portfolioRoutes from "./routes/portfolio.routes.js";
import hiringRoutes from "./routes/hiring.routes.js";
import hiringContractRoutes from "./routes/hiring-contract.routes.js";

import programmeRoutes from "./routes/programme.routes.js";
import programmePaymentRoutes from "./routes/programme-payment.routes.js";
import adminProgrammeRoutes from "./routes/adminProgramme.routes.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", process.env.NODE_ENV === "production" ? 1 : false);

app.use(helmet());

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",").map(value => value.trim().replace(/\/$/, "")).filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS origin not allowed"));
  },
  credentials: true,
}));

app.use(express.json({ limit: "1mb" }));

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  })
);

app.get("/", (_req, res) => {
  res.json({
    name: "NexaCore API",
    status: "running",
  });
});

app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      status: "error",
      database: "unavailable",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/programme-workspace", programmeWorkspaceRoutes);
app.use("/api/programme-attendance", programmeAttendanceRoutes);
app.use("/api/programmes", programmeRoutes);
app.use("/api/programme-payments", programmePaymentRoutes);
app.use("/api/admin/programmes", adminProgrammeRoutes);
app.use("/api", requireOnboardedWhenAuthenticated);
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/control", adminControlRoutes);
app.use("/api/admin/finance", adminFinanceRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/challenges", challengeRoutes);
app.use("/api/portfolios", portfolioRoutes);
app.use("/api/hiring", hiringRoutes);
app.use("/api/hiring-contracts", hiringContractRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/marketplace", marketplacePaymentRoutes);
app.use('/api/tutor-assessments', tutorAssessmentRoutes);



// Do not leak stack traces or internal configuration to clients.
app.use((err, _req, res, _next) => {
  console.error("Request failed:", err.message);
  res.status(err.message === "CORS origin not allowed" ? 403 : 500).json({ message: "Request could not be completed." });
});

export default app;
