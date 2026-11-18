import { useState } from "react";
const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
export default function AiProductivityTools() {
  const [mode, setMode] = useState("summary");
  const [sourceText, setSourceText] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function generate(event) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(""); setOutput("");
    try {
      const token = sessionStorage.getItem("nexacore_auth_token") || localStorage.getItem("nexacore_auth_token");
      if (!token) throw Error("Log in to use AI tools.");
      const response = await fetch(`${base}/api/ai-tools/generate`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode, sourceText })
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || "Could not generate a response.");
      setOutput(data.output);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section style={{marginTop:24,padding:18,border:"1px solid #9996",borderRadius:12}}>
    <h2>AI productivity tools</h2>
    <p>Available to every authenticated NexaCore user. Paste your own notes or transcript. No audio, recording, or meeting is accessed automatically.</p>
    <form onSubmit={generate}>
      <label htmlFor="nexa-ai-mode">Choose a tool</label>
      <select id="nexa-ai-mode" value={mode} onChange={e=>setMode(e.target.value)} style={{display:"block",marginBottom:12,padding:8}}>
        <option value="summary">Summarize notes</option><option value="quiz">Generate questions and answers</option><option value="actions">Extract tasks and action points</option>
      </select>
      <label htmlFor="nexa-ai-source">Your text</label>
      <textarea id="nexa-ai-source" value={sourceText} onChange={e=>setSourceText(e.target.value)} minLength={30} maxLength={12000} rows={9} required style={{display:"block",width:"100%",boxSizing:"border-box",marginTop:6,marginBottom:12}} placeholder="Paste meeting notes, project notes, lesson text, or a transcript here" />
      <button type="submit" disabled={busy || sourceText.trim().length < 30}>{busy ? "Generating…" : "Generate"}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {output && <div aria-live="polite" style={{whiteSpace:"pre-wrap",marginTop:16}}><h3>AI result</h3><p>{output}</p><button type="button" onClick={()=>navigator.clipboard?.writeText(output)}>Copy result</button></div>}
  </section>;
}
