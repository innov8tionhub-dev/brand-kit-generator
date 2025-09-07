import { GoogleGenAI, Modality } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { name, description, keywords } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Minimalist vector logo for a brand named "${name}". The brand is about: ${description}. Keywords: ${keywords}. The logo should be on a clean, solid #f0f0f0 background. Flat 2D style. No text in the logo.`;

    const extractImage = (response: any) => {
      const candidates = response?.candidates || [];
      for (const c of candidates) {
        const parts = c?.content?.parts || [];
        for (const p of parts) {
          if (p?.inlineData?.data) return p.inlineData.data;
        }
      }
      return null;
    };

    const tryModel = async (modelName: string) => {
      try {
        const response: any = await ai.models.generateContent({
          model: modelName,
          contents: { parts: [{ text: prompt }] },
          config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
        });
        return extractImage(response);
      } catch (err) {
        console.error('Logo model error:', err);
        return null;
      }
    };

    let image = await tryModel(process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image-preview');
    if (!image) image = await tryModel('gemini-2.5-flash-image-preview');

    if (!image) {
      const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
      return res.json({ image: transparentPng, warning: 'No image data returned by model' });
    }

    res.json({ image });
  } catch (e: any) {
    console.error('Logo error:', e);
    const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
    res.json({ image: transparentPng, warning: 'Logo fallback due to server error' });
  }
}

