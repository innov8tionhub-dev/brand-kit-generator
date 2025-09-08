import dotenv from 'dotenv';
// Load local env first then fallback to .env
dotenv.config({ path: '.env.local' });
dotenv.config();
import express from 'express';
import cors from 'cors';
import { Redis } from '@upstash/redis';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { GoogleGenAI, Type, Modality } from '@google/genai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { randomUUID } from 'crypto';
import { fal } from '@fal-ai/client';
import { neon } from '@neondatabase/serverless';

const app = express();
app.use(cors());
// Increase JSON body limit to accommodate base64 images in shares
app.use(express.json({ limit: '25mb' }));

// Env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
// Rate-limit config
const RATE_LIMIT_DISABLED = String(process.env.RATE_LIMIT_DISABLED || '').toLowerCase() === 'true';
const RATE_LIMIT_MAX_PER_IP_PER_DAY = Number(process.env.RATE_LIMIT_MAX_PER_IP_PER_DAY || '2');

if (!GEMINI_API_KEY) console.warn('GEMINI_API_KEY not set');
if (!ELEVENLABS_API_KEY) console.warn('ELEVENLABS_API_KEY not set');

const genAI = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;
const xi = ELEVENLABS_API_KEY ? new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY }) : null;

// Redis (rate limiting + simple share index)
let redis = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  } catch {}
}

// FAL config
if (process.env.FAL_AI_KEY) {
  try { fal.config({ credentials: process.env.FAL_AI_KEY }); } catch {}
}

// Ephemeral share store (in-memory, 24h TTL)
const SHARE_STORE = new Map();
const SHARE_TTL_MS = 24 * 60 * 60 * 1000;

// R2 S3 client
let r2 = null;
if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID && process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY) {
  try {
    r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY,
      }
    });
  } catch {}
}

// Gemini endpoints
// Rate-limit helper (configurable)
async function checkRateLimit(req, res) {
  if (RATE_LIMIT_DISABLED) return true; // explicit bypass for demos/previews
  if (!redis) return true; // allow if Redis not configured
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket.remoteAddress || 'unknown').trim();
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const key = `runs:${ip}:${today}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 24*60*60);
  }
  if (count > RATE_LIMIT_MAX_PER_IP_PER_DAY) {
    return false;
  }
  return true;
}

app.post('/api/guard/start', async (req,res) => {
  try {
    const ok = await checkRateLimit(req,res);
    if (!ok) return res.status(429).json({ error: 'Daily run limit reached' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Guard failed' });
  }
});

app.post('/api/gemini/logo', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const { name, description, keywords } = req.body || {};
    const prompt = `Minimalist vector logo for a brand named "${name}". The brand is about: ${description}. Keywords: ${keywords}. The logo should be on a clean, solid #f0f0f0 background. Flat 2D style. No text in the logo.`;

    const extractImage = (response) => {
      const candidates = response?.candidates || [];
      for (const c of candidates) {
        const parts = c?.content?.parts || [];
        for (const p of parts) {
          if (p?.inlineData?.data) return p.inlineData.data;
          if (p?.inlineData?.mimeType && p?.inlineData?.data) return p.inlineData.data;
        }
      }
      return null;
    };

    const tryModel = async (modelName) => {
      try {
        const response = await genAI.models.generateContent({
          model: modelName,
          contents: { parts: [{ text: prompt }] },
          config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });
        return extractImage(response);
      } catch (err) {
        console.error('Gemini logo model error:', err);
        return null;
      }
    };

    let image = await tryModel(GEMINI_IMAGE_MODEL);
    if (!image) image = await tryModel('gemini-2.5-flash-image-preview');

    if (!image) {
      // Final graceful fallback: return a 1x1 transparent PNG so the app continues
      const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
      return res.json({ image: transparentPng, warning: 'No image data returned by model' });
    }

res.json({ image });
  } catch (e) {
    console.error('Gemini logo route error:', e);
    // Graceful fallback to avoid breaking the flow
    const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    res.json({ image: transparentPng, warning: 'Logo fallback due to server error' });
  }
});

