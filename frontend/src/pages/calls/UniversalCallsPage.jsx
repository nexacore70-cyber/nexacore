import AiSessionAssistant from "../../components/AiSessionAssistant";
import { useCallback, useEffect, useRef, useState } from 'react';
const base=import.meta.env.VITE_API_BASE_URL||'http://localhost:4000';
const token=()=>sessionStorage.getItem('nexacore_auth_token')||localStorage.getItem('nexacore_auth_token');
async function api(path,options={}){
 const response=await fetch(`${base}/api/calls${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token()}`,...options.headers}});
 const data=await response.json();if(!response.ok)throw Error(data.message||'Request failed');return data;
}
export default function UniversalCallsPage(){
 const [myId,setMyId]=useState('');const [query,setQuery]=useState(''),[people,setPeople]=useState([]),[calls,setCalls]=useState([]),[selected,setSelected]=useState(null),[status,setStatus]=useState(''),[recording,setRecording]=useState(false),[muted,setMuted]=useState(false),[cameraOff,setCameraOff]=useState(false);
 const local=useRef(null),remote=useRef(null),stream=useRef(null),pc=useRef(null),active=useRef(null),seen=useRef(new Set()),rec=useRef(null),chunks=useRef([]),handled=useRef(false),lastSignal=useRef(new Date(Date.now()-120000).toISOString());
 const refresh=useCallback(async()=>{try{const {calls}=await api('/');setCalls(calls);const current=active.current;if(current){const latest=calls.find(c=>c.id===current.id);if(latest){active.current=latest;setSelected(latest);if(['ENDED','DECLINED'].includes(latest.status)){pc.current?.close();pc.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setStatus('Call ended');}}}}catch(e){setStatus(e.message)}},[]);
 useEffect(()=>{api('/me').then(d=>setMyId(d.id)).catch(e=>setStatus(e.message));refresh();const id=setInterval(refresh,2500);return()=>clearInterval(id)},[refresh]);
 useEffect(()=>()=>{rec.current?.state==='recording'&&rec.current.stop();pc.current?.close();stream.current?.getTracks().forEach(t=>t.stop())},[]);
 const search=async()=>{try{const d=await api(`/people?q=${encodeURIComponent(query)}`);setPeople(d.users)}catch(e){setStatus(e.message)}};
 const choose=async(user,mode)=>{try{const d=await api('/',{method:'POST',body:JSON.stringify({recipientId:user.id,mode})});active.current=d.call;setSelected(d.call);handled.current=false;seen.current.clear();setStatus('Ringing. Waiting for acceptance.');refresh()}catch(e){setStatus(e.message)}};
 const respond=async(call,decision)=>{try{await api(`/${call.id}/respond`,{method:'POST',body:JSON.stringify({decision})});active.current=decision==='accept'?{...call,status:'ACTIVE'}:null;setSelected(decision==='accept'?{...call,status:'ACTIVE'}:null);handled.current=false;seen.current.clear();setStatus(decision==='accept'?'Connecting...':'Declined');refresh()}catch(e){setStatus(e.message)}};
 const send=(call,kind,payload)=>api(`/${call.id}/signals`,{method:'POST',body:JSON.stringify({kind,payload})});
 const startMedia=async(call)=>{if(stream.current)return stream.current;const s=await navigator.mediaDevices.getUserMedia({audio:true,video:call.mode==='video'});stream.current=s;if(local.current)local.current.srcObject=s;return s};
 const makePeer=async(call)=>{if(pc.current)return pc.current;const s=await startMedia(call);const c=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});pc.current=c;s.getTracks().forEach(t=>c.addTrack(t,s));c.ontrack=e=>{if(remote.current)remote.current.srcObject=e.streams[0]};c.onicecandidate=e=>{if(e.candidate)send(call,'ice',e.candidate.toJSON()).catch(console.error)};c.onconnectionstatechange=()=>setStatus(`Connection: ${c.connectionState}`);return c};
 const startOffer=async(call)=>{try{const c=await makePeer(call);const offer=await c.createOffer();await c.setLocalDescription(offer);await send(call,'offer',{type:offer.type,sdp:offer.sdp});setStatus('Connecting...')}catch(e){setStatus(e.message)}};
 useEffect(()=>{const call=selected;if(!call||call.status!=='ACTIVE')return;let alive=true;
 const poll=async()=>{try{
  if(!handled.current&&myId===call.callerId){handled.current=true;await startOffer(call)}
  const d=await api(`/${call.id}/signals?after=${encodeURIComponent(lastSignal.current)}`);
  for(const s of d.signals){if(!alive||seen.current.has(s.id))continue;seen.current.add(s.id);
   if(s.kind==='offer'){const c=await makePeer(call);await c.setRemoteDescription(s.payload);const answer=await c.createAnswer();await c.setLocalDescription(answer);await send(call,'answer',{type:answer.type,sdp:answer.sdp});setStatus('Connected')}
   if(s.kind==='answer'&&pc.current&&pc.current.signalingState==='have-local-offer')await pc.current.setRemoteDescription(s.payload);
   if(s.kind==='ice'&&pc.current){try{await pc.current.addIceCandidate(s.payload)}catch(e){console.warn('ICE candidate delayed',e)}}
  }
 }catch(e){if(alive)setStatus(e.message)}};poll();const timer=setInterval(poll,1600);return()=>{alive=false;clearInterval(timer)}
 },[selected?.id,selected?.status,myId]);
 const end=async()=>{if(!selected)return;try{await api(`/${selected.id}/end`,{method:'POST'})}catch(e){setStatus(e.message)}pc.current?.close();pc.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;active.current=null;setSelected(null);setStatus('Call ended');refresh()};
 const toggleMic=()=>{const tracks=stream.current?.getAudioTracks()||[];tracks.forEach(t=>t.enabled=!t.enabled);setMuted(v=>!v)};
 const toggleCam=()=>{const tracks=stream.current?.getVideoTracks()||[];tracks.forEach(t=>t.enabled=!t.enabled);setCameraOff(v=>!v)};
 const record=()=>{if(recording){rec.current?.stop();setRecording(false);return}if(!stream.current)return setStatus('Connect a call first.');if(!confirm('All participants must consent. This recording captures only YOUR local microphone/camera, not the remote participant. Continue?'))return;
 chunks.current=[];const r=new MediaRecorder(stream.current);rec.current=r;r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};r.onstop=()=>{const blob=new Blob(chunks.current,{type:r.mimeType});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`nexacore-local-call-${Date.now()}.webm`;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000)};r.start(1000);setRecording(true)};
 const incoming=calls.filter(c=>c.status==='RINGING'&&c.recipientId===myId&&(!selected||selected.id!==c.id));
 return <main style={{maxWidth:1050,margin:'24px auto',padding:20}}><h1>NexaCore Calls</h1><p>Audio and video calls for all active NexaCore account roles. Recipients must accept before media connects.</p><p role="status">{status}</p>
 <section><h2>Find someone</h2><input aria-label="Find user by name or exact email" placeholder="Name or exact email" value={query} onChange={e=>setQuery(e.target.value)}/><button onClick={search} disabled={query.trim().length<3}>Search</button>{people.map(p=><div key={p.id} style={{padding:8,borderBottom:'1px solid #8884'}}><strong>{p.fullName}</strong> ({p.role}) <button onClick={()=>choose(p,'audio')}>Audio call</button> <button onClick={()=>choose(p,'video')}>Video call</button></div>)}</section>
 <section><h2>Incoming and recent calls</h2>{incoming.map(c=><div key={c.id} style={{padding:10,border:'1px solid #8886',marginBottom:8}}>{c.caller.fullName} is calling ({c.mode}). <button onClick={()=>respond(c,'accept')}>Accept</button> <button onClick={()=>respond(c,'decline')}>Decline</button></div>)}{calls.slice(0,10).map(c=><p key={c.id}>{c.caller.fullName} → {c.recipient.fullName} · {c.mode} · {c.status}</p>)}</section>
 {selected&&<section><h2>Call: {selected.mode}</h2><p>{selected.status}</p><div style={{display:'flex',flexWrap:'wrap',gap:12}}><video ref={local} autoPlay muted playsInline style={{width:330,maxWidth:'100%',background:'#222'}}/><video ref={remote} autoPlay playsInline style={{width:330,maxWidth:'100%',background:'#222'}}/></div><div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:12}}><button onClick={toggleMic}>{muted?'Unmute':'Mute'}</button>{selected.mode==='video'&&<button onClick={toggleCam}>{cameraOff?'Camera on':'Camera off'}</button>}<button onClick={record}>{recording?'Stop local recording':'Record my media'}</button><button onClick={end}>End call</button></div></section>}
 {selected?.status === "ACTIVE" && <AiSessionAssistant contextType="call" contextId={selected.id} />}
 <p>HTTPS or localhost required. TURN service is necessary for reliable connections across networks. This MVP supports one-to-one calls; recording does not capture the remote participant.</p></main>;
}
