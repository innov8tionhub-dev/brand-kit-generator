import React from 'react';

export const ToastHost: React.FC = () => {
  const [msg, setMsg] = React.useState<string | null>(null);
  React.useEffect(() => {
    const onToast = (e: any) => {
      setMsg(e.detail?.message || '');
      setTimeout(() => setMsg(null), 2000);
    };
    window.addEventListener('app:toast', onToast as any);
    return () => window.removeEventListener('app:toast', onToast as any);
  }, []);
  if (!msg) return null;
  return (
    <div style={{ position: 'fixed', bottom: 20, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10000 }}>
      <div className="px-4 py-2 rounded bg-gray-900 text-white shadow-lg">{msg}</div>
    </div>
  );
};

