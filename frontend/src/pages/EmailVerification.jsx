import { useState } from "react";
import { resendVerificationEmail } from "../lib/api";

export default function EmailVerification() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") || "pending";
  let pending = null;
  try { pending = JSON.parse(window.sessionStorage.getItem("nexacore_pending_verification") || "null"); } catch {}
  const role = ["student", "tutor", "client", "talent"].includes(params.get("role") || pending?.role)
    ? (params.get("role") || pending?.role) : "";
  const [email, setEmail] = useState(pending?.email || "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const invalid = status === "invalid";
  const failed = status === "error";
  const verified = status === "success";
  const heading = invalid ? "Verification link expired" : failed ? "Verification could not be completed" : verified ? "Email verified" : "Check your email";
  const message = invalid ? "Your link is invalid or has expired. Request a new one below." : failed ? "We could not verify your email. Try the link again or request a new one." : verified ? "Your email has been verified. You can now sign in." : "We sent a verification link to your registered email address. Open the link to activate your account before signing in.";
  async function resend(event) {
    event.preventDefault(); setBusy(true); setNotice("");
    try { const result = await resendVerificationEmail(email); setNotice(result.message); }
    catch (error) { setNotice(error.message || "Could not send verification email."); }
    finally { setBusy(false); }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-5 py-12">
      <section className="w-full max-w-xl rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
        <a href="/" aria-label="NexaCore home"><img src="/images/logo/nexacore-logo-light.png" alt="NexaCore" className="mb-8 h-12 w-auto rounded bg-neutral-950 p-2" /></a>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Secure account verification</p>
        <h1 className="mt-3 text-3xl font-black text-neutral-950">{heading}</h1>
        <p className="mt-4 leading-7 text-neutral-600">{message}</p>
        {!verified && <form onSubmit={resend} className="mt-7 space-y-3">
          <label htmlFor="verification-email" className="block text-sm font-bold text-neutral-800">Email address</label>
          <input id="verification-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-neutral-300 px-4 py-3 text-neutral-950" />
          <button disabled={busy} type="submit" className="w-full rounded-2xl border border-red-600 px-5 py-3 font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{busy ? "Sending..." : "Resend verification email"}</button>
          <p className="text-sm text-neutral-500">Check your spam folder too. Verification links expire after 30 minutes.</p>
        </form>}
        {notice && <p role="status" className="mt-4 rounded-xl bg-neutral-100 p-4 text-sm text-neutral-800">{notice}</p>}
        <a href={role ? `/login?role=${encodeURIComponent(role)}` : "/login"} className="mt-7 flex min-h-14 items-center justify-center rounded-2xl bg-red-600 px-5 text-center font-black text-white transition hover:bg-neutral-950">Continue to login</a>
      </section>
    </main>
  );
}
