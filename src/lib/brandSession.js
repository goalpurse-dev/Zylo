// src/lib/brandSession.js
const STORAGE = window.sessionStorage; // change to localStorage if you want "per day"
const KEY = "curBrand";

export function getCurrentBrand() {
  try {
    const raw = STORAGE.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setCurrentBrand(brand) {
  // brand: { id, name? }
  const rec = { id: brand.id, name: brand.name || "", selectedAt: Date.now() };
  STORAGE.setItem(KEY, JSON.stringify(rec));
  // also broadcast to other tabs
  try { window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: JSON.stringify(rec) })); } catch {}
}

export function clearCurrentBrand() {
  STORAGE.removeItem(KEY);
}
