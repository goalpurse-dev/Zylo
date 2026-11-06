// Blocky Worlds: what can never be (part of) a character's name. Shared by the planner's name extraction (plan.mjs),
// the mock director (lib/director/mock.js) and the real director's cast clean-up (lib/director/spec.js).
// 2026-11-06 (turtle run 7b4c0d8b): "...with Grandpa. His wrist ticks" made "Grandpa His" (the title regex let a
// sentence-ending period through), "Totally bare." after "is silent." made a kid "Totally", "Everyone says" made a
// kid "Everyone".

/** pronouns, possessives, determiners, quantifiers and sentence adverbs: never a name word */
export const NAME_STOP = new Set([
  "i", "me", "my", "mine", "myself", "you", "your", "yours", "he", "him", "his", "himself", "she", "her", "hers", "herself",
  "it", "its", "itself", "we", "us", "our", "ours", "they", "them", "their", "theirs", "themselves", "who", "whose", "whom",
  "this", "that", "these", "those", "the", "a", "an", "some", "any", "no", "every", "each", "all", "both", "either", "neither",
  "everyone", "everybody", "everything", "someone", "somebody", "something", "anyone", "anybody", "anything", "nobody", "nothing", "noone",
  "here", "there", "then", "now", "when", "where", "why", "how", "what", "which", "and", "but", "or", "so", "yet", "if",
  "totally", "really", "just", "only", "still", "even", "very", "too", "also", "maybe", "never", "always", "once", "again",
  "yes", "not", "okay", "ok", "well", "oh", "wow", "hey",
]);

/** a single word that may be a name ("His" -> false, "Bell" -> true) */
export const nameWordOk = (w) => !!w && !NAME_STOP.has(String(w).toLowerCase().replace(/[^a-z]/g, ""));

/** titles that are written with a period ("Mr. Dobbs"): only after these may a period sit between title and name */
export const ABBREV_TITLES = /^(Mr|Mrs|Ms|Dr|St|Sgt|Capt|Prof|Rev)$/;

/** a title match ("Grandpa. His" from a regex with \.?) is a name only when the period belongs to an abbreviation */
export const titleMatchOk = (title, gap, name) => nameWordOk(name) && !(/\./.test(gap ?? "") && !ABBREV_TITLES.test(title));

/** a cast name with the stop words taken out ("Grandpa His" -> "Grandpa", "Everyone" -> "") */
export const cleanName = (name) => String(name ?? "").split(/\s+/).filter((w) => w && nameWordOk(w)).join(" ");
