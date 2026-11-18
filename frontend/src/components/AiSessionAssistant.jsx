import { useState } from "react";
const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
export default function AiSessionAssistant({ contextType, contextId }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function ask(event) {
    event.preventDefault(); if (!contextId || loading) return;
    setLoading(true); setError(""); setAnswer("");
    try {
      const token = sessionStorage.getItem("nexacore_auth_token") || localStorage.getItem("nexacore_auth_token");
      const response = await fetch(`${base}/api/ai-assistant/ask`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` }, body: JSON.stringify({ contextType, contextId, question }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "AI request failed");
      setAnswer(result.answer);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return <section aria-label="AI session assistant" style={{ padding: 16, border: "1px solid #9996", borderRadius: 12, marginTop: 16 }}>
    <h3>AI assistant</h3><p>Ask anything about learning, projects, work, hiring or other topics. Only the question you submit is sent to the AI provider. The assistant cannot listen to the call or read recordings.</p>
    <form onSubmit={ask}><label htmlFor={`ai-question-${contextType}`}>Your question</label><textarea id={`ai-question-${contextType}`} rows={3} maxLength={2000} required minLength={3} value={question} onChange={e=>setQuestion(e.target.value)} style={{display:"block",width:"100%",maxWidth:700}} />
    <button type="submit" disabled={loading || !contextId || question.trim().length < 3}>{loading ? "Thinking…" : "Ask AI"}</button></form>
    {error && <p role="alert">{error}</p>}{answer && <div aria-live="polite" style={{whiteSpace:"pre-wrap",marginTop:12}}><strong>Answer</strong><p>{answer}</p></div>}
  </section>;
}
