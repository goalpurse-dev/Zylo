// Design tokens for the Earn page — 4-level surface scale + text scale.
// Depth comes from luminance steps + hairline borders, never shadows.

export const COLOR = {
  bgCanvas: "#08090a",
  bgPanel: "#0f1011",
  bgSurface: "#131415",
  bgElevated: "#1a1b1d",
  borderSubtle: "rgba(255,255,255,0.06)",
  borderHover: "rgba(255,255,255,0.12)",
  borderStrong: "rgba(255,255,255,0.16)",
  textPrimary: "#f7f8f8",
  textSecondary: "#d0d6e0",
  textTertiary: "#8a8f98",
  textDisabled: "#62666d",
  lime: "#c6f03c",
};

export const BG = {
  canvas: "bg-[#08090a]",
  panel: "bg-[#0f1011]",
  surface: "bg-[#131415]",
  elevated: "bg-[#1a1b1d]",
};

export const BORDER = {
  subtle: "border-[rgba(255,255,255,0.06)]",
  hover: "border-[rgba(255,255,255,0.12)]",
  strong: "border-[rgba(255,255,255,0.16)]",
};

export const TEXT = {
  primary: "text-[#f7f8f8]",
  secondary: "text-[#d0d6e0]",
  tertiary: "text-[#8a8f98]",
  disabled: "text-[#62666d]",
};

// Typography scale
export const TYPE = {
  display: "text-[56px] font-semibold tracking-[-0.03em]",
  h1: "text-[32px] font-semibold tracking-[-0.02em]",
  h2: "text-[20px] font-semibold tracking-[-0.01em]",
  body: "text-[15px] font-normal leading-[1.6]",
  label: "text-[13px] font-medium tracking-[0.02em]",
  micro: "text-[11px] font-medium tracking-[0.06em] uppercase",
};

export const HOVER = "transition-[background-color,border-color] duration-150 ease-out hover:border-[rgba(255,255,255,0.12)] hover:bg-[#1a1b1d]";

// Card base: --bg-surface + --border-subtle, hover → --border-hover / --bg-elevated
export const CARD = `rounded-[13px] border border-[rgba(255,255,255,0.06)] bg-[#131415] ${HOVER}`;
export const CARD_SM = `rounded-[11px] border border-[rgba(255,255,255,0.06)] bg-[#131415] ${HOVER}`;

export const SECTION_LABEL = `${TYPE.micro} text-[#8a8f98]`;
