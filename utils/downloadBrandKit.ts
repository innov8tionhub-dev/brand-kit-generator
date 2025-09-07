import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { BrandKit } from '../types';

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

async function fetchAsArrayBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch asset: ${res.status}`);
  return await res.arrayBuffer();
}

export async function downloadBrandKit(brandKit: BrandKit) {
  const zip = new JSZip();

  // Metadata (no secrets)
  const metadata = {
    name: brandKit.name,
    colorPalette: brandKit.colorPalette,
    typography: brandKit.typography,
    ad: brandKit.ad ? {
      copy: brandKit.ad.copy,
      voiceId: brandKit.ad.voiceId,
      voiceName: brandKit.ad.voiceName,
      hasAudio: !!brandKit.ad.audioUrl,
    } : undefined,
    generatedAt: new Date().toISOString(),
  };
  zip.file('brandkit.json', JSON.stringify(metadata, null, 2));

  // Logo
  try {
    const logoBytes = Uint8Array.from(atob(brandKit.logo), c => c.charCodeAt(0));
    zip.file('logo.png', logoBytes);
  } catch {}

  // Imagery
  const imagesFolder = zip.folder('images');
  if (imagesFolder) {
    for (let i = 0; i < brandKit.imagery.length; i++) {
      try {
        const bytes = Uint8Array.from(atob(brandKit.imagery[i]), c => c.charCodeAt(0));
        imagesFolder.file(`image-${i + 1}.png`, bytes);
      } catch {}
    }
  }

  // Audio
  const audioFolder = zip.folder('audio');
  if (audioFolder) {
    try {
      const introBuf = await fetchAsArrayBuffer(brandKit.audio.intro.url);
      audioFolder.file('intro.mp3', introBuf);
    } catch {}
    try {
      const outroBuf = await fetchAsArrayBuffer(brandKit.audio.outro.url);
      audioFolder.file('outro.mp3', outroBuf);
    } catch {}

    if (brandKit.ad?.audioUrl) {
      try {
        const adBuf = await fetchAsArrayBuffer(brandKit.ad.audioUrl);
        audioFolder.file('ad-voiceover.mp3', adBuf);
      } catch {}
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `brand-kit-${slugify(brandKit.name)}-${Date.now()}.zip`;
  saveAs(blob, filename);
}

