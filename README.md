<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Brand Kit Generator

Production-ready brand kit generator with secure backend integrations:
- Gemini (Google AI) for logos, palettes, typography, imagery, and ad copy
- ElevenLabs for TTS and music
- fal.ai Veo-3-Fast for short video ads
- Upstash Redis rate limiting + user share index
- Cloudflare R2 for asset uploads

## Quickstart

1) Copy environment example and fill values
   cp .env.example .env.local
   Fill in the required keys (Gemini, ElevenLabs, fal.ai). Optional: Upstash (rate limit + shares) and Cloudflare R2 (uploads).

2) Install dependencies
   npm install

3) Run both frontend and API locally
   npm run dev:all
   - Frontend: http://localhost:5174
   - API: http://localhost:8787 (configurable via PORT)

4) Generate a kit
   Enter brand details and click "Generate Brand Kit". Optionally preview voices, generate jingles, generate a short video, and download the kit as a zip.

## Environment variables
See .env.example for the full list and descriptions. Key ones:
- GEMINI_API_KEY (required)
- ELEVENLABS_API_KEY (required)
- FAL_AI_KEY (required for video)
- RATE_LIMIT_DISABLED, RATE_LIMIT_MAX_PER_IP_PER_DAY (optional)
- UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (optional; required for sharing and production-rate-limit)
- CLOUDFLARE_ACCOUNT_ID, R2_UPLOAD_IMAGE_ACCESS_KEY_ID, R2_UPLOAD_IMAGE_SECRET_ACCESS_KEY, R2_UPLOAD_IMAGE_BUCKET_NAME (optional; for asset uploads)

## Local development
- Vite dev server proxies /api → http://localhost:8787 (see vite.config.ts)
- The Express API loads .env.local first, then .env
- API keys are server-side only; the frontend calls proxied /api endpoints

## Production deployment (Vercel)
- The /api folder provides serverless functions for all routes used by the app
- Configure environment variables in Vercel → Settings → Environment Variables
- Deploy as usual; ensure your frontend points to the same /api paths

### Available API routes
- POST /api/gemini/logo
- POST /api/gemini/palette
- POST /api/gemini/typography
- POST /api/gemini/imagery
- POST /api/gemini/ad-copy
- GET  /api/elevenlabs/voices
- POST /api/elevenlabs/tts
- POST /api/elevenlabs/music
- POST /api/guard/start              // rate-limit guard (Upstash optional)
- POST /api/r2/upload                // Cloudflare R2 uploads (optional)
- POST /api/share                    // create share link (requires Upstash)
- GET  /api/share/:id                // fetch shared brand kit by id (Upstash)
- GET  /api/user/shares?id=<userId>  // list share IDs for a user (Upstash)
- POST /api/fal/veo3fast             // video generation via fal.ai

## Rate limiting
- To disable guard entirely (e.g., demos), set RATE_LIMIT_DISABLED=true
- To enable, set Upstash creds and RATE_LIMIT_MAX_PER_IP_PER_DAY (default 2)

## Security
- Secrets never reach the browser; they are used only on the server/serverless
- .env.local and similar files are gitignored; only .env.example is committed
- Share payloads contain no secrets; only safe metadata and generated assets

## Troubleshooting
- TTS/music issues: ensure ELEVENLABS_API_KEY is valid; UI will gracefully degrade
- Video generation: ensure FAL_AI_KEY is set; keep prompts short to avoid timeouts
- Rate limit reached: set RATE_LIMIT_DISABLED=true for demos or raise the limit
