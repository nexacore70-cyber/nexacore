
import { Router } from "express";

import {
  register,
  verifyEmail,
  resendVerificationEmail,
} from "../controllers/auth.controller.js";

import {
  login,
  getMe,
  logout,
} from "../controllers/session.controller.js";

import {
  forgotPassword,
  resetPassword,
} from "../controllers/password.controller.js";

import { requireAuth } from "../middleware/auth.middleware.js";
import { deleteMyAccount } from "../controllers/account.controller.js";

import oauthRoutes from "./oauth.routes.js";
const router = Router();
router.use("/oauth", oauthRoutes);

// Registration and email verification
router.post("/register", register);
router.get("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);

// Login and session
router.post("/login", login);
router.get("/me", requireAuth, getMe);
router.post("/logout", requireAuth, logout);

// Password recovery
router.post("/password/forgot", forgotPassword);
router.post("/password/reset", resetPassword);
router.delete("/account", requireAuth, deleteMyAccount);

export default router;
