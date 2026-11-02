// Where a free preview stops: the end of the last word at about `seconds`, so it never cuts a word in half.
export function previewCutSec(words, seconds = 10) {
  const list = (Array.isArray(words) ? words : []).filter((w) => Number.isFinite(Number(w?.e)));
  const fit = list.filter((w) => Number(w.e) <= seconds + 1.2);
  const end = fit.length ? Number(fit[fit.length - 1].e) : seconds;
  return Number(Math.max(seconds * 0.8, Math.min(seconds + 1.2, end + 0.15)).toFixed(2));
}
