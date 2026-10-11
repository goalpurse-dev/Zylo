// The viewport tag (index.html) lets people pinch-zoom every page. iOS Safari
// also zooms in by itself when a text field under 16 px gets focus, and stays
// zoomed. So only while a field has focus, zooming is capped; it is free again
// as soon as the field is left.
export const VIEWPORT = "width=device-width, initial-scale=1, viewport-fit=cover";
const WHILE_TYPING = `${VIEWPORT}, maximum-scale=1`;

export function installViewportZoom() {
  const meta = document.querySelector('meta[name="viewport"]');
  if (!meta) return;
  const isField = (el) => el instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
  const cap = (event) => { if (isField(event.target)) meta.setAttribute("content", WHILE_TYPING); };
  const free = (event) => { if (isField(event.target)) meta.setAttribute("content", VIEWPORT); };
  document.addEventListener("touchstart", cap, { passive: true });
  document.addEventListener("focusin", cap);
  document.addEventListener("focusout", free);
}
