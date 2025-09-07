import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { text, voiceId, modelId = 'eleven_multilingual_v2', outputFormat = 'mp3_44100_128' } = req.body || {};
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Server not configured' });
    if (!text || !voiceId) return res.status(400).json({ error: 'Missing text or voiceId' });

    const xi = new ElevenLabsClient({ apiKey });
    const bytes = await xi.textToSpeech.convert(voiceId, { text, modelId, outputFormat });
    const arrayBuffer = bytes instanceof ArrayBuffer ? bytes : await new Response(bytes as any).arrayBuffer();
    const buf = Buffer.from(new Uint8Array(arrayBuffer));
    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(buf);
  } catch (e: any) {
    console.error('TTS error:', e);
    res.status(500).json({ error: e?.message || 'TTS generation failed' });
  }
}

