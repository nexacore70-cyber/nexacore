import {useEffect,useState} from "react";
const base=(import.meta.env.VITE_API_URL||"http://localhost:4000").replace(/\/+$/,"");
const token=()=>sessionStorage.getItem("nexacore_auth_token")||localStorage.getItem("nexacore_auth_token")||"";
export default function SupportNotifications(){
 const [items,setItems]=useState([]),[error,setError]=useState("");
 useEffect(()=>{
  if(!token())return;
  let stopped=false,controller=new AbortController();
  const headers=()=>({Authorization:`Bearer ${token()}`});
  async function refresh(){try{const r=await fetch(`${base}/api/support/notifications`,{headers:headers(),signal:controller.signal});if(!r.ok)throw Error("Unable to load notifications");const d=await r.json();if(!stopped)setItems(d.notifications||[]);}catch(e){if(!stopped)setError(e.message);}}
  refresh();
  async function connect(){try{
   const r=await fetch(`${base}/api/support/notifications/stream`,{headers:headers(),signal:controller.signal});if(!r.ok||!r.body)throw Error("Live updates unavailable");
   const reader=r.body.getReader(),decoder=new TextDecoder();let buffer="";
   while(!stopped){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let pos;while((pos=buffer.indexOf("\n\n"))!==-1){const chunk=buffer.slice(0,pos);buffer=buffer.slice(pos+2);if(chunk.includes("event: notification")){const data=chunk.split("\n").find(line=>line.startsWith("data: "));if(data){try{const n=JSON.parse(data.slice(6));setItems(previous=>[n,...previous.filter(x=>x.id!==n.id)].slice(0,50));}catch{}}}}}
  }catch(e){if(!stopped)setError("Live connection unavailable; refresh to see new messages.");}}
  connect();return()=>{stopped=true;controller.abort();};
 },[]);
 async function markRead(id){try{const r=await fetch(`${base}/api/support/notifications/${encodeURIComponent(id)}/read`,{method:"PATCH",headers:{Authorization:`Bearer ${token()}`}});if(!r.ok)throw Error("Unable to mark as read");setItems(list=>list.map(n=>n.id===id?{...n,readAt:new Date().toISOString()}:n));}catch(e){setError(e.message);}}
 return <section style={{border:"1px solid #8885",borderRadius:10,padding:14,margin:"16px 0"}}><h2 style={{fontSize:19}}>Customer care notifications</h2><p>New complaint updates appear here while this page is open. Messages are saved if you go offline.</p>{error&&<p role="status">{error}</p>}{items.length===0?<p>No notifications yet.</p>:items.slice(0,15).map(n=><article key={n.id} style={{padding:8,borderTop:"1px solid #8883"}}><strong>{n.title}</strong>{!n.readAt&&<span> · New</span>}<p>{n.body}</p>{!n.readAt&&<button type="button" onClick={()=>markRead(n.id)}>Mark read</button>}</article>)}</section>;
}
