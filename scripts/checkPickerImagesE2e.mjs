// Phase 0, Section A — permanent e2e regression check for the "only the
// first card shows an image" bug in the niche/style picker modals
// (ProductionSetup.jsx's NichePickerModal/StylePickerModal). Opens each
// modal at 1440px and 390px, scrolls to the bottom, and asserts every card
// image has naturalWidth > 0 and the fallback tile never rendered.
//
// Not wired into `npm test` — needs Playwright + a running dev/preview
// server, neither of which this repo carries as a permanent dependency.
// Run on demand:
//   npm install --no-save playwright && npx playwright install chromium
//   npm run dev   (in another terminal)
//   node scripts/checkPickerImagesE2e.mjs [baseUrl]
import { chromium } from "playwright";

const BASE_URL = process.argv[2] ?? "http://localhost:5173";
const VIEWPORTS = [
  { width: 1440, height: 900, label: "desktop-1440" },
  { width: 390, height: 844, label: "mobile-390" },
];

async function checkModal(page, label, openText, { selectNicheFirst = false } = {}) {
  await page.goto(`${BASE_URL}/long-form/create`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.getByText("Decline").click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);

  if (selectNicheFirst) {
    await page.getByText("Choose your niche").click({ force: true });
    await page.waitForTimeout(500);
    await page.locator('[role="dialog"] .overflow-y-auto button').first().click({ force: true });
    await page.waitForTimeout(400);
  }

  // Both the niche row and the style row show "Change" once a niche is
  // picked — the style row's is always the last one in the DOM.
  const opener = openText === "Change" ? page.getByText(openText, { exact: true }).last() : page.getByText(openText, { exact: true });
  await opener.click({ force: true });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const scrollable = dialog?.querySelector(".overflow-y-auto");
    if (scrollable) scrollable.scrollTop = scrollable.scrollHeight;
  });
  await page.waitForTimeout(1500);

  const cards = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    const imgs = Array.from(dialog.querySelectorAll("img"));
    return imgs.map((img) => ({ src: img.getAttribute("src"), complete: img.complete, naturalWidth: img.naturalWidth }));
  });

  const broken = cards.filter((c) => !(c.complete && c.naturalWidth > 0));
  const status = broken.length === 0 ? "PASS" : "FAIL";
  console.log(`[${label}] ${openText}: ${status} — ${cards.length} images, ${broken.length} broken/incomplete`);
  if (broken.length) console.log(`  broken:`, JSON.stringify(broken, null, 2));

  await page.keyboard.press("Escape").catch(() => {});
  return broken.length === 0;
}

async function main() {
  const browser = await chromium.launch();
  let allPassed = true;
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const nichePassed = await checkModal(page, vp.label, "Choose your niche");
    const stylePassed = await checkModal(page, vp.label, "Change", { selectNicheFirst: true });
    allPassed = allPassed && nichePassed && stylePassed;
    await page.close();
  }
  await browser.close();
  console.log(allPassed ? "\nAll checks PASSED." : "\nSome checks FAILED.");
  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => {
  console.error("CHECK FAILED TO RUN:", e);
  process.exit(1);
});
