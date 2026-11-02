import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Security fix (owner, 2026-10-27): no OpenAI key in browser code, and no script call without a login.
// The Script Builder now goes through supabase/functions/generate-script; the old open Vercel route
// api/generate-script.js and the dev-only browser path (VITE_OPENAI_API_KEY + /api/openai proxy) are gone.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const walk = (dir) => readdirSync(join(root, dir)).flatMap((n) => {
  const p = `${dir}/${n}`;
  return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});

test("no browser code reads an OpenAI key or calls OpenAI", () => {
  for (const f of walk("src").filter((p) => /\.(js|jsx|ts|tsx|mjs)$/.test(p))) {
    const s = read(f);
    assert.doesNotMatch(s, /VITE_OPENAI|import\.meta\.env\.[A-Z_]*OPENAI/, f);
    assert.doesNotMatch(s, /api\.openai\.com/, f);
  }
  assert.doesNotMatch(read("vite.config.js"), /api\.openai\.com|\/api\/openai/, "no dev proxy to OpenAI");
  assert.equal(existsSync(join(root, "api/generate-script.js")), false, "the open Vercel route is gone");
});

test("the Script Builder calls the server function; the server checks the login, takes and refunds the credits", () => {
  const client = read("src/lib/generateScript.js");
  assert.match(client, /supabase\.functions\.invoke\("generate-script", \{ body: \{ form, stylePreset \} \}\)/);
  assert.doesNotMatch(client, /deduct_credits/, "credits are taken on the server now");
  const fn = read("supabase/functions/generate-script/index.ts");
  assert.match(fn, /const \{ user, authError \} = await requireUser\(req\);\s*if \(authError \|\| !user\) return err\(req, "Unauthorized", 401\);/);
  assert.match(fn, /Deno\.env\.get\("OPENAI_API_KEY"\)/);
  assert.ok(fn.indexOf('admin.rpc("deduct_credits", { uid: user.id, amount: SCRIPT_CREDIT_COST })') < fn.indexOf("api.openai.com"), "paid before the call");
  assert.match(fn, /admin\.rpc\("deduct_credits", \{ uid: user\.id, amount: -SCRIPT_CREDIT_COST \}\)/, "refund on failure");
  assert.equal((fn.match(/await refund\(/g) ?? []).length, 2, "both failure paths refund");
  assert.match(fn, /return err\(req, "INSUFFICIENT_CREDITS", 402\)/, "the chat's own message for too few credits");
  assert.match(fn, /MAX_INPUT_CHARS = 20_000/);
  const cost = (s) => Number(s.match(/SCRIPT_CREDIT_COST = (\d+)/)[1]);
  assert.equal(cost(fn), cost(client), "same price on the button and on the server");
  const cfg = read("supabase/config.toml");
  assert.doesNotMatch(cfg, /\[functions\.generate-script\]\s*\r?\nverify_jwt = false/, "the gateway checks the login too");
});
