// Shared class strings for the dark/lime "zyvo" components.
// Values follow docs/zyvo-lime-tokens.md (Cartoon Drive By is the reference).
// Tailwind only emits opacity modifiers from its scale (steps of 5) or in
// brackets, so never write /42, /28, /12 here.

/** Visible keyboard focus for every interactive element. */
export const FOCUS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0F0D]";

/** Pressed feedback for buttons (disabled buttons don't move). */
export const PRESS = "enabled:active:scale-[0.99] motion-reduce:transform-none";

/** Join class names, skipping falsy values. */
export function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}
