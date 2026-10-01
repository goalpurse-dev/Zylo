// Charge for work done — the delete confirmation and "Used so far" (frontend).
// project.js imports the Supabase client, so the two pure helpers are lifted
// out of the source and run here as-is.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const src = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const project = src("src/pages/workspace/long-form/project.js");
const fnSource = (name) => {
  const start = project.indexOf(`export function ${name}(`);
  return project.slice(start, project.indexOf("\n}\n", start) + 2).replace("export ", "");
};
// eslint-disable-next-line no-new-func
const deleteConfirmText = new Function(`${fnSource("deleteConfirmText")}; return deleteConfirmText;`)();
const usedLine = project.match(/export const usedSoFarText = (.*);/)[1];
// eslint-disable-next-line no-new-func
const usedSoFarText = new Function(`return ${usedLine};`)();

test("delete confirmation: unused credits back, the rest covers work already done", () => {
  assert.equal(
    deleteConfirmText("Rain video", { reserved: 250, kept: 84, refundIfDeleted: 166, failedByUs: false }),
    `Delete "Rain video"? You'll get back 166 unused credits. 84 credits cover work already done. This can't be undone from here.`,
  );
});

test("delete confirmation: nothing used yet, or our failure -> all credits back", () => {
  assert.match(deleteConfirmText("A", { reserved: 250, kept: 0, refundIfDeleted: 250, failedByUs: false }), /You'll get back all 250 credits\./);
  assert.match(deleteConfirmText("A", { reserved: 250, kept: 0, refundIfDeleted: 250, failedByUs: true }), /You'll get back all 250 credits\./);
  assert.equal(deleteConfirmText("A", null), `Delete "A"? This can't be undone from here.`);
});

test("project card: Used so far: X of Y credits (0 when it failed because of us)", () => {
  assert.equal(usedSoFarText({ reserved: 250, kept: 84, failedByUs: false }), "Used so far: 84 of 250 credits");
  assert.equal(usedSoFarText({ reserved: 250, kept: 84, failedByUs: true }), "Used so far: 0 of 250 credits");
  assert.equal(usedSoFarText(null), null);
});

test("wiring: delete asks with fresh billing; the lobby loads billing onto the cards", () => {
  const shared = src("src/pages/workspace/long-form/shared.jsx");
  assert.match(shared, /const billing = \(await fetchProjectBilling\(\)\)\.get\(project\.id\) \?\? null;\n\s+if \(!window\.confirm\(deleteConfirmText\(title, billing\)\)\) return;/);
  assert.match(shared, /data-testid="used-so-far"/);
  assert.match(src("src/pages/workspace/long-form/index.jsx"), /_billing: billing\.get\(p\.id\) \?\? null/);
  assert.match(project, /supabase\.rpc\("long_form_project_billing"\)/);
});
