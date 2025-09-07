
export interface BrandInput {
  name: string;
  description: string;
  keywords: string;
  tone?: 'friendly' | 'professional' | 'bold' | 'playful' | 'inspirational';
  voiceId?: string;
  voiceName?: string;
  skipMusic?: boolean;
  generateVoiceover?: boolean;
}

export interface ColorPalette extends Array<string> {}

export interface Typography {
  headingFont: string;
  bodyFont: string;
}

export interface AudioAsset {
  url: string;
  name: string;
}

export interface BrandAd {
  copyScript: string; // full script with SFX/stage directions
  voiceoverText: string; // clean text to speak (no SFX labels)
  voiceId?: string;
  voiceName?: string;
  audioUrl?: string;
  ttsError?: string;
}

export interface BrandVideo {
  url: string;
  aspectRatio: '16:9' | '9:16' | '1:1';
}

export type SocialBackdrop = {
  platform: 'instagram' | 'tiktok' | 'linkedin';
  image: string; // base64
};

export interface BrandKit {
  name: string;
  logo: string; // base64 string
  colorPalette: ColorPalette;
  typography: Typography;
  imagery: string[]; // array of base64 strings
  socialBackdrops?: SocialBackdrop[];
  audio: {
    intro: AudioAsset;
    outro: AudioAsset;
  };
  ad?: BrandAd;
  adVideo?: BrandVideo;
}

export enum GenerationStatus {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR
}
