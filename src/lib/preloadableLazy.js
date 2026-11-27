// A React.lazy component that can be fetched BEFORE React needs it. Once preload() has finished, it renders straight
// away with no Suspense pause, so a hydrated page (main.jsx) attaches to its server HTML exactly as if the component
// had been in the main bundle. Without a preload it behaves like a normal lazy component.
import { createElement, lazy } from "react";

export function preloadableLazy(load) {
  let Loaded = null;
  let pending = null;
  const preload = () => (pending ??= load().then((m) => { Loaded = m.default; return m; }));
  const Lazy = lazy(preload);
  function PreloadableLazy(props) {
    return Loaded ? createElement(Loaded, props) : createElement(Lazy, props);
  }
  PreloadableLazy.preload = preload;
  return PreloadableLazy;
}
