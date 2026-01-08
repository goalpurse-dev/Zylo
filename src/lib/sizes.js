export const PLATFORM_SIZES = {
  YouTube: { width: 1280, height: 720 },
  TikTok: { width: 1080, height: 1920 },
  Instagram: { width: 1080, height: 1080 },
  Custom: { width: 1920, height: 1080 },
};

export const SIZES_LIST = [
  { label: "YouTube (1280×720)", value: "YouTube", ...PLATFORM_SIZES["YouTube"] },
  { label: "TikTok (1080×1920)", value: "TikTok", ...PLATFORM_SIZES["TikTok"] },
  { label: "Instagram (1080×1080)", value: "Instagram", ...PLATFORM_SIZES["Instagram"] },
  { label: "HD (1920×1080)", value: "Custom", width: 1920, height: 1080 },
];