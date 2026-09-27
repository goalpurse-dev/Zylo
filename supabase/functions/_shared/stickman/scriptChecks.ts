// deno-lint-ignore-file no-explicit-any
// stickman/scriptChecks.ts — Phase 1 "Stickman Script Mode" pass.
//
// Deterministic (zero-AI-cost) checks specific to the Stickman narration
// voice — plain code, exactly like advance-long-form-script's own existing
// validateScriptDocument/findMetaLanguage/findRepeatedNGrams etc. These are
// ADDITIVE: nothing here replaces or is called by the legacy/documentary
// path. The caller decides HARD vs WARN by which array it reads (errors vs
// warnings) and how it merges these with the base validateScriptDocument
// result — see advance-long-form-script/index.ts's validateWithStickmanExtras.

export type CheckIssue = { code: string; message: string; segmentIds?: string[] };
export type CheckResult = { errors: CheckIssue[]; warnings: CheckIssue[] };

/* ============================ Story Plan — title format ============================ */

// HARD, deterministic, and self-correcting rather than a blocking failure:
// a proven-title-format/specificity/no-spoiler judgment call belongs in the
// prompt (STICKMAN_STORY_INSTRUCTIONS), not a regex — but length and colons
// are cheap, 100% reliable, mechanical facts a regex CAN decide correctly
// every time, so those two are enforced unconditionally rather than left to
// hope the model complies. Applied identically whether the title came from
// the model or was kept verbatim from a selected idea (Phase 1, Section 1's
// "keep the selected idea's title" — keeping it doesn't mean skipping the
// same two mechanical guarantees every other title gets).
export function enforceStickmanTitleRules(rawTitle: string): { title: string; adjusted: boolean } {
  const original = (rawTitle ?? "").trim();
  let title = original.replace(/:/g, " —").replace(/\s{2,}/g, " ").trim();
  if (title.length > 60) {
    const truncated = title.slice(0, 60);
    const lastSpace = truncated.lastIndexOf(" ");
    title = (lastSpace > 30 ? truncated.slice(0, lastSpace) : truncated).trim();
    title = title.replace(/[,;:.\-–—]+$/, "").trim();
  }
  return { title, adjusted: title !== original };
}

/* ============================ Script draft — narration craft ============================ */

function wordsOf(text: string): string[] {
  return (text ?? "").trim().split(/\s+/).filter(Boolean);
}

function concatNarration(segments: any[]): string {
  return segments.map((s: any) => s.text ?? "").join(" ");
}

// Lecture/documentary filler that reads as a human host narrating a school
// video rather than a tight viral explainer — distinct from (and additive
// to) advance-long-form-script's own SLOP_PHRASES/META_LANGUAGE_PATTERNS,
// which stay completely unbranched and keep applying to every recipe.
export const BANNED_LECTURE_PHRASES = [
  "in this video",
  "in today's video",
  "over the next sections",
  "we'll do three",
  "let's dive",
  "let's talk about",
  "moving on",
  "next up",
  "firstly",
  "in conclusion",
  "to sum up",
  "(1)",
  "(2)",
];

export function findBannedLecturePhrases(segments: any[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const s of segments) {
    const lower = (s.text ?? "").toLowerCase();
    for (const phrase of BANNED_LECTURE_PHRASES) {
      if (lower.includes(phrase)) {
        issues.push({ code: "banned_lecture_phrase", message: `Segment contains the banned lecture/filler phrase "${phrase}".`, segmentIds: [s.id] });
      }
    }
  }
  return issues;
}

// Numbered-list enumerations read as a lecture outline, not spoken
// narration — checked as a pattern (not just the literal strings above,
// which only catch "(1)"/"(2)") so "(3)", "1)", "number one" style lists
// are all caught the same way.
const NUMBERED_LIST_PATTERN = /\(\d+\)|\b\d+\)\s|\bfirstly\b|\bsecondly\b|\bthirdly\b/i;
export function findNumberedListEnumerations(segments: any[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const s of segments) {
    if (NUMBERED_LIST_PATTERN.test(s.text ?? "")) {
      issues.push({ code: "numbered_list_enumeration", message: "Segment reads as a numbered-list enumeration, not spoken narration.", segmentIds: [s.id] });
    }
  }
  return issues;
}

