import { fal } from '@fal-ai/client';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const key = process.env.FAL_AI_KEY;
    if (!key) return res.status(500).json({ error: 'FAL not configured' });

    const { prompt, aspect_ratio = '16:9' } = req.body || {};
    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    try { fal.config({ credentials: key }); } catch {}

    const result = await fal.subscribe('fal-ai/veo3/fast', {
      input: { prompt, aspect_ratio },
      logs: false,
    });

    res.json({ data: result.data, requestId: result.requestId });
  } catch (e: any) {
    console.error('FAL video error:', e);
    res.status(500).json({ error: 'Video generation failed' });
  }
}

