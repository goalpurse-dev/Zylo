import { lazy } from "react";

const DYNAMIC_IMPORT_FAILURE = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|loading chunk \S+ failed|chunkloaderror/i;
const PREFIX = "zyvo:route-import-reload:";

export function isDynamicImportFailure(error) {
  return DYNAMIC_IMPORT_FAILURE.test(String(error?.message ?? error ?? ""));
}

export function routeReloadKey(routeId, pathname = "") {
  return `${PREFIX}${routeId}:${pathname}`;
}

export function hasRouteReloadAttempted(storage, routeId, pathname = "") {
  try { return storage?.getItem(routeReloadKey(routeId, pathname)) === "1"; } catch { return false; }
}

export function clearRouteReloadAttempt(routeId, pathname = globalThis.location?.pathname ?? "") {
  try { globalThis.sessionStorage?.removeItem(routeReloadKey(routeId, pathname)); } catch { /* storage may be unavailable */ }
}

async function originIsReachable() {
  try {
    const response = await fetch(globalThis.location.origin, { method: "HEAD", cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export async function loadRouteModule(loader, routeId) {
  const pathname = globalThis.location?.pathname ?? "";
  try {
    const module = await loader();
    clearRouteReloadAttempt(routeId, pathname);
    return module;
  } catch (error) {
    if (!globalThis.window || !isDynamicImportFailure(error)) throw error;

    const key = routeReloadKey(routeId, pathname);
    const alreadyAttempted = hasRouteReloadAttempted(globalThis.sessionStorage, routeId, pathname);
    if (!alreadyAttempted && await originIsReachable()) {
      try { globalThis.sessionStorage?.setItem(key, "1"); } catch { /* boundary remains the fallback */ }
      globalThis.location.reload();
      // Keep Suspense mounted while navigation begins. If navigation is
      // prevented, React does not replace the page with an unhandled error.
      return new Promise(() => {});
    }
    throw error;
  }
}

export function lazyRoute(loader, routeId) {
  return lazy(() => loadRouteModule(loader, routeId));
}
