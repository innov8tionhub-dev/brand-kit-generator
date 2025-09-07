import type { BrandKit } from '../types';

export async function shareBrandKit(brandKit: BrandKit) {
  // anonymous user id
  let uid = localStorage.getItem('brand_user_id');
  if (!uid) {
    uid = crypto.randomUUID();
    localStorage.setItem('brand_user_id', uid);
  }
  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': localStorage.getItem('brand_user_id') || '' },
    body: JSON.stringify({ brandKit })
  });
  if (!res.ok) throw new Error('Share failed');
  const { id } = await res.json();
  const url = `${window.location.origin}/?share=${id}`;
  try { await navigator.clipboard.writeText(url); } catch {}
  return url;
}

