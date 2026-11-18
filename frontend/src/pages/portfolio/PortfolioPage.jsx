import {useCallback,useEffect,useState} from "react";

const API=(import.meta.env.VITE_API_URL||import.meta.env.VITE_API_BASE_URL||"http://localhost:4000").replace(/\/$/,"");
const panel={background:"#181820",border:"1px solid #34343d",borderRadius:16,padding:20};
const field={padding:12,width:"100%",boxSizing:"border-box",borderRadius:8,border:"1px solid #777"};
const btn={padding:"11px 16px",border:0,borderRadius:8,background:"#a21caf",color:"#fff",cursor:"pointer"};
export default function PortfolioPage(){
 const [me,setMe]=useState(null),[discover,setDiscover]=useState([]),[viewed,setViewed]=useState(null),[profile,setProfile]=useState({headline:"",bio:"",skills:"",availableForHire:false});
 const [project,setProject]=useState({title:"",description:"",projectUrl:""}),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const request=useCallback(async(path,opts={})=>{
  const token=sessionStorage.getItem("nexacore_auth_token");
  const res=await fetch(`${API}/api/portfolios${path}`,{...opts,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},cache:"no-store"});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(data.message||`Request failed (${res.status})`);
  return data;
 },[]);
 const refresh=useCallback(async()=>{
  const found=await request("/discover");setDiscover(found.profiles);
  try{
   const data=await request("/me");setMe(data);
   setProfile({headline:data.profile?.headline||"",bio:data.profile?.bio||"",skills:(data.profile?.skills||[]).join(", "),availableForHire:data.profile?.availableForHire||false});
  }catch(e){setMe(null);setError(e.message)}
 },[request]);
 useEffect(()=>{refresh().catch(e=>setError(e.message))},[refresh]);
 const run=async(fn)=>{setBusy(true);setError("");setNotice("");try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}};
 const save=async(e)=>{e.preventDefault();await run(async()=>{
  await request("/me",{method:"PUT",body:JSON.stringify({...profile,skills:profile.skills.split(",").map(s=>s.trim()).filter(Boolean)})});
  setNotice("Portfolio saved.");await refresh();
 })};
 const add=async(e)=>{e.preventDefault();await run(async()=>{
  await request("/me/projects",{method:"POST",body:JSON.stringify(project)});
  setProject({title:"",description:"",projectUrl:""});setNotice("Project added.");await refresh();
 })};
 const promote=async(id)=>run(async()=>{await request(`/me/achievements/${id}`,{method:"POST"});setNotice("Verified challenge added to portfolio.");await refresh()});
 const remove=async(id)=>run(async()=>{await request(`/me/projects/${id}`,{method:"DELETE"});setNotice("Project removed.");await refresh()});
 return <main style={{background:"#0d0d14",color:"#f5f5f7",minHeight:"100vh",fontFamily:"Arial,sans-serif",padding:"clamp(18px,4vw,44px)"}}>
 <a href="/challenges" style={{color:"#f0abfc"}}>â† Challenge Arena</a><h1>NexaCore Portfolios & Talent Discovery</h1>
 <p style={{color:"#bbb"}}>Show real projects and approved challenge achievements. Clients can discover available Talent and Tutors.</p>
 {error&&<p role="alert" style={{color:"#fca5a5"}}>{error}</p>}{notice&&<p role="status" style={{color:"#86efac"}}>{notice}</p>}
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(310px,1fr))",gap:20}}>
 <section style={panel}><h2>Your portfolio</h2>
 {!me?<p>Sign in to edit your portfolio.</p>:<>
 <p>{me.user.fullName} Â· {me.user.role}</p>
 <form onSubmit={save} style={{display:"grid",gap:10}}>
 <input style={field} maxLength={120} placeholder="Professional headline" value={profile.headline} onChange={e=>setProfile(v=>({...v,headline:e.target.value}))}/>
 <textarea style={field} rows={4} maxLength={2000} placeholder="About your work" value={profile.bio} onChange={e=>setProfile(v=>({...v,bio:e.target.value}))}/>
 <input style={field} placeholder="Skills separated by commas" value={profile.skills} onChange={e=>setProfile(v=>({...v,skills:e.target.value}))}/>
 {["TALENT","TUTOR"].includes(me.user.role)&&<label><input type="checkbox" checked={profile.availableForHire} onChange={e=>setProfile(v=>({...v,availableForHire:e.target.checked}))}/> Available for hire</label>}
 <button style={btn} disabled={busy}>Save portfolio</button></form>
 <h3>Showcase project</h3><form onSubmit={add} style={{display:"grid",gap:10}}>
 <input style={field} required minLength={3} maxLength={120} placeholder="Project title" value={project.title} onChange={e=>setProject(v=>({...v,title:e.target.value}))}/>
 <textarea style={field} required minLength={20} maxLength={2000} placeholder="What did you build?" value={project.description} onChange={e=>setProject(v=>({...v,description:e.target.value}))}/>
 <input style={field} type="url" maxLength={500} placeholder="Project link (optional)" value={project.projectUrl} onChange={e=>setProject(v=>({...v,projectUrl:e.target.value}))}/>
 <button style={btn} disabled={busy}>Add project</button></form>
 {me.projects.map(p=><article key={p.id} style={{borderTop:"1px solid #444",marginTop:12,paddingTop:12}}><strong>{p.title}</strong><p>{p.description}</p>
 {p.projectUrl&&<a href={p.projectUrl} target="_blank" rel="noopener noreferrer" style={{color:"#f0abfc"}}>Open project</a>}
 <div><button disabled={busy} onClick={()=>remove(p.id)}>Remove</button></div></article>)}
 <h3>Approved challenge achievements</h3>
 {!me.achievements.length&&<p>No approved achievements yet.</p>}
 {me.achievements.map(a=><article key={a.id} style={{marginTop:12,borderTop:"1px solid #444",paddingTop:12}}>
 <strong>{a.challenge.title}</strong><p>Verified score: {a.score}/100</p>
 <button disabled={busy} onClick={()=>promote(a.id)}>Add to portfolio</button></article>)}
 </>}
 </section>
 <section style={panel}><h2>Discover Talent & Tutors</h2>
 {viewed&&<aside style={{border:"1px solid #777",borderRadius:12,padding:14}}><button onClick={()=>setViewed(null)}>Close</button><h3>{viewed.user.fullName}</h3><p>{viewed.profile?.headline}</p><p>{viewed.profile?.bio}</p><h4>Projects</h4>{viewed.projects.map(p=><p key={p.id}>{p.title} â€” {p.description} {p.projectUrl&&<a href={p.projectUrl} target="_blank" rel="noopener noreferrer">View</a>}</p>)}<h4>Approved challenges</h4>{viewed.achievements.map(a=><p key={a.id}>{a.challenge.title}: {a.score}/100</p>)}</aside>}
 {!discover.length&&<p>No verified professionals are advertising availability yet.</p>}
 {discover.map(p=><article key={p.userId} style={{borderTop:"1px solid #444",paddingTop:14,marginTop:14}}>
 <h3>{p.user.fullName}</h3><p>{p.user.role} Â· {p.headline}</p><p>{p.bio}</p><p>{p.skills.join(" Â· ")}</p>
 <button onClick={()=>run(async()=>setViewed(await request(`/user/${encodeURIComponent(p.userId)}`)))}>View profile</button>
 </article>)}
 </section>
 </div></main>;
}

