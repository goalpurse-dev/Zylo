import create from "zustand";

const useThumbStore = create((set) => ({
  mode: "paint",
  canvas: {
    zoom: 1,
    tool: "brush",
    brushSize: 20,
    color: "#ffffff",
    opacity: 1,
    layers: [],
    maskDataURL: undefined,
    bgDataURL: undefined,
  },
  prompt: {
    text: "",
    negative: "",
    styleId: "",
    focus: [],
    strength: 0.7,
    variations: 2,
    seed: undefined,
  },
  outputs: [],
  credits: 5,
  actions: {
    setMode: (mode) => set({ mode }),
    setPrompt: (prompt) => set({ prompt }),
    addOutput: (output) =>
      set((state) => ({ outputs: [...state.outputs, output] })),
    setBg: (src) =>
      set((state) => ({
        canvas: { ...state.canvas, bgDataURL: src },
      })),
    exportMask: async () => {
      // placeholder: would return a PNG data URL
      return "data:image/png;base64,placeholder";
    },
    chargeCredits: (n) =>
      set((state) => ({ credits: Math.max(0, state.credits - n) })),
    reset: () =>
      set({
        mode: "paint",
        canvas: {
          zoom: 1,
          tool: "brush",
          brushSize: 20,
          color: "#ffffff",
          opacity: 1,
          layers: [],
          maskDataURL: undefined,
          bgDataURL: undefined,
        },
        prompt: {
          text: "",
          negative: "",
          styleId: "",
          focus: [],
          strength: 0.7,
          variations: 2,
          seed: undefined,
        },
        outputs: [],
        credits: 5,
      }),
  },
}));

export default useThumbStore;