export const VIDEO_SIZES: Record<
  string,
  {
    width540: { w: number; h: number };
    width720: { w: number; h: number };
    width1080: { w: number; h: number };
  }
> = {
  "1:1": {
    width540: { w: 540, h: 540 },
    width720: { w: 720, h: 720 },
    width1080: { w: 1080, h: 1080 },
  },

  "16:9": {
    width540: { w: 960, h: 540 },
    width720: { w: 1280, h: 720 },
    width1080: { w: 1920, h: 1080 },
  },

  "9:16": {
    width540: { w: 540, h: 960 },
    width720: { w: 720, h: 1280 },
    width1080: { w: 1080, h: 1920 },
  },

  "4:3": {
    width540: { w: 720, h: 540 },
    width720: { w: 960, h: 720 },
    width1080: { w: 1440, h: 1080 },
  },
};
