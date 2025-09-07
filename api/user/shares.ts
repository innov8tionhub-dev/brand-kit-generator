import { Redis } from '@upstash/redis';

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const redis = getRedis();
    if (!redis) return res.json({ shares: [] });

    const id = (req.query?.id || '').toString();
    if (!id) return res.status(400).json({ error: 'Missing id' });

    const shares = await (redis as any).smembers(`user:${id}:shares`);
    res.json({ shares });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
}

