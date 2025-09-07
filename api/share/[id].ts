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
    if (!redis) return res.status(404).json({ error: 'Not found' });

    const shareId = (req.query?.id || req.params?.id || '').toString();
    if (!shareId) return res.status(400).json({ error: 'Missing id' });

    const json = await redis.get<string>(`share:${shareId}`);
    if (!json) return res.status(404).json({ error: 'Not found' });

    const data = JSON.parse(json);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed' });
  }
}

