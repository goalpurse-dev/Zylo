export type Palette = { primary: string; secondary?: string; neutrals?: string[] };
export type FontVibe = "modern" | "serif" | "friendly" | "techy";

export type WizardState = {
  basics: {
    name: string;
    description?: string;
    industry?: string;
    hasLogoUpload: boolean;
    logoTempPath?: string;
  };
  visual: {
    palette: Palette | null;
    fontVibe: FontVibe;
    logoStyle?: "wordmark" | "monogram" | "icon+wordmark";
  };
  voice: {
    playful: number; technical: number; luxury: number;
    toneChips: string[];
    examples?: { headline: string; sub: string; cta: string };
    selectedPreset?: string; // e.g. “Adam”, “William”, etc.
  };
  avatar?: {
    selectedAssetTempId?: string;
    style?: "realistic"|"pixarish"|"anime"|"clay"|"3D toon";
    role?: "founder"|"mascot"|"presenter"|"ugc";
    jobId?: string;
  };
  products?: {
    uploadsTempPaths?: string[];
    description?: string;
    bgPreset?: "studio"|"lifestyle"|"ugc"|"seasonal";
  };
};
