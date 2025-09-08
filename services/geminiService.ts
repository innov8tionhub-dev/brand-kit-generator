
import type { Typography, ColorPalette, LogoVariants } from '../types';
import { resizeBase64ToAspect } from '../utils/image';

// Client calls secured server APIs. No keys are used in the browser.

export const generateLogo = async (name: string, description: string, keywords: string): Promise<string> => {
  // Prefer variants endpoint; gracefully fall back to single-logo endpoint if unavailable in dev
  try {
    const r = await fetch('/api/gemini/logo-variants', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, keywords })
    });
    if (r.ok) {
      const { primary } = await r.json();
      if (primary) return primary;
    }
  } catch {}
  // Fallback to legacy single-logo endpoint
  const r2 = await fetch('/api/gemini/logo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, keywords })
  });
  if (!r2.ok) throw new Error('Logo generation failed');
  const { image } = await r2.json();
  return image;
};

export const generateColorPalette = async (description: string, keywords: string): Promise<ColorPalette> => {
  const r = await fetch('/api/gemini/palette', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, keywords })
  });
  if (!r.ok) throw new Error('Color palette generation failed');
  const { palette } = await r.json();
  return palette;
};

export const generateTypography = async (description: string, keywords: string): Promise<Typography> => {
  const r = await fetch('/api/gemini/typography', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, keywords })
  });
  if (!r.ok) throw new Error('Typography generation failed');
  return await r.json();
};

export const generateAdCopy = async (
  name: string,
  description: string,
  keywords: string,
  tone?: string
): Promise<{ script: string; voiceover: string }> => {
  const r = await fetch('/api/gemini/ad-copy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, keywords, tone })
  });
  if (!r.ok) throw new Error('Ad copy generation failed');
  const { script, voiceover } = await r.json();
  return { script, voiceover };
};

export const generateBrandImagery = async (description: string, keywords: string): Promise<string[]> => {
  // Enhanced prompt to produce on-brand abstract assets suitable for backgrounds and patterns.
  const r = await fetch('/api/gemini/imagery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, keywords: `${keywords}. Clean brand backgrounds, abstract motifs, subtle geometry, high contrast, ample whitespace. No text, no watermark.`, count: 2 })
  });
  if (!r.ok) throw new Error('Brand imagery generation failed');
  const { images } = await r.json();
  return images;
};

export const editImage = async (imageBase64: string, instruction: string): Promise<string> => {
  const r = await fetch('/api/gemini/edit-image', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64, instruction })
  });
  if (!r.ok) throw new Error('Edit image failed');
  const { image } = await r.json();
  return image;
};

export async function generateAdVideo(prompt: string, aspectRatio: '16:9'|'9:16'|'1:1' = '16:9') {
  const r = await fetch('/api/fal/veo3fast', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspect_ratio: aspectRatio, audio_enabled: true })
  });
  if (!r.ok) throw new Error('Video generation failed');
  const { data } = await r.json();
  // FAL returns URLs in data. Find the primary video URL.
  const url = data?.video?.url || data?.output?.[0]?.url || data?.result?.url || data?.url;
  return { url, aspectRatio };
}

export const generateSocialBackdrops = async (
  name: string,
  description: string,
  keywords: string
): Promise<{ platform: 'instagram'|'tiktok'|'linkedin'; image: string }[]> => {
  const platforms = [
    { platform: 'instagram', guidance: 'square 1:1 composition, space for overlay text, bold focal point', w: 1080, h: 1080 },
    { platform: 'tiktok', guidance: 'vertical 9:16 composition, top/bottom safe areas for overlay text', w: 1080, h: 1920 },
    { platform: 'linkedin', guidance: 'landscape 1.91:1 composition, professional tone, left-safe text area', w: 1200, h: Math.round(1200/1.91) },
  ] as const;
  const results: { platform: 'instagram'|'tiktok'|'linkedin'; image: string }[] = [];
  for (const p of platforms) {
    const prompt = `Social media backdrop for ${name}. Brand: ${description}. Vibe/keywords: ${keywords}. ${p.guidance}. Abstract, clean, high-contrast background suitable for adding text overlay. No typography, no logos.`;
    const resp = await fetch('/api/gemini/imagery', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: prompt, keywords: '', count: 1 })
    });
    if (resp.ok) {
      const { images } = await resp.json();
      if (images?.[0]) {
        // Post-process to exact platform dimensions using canvas-based cover
        const resized = await resizeBase64ToAspect(images[0], p.w, p.h, 'image/jpeg', 0.9);
        results.push({ platform: p.platform as any, image: resized });
      }
    }
  }
  return results;
};

export async function generateVideoPrompt(name: string | undefined, script: string, aspectRatio: '16:9'|'9:16'|'1:1' = '16:9'): Promise<string> {
  const r = await fetch('/api/gemini/video-prompt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, script, aspect_ratio: aspectRatio })
  });
  if (!r.ok) return script;
  const { prompt } = await r.json();
  return prompt || script;
}

export const generateLogoVariants = async (name: string, description: string, keywords: string): Promise<LogoVariants> => {
  const r = await fetch('/api/gemini/logo-variants', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, keywords })
  });
  if (!r.ok) throw new Error('Logo variants generation failed');
  const { primary, secondary, submark } = await r.json();
  return { primary, secondary, submark };
};

export async function generateRandomBrand(): Promise<{ name: string; description: string; keywords: string; tone?: string }> {
  const r = await fetch('/api/gemini/random-brand', { method: 'POST' });
  if (!r.ok) throw new Error('Random brand generation failed');
  const data = await r.json();
  return data;
}
