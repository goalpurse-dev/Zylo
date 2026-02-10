export const IMAGE_SIZES: Record<
  string,
  { label: string; width: number; height: number }
> = {
  "1:1": { label: "1:1", width: 1024, height: 1024 },
  "4:3": { label: "4:3", width: 1152, height: 864 },
  "16:9": { label: "16:9", width: 1536, height: 864 },
  "9:16": { label: "9:16", width: 864, height: 1536 },
  "21:9": { label: "21:9", width: 1792, height: 768 },
  "2:3": { label: "2:3", width: 768, height: 1152 },
};
