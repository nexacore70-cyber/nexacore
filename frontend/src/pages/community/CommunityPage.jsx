import {useCallback,useEffect,useState} from "react";

const API=(import.meta.env.VITE_API_URL||import.meta.env.VITE_API_BASE_URL||"http://localhost:4000").replace(/\/$/,"");
const style={background:"#151515",border:"1px solid #333",borderRadius:16,padding:20};
export default function CommunityPage(){
 const [groups,setGroups]=useState([]),[selected,setSelected]=useState(null),[posts,setPosts]=useState([]);
 const [name,setName]=useState(""),[description,setDescription]=useState(""),[body,setBody]=useState("");
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 const request=useCallback(async(path,opts={})=>{
   const token=sessionStorage.getItem("nexacore_auth_token");
   if(!token)throw new Error("Sign in to your NexaCore account first.");
   const res=await fetch(`${API}/api/community${path}`,{...opts,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...opts.headers},cache:"no-store"});
   const data=await res.json().catch(()=>({}));
   if(!res.ok)throw new Error(data.message||`Request failed (${res.status})`);
   return data;
 },[]);
 const refresh=useCallback(async()=>{try{setError("");setGroups((await request("/")).groups)}catch(e){setError(e.message)}},[request]);
 useEffect(()=>{refresh()},[refresh]);
 const run=async(fn)=>{setBusy(true);setError("");try{await fn()}catch(e){setError(e.message)}finally{setBusy(false)}};
 const create=async(e)=>{e.preventDefault();await run(async()=>{await request("/",{method:"POST",body:JSON.stringify({name,description,visibility:"PUBLIC"})});setName("");setDescription("");await refresh()})};
 const open=async(g)=>{await run(async()=>{setSelected(g);setPosts(g.joined?(await request(`/${g.id}/posts`)).posts:[])})};
 const join=async()=>{await run(async()=>{await request(`/${selected.id}/join`,{method:"POST"});const updated={...selected,joined:true};setSelected(updated);setPosts((await request(`/${selected.id}/posts`)).posts);await refresh()})};
 const submit=async(e)=>{e.preventDefault();await run(async()=>{await request(`/${selected.id}/posts`,{method:"POST",body:JSON.stringify({body})});setBody("");setPosts((await request(`/${selected.id}/posts`)).posts)})};
 return <main style={{background:"#090909",color:"#fafafa",minHeight:"100vh",padding:"clamp(18px,4vw,45px)",fontFamily:"Arial,sans-serif"}}>
  <a href="/" style={{color:"#f87171"}}>â† NexaCore</a><h1>NexaCore Communities</h1>
  <p style={{color:"#aaa"}}>Create study circles, meet learners and share your progress. Only real members and posts are shown.</p>
  {error&&<p role="alert" style={{color:"#fca5a5"}}>{error}</p>}
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:20}}>
   <section style={style}><h2>Start a study group</h2>
    <form onSubmit={create} style={{display:"grid",gap:12}}>
     <input aria-label="Group name" value={name} onChange={e=>setName(e.target.value)} minLength={3} maxLength={80} required placeholder="Group name" style={{padding:12}}/>
     <textarea aria-label="Group description" value={description} onChange={e=>setDescription(e.target.value)} maxLength={500} placeholder="What will you learn together?" style={{padding:12}}/>
     <button disabled={busy} style={{padding:12,background:"#b91c1c",color:"white",border:0,borderRadius:8}}>Create public group</button>
    </form><h2>Explore groups</h2>
    {!groups.length&&<p>No groups yet. Start the first one.</p>}
    {groups.map(g=><button key={g.id} onClick={()=>open(g)} style={{display:"block",width:"100%",textAlign:"left",background:"#242424",color:"white",border:"1px solid #444",borderRadius:10,padding:14,marginTop:10}}>
     <strong>{g.name}</strong><p>{g.description}</p><small>{g._count.members} members Â· {g._count.posts} posts Â· {g.joined?"Joined":"Join to participate"}</small>
    </button>)}
   </section>
   <section style={style}><h2>{selected?.name||"Choose a community"}</h2>
    {selected&&!selected.joined&&<button disabled={busy} onClick={join} style={{padding:12}}>Join group</button>}
    {selected?.joined&&<><form onSubmit={submit} style={{display:"grid",gap:10}}>
      <textarea aria-label="Your post" value={body} onChange={e=>setBody(e.target.value)} minLength={2} maxLength={2000} required placeholder="Share a question, achievement or challenge..." style={{padding:12}}/>
      <button disabled={busy} style={{padding:12}}>Publish post</button></form>
      {!posts.length&&<p>No posts yet.</p>}
      {posts.map(p=><article key={p.id} style={{borderTop:"1px solid #444",marginTop:14,paddingTop:14}}><p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{p.body}</p><small style={{color:"#aaa"}}>{new Date(p.createdAt).toLocaleString()}</small></article>)}
    </>}
   </section>
  </div>
 </main>;
}

