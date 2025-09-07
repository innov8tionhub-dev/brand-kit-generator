
import type { Typography, ColorPalette } from '../types';

// Client calls secured server APIs. No keys are used in the browser.

export const generateLogo = async (name: string, description: string, keywords: string): Promise<string> => {
  const r = await fetch('/api/gemini/logo', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, keywords })
  });
  if (!r.ok) throw new Error('Logo generation failed');
  const { image } = await r.json();
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

export const generateAdCopy = async (name: string, description: string, keywords: string): Promise<string> => {
  const r = await fetch('/api/gemini/ad-copy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, keywords })
  });
  if (!r.ok) throw new Error('Ad copy generation failed');
  const { copy } = await r.json();
  return copy;
};

export const generateBrandImagery = async (description: string, keywords: string): Promise<string[]> => {
  const r = await fetch('/api/gemini/imagery', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, keywords, count: 2 })
  });
  if (!r.ok) throw new Error('Brand imagery generation failed');
  const { images } = await r.json();
  return images;
};
