import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

const TTL_SECONDS = 24 * 60 * 60; // 24h

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const redis = getRedis();
    if (!redis) return res.status(500).json({ error: 'Sharing not configured' });

    const bk = req.body?.brandKit;
    if (!bk) return res.status(400).json({ error: 'Missing brandKit' });

    // Sanitize brand kit for sharing (no secrets or blob URLs)
    const safe = {
      name: bk.name,
      logo: bk.logo,
      colorPalette: bk.colorPalette,
      typography: bk.typography,
      imagery: bk.imagery,
      socialBackdrops: bk.socialBackdrops,
      ad: bk.ad
        ? {
            copyScript: bk.ad.copyScript,
            voiceoverText: bk.ad.voiceoverText,
            voiceId: bk.ad.voiceId,
            voiceName: bk.ad.voiceName,
          }
        : undefined,
      adVideo: bk.adVideo ? { url: bk.adVideo.url, aspectRatio: bk.adVideo.aspectRatio } : undefined,
      createdAt: Date.now(),
    };

    const id = randomUUID();
    await redis.set(`share:${id}`, JSON.stringify(safe), { ex: TTL_SECONDS });

    const userId = (req.headers['x-user-id'] || '').toString();
    if (userId) {
      try {
        await redis.sadd(`user:${userId}:shares`, id);
      } catch {}
    }

    res.json({ id });
  } catch (e: any) {
    res.status(500).json({ error: 'Share failed' });
  }
}

