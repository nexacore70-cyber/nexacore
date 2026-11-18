import { useCallback, useEffect, useState } from "react";
const BASE=(import.meta.env.VITE_API_URL||import.meta.env.VITE_API_BASE_URL||"http://localhost:4000").replace(/\/$/,"");
const money=(kobo)=>new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN"}).format(kobo/100);
export default function ContractsPage(){
 const [invitations,setInvitations]=useState([]),[contracts,setContracts]=useState([]),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const currentUser=(()=>{try{return JSON.parse(sessionStorage.getItem("nexacore_auth_user")||"null")}catch{return null}})();
 const request=useCallback(async(path,options={})=>{
  const token=sessionStorage.getItem("nexacore_auth_token");
  if(!token)throw new Error("Please sign in first.");
  const response=await fetch(`${BASE}/api/${path}`,{...options,headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`,...options.headers},cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.message||`Request failed (${response.status})`);
  return data;
 },[]);
 const refresh=useCallback(async()=>{try{const [a,b]=await Promise.all([request("hiring/mine"),request("hiring-contracts/mine")]);setInvitations(a.requests||[]);setContracts(b.contracts||[]);setError("")}catch(e){setError(e.message)}},[request]);
 useEffect(()=>{refresh()},[refresh]);
 const act=async(action,success)=>{setBusy(true);setError("");setNotice("");try{const result=await action();if(result?.authorizationUrl){window.location.assign(result.authorizationUrl);return}setNotice(success);await refresh()}catch(e){setError(e.message)}finally{setBusy(false)}};
 const existing=new Set(contracts.map(c=>c.hiringRequestId).filter(Boolean));
 const verify=async(c)=>act(()=>request(`marketplace/projects/${encodeURIComponent(c.id)}/verify`,{method:"POST"}),"Payment verified against Paystack.");
 return <main style={{minHeight:"100vh",background:"#0c0c12",color:"white",fontFamily:"Arial,sans-serif",padding:"clamp(20px,4vw,48px)"}}>
 <a href="/hiring" style={{color:"#fda4af"}}>← Hiring invitations</a><h1>Project contracts</h1><p>Payments use Paystack TEST mode only. No live withdrawals are enabled. Talent share: 90%; platform: 10%, subject to client approval.</p>
 {error&&<p role="alert" style={{color:"#fda4af"}}>{error}</p>}{notice&&<p role="status" style={{color:"#86efac"}}>{notice}</p>}
 <section><h2>Accepted invitations</h2>{!invitations.some(i=>i.status==="ACCEPTED")&&<p>No accepted invitations yet.</p>}
 {invitations.filter(i=>i.status==="ACCEPTED").map(i=><article key={i.id} style={{padding:16,border:"1px solid #444",borderRadius:12,marginBottom:12}}><strong>{i.title}</strong><p>{money(i.budgetKobo)} · Client: {i.client?.fullName} · Professional: {i.provider?.fullName}</p><button disabled={busy||existing.has(i.id)||currentUser?.id!==i.clientId} onClick={()=>act(()=>request(`hiring-contracts/from-hiring/${encodeURIComponent(i.id)}`,{method:"POST"}),"Contract created.")}>{existing.has(i.id)?"Contract created":"Create contract (Client)"}</button></article>)}</section>
 <section><h2>Your contracts</h2>{!contracts.length&&<p>No contracts yet.</p>}
 {contracts.map(c=><article key={c.id} style={{padding:16,border:"1px solid #444",borderRadius:12,marginBottom:12}}><strong>{c.title}</strong><p>{money(c.amountKobo)} · {c.status}</p><small>Contract: {c.id}</small><div style={{display:"flex",flexWrap:"wrap",gap:10,marginTop:12}}>
 {currentUser?.id===c.clientId&&c.status==="AWAITING_PAYMENT"&&<><button disabled={busy} onClick={()=>act(()=>request(`marketplace/projects/${encodeURIComponent(c.id)}/checkout`,{method:"POST"}),"")}>Pay with Paystack (test)</button><button disabled={busy} onClick={()=>verify(c)}>Verify payment after checkout</button></>}
 {currentUser?.id===c.talentId&&c.status==="PAID"&&<button disabled={busy} onClick={()=>act(()=>request(`marketplace/projects/${encodeURIComponent(c.id)}/deliver`,{method:"POST"}),"Delivery submitted for client approval.")}>Mark work delivered</button>}
 {currentUser?.id===c.clientId&&c.status==="DELIVERED"&&<button disabled={busy} onClick={()=>act(()=>request(`marketplace/projects/${encodeURIComponent(c.id)}/approve`,{method:"POST"}),"Project approved. Talent wallet allocation recorded.")}>Approve delivery and release wallet allocation</button>}
 </div></article>)}</section>
 </main>;
}
