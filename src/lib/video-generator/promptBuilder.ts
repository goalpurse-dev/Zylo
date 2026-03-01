// src/lib/video-generator/promptBuilder.ts

export function buildVideoPrompt(userPrompt: string) {
  const base = userPrompt.trim();

  if (!base) return "";

  // Subtle universal enhancements for video stability
  const enhancements = [
    "natural movement",
    "realistic physics",
    "smooth motion",
    "consistent lighting",
    "coherent scene",
    "high detail",
  ];

  return `${base}, ${enhancements.join(", ")}`;
}