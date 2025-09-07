import { GoogleGenAI, Type, Modality } from '@google/genai';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { Redis } from '@upstash/redis';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { fal } from '@fal-ai/client';
import { randomUUID } from 'crypto';
import { getDb } from '../db/client';
import { shares as sharesTable, shareAssets as shareAssetsTable } from '../db/schema';

// Lazy singletons
let genAI: GoogleGenAI | null = null;
let xi: ElevenLabsClient | null = null;
let r2: S3Client | null = null;
let redis: Redis | null = null;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview';
const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const RATE_LIMIT_DISABLED = String(process.env.RATE_LIMIT_DISABLED || '').toLowerCase() === 'true';
const RATE_LIMIT_MAX_PER_IP_PER_DAY = Number(process.env.RATE_LIMIT_MAX_PER_IP_PER_DAY || '2');

function getGenAI() {
  if (!genAI && GEMINI_API_KEY) genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  return genAI;
}
function getXI() {
  if (!xi && ELEVENLABS_API_KEY) xi = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });
  return xi;
}
function getRedis() {
  if (!redis && process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
  }
  return redis;
}
function getR2() {
  if (!r2 && process.env.CLOUDFLARE_ACCOUNT_ID && process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID && process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY) {
    r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_UPLOAD_IMAGE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY!,
      },
    });
  }
  return r2;
}
function ensureFal() {
  if (process.env.FAL_AI_KEY) {
    try { fal.config({ credentials: process.env.FAL_AI_KEY }); } catch {}
  }
}

async function handleRateLimit(req: any) {
  if (RATE_LIMIT_DISABLED) return true;
  const r = getRedis();
  if (!r) return true; // bypass if no Redis configured
  const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket?.remoteAddress || 'unknown').trim();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const key = `runs:${ip}:${today}`;
  const count = await r.incr(key);
  if (count === 1) {
    await r.expire(key, 24 * 60 * 60);
  }
  return count <= RATE_LIMIT_MAX_PER_IP_PER_DAY;
}

function pathOf(req: any) {
  const u = new URL(req.url || '/', 'http://localhost');
  return u.pathname;
}

