# Manual QA Checklist

Follow these steps to validate the app end-to-end. None of these steps reveal or log secrets.

1) Environment and startup
- Ensure .env.local contains:
  - GEMINI_API_KEY
  - ELEVENLABS_API_KEY
- Start both servers locally: `npm run dev:all`
- Open http://localhost:5174

2) Brand generation
- Enter brand name, description, and keywords
- Keep “Skip intro/outro music” unchecked initially
- Click Generate Brand Kit
- Expect: logo image, color palette, typography, imagery populated

3) Ad copy + TTS
- Confirm Ad Copy renders
- If a voice is selected and TTS succeeds, an audio player appears
- If TTS fails, you should see a subtle message: “Voiceover unavailable right now. Try again or choose a different voice.”

4) Voice selection and preview
- Use the voice selector to choose a different voice
- Click “Preview Voice”
  - Button should disable and show “Previewing…” spinner while playing
  - Starting a new preview should stop the previous one

5) Music jingles
- With “Skip intro/outro music” unchecked, expect two audio players if music is generated
- If your account doesn’t return music, the section will omit players (no errors in UI)
- Try checking “Skip intro/outro music” and generate again — players should not render

6) Download Brand Kit
- Click “Download Brand Kit”
- Unzip and verify:
  - logo.png opens
  - images/* files open
  - audio/intro.mp3 and audio/outro.mp3 play if generated
  - audio/ad-voiceover.mp3 present and playable if TTS succeeded
  - brandkit.json contains metadata (no secrets)

7) Memory/cleanup
- Generate multiple times; ensure no memory leaks (no console warnings). Blob URLs are revoked when regenerating or resetting.

8) Error cases (optional)
- Temporarily remove ELEVENLABS_API_KEY and restart only the API server: `npm run dev:api`
- Try generating: UI should still complete visuals and ad copy; audio sections should gracefully omit players, with an ad voiceover hint if applicable.

9) Production notes (Vercel)
- Create serverless functions (already added under /api)
- Set GEMINI_API_KEY and ELEVENLABS_API_KEY in Vercel Project → Settings → Environment Variables
- Deploy; verify /api routes work and no keys are visible in the client bundle

