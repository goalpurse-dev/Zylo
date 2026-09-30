// AI Fruit Story v2 for everyone: the global database switch (source checks —
// featureFlags.js imports the browser Supabase client, so the rule is checked
// by reading the code, like the other page tests).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the switch table is readable by everyone, writable only by SQL, and starts ON for fruit_v2", () => {
  const sql = read("supabase/migrations/20261001120000_global_feature_flags.sql");
  assert.match(sql, /GRANT SELECT ON public\.global_feature_flags TO anon, authenticated;/);
  assert.doesNotMatch(sql, /GRANT (INSERT|UPDATE|DELETE|ALL)[^;]*TO (anon|authenticated)/);
  assert.match(sql, /VALUES \('fruit_v2', true,/);
});

test("fruit_v2 = build override off → never; else global switch OR the user's own flag (guests follow the switch)", () => {
  const src = read("src/lib/featureFlags.js");
  assert.match(src, /fruit_v2: import\.meta\.env\.VITE_FRUIT_V2 === "false"/, "only an explicit false in the build turns it off");
  assert.match(src, /if \(BUILD_OFF\[name\] === true\) return false;\n  return globalFlags\?\.\[name\] === true \|\| userFlags\?\.\[name\] === true;/);
  assert.match(src, /Promise\.all\(\[fetchGlobalFlags\(\), fetchUserFlags\(userId\)\]\)/, "guests (no userId) still read the global switch");
  assert.match(src, /from\("global_feature_flags"\)\.select\("key, enabled"\)/);
});

test("the old tool stays as the fallback, and the pricing page follows the same switch", () => {
  const page = read("src/pages/workspace/AIFruitStory.jsx");
  assert.match(page, /return <AIFruitStoryV1 \/>;/);
  assert.match(read("src/components/pricing/PricingData.jsx"), /useFeatureFlag\("fruit_v2", account\.userId\)/);
});
