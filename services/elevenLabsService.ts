
import type { AudioAsset } from '../types';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Fallback when server is not configured
const generateMockAudio = async (_prompt: string, name: string): Promise<AudioAsset> => {
  await sleep(300);
  return { url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', name };
};

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
  // Always return a fast blob URL (no R2 upload)
  const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
  return { url, name };
};

export const generateVoiceover = async (text: string, name: string, voiceId: string): Promise<AudioAsset> => {
  const r = await fetch('/api/elevenlabs/tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId })
  });
  if (!r.ok) throw new Error('TTS generation failed');
  const buf = await r.arrayBuffer();
  // Always return a fast blob URL (no R2 upload)
  const url = URL.createObjectURL(new Blob([buf], { type: 'audio/mpeg' }));
  return { url, name };
};
