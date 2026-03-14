export const IMAGE_SIZES: Record<
  string,
  {
    label: string
    width: number
    height: number
    previewW: number
    previewH: number
  }
> = {
  "1:1": {
    label: "1:1",
    width: 1024,
    height: 1024,
    previewW: 18,
    previewH: 18,
  },

  "4:3": {
    label: "4:3",
    width: 1152,
    height: 896,
    previewW: 24,
    previewH: 18,
  },

  "16:9": {
    label: "16:9",
    width: 1344,
    height: 768,
    previewW: 26,
    previewH: 14,
  },

  "9:16": {
    label: "9:16",
    width: 768,
    height: 1344,
    previewW: 14,
    previewH: 26,
  },

  "21:9": {
    label: "21:9",
    width: 1536,
    height: 640,
    previewW: 28,
    previewH: 12,
  },

  "2:3": {
    label: "2:3",
    width: 832,
    height: 1216,
    previewW: 16,
    previewH: 24,
  },

  "3:2": {
    label: "3:2",
    width: 1216,
    height: 832,
    previewW: 24,
    previewH: 16,
  },
};