// HARD — the first 60 words must address the viewer directly, and the very
// first sentence must not itself be a greeting or a question ABOUT the
// video (as opposed to a genuine cold-open question about the SUBJECT,
// which is fine and expected).
const GREETING_OR_META_QUESTION = /^(hey|hi|hello|welcome|(so,? )?have you ever|are you ready|did you know)\b/i;
const VIDEO_SELF_REFERENCE = /\b(this video|today('|’)s video|we('| a)?re going to (talk|explore|look)|i('| a)?m going to (talk|explore|show))\b/i;
export function checkColdOpen(segments: any[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const first = segments[0];
  if (!first) return issues;
  const full = concatNarration(segments);
  const first60 = wordsOf(full).slice(0, 60).join(" ");
  if (!/\byou\b|\byour\b/i.test(first60)) {
    issues.push({ code: "cold_open_no_second_person", message: `The first 60 words never address the viewer directly ("you"/"your"): "${first60}"`, segmentIds: [first.id] });
  }
  const firstSentenceMatch = (first.text ?? "").match(/^[^.!?]*[.!?]/);
  const firstSentence = (firstSentenceMatch ? firstSentenceMatch[0] : first.text ?? "").trim();
  if (GREETING_OR_META_QUESTION.test(firstSentence) || VIDEO_SELF_REFERENCE.test(firstSentence)) {
    issues.push({ code: "cold_open_is_greeting_or_meta", message: `The first sentence is a greeting or a question about the video itself, not a cold open: "${firstSentence}"`, segmentIds: [first.id] });
  }
  return issues;
}

// WARN — fewer than roughly 1 "?" per 145 words of body (the spec's own
// "roughly every 30-60 seconds of runtime" translated to a word-count
// proxy via the shared WORDS_PER_MINUTE rate, so this scales with runtime
// rather than being a flat per-script minimum).
export function checkQuestionCadence(segments: any[], wordsPerMinute: number): CheckIssue[] {
  const full = concatNarration(segments);
  const wordCount = wordsOf(full).length;
  if (!wordCount) return [];
  const questionCount = (full.match(/\?/g) ?? []).length;
  const expectedMin = wordCount / wordsPerMinute;
  if (questionCount < expectedMin) {
    return [{ code: "low_question_cadence", message: `Only ${questionCount} rhetorical question(s) across ${wordCount} words — fewer than roughly 1 per ${wordsPerMinute} words.` }];
  }
  return [];
}

export const VAGUE_QUALIFIERS = ["a long time ago", "many scientists", "some experts", "very big", "really strong", "a lot of"];
const NUMBER_WORD = /^(\d+([.,]\d+)?%?|one|two|three|four|five|six|seven|eight|nine|ten|dozen|hundred|thousand|million|billion)$/i;

// WARN — evidence-role sections specifically (identified by
// ScriptEvidencePack chapter.role === "evidence", copied through from the
// Story Plan's own section roles) should read as fact-dense: fewer than
// roughly 3 numerals/number-words per 100 words is a signal the section
// leans on vague description instead of the "precise number" evidence-unit
// rule. Vague-qualifier hits are checked everywhere, not just evidence
// sections — a vague qualifier is never appropriate regardless of section.
export function checkSpecificity(segments: any[], evidenceChapterIds: Set<string>): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const evidenceSegments = segments.filter((s: any) => evidenceChapterIds.has(s.chapterId));
  const evidenceWordCount = wordsOf(concatNarration(evidenceSegments)).length;
  const numberHits = evidenceSegments.reduce((sum: number, s: any) => sum + wordsOf(s.text ?? "").filter((w) => NUMBER_WORD.test(w)).length, 0);
  if (evidenceWordCount > 0 && numberHits < (evidenceWordCount / 100) * 3) {
    issues.push({ code: "low_specificity", message: `Evidence sections use only ${numberHits} numeral/number-word(s) across ${evidenceWordCount} words — fewer than roughly 3 per 100 words.` });
  }
  for (const s of segments) {
    const lower = (s.text ?? "").toLowerCase();
    for (const phrase of VAGUE_QUALIFIERS) {
      if (lower.includes(phrase)) issues.push({ code: "vague_qualifier", message: `Segment uses the vague qualifier "${phrase}" instead of a specific detail.`, segmentIds: [s.id] });
    }
  }
  return issues;
}

// WARN — fewer than roughly 1 "you"/"your" per 100 words across the whole
// body. Deliberately whole-body, not just the opening/closer, per the
// spec's "throughout the body, not only at the end" instruction.
export function checkBridging(segments: any[]): CheckIssue[] {
  const full = concatNarration(segments);
  const wordCount = wordsOf(full).length;
  if (!wordCount) return [];
  const hits = (full.match(/\byou\b|\byour\b/gi) ?? []).length;
  if (hits < wordCount / 100) {
    return [{ code: "low_bridging", message: `Only ${hits} "you"/"your" reference(s) across ${wordCount} words — fewer than roughly 1 per 100 words.` }];
  }
  return [];
}

// WARN — Phase 1f: the callback is no longer verified by matching a
// model-authored "verbatim quote" string against the narration (real
// incident: the model routinely paraphrased slightly — "a little
// dollar-sign sticker" vs "a floating dollar-sign sticker" — so a
// genuinely-present callback still failed this check for a trivial wording
// mismatch). Instead the draft reports WHICH segments hold the plant/payoff
// (by index) and a short callbackKey phrase; this just confirms that phrase
// really occurs in both segments (case-insensitive — a model's own
// capitalization drift shouldn't fail a real callback) and that the plant
// comes strictly before the payoff. This is intentionally a WARN, not a
// HARD block — a broken callback doesn't need "wait one revision pass then
// fall back," per the spec's own severity table, it just needs surfacing.
// Phase 1 close-out — a callback is a REFERENCE back, not a repeat. Requiring
// the exact phrase twice made the payoff restate the plant, which the critic
// (rightly) scored as a recap. Now: the plant must name the planted detail,
// and the payoff only has to share one of its key nouns ("that soot").
const CALLBACK_STOPWORDS = new Set(["that", "this", "your", "their", "with", "from", "into", "onto", "over", "under", "still", "just", "already", "about", "which", "where", "what", "when", "there", "then", "than", "were", "have", "been", "being", "some", "every", "each", "very", "only", "like", "across"]);

function stem(word: string): string {
  return word.replace(/(ies)$/, "y").replace(/(es|s)$/, "");
}

export function callbackKeyNouns(callbackKey: string): string[] {
  return (callbackKey ?? "")
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/'s$/, "").replace(/^['-]+|['-]+$/g, ""))
    .filter((w) => w.length >= 4 && !CALLBACK_STOPWORDS.has(w));
}

// The first key noun (or the whole key) found in `text`, else null.
export function findCallbackReference(text: string, callbackKey: string): string | null {
  const lower = (text ?? "").toLowerCase();
  if (callbackKey && lower.includes(callbackKey.toLowerCase())) return callbackKey;
  const textStems = new Set(lower.replace(/[^a-z\s'-]/g, " ").split(/\s+/).map((w) => stem(w.replace(/'s$/, ""))));
  return callbackKeyNouns(callbackKey).find((n) => textStems.has(stem(n))) ?? null;
}

export function checkCallback(segments: any[], plantSegmentIndex: number | null | undefined, payoffSegmentIndex: number | null | undefined, callbackKey: string | null | undefined): CheckIssue[] {
  if (plantSegmentIndex == null || payoffSegmentIndex == null || !callbackKey) {
    return [{ code: "callback_missing", message: "plantSegmentIndex, payoffSegmentIndex, and/or callbackKey is missing." }];
  }
  const issues: CheckIssue[] = [];
  const plantSeg = segments[plantSegmentIndex];
  const payoffSeg = segments[payoffSegmentIndex];
  if (!plantSeg) {
    issues.push({ code: "callback_plant_not_found", message: `plantSegmentIndex ${plantSegmentIndex} does not correspond to a real segment.` });
  } else if (!findCallbackReference(plantSeg.text, callbackKey)) {
    issues.push({ code: "callback_plant_not_found", message: `The planted detail "${callbackKey}" is not named in the plant segment's text.`, segmentIds: [plantSeg.id] });
  }
  if (!payoffSeg) {
    issues.push({ code: "callback_payoff_not_found", message: `payoffSegmentIndex ${payoffSegmentIndex} does not correspond to a real segment.` });
  } else if (!findCallbackReference(payoffSeg.text, callbackKey)) {
    issues.push({ code: "callback_payoff_not_found", message: `The payoff segment never refers back to the planted detail "${callbackKey}" (no shared key noun).`, segmentIds: [payoffSeg.id] });
  }
  if (plantSeg && payoffSeg && !(payoffSegmentIndex > plantSegmentIndex)) {
    issues.push({ code: "callback_order_invalid", message: "The payoff segment does not occur after the plant segment." });
  }
  return issues;
}

// Extracts the actual sentence containing callbackKey from a segment's
// text (case-insensitive match, original casing preserved in the return
// value) — this is the "exact sentences extracted by CODE" the spec asks
// for, replacing a model-self-reported quote. Falls back to the segment's
// full text if no single sentence boundary contains the key (e.g. the key
// spans a comma-joined clause rather than a full sentence).
export function extractSentenceContaining(text: string, key: string): string | null {
  if (!text || !key) return null;
  const lower = text.toLowerCase();
  const keyLower = key.toLowerCase();
  if (!lower.includes(keyLower)) return null;
  const sentences = text.split(/(?<=[.!?])\s+/);
  const hit = sentences.find((s) => s.toLowerCase().includes(keyLower));
  return (hit ?? text).trim();
}

// WARN — the title's core question should be stated once (per the draft
// prompt's CORE QUESTION rule); restating it verbatim-ish more than once
// reads as repetitive rather than a natural echo. Uses a loose word-overlap
// heuristic (>=60% of the title's own significant words present in one
// question sentence) rather than exact string match, since a natural
// restatement rarely uses the identical wording.
export function checkTitleQuestionRestated(segments: any[], title: string): CheckIssue[] {
  const titleWords = Array.from(new Set(wordsOf(title.toLowerCase().replace(/[?.!]/g, "")).filter((w) => w.length > 3)));
  if (titleWords.length < 2) return [];
  let hits = 0;
  for (const s of segments) {
    const text = (s.text ?? "").toLowerCase();
    if (!text.includes("?")) continue;
    const overlap = titleWords.filter((w) => text.includes(w)).length;
    if (overlap >= Math.ceil(titleWords.length * 0.6)) hits += 1;
  }
  if (hits > 1) return [{ code: "title_question_restated", message: `The title's core question appears to be restated in ${hits} different segments — it should be stated once.` }];
  return [];
}

// WARN — the closer's last ~60 words should read as short, punchy
// fragments (per the spec's "short fragments for rhythm"), not long
// flowing sentences. Average words-per-sentence over that tail is a cheap,
// reasonable proxy.
export function checkCloserRhythm(segments: any[]): CheckIssue[] {
  const full = concatNarration(segments);
  const words = wordsOf(full);
  if (!words.length) return [];
  const last60 = words.slice(-60).join(" ");
  const sentences = last60.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  if (!sentences.length) return [];
  const avgLen = sentences.reduce((sum, s) => sum + wordsOf(s).length, 0) / sentences.length;
  if (avgLen > 14) {
    return [{ code: "closer_not_punchy", message: `The closer's average sentence length is ${avgLen.toFixed(1)} words — expected short, punchy fragments (~14 words or fewer).` }];
  }
  return [];
}

/* ============================ Phase 1e — quality checks ============================ */

// TTS hygiene — auto-fix, applied to every segment's text (and title/
// plantQuote/payoffQuote) BEFORE storing or validating, same "sanitize
// before validating" principle as stripInternalOpenLoopMarkers in
// advance-long-form-script. Converts characters a voice model would either
// mispronounce or read as literal punctuation into plain spoken words/
// straight punctuation.
export function sanitizeTtsHygiene(text: string): string {
  if (!text) return text;
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/‑/g, "-")
    .replace(/­/g, "")
    .replace(/\s*=\s*/g, " equals ")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*->\s*/g, " leads to ")
    .replace(/\p{Extended_Pictographic}/gu, "");
}

