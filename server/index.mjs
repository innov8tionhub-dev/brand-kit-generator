import dotenv from 'dotenv';
// Load local env first then fallback to .env
dotenv.config({ path: '.env.local' });
dotenv.config();
import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

if (!GEMINI_API_KEY) console.warn('GEMINI_API_KEY not set');
if (!ELEVENLABS_API_KEY) console.warn('ELEVENLABS_API_KEY not set');

const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
const xi = ELEVENLABS_API_KEY ? new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY }) : null;

// Gemini endpoints
app.post('/api/gemini/logo', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const { name, description, keywords } = req.body || {};
    const prompt = `Minimalist vector logo for a brand named "${name}". The brand is about: ${description}. Keywords: ${keywords}. The logo should be on a clean, solid #f0f0f0 background. Flat 2D style. No text in the logo.`;
    const response = await genAI.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: { parts: [{ text: prompt }] },
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return res.json({ image: part.inlineData.data });
    }
    res.status(500).json({ error: 'No image data' });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/gemini/palette', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const { description, keywords } = req.body || {};
    const prompt = `Generate a 5-color brand palette for a brand described as "${description}". The vibe should be ${keywords}. The colors should be modern and complementary.`;
    const response = await genAI.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            palette: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });
    const json = JSON.parse(response.text);
    res.json({ palette: json.palette });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/gemini/typography', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const { description, keywords } = req.body || {};
    const prompt = `Suggest a heading font and a body font pairing from Google Fonts for a brand described as "${description}". The vibe is ${keywords}. The fonts should be highly readable and web-safe.`;
    const response = await genAI.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            headingFont: { type: Type.STRING },
            bodyFont: { type: Type.STRING }
          }
        }
      }
    });
    res.json(JSON.parse(response.text));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/gemini/imagery', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const { description, keywords, count = 2 } = req.body || {};
    const prompt = `An abstract, high-quality background image suitable for a brand website. The brand is about: ${description}. The mood should be ${keywords}. Photorealistic, subtle, professional.`;
    const gen = async () => {
      const response = await genAI.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: { parts: [{ text: prompt }] },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) return part.inlineData.data;
      }
      throw new Error('No image data');
    };
    const results = await Promise.all(Array.from({ length: Number(count) }, gen));
    res.json({ images: results });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/gemini/ad-copy', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const { name, description, keywords } = req.body || {};
    const prompt = `Write a short, 15–25 second ad script for a company called ${name}. The brand is: ${description}. Vibe/keywords: ${keywords}. Include a strong opening hook, one key benefit, and a clear call-to-action. Plain text only.`;
    const response = await genAI.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
    });
    res.json({ copy: (response.text || '').trim() });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ElevenLabs endpoints
app.get('/api/elevenlabs/voices', async (_req, res) => {
  try {
    if (!ELEVENLABS_API_KEY) return res.json({ voices: [] });
    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
    });
    if (!r.ok) return res.json({ voices: [] });
    const json = await r.json();
    const voices = (json.voices || []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      previewUrl: v.preview_url || v.samples?.[0]?.preview_url || undefined,
    }));
    res.json({ voices });
  } catch (e) {
    res.json({ voices: [] });
  }
});

app.post('/api/elevenlabs/music', async (req, res) => {
  try {
    if (!xi) return res.status(500).json({ error: 'ElevenLabs not configured' });
    const { prompt, lengthMs = 15000 } = req.body || {};
    const bytes = await xi.music.compose({ prompt, musicLengthMs: Number(lengthMs) });
    const buf = Buffer.from(bytes);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buf);
  } catch (e) {
    console.error('ElevenLabs music error:', e);
    res.status(500).json({ error: e?.message || 'Music generation failed' });
  }
});

app.post('/api/elevenlabs/tts', async (req, res) => {
  try {
    if (!xi) return res.status(500).json({ error: 'ElevenLabs not configured' });
    const { text, voiceId, modelId = 'eleven_multilingual_v2', outputFormat = 'mp3_44100_128' } = req.body || {};
    if (!text || !voiceId) return res.status(400).json({ error: 'Missing text or voiceId' });
    const bytes = await xi.textToSpeech.convert(voiceId, { text, modelId, outputFormat });
    const buf = Buffer.from(bytes);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buf);
  } catch (e) {
    console.error('ElevenLabs TTS error:', e);
    res.status(500).json({ error: e?.message || 'TTS generation failed' });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});

