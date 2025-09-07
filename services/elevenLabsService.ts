
import type { AudioAsset } from '../types';
import { uploadToR2 } from '../utils/r2';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fallback when server is not configured
const generateMockAudio = async (_prompt: string, name: string): Promise<AudioAsset> => {
  await sleep(300);
  return { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', name };
};

function abToBase64(ab: ArrayBuffer) {
  const bytes = new Uint8Array(ab);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export const fetchVoices = async (): Promise<{ id: string; name: string; previewUrl?: string }[]> => {
  const r = await fetch('/api/elevenlabs/voices');
  if (!r.ok) return [];
  const { voices } = await r.json();
  return voices || [];
};

export const generateMusic = async (prompt: string, name: string): Promise<AudioAsset> => {
  const r = await fetch('/api/elevenlabs/music', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, lengthMs: 15000 })
  });
  if (!r.ok) throw new Error('Music generation failed');
  const buf = await r.arrayBuffer();
  // Try to persist to R2; fall back to blob: URL.
  try {
    const base64 = abToBase64(buf);
    const key = `audio/music/${crypto.randomUUID()}.mp3`;
    const persistedUrl = await uploadToR2(`data:audio/mpeg;base64,${base64}`, key, 'audio/mpeg');
    return { url: persistedUrl, name };
  } catch {
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
    return { url, name };
  }
};

export const generateVoiceover = async (text: string, name: string, voiceId: string): Promise<AudioAsset> => {
  const r = await fetch('/api/elevenlabs/tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId })
  });
  if (!r.ok) throw new Error('TTS generation failed');
  const buf = await r.arrayBuffer();
  try {
    const base64 = abToBase64(buf);
    const key = `audio/tts/${crypto.randomUUID()}.mp3`;
    const persistedUrl = await uploadToR2(`data:audio/mpeg;base64,${base64}`, key, 'audio/mpeg');
    return { url: persistedUrl, name };
  } catch {
    const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
    return { url, name };
  }
};
