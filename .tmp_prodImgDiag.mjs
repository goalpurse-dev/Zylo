import { chromium } from "playwright";

const BASE = "http://localhost:4173";
const browser = await chromium.launch();

async function testAt(width, height, label) {
  const page = await browser.newPage({ viewport: { width, height } });
  const consoleErrors = [];
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await page.goto(`${BASE}/long-form/create`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByText("Decline").click({ force: true }).catch(() => {});
  await page.waitForTimeout(200);

  // Open niche modal IMMEDIATELY, minimal wait, mirroring a real user who
  // clicks right after the page looks ready (prod build finishes its JS
  // faster/differently than dev — this is the scenario dev-server testing
  // couldn't reproduce).
  await page.getByText("Choose your niche").click({ force: true });
  await page.waitForTimeout(150); // deliberately short

  const check = async (tag) => {
    const data = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      return Array.from(dialog.querySelectorAll("img")).map((img) => ({
        src: img.getAttribute("src"), complete: img.complete, naturalWidth: img.naturalWidth,
      }));
    });
    if (!data) { console.log(`[${label}] ${tag}: no dialog`); return; }
    const broken = data.filter((d) => d.complete && d.naturalWidth === 0);
    const pending = data.filter((d) => !d.complete);
    console.log(`[${label}] ${tag}: total=${data.length} broken=${broken.length} pending=${pending.length} ok=${data.length - broken.length - pending.length}`);
    if (broken.length) console.log(`   BROKEN srcs:`, broken.map((b) => b.src));
  };

  await check("immediately after open (150ms)");
  await page.waitForTimeout(2000);
  await check("2s later");

  // Real mouse-wheel scroll (not programmatic scrollTop) over the results grid.
  const box = await page.locator('[role="dialog"] .overflow-y-auto').first().boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, 200);
      await page.waitForTimeout(80);
    }
  }
  await check("after real wheel-scroll to bottom");

  // Close and reopen — a second mount of the same component.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.getByText("Choose your niche").click({ force: true });
  await page.waitForTimeout(1500);
  await check("after close+reopen");

  console.log(`[${label}] page errors:`, JSON.stringify(consoleErrors));
  await page.close();
}

await testAt(1440, 900, "desktop-1440");
await testAt(390, 844, "mobile-390");

await browser.close();
