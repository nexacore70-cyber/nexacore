import AiProductivityTools from "./AiProductivityTools";
import { useEffect, useState } from "react";
import AiSessionAssistant from "../../components/AiSessionAssistant";
const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
export default function AiForEveryonePage() {
 const [userId,setUserId] = useState(""); const [error,setError] = useState("");
 useEffect(()=>{const token=sessionStorage.getItem("nexacore_auth_token")||localStorage.getItem("nexacore_auth_token"); if(!token){setError("Please log in to use NexaCore AI.");return;}
 let cancelled=false; fetch(`${base}/api/ai-assistant/me`,{headers:{Authorization:`Bearer ${token}`}}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.message||"Unable to verify your session");if(!cancelled)setUserId(d.userId)}).catch(e=>{if(!cancelled)setError(e.message)});return()=>{cancelled=true};},[]);
 return <main style={{maxWidth:850,margin:"40px auto",padding:20}}><h1>NexaCore AI — For Everyone</h1><p>Students, Tutors, Talent, Clients, Service Providers, programme participants and Admins can ask questions here. AI is also available inside authorized calls and classrooms.</p>{error?<p role="alert">{error} <a href="/login">Log in</a></p>:userId?<><AiSessionAssistant contextType="personal" contextId={userId}/><AiProductivityTools/></>:<p>Checking your session…</p>}</main>;
}
