export const VIDEO_SIZES: Record<
  string,
  { width720: { w: number; h: number }; width1080?: { w: number; h: number } }
> = {
  "1:1": {
    width720: { w: 960, h: 960 },
  },
  "16:9": {
    width720: { w: 1280, h: 720 },
  },
  "9:16": {
    width720: { w: 720, h: 1280 },
  },
};