export async function genName(opts: { description?: string; industry?: string }) {
  return { options: ["NovaCraft", "Lumico", "BoldForge"] }; // TODO: call your /edge/name-generate
}

export async function genPalette(opts: { description: string }) {
  return {
    primary: "#1677FF",
    secondary: "#7A3BFF",
    neutrals: ["#111827", "#6B7280", "#E5E7EB"],
  }; // TODO: call /edge/palette-generate
}

export async function genVoiceExamples(_: {
  name: string; description?: string; industry?: string;
  voice: { playful: number; technical: number; luxury: number; toneChips: string[] }
}) {
  return {
    headline: "Build a brand. Launch faster.",
    sub: "Logos, palettes, avatars, and ads—done in minutes.",
    cta: "Create your brand",
  }; // TODO: call /edge/voice-examples
}

export async function queueLogoJob(_: {
  brandName: string; style: string;
  palette: { primary: string; secondary?: string; neutrals?: string[] }
}) {
  return { job_id: crypto.randomUUID() }; // TODO: call /edge/logo-generate
}

export async function queueAvatarJob(_: {
  brandId?: string | null; style: string; role: string;
  palette?: any; voice?: any;
}) {
  return { job_id: crypto.randomUUID() }; // TODO: call /edge/avatar-generate
}
