export type VoiceOption = {
  id: string;
  name: string;
};

// Curated examples. You can replace these with voices from your ElevenLabs account.
// Note: Some voices or models may require a paid plan.
export const VOICES: VoiceOption[] = [
  // Curated, ad-friendly voices that support TTS well
  // Put known-preview voices first
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Antoni' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Bella' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Elli' },
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam' },
];

export const DEFAULT_VOICE_ID = VOICES[0].id;

