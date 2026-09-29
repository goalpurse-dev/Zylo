// Phase 7 — billing rules: fixed quote, paid add-ons at click time (402 when
// short, never touching the reservation), refunds on failure. The DB side
// (exact balance, never below 0, full release, idle settle) is checked live
// by tests/sql/phase7_billing_rules.sql (rolls back).
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { chargeAddon, refundAddon, render1440Credits, voiceRerecordCredits, NOT_ENOUGH_CREDITS } from "../../supabase/functions/_shared/stickman/addons.ts";
import { renderBillingDecision } from "../../supabase/functions/_shared/longFormReservations.ts";
import { sceneCredits } from "../../supabase/functions/_shared/stickman/scenes.ts";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
// A fake admin with a balance that behaves like deduct_credits (guarded; negative = refund).
function fakeAdmin(balance: number) {
  const calls: { fn: string; args: any }[] = [];
  const admin: any = {
    get balance() { return balance; },
    calls,
    rpc: async (fn: string, args: any) => {
      calls.push({ fn, args });
      if (fn !== "deduct_credits") return { error: { message: "unknown rpc" } };
      if (balance < args.amount) return { error: { message: "INSUFFICIENT_CREDITS" } };
      balance -= args.amount;
      return { error: null };
    },
  };
  return admin;
}

Deno.test("prices: scene 1/4/5, 1440p 2/min min 10 and FREE on V4, voice re-record 4/min", () => {
  assertEquals([sceneCredits("V2"), sceneCredits("V3"), sceneCredits("V4")], [1, 4, 5]);
  assertEquals(render1440Credits("V2", 3 * 60_000), 10, "a short video still pays the 10-credit minimum");
  assertEquals(render1440Credits("V3", 8.6 * 60_000), 18, "per started minute");
  assertEquals(render1440Credits("V4", 15 * 60_000), 0, "1440p is a V4 perk");
  assertEquals(voiceRerecordCredits(8.6 * 60_000), 36);
  assertEquals(voiceRerecordCredits(20_000), 4);
  assertMatch(read("supabase/functions/long-form-thumbnails/index.ts"), /THUMB_CREDITS: Record<string, number> = \{ V2: 6, V3: 6, V4: 6 \}[\s\S]*THUMB_CREDITS\[tier\] \?\? 6;/);
});

Deno.test("add-on with exactly enough credits is charged; one credit short is a 402 with the plain message", async () => {
  const exact = fakeAdmin(5);
  assertEquals(await chargeAddon(exact, "u", 5, "scene_regenerate"), { ok: true, charged: 5 });
  assertEquals(exact.balance, 0);
  const short = fakeAdmin(4);
  assertEquals(await chargeAddon(short, "u", 5, "scene_regenerate"), { ok: false, status: 402, message: NOT_ENOUGH_CREDITS });
  assertEquals(short.balance, 4, "a refused charge never moves the balance");
  assertEquals(NOT_ENOUGH_CREDITS, "Not enough credits — Add credits");
  // Add-ons only ever call deduct_credits: never a reservation RPC.
  assert(short.calls.every((c: any) => c.fn === "deduct_credits"));
  const free = fakeAdmin(0);
  assertEquals(await chargeAddon(free, "u", 0, "render_1440p"), { ok: true, charged: 0 });
  assertEquals(free.calls.length, 0, "a free add-on (1440p on V4) makes no call");
});

Deno.test("failed 1440p is refunded exactly once (claim, then refund)", async () => {
  const a = fakeAdmin(12);
  await chargeAddon(a, "u", 10, "render_1440p");
  await refundAddon(a, "u", 10, "render_1440p_failed");
  assertEquals(a.balance, 12);
  const fin = read("supabase/functions/finish-long-form-render/index.ts");
  assertMatch(fin, /update\(\{ addon_credits: 0 \}\)\.eq\("id", job\.id\)\.gt\("addon_credits", 0\)/, "claim first so a second webhook can't refund twice");
  assertMatch(fin, /if \(owner && claimed\?\.length\) await refundAddon\(/);
  const start = read("supabase/functions/long-form-render/index.ts");
  assertMatch(start, /chargeAddon\(admin, user\.id, addonCredits, "render_1440p"/);
  assertMatch(start, /\.eq\("addon_credits", credits\)\.select\("id"\)/, "the boot watchdog also claims before refunding");
});

Deno.test("fixed quote: no per-scene charge on the first pass; settle the FULL quote only when the render is done", () => {
  assertEquals(renderBillingDecision("done", true, { committed_credits: 0 }), "settle");
  assertEquals(renderBillingDecision("failed", true, { committed_credits: 0 }), "keep");
  assertMatch(read("supabase/functions/_shared/longFormReservations.ts"), /settle_long_form_reservation_full/);
  assert(!/commitReservationSpend/.test(read("supabase/functions/render-long-form-scene/index.ts")));
  assertMatch(read("supabase/functions/delete-long-form-project/index.ts"), /releaseReservationIfActive\(admin, projectId, "project_deleted"/);
});

Deno.test("every paid button charges at click via chargeAddon and returns the 402", () => {
  assertMatch(read("supabase/functions/update-long-form-scene/index.ts"), /chargeAddon\(admin, user\.id, total, `scene_\$\{action\}`[\s\S]*?if \(!charge\.ok\) return err\(req, charge\.message, charge\.status/);
  assertMatch(read("supabase/functions/long-form-edit/index.ts"), /chargeAddon\(admin, user\.id, credits, "scene_split"[\s\S]*?if \(!charge\.ok\) return err\(req, charge\.message, charge\.status/);
  const voice = read("supabase/functions/generate-long-form-narration-audio/index.ts");
  assertMatch(voice, /requiresExtraCredits/);
  assertMatch(voice, /chargeAddon\(admin, user\.id, price, "voice_rerecord"/);
  // The page shows the "Add credits" link for any Not-enough-credits message.
  assertMatch(read("src/pages/workspace/long-form/shared.jsx"), /not-enough-credits/);
});
