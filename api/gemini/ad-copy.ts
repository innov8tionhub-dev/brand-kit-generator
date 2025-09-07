import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { name, description, keywords, tone } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Create a 15–25 second radio ad for ${name}. Return JSON with two fields: script (with brief SFX/stage directions and labels) and voiceover (plain sentences only, no labels, no SFX, no quotes, ready for TTS). Focus on one key benefit and a clear CTA. Brand: ${description}. Vibe: ${keywords}. Tone: ${tone || 'friendly'}.`;

    const response: any = await ai.models.generateContent({
      model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            script: { type: Type.STRING },
            voiceover: { type: Type.STRING },
          }
        }
      }
    });

    let json;
    try {
      json = JSON.parse(response?.text || '');
    } catch {
      const raw = (response?.text || '').trim();
      const voiceover = raw
        .replace(/\*\*[^]*?\*\*/g, ' ')
        .replace(/Voiceover:?/gi, ' ')
        .replace(/\([^\)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      json = { script: raw, voiceover };
    }

    if (!json.voiceover) {
      const raw = (json.script || '').toString();
      json.voiceover = raw
        .replace(/\*\*[^]*?\*\*/g, ' ')
        .replace(/Voiceover:?/gi, ' ')
        .replace(/\([^\)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    res.json({ script: json.script || '', voiceover: json.voiceover || '' });
  } catch (e: any) {
    console.error('Ad copy error:', e);
    res.json({ script: 'Voiceover: Discover more. Visit our website today.', voiceover: 'Discover more. Visit our website today.' });
  }
}