// Generate primary/secondary/submark logo variants
app.post('/api/gemini/logo-variants', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const { name, description, keywords } = req.body || {};
    const mkPrompt = (variant) => {
      const common = `Brand: ${name}. About: ${description}. Vibe: ${keywords}. Clean vector aesthetic, flat 2D, high contrast, no text, no watermark, centered on neutral #f0f0f0 background.`;
      if (variant === 'primary') return `Primary logo mark. ${common} Balanced symbol suitable as main mark.`;
      if (variant === 'secondary') return `Secondary logo mark. ${common} Alternate lockup or simplified variation that complements the primary.`;
      return `Submark logo. ${common} Monogram/circular badge variant derived from the primary mark.`;
    };
    const extractImage = (response) => {
      const candidates = response?.candidates || [];
      for (const c of candidates) {
        const parts = c?.content?.parts || [];
        for (const p of parts) if (p?.inlineData?.data) return p.inlineData.data;
      }
      return null;
    };
    const tryOnce = async (prompt) => {
      try {
        const response = await genAI.models.generateContent({
          model: GEMINI_IMAGE_MODEL,
          contents: { parts: [{ text: prompt }] },
          config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });
        return extractImage(response);
      } catch {
        return null;
      }
    };

    const primary = (await tryOnce(mkPrompt('primary'))) || '';
    const secondary = (await tryOnce(mkPrompt('secondary'))) || primary;
    const submark = (await tryOnce(mkPrompt('submark'))) || primary;
    res.json({ primary: primary || '', secondary, submark });
  } catch (e) {
    console.error('Logo variants error:', e);
    res.status(500).json({ error: 'Logo variants failed' });
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

    const tryModel = async (modelName) => {
      const response = await genAI.models.generateContent({
        model: modelName,
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

      let text = response?.text || '';
      if (!text) {
        const parts = response?.candidates?.[0]?.content?.parts || [];
        const firstText = parts.find((p) => p.text)?.text;
        text = firstText || '';
      }
      if (text) {
        try { return JSON.parse(text); } catch {}
      }
      return null;
    };

    let json = await tryModel(GEMINI_TEXT_MODEL);
    if (!json) json = await tryModel('gemini-2.0-flash');
    if (!json) json = { headingFont: 'Inter', bodyFont: 'Inter' };

    res.json(json);
  } catch (e) {
    // Hard fallback to avoid blocking the whole kit
    res.json({ headingFont: 'Inter', bodyFont: 'Inter' });
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

app.post('/api/gemini/edit-image', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const { image, instruction } = req.body || {};
    if (!image || !instruction) return res.status(400).json({ error: 'Missing image or instruction' });

    const response = await genAI.models.generateContent({
      model: GEMINI_IMAGE_MODEL,
      contents: {
        parts: [
          { inlineData: { data: image, mimeType: 'image/png' } },
          { text: `Edit the image based on this instruction: ${instruction}. Keep overall composition and quality.` }
        ]
      },
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] }
    });
    const parts = response?.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      if (p.inlineData?.data) return res.json({ image: p.inlineData.data });
    }
    return res.status(500).json({ error: 'No edited image returned' });
  } catch (e) {
    console.error('Edit image error:', e);
    res.status(500).json({ error: 'Edit failed' });
  }
});

app.post('/api/gemini/random-brand', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const prompt = `Create a fresh brand concept. Return JSON with: name (2-3 words), description (1-2 concise sentences), keywords (comma-separated list of 3-6 vibe words), and tone (one of: friendly, professional, bold, playful, inspirational).`;
    const response = await genAI.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            keywords: { type: Type.STRING },
            tone: { type: Type.STRING },
          }
        }
      }
    });
    let json;
    try { json = JSON.parse(response.text || '{}'); } catch { json = {}; }
    if (!json?.name || !json?.description || !json?.keywords) {
      json = {
        name: 'Solara Coffee',
        description: 'A modern, eco-friendly coffee brand for busy professionals.',
        keywords: 'minimalist, warm, friendly',
        tone: 'friendly'
      };
    }
    res.json(json);
  } catch (e) {
    res.json({ name: 'Solara Coffee', description: 'A modern, eco-friendly coffee brand for busy professionals.', keywords: 'minimalist, warm, friendly', tone: 'friendly' });
  }
});

