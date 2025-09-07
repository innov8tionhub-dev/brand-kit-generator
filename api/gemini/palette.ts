import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { description, keywords } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Generate a 5-color brand palette for a brand described as "${description}". The vibe should be ${keywords}. The colors should be modern and complementary.`;

    const response: any = await ai.models.generateContent({
      model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            palette: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    });

    const text = response?.text ?? '';
    const json = JSON.parse(text);
    res.json({ palette: json.palette });
  } catch (e: any) {
    console.error('Palette error:', e);
    res.status(500).json({ error: e?.message || 'Palette generation failed' });
  }
}

