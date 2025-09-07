import { GoogleGenAI, Type, Modality } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { name, description, keywords } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Minimalist vector logo for a brand named "${name}". The brand is about: ${description}. Keywords: ${keywords}. The logo should be on a clean, solid #f0f0f0 background. Flat 2D style. No text in the logo.`;

    const response: any = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
    });

    const candidates = response?.candidates || [];
    const parts = candidates[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) return res.json({ image: part.inlineData.data });
    }
    res.status(500).json({ error: 'No image data' });
  } catch (e: any) {
    console.error('Logo error:', e);
    res.status(500).json({ error: e?.message || 'Logo generation failed' });
  }
}

