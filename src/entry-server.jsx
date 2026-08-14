import "./ssrDomShim.js"; // must be the first import — see file for why
import { renderToPipeableStream } from "react-dom/server";
import { Writable } from "node:stream";
import App from "./App.jsx";

// Renders the real app tree for one route, exactly as a browser would, minus
// the browser — no Chromium, no headless rendering. onAllReady (not
// onShellReady) is deliberate: it waits for every lazy()-loaded route
// component and Suspense boundary to fully resolve before we capture any
// HTML, so the output is the real page content, not a loading fallback.
export function renderApp(pathname) {
  return new Promise((resolve, reject) => {
    let html = "";
    let settled = false;

    const writable = new Writable({
      write(chunk, _enc, callback) {
        html += chunk;
        callback();
      },
    });
    writable.on("finish", () => {
      if (!settled) {
        settled = true;
        resolve(html);
      }
    });

    const { pipe, abort } = renderToPipeableStream(<App ssrPath={pathname} />, {
      onAllReady() {
        pipe(writable);
      },
      onShellError(err) {
        if (!settled) {
          settled = true;
          reject(err);
        }
      },
      onError(err) {
        // onError can fire for errors after the shell too; only reject here
        // if we haven't already resolved via a completed write.
        if (!settled) {
          settled = true;
          reject(err);
        }
      },
    });

    // Safety net: a Suspense boundary that never resolves (e.g. a component
    // that suspends without ever un-suspending) would otherwise hang this
    // route forever with no error at all.
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try { abort(new Error("render timed out")); } catch { /* already settled */ }
        reject(new Error(`SSR render of ${pathname} timed out after 20s`));
      }
    }, 20_000);
    writable.on("finish", () => clearTimeout(timer));
  });
}
