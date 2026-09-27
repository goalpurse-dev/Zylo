// deno-lint-ignore-file no-explicit-any
// graphicTemplates.ts — 2026-09-17 "long-form quality pass" (Part 2).
//
// Replaces the old renderProgrammaticGraphicCard's single generic
// centered-text layout (a real Mars incident: Chapter 4's cards read as
// giant, glitchy pixel-text fragments) with SIX genuinely distinct,
// production-quality templates, plus one deliberately plain (but still
// real, still anti-aliased, still safe-zone-respecting) TEXT_STATEMENT
// fallback — never the forbidden "silent BIG_TEXT garbage" pattern.
//
// Every template: real vector stroke text (sceneCompositor.ts's
// drawStrokeText — genuinely anti-aliased via supersample rendering, never
// a 5x7 bitmap grid), real vector icons, a light warm-off-white default
// background (dark theme supported), strict safe margins, responsive
// (auto-shrinking) text sizing, and a real 16:9 canvas.
import {
  type RawImage, createSupersampledCanvas, downsampleBox, drawRect, drawLine, drawCircleOutline,
  drawStrokeText, measureStrokeText, drawIcon, drawArrow, drawXMark, encodePng,
} from "./sceneCompositor.ts";
import type { GraphicSpec } from "./graphicSpec.ts";

export const GRAPHIC_CARD_WIDTH = 1360;
export const GRAPHIC_CARD_HEIGHT = 768;
const SUPERSAMPLE = 3;
const SAFE_MARGIN_PCT = 0.08;

export type Palette = { bg: [number, number, number]; ink: [number, number, number]; muted: [number, number, number]; positive: [number, number, number]; negative: [number, number, number]; accent: [number, number, number]; track: [number, number, number] };
const PALETTES: Record<"light" | "dark", Palette> = {
  light: { bg: [250, 246, 238], ink: [32, 32, 40], muted: [110, 108, 116], positive: [46, 139, 87], negative: [196, 64, 64], accent: [58, 102, 176], track: [222, 216, 202] },
  dark: { bg: [22, 24, 30], ink: [240, 240, 244], muted: [160, 162, 170], positive: [96, 200, 140], negative: [230, 110, 110], accent: [120, 170, 235], track: [50, 54, 64] },
};

export type GraphicRenderResult = { img: RawImage; issues: string[] };

function fitStrokeText(text: string, maxCapHeight: number, minCapHeight: number, maxWidth: number): { capHeight: number; width: number } {
  for (let h = maxCapHeight; h >= minCapHeight; h -= Math.max(1, Math.round(maxCapHeight * 0.05))) {
    const { width } = measureStrokeText(text, h);
    if (width <= maxWidth) return { capHeight: h, width };
  }
  const { width } = measureStrokeText(text, minCapHeight);
  return { capHeight: minCapHeight, width };
}
function centeredText(img: RawImage, text: string, centerX: number, topY: number, capHeight: number, color: [number, number, number]) {
  const { width } = measureStrokeText(text, capHeight);
  drawStrokeText(img, text, Math.round(centerX - width / 2), topY, capHeight, capHeight * 0.1, color);
  return width;
}

/* ============================ Part 2: the six templates + fallback ============================ */

