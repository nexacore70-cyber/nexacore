import TicketConversation from "./TicketConversation.jsx";
import SupportNotifications from "./SupportNotifications.jsx";
import { useEffect, useState } from "react";
const base = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const token = () => sessionStorage.getItem("nexacore_auth_token") || localStorage.getItem("nexacore_auth_token") || "";
async function api(path, options = {}) {
  const response = await fetch(`${base}/api/support${path}`, {
    method: options.method || "GET",
    headers: {"Content-Type": "application/json", Authorization: `Bearer ${token()}`},
    ...(options.body ? {body: JSON.stringify(options.body)} : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.message || `Request failed (${response.status})`);
  return data;
}
export default function AdminSupportPage() {
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [filter, setFilter] = useState("ALL");
  async function load() {
    setLoading(true); setError("");
    try { const data = await api("/tickets"); setTickets(data.tickets || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  function change(id, field, value) { setTickets(items => items.map(t => t.id === id ? {...t, [field]: value} : t)); }
  async function save(ticket) {
    setSaving(ticket.id); setError("");
    try { await api(`/tickets/${encodeURIComponent(ticket.id)}`, {method:"PATCH", body:{status:ticket.status, adminReply:ticket.adminReply || ""}}); await load(); }
    catch (e) { setError(e.message); }
    finally { setSaving(null); }
  }
  const visible = tickets.filter(t => filter === "ALL" || t.status === filter);
  return <main style={{maxWidth:1050,margin:"40px auto",padding:20}}>
    <h1>NexaCore Customer Care — Admin Desk</h1>
    <p>Review real customer complaints and respond. Only an authenticated Admin can access ticket records through the API.</p>
    <p><a href="mailto:nexacore70@gmail.com">nexacore70@gmail.com</a> · <a href="https://wa.me/2348104633565" target="_blank" rel="noreferrer">WhatsApp: 08104633565</a></p>
    <SupportNotifications/><button type="button" onClick={load} disabled={loading}>Refresh tickets</button>{" "}
    <label>Filter <select value={filter} onChange={e=>setFilter(e.target.value)}>{["ALL","OPEN","IN_PROGRESS","RESOLVED"].map(v=><option key={v}>{v}</option>)}</select></label>
    {error && <p role="alert" style={{color:"crimson"}}>{error}</p>}
    {loading ? <p>Loading tickets…</p> : visible.length === 0 ? <p>No matching tickets.</p> : visible.map(t=><article key={t.id} style={{border:"1px solid #8885",borderRadius:10,padding:18,marginTop:16}}>
      <h2 style={{fontSize:19}}>{t.subject}</h2><p>Category: {t.category} · Submitted: {new Date(t.createdAt).toLocaleString()} · Ticket: {t.id}</p>
      <p style={{whiteSpace:"pre-wrap"}}>{t.description}</p>
      <label>Status <select value={t.status} onChange={e=>change(t.id,"status",e.target.value)}>{["OPEN","IN_PROGRESS","RESOLVED"].map(v=><option key={v}>{v}</option>)}</select></label>
      <label style={{display:"block",marginTop:10}}>Customer care response<textarea rows={4} maxLength={4000} value={t.adminReply || ""} onChange={e=>change(t.id,"adminReply",e.target.value)} style={{display:"block",width:"100%",boxSizing:"border-box"}} /></label>
      <button type="button" disabled={saving === t.id} onClick={()=>save(t)}>{saving === t.id ? "Saving…" : "Save response"}</button><TicketConversation ticketId={t.id}/>
    </article>)}
  </main>;
}