async function json(req: any) {
  // Vercel parses JSON body into req.body already; keep this for safety
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default async function handler(req: any, res: any) {
  try {
    const method = req.method || 'GET';
    const pathname = pathOf(req);

    // --- Rate limit guard ---
    if (method === 'POST' && pathname === '/api/guard/start') {
      try {
        const ok = await handleRateLimit(req);
        if (!ok) return res.status(429).json({ error: 'Daily run limit reached' });
        return res.json({ ok: true });
      } catch {
        return res.status(500).json({ error: 'Guard failed' });
      }
    }

    // --- Gemini routes ---
    if (pathname === '/api/gemini/logo' && method === 'POST') {
      const body = await json(req);
      const { name, description, keywords } = body || {};
      const ai = getGenAI();
      if (!ai) return res.status(500).json({ error: 'Gemini not configured' });

      const prompt = `Minimalist vector logo for a brand named "${name}". The brand is about: ${description}. Keywords: ${keywords}. The logo should be on a clean, solid #f0f0f0 background. Flat 2D style. No text in the logo.`;
      const extractImage = (response: any) => {
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
      const tryModel = async (modelName: string) => {
        try {
          const response: any = await ai.models.generateContent({
            model: modelName,
            contents: { parts: [{ text: prompt }] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
          });
          return extractImage(response);
        } catch (err) {
          console.error('Gemini logo error:', err);
          return null;
        }
      };
      let image = await tryModel(GEMINI_IMAGE_MODEL);
      if (!image) image = await tryModel('gemini-2.5-flash-image-preview');
      if (!image) {
        const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
        return res.json({ image: transparentPng, warning: 'No image data returned by model' });
      }
      return res.json({ image });
    }

    if (pathname === '/api/gemini/logo-variants' && method === 'POST') {
      const body = await json(req);
      const { name, description, keywords } = body || {};
      const ai = getGenAI();
      if (!ai) return res.status(500).json({ error: 'Gemini not configured' });

      const mkPrompt = (variant: 'primary'|'secondary'|'submark') => {
        const common = `Brand: ${name}. About: ${description}. Vibe: ${keywords}. Clean vector aesthetic, flat 2D, high contrast, no text, no watermark, centered on neutral #f0f0f0 background.`;
        if (variant === 'primary') return `Primary logo mark. ${common} Balanced symbol suitable as main mark.`;
        if (variant === 'secondary') return `Secondary logo mark. ${common} Alternate lockup or simplified variation that complements the primary.`;
        return `Submark logo. ${common} Monogram/circular badge variant derived from the primary mark.`;
      };

      const extractImage = (response: any) => {
        const candidates = response?.candidates || [];
        for (const c of candidates) {
          const parts = c?.content?.parts || [];
          for (const p of parts) if (p?.inlineData?.data) return p.inlineData.data;
        }
        return null;
      };
      const tryOnce = async (p: string) => {
        try {
          const response: any = await getGenAI()!.models.generateContent({
            model: GEMINI_IMAGE_MODEL,
            contents: { parts: [{ text: p }] },
            config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
          });
          return extractImage(response);
        } catch { return null; }
      };

      const primary = (await tryOnce(mkPrompt('primary'))) || '';
      const secondary = (await tryOnce(mkPrompt('secondary'))) || primary;
      const submark = (await tryOnce(mkPrompt('submark'))) || primary;
      return res.json({ primary: primary || '', secondary, submark });
    }

    if (pathname === '/api/gemini/palette' && method === 'POST') {
      const body = await json(req);
      const { description, keywords } = body || {};
      const ai = getGenAI();
      if (!ai) return res.status(500).json({ error: 'Gemini not configured' });
      const prompt = `Generate a 5-color brand palette for a brand described as "${description}". The vibe should be ${keywords}. The colors should be modern and complementary.`;
      const response: any = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              palette: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      });
      const text = response?.text ?? '';
      const jsonParsed = JSON.parse(text);
      return res.json({ palette: jsonParsed.palette });
    }

    if (pathname === '/api/gemini/typography' && method === 'POST') {
      const body = await json(req);
      const { description, keywords } = body || {};
      const ai = getGenAI();
      if (!ai) return res.status(500).json({ error: 'Gemini not configured' });
      const prompt = `Suggest a heading font and a body font pairing from Google Fonts for a brand described as "${description}". The vibe is ${keywords}. The fonts should be highly readable and web-safe.`;
      const tryModel = async (modelName: string) => {
        const response: any = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headingFont: { type: Type.STRING },
                bodyFont: { type: Type.STRING },
              },
            },
          },
        });
        let text = response?.text || '';
        if (!text) {
          const parts = response?.candidates?.[0]?.content?.parts || [];
          const firstText = parts.find((p: any) => p.text)?.text;
          text = firstText || '';
        }
        if (text) {
          try { return JSON.parse(text); } catch {}
        }
        return null;
      };
      let jsonT = await tryModel(GEMINI_TEXT_MODEL);
      if (!jsonT) jsonT = await tryModel('gemini-2.0-flash');
      if (!jsonT) jsonT = { headingFont: 'Inter', bodyFont: 'Inter' };
      return res.json(jsonT);
    }

    if (pathname === '/api/gemini/imagery' && method === 'POST') {
      const body = await json(req);
      const { description, keywords, count = 2 } = body || {};
      const ai = getGenAI();
      if (!ai) return res.status(500).json({ error: 'Gemini not configured' });
      const prompt = `An abstract, high-quality background image suitable for a brand website. The brand is about: ${description}. The mood should be ${keywords}. Photorealistic, subtle, professional.`;
      const gen = async () => {
        const response: any = await ai.models.generateContent({
          model: GEMINI_IMAGE_MODEL,
          contents: { parts: [{ text: prompt }] },
          config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });
        const parts = response?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) if (part.inlineData?.data) return part.inlineData.data;
        throw new Error('No image data');
      };
      const images = await Promise.all(Array.from({ length: Number(count) }, gen));
      return res.json({ images });
    }

    if (pathname === '/api/gemini/edit-image' && method === 'POST') {
      const body = await json(req);
      const { image, instruction } = body || {};
      const ai = getGenAI();
      if (!ai) return res.status(500).json({ error: 'Gemini not configured' });
      if (!image || !instruction) return res.status(400).json({ error: 'Missing image or instruction' });
      const response: any = await ai.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
        contents: { parts: [
          { inlineData: { data: image, mimeType: 'image/png' } },
          { text: `Edit the image based on this instruction: ${instruction}. Keep overall composition and quality.` },
        ] },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
      });
      const parts = response?.candidates?.[0]?.content?.parts || [];
      for (const p of parts) if (p.inlineData?.data) return res.json({ image: p.inlineData.data });
      return res.status(500).json({ error: 'No edited image returned' });
    }

    if (pathname === '/api/gemini/ad-copy' && method === 'POST') {
      const body = await json(req);
      const { name, description, keywords, tone } = body || {};
      const ai = getGenAI();
      if (!ai) return res.status(500).json({ error: 'Gemini not configured' });
      const prompt = `Create a 15–25 second radio ad for ${name}. Return JSON with two fields: script (with brief SFX/stage directions and labels) and voiceover (plain sentences only, no labels, no SFX, no quotes, ready for TTS). Focus on one key benefit and a clear CTA. Brand: ${description}. Vibe: ${keywords}. Tone: ${tone || 'friendly'}.`;
      const response: any = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { script: { type: Type.STRING }, voiceover: { type: Type.STRING } },
          },
        },
      });
      let jsonOut: any;
      try {
        jsonOut = JSON.parse(response?.text || '');
      } catch {
        const raw = (response?.text || '').trim();
        const voiceover = raw
          .replace(/\*\*[^]*?\*\*/g, ' ')
          .replace(/Voiceover:?/gi, ' ')
          .replace(/\([^\)]*\)/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        jsonOut = { script: raw, voiceover };
      }
      if (!jsonOut.voiceover) {
        const raw = (jsonOut.script || '').toString();
        jsonOut.voiceover = raw
          .replace(/\*\*[^]*?\*\*/g, ' ')
          .replace(/Voiceover:?/gi, ' ')
          .replace(/\([^\)]*\)/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
      return res.json({ script: jsonOut.script || '', voiceover: jsonOut.voiceover || '' });
    }

    if (pathname === '/api/gemini/video-prompt' && method === 'POST') {
      const body = await json(req);
      const { name, script, aspect_ratio = '16:9' } = body || {};
      const ai = getGenAI();
      if (!ai) return res.status(500).json({ error: 'Gemini not configured' });
      if (!script) return res.status(400).json({ error: 'Missing script' });
      const allowed = new Set(['16:9','9:16','1:1']);
      const ar = allowed.has(aspect_ratio) ? aspect_ratio : '16:9';
      const sys = `Create a concise, production-ready single prompt for an AI video generator (fal.ai Veo-3-Fast).
Return ONLY the prompt text, no quotes or formatting.
Keep it under 600 characters.
Include: high-level visual style, subject/action, camera motion, pacing, mood, color cues, and safe framing for ${ar}.
If brand name is provided, tastefully weave it as on-screen text cues without quotes.`;
      try {
        const resp: any = await ai.models.generateContent({ model: GEMINI_TEXT_MODEL, contents: [sys, `Brand: ${name || 'Acme'}` , `Ad script: ${script}`] });
        const text = resp?.text || resp?.candidates?.[0]?.content?.parts?.find((p: any)=>p.text)?.text || '';
        return res.json({ prompt: (text || script).trim() });
      } catch {
        return res.json({ prompt: script });
      }
    }

    // --- ElevenLabs routes ---
    if (pathname === '/api/elevenlabs/voices' && method === 'GET') {
      if (!ELEVENLABS_API_KEY) return res.json({ voices: [] });
      const r = await fetch('https://api.elevenlabs.io/v1/voices', { headers: { 'xi-api-key': ELEVENLABS_API_KEY } });
      if (!r.ok) return res.json({ voices: [] });
      const j = await r.json();
      // Extract at least 10 voices, prioritizing those with preview URLs
      const allVoices = (j.voices || []).map((v: any) => ({
        id: v.voice_id,
        name: v.name,
        previewUrl: v.preview_url || v.samples?.[0]?.preview_url || undefined,
        category: v.category || 'generated',
        description: v.description || '',
        accent: v.labels?.accent || '',
        gender: v.labels?.gender || '',
        age: v.labels?.age || ''
      }));
      
      // Sort voices: prioritize those with preview URLs, then by name
      const sortedVoices = allVoices.sort((a: any, b: any) => {
        if (a.previewUrl && !b.previewUrl) return -1;
        if (!a.previewUrl && b.previewUrl) return 1;
        return a.name.localeCompare(b.name);
      });
      
      // Return at least 10 voices (or all if less than 10 available)
      const voices = sortedVoices.slice(0, Math.max(10, sortedVoices.length));
      return res.json({ voices });
    }

    if (pathname === '/api/elevenlabs/tts' && method === 'POST') {
      const body = await json(req);
      const { text, voiceId, modelId = 'eleven_multilingual_v2', outputFormat = 'mp3_44100_128' } = body || {};
      const client = getXI();
      if (!client) return res.status(500).json({ error: 'ElevenLabs not configured' });
      if (!text || !voiceId) return res.status(400).json({ error: 'Missing text or voiceId' });
      const bytes: any = await client.textToSpeech.convert(voiceId, { text, modelId, outputFormat });
      const arrayBuffer = bytes instanceof ArrayBuffer ? bytes : await new Response(bytes).arrayBuffer();
      const buf = Buffer.from(new Uint8Array(arrayBuffer));
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.send(buf);
    }

    if (pathname === '/api/elevenlabs/music' && method === 'POST') {
      const body = await json(req);
      const { prompt, lengthMs = 15000 } = body || {};
      const client = getXI();
      if (!client) return res.status(500).json({ error: 'ElevenLabs not configured' });
      const bytes: any = await client.music.compose({ prompt, musicLengthMs: Number(lengthMs) });
      const arrayBuffer = bytes instanceof ArrayBuffer ? bytes : await new Response(bytes).arrayBuffer();
      const buf = Buffer.from(new Uint8Array(arrayBuffer));
      res.setHeader('Content-Type', 'audio/mpeg');
      return res.send(buf);
    }

    // --- Share (Upstash) ---
    if (pathname === '/api/share' && method === 'POST') {
      const r = getRedis();
      if (!r) return res.status(500).json({ error: 'Sharing not configured' });
      const body = await json(req);
      const bk = body?.brandKit;
      if (!bk) return res.status(400).json({ error: 'Missing brandKit' });
      const safe = {
        name: bk.name,
        logo: bk.logo,
        logos: bk.logos,
        colorPalette: bk.colorPalette,
        typography: bk.typography,
        imagery: bk.imagery,
        socialBackdrops: bk.socialBackdrops,
        ad: bk.ad ? { copyScript: bk.ad.copyScript, voiceoverText: bk.ad.voiceoverText, voiceId: bk.ad.voiceId, voiceName: bk.ad.voiceName } : undefined,
        adVideo: bk.adVideo ? { url: bk.adVideo.url, aspectRatio: bk.adVideo.aspectRatio } : undefined,
        createdAt: Date.now(),
      };
      const id = randomUUID();
      await r.set(`share:${id}`, JSON.stringify(safe), { ex: 24 * 60 * 60 });
      const userId = (req.headers['x-user-id'] || '').toString();
      if (userId) {
        try { await r.sadd(`user:${userId}:shares`, id); } catch {}
      }

      // Persist to DB if configured
      try {
        const db = getDb();
        if (db && process.env.DATABASE_URL) {
          await db.insert(sharesTable).values({ id, userId: userId || null, name: bk.name });
          const assets: any[] = [];
          if (safe.logos) {
            assets.push(
              { id: randomUUID(), shareId: id, kind: 'logo_primary', url: safe.logos.primary },
              { id: randomUUID(), shareId: id, kind: 'logo_secondary', url: safe.logos.secondary },
              { id: randomUUID(), shareId: id, kind: 'logo_submark', url: safe.logos.submark },
            );
          } else if (safe.logo) {
            assets.push({ id: randomUUID(), shareId: id, kind: 'logo_primary', url: safe.logo });
          }
          (safe.imagery || []).forEach((u: string, i: number) => assets.push({ id: randomUUID(), shareId: id, kind: `imagery_${i+1}`, url: u }));
          (safe.socialBackdrops || []).forEach((bg: any) => assets.push({ id: randomUUID(), shareId: id, kind: `backdrop_${bg.platform}`, url: bg.image, extra: { platform: bg.platform } }));
          if (safe.adVideo?.url) assets.push({ id: randomUUID(), shareId: id, kind: 'ad_video', url: safe.adVideo.url, extra: { aspectRatio: safe.adVideo.aspectRatio } });
          if (assets.length) await db.insert(shareAssetsTable).values(assets);
        }
      } catch (e) {
        console.error('DB insert failed', e);
      }

      return res.json({ id });
    }

    if (pathname.startsWith('/api/share/') && method === 'GET') {
      const r = getRedis();
      if (!r) return res.status(404).json({ error: 'Not found' });
      const id = pathname.split('/').pop() as string;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const jsonStr = await r.get<string>(`share:${id}`);
      if (!jsonStr) return res.status(404).json({ error: 'Not found' });
      return res.json(JSON.parse(jsonStr));
    }

    if (pathname === '/api/user/shares' && method === 'GET') {
      const r = getRedis();
      if (!r) return res.json({ shares: [] });
      const u = new URL(req.url || '/', 'http://localhost');
      const id = (u.searchParams.get('id') || '').toString();
      if (!id) return res.status(400).json({ error: 'Missing id' });
      const shares = await (r as any).smembers(`user:${id}:shares`);
      return res.json({ shares });
    }

    // --- R2 upload ---
    if (pathname === '/api/r2/upload' && method === 'POST') {
      const client = getR2();
      if (!client) return res.status(500).json({ error: 'R2 not configured' });
      const bucket = process.env.R2_UPLOAD_IMAGE_BUCKET_NAME;
      if (!bucket) return res.status(500).json({ error: 'R2 bucket not configured' });
      const body = await json(req);
      const { base64, key, contentType = 'image/png' } = body || {};
      if (!base64 || !key) return res.status(400).json({ error: 'Missing base64 or key' });
      const data = base64.includes(',') ? base64.split(',')[1] : base64;
      const fileBody = Buffer.from(data, 'base64');
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fileBody, ContentType: contentType }));
      const url = `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key}`;
      return res.json({ url });
    }

    // --- fal.ai video ---
    if (pathname === '/api/fal/veo3fast' && method === 'POST') {
      ensureFal();
      if (!process.env.FAL_AI_KEY) return res.status(500).json({ error: 'FAL not configured' });
      const body = await json(req);
      let { prompt, aspect_ratio = '16:9' } = body || {};
      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });
      const allowed = new Set(['16:9','9:16','1:1']);
      if (!allowed.has(aspect_ratio)) aspect_ratio = '16:9';
      const result = await fal.subscribe('fal-ai/veo3/fast', { input: { prompt, aspect_ratio }, logs: false });
      return res.json({ data: result.data, requestId: result.requestId });
    }

    // Fallback not found
    res.status(404).json({ error: 'Not found' });
  } catch (e: any) {
    console.error('API catch-all error:', e);
    res.status(500).json({ error: 'Internal error' });
  }
}

