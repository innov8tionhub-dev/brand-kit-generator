import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { prompt, lengthMs = 15000 } = req.body || {};
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server not configured' });

    const xi = new ElevenLabsClient({ apiKey });
    const bytes = await xi.music.compose({ prompt, musicLengthMs: Number(lengthMs) });
    const arrayBuffer = bytes instanceof ArrayBuffer ? bytes : await new Response(bytes as any).arrayBuffer();
    const buf = Buffer.from(new Uint8Array(arrayBuffer));
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buf);
  } catch (e: any) {
    console.error('Music error:', e);
    res.status(500).json({ error: e?.message || 'Music generation failed' });
  }
}

