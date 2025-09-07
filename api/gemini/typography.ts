import { GoogleGenAI, Type } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { description, keywords } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Suggest a heading font and a body font pairing from Google Fonts for a brand described as "${description}". The vibe is ${keywords}. The fonts should be highly readable and web-safe.`;

    const tryModel = async (modelName: string) => {
      const response: any = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headingFont: { type: Type.STRING },
              bodyFont: { type: Type.STRING },
            },
          },
        },
      });

      let text = response?.text || '';
      if (!text) {
        const parts = response?.candidates?.[0]?.content?.parts || [];
        const firstText = parts.find((p: any) => p.text)?.text;
        text = firstText || '';
      }
      if (text) {
        try { return JSON.parse(text); } catch {}
      }
      return null;
    };

    let json = await tryModel(process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash');
    if (!json) json = await tryModel('gemini-2.0-flash');
    if (!json) json = { headingFont: 'Inter', bodyFont: 'Inter' };

    res.json(json);
  } catch (e: any) {
    console.error('Typography error:', e);
    res.json({ headingFont: 'Inter', bodyFont: 'Inter' });
  }
}

