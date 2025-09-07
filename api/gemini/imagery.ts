import { GoogleGenAI, Modality } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { description, keywords, count = 2 } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `An abstract, high-quality background image suitable for a brand website. The brand is about: ${description}. The mood should be ${keywords}. Photorealistic, subtle, professional.`;

    const gen = async () => {
      const response: any = await ai.models.generateContent({
        model: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
      });
      const candidates = response?.candidates || [];
      const parts = candidates[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) return part.inlineData.data;
      }
      throw new Error('No image data');
    };

    const images = await Promise.all(Array.from({ length: Number(count) }, gen));
    res.json({ images });
  } catch (e: any) {
    console.error('Imagery error:', e);
    res.status(500).json({ error: e?.message || 'Imagery generation failed' });
  }
}