// HARD, defense-in-depth — should essentially never fire (sanitizeTtsHygiene
// runs first, see stageFinalizing's call to it before this check ever
// runs), but a genuinely broken TTS-hostile character surviving into stored
// narration is a hard failure, not a style nit.
const TTS_HOSTILE_PATTERN = /[=&‘’“”–—‑­]|->/;
export function findTtsHygieneIssues(segments: any[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const s of segments) {
    if (TTS_HOSTILE_PATTERN.test(s.text ?? "")) {
      issues.push({ code: "tts_hostile_character", message: `Segment ${s.id} contains a character a voice model would mispronounce or misread ("=", "&", "->", a curly quote, or an odd hyphen).`, segmentIds: [s.id] });
    }
  }
  return issues;
}

// HARD — a parenthetical or bracketed source/citation tag a narrator would
// never say out loud: "(IUCN: no single global count; status Vulnerable)",
// "(FAOSTAT: 31,100,000,000 heads)", "(Source: ...)", "[1]",
// "(Brashares et al., 2004)". Real, pervasive incident spanning multiple
// prior runs: the model routinely appended these as if reading a citation
// off a slide, most visibly "(IUCN: no single global count; status
// Vulnerable)" verbatim in stored narration. stripSpokenCitations is an
// auto-fix safety net (applied before storing, same "sanitize before
// validating" principle as sanitizeTtsHygiene) — this is the defense-in-
// depth HARD check for anything that survives stripping (e.g. a citation
// shape the strip pattern didn't anticipate).
const SOURCE_TAG_PATTERN = /\((?:source|sources?|citation)\s*:[^)]*\)|\([A-Z][A-Za-z.&' ]{1,40}:\s[^)]*\)|\[\d+\]|\([A-Z][a-z]+(?:\s(?:et al\.?|and [A-Z][a-z]+))?,?\s(?:19|20)\d{2}\)/gi;
export function stripSpokenCitations(text: string): string {
  if (!text) return text;
  return text
    .replace(SOURCE_TAG_PATTERN, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();
}
export function findSpokenCitations(segments: any[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const s of segments) {
    const matches = (s.text ?? "").match(SOURCE_TAG_PATTERN);
    if (matches?.length) {
      issues.push({ code: "spoken_citation", message: `Segment ${s.id} contains a citation tag a narrator would never say aloud ("${matches[0]}").`, segmentIds: [s.id] });
    }
  }
  return issues;
}

// WARN — the same specific figure (a $ amount, a percentage, or any number
// with 2+ digits) stated in more than one segment, UNLESS the only two
// occurrences are exactly the callback's own plant+payoff pair (the whole
// point of a callback is to repeat ONE detail on purpose). Small/common
// numbers (single digits, years used as plain dates) are excluded from the
// pattern itself to avoid flagging ordinary narration. Phase 1f: takes the
// plant/payoff SEGMENT IDS directly (from the new index+callbackKey
// mechanism) instead of matching quote strings against segment text.
export const STATISTIC_PATTERN = /\$\d[\d,]*(?:\.\d+)?|\d{2,}(?:,\d{3})*(?:\.\d+)?%?|\d+%/g;

// Claim-verification safety net (Phase 1 FINAL). The draft self-declares its
// checkable claims, and only declared claims are ever verified — a real
// acceptance run (Ancient Humans) declared 8 claims, all tied to research-
// lite facts (auto-"supported", zero searches), while undeclared specifics
// ("Richard Wrangham argues...", Chauvet radiocarbon dating, segmented
// sleep in pre-industrial records) went entirely unchecked. This finds
// sentences carrying a checkable specific — a digit, a spelled-out
// quantity (narration spells numbers out for TTS), a year, or a named
// researcher/institution cue — that no declared claim already covers.
const CHECKABLE_NUMBER_WORDS = /\b(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|percent|dozen)\b/i;
const CHECKABLE_DIGITS = /\d/;
const CHECKABLE_SOURCE_CUE = /\b(?:archaeologists?|anthropologists?|historians?|researchers?|scientists?|psychologists?|biologists?|economists?|primatologists?|neuroscientists?|physicists?|astronomers?|professor|study|survey|report|University|Institute|Agency|NASA|IUCN|WHO|CDC|FAO)\b/;
const CHECKABLE_NAMED_PERSON = /\b[A-Z][a-z]+(?:-[A-Z][a-z]+)?\s[A-Z][a-z]+(?:-[A-Z][a-z]+)?\b/;

function normalizeForCompare(text: string): string {
  return (text ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

export function findUndeclaredCheckableSentences(
  segments: { id: string; text: string }[],
  declaredClaims: { sentence?: string; claim?: string }[],
): { segmentId: string; sentence: string }[] {
  const declared = declaredClaims.map((c) => normalizeForCompare(c.sentence ?? c.claim ?? "")).filter(Boolean);
  const found: { segmentId: string; sentence: string }[] = [];
  for (const s of segments) {
    const sentences = (s.text ?? "").split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean);
    for (const sentence of sentences) {
      const hasNumber = CHECKABLE_DIGITS.test(sentence) || CHECKABLE_NUMBER_WORDS.test(sentence);
      const hasSource = CHECKABLE_SOURCE_CUE.test(sentence) && CHECKABLE_NAMED_PERSON.test(sentence);
      if (!hasNumber && !hasSource) continue;
      // Count words on the raw sentence — normalizing first splits "That's"
      // into two tokens, which let a 7-word rhetorical line through.
      if (wordsOf(sentence).length < 8) continue;
      const norm = normalizeForCompare(sentence);
      const covered = declared.some((d) => d.includes(norm) || norm.includes(d));
      if (!covered) found.push({ segmentId: s.id, sentence });
    }
  }
  return found;
}
export function findRepeatedStatistics(segments: any[], plantSegmentId?: string | null, payoffSegmentId?: string | null): CheckIssue[] {
  const bySegment = new Map<string, Set<string>>();
  for (const s of segments) {
    const nums = new Set((s.text ?? "").match(STATISTIC_PATTERN) ?? []);
    if (nums.size) bySegment.set(s.id, nums);
  }
  const numberToSegments = new Map<string, string[]>();
  for (const [segId, nums] of bySegment) {
    for (const n of nums) {
      if (!numberToSegments.has(n)) numberToSegments.set(n, []);
      numberToSegments.get(n)!.push(segId);
    }
  }
  const issues: CheckIssue[] = [];
  for (const [num, segIds] of numberToSegments) {
    if (segIds.length < 2) continue;
    const isCleanCallbackPair = segIds.length === 2 && plantSegmentId && payoffSegmentId && segIds.includes(plantSegmentId) && segIds.includes(payoffSegmentId);
    if (!isCleanCallbackPair) {
      issues.push({ code: "repeated_statistic", message: `The figure "${num}" appears in ${segIds.length} segments outside a clean plant/payoff callback pair — state it once and refer back in words.`, segmentIds: segIds });
    }
  }
  return issues;
}

// HARD — a closer that recaps as a numbered/labeled list ("Five reasons.
// One caveat."), a colon/dash-labeled recap ("Supply: wild lions are
// patchy. Law: rules restrict trade."), a "checklist"/"take home"/"tidy"
// framing, or a run of 4+ consecutive short fragments restating earlier
// points — instead of landing on one resonant idea. Real incident this
// widens for: a script that avoided the literal words "reasons"/"caveat"
// still shipped "Here's a tidy checklist to take home. Supply: ... Law:
// ..." — a listicle in every way that matters, just dodging the original
// narrower pattern.
const LISTICLE_PATTERN = /\b(one|two|three|four|five|six|seven|eight|\d+)\s+(reasons?|ways?|factors?|things?|points?|takeaways?)\b/i;
const CAVEAT_LABEL_PATTERN = /\bone caveat\b/i;
const CHECKLIST_FRAMING_PATTERN = /\b(checklist|take[\s-]home|tidy (list|recap|summary))\b/i;
// A genuine listicle label is a short noun phrase ("Supply:", "Safety and
// logistics:") — capped at 2 words so it can never match an ordinary
// discourse-marker CLAUSE ("Pull the threads together:", which is a verb
// phrase, not a label). Real false positive this fixes: "In short: the
// mounted lion..." and "Pull the threads together: domestication..." both
// matched a looser earlier version of this pattern (any capitalized run up
// to 24 chars) despite being completely ordinary transitional sentences,
// not a repeated Supply:/Law:/Culture:-style label pattern. The exclusion
// list below catches the specific common discourse markers that still fit
// the tightened shape (short, capitalized, colon-terminated).
const LABELED_RECAP_LINE = /^([A-Z][a-z]+(?:\s(?:and|or)\s[a-z]+)?)\s*(?::|\s[-—])\s/;
const LABEL_EXCLUSIONS = new Set(["in short", "in fact", "in other words", "put simply", "for example", "for instance", "after all", "in the end", "on the other hand", "as a result", "put another way", "in conclusion", "to sum up", "to be clear", "that said", "even so"]);
export function findListicleCloser(segments: any[], chapters: { chapterId: string; role?: string }[]): CheckIssue[] {
  const closerChapterIds = new Set(chapters.filter((c) => c.role === "closer").map((c) => c.chapterId));
  const issues: CheckIssue[] = [];

  // Colon/dash-labeled recap lines anywhere in the last 20% of the FULL
  // script by word count — a labeled recap can span the closer plus a
  // trailing part of callback_payoff, not just the nominal "closer" chapter.
  const allWords = wordsOf(concatNarration(segments));
  const tailStartWordIndex = Math.floor(allWords.length * 0.8);
  let runningWordCount = 0;
  const labeledLines: { segId: string; sentence: string }[] = [];
  for (const s of segments) {
    const text = s.text ?? "";
    const segWordCount = wordsOf(text).length;
    if (runningWordCount + segWordCount >= tailStartWordIndex) {
      for (const sentence of text.split(/(?<=[.!?])\s+/).filter(Boolean)) {
        const trimmed = sentence.trim();
        const match = trimmed.match(LABELED_RECAP_LINE);
        if (match && !LABEL_EXCLUSIONS.has(match[1].toLowerCase())) labeledLines.push({ segId: s.id, sentence });
      }
    }
    runningWordCount += segWordCount;
  }
  if (labeledLines.length >= 3) {
    issues.push({
      code: "listicle_closer",
      message: `${labeledLines.length} colon/dash-labeled recap lines ("Word: ..." / "Word — ...") appear in the last 20% of the script — reads as a labeled list, not a landed idea.`,
      segmentIds: Array.from(new Set(labeledLines.map((l) => l.segId))),
    });
  }

  for (const s of segments) {
    if (!closerChapterIds.has(s.chapterId)) continue;
    const text = s.text ?? "";
    if (LISTICLE_PATTERN.test(text) || CAVEAT_LABEL_PATTERN.test(text) || CHECKLIST_FRAMING_PATTERN.test(text)) {
      issues.push({ code: "listicle_closer", message: `Closer segment ${s.id} reads like a listicle recap ("N reasons"/"one caveat"/"checklist"/"take home") instead of landing on one resonant idea.`, segmentIds: [s.id] });
      continue;
    }
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    let run = 0;
    for (const sentence of sentences) {
      const wc = wordsOf(sentence).length;
      if (wc > 0 && wc <= 4) {
        run += 1;
        if (run >= 4) {
          issues.push({ code: "listicle_closer", message: `Closer segment ${s.id} has 4+ consecutive short fragments — reads like a bulleted list, not a landed idea.`, segmentIds: [s.id] });
          break;
        }
      } else {
        run = 0;
      }
    }
  }
  return issues;
}

// HARD — the narrator describing the screen instead of just stating facts:
// icons, arrows, split screens, animations, stickers, graphics, charts,
// dotted maps, or "visually, ...". Real incident this fixes: a script that
// followed a "picturable moments" instruction literally wrote "Visualize a
// border checkpoint...", "Picture arrows from the five icons... pointing at
// the selfie", "the five-item list animating beside the chalkboard" — stage
// direction leaking into voiceover, never something a viewer would actually
// hear. This is a strictly different (and stricter) defect from the
// imagination-crutch WARN below: describing a screen element is never
// acceptable regardless of how it's introduced.
const SCREEN_GRAPHICS_PATTERN = /\b(icons?|arrows?|split screen|on[\s-]screen|animat\w+|stickers?|graphics?|chart shows|map dotted|visually,)\b/i;
export function findScreenGraphicsNarration(segments: any[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const s of segments) {
    const text = s.text ?? "";
    if (SCREEN_GRAPHICS_PATTERN.test(text)) {
      const match = text.match(SCREEN_GRAPHICS_PATTERN);
      issues.push({ code: "screen_graphics_narration", message: `Segment ${s.id} describes the screen/a graphic ("${match?.[0]}") instead of just stating the fact — visuals are a separate team's job.`, segmentIds: [s.id] });
    }
  }
  return issues;
}

// WARN, forced into revision — "picture", "visualize", "imagine", "think
// of" at the START of a sentence is an instruction to the viewer, not a
// concrete statement (see this file's own STICKMAN_DRAFT_INSTRUCTIONS
// comment on "picturable ≠ describing a picture"). Up to 2 uses total is
// tolerated (an occasional "Imagine you..." cold-open device is fine — the
// reference script itself doesn't use this device, but a hard 0-tolerance
// rule is likely to false-positive on legitimate rhetorical framing); 3+
// across a whole script is the crutch the spec calls out.
const IMAGINATION_CRUTCH_START = /^(picture|visualize|imagine|think of)\b/i;
export function findImaginationCrutches(segments: any[]): CheckIssue[] {
  const hits: { segId: string; sentence: string }[] = [];
  for (const s of segments) {
    const text = s.text ?? "";
    for (const sentence of text.split(/(?<=[.!?])\s+/).filter(Boolean)) {
      if (IMAGINATION_CRUTCH_START.test(sentence.trim())) hits.push({ segId: s.id, sentence: sentence.trim() });
    }
  }
  if (hits.length > 2) {
    return [{
      code: "imagination_crutch_overused",
      message: `${hits.length} sentences start with "picture"/"visualize"/"imagine"/"think of" (max 2 tolerated) — state the fact directly instead of instructing the viewer to imagine it.`,
      segmentIds: Array.from(new Set(hits.map((h) => h.segId))),
    }];
  }
  return [];
}

// WARN — forward-reference/lecture lines that talk about the video's own
// structure or promise something for later, instead of just saying the
// thing now. Distinct from BANNED_LECTURE_PHRASES (which are always-banned
// filler regardless of position) — these specifically defer content.
const FORWARD_REFERENCE_PHRASES = ["later we'll", "keep that in mind", "we'll check", "as we'll see", "here's a checklist", "take home"];
export function findForwardReferences(segments: any[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const s of segments) {
    const lower = (s.text ?? "").toLowerCase();
    for (const phrase of FORWARD_REFERENCE_PHRASES) {
      if (lower.includes(phrase)) issues.push({ code: "forward_reference", message: `Segment ${s.id} contains the forward-reference/lecture phrase "${phrase}" — say the thing now instead of promising it for later.`, segmentIds: [s.id] });
    }
  }
  return issues;
}

// WARN — bureaucratic/technical terms used without a plain-language
// explainer in the same sentence. Deliberately a fixed term list plus a
// cheap "was it explained nearby" heuristic rather than a semantic
// judgment — false negatives (missing a real jargon word) are acceptable;
// the goal is catching the clearest cases cheaply, not perfect coverage.
// Phase 1f widens what counts as "explained" after a real false positive:
// "an annotation sets a zero annual export quota for..." DOES explain
// annotation via what follows, but used none of the original cue phrases
// and no parenthetical. Now also counts as explained when the term is
// immediately followed (within a few words) by a defining verb ("sets",
// "means", "is", "refers to", "describes", "requires", "limits") — a cheap
// proxy for "the rest of this sentence is a plain-language paraphrase of
// the term," which is what the spec actually asks to detect.
export const JARGON_TERMS = ["annotation", "quota", "range states", "heads of livestock", "pathways", "framework", "commercial trade", "domestic markets", "cross-border trade", "regulatory", "stakeholder", "utilize", "leverage", "facilitate",
  // Phase 1 close-out — lab/method jargon: say the finding, not the method.
  "use-wear", "multiproxy", "pyromarker", "phytolith", "lipid residue", "assemblage", "stratigraph", "residue analysis", "isotopic"];
const PLAIN_EXPLAINER_CUES = ["in other words", "that means", "basically", "simply put", "put another way", "meaning", "think of it as"];
const DEFINING_VERB_NEARBY = /\b(sets?|means?|is|are|refers? to|describes?|requires?|limits?|bans?|allows?)\b/i;
// WARN — state uncertainty once. Honest limits are good, but an acceptance
// run stacked 4+ caution asides ("A caution here", "it's worth admitting",
// "Honestly, no.") and read as hedging, not confidence. Max 2 per script.
const HEDGING_PATTERNS = [
  /\ba caution here\b/i,
  /\bworth admitting\b/i,
  /\bhonestly,? no\b/i,
  /\bwe can'?t be (certain|sure)\b/i,
  /\bwe (still )?don'?t (really )?know\b/i,
  /\bthe honest (answer|limit|complication)\b/i,
  /\bto be fair\b/i,
  /\bthat'?s a (clue|parallel),? not (direct )?proof\b/i,
  /\bnot a certainty\b/i,
  /\bwhere the evidence (gets thinner|stops|runs out)\b/i,
];
export const MAX_HEDGING_SENTENCES = 2;
export function findHedgingOveruse(segments: any[]): CheckIssue[] {
  const hits: { id: string; sentence: string }[] = [];
  for (const s of segments) {
    for (const sentence of (s.text ?? "").split(/(?<=[.!?])\s+/)) {
      if (HEDGING_PATTERNS.some((re) => re.test(sentence))) hits.push({ id: s.id, sentence });
    }
  }
  if (hits.length <= MAX_HEDGING_SENTENCES) return [];
  const quoted = hits.map((h) => `"${h.sentence.slice(0, 60)}"`).join("; ");
  return [{
    code: "hedging_overuse",
    message: `${hits.length} hedging/caution sentences (max ${MAX_HEDGING_SENTENCES}) — state uncertainty once, briefly, then move on: ${quoted}`,
    segmentIds: [...new Set(hits.map((h) => h.id))],
  }];
}

export function findJargonDensity(segments: any[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const s of segments) {
    const sentences = (s.text ?? "").split(/(?<=[.!?])\s+/).filter(Boolean);
    for (const sentence of sentences) {
      const lower = sentence.toLowerCase();
      const term = JARGON_TERMS.find((t) => lower.includes(t));
      if (!term) continue;
      const termIndex = lower.indexOf(term);
      const afterTerm = sentence.slice(termIndex + term.length, termIndex + term.length + 60);
      const hasExplainer = PLAIN_EXPLAINER_CUES.some((cue) => lower.includes(cue)) || /\([^)]+\)/.test(sentence) || DEFINING_VERB_NEARBY.test(afterTerm);
      if (!hasExplainer) {
        issues.push({ code: "jargon_unexplained", message: `Segment ${s.id} uses the bureaucratic term "${term}" without explaining it in plain words in the same sentence.`, segmentIds: [s.id] });
      }
    }
  }
  return issues;
}

/* ============================ Phase 1g — beat-sheet shape + specificity checks ============================ */

// HARD — a "table of contents" preview in the opening: either the
// "N reasons/barriers/forces" count pattern, or 3+ abstract topic-category
// nouns strung together as a list ("ecology, law, culture, health and
// economics"). Real incident: a script with 90 words for "stakes" and 60
// for "core_question" filled that space with exactly this ("five concrete
// barriers... ecology, law, culture, health and economics") instead of
// going straight into evidence — this check catches it in the FIRST 15% of
// the script regardless of which nominal section it lands in, since a
// preview can bleed across the stakes/core_question boundary. The topic-
// noun list is a closed, deliberately narrow set — a real list of concrete
// things (e.g. "cattle, sheep, goats, pigs and chickens") never matches,
// since those aren't abstract category words.
const PREVIEW_COUNT_PATTERN = /\b(one|two|three|four|five|six|seven|eight|\d+)\s+(concrete\s+)?(reasons?|barriers?|forces?|factors?|angles?|layers?)\b/i;
const PREVIEW_TOPIC_NOUNS = ["ecology", "law", "culture", "money", "economics", "health", "safety", "biology", "psychology", "politics", "religion", "tradition", "logistics", "supply", "demand", "science", "history", "technology", "legality", "morality"];
export function findPreviewEnumeration(segments: any[]): CheckIssue[] {
  const allWords = wordsOf(concatNarration(segments));
  const cutoff = Math.ceil(allWords.length * 0.15);
  let running = 0;
  const issues: CheckIssue[] = [];
  for (const s of segments) {
    const text = s.text ?? "";
    const wc = wordsOf(text).length;
    if (running < cutoff) {
      const lower = text.toLowerCase();
      if (PREVIEW_COUNT_PATTERN.test(lower)) {
        issues.push({ code: "preview_enumeration", message: `Segment ${s.id} previews the video's own structure ("N reasons/barriers/forces") near the opening — go straight into the first piece of evidence instead.`, segmentIds: [s.id] });
      }
      const hits = PREVIEW_TOPIC_NOUNS.filter((n) => new RegExp(`\\b${n}\\b`, "i").test(lower));
      if (hits.length >= 3) {
        issues.push({ code: "preview_enumeration", message: `Segment ${s.id} lists ${hits.length} topic-category nouns (${hits.join(", ")}) near the opening — reads as a table-of-contents preview instead of going straight into the first point.`, segmentIds: [s.id] });
      }
    }
    running += wc;
  }
  return issues;
}

// HARD — the cold open must be a short, pure scene: more than 5 sentences
// means it has almost certainly drifted from "drop the viewer into a
// moment" into explaining/analyzing that moment (a real incident: a cold
// open that opened cleanly then added "That scrap suddenly rewrites how
// people see you: it can brand you as a supplier of illegal parts, a
// ritual specialist, or a contact for safari connections" — analysis, not
// scene).
export function findColdOpenTooLong(segments: any[], chapters: { chapterId: string; role?: string }[]): CheckIssue[] {
  const coldOpenChapterIds = new Set(chapters.filter((c) => c.role === "cold_open").map((c) => c.chapterId));
  const coldOpenSegments = segments.filter((s: any) => coldOpenChapterIds.has(s.chapterId));
  if (!coldOpenSegments.length) return [];
  const text = concatNarration(coldOpenSegments);
  // Real incident (Phase 1 FINAL, "Myth vs Reality" format draft): a
  // legitimate two-beat cold open (the myth's false scene, then a hard cut
  // to the real one) needed 6 short sentences and was still a pure scene
  // with zero analysis — the cap was tuned against single-scene cold opens
  // and didn't anticipate this genuinely different, still-punchy shape.
  // Raised from 5 to 6 on that evidence.
  const sentenceCount = text.split(/(?<=[.!?])\s+/).filter(Boolean).length;
  if (sentenceCount > 6) {
    return [{ code: "cold_open_too_long", message: `The cold open has ${sentenceCount} sentences (max 6) — it should be a short, pure scene with no analysis.`, segmentIds: coldOpenSegments.map((s: any) => s.id) }];
  }
  return [];
}

// HARD — stakes is ONE punchy line (budget <=15 words) and core_question is
// ONE question (budget <=25). The budgets are code-owned, but nothing
// enforced them on the written text: a real acceptance run (Ancient Humans)
// shipped a 3-sentence, ~50-word stakes section and a 2-sentence question
// with a preamble. Thresholds carry slack over the budgets so only a real
// overrun (a paragraph where a line belongs) trips it.
export function findStakesOrQuestionOverrun(segments: any[], chapters: { chapterId: string; role?: string }[]): CheckIssue[] {
  const limits: Record<string, { maxWords: number; label: string }> = {
    stakes: { maxWords: 25, label: "stakes (one punchy line, ~15 words)" },
    core_question: { maxWords: 35, label: "core question (one question, ~25 words)" },
  };
  const issues: CheckIssue[] = [];
  for (const [role, { maxWords, label }] of Object.entries(limits)) {
    const ids = new Set(chapters.filter((c) => c.role === role).map((c) => c.chapterId));
    const segs = segments.filter((s: any) => ids.has(s.chapterId));
    if (!segs.length) continue;
    const words = wordsOf(concatNarration(segs)).length;
    if (words > maxWords) {
      issues.push({ code: `${role}_overrun`, message: `The ${label} section is ${words} words — cut it to a single line; move any explanation into the evidence sections.`, segmentIds: segs.map((s: any) => s.id) });
    }
  }
  return issues;
}

// HARD — the callback payoff restating 2+ numbers already stated earlier
// in the script is a recap, not a payoff (the spec's own bar: "must ADD a
// new meaning or fact, never restate >=2 earlier points"). Reuses
// STATISTIC_PATTERN so "restating a point" is measured the same
// deterministic way findRepeatedStatistics already does.
export function findCallbackRecap(segments: any[], chapters: { chapterId: string; role?: string }[]): CheckIssue[] {
  const payoffChapterIds = new Set(chapters.filter((c) => c.role === "callback_payoff").map((c) => c.chapterId));
  const payoffSegments = segments.filter((s: any) => payoffChapterIds.has(s.chapterId));
  if (!payoffSegments.length) return [];
  const earlierSegments = segments.filter((s: any) => !payoffChapterIds.has(s.chapterId));
  const earlierNumbers = new Set<string>();
  for (const s of earlierSegments) for (const n of (s.text ?? "").match(STATISTIC_PATTERN) ?? []) earlierNumbers.add(n);
  const payoffNumbers = new Set<string>();
  for (const s of payoffSegments) for (const n of (s.text ?? "").match(STATISTIC_PATTERN) ?? []) payoffNumbers.add(n);
  const overlap = Array.from(payoffNumbers).filter((n) => earlierNumbers.has(n));
  if (overlap.length >= 2) {
    return [{ code: "callback_recap", message: `The callback payoff restates ${overlap.length} figures already stated earlier (${overlap.join(", ")}) instead of adding new meaning.`, segmentIds: payoffSegments.map((s: any) => s.id) }];
  }
  return [];
}

// WARN, forced into revision — each evidence section needs at least 2
// specific numbers or named sources COMBINED (a real incident this fixes:
// the strongest-scoring angle got one vague sentence about an "energy
// pyramid" with zero actual numbers, while weaker angles got real figures).
// Named-source detection is a cheap proxy — multi-word Capitalized phrases
// ("Mary Douglas", "IUCN Red List") or short ALL-CAPS acronyms (IUCN, FAO,
// CITES, FAOSTAT) — not a real NER model, so it will miss some real
// citations and occasionally catch a capitalized common phrase; the goal is
// catching sections with clearly nothing specific, not perfect precision.
function countNamedSourceMentions(text: string): number {
  const multiWordProper = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3}\b/g) ?? [];
  const acronyms = text.match(/\b[A-Z]{2,6}\b/g) ?? [];
  return new Set([...multiWordProper, ...acronyms]).size;
}
export function findWeakEvidenceSpecificity(segments: any[], chapters: { chapterId: string; role?: string }[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  for (const c of chapters.filter((c) => c.role === "evidence")) {
    const segs = segments.filter((s: any) => s.chapterId === c.chapterId);
    if (!segs.length) continue;
    const text = concatNarration(segs);
    const numberHits = (text.match(STATISTIC_PATTERN) ?? []).length;
    const namedHits = countNamedSourceMentions(text);
    if (numberHits + namedHits < 2) {
      issues.push({ code: "weak_evidence_specificity", message: `Evidence section "${c.chapterId}" has only ${numberHits} number(s) and ${namedHits} named-source mention(s) — needs at least 2 specific numbers or named sources combined.`, segmentIds: segs.map((s: any) => s.id) });
    }
  }
  return issues;
}

// WARN, forced into revision — a handful of generic simile TEMPLATES are
// tolerated once (a natural reach for a comparison), but 2+ uses reads as a
// crutch. Real incident: a single script used BOTH "Think of it like
// trying to ship a controlled item abroad..." AND "Think of it like
// choosing to rent a house instead of selling it..." — two separate
// inserted-feeling metaphors rather than organic writing.
const GENERIC_SIMILE_PATTERNS = [/\blike renting\b/i, /\bcomparable to\b/i, /\bthe way you feel when\b/i, /\bthink of it like\b/i, /\bsimilar to\b/i, /\bjust like\b/i];
export function findGenericSimileOveruse(segments: any[]): CheckIssue[] {
  const hitSegIds: string[] = [];
  let count = 0;
  for (const s of segments) {
    for (const p of GENERIC_SIMILE_PATTERNS) {
      if (p.test(s.text ?? "")) {
        count += 1;
        hitSegIds.push(s.id);
      }
    }
  }
  if (count > 1) {
    return [{ code: "generic_simile_overused", message: `${count} generic simile templates ("like renting", "comparable to", "the way you feel when", etc) found — max 1 per script tolerated.`, segmentIds: Array.from(new Set(hitSegIds)) }];
  }
  return [];
}

// HARD — a true floor beneath checkQuestionCadence's own WARN threshold:
// fewer than 1 rhetorical question per 300 words is not just "a bit sparse"
// (the WARN case), it's a script that has essentially stopped inviting the
// viewer to keep wondering. Real incident: ~1 question across 1135 words
// (a ratio of 1/1135, nowhere near even the lenient 1/300 floor).
export function checkQuestionCadenceHardFloor(segments: any[]): CheckIssue[] {
  const full = concatNarration(segments);
  const wordCount = wordsOf(full).length;
  if (!wordCount) return [];
  const questionCount = (full.match(/\?/g) ?? []).length;
  if (questionCount < wordCount / 300) {
    return [{ code: "question_cadence_critical", message: `Only ${questionCount} rhetorical question(s) across ${wordCount} words — fewer than 1 per 300 words, a hard floor for viewer engagement.` }];
  }
  return [];
}

/* ============================ Section-shape (Story Plan) ============================ */

export const STICKMAN_SECTION_ROLES = ["cold_open", "stakes", "core_question", "evidence", "twist", "callback_payoff", "closer"] as const;

// Deterministic check for the required section ORDER/COUNT shape — a plain
// json_schema enum on `role` can constrain which values are legal, but not
// "these must appear in exactly this order, with 3-6 evidence sections and
// an optional single twist in this one position." Mirrors the existing
// callWithRepair "your previous attempt was invalid, fix this exactly"
// pattern one level up (Story Plan) rather than inventing a new mechanism.
export function validateStickmanSectionShape(sections: { role: string }[]): CheckIssue[] {
  const roles = sections.map((s) => s.role);
  const issues: CheckIssue[] = [];
  let i = 0;
  const expect = (role: string, label: string) => {
    if (roles[i] !== role) issues.push({ code: "section_shape_invalid", message: `Expected section ${i + 1} to be "${role}" (${label}), got "${roles[i] ?? "<missing>"}".` });
    i += 1;
  };
  expect("cold_open", "cold open");
  expect("stakes", "stakes");
  expect("core_question", "core question");
  let evidenceCount = 0;
  while (roles[i] === "evidence") {
    evidenceCount += 1;
    i += 1;
  }
  if (evidenceCount < 3 || evidenceCount > 6) {
    issues.push({ code: "section_shape_invalid", message: `Expected 3-6 consecutive "evidence" sections after core_question, found ${evidenceCount}.` });
  }
  if (roles[i] === "twist") i += 1; // optional
  expect("callback_payoff", "callback payoff");
  expect("closer", "closer");
  if (i !== roles.length) {
    issues.push({ code: "section_shape_invalid", message: `Found ${roles.length - i} extra section(s) after the expected closer.` });
  }
  return issues;
}

// Deterministic check for the callback plan's own timing invariant — the
// prompt (STICKMAN_STORY_INSTRUCTIONS) already asks for "plantSectionId
// within the first 25% of total estimated runtime," but a real incident (25-
// niche sweep, Phase 1 FINAL) showed the model occasionally ignores this and
// plants the callback detail 45-70% of the way through instead, which then
// makes the "payoff" land as a mid-video recap rather than a genuine bookend.
// Folded into the SAME one-bounded-repair pass validateStickmanSectionShape
// already triggers, rather than a second, separate repair call.
export function validateStickmanCallbackTiming(callbackPlan: { plantSectionId?: string; payoffSectionId?: string }, chapters: { id: string; role: string; estimatedMinutes?: number }[]): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const plantIdx = chapters.findIndex((c) => c.id === callbackPlan?.plantSectionId);
  if (plantIdx === -1) {
    issues.push({ code: "callback_plant_missing", message: `callbackPlan.plantSectionId "${callbackPlan?.plantSectionId}" does not match any section id.` });
    return issues;
  }
  const totalMinutes = chapters.reduce((s, c) => s + (c.estimatedMinutes ?? 0), 0) || 1;
  const cumulativeThroughPlant = chapters.slice(0, plantIdx + 1).reduce((s, c) => s + (c.estimatedMinutes ?? 0), 0);
  const frac = cumulativeThroughPlant / totalMinutes;
  if (frac > 0.3) {
    issues.push({
      code: "callback_plant_too_late",
      message: `callbackPlan.plantSectionId ("${callbackPlan?.plantSectionId}") lands at ${Math.round(frac * 100)}% of total estimated runtime — must be within roughly the first 25%. Choose an earlier section id (cold_open, stakes, core_question, or the first evidence section) to plant the callback detail in, adjusting the detail itself if needed so it's something that section can actually contain.`,
    });
  }
  return issues;
}
