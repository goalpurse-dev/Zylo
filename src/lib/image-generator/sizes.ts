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
  // ✅ NORMAL SIZES (UNCHANGED)
  "1:1": {
    label: "1:1",
    width: 1024,
    height: 1024,
    previewW: 18,
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

  // 🔥🔥🔥 NANO PRO 4K SIZES
 "1:1-4k": {
  label: "1:1 (4K)",
  width: 4096,
  height: 4096,
  previewW: 18,
  previewH: 18,
},

"16:9-4k": {
  label: "16:9 (4K)",
  width: 5504,
  height: 3072,
  previewW: 26,
  previewH: 14,
},

"9:16-4k": {
  label: "9:16 (4K)",
  width: 3072,
  height: 5504,
  previewW: 14,
  previewH: 26,
},
};