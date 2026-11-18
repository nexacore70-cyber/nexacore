import { useEffect, useState } from 'react';
const API=(import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/,'');
export default function AdminPayoutPanel({token}) {
 const [items,setItems]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState('');
 async function request(path,method='GET') {const r=await fetch(`${API}/api/payouts${path}`,{method,headers:{Authorization:`Bearer ${token}`}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.message||'Request failed');return d;}
 async function refresh(){try{setItems((await request('/admin/withdrawals')).withdrawals||[]);}catch(e){setError(e.message);}}
 useEffect(()=>{if(token)refresh();},[token]);
 async function act(id,verb){if(!window.confirm(`Confirm ${verb} for withdrawal ${id}?`))return;setBusy(id);setError('');try{await request(`/admin/withdrawals/${encodeURIComponent(id)}/${verb}`,'POST');await refresh();}catch(e){setError(e.message);}finally{setBusy('');}}
 return <section><h2>Paystack TEST withdrawal approvals</h2><p>Verify the recipient and transaction before sending. Never blindly retry a transfer.</p>{error&&<p role='alert'>{error}</p>}
 {items.length===0&&<p>No withdrawal requests found.</p>}<table><thead><tr><th>Account</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map(w=><tr key={w.id}><td>{w.userId}</td><td>₦{(Number(w.amountKobo)/100).toLocaleString('en-NG')}</td><td>{w.status}</td><td>{w.status==='PENDING'&&<><button disabled={!!busy} onClick={()=>act(w.id,'send')}>Send test transfer</button><button disabled={!!busy} onClick={()=>act(w.id,'reject')}>Reject</button></>}{w.status==='PROCESSING'&&<button disabled={!!busy} onClick={()=>act(w.id,'reconcile')}>Verify status</button>}</td></tr>)}</tbody></table></section>;
}
