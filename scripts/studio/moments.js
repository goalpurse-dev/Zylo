// Zyvo Studio: the moments of a real result for a short video (pure: studioKit.mjs and the tests use it).
// The same brand list as the server's reuse finder (supabase/functions/_shared/contentMachine/studio.js).
export const BRANDS = /\b(google|tiktok|instagram|youtube|facebook|whatsapp|snapchat|twitter|netflix|amazon|apple|iphone|android|samsung|microsoft|uber|tinder|starbucks|mcdonald'?s|coca[- ]?cola|pepsi|nike|adidas|disney|marvel|spotify|chatgpt|openai)\b/i;

/**
 * The moments of a real result. cuts: scene-change times; words: [{w, s, e}]; level(a, b): the sound's loudest dB in
 * [a, b]; lastSound(a, b): the last time in [a, b] with speech. Returns {open, ending, shots} (in/out in its seconds).
 */
export function pickMoments({ cuts, words, duration, level, lastSound }) {
  const bounds = [0, ...cuts.filter((c) => c > 0.3 && c < duration - 0.3), duration];
  const shots = bounds.slice(0, -1).map((a, i) => {
    const b = bounds[i + 1], ws = words.filter((w) => w.s >= a - 0.15 && w.s < b - 0.1);
    const text = ws.map((w) => w.w).join(" ");
    return { a, b, text, words: ws.length, brand: BRANDS.test(text), loud: level(a, b) };
  });
  const clean = shots.filter((s) => !s.brand && s.words >= 2 && s.b - s.a >= 1.4);
  if (clean.length < 2) throw new Error("fewer than 2 clean shots with words: not enough to make a video");
  const span = (s, max) => {
    const out = Math.min(s.b - 0.03, lastSound(s.a, s.b) + 0.4);
    return { in: +(s.a + 0.02).toFixed(2), out: +Math.min(out, s.a + max).toFixed(2), text: s.text };
  };
  const endShot = clean.at(-1);
  // frame 0: an earlier clean shot; a question or an exclamation and loud speech score higher; 2–4.5 s preferred
  const score = (s) => (/[?!]/.test(s.text) ? 3 : 0) + (s.loud + 40) / 10 + (s.b - s.a >= 2 && s.b - s.a <= 5 ? 1 : 0) - (s === clean[0] ? 0.5 : 0);
  const openShot = clean.filter((s) => s !== endShot).sort((x, y) => score(y) - score(x))[0];
  return { open: span(openShot, 4.5), ending: span(endShot, 4.5), shots: shots.map(({ a, b, text, brand }) => ({ a: +a.toFixed(2), b: +b.toFixed(2), text, brand })) };
}
