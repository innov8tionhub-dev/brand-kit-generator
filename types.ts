
export interface BrandInput {
  name: string;
  description: string;
  keywords: string;
  voiceId?: string;
  voiceName?: string;
  skipMusic?: boolean;
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
  copy: string;
  voiceId?: string;
  voiceName?: string;
  audioUrl?: string;
  ttsError?: string;
}

export interface BrandKit {
  name: string;
  logo: string; // base64 string
  colorPalette: ColorPalette;
  typography: Typography;
  imagery: string[]; // array of base64 strings
  audio: {
    intro: AudioAsset;
    outro: AudioAsset;
  };
  ad?: BrandAd;
}

export enum GenerationStatus {
  IDLE,
  LOADING,
  SUCCESS,
  ERROR
}
