import React from 'react';

export const MyShares: React.FC = () => {
  const [userId, setUserId] = React.useState('');
  const [shares, setShares] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  React.useEffect(() => {
    const uid = localStorage.getItem('brand_user_id');
    if (uid) {
      setUserId(uid);
      (async () => {
        try {
          setLoading(true);
          const r = await fetch(`/api/user/shares?id=${uid}`);
          const j = await r.json();
          setShares(j.shares || []);
        } catch {}
        finally { setLoading(false); }
      })();
    }
  }, []);

  const loadShares = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const r = await fetch(`/api/user/shares?id=${encodeURIComponent(userId)}`);
      const j = await r.json();
      setShares(j.shares || []);
    } catch {}
    finally { setLoading(false); }
  };

  return (
    <div className="p-4 border border-gray-700 rounded-lg bg-gray-800/50">
      <div className="flex items-center gap-2 mb-3">
        <input value={userId} onChange={(e)=>setUserId(e.target.value)} placeholder="Anonymous user ID" className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1"/>
        <button onClick={async ()=>{try{await navigator.clipboard.writeText(userId);}catch{}}} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm">Copy ID</button>
        <button onClick={loadShares} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm">Load</button>
      </div>
      {loading ? <p className="text-gray-400 text-sm">Loading...</p> : (
        shares.length === 0 ? <p className="text-gray-400 text-sm">No shares yet.</p> : (
          <ul className="space-y-2">
            {shares.map((id) => (
              <li key={id} className="flex items-center justify-between bg-gray-700/40 rounded px-2 py-1">
                <a className="text-brand-blue underline" href={`/?share=${id}`}>/?share={id}</a>
                <div className="flex gap-2">
                  <button onClick={async ()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/?share=${id}`);}catch{}}} className="text-xs underline">Copy</button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
};

