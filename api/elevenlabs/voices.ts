export default async function handler(_req: any, res: any) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return res.json({ voices: [] });

    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    });
    if (!r.ok) return res.json({ voices: [] });
    const json = await r.json();
    const voices = (json.voices || []).map((v: any) => ({
      id: v.voice_id,
      name: v.name,
      previewUrl: v.preview_url || v.samples?.[0]?.preview_url || undefined,
    }));
    res.json({ voices });
  } catch (e) {
    res.json({ voices: [] });
  }
}

