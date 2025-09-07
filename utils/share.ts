import type { BrandKit } from '../types';
import { uploadToR2 } from './r2';
import { isUrlLike } from './image';

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

export async function shareBrandKit(brandKit: BrandKit) {
  // Ensure assets are persisted to R2 and construct a URL-based share payload to keep request small
  const slug = slugify(brandKit.name || 'brand');

  // Logos
  let logos = brandKit.logos;
  if (logos) {
    const ensureUrl = async (value: string, key: string) => isUrlLike(value) ? value : await uploadToR2(`data:image/png;base64,${value}`, key, 'image/png');
    logos = {
      primary: await ensureUrl(logos.primary, `logos/${slug}-primary-${crypto.randomUUID()}.png`),
      secondary: await ensureUrl(logos.secondary, `logos/${slug}-secondary-${crypto.randomUUID()}.png`),
      submark: await ensureUrl(logos.submark, `logos/${slug}-submark-${crypto.randomUUID()}.png`)
    } as any;
  } else if (brandKit.logo) {
    // Backward compat: single logo
    const logoUrl = isUrlLike(brandKit.logo) ? brandKit.logo : await uploadToR2(`data:image/png;base64,${brandKit.logo}`, `logos/${slug}-primary-${crypto.randomUUID()}.png`, 'image/png');
    logos = { primary: logoUrl, secondary: logoUrl, submark: logoUrl } as any;
  }

  // Imagery
  const imagery: string[] = [];
  for (let i = 0; i < (brandKit.imagery || []).length; i++) {
    const v = brandKit.imagery[i];
    const url = isUrlLike(v) ? v : await uploadToR2(`data:image/png;base64,${v}`, `images/${slug}-${i + 1}-${crypto.randomUUID()}.png`, 'image/png');
    imagery.push(url);
  }

  // Social backdrops
  const socialBackdrops = (brandKit.socialBackdrops || []).map(async (bg, idx) => {
    const url = isUrlLike(bg.image) ? bg.image : await uploadToR2(`data:image/png;base64,${bg.image}`, `social/${bg.platform}-${idx}-${crypto.randomUUID()}.png`, 'image/png');
    return { platform: bg.platform, image: url };
  });
  const social = await Promise.all(socialBackdrops);

  // Anonymous user id
  let uid = localStorage.getItem('brand_user_id');
  if (!uid) { uid = crypto.randomUUID(); localStorage.setItem('brand_user_id', uid); }

  const payload = {
    name: brandKit.name,
    logo: logos?.primary || brandKit.logo,
    logos,
    colorPalette: brandKit.colorPalette,
    typography: brandKit.typography,
    imagery,
    socialBackdrops: social,
    ad: brandKit.ad ? {
      copyScript: brandKit.ad.copyScript,
      voiceoverText: brandKit.ad.voiceoverText,
      voiceId: brandKit.ad.voiceId,
      voiceName: brandKit.ad.voiceName,
    } : undefined,
    adVideo: brandKit.adVideo ? { url: brandKit.adVideo.url, aspectRatio: brandKit.adVideo.aspectRatio } : undefined,
  };

  const res = await fetch('/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': localStorage.getItem('brand_user_id') || '' },
    body: JSON.stringify({ brandKit: payload })
  });
  if (!res.ok) throw new Error('Share failed');
  const { id } = await res.json();
  const url = `${window.location.origin}/?share=${id}`;
  try { await navigator.clipboard.writeText(url); } catch {}
  return url;
}

