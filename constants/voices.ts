export type VoiceOption = {
  id: string;
  name: string;
};

// Curated examples. You can replace these with voices from your ElevenLabs account.
// Note: Some voices or models may require a paid plan.
export const VOICES: VoiceOption[] = [
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'Classic (sample)' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Bella' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Antoni' },
];

export const DEFAULT_VOICE_ID = VOICES[0].id;

