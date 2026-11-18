import { useState } from "react";
import { deleteMyAccount } from "../../lib/api";

export default function AccountDangerZone() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (confirmation !== "DELETE") {
      setMessage('Type DELETE exactly to confirm.');
      return;
    }
    if (!window.confirm("Permanently delete your NexaCore account? This action cannot be undone.")) return;
    const token = window.sessionStorage.getItem("nexacore_auth_token");
    if (!token) {
      setMessage("Please sign in again before deleting your account.");
      return;
    }
    setBusy(true);
    try {
      await deleteMyAccount({ token, password, confirmation });
      window.sessionStorage.removeItem("nexacore_auth_token");
      window.sessionStorage.removeItem("nexacore_auth_user");
      window.localStorage.removeItem("nexacore_student_enrollments_v3");
      window.localStorage.removeItem("nexacore_pending_student_course_v1");
      window.location.replace("/");
    } catch (error) {
      setMessage(error.message || "Account deletion failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-6 rounded-[28px] border border-red-200 bg-red-50 p-6 sm:p-8">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Danger zone</p>
      <h2 className="mt-2 text-xl font-black text-neutral-950">Delete account</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-700">Permanently delete your NexaCore login and associated account data. This cannot be undone. Financial-record retention requirements should be reviewed before production launch.</p>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-neutral-800">Confirm your password
          <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="mt-2 h-12 w-full rounded-xl border border-red-200 bg-white px-4 outline-none focus:border-red-600" />
        </label>
        <label className="text-sm font-bold text-neutral-800">Type DELETE to confirm
          <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required className="mt-2 h-12 w-full rounded-xl border border-red-200 bg-white px-4 outline-none focus:border-red-600" />
        </label>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
          <button disabled={busy} type="submit" className="rounded-xl bg-red-700 px-5 py-3 text-sm font-black text-white disabled:opacity-60">{busy ? "Deleting account…" : "Permanently delete account"}</button>
          {message && <p role="alert" className="text-sm font-bold text-red-800">{message}</p>}
        </div>
      </form>
    </section>
  );
}
