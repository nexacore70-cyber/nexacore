import AiSessionAssistant from "../../components/AiSessionAssistant";
import { useEffect, useRef, useState } from "react";
const base = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
const token = () => sessionStorage.getItem("nexacore_auth_token") || localStorage.getItem("nexacore_auth_token");
async function api(path, options={}) {
 const r=await fetch(`${base}/api/classrooms${path}`,{...options,headers:{Authorization:`Bearer ${token()}`,"Content-Type":"application/json",...(options.headers||{})}});
 const j=await r.json();if(!r.ok)throw Error(j.message||"Request failed");return j;
}
export default function LiveClassroomPage(){
 const cohortId=new URLSearchParams(location.search).get("cohort")||"";
 const [room,setRoom]=useState(null),[peer,setPeer]=useState(""),[status,setStatus]=useState("Select a participant to start"),[video,setVideo]=useState(true),[recording,setRecording]=useState(false);
 const local=useRef(null),remote=useRef(null),stream=useRef(null),pc=useRef(null),rec=useRef(null),chunks=useRef([]),seen=useRef(new Set()),currentPeer=useRef("");
 const send=(recipientId,kind,payload)=>api(`/${cohortId}/signals`,{method:"POST",body:JSON.stringify({recipientId,kind,payload})});
 const startMedia=async()=>{if(stream.current)return stream.current;const s=await navigator.mediaDevices.getUserMedia({audio:true,video});stream.current=s;if(local.current)local.current.srcObject=s;return s;};
 const makePeer=async(id)=>{
  if(pc.current)pc.current.close();currentPeer.current=id;
  const s=await startMedia();const conn=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});pc.current=conn;
  s.getTracks().forEach(t=>conn.addTrack(t,s));
  conn.ontrack=e=>{if(remote.current)remote.current.srcObject=e.streams[0]};
  conn.onicecandidate=e=>{if(e.candidate)send(id,"ice",e.candidate.toJSON()).catch(console.error)};
  conn.onconnectionstatechange=()=>setStatus(`Connection: ${conn.connectionState}`);
  return conn;
 };
 const call=async()=>{try{if(!peer)return;const c=await makePeer(peer);const offer=await c.createOffer();await c.setLocalDescription(offer);await send(peer,"offer",{type:offer.type,sdp:offer.sdp});setStatus("Calling participant...")}catch(e){setStatus(e.message)}};
 const end=async()=>{if(currentPeer.current)await send(currentPeer.current,"hangup",{}).catch(()=>{});pc.current?.close();pc.current=null;currentPeer.current="";if(remote.current)remote.current.srcObject=null;setStatus("Call ended")};
 useEffect(()=>{if(!cohortId)return;let alive=true;api(`/${cohortId}/participants`).then(d=>{if(alive)setRoom(d)}).catch(e=>setStatus(e.message));return()=>{alive=false}},[cohortId]);
 useEffect(()=>{if(!room)return;let alive=true;const poll=async()=>{try{const data=await api(`/${cohortId}/signals`);for(const s of data.signals){if(!alive||seen.current.has(s.id))continue;seen.current.add(s.id);
  if(s.kind==="offer"){const c=await makePeer(s.senderId);await c.setRemoteDescription(s.payload);const answer=await c.createAnswer();await c.setLocalDescription(answer);await send(s.senderId,"answer",{type:answer.type,sdp:answer.sdp});setStatus("Call answered")}
  else if(s.kind==="answer"&&pc.current&&currentPeer.current===s.senderId)await pc.current.setRemoteDescription(s.payload);
  else if(s.kind==="ice"&&pc.current&&currentPeer.current===s.senderId){try{await pc.current.addIceCandidate(s.payload)}catch(e){console.warn(e)}}
  else if(s.kind==="hangup"&&currentPeer.current===s.senderId){pc.current?.close();pc.current=null;currentPeer.current="";setStatus("Participant left")}
 }}catch(e){if(alive)setStatus(e.message)}};poll();const timer=setInterval(poll,1800);return()=>{alive=false;clearInterval(timer)}},[room,cohortId]);
 useEffect(()=>()=>{rec.current?.state==="recording"&&rec.current.stop();pc.current?.close();stream.current?.getTracks().forEach(t=>t.stop())},[]);
 const toggleAudio=()=>stream.current?.getAudioTracks().forEach(t=>t.enabled=!t.enabled);
 const toggleVideo=()=>stream.current?.getVideoTracks().forEach(t=>t.enabled=!t.enabled);
 const record=()=>{if(recording){rec.current?.stop();setRecording(false);return}if(!stream.current){setStatus("Start a call before recording");return}if(!window.confirm("Confirm every participant has agreed to recording. This saves only YOUR local microphone/camera, not the remote participant. Continue?"))return;
  chunks.current=[];const r=new MediaRecorder(stream.current);rec.current=r;r.ondataavailable=e=>{if(e.data.size)chunks.current.push(e.data)};r.onstop=()=>{const blob=new Blob(chunks.current,{type:r.mimeType});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`nexacore-local-${Date.now()}.webm`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};r.start(1000);setRecording(true)};
 return <main style={{maxWidth:1100,margin:"32px auto",padding:20,color:"inherit"}}><h1>Live Classroom</h1><p>{room?.cohort.title||"Loading classroom..."}</p><p role="status">{status}</p>
 {!cohortId?<p>Open /live-classroom?cohort=YOUR_COHORT_ID</p>:<><label>Call participant: <select value={peer} onChange={e=>setPeer(e.target.value)}><option value="">Select participant</option>{room?.participants.map(p=><option key={p.id} value={p.id}>{p.fullName}</option>)}</select></label>
 <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:20}}><video ref={local} autoPlay muted playsInline style={{width:350,background:"#222"}}/><video ref={remote} autoPlay playsInline style={{width:350,background:"#222"}}/></div>
 <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}><button onClick={call} disabled={!peer}>Start video/audio call</button><button onClick={toggleAudio}>Toggle microphone</button><button onClick={toggleVideo}>Toggle camera</button><button onClick={end}>End call</button><button onClick={record}>{recording?"Stop local recording":"Record my camera/mic"}</button></div>
 {room && <AiSessionAssistant contextType="classroom" contextId={cohortId} />}
 <p>Browser permissions and HTTPS (or localhost) are required. This is a one-to-one experimental WebRTC call; remote audio/video is not included in local recordings. Ask everyone for recording consent.</p></>}
 </main>;
}