app.post('/api/gemini/ad-copy', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const { name, description, keywords, tone } = req.body || {};
    const prompt = `Create a 15–25 second radio ad for ${name}. Return JSON with two fields: script (with brief SFX/stage directions and labels) and voiceover (plain sentences only, no labels, no SFX, no quotes, ready for TTS). Focus on one key benefit and a clear CTA. Brand: ${description}. Vibe: ${keywords}. Tone: ${tone || 'friendly'}.`;

    const response = await genAI.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING },
            voiceover: { type: Type.STRING },
          }
        }
      }
    });

    let json;
    try {
      json = JSON.parse(response?.text || '');
    } catch {
      const raw = (response?.text || '').trim();
      // Fallback: remove ** **, Voiceover:, and parentheses stage directions from raw
      const voiceover = raw
        .replace(/\*\*[^]*?\*\*/g, ' ')
        .replace(/Voiceover:?/gi, ' ')
        .replace(/\([^\)]*\)/g, ' ')
        .replace(/\s+/g, ' ') // normalize spaces
        .trim();
      json = { script: raw, voiceover };
    }

    if (!json.voiceover) {
      const raw = (json.script || '').toString();
      json.voiceover = raw
        .replace(/\*\*[^]*?\*\*/g, ' ')
        .replace(/Voiceover:?/gi, ' ')
        .replace(/\([^\)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    res.json({ script: json.script || '', voiceover: json.voiceover || '' });
  } catch (e) {
    console.error('Ad copy route error:', e);
    res.json({ script: 'Voiceover: Discover more. Visit our website today.', voiceover: 'Discover more. Visit our website today.' });
  }
});

// Generate a concise Veo-3-Fast video prompt from brand + ad script
app.post('/api/gemini/video-prompt', async (req, res) => {
  try {
    if (!genAI) return res.status(500).json({ error: 'Gemini not configured' });
    const { name, script, aspect_ratio = '16:9' } = req.body || {};
    if (!script) return res.status(400).json({ error: 'Missing script' });
    const allowed = new Set(['16:9','9:16','1:1']);
    const ar = allowed.has(aspect_ratio) ? aspect_ratio : '16:9';
    const sys = `Create a concise, production-ready single prompt for an AI video generator (fal.ai Veo-3-Fast).
Return ONLY the prompt text, no quotes or formatting.
Keep it under 600 characters.
Include: high-level visual style, subject/action, camera motion, pacing, mood, color cues, and safe framing for ${ar}.
If brand name is provided, tastefully weave it as on-screen text cues without quotes.`;
    const response = await genAI.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: [sys, `Brand: ${name || 'Acme'}`, `Ad script: ${script}`]
    });
    const text = response?.text || response?.candidates?.[0]?.content?.parts?.find((p)=>p.text)?.text || '';
    res.json({ prompt: (text || script).trim() });
  } catch (e) {
    res.json({ prompt: (req.body?.script || '').toString() });
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
    // Normalize: ElevenLabs SDK may return a ReadableStream in Node
    const arrayBuffer = bytes instanceof ArrayBuffer ? bytes : await new Response(bytes).arrayBuffer();
    const buf = Buffer.from(new Uint8Array(arrayBuffer));
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
    // Normalize ReadableStream -> ArrayBuffer -> Buffer
    const arrayBuffer = bytes instanceof ArrayBuffer ? bytes : await new Response(bytes).arrayBuffer();
    const buf = Buffer.from(new Uint8Array(arrayBuffer));
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buf);
  } catch (e) {
    console.error('ElevenLabs TTS error:', e);
    res.status(500).json({ error: e?.message || 'TTS generation failed' });
  }
});

