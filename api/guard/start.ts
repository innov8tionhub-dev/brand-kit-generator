import { Redis } from '@upstash/redis';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const disabled = String(process.env.RATE_LIMIT_DISABLED || '').toLowerCase() === 'true';
    if (disabled) return res.json({ ok: true });

    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      // Allow if Redis isn't configured
      return res.json({ ok: true });
    }

    const max = Number(process.env.RATE_LIMIT_MAX_PER_IP_PER_DAY || '2');
    const redis = new Redis({ url, token });

    const ip = (req.headers['x-forwarded-for']?.toString().split(',')[0] || req.socket?.remoteAddress || 'unknown').trim();
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const key = `runs:${ip}:${today}`;

    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 24 * 60 * 60);
    }
    if (count > max) {
      return res.status(429).json({ error: 'Daily run limit reached' });
    }

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Guard failed' });
  }
}

