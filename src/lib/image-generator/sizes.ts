export const IMAGE_SIZES: Record<
  string,
  { label: string; width: number; height: number }
> = {
  "1:1": { label: "1:1", width: 1024, height: 1024 },

  "4:3": { label: "4:3", width: 1152, height: 896 },

  "16:9": { label: "16:9", width: 1344, height: 768 },

  "9:16": { label: "9:16", width: 768, height: 1344 },

  "21:9": { label: "21:9", width: 1536, height: 640 },

  "2:3": { label: "2:3", width: 832, height: 1216 },

  "3:2": { label: "3:2", width: 1216, height: 832 },
};