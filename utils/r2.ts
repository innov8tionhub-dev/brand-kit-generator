export async function uploadToR2(base64: string, key: string, contentType = 'image/png') {
  const r = await fetch('/api/r2/upload', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, key, contentType })
  });
  if (!r.ok) throw new Error('Upload failed');
  const { url } = await r.json();
  return url as string;
}

