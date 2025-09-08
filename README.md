<div align="center">
  <img width="1000" alt="Brand Kit Generator" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Brand Kit Generator (Nano Banana Hackathon Edition)

Create a complete, coherent brand kit in minutes—logo variants, color palette, typography, backgrounds, social backdrops, ad copy, optional TTS + music, and an ad video—then download everything as a ZIP.

Built for the Nano Banana 48‑Hour Challenge using:
- Google Gemini 2.5 Flash Image Preview (aka “Nano Banana”) for image generation, prompt‑based editing, palettes, typography, and ad copy
- ElevenLabs for TTS voiceovers and music
- fal.ai Veo‑3‑Fast for ad video generation

All API keys are kept server‑side and never exposed to the browser.

---

## One‑Minute Setup

1) Copy env and add keys
   cp .env.example .env.local
   - GEMINI_API_KEY (required)
   - ELEVENLABS_API_KEY (for TTS/music)
   - FAL_AI_KEY (for video)
   - Optional: RATE_LIMIT_DISABLED=true for local demos

2) Install deps
   npm install

3) Run frontend + API together
   npm run dev:all
   - Frontend: http://localhost:5174
   - API: http://localhost:8787

> Tip: The Vite dev server proxies /api → the local API automatically. No keys in the client.

---

## How to Use (Judge Flow)
1) Click “Random brand” to auto‑fill name/description/keywords via Gemini.
2) Optionally tick:
   - Generate intro/outro music
   - Generate Ad Voiceover
3) Click “Generate Brand Kit”.
4) In the Ad card, you can regenerate the voiceover or generate an ad video (Veo‑3‑Fast).
5) Download Brand Kit – the ZIP includes:
   - logo(s), color palette, typography metadata
   - images/ and social/ assets
   - audio/intro.mp3, audio/outro.mp3 (if generated)
   - audio/ad‑voiceover.(mp3|wav|ogg) (if generated)
   - ad‑video.(mp4|webm|mov) (if generated)

---

## Why this fits Nano Banana
- “Edit with words”: click Edit on any image/logo and enter instructions (e.g., “more contrast”, “circular motif”); Gemini returns an updated asset.
- Consistent brand look: the same description/keywords drive logos, backgrounds, and social backdrops.
- End‑to‑end pipeline: text → visuals → copy → audio → video, all in one flow.

---

## Environment Variables (summary)
See .env.example for full list.
- GEMINI_API_KEY (required)
- ELEVENLABS_API_KEY (optional but recommended)
- FAL_AI_KEY (optional; required for video)
- RATE_LIMIT_DISABLED=true to bypass limits locally
- RATE_LIMIT_MAX_PER_IP_PER_DAY (default 2)
- UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (optional; production rate‑limit + user share index)
- CLOUDFLARE_ACCOUNT_ID / R2_* (optional; asset uploads; app also works without R2 by keeping inline data URLs)

## Scripts
- npm run dev:all – run vite + local API together
- npm run build – production build
- npm run typecheck – strict TS

## Deployment (Vercel)
- All API endpoints are provided via a single catch‑all serverless function under /api.
- Add the env vars in Vercel → Settings → Environment Variables.
- Deploy; the frontend continues to call the same /api routes.

## Important Routes
- POST /api/gemini/logo, /palette, /typography, /imagery, /ad-copy, /video-prompt
- POST /api/fal/veo3fast (Veo‑3‑Fast via fal.ai)
- GET  /api/elevenlabs/voices; POST /api/elevenlabs/tts, /music
- POST /api/guard/start (rate‑limit guard)
- POST /api/r2/upload (optional)

## Quotas & Rate Limiting
- Gemini hackathon free tier is 100 requests/day per project. For demos:
  - Set RATE_LIMIT_DISABLED=true locally, or
  - Use Upstash Redis in production and tune RATE_LIMIT_MAX_PER_IP_PER_DAY.
- The UI shows friendly messages when quotas are hit; assets are cached client‑side during a session.

## 2‑Minute Video Script (suggested)
- 0:00 – One‑liner + click Random brand → fields auto‑fill (Gemini)
- 0:15 – Generate Brand Kit → cards populate (logos, palette, typography, imagery)
- 0:35 – Edit a logo with words → quick before/after (Gemini)
- 0:50 – Ad copy appears → check Generate Ad Voiceover → play
- 1:10 – Check Generate intro/outro music → play briefly
- 1:25 – Generate Ad Video (Veo‑3‑Fast) → show clip in scaled player
- 1:40 – Download Brand Kit → open ZIP: show images/, social/, audio/, ad‑video
- 1:55 – Close with value prop

## Security
- API keys are only used on the server/serverless functions; never shipped to the client.
- .env.local is gitignored; .env.example documents required keys.

## Troubleshooting
- No voices/music? Ensure ELEVENLABS_API_KEY is set and the checkboxes are ticked.
- Video empty? Verify FAL_AI_KEY and try a shorter prompt.
- Hitting limits? Set RATE_LIMIT_DISABLED=true locally or configure Upstash for production.
- R2 issues? Leave R2 unset—app falls back to base64 data URLs and still downloads correctly.

---

MIT © 2025 – Built for the Nano Banana 48‑Hour Challenge
