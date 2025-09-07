import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const { name, description, keywords } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Gemini not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Write a short, 15–25 second ad script for a company called ${name}. The brand is: ${description}. Vibe/keywords: ${keywords}. Include a strong opening hook, one key benefit, and a clear call-to-action. Plain text only.`;
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ copy: (response.text || '').trim() });
  } catch (e: any) {
    console.error('Ad copy error:', e);
    res.status(500).json({ error: e?.message || 'Ad copy generation failed' });
  }
}

