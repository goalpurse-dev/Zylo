import { create } from "zustand";
import type { WizardState } from "../types/brand";

const initial: WizardState = {
  basics: { name: "", hasLogoUpload: false },
  visual: { palette: null, fontVibe: "modern" },
  voice: { playful: 40, technical: 40, luxury: 20, toneChips: [] },
  avatar: {},
  products: {},
};

type S = {
  state: WizardState;
  reset: () => void;
  patch: <K extends keyof WizardState>(k: K, v: Partial<WizardState[K]>) => void;
};

export const useBrandWizard = create<S>((set) => ({
  state: structuredClone(initial),
  reset: () => set({ state: structuredClone(initial) }),
  patch: (key, value) => set((s) => ({ state: { ...s.state, [key]: { ...s.state[key], ...value } } })),
}));