// Share endpoints (ephemeral)
app.post('/api/share', async (req, res) => {
  try {
    const bk = req.body?.brandKit;
    if (!bk) return res.status(400).json({ error: 'Missing brandKit' });
    const safe = {
      name: bk.name,
      logo: bk.logo,
      logos: bk.logos,
      colorPalette: bk.colorPalette,
      typography: bk.typography,
      imagery: bk.imagery,
      socialBackdrops: bk.socialBackdrops,
      ad: bk.ad ? {
        copyScript: bk.ad.copyScript,
        voiceoverText: bk.ad.voiceoverText,
        voiceId: bk.ad.voiceId,
        voiceName: bk.ad.voiceName,
      } : undefined,
      adVideo: bk.adVideo ? { url: bk.adVideo.url, aspectRatio: bk.adVideo.aspectRatio } : undefined,
      createdAt: Date.now()
    };
    const id = randomUUID();
    SHARE_STORE.set(id, { data: safe, expiresAt: Date.now() + SHARE_TTL_MS });
    const userId = (req.headers['x-user-id'] || '').toString();
    if (redis && userId) {
      try { await redis.sadd(`user:${userId}:shares`, id); } catch {}
    }

    // Optional: persist to Neon if DATABASE_URL configured
    try {
      if (process.env.DATABASE_URL) {
        const sql = neon(process.env.DATABASE_URL);
        await sql`create table if not exists shares (id text primary key, user_id text, name text not null, created_at timestamptz default now() not null)`;
        await sql`create table if not exists share_assets (id text primary key, share_id text not null references shares(id), kind text not null, url text not null, extra jsonb, created_at timestamptz default now() not null)`;
        await sql`insert into shares (id, user_id, name) values (${id}, ${userId || null}, ${bk.name})`;
        const assets = [];
        if (safe.logos) {
          assets.push({ id: crypto.randomUUID(), shareId: id, kind: 'logo_primary', url: safe.logos.primary });
          assets.push({ id: crypto.randomUUID(), shareId: id, kind: 'logo_secondary', url: safe.logos.secondary });
          assets.push({ id: crypto.randomUUID(), shareId: id, kind: 'logo_submark', url: safe.logos.submark });
        } else if (safe.logo) {
          assets.push({ id: crypto.randomUUID(), shareId: id, kind: 'logo_primary', url: safe.logo });
        }
        (safe.imagery || []).forEach((u, i) => assets.push({ id: crypto.randomUUID(), shareId: id, kind: `imagery_${i+1}`, url: u }));
        (safe.socialBackdrops || []).forEach((bg) => assets.push({ id: crypto.randomUUID(), shareId: id, kind: `backdrop_${bg.platform}`, url: bg.image, extra: { platform: bg.platform } }));
        if (safe.adVideo?.url) assets.push({ id: crypto.randomUUID(), shareId: id, kind: 'ad_video', url: safe.adVideo.url, extra: { aspectRatio: safe.adVideo.aspectRatio } });
        for (const a of assets) {
          await sql`insert into share_assets (id, share_id, kind, url, extra) values (${a.id}, ${a.shareId}, ${a.kind}, ${a.url}, ${a.extra || null})`;
        }
      }
    } catch (dbErr) {
      console.warn('Neon persistence failed (dev server):', dbErr);
    }

    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: 'Share failed' });
  }
});

app.get('/api/user/shares', async (req, res) => {
  try {
    if (!redis) return res.json({ shares: [] });
    const id = (req.query.id || '').toString();
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const shares = await redis.smembers(`user:${id}:shares`);
    res.json({ shares });
  } catch (e) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/share/:id', async (req, res) => {
  const rec = SHARE_STORE.get(req.params.id);
  if (!rec) return res.status(404).json({ error: 'Not found' });
  if (rec.expiresAt < Date.now()) {
    SHARE_STORE.delete(req.params.id);
    return res.status(404).json({ error: 'Expired' });
  }
  res.json(rec.data);
});

// R2 upload API (image/video)
app.post('/api/r2/upload', async (req, res) => {
  try {
    if (!r2) return res.status(500).json({ error: 'R2 not configured' });
    const { base64, key, contentType = 'image/png' } = req.body || {};

    const allowedPrefixes = ['logos/', 'images/', 'social/', 'audio/'];
    if (!base64 || !key || !allowedPrefixes.some(p => key.startsWith(p))) {
      return res.status(400).json({ error: 'Invalid base64 or key' });
    }

    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    const body = Buffer.from(data, 'base64');
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_UPLOAD_IMAGE_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    const publicBase = (process.env.R2_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
    const fallbackBase = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const base = publicBase || fallbackBase;
    const url = `${base}/${process.env.R2_UPLOAD_IMAGE_BUCKET_NAME}/${key}`;
    res.json({ url });
  } catch (e) {
    console.error('R2 upload error:', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// FAL video generation (Veo-3-Fast)
app.post('/api/fal/veo3fast', async (req, res) => {
  try {
    if (!process.env.FAL_AI_KEY) return res.status(500).json({ error: 'FAL not configured' });
const { prompt } = req.body || {};
    let { aspect_ratio = '16:9', audio_enabled = true } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
    const allowed = new Set(['16:9','9:16','1:1']);
    if (!allowed.has(aspect_ratio)) aspect_ratio = '16:9';

    const result = await fal.subscribe('fal-ai/veo3/fast', {
      input: {
        prompt,
        aspect_ratio,
        audio_enabled,
      },
      logs: true,
      onQueueUpdate(update) {
        if (update?.status === 'IN_PROGRESS') {
          (update.logs || []).forEach(l => console.log('[FAL]', l.message));
        }
      }
    });

    res.json({ data: result.data, requestId: result.requestId });
  } catch (e) {
    console.error('FAL video error:', e);
    res.status(500).json({ error: 'Video generation failed' });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`[api] listening on http://localhost:${port}`);
});

