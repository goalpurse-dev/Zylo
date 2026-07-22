export const CAPTION_GROUPING_VERSION = 2;

const SINGLE_WORD_STYLES = new Set(["cyan-impact", "motion-blur", "pink-neon"]);

export function captionModeForStyle(styleId) {
  if (SINGLE_WORD_STYLES.has(styleId)) return "single";
  if (styleId === "white-punch") return "word-pop";
  if (styleId === "typewriter-clean" || styleId === "typewriter-bold") return "typewriter";
  return "karaoke";
}

function cleanTimedWords(words) {
  return (Array.isArray(words) ? words : [])
    .map((word) => ({
      ...word,
      word: String(word?.word ?? word?.text ?? "").trim(),
      start: Number(word?.start ?? 0),
      end: Number(word?.end ?? word?.start ?? 0),
    }))
    .filter(word => word.word && Number.isFinite(word.start) && Number.isFinite(word.end))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Groups provider-timed words into compact subtitle phrases. The provider's
 * word boundaries remain untouched; pauses and punctuation only decide where
 * an on-screen phrase begins and ends.
 */
export function buildAdaptiveCaptionGroups(words, options = {}) {
  const timedWords = cleanTimedWords(words);
  if (!timedWords.length) return [];

  const mode = options.mode ?? captionModeForStyle(options.styleId);
  const requestedMax = Number(options.maxWords ?? 3);
  const maxWords = mode === "single" ? 1 : Math.max(1, Math.min(3, requestedMax || 3));
  const maxChars = Math.max(10, Math.min(36, Number(options.maxChars ?? 26) || 26));
  const pauseBoundarySec = Math.max(0.1, Number(options.pauseBoundarySec ?? 0.18));
  const maxPhraseSec = Math.max(0.55, Number(options.maxPhraseSec ?? 1.15));
  const longWordSec = Math.max(0.38, Number(options.longWordSec ?? 0.48));
  const groups = [];
  let current = [];

  const flush = () => {
    if (!current.length) return;
    groups.push({
      words: current,
      start: current[0].start,
      end: Math.max(current[current.length - 1].end, current[0].start + 0.04),
    });
    current = [];
  };

  timedWords.forEach((word, index) => {
    const previous = current[current.length - 1];
    const pause = previous ? Math.max(0, word.start - previous.end) : 0;
    const nextText = [...current, word].map(item => item.word).join(" ");
    const nextDuration = current.length ? word.end - current[0].start : word.end - word.start;
    if (
      current.length
      && (pause >= pauseBoundarySec
        || current.length >= maxWords
        || nextText.length > maxChars
        || nextDuration > maxPhraseSec)
    ) {
      flush();
    }

    current.push(word);
    const nextWord = timedWords[index + 1];
    const nextPause = nextWord ? Math.max(0, nextWord.start - word.end) : Infinity;
    const spokenDuration = Math.max(0, word.end - word.start);
    if (
      mode === "single"
      || /[.!?;:,]$/.test(word.word)
      || nextPause >= pauseBoundarySec
      || spokenDuration >= longWordSec
      || current.length >= maxWords
    ) {
      flush();
    }
  });
  flush();

  return groups.map((group, index) => {
    const nextStart = groups[index + 1]?.start;
    const silenceAfter = Number.isFinite(nextStart) ? Math.max(0, nextStart - group.end) : 0;
    return {
      ...group,
      // Bridge tiny natural gaps so captions do not flicker. A real pause
      // remains empty, matching what the listener actually hears.
      end: Math.max(
        group.start + 0.04,
        Number.isFinite(nextStart) && silenceAfter < pauseBoundarySec ? nextStart : group.end,
      ),
    };
  });
}

export function visibleCaptionWords(words, activeIndex, styleId) {
  const list = Array.isArray(words) ? words : [];
  if (!list.length) return { words: [], activeIndex: 0 };
  const current = Math.max(0, Math.min(list.length - 1, Number(activeIndex) || 0));
  const mode = captionModeForStyle(styleId);
  if (mode === "single") return { words: [list[current]], activeIndex: 0 };
  if (mode === "word-pop") {
    const start = Math.max(0, current - 1);
    return { words: list.slice(start, current + 1), activeIndex: current - start };
  }
  if (mode === "typewriter") return { words: list.slice(0, current + 1), activeIndex: current };
  return { words: list, activeIndex: current };
}
