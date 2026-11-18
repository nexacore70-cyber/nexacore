import {useCallback,useEffect,useState} from "react";

const API=(import.meta.env.VITE_API_URL||import.meta.env.VITE_API_BASE_URL||"http://localhost:4000").replace(/\/$/,"");
const panel={padding:20,border:"1px solid #30303a",borderRadius:16,background:"#17171e"};
const field={padding:12,borderRadius:8,border:"1px solid #555",width:"100%",boxSizing:"border-box"};
const button={padding:"10px 16px",background:"#9f1239",color:"white",border:0,borderRadius:8,cursor:"pointer"};
export default function ChallengePage(){
 const [challenges,setChallenges]=useState([]),[leaderboard,setLeaderboard]=useState([]),[selected,setSelected]=useState(null);
 const [mine,setMine]=useState(null),[submissions,setSubmissions]=useState([]),[summary,setSummary]=useState(""),[projectUrl,setProjectUrl]=useState("");
 const [create,setCreate]=useState({title:"",description:"",category:"",deadline:""}),[feedback,setFeedback]=useState({}),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const request=useCallback(async(path,opts={})=>{
  const token=sessionStorage.getItem("nexacore_auth_token");
  if(!token)throw Error("Sign in to your account first.");
  const res=await fetch(`${API}/api/challenges${path}`,{...opts,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...opts.headers},cache:"no-store"});
  const json=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(json.message||`Request failed (${res.status})`);
  return json;
 },[]);
 const refresh=useCallback(async()=>{try{const [a,b]=await Promise.all([request("/"),request("/leaderboard/global")]);setChallenges(a.challenges);setLeaderboard(b.leaderboard)}catch(e){setError(e.message)}},[request]);
 useEffect(()=>{refresh()},[refresh]);
 const run=async(fn)=>{setBusy(true);setError("");setNotice("");try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}};
 const open=async(c)=>run(async()=>{const d=await request(`/${c.id}`);setSelected(d.challenge);setMine(d.mySubmission);setSummary(d.mySubmission?.summary||"");setProjectUrl(d.mySubmission?.projectUrl||"");setSubmissions([]);try{setSubmissions((await request(`/${c.id}/submissions`)).submissions)}catch{/* Non-reviewers cannot view other users' submissions */}});
 const submit=async(e)=>{e.preventDefault();await run(async()=>{const d=await request(`/${selected.id}/submit`,{method:"POST",body:JSON.stringify({summary,projectUrl})});setMine(d.submission);setNotice("Submission saved to your account.");await refresh()})};
 const publish=async(e)=>{e.preventDefault();await run(async()=>{await request("/",{method:"POST",body:JSON.stringify({...create,deadline:new Date(create.deadline).toISOString()})});setCreate({title:"",description:"",category:"",deadline:""});setNotice("Challenge published.");await refresh()})};
 const review=async(s,status)=>run(async()=>{const score=Number(feedback[s.id]?.score);await request(`/${selected.id}/submissions/${s.id}`,{method:"PATCH",body:JSON.stringify({status,score:status==="APPROVED"?score:null,feedback:feedback[s.id]?.feedback||""})});setSubmissions((await request(`/${selected.id}/submissions`)).submissions);await refresh();setNotice("Review saved.")});
 return <main style={{background:"#0b0b11",color:"#f8f8fa",minHeight:"100vh",padding:"clamp(16px,4vw,44px)",fontFamily:"Arial,sans-serif"}}>
 <a href="/community" style={{color:"#fda4af"}}>â† Communities</a><h1>NexaCore Challenge Arena</h1>
 <p style={{color:"#bbb"}}>Build real projects, submit your work and earn points after a Tutor or Admin reviews it.</p>
 {error&&<p role="alert" style={{color:"#fda4af"}}>{error}</p>}{notice&&<p role="status" style={{color:"#86efac"}}>{notice}</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:18}}>
 <section style={panel}><h2>Available challenges</h2>{!challenges.length&&<p>No challenges have been published.</p>}
 {challenges.map(c=><button key={c.id} onClick={()=>open(c)} style={{...panel,display:"block",width:"100%",color:"white",textAlign:"left",marginBottom:12,cursor:"pointer"}}>
 <strong>{c.title}</strong><p>{c.category} Â· {c._count.submissions} submissions</p><small>Deadline: {new Date(c.deadline).toLocaleString()}</small></button>)}
 <h2>Leaderboard</h2>{!leaderboard.length&&<p>No approved scores yet.</p>}
 {leaderboard.map((u,i)=><p key={u.userId}>{i+1}. {u.name} â€” {u.points} points ({u.completed} approved)</p>)}
 </section>
 <section style={panel}><h2>{selected?.title||"Select a challenge"}</h2>
 {selected&&<><p style={{whiteSpace:"pre-wrap"}}>{selected.description}</p><p>Deadline: {new Date(selected.deadline).toLocaleString()}</p>
 <h3>Your submission</h3>{mine&&<p>Status: {mine.status}{mine.score!==null?` Â· Score: ${mine.score}`:""}{mine.feedback?` Â· Feedback: ${mine.feedback}`:""}</p>}
 <form onSubmit={submit} style={{display:"grid",gap:10}}>
 <textarea style={field} rows={5} required minLength={20} maxLength={3000} value={summary} onChange={e=>setSummary(e.target.value)} placeholder="Describe your solution (20â€“3000 characters)"/>
 <input style={field} type="url" maxLength={500} value={projectUrl} onChange={e=>setProjectUrl(e.target.value)} placeholder="Optional project or portfolio URL"/>
 <button style={button} disabled={busy||new Date(selected.deadline)<=new Date()||mine?.status==="APPROVED"}>Save submission</button></form>
 {submissions.length>0&&<><h3>Review submissions</h3>{submissions.map(s=><article key={s.id} style={{borderTop:"1px solid #555",paddingTop:12,marginTop:12}}>
 <strong>{s.user.fullName}</strong> Â· {s.status}<p style={{whiteSpace:"pre-wrap"}}>{s.summary}</p>
 {s.projectUrl&&<a href={s.projectUrl} target="_blank" rel="noopener noreferrer" style={{color:"#fda4af"}}>View project</a>}
 <input style={{...field,marginTop:8}} type="number" min="0" max="100" placeholder="Score 0â€“100" value={feedback[s.id]?.score??""} onChange={e=>setFeedback(v=>({...v,[s.id]:{...v[s.id],score:e.target.value===""?null:Number(e.target.value)}}))}/>
 <input style={{...field,marginTop:8}} maxLength={1000} placeholder="Review feedback" value={feedback[s.id]?.feedback??""} onChange={e=>setFeedback(v=>({...v,[s.id]:{...v[s.id],feedback:e.target.value}}))}/>
 <div style={{display:"flex",gap:8,marginTop:8}}><button disabled={busy||feedback[s.id]?.score==null} style={button} onClick={()=>review(s,"APPROVED")}>Approve</button><button disabled={busy} style={button} onClick={()=>review(s,"REJECTED")}>Reject</button></div>
 </article>)}</>}
 </>}
 </section>
 <section style={panel}><h2>Publish a challenge</h2><p style={{color:"#aaa"}}>For Tutor and Admin accounts only.</p>
 <form onSubmit={publish} style={{display:"grid",gap:10}}>
 <input style={field} required minLength={5} maxLength={120} placeholder="Challenge title" value={create.title} onChange={e=>setCreate(v=>({...v,title:e.target.value}))}/>
 <input style={field} required maxLength={50} placeholder="Category e.g. Web Development" value={create.category} onChange={e=>setCreate(v=>({...v,category:e.target.value}))}/>
 <textarea style={field} rows={5} required minLength={20} maxLength={4000} placeholder="Instructions and judging criteria" value={create.description} onChange={e=>setCreate(v=>({...v,description:e.target.value}))}/>
 <label>Deadline <input style={field} required type="datetime-local" value={create.deadline} onChange={e=>setCreate(v=>({...v,deadline:e.target.value}))}/></label>
 <button style={button} disabled={busy}>Publish challenge</button></form>
 </section></div></main>;
}

