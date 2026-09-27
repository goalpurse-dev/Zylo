import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasRouteReloadAttempted, isDynamicImportFailure, loadRouteModule, routeReloadKey } from "../src/lib/lazyRouteRecovery.js";

function installBrowserGlobals({ reachable = true, attempted = false } = {}) {
  const originals = Object.fromEntries(["window", "location", "sessionStorage", "fetch"].map((key) => [key, globalThis[key]]));
  const values = new Map();
  const pathname = "/long-form/project/p/generate";
  const key = routeReloadKey("long-form-generate", pathname);
  if (attempted) values.set(key, "1");
  let reloads = 0;
  globalThis.window = {};
  globalThis.location = { origin: "http://localhost:5173", pathname, reload: () => { reloads += 1; } };
  globalThis.sessionStorage = {
    getItem: (name) => values.get(name) ?? null,
    setItem: (name, value) => values.set(name, value),
    removeItem: (name) => values.delete(name),
  };
  globalThis.fetch = async () => ({ ok: reachable });
  return {
    key,
    values,
    reloads: () => reloads,
    restore: () => {
      for (const [name, value] of Object.entries(originals)) {
        if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
      }
    },
  };
}

test("dynamic import transport errors are recognized", () => {
  assert.equal(isDynamicImportFailure(new TypeError("Failed to fetch dynamically imported module: http://localhost:5173/generate.jsx")), true);
  assert.equal(isDynamicImportFailure(new Error("ordinary component render failure")), false);
});

test("reload marker is scoped to the route and pathname", () => {
  assert.equal(routeReloadKey("long-form-generate", "/long-form/project/p/generate"), "zyvo:route-import-reload:long-form-generate:/long-form/project/p/generate");
});

test("an existing marker prevents a second automatic reload", () => {
  const values = new Map([[routeReloadKey("long-form-generate", "/long-form/project/p/generate"), "1"]]);
  const storage = { getItem: (key) => values.get(key) ?? null };
  assert.equal(hasRouteReloadAttempted(storage, "long-form-generate", "/long-form/project/p/generate"), true);
  assert.equal(hasRouteReloadAttempted(storage, "long-form-generate", "/long-form/project/other/generate"), false);
});

test("a reachable origin gets exactly one controlled reload attempt", async () => {
  const browser = installBrowserGlobals();
  try {
    void loadRouteModule(
      async () => { throw new TypeError("Failed to fetch dynamically imported module"); },
      "long-form-generate",
    );
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(browser.reloads(), 1);
    assert.equal(browser.values.get(browser.key), "1");
  } finally {
    browser.restore();
  }
});

test("an attempted or unreachable route import fails into the boundary without reloading", async () => {
  for (const options of [{ attempted: true }, { reachable: false }]) {
    const browser = installBrowserGlobals(options);
    try {
      await assert.rejects(
        loadRouteModule(
          async () => { throw new TypeError("Failed to fetch dynamically imported module"); },
          "long-form-generate",
        ),
      );
      assert.equal(browser.reloads(), 0);
    } finally {
      browser.restore();
    }
  }
});

test("Vite ignores generated client and SSR build output", () => {
  const config = readFileSync(new URL("../vite.config.js", import.meta.url), "utf8");
  assert.match(config, /"\*\*\/dist\/\*\*"/);
  assert.match(config, /"\*\*\/dist-ssr\/\*\*"/);
});
