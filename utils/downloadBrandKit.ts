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

async function fetchTyped(url: string): Promise<{ buffer: ArrayBuffer; contentType: string | null }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch asset: ${res.status}`);
  const buffer = await res.arrayBuffer();
  const contentType = res.headers.get('content-type');
  return { buffer, contentType };
}

export async function downloadBrandKit(brandKit: BrandKit) {
  const zip = new JSZip();

  // Metadata (no secrets)
  const refType = (s: string) => /^https?:\/\//i.test(s) ? 'url' : 'inline';
  const metadata = {
    name: brandKit.name,
    colorPalette: brandKit.colorPalette,
    typography: brandKit.typography,
    assets: {
      logos: brandKit.logos
        ? {
            primary: refType(brandKit.logos.primary),
            secondary: refType(brandKit.logos.secondary),
            submark: refType(brandKit.logos.submark),
          }
        : { primary: refType(brandKit.logo) },
      imageryCount: brandKit.imagery.length,
      socialBackdrops: (brandKit.socialBackdrops || []).map((bg) => ({ platform: bg.platform, type: refType(bg.image) })),
      audio: {
        hasIntro: !!brandKit.audio.intro.url,
        hasOutro: !!brandKit.audio.outro.url,
      },
    },
    ad: brandKit.ad
      ? {
          voiceId: brandKit.ad.voiceId,
          voiceName: brandKit.ad.voiceName,
          hasVoiceoverAudio: !!brandKit.ad.audioUrl,
        }
      : undefined,
    adVideo: brandKit.adVideo ? { url: brandKit.adVideo.url, aspectRatio: brandKit.adVideo.aspectRatio } : undefined,
    generatedAt: new Date().toISOString(),
  };
  zip.file('brandkit.json', JSON.stringify(metadata, null, 2));

  // Logo(s)
  const isUrl = (s: string) => /^https?:\/\//i.test(s);
  try {
    if (isUrl(brandKit.logo)) {
      const buf = await fetchAsArrayBuffer(brandKit.logo);
      zip.file('logo.png', buf);
    } else {
      const logoBytes = Uint8Array.from(atob(brandKit.logo), c => c.charCodeAt(0));
      zip.file('logo.png', logoBytes);
    }
  } catch {}
  if (brandKit.logos) {
    try {
      if (isUrl(brandKit.logos.primary)) { zip.file('logo-primary.png', await fetchAsArrayBuffer(brandKit.logos.primary)); }
      else { const b = Uint8Array.from(atob(brandKit.logos.primary), c => c.charCodeAt(0)); zip.file('logo-primary.png', b); }
    } catch {}
    try {
      if (isUrl(brandKit.logos.secondary)) { zip.file('logo-secondary.png', await fetchAsArrayBuffer(brandKit.logos.secondary)); }
      else { const b = Uint8Array.from(atob(brandKit.logos.secondary), c => c.charCodeAt(0)); zip.file('logo-secondary.png', b); }
    } catch {}
    try {
      if (isUrl(brandKit.logos.submark)) { zip.file('logo-submark.png', await fetchAsArrayBuffer(brandKit.logos.submark)); }
      else { const b = Uint8Array.from(atob(brandKit.logos.submark), c => c.charCodeAt(0)); zip.file('logo-submark.png', b); }
    } catch {}
  }

  // Imagery
  const imagesFolder = zip.folder('images');
  if (imagesFolder) {
    const isUrl = (s: string) => /^https?:\/\//i.test(s);
    for (let i = 0; i < brandKit.imagery.length; i++) {
      try {
        const v = brandKit.imagery[i];
        if (isUrl(v)) imagesFolder.file(`image-${i + 1}.png`, await fetchAsArrayBuffer(v));
        else {
          const bytes = Uint8Array.from(atob(v), c => c.charCodeAt(0));
          imagesFolder.file(`image-${i + 1}.png`, bytes);
        }
      } catch {}
    }
  }

  // Social backdrops
  const socialFolder = zip.folder('social');
  if (socialFolder && brandKit.socialBackdrops) {
    const isUrl = (s: string) => /^https?:\/\//i.test(s);
    for (const bg of brandKit.socialBackdrops) {
      try {
        const v = bg.image;
        if (isUrl(v)) socialFolder.file(`${bg.platform}.png`, await fetchAsArrayBuffer(v));
        else {
          const bytes = Uint8Array.from(atob(v), c => c.charCodeAt(0));
          socialFolder.file(`${bg.platform}.png`, bytes);
        }
      } catch {}
    }
  }

// Audio — only include files that actually exist
const isFetchable = (u?: string) => !!u && (/^https?:\/\//i.test(u) || u.startsWith('blob:'));
let audioFolder: JSZip | null = null;
const ensureAudio = (): JSZip => (audioFolder ??= (zip.folder('audio') as unknown as JSZip));

try {
  if (isFetchable(brandKit.audio.intro.url)) {
    const introBuf = await fetchAsArrayBuffer(brandKit.audio.intro.url);
    ensureAudio().file('intro.mp3', introBuf);
  }
} catch {}

try {
  if (isFetchable(brandKit.audio.outro.url)) {
    const outroBuf = await fetchAsArrayBuffer(brandKit.audio.outro.url);
    ensureAudio().file('outro.mp3', outroBuf);
  }
} catch {}

if (brandKit.ad?.audioUrl) {
  try {
    if (isFetchable(brandKit.ad.audioUrl)) {
      const { buffer, contentType } = await fetchTyped(brandKit.ad.audioUrl);
      const ext = contentType?.includes('wav') ? 'wav' : contentType?.includes('ogg') ? 'ogg' : 'mp3';
      ensureAudio().file(`ad-voiceover.${ext}`, buffer);
    }
  } catch {}
}

  // Video (if available)
  try {
    if (brandKit.adVideo?.url && isFetchable(brandKit.adVideo.url)) {
      const { buffer, contentType } = await fetchTyped(brandKit.adVideo.url);
      let ext = 'mp4';
      if (contentType?.includes('webm')) ext = 'webm';
      else if (contentType?.includes('quicktime') || /\.mov(\?|$)/i.test(brandKit.adVideo.url)) ext = 'mov';
      else if (/\.webm(\?|$)/i.test(brandKit.adVideo.url)) ext = 'webm';
      else if (/\.mp4(\?|$)/i.test(brandKit.adVideo.url)) ext = 'mp4';
      zip.file(`ad-video.${ext}`, buffer);
    }
  } catch {}

  const blob = await zip.generateAsync({ type: 'blob' });
  const filename = `brand-kit-${slugify(brandKit.name)}-${Date.now()}.zip`;
  saveAs(blob, filename);
}

