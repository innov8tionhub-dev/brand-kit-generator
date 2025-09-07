import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { description, keywords } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Suggest a heading font and a body font pairing from Google Fonts for a brand described as "${description}". The vibe is ${keywords}. The fonts should be highly readable and web-safe.`;
    const response: any = await ai.models.generateContent({
      model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response?.text ?? '';
    res.json(JSON.parse(text));
  } catch (e: any) {
    console.error('Typography error:', e);
    res.status(500).json({ error: e?.message || 'Typography generation failed' });
  }
}

