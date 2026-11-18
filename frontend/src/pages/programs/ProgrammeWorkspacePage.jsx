import { useEffect, useState } from 'react';
const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const token = () => sessionStorage.getItem('nexacore_auth_token') || localStorage.getItem('nexacore_auth_token') || '';
async function request(path, method = 'GET', body) {
  const response = await fetch(`${API}/api/programme-workspace${path}`, { method, headers: { Authorization: `Bearer ${token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}
export default function ProgrammeWorkspacePage() {
  const cohortId = new URLSearchParams(window.location.search).get('cohortId') || '';
  const [data, setData] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [title, setTitle] = useState(''), [instructions, setInstructions] = useState('');
  const [drafts, setDrafts] = useState({}), [reviews, setReviews] = useState({});
  async function load() { if (!cohortId) { setError('Missing programme ID.'); return; } try { setData(await request(`/${encodeURIComponent(cohortId)}`)); setError(''); } catch (e) { setError(e.message); } }
  useEffect(() => { load(); }, [cohortId]);
  async function action(fn) { try { setError(''); setNotice(''); await fn(); await load(); setNotice('Saved successfully.'); } catch (e) { setError(e.message); } }
  const style = { padding: 18, border: '1px solid #64748b', borderRadius: 10, marginBottom: 16 };
  return <main style={{ maxWidth: 920, margin: '32px auto', padding: 20 }}><a href="/programs/bootcamp/apply">← My programmes</a><h1>{data?.programme?.title || 'Programme workspace'}</h1><p>Bootcamp and Internship training activities are separate from Student courses. Access requires verified enrollment.</p>{error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {data?.manager && <form style={style} onSubmit={e => { e.preventDefault(); action(async () => { await request(`/${cohortId}/assignments`, 'POST', { title, instructions }); setTitle(''); setInstructions(''); }); }}><h2>Publish assignment</h2><input required maxLength={160} placeholder="Assignment title" value={title} onChange={e => setTitle(e.target.value)} /><p><textarea required maxLength={10000} placeholder="Instructions" value={instructions} onChange={e => setInstructions(e.target.value)} /></p><button>Create assignment</button></form>}
    {data?.assignments?.length === 0 && <p>No assignments have been published yet.</p>}
    {data?.assignments?.map(a => <section key={a.id} style={style}><h2>{a.title}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{a.instructions}</p>{!data.manager ? <><p>{a.submissions[0]?.feedback ? `Tutor feedback: ${a.submissions[0].feedback}` : 'No feedback yet.'}</p>{a.submissions[0]?.score != null && <p>Score: {a.submissions[0].score}/100</p>}<textarea maxLength={15000} placeholder="Your assignment submission" value={drafts[a.id] ?? a.submissions[0]?.content ?? ''} onChange={e => setDrafts(v => ({ ...v, [a.id]: e.target.value }))} /><p><button onClick={() => action(() => request(`/${cohortId}/assignments/${a.id}/submit`, 'POST', { content: drafts[a.id] ?? a.submissions[0]?.content ?? '' }))}>Submit work</button></p></> : <>{a.submissions.length === 0 && <p>No submissions yet.</p>}{a.submissions.map(s => <div key={s.id} style={style}><p>Participant ID: {s.applicantId}</p><p style={{ whiteSpace: 'pre-wrap' }}>{s.content}</p><textarea placeholder="Tutor feedback" maxLength={10000} value={reviews[s.id]?.feedback ?? s.feedback ?? ''} onChange={e => setReviews(v => ({ ...v, [s.id]: { ...v[s.id], feedback: e.target.value } }))} /><p><input type="number" min="0" max="100" placeholder="Score 0–100" value={reviews[s.id]?.score ?? s.score ?? ''} onChange={e => setReviews(v => ({ ...v, [s.id]: { ...v[s.id], score: e.target.value } }))} /></p><button onClick={() => action(() => request(`/${cohortId}/submissions/${s.id}/review`, 'PATCH', { feedback: reviews[s.id]?.feedback ?? s.feedback ?? '', score: (reviews[s.id]?.score ?? s.score ?? '') === '' ? null : Number(reviews[s.id]?.score ?? s.score) }))}>Save review</button></div>)}</>}</section>)}
  </main>;
}
