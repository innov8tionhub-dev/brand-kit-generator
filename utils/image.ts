export async function resizeBase64ToAspect(base64: string, w: number, h: number, mime: string = 'image/jpeg', quality = 0.92): Promise<string> {
  const img = new Image();
  img.src = `data:image/png;base64,${base64}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // cover behavior
  const scale = Math.max(w / img.width, h / img.height);
  const dW = img.width * scale;
  const dH = img.height * scale;
  const dx = (w - dW) / 2;
  const dy = (h - dH) / 2;
  ctx.drawImage(img, dx, dy, dW, dH);
  const dataUrl = canvas.toDataURL(mime, quality);
  return dataUrl.split(',')[1];
}

export function downloadBase64(base64: string, filename: string, mime = 'image/png') {
  const a = document.createElement('a');
  a.href = `data:${mime};base64,${base64}`;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

