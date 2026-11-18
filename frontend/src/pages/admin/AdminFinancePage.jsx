import { useCallback, useEffect, useState } from 'react';
const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
const format = kobo => `₦${(Number(kobo || 0)/100).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const panel = {background:'#171717',border:'1px solid #353535',borderRadius:16,padding:20,marginBottom:20};
export default function AdminFinancePage(){
 
 const [data,setData] = useState(null),[error,setError] = useState(''),[loading,setLoading] = useState(false);
 const refresh=useCallback(async()=>{
  
  setLoading(true);setError('');
  try{const response=await fetch(`${API}/api/admin/finance/overview`,{credentials:'include',cache:'no-store'});
   const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.message||`Request failed (${response.status})`);setData(body);
  }catch(e){setData(null);setError(e.message);}finally{setLoading(false);}
 },[]);
 useEffect(()=>{refresh()},[refresh]);
 const sections=[['Student payments','payments'],['Course allocations','allocations'],['Client projects','contracts'],['Withdrawals','withdrawals']];
 return <main style={{minHeight:'100vh',background:'#090909',color:'#f7f7f7',fontFamily:'Arial,sans-serif',padding:'clamp(18px,4vw,48px)'}}>
  <header style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12,marginBottom:30}}><div><div style={{color:'#ef4444',fontWeight:700}}>NEXACORE · ADMIN</div><h1>Finance & payouts</h1><p style={{color:'#a3a3a3'}}>Verified database records; test payouts only. No sample transactions.</p></div><button onClick={refresh} disabled={loading} style={{background:'#b91c1c',color:'white',border:0,padding:'12px 18px',borderRadius:8,cursor:'pointer'}}>{loading?'Loading…':'Refresh records'}</button></header>
  {error&&<p role='alert' style={{background:'#401515',padding:14,borderRadius:8}}>{error}</p>}
  {data&&<><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:14}}>{sections.map(([label,key])=><section key={key} style={panel}><h2 style={{fontSize:17}}>{label}</h2>{data[key]?.length ? data[key].map(item=><div key={item.status} style={{borderTop:'1px solid #333',padding:'10px 0'}}><strong>{item.status}</strong><div>{item.count} records · {format(item.amountKobo)}</div></div>):<p style={{color:'#a3a3a3'}}>No records</p>}</section>)}</div><p style={{color:'#a3a3a3',fontSize:13}}>Updated {new Date(data.generatedAt).toLocaleString()}. Amounts represent records and allocations, not settled bank balances.</p></>}
  {data&&<div style={panel}><p>Withdrawal approvals are unavailable until a verified payout API is installed and secured.</p></div>}
  <p style={{color:'#aaa',fontSize:13}}>Only a backend-authenticated ADMIN may access this data or initiate a Paystack test transfer. Do not use the legacy local-only admin preview for financial approvals.</p>
 </main>;
}
