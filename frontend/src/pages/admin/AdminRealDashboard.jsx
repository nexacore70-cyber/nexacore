import { useCallback, useEffect, useState } from 'react';
const API = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const money = kobo => `₦${(Number(kobo || 0) / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cards = [
  ['users','Total accounts'], ['students','Students'], ['tutors','Tutors'],
  ['clients','Clients'], ['talents','Talent'], ['pendingAccounts','Pending accounts'],
  ['enrollments','Enrollments'], ['projects','Project contracts'],
  ['pendingWithdrawals','Pending withdrawals'], ['pendingAssessments','Assessments without final result'],
  ['verifiedPayments','Verified payments']
];
export default function AdminRealDashboard() {
  const [data,setData] = useState(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API}/api/admin/control/dashboard`, { credentials:'include', cache:'no-store' });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.message || `Dashboard request failed (${response.status})`);
      setData(json);
    } catch (e) { setData(null); setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return <div className="space-y-7">
    <section className="rounded-[30px] bg-neutral-950 px-7 py-9 text-white sm:px-10">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-red-400">NEXACORE · ADMIN</p>
      <h2 className="mt-3 text-3xl font-black">Live platform overview</h2>
      <p className="mt-3 text-sm text-white/60">Counts and records from PostgreSQL. No preview records or sample transactions.</p>
      <button type="button" onClick={refresh} disabled={loading} className="mt-6 rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Loading…' : 'Refresh database'}</button>
    </section>
    {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800">{error}. No cached or invented figures will be shown.</div>}
    {data && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([key,label]) => <section key={key} className="rounded-2xl border border-neutral-200 bg-white p-6"><p className="text-sm font-semibold text-neutral-500">{label}</p><p className="mt-3 text-3xl font-black text-neutral-950">{data.counts[key] ?? '—'}</p></section>)}
        <section className="rounded-2xl border border-neutral-200 bg-white p-6 sm:col-span-2"><p className="text-sm font-semibold text-neutral-500">Verified NGN payment inflow</p><p className="mt-3 text-3xl font-black">{money(data.verifiedPaymentInflowKobo)}</p><p className="mt-2 text-xs text-neutral-500">Not platform profit or settled bank balance</p></section>
      </div>
      <section className="rounded-2xl border border-neutral-200 bg-white p-6"><h3 className="text-xl font-black">Recently registered accounts</h3>
        {data.recentUsers.length ? <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-neutral-500"><th className="py-3">Name</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{data.recentUsers.map(u=><tr key={u.id} className="border-b border-neutral-100"><td className="py-3">{u.fullName}</td><td>{u.email}</td><td>{u.role}</td><td>{u.status}</td></tr>)}</tbody></table></div> : <p className="mt-4 text-neutral-500">No accounts found.</p>}
      </section>
      <p className="text-xs text-neutral-500">Last database refresh: {new Date(data.generatedAt).toLocaleString()}</p>
    </>}
    <div className="flex flex-wrap gap-3"><a href="/admin/control" className="rounded-full bg-neutral-950 px-5 py-3 text-sm font-bold text-white">Manage real accounts and assessments</a><a href="/admin/finance" className="rounded-full bg-red-600 px-5 py-3 text-sm font-bold text-white">View finance records</a></div>
  </div>;
}