function renderSymbolNegation(img: RawImage, spec: Extract<GraphicSpec, { template: "SYMBOL_NEGATION" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  const iconSize = Math.round(safe.h * 0.4);
  const iconX = cx - iconSize / 2, iconY = safe.y + safe.h * 0.08;
  const iconColor = spec.polarity === "affirmed" ? p.positive : p.negative;
  drawIcon(img, spec.icon, iconX, iconY, iconSize, p.ink);
  if (spec.polarity !== "affirmed") drawXMark(img, cx, iconY + iconSize / 2, iconSize * 1.15, p.negative, Math.max(3, Math.round(iconSize * 0.07)));
  else drawIcon(img, "check", iconX + iconSize * 0.55, iconY + iconSize * 0.55, iconSize * 0.55, p.positive);
  if (spec.label) {
    const fit = fitStrokeText(spec.label.toUpperCase(), Math.round(safe.h * 0.14), Math.round(safe.h * 0.06), safe.w * 0.9);
    if (fit.width > safe.w * 0.9) issues.push("SYMBOL_NEGATION label overflowed available width even at minimum size");
    centeredText(img, spec.label.toUpperCase(), cx, iconY + iconSize * 1.25, fit.capHeight, iconColor);
  }
}

function renderQuantityResource(img: RawImage, spec: Extract<GraphicSpec, { template: "QUANTITY_RESOURCE" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  const iconSize = Math.round(safe.h * 0.26);
  if (spec.icon) drawIcon(img, spec.icon, cx - iconSize / 2, safe.y + safe.h * 0.04, iconSize, p.accent);
  const valueText = spec.unit ? `${spec.value} ${spec.unit}` : spec.value;
  const fit = fitStrokeText(valueText.toUpperCase(), Math.round(safe.h * 0.34), Math.round(safe.h * 0.16), safe.w * 0.92);
  if (fit.width > safe.w * 0.92) issues.push("QUANTITY_RESOURCE value overflowed available width even at minimum size");
  const valueTop = safe.y + safe.h * 0.34;
  centeredText(img, valueText.toUpperCase(), cx, valueTop, fit.capHeight, p.ink);
  if (spec.label) {
    const labelFit = fitStrokeText(spec.label.toUpperCase(), Math.round(safe.h * 0.12), Math.round(safe.h * 0.05), safe.w * 0.9);
    centeredText(img, spec.label.toUpperCase(), cx, valueTop + fit.capHeight * 1.35, labelFit.capHeight, p.muted);
  }
}

function renderComparison(img: RawImage, spec: Extract<GraphicSpec, { template: "COMPARISON" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  drawLine(img, cx, Math.round(safe.y + safe.h * 0.12), cx, Math.round(safe.y + safe.h * 0.88), p.track, Math.max(2, Math.round(safe.h * 0.012)));
  const colWidth = safe.w * 0.42;
  const sides: { label: string; value: string | null; x: number }[] = [
    { label: spec.leftLabel, value: spec.leftValue, x: safe.x + colWidth / 2 },
    { label: spec.rightLabel, value: spec.rightValue, x: safe.x + safe.w - colWidth / 2 },
  ];
  for (const side of sides) {
    const labelFit = fitStrokeText(side.label.toUpperCase(), Math.round(safe.h * 0.15), Math.round(safe.h * 0.035), colWidth * 0.94);
    if (labelFit.width > colWidth * 0.94) issues.push(`COMPARISON label "${side.label}" overflowed its column even at minimum size`);
    let top = safe.y + safe.h * 0.3;
    centeredText(img, side.label.toUpperCase(), side.x, top, labelFit.capHeight, p.ink);
    if (side.value) {
      top += labelFit.capHeight * 1.4;
      const valueFit = fitStrokeText(side.value.toUpperCase(), Math.round(safe.h * 0.2), Math.round(safe.h * 0.08), colWidth * 0.9);
      centeredText(img, side.value.toUpperCase(), side.x, top, valueFit.capHeight, p.accent);
    }
  }
}

function renderAnnotatedSubject(img: RawImage, spec: Extract<GraphicSpec, { template: "ANNOTATED_SUBJECT" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  const subjectSize = Math.round(Math.min(safe.w, safe.h) * 0.28);
  const subjectX = cx - subjectSize / 2, subjectY = cy - subjectSize / 2;
  drawIcon(img, spec.subjectIcon, subjectX, subjectY, subjectSize, p.ink);
  const n = Math.min(4, spec.annotations.length) || 1;
  if (!spec.annotations.length) { issues.push("ANNOTATED_SUBJECT compiled with zero annotations"); return; }
  const angles = [-135, -45, 135, 45].slice(0, n);
  angles.forEach((deg, i) => {
    const rad = (deg * Math.PI) / 180;
    const anchorR = subjectSize * 0.62;
    const anchorX = cx + anchorR * Math.cos(rad), anchorY = cy + anchorR * Math.sin(rad);
    const labelR = Math.min(safe.w, safe.h) * 0.44;
    const labelX = cx + labelR * Math.cos(rad), labelY = cy + labelR * Math.sin(rad);
    drawLine(img, Math.round(anchorX), Math.round(anchorY), Math.round(labelX), Math.round(labelY), p.muted, Math.max(2, Math.round(safe.h * 0.01)));
    drawCircleOutline(img, Math.round(anchorX), Math.round(anchorY), Math.max(3, Math.round(safe.h * 0.01)), p.accent, 2);
    const text = spec.annotations[i].toUpperCase();
    const fit = fitStrokeText(text, Math.round(safe.h * 0.09), Math.round(safe.h * 0.045), safe.w * 0.3);
    const textX = Math.cos(rad) >= 0 ? labelX : labelX - measureStrokeText(text, fit.capHeight).width;
    drawStrokeText(img, text, Math.round(textX), Math.round(labelY - fit.capHeight / 2), fit.capHeight, fit.capHeight * 0.1, p.ink);
  });
}

function renderCauseEffect(img: RawImage, spec: Extract<GraphicSpec, { template: "CAUSE_EFFECT" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  const n = spec.steps.length;
  if (n < 2) { issues.push("CAUSE_EFFECT compiled with fewer than 2 steps"); return; }
  const gap = safe.w / n;
  spec.steps.forEach((step, i) => {
    const boxCx = safe.x + gap * i + gap / 2;
    const fit = fitStrokeText(step.toUpperCase(), Math.round(safe.h * 0.11), Math.round(safe.h * 0.03), gap * 0.92);
    if (fit.width > gap * 0.92) issues.push(`CAUSE_EFFECT step "${step}" overflowed its slot even at minimum size`);
    centeredText(img, step.toUpperCase(), boxCx, cy - fit.capHeight / 2, fit.capHeight, p.ink);
    if (i < n - 1) {
      const arrowY = cy;
      drawArrow(img, Math.round(safe.x + gap * (i + 1) - gap * 0.16), Math.round(arrowY), Math.round(safe.x + gap * (i + 1) + gap * 0.02), Math.round(arrowY), p.accent, Math.max(3, Math.round(safe.h * 0.015)));
    }
  });
}

function renderResourceBar(img: RawImage, spec: Extract<GraphicSpec, { template: "RESOURCE_BAR" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  if (spec.fraction < 0 || spec.fraction > 1) issues.push(`RESOURCE_BAR fraction ${spec.fraction} outside 0-1`);
  const fraction = Math.max(0, Math.min(1, spec.fraction));
  const labelFit = fitStrokeText(spec.label.toUpperCase(), Math.round(safe.h * 0.12), Math.round(safe.h * 0.05), safe.w * 0.9);
  centeredText(img, spec.label.toUpperCase(), cx, safe.y + safe.h * 0.06, labelFit.capHeight, p.muted);
  const barW = safe.w * 0.86, barH = safe.h * 0.16, barX = cx - barW / 2, barY = safe.y + safe.h * 0.34;
  drawRect(img, Math.round(barX), Math.round(barY), Math.round(barW), Math.round(barH), p.track, 255);
  drawRect(img, Math.round(barX), Math.round(barY), Math.round(barW * fraction), Math.round(barH), fraction < 0.25 ? p.negative : p.accent, 255);
  const valueText = spec.unit ? `${spec.value} ${spec.unit}` : spec.value;
  const valueFit = fitStrokeText(valueText.toUpperCase(), Math.round(safe.h * 0.2), Math.round(safe.h * 0.09), safe.w * 0.9);
  centeredText(img, valueText.toUpperCase(), cx, barY + barH * 1.4, valueFit.capHeight, p.ink);
}

function renderProcess(img: RawImage, spec: Extract<GraphicSpec, { template: "PROCESS" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  const n = spec.steps.length;
  if (n < 2) { issues.push("PROCESS compiled with fewer than 2 steps"); return; }
  const gap = safe.w / n;
  const iconSize = Math.min(gap * 0.5, safe.h * 0.4);
  spec.steps.forEach((step, i) => {
    const stepCx = safe.x + gap * i + gap / 2;
    drawIcon(img, step.icon, stepCx - iconSize / 2, cy - iconSize * 0.7, iconSize, p.ink);
    const fit = fitStrokeText(step.label.toUpperCase(), Math.round(safe.h * 0.09), Math.round(safe.h * 0.028), gap * 0.94);
    if (fit.width > gap * 0.94) issues.push(`PROCESS step "${step.label}" overflowed its slot even at minimum size`);
    centeredText(img, step.label.toUpperCase(), stepCx, cy + iconSize * 0.35, fit.capHeight, p.muted);
    if (i < n - 1) {
      const arrowY = cy - iconSize * 0.2;
      drawArrow(img, Math.round(safe.x + gap * (i + 1) - gap * 0.18), Math.round(arrowY), Math.round(safe.x + gap * (i + 1) + gap * 0.02), Math.round(arrowY), p.accent, Math.max(3, Math.round(safe.h * 0.015)));
    }
  });
}

function renderTimeline(img: RawImage, spec: Extract<GraphicSpec, { template: "TIMELINE" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  if (spec.markers.length < 2) { issues.push("TIMELINE compiled with fewer than 2 markers"); return; }
  const lineY = cy;
  drawLine(img, Math.round(safe.x), lineY, Math.round(safe.x + safe.w), lineY, p.track, Math.max(3, Math.round(safe.h * 0.012)));
  spec.markers.forEach((marker, i) => {
    const mx = safe.x + safe.w * Math.max(0, Math.min(1, marker.position));
    drawCircleOutline(img, Math.round(mx), lineY, Math.max(6, Math.round(safe.h * 0.02)), p.accent, Math.max(3, Math.round(safe.h * 0.015)));
    const above = i % 2 === 0;
    const fit = fitStrokeText(marker.label.toUpperCase(), Math.round(safe.h * 0.09), Math.round(safe.h * 0.045), safe.w / spec.markers.length * 0.9);
    if (fit.width > (safe.w / spec.markers.length) * 0.9) issues.push(`TIMELINE marker "${marker.label}" overflowed its slot even at minimum size`);
    const textY = above ? lineY - fit.capHeight * 2 : lineY + fit.capHeight * 0.8;
    const { width } = measureStrokeText(marker.label.toUpperCase(), fit.capHeight);
    drawStrokeText(img, marker.label.toUpperCase(), Math.round(mx - width / 2), Math.round(textY), fit.capHeight, fit.capHeight * 0.1, p.ink);
    drawLine(img, Math.round(mx), lineY, Math.round(mx), Math.round(above ? textY + fit.capHeight * 1.3 : textY - fit.capHeight * 0.3), p.muted, 2);
  });
}

function renderBeforeAfter(img: RawImage, spec: Extract<GraphicSpec, { template: "BEFORE_AFTER" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  const colWidth = safe.w * 0.44;
  const sides: { tag: string; label: string; icon: typeof spec.beforeIcon; x: number; color: [number, number, number] }[] = [
    { tag: "BEFORE", label: spec.beforeLabel, icon: spec.beforeIcon, x: safe.x + colWidth / 2, color: p.muted },
    { tag: "AFTER", label: spec.afterLabel, icon: spec.afterIcon, x: safe.x + safe.w - colWidth / 2, color: p.accent },
  ];
  drawArrow(img, Math.round(cx - safe.w * 0.05), Math.round(cy), Math.round(cx + safe.w * 0.05), Math.round(cy), p.accent, Math.max(3, Math.round(safe.h * 0.015)));
  for (const side of sides) {
    const tagFit = fitStrokeText(side.tag, Math.round(safe.h * 0.08), Math.round(safe.h * 0.04), colWidth * 0.9);
    centeredText(img, side.tag, side.x, safe.y + safe.h * 0.08, tagFit.capHeight, side.color);
    if (side.icon) drawIcon(img, side.icon, side.x - safe.h * 0.13, safe.y + safe.h * 0.22, safe.h * 0.26, p.ink);
    const labelFit = fitStrokeText(side.label.toUpperCase(), Math.round(safe.h * 0.13), Math.round(safe.h * 0.055), colWidth * 0.9);
    if (labelFit.width > colWidth * 0.9) issues.push(`BEFORE_AFTER label "${side.label}" overflowed its column even at minimum size`);
    centeredText(img, side.label.toUpperCase(), side.x, safe.y + safe.h * 0.62, labelFit.capHeight, p.ink);
  }
}

function renderSimpleStat(img: RawImage, spec: Extract<GraphicSpec, { template: "SIMPLE_STAT" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  const fit = fitStrokeText(spec.value.toUpperCase(), Math.round(safe.h * 0.4), Math.round(safe.h * 0.18), safe.w * 0.94);
  if (fit.width > safe.w * 0.94) issues.push("SIMPLE_STAT value overflowed available width even at minimum size");
  let top = cy - fit.capHeight / 2;
  if (spec.label) top -= safe.h * 0.08;
  centeredText(img, spec.value.toUpperCase(), cx, top, fit.capHeight, p.accent);
  if (spec.label) {
    const labelFit = fitStrokeText(spec.label.toUpperCase(), Math.round(safe.h * 0.11), Math.round(safe.h * 0.05), safe.w * 0.9);
    centeredText(img, spec.label.toUpperCase(), cx, top + fit.capHeight * 1.3, labelFit.capHeight, p.muted);
  }
}

// Greedy word-wrap at a GIVEN cap height — same principle as
// renderTextStatement's own wrap loop, factored out so BULLET_LIST rows can
// wrap to up to 2 lines instead of one, since list items are exactly the
// content shape (short phrases, not single words) most likely to need it.
function wrapAtCapHeight(text: string, capHeight: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (measureStrokeText(candidate, capHeight).width > maxWidth && current) { lines.push(current); current = w; } else current = candidate;
  }
  if (current) lines.push(current);
  return lines;
}

function renderBulletList(img: RawImage, spec: Extract<GraphicSpec, { template: "BULLET_LIST" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  if (!spec.items.length) { issues.push("BULLET_LIST compiled with zero items"); return; }
  let top = safe.y;
  if (spec.title) {
    const titleFit = fitStrokeText(spec.title.toUpperCase(), Math.round(safe.h * 0.08), Math.round(safe.h * 0.04), safe.w * 0.94);
    centeredText(img, spec.title.toUpperCase(), cx, top, titleFit.capHeight, p.muted);
    top += titleFit.capHeight * 1.5;
    drawLine(img, Math.round(safe.x + safe.w * 0.22), Math.round(top), Math.round(safe.x + safe.w * 0.78), Math.round(top), p.track, Math.max(2, Math.round(safe.h * 0.006)));
    top += safe.h * 0.045;
  }
  const rows = spec.items.length + (spec.overflowCount > 0 ? 1 : 0);
  const availableH = safe.y + safe.h - top;
  const rowH = availableH / rows;
  const iconSize = Math.max(16, Math.min(rowH * 0.5, safe.h * 0.14));
  const textX = safe.x + iconSize * 1.6;
  const textMaxWidth = safe.w - iconSize * 1.6;
  const maxCap = Math.min(rowH * 0.34, safe.h * 0.065);
  const minCap = Math.max(Math.round(safe.h * 0.026), 10);

  spec.items.forEach((item, i) => {
    const rowTop = top + rowH * i;
    const rowCy = rowTop + rowH / 2;
    drawIcon(img, item.icon, safe.x, rowCy - iconSize / 2, iconSize, p.accent);
    const text = item.text.toUpperCase();
    let chosenLines: string[] | null = null;
    let chosenCap = minCap;
    for (let capHeight = Math.round(maxCap); capHeight >= minCap; capHeight -= Math.max(1, Math.round(maxCap * 0.08))) {
      const lines = wrapAtCapHeight(text, capHeight, textMaxWidth);
      if (lines.length <= 2 && lines.every((l) => measureStrokeText(l, capHeight).width <= textMaxWidth) && lines.length * capHeight * 1.3 <= rowH * 0.92) {
        chosenLines = lines; chosenCap = capHeight; break;
      }
    }
    if (!chosenLines) {
      issues.push(`BULLET_LIST item "${item.text}" overflowed its row even at minimum size`);
      chosenLines = wrapAtCapHeight(text, minCap, textMaxWidth).slice(0, 2);
      chosenCap = minCap;
    }
    const lineHeight = chosenCap * 1.3;
    const blockTop = rowCy - (chosenLines.length * lineHeight) / 2;
    chosenLines.forEach((line, li) => {
      drawStrokeText(img, line, Math.round(textX), Math.round(blockTop + li * lineHeight), chosenCap, chosenCap * 0.1, p.ink);
    });
  });

  if (spec.overflowCount > 0) {
    const footerCy = top + rowH * spec.items.length + rowH / 2;
    const footerFit = fitStrokeText(`+${spec.overflowCount} MORE`, Math.round(maxCap), minCap, safe.w * 0.9);
    centeredText(img, `+${spec.overflowCount} MORE`, cx, footerCy - footerFit.capHeight / 2, footerFit.capHeight, p.muted);
  }
}

function renderTextStatement(img: RawImage, spec: Extract<GraphicSpec, { template: "TEXT_EMPHASIS" }>, p: Palette, cx: number, cy: number, safe: { x: number; y: number; w: number; h: number }, issues: string[]) {
  const words = spec.text.toUpperCase().split(/\s+/).filter(Boolean);
  const maxCap = Math.round(safe.h * 0.22), minCap = Math.round(safe.h * 0.08);
  for (let capHeight = maxCap; capHeight >= minCap; capHeight -= Math.max(1, Math.round(maxCap * 0.06))) {
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      if (measureStrokeText(candidate, capHeight).width > safe.w * 0.94 && current) { lines.push(current); current = w; } else current = candidate;
    }
    if (current) lines.push(current);
    const lineHeight = capHeight * 1.5;
    const blockHeight = lines.length * lineHeight;
    if (blockHeight <= safe.h * 0.9 && lines.every((l) => measureStrokeText(l, capHeight).width <= safe.w * 0.94)) {
      let top = cy - blockHeight / 2;
      for (const line of lines) { centeredText(img, line, cx, top, capHeight, p.ink); top += lineHeight; }
      return;
    }
  }
  issues.push("TEXT_STATEMENT text did not fit even at minimum scale");
  centeredText(img, words.slice(0, 3).join(" ") + "…", cx, cy - minCap / 2, minCap, p.ink);
}

// Part 10: deterministic structural QA. We know EXACTLY what primitives we
// attempted to draw (unlike a generated photo, there is no vision-model
// guesswork needed) — so validate the actual rendered pixels for the two
// failure modes a template-level `issues` push can't catch on its own:
// (1) a genuinely BLANK/near-blank card (the real "Shot 63 blank" and
// "Shots 54/55 corrupted" incidents this exists to catch), measured as the
// fraction of pixels that differ meaningfully from the flat background
// color; (2) a canvas that came back the wrong size/shape entirely.
// Returns issues to APPEND to the caller's own list, never replaces it.
const MIN_VISUAL_OCCUPANCY = 0.015; // at least 1.5% of pixels must differ from the flat background — a real drawn card always clears this by a wide margin; a blank one does not.
export function validateGraphicOccupancy(img: RawImage, bg: [number, number, number]): { occupancyRatio: number; issues: string[] } {
  const issues: string[] = [];
  const data = img.data as Uint8Array;
  const totalPixels = img.width * img.height;
  let differing = 0;
  const sampleStride = Math.max(1, Math.floor(totalPixels / 200_000)); // sample for speed on large canvases; still statistically solid for a blank-detection threshold this coarse
  let sampled = 0;
  for (let i = 0; i < totalPixels; i += sampleStride) {
    const o = i * 4;
    const dr = Math.abs(data[o] - bg[0]), dg = Math.abs(data[o + 1] - bg[1]), db = Math.abs(data[o + 2] - bg[2]);
    if (dr + dg + db > 24) differing++;
    sampled++;
  }
  const occupancyRatio = sampled ? differing / sampled : 0;
  if (occupancyRatio < MIN_VISUAL_OCCUPANCY) issues.push(`BLANK_OR_NEAR_BLANK_OUTPUT: only ${(occupancyRatio * 100).toFixed(2)}% of the card differs from its own background — nothing meaningful was actually drawn`);
  return { occupancyRatio, issues };
}

// Which primitives EACH template is contractually required to have drawn —
// Part 10's "validate required subjects/operator/arrows/X/check rendered."
// Template render functions already push a descriptive issue when a step
// itself can't fit; this is the complementary structural check: did the
// template even have enough INPUT to draw the operator it promises (e.g. a
// SYMBOL_NEGATION with zero label AND a generic icon is a weak/degenerate
// render, not a hard failure, but worth flagging).
function validateRequiredElements(spec: GraphicSpec): string[] {
  const issues: string[] = [];
  switch (spec.template) {
    case "SYMBOL_NEGATION": if (!spec.icon) issues.push("SYMBOL_NEGATION missing its required subject icon"); break;
    case "PROCESS": if (spec.steps.length < 2) issues.push("PROCESS requires at least 2 steps to show a real transformation"); break;
    case "CAUSE_EFFECT": if (spec.steps.length < 2) issues.push("CAUSE_EFFECT requires at least 2 steps"); break;
    case "COMPARISON": if (!spec.leftLabel || !spec.rightLabel) issues.push("COMPARISON requires both sides to be present"); break;
    case "BEFORE_AFTER": if (!spec.beforeLabel || !spec.afterLabel) issues.push("BEFORE_AFTER requires both a before and an after state"); break;
    case "TIMELINE": if (spec.markers.length < 2) issues.push("TIMELINE requires at least 2 markers"); break;
    case "ANNOTATED_SUBJECT": if (!spec.annotations.length) issues.push("ANNOTATED_SUBJECT requires at least 1 callout"); break;
    case "RESOURCE_BAR": case "QUANTITY_RESOURCE": case "SIMPLE_STAT": if (!spec.value) issues.push(`${spec.template} requires an exact value`); break;
    case "BULLET_LIST": if (!spec.items.length) issues.push("BULLET_LIST requires at least 1 item"); break;
  }
  return issues;
}

// The ONE authoritative renderer. Always produces a real 16:9 image and a
// non-throwing `issues` list (Part 7/10's deterministic validation feeds
// off this — never dependent on vision QA for a deterministic graphic) — a
// compiled spec whose template isn't one of the eleven known values is a
// genuine bug (compileGraphicSpec can never produce one), so that case
// throws loudly rather than being silently absorbed.
// 2026-09-22 "FINAL stabilization pass" §12 — an optional style-derived
// palette override (visualWorldStyle.ts's StylePreset.graphicPalette).
// Omitted entirely, behavior is byte-identical to before this pass (the
// generic light/dark PALETTES below) — every existing caller that hasn't
// been updated keeps working unchanged.
export function renderGraphicCard(spec: GraphicSpec, styleOverride?: Palette | null): GraphicRenderResult {
  const palette = styleOverride ?? PALETTES[spec.theme] ?? PALETTES.light;
  const canvas = createSupersampledCanvas(GRAPHIC_CARD_WIDTH, GRAPHIC_CARD_HEIGHT, SUPERSAMPLE);
  drawRect(canvas, 0, 0, canvas.width, canvas.height, palette.bg, 255);
  const marginX = canvas.width * SAFE_MARGIN_PCT, marginY = canvas.height * SAFE_MARGIN_PCT;
  const safe = { x: marginX, y: marginY, w: canvas.width - marginX * 2, h: canvas.height - marginY * 2 };
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const issues: string[] = [...validateRequiredElements(spec)];

  switch (spec.template) {
    case "SYMBOL_NEGATION": renderSymbolNegation(canvas, spec, palette, cx, cy, safe, issues); break;
    case "QUANTITY_RESOURCE": renderQuantityResource(canvas, spec, palette, cx, cy, safe, issues); break;
    case "COMPARISON": renderComparison(canvas, spec, palette, cx, cy, safe, issues); break;
    case "ANNOTATED_SUBJECT": renderAnnotatedSubject(canvas, spec, palette, cx, cy, safe, issues); break;
    case "CAUSE_EFFECT": renderCauseEffect(canvas, spec, palette, cx, cy, safe, issues); break;
    case "RESOURCE_BAR": renderResourceBar(canvas, spec, palette, cx, cy, safe, issues); break;
    case "PROCESS": renderProcess(canvas, spec, palette, cx, cy, safe, issues); break;
    case "TIMELINE": renderTimeline(canvas, spec, palette, cx, cy, safe, issues); break;
    case "BEFORE_AFTER": renderBeforeAfter(canvas, spec, palette, cx, cy, safe, issues); break;
    case "SIMPLE_STAT": renderSimpleStat(canvas, spec, palette, cx, cy, safe, issues); break;
    case "BULLET_LIST": renderBulletList(canvas, spec, palette, cx, cy, safe, issues); break;
    case "TEXT_EMPHASIS": renderTextStatement(canvas, spec, palette, cx, cy, safe, issues); break;
    default: throw new Error(`UNSUPPORTED_GRAPHIC_TEMPLATE: ${(spec as any).template}`);
  }

  const accentBarHeight = Math.round(canvas.height * 0.012);
  drawRect(canvas, 0, 0, canvas.width, accentBarHeight, palette.accent, 255);
  const final = downsampleBox(canvas, SUPERSAMPLE);
  const occupancy = validateGraphicOccupancy(final, palette.bg);
  issues.push(...occupancy.issues);
  return { img: final, issues };
}

export { PALETTES as GRAPHIC_PALETTES };

/* ============================ Part 6: deterministic exact-text overlay ============================
 * Composites a small, real, anti-aliased label chip carrying a
 * CRITICAL_EXACT_TEXT fact onto an already-generated GENERATE/EDIT base
 * image — the missing half of "base pixels -> deterministic exact overlays
 * -> final 16:9 composite -> QA". Never touches the rest of the frame; the
 * chip is rendered on its own small supersampled canvas (real AA) and
 * blitted onto the real base image at native resolution.
 */
import { blitImage } from "./sceneCompositor.ts";
export function compositeExactTextLabel(base: RawImage, text: string, theme: "light" | "dark" = "dark", styleOverride?: Palette | null): RawImage {
  const palette = styleOverride ?? PALETTES[theme] ?? PALETTES.dark;
  const chipW = Math.round(base.width * 0.84), chipH = Math.round(base.height * 0.12);
  const factor = SUPERSAMPLE;
  const chip = createSupersampledCanvas(chipW, chipH, factor);
  drawRect(chip, 0, 0, chip.width, chip.height, palette.bg, 235);
  drawRect(chip, 0, 0, chip.width, Math.round(chip.height * 0.06), palette.accent, 255);
  const label = text.toUpperCase();
  const maxCap = Math.round(chip.height * 0.5), minCap = Math.round(chip.height * 0.22);
  const fit = fitStrokeText(label, maxCap, minCap, chip.width * 0.88);
  if (fit.width > chip.width * 0.88) throw new Error("EXACT_TEXT_OVERLAY_TOO_LONG");
  const th = fit.capHeight;
  drawStrokeText(chip, label, Math.round((chip.width - fit.width) / 2), Math.round((chip.height - th) / 2), th, th * 0.1, palette.ink);
  const chipFinal = downsampleBox(chip, factor);
  const result: RawImage = { width: base.width, height: base.height, data: Uint8Array.from(base.data as Uint8Array) };
  const margin = Math.round(base.width * 0.04);
  blitImage(result, chipFinal, base.width - chipW - margin, base.height - chipH - margin);
  return result;
}
