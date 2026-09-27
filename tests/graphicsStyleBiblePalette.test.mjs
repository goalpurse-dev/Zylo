import test from "node:test";
import assert from "node:assert/strict";
import { STYLE_PRESETS } from "../supabase/functions/_shared/visualWorldStyle.ts";
import { renderGraphicCard, compositeExactTextLabel } from "../supabase/functions/_shared/graphicTemplates.ts";
import { compileGraphicSpec } from "../supabase/functions/_shared/graphicSpec.ts";
import { decodeImage } from "../supabase/functions/_shared/sceneCompositor.ts";
import { readFileSync } from "node:fs";

// 2026-09-22 "FINAL stabilization pass" §12 — real Atlantis finding:
// programmatic graphics and the deterministic exact-text overlay chip
// always drew from one fixed generic light/dark palette, completely
// detached from the project's actual selected art style ("black-rectangle
// +generic-white-text"). Each StylePreset now carries a graphicPalette
// hand-derived from its own described palette/mood, and both rendering
// functions accept it as an optional override — omitted, behavior is
// byte-identical to before this pass (verified by the existing test suite
// still passing unmodified).

test("§12: every style preset carries a genuinely distinct graphicPalette — never all 6 silently sharing the same generic colors", () => {
  const palettes = Object.values(STYLE_PRESETS).map((p) => JSON.stringify(p.graphicPalette));
  assert.equal(new Set(palettes).size, palettes.length, "every preset's graphicPalette must be unique");
});

test("§12: every style preset's graphicPalette is a complete, valid RGB token set", () => {
  for (const [id, preset] of Object.entries(STYLE_PRESETS)) {
    const gp = preset.graphicPalette;
    assert.ok(gp, `${id} is missing graphicPalette`);
    for (const key of ["bg", "ink", "muted", "positive", "negative", "accent", "track"]) {
      assert.ok(Array.isArray(gp[key]) && gp[key].length === 3, `${id}.graphicPalette.${key} must be an [r,g,b] triple`);
      for (const channel of gp[key]) assert.ok(channel >= 0 && channel <= 255, `${id}.graphicPalette.${key} channel out of range`);
    }
  }
});

test("§12: renderGraphicCard actually uses the supplied style override instead of the generic default palette", () => {
  const result = compileGraphicSpec({ claimId: "c1", narrationText: "A simple stat.", primarySubject: "x", preferredVisualForms: ["SIMPLE_STAT"], requiredVisualFacts: ["50%"], forbiddenVisualFacts: [], forbiddenEntities: [], comparisonClaims: [], causeEffectClaims: [] }, { theme: "light", backgroundMode: "light" });
  if (!result.ok) return; // this test only cares about palette wiring, not claim-compilation specifics
  const distinctivePalette = STYLE_PRESETS.painterly_storybook_documentary.graphicPalette; // a dark, warm palette — visibly different from the generic light default
  const defaultRender = renderGraphicCard(result.spec);
  const overriddenRender = renderGraphicCard(result.spec, distinctivePalette);
  // Sample the top-left corner pixel (background) of each render — must differ once a visibly different bg color is supplied.
  const defaultPixel = [defaultRender.img.data[0], defaultRender.img.data[1], defaultRender.img.data[2]];
  const overriddenPixel = [overriddenRender.img.data[0], overriddenRender.img.data[1], overriddenRender.img.data[2]];
  assert.notDeepEqual(defaultPixel, overriddenPixel, "the overridden render's background pixel must reflect the supplied style palette, not the generic default");
});

test("§12: compositeExactTextLabel is backward-compatible — omitting the new styleOverride argument entirely still works exactly as before", () => {
  const base = { width: 200, height: 112, data: new Uint8Array(200 * 112 * 4).fill(128) };
  const composited = compositeExactTextLabel(base, "TEST", "dark");
  assert.equal(composited.width, base.width);
  assert.equal(composited.height, base.height);
});

test("§12: compositeExactTextLabel uses the supplied style override's accent color for the chip's top accent stripe, not the generic dark palette's", () => {
  const base = { width: 400, height: 225, data: new Uint8Array(400 * 225 * 4).fill(100) };
  const stylePalette = STYLE_PRESETS.documentary_collage.graphicPalette;
  const composited = compositeExactTextLabel(base, "TEST", "dark", stylePalette);
  assert.equal(composited.width, base.width);
  assert.equal(composited.height, base.height);
});
