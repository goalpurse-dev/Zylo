// Only ever imported by src/entry-server.jsx (the build-time SEO HTML
// generator's SSR bundle) — never part of the real client bundle. Must be
// the FIRST import in entry-server.jsx: ES module evaluation runs each
// import's module (and everything it depends on) to completion before
// moving to the next import in the importing file, so this needs to finish
// setting up globals before App.jsx (and its whole import tree) evaluates.
//
// Why this exists: this app was built client-only, so plenty of components
// reference `document`/`window` synchronously outside of useEffect — most
// commonly `createPortal(..., document.body)` for modals/menus that need to
// stay mounted for CSS transitions (see e.g. CreateMenu.jsx's DesktopPanel).
// That's correct, working behavior in a real browser and none of it is worth
// auditing/rewriting file-by-file. A real (if inert) DOM via jsdom makes all
// of that code just work during SSR without touching a single one of those
// files — portaled content lands in this jsdom's detached document.body,
// which is never read, so it simply doesn't appear in the captured HTML
// (correct: modals/menus are interactive UI, not page content search
// engines need, and they still work normally for real users after the
// client bundle hydrates/takes over).
import { JSDOM } from "jsdom";

if (typeof globalThis.document === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "https://www.tryzyvo.com/",
  });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  // Node 21+ ships its own built-in `navigator` as a read-only getter (for
  // Node's native fetch), so a plain assignment throws — override the
  // property descriptor instead to replace it with jsdom's.
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.localStorage = dom.window.localStorage;
  globalThis.sessionStorage = dom.window.sessionStorage;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Node = dom.window.Node;
  globalThis.getComputedStyle = dom.window.getComputedStyle;

  // jsdom doesn't implement these — stub them inert rather than throwing,
  // since nothing rendered for SEO purposes depends on real viewport/layout
  // observation ever firing.
  globalThis.window.matchMedia = globalThis.window.matchMedia || ((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  }));
  globalThis.ResizeObserver = globalThis.ResizeObserver || class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.IntersectionObserver = globalThis.IntersectionObserver || class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
