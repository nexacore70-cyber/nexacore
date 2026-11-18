import {useCallback,useEffect,useState} from 'react';
const API=(import.meta.env.VITE_API_URL||import.meta.env.VITE_API_BASE_URL||'http://localhost:4000').replace(/\/$/,'');
const panel={background:'#171717',border:'1px solid #333',borderRadius:14,padding:18,marginBottom:18};
const btn={background:'#b91c1c',color:'white',border:0,borderRadius:7,padding:'9px 12px',cursor:'pointer'};
export default function AdminControlPage(){

 const [tab,setTab]=useState('users'),[search,setSearch]=useState(''),[page,setPage]=useState(1),[users,setUsers]=useState([]),[total,setTotal]=useState(0);
 const [bank,setBank]=useState({questions:[],audio:[]}),[logs,setLogs]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const request=useCallback(async(path,options={})=>{
  const response=await fetch(`${API}/api/admin/control${path}`,{...options,credentials:'include',headers:{'Content-Type':'application/json',...options.headers}});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.message||`HTTP ${response.status}`);return data;
 },[]);
 const load=useCallback(async()=>{

  setBusy(true);setError('');
  try{
   if(tab==='users'){const d=await request(`/users?page=${page}&search=${encodeURIComponent(search)}`);setUsers(d.users);setTotal(d.total)}
   if(tab==='assessments')setBank(await request('/assessments/bank'));
   if(tab==='audit')setLogs((await request('/audit')).logs);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 },[request,tab,page,search]);
 useEffect(()=>{load()},[load]);
 async function act(path,method,body){setBusy(true);setError('');setNotice('');try{await request(path,{method,body:JSON.stringify(body)});setNotice('Saved successfully.');await load()}catch(e){setError(e.message)}finally{setBusy(false)}}
 async function remove(user){const confirmation=window.prompt(`Permanently delete ${user.email}? This is allowed only if no protected records exist.\nType DELETE ${user.id}`);if(confirmation!==`DELETE ${user.id}`)return;await act(`/users/${user.id}`,'DELETE',{confirmation});}
 return <main style={{background:'#090909',color:'#f5f5f5',minHeight:'100vh',padding:'clamp(16px,4vw,44px)',fontFamily:'Arial,sans-serif'}}>
  <div style={{color:'#ef4444',fontWeight:700}}>NEXACORE Â· ADMIN</div><h1>Platform controls</h1>
  <p style={{color:'#aaa'}}>Real database accounts and assessment approvals. All changes require backend ADMIN authorization.</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:20}}>{[['users','Accounts'],['assessments','Tutor assessment bank'],['audit','Audit log']].map(([key,label])=><button key={key} onClick={()=>setTab(key)} style={{...btn,background:tab===key?'#b91c1c':'#333'}}>{label}</button>)}<a href='/admin/finance' style={{...btn,textDecoration:'none',background:'#333'}}>Finance</a></div>
  {error&&<p role='alert' style={{color:'#fecaca'}}>{error}</p>}{notice&&<p style={{color:'#bbf7d0'}}>{notice}</p>}
  {tab==='users'&&<section style={panel}><h2>Account management</h2><input aria-label='Search accounts' placeholder='Search real users by name or email' value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} style={{padding:12,width:'min(100%,420px)',marginBottom:15}}/>
   <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',textAlign:'left'}}><thead><tr>{['Account','Role','Status','Actions'].map(h=><th key={h} style={{padding:10,borderBottom:'1px solid #444'}}>{h}</th>)}</tr></thead><tbody>{users.map(u=><tr key={u.id}><td style={{padding:10,borderBottom:'1px solid #333'}}>{u.fullName}<div style={{color:'#aaa',fontSize:12}}>{u.email}</div></td><td>{u.role}</td><td>{u.status}</td><td style={{display:'flex',gap:6,flexWrap:'wrap',padding:8}}>{u.role!=='ADMIN'&&<><button disabled={busy} style={btn} onClick={()=>act(`/users/${u.id}`,'PATCH',{status:u.status==='SUSPENDED'?'ACTIVE':'SUSPENDED'})}>{u.status==='SUSPENDED'?'Restore':'Suspend'}</button>{u.status==='PENDING'&&<button disabled={busy} style={btn} onClick={()=>act(`/users/${u.id}`,'PATCH',{status:'ACTIVE'})}>Approve</button>}<button disabled={busy} style={{...btn,background:'#5f2020'}} onClick={()=>remove(u)}>Delete</button></>}</td></tr>)}</tbody></table></div>
   {!users.length&&<p>No accounts found.</p>}<p>{total} accounts</p><button style={btn} disabled={page===1||busy} onClick={()=>setPage(p=>p-1)}>Previous</button> <button style={btn} disabled={page*25>=total||busy} onClick={()=>setPage(p=>p+1)}>Next</button></section>}
  {tab==='assessments'&&<section style={panel}><h2>Question and audio approval</h2><p style={{color:'#aaa'}}>Review the actual content before approving. Approving does not validate AI correctness automatically.</p>{[['questions','question'],['audio','audio']].map(([key,type])=><div key={key}><h3>{key==='questions'?'Knowledge questions':'Audio tasks'}</h3>{!bank[key].length&&<p>No items found.</p>}{bank[key].map(item=><div key={item.id} style={{borderTop:'1px solid #333',padding:'12px 0'}}><strong>{item.subject}</strong> Â· {item.approved?'Approved':'Draft'}<p>{item.prompt||item.audioUrl}</p><button style={btn} disabled={busy} onClick={()=>act(`/assessments/${type}/${item.id}`,'PATCH',{approved:!item.approved})}>{item.approved?'Revoke approval':'Approve'}</button></div>)}</div>)}</section>}
  {tab==='audit'&&<section style={panel}><h2>Recent administrator actions</h2>{logs.map(l=><div key={l.id} style={{borderTop:'1px solid #333',padding:10}}><strong>{l.action}</strong> Â· {l.targetType} {l.targetId}<div style={{color:'#aaa',fontSize:12}}>{new Date(l.createdAt).toLocaleString()} Â· Admin {l.adminId}</div></div>)}{!logs.length&&<p>No actions recorded.</p>}</section>}
 </main>
}
