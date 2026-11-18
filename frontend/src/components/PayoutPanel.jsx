import { useEffect, useState } from 'react';

// Mount inside authenticated Tutor or Talent workspace with <PayoutPanel token={authToken} />.
// Uses the existing backend API; does not simulate transfers or store account numbers.
const API = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '');
export default function PayoutPanel({ token }) {
  const [banks, setBanks] = useState([]), [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null), [withdrawals, setWithdrawals] = useState([]);
  const [bankCode, setBankCode] = useState(''), [accountNumber, setAccountNumber] = useState('');
  const [amount, setAmount] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  async function api(path, body) {
    const r = await fetch(`${API}/api/payouts${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type':'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.message || 'Request failed'); return j;
  }
  async function refresh() {
    const [a,b,w] = await Promise.all([api('/account'),api('/balance'),api('/withdrawals')]);
    setAccount(a.account); setBalance(b); setWithdrawals(w.withdrawals || []);
  }
  useEffect(() => { if (!token) return; refresh().catch(e=>setMessage(e.message)); api('/banks').then(x=>setBanks(x.banks || [])).catch(e=>setMessage(e.message)); }, [token]);
  async function submit(fn) { setBusy(true); setMessage(''); try { await fn(); await refresh(); } catch(e) { setMessage(e.message); } finally { setBusy(false); } }
  if (!token) return <p>Sign in to manage payouts.</p>;
  return <section style={{padding:24, border:'1px solid #444', borderRadius:12}}>
    <h2>Bank account & withdrawals</h2>
    <p>Available: ₦{(Number(balance?.availableKobo || 0)/100).toLocaleString('en-NG',{minimumFractionDigits:2})}</p>
    {account ? <p>Verified account: {account.accountName} ····{account.accountLast4}</p> : <p>No bank account verified.</p>}
    <form onSubmit={e=>{e.preventDefault();submit(async()=>{await api('/account',{bankCode,accountNumber});setAccountNumber('');setMessage('Bank verified.');});}}>
      <label>Bank <select value={bankCode} onChange={e=>setBankCode(e.target.value)} required><option value=''>Choose bank</option>{banks.map(b=><option key={b.code} value={b.code}>{b.name}</option>)}</select></label>
      <label>Account number <input inputMode='numeric' maxLength={10} pattern='[0-9]{10}' value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} required /></label>
      <button disabled={busy}>Verify bank</button>
    </form>
    <form onSubmit={e=>{e.preventDefault();submit(async()=>{const kobo=Math.round(Number(amount)*100);if(!Number.isSafeInteger(kobo)||kobo<10000)throw Error('Minimum withdrawal is ₦100');await api('/withdrawals',{amountKobo:kobo});setAmount('');setMessage('Request submitted for administrator approval.');});}}>
      <label>Withdrawal amount (₦) <input type='number' min='100' step='.01' value={amount} onChange={e=>setAmount(e.target.value)} required /></label>
      <button disabled={busy || !account}>Request withdrawal</button>
    </form>
    {message && <p role='status'>{message}</p>}
    <h3>Recent withdrawals</h3><ul>{withdrawals.map(w=><li key={w.id}>₦{(Number(w.amountKobo)/100).toLocaleString('en-NG')} — {w.status}</li>)}</ul>
    <small>Transfers require administrator action and Paystack confirmation. Test mode only.</small>
  </section>;
}
