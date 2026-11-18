import {useEffect,useState} from "react";
const base=(import.meta.env.VITE_API_URL||"http://localhost:4000").replace(/\/+$/,"");
const token=()=>sessionStorage.getItem("nexacore_auth_token")||localStorage.getItem("nexacore_auth_token")||"";
export default function TicketConversation({ticketId}) {
 const [messages,setMessages]=useState([]),[body,setBody]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function request(method="GET",value){const r=await fetch(`${base}/api/support/tickets/${encodeURIComponent(ticketId)}/messages`,{method,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token()}`},...(value?{body:JSON.stringify({body:value})}:{})});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||"Request failed");return d;}
 async function refresh(){try{setMessages((await request()).messages||[]);setError("");}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();},[ticketId]);
 async function send(e){e.preventDefault();if(!body.trim())return;setBusy(true);try{await request("POST",body);setBody("");await refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section style={{marginTop:12,padding:12,border:"1px solid #8885",borderRadius:8}}><strong>Ticket conversation</strong><div aria-live="polite">{messages.length===0?<p>No follow-up messages yet.</p>:messages.map(m=><p key={m.id}><strong>{m.authorRole==="ADMIN"?"Customer care":"Customer"}:</strong> {m.body} <small>{new Date(m.createdAt).toLocaleString()}</small></p>)}</div><form onSubmit={send}><textarea aria-label="Reply to support ticket" rows={2} maxLength={4000} value={body} onChange={e=>setBody(e.target.value)} style={{width:"100%"}}/><button disabled={busy||!body.trim()}>Send reply</button> <button type="button" onClick={refresh}>Refresh</button></form>{error&&<p role="alert">{error}</p>}</section>;
}
