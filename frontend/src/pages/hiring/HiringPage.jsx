import { useCallback, useEffect, useState } from "react";

const API = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(/\/$/, "");
const panel = { border: "1px solid #38383f", borderRadius: 16, padding: 20, background: "#1a1a22" };
const field = { padding: 12, width: "100%", boxSizing: "border-box", borderRadius: 8 };
const btn = { padding: "10px 14px", background: "#9f1239", color: "white", border: 0, borderRadius: 8, cursor: "pointer" };

export default function HiringPage() {
  const [profiles, setProfiles] = useState([]);
  const [myId, setMyId] = useState(null);
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ providerId: "", title: "", description: "", budgetNaira: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useCallback(async (path, opts = {}) => {
    const token = sessionStorage.getItem("nexacore_auth_token");
    if (!token) throw new Error("Sign in to your NexaCore account first.");
    const res = await fetch(`${API}${path}`, {
      ...opts, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...opts.headers }, cache: "no-store"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
    return data;
  }, []);
  const refresh = useCallback(async () => {
    const [p, r] = await Promise.all([request("/api/portfolios/discover"), request("/api/hiring/mine")]);
    setProfiles(p.profiles); setRequests(r.requests);
    try { const me = await request("/api/portfolios/me"); setMyId(me.user.id); } catch { setMyId(null); }
  }, [request]);
  useEffect(() => { refresh().catch(e => setError(e.message)); }, [refresh]);
  const run = async fn => { setBusy(true); setError(""); setNotice(""); try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const submit = e => { e.preventDefault(); run(async () => {
    const amount = Number(form.budgetNaira);
    const budgetKobo = Math.round(amount * 100);
    if (!Number.isSafeInteger(budgetKobo) || amount < 100 || Math.abs(budgetKobo / 100 - amount) > 0.000001) throw new Error("Enter a valid NGN budget with no more than two decimal places.");
    await request("/api/hiring", { method: "POST", body: JSON.stringify({ providerId: form.providerId, title: form.title, description: form.description, budgetKobo }) });
    setForm({ providerId: "", title: "", description: "", budgetNaira: "" });
    setNotice("Hiring request sent. No payment has been charged."); await refresh();
  }); };
  const action = (id, status) => run(async () => {
    await request(`/api/hiring/${id}/${status === "CANCELLED" ? "cancel" : "decision"}`, { method: "PATCH", body: JSON.stringify(status === "CANCELLED" ? {} : { status }) });
    setNotice("Request updated. No payment has been processed."); await refresh();
  });
  return <main style={{ minHeight: "100vh", background: "#0e0e14", color: "white", padding: "clamp(18px,4vw,44px)", fontFamily: "Arial,sans-serif" }}>
    <a href="/portfolio" style={{ color: "#fda4af" }}>← Portfolios</a>
    <h1>NexaCore — Hire Talent</h1>
    <p style={{ color: "#bbb" }}>Send real project invitations to available Talent and Tutors. Accepting a request does not collect or release money.</p>
    {error && <p role="alert" style={{ color: "#fda4af" }}>{error}</p>}
    {notice && <p role="status" style={{ color: "#86efac" }}>{notice}</p>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 20 }}>
      <section style={panel}><h2>Send a project invitation</h2>
        <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
          <select style={field} required value={form.providerId} onChange={e => setForm(v => ({ ...v, providerId: e.target.value }))}>
            <option value="">Select an available professional</option>
            {profiles.map(p => <option key={p.userId} value={p.userId}>{p.user.fullName} — {p.headline || p.user.role}</option>)}
          </select>
          <input style={field} required minLength={5} maxLength={120} placeholder="Project title" value={form.title} onChange={e => setForm(v => ({ ...v, title: e.target.value }))} />
          <textarea style={field} required minLength={20} maxLength={3000} rows={5} placeholder="Project scope, deliverables and expectations" value={form.description} onChange={e => setForm(v => ({ ...v, description: e.target.value }))} />
          <label>Budget (NGN)<input style={field} type="number" min="100" max="20000000" step="0.01" required value={form.budgetNaira} onChange={e => setForm(v => ({ ...v, budgetNaira: e.target.value }))} /></label>
          <button style={btn} disabled={busy}>Send invitation</button>
        </form>
      </section>
      <section style={panel}><h2>My hiring requests</h2>
        {!requests.length && <p>No hiring requests yet.</p>}
        {requests.map(item => <article key={item.id} style={{ borderTop: "1px solid #444", paddingTop: 14, marginTop: 14 }}>
          <h3>{item.title}</h3><p>{item.description}</p>
          <p>Client: {item.client.fullName} · Professional: {item.provider.fullName}</p>
          <p>NGN {(item.budgetKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })} · <strong>{item.status}</strong></p>
          {item.status === "PENDING" && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {item.providerId === myId && <button style={btn} disabled={busy} onClick={() => action(item.id, "ACCEPTED")}>Accept (professional only)</button>}
            {item.providerId === myId && <button style={btn} disabled={busy} onClick={() => action(item.id, "DECLINED")}>Decline</button>}
            {item.clientId === myId && <button style={btn} disabled={busy} onClick={() => action(item.id, "CANCELLED")}>Cancel</button>}
          </div>}
        </article>)}
      </section>
    </div>
  </main>;
}
