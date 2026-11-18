import { useCallback, useEffect, useState } from "react";

const API = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const token = () => sessionStorage.getItem("nexacore_auth_token");
async function api(path, method = "GET", body) {
  const auth = token();
  if (!auth) throw new Error("Sign in as a Client before making a payment.");
  const response = await fetch(`${API}/api/marketplace${path}`, {
    method,
    headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}
const money = kobo => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(kobo / 100);
export default function ClientPaystackCheckout() {
  const [projects, setProjects] = useState([]);
  const [talentId, setTalentId] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try { const data = await api("/projects"); setProjects(data.projects || []); }
    catch (e) { setError(e.message); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") || params.get("trxref");
    const projectId = sessionStorage.getItem("nexacore_pending_client_project");
    if (!reference || !projectId) return;
    let active = true;
    (async () => {
      setBusy(true);
      try {
        const result = await api(`/projects/${encodeURIComponent(projectId)}/verify`, "POST", {});
        if (active) { setMessage(result.verified ? "Payment verified by Paystack. Your contract is funded." : "Payment is awaiting verification."); await refresh(); }
        sessionStorage.removeItem("nexacore_pending_client_project");
        params.delete("reference"); params.delete("trxref");
        window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
      } catch (e) { if (active) setError(e.message); }
      finally { if (active) setBusy(false); }
    })();
    return () => { active = false; };
  }, [refresh]);
  async function create(e) {
    e.preventDefault(); setError(""); setMessage(""); setBusy(true);
    try {
      const naira = Number(amount);
      if (!Number.isFinite(naira) || naira < 100 || !Number.isSafeInteger(Math.round(naira * 100))) throw new Error("Enter a valid NGN amount of at least ₦100.");
      const data = await api("/projects", "POST", { talentId: talentId.trim(), title: title.trim(), amountKobo: Math.round(naira * 100) });
      setMessage(`Contract ${data.project.id} created. Select Pay with Paystack below.`);
      setTitle(""); setAmount(""); setTalentId(""); await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function checkout(id) {
    setError(""); setMessage(""); setBusy(true);
    try {
      const data = await api(`/projects/${encodeURIComponent(id)}/checkout`, "POST", {});
      if (!data.authorizationUrl?.startsWith("https://checkout.paystack.com/") && !data.authorizationUrl?.startsWith("https://paystack.com/")) throw new Error("Unexpected Paystack checkout URL.");
      sessionStorage.setItem("nexacore_pending_client_project", id);
      window.location.assign(data.authorizationUrl);
    } catch (e) { setError(e.message); setBusy(false); }
  }
  async function verify(id) {
    setBusy(true); setError("");
    try { const data = await api(`/projects/${encodeURIComponent(id)}/verify`, "POST", {}); setMessage(data.verified ? "Paystack payment verified." : "Not verified yet."); await refresh(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function approve(id) {
    if (!window.confirm("Confirm that the Talent has delivered the work and approve release to their internal wallet?")) return;
    setBusy(true); setError("");
    try { await api(`/projects/${encodeURIComponent(id)}/approve`, "POST", {}); setMessage("Delivery approved. Internal wallet updated; bank payout is not enabled."); await refresh(); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="mb-7 rounded-[28px] border border-neutral-200 bg-white p-6 text-neutral-950 sm:p-8">
    <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">Secure Paystack checkout · Test mode</p>
    <h2 className="mt-2 text-2xl font-black">Fund a real Client–Talent contract</h2>
    <p className="mt-2 text-sm leading-6 text-neutral-600">Only verified, active Talent accounts can receive contracts. Enter the real Talent user ID from the backend. Payments are collected in full in NGN; 90% is recorded as pending for Talent and 10% as the NexaCore allocation. This is not a regulated escrow or bank transfer service.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-neutral-100 p-4 text-sm">{message}</p>}
    <form onSubmit={create} className="mt-5 grid gap-3 md:grid-cols-3">
      <input required value={talentId} onChange={e=>setTalentId(e.target.value)} placeholder="Verified Talent user ID" className="rounded-xl border border-neutral-300 p-3 text-sm" />
      <input required minLength={5} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Project title" className="rounded-xl border border-neutral-300 p-3 text-sm" />
      <input required type="number" min="100" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount (NGN)" className="rounded-xl border border-neutral-300 p-3 text-sm" />
      <button disabled={busy} className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50 md:col-span-3">Create verified contract</button>
    </form>
    <h3 className="mt-8 text-lg font-black">My verified contracts</h3>
    {projects.length === 0 ? <p className="mt-3 text-sm text-neutral-500">No server-backed contracts yet.</p> : <div className="mt-4 space-y-3">{projects.map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4"><div><p className="font-bold">{p.title}</p><p className="mt-1 text-xs text-neutral-500">{money(p.amountKobo)} · {p.status} · {p.id}</p></div><div className="flex gap-2">{p.status === "AWAITING_PAYMENT" && <><button disabled={busy} onClick={()=>checkout(p.id)} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white">Pay with Paystack</button><button disabled={busy} onClick={()=>verify(p.id)} className="rounded-xl border border-neutral-300 px-3 py-2 text-xs">Verify payment</button></>}{p.status === "DELIVERED" && <button disabled={busy} onClick={()=>approve(p.id)} className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-bold text-white">Approve delivery</button>}</div></div>)}</div>}
  </section>;
}
