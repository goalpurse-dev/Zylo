// Zyvo's YouTube tutorials: ONE list, used by the home page's Tutorials row and by each tool page's
// "New here? Watch the tutorial" card (a tool page shows its tutorial as soon as it is listed here).
// To add one: a line with the tool key, the tool's name, the video's title and its YouTube link.
// The thumbnail is YouTube's own image of the video. Newest first.
//   tool keys: cutaway, long_form, ai_fruit_story, blocky_stories, behind_the_scenes
export const TUTORIALS = [
  { tool: "cutaway", toolName: "Cutaway Explainer", title: "How To Make Viral 3D Explainer Videos With AI", url: "https://www.youtube.com/watch?v=3KjCOOJhhzo" },
  { tool: "long_form", toolName: "Long Form", title: "How To Make Viral 2D History Stickman Videos With AI", url: "https://www.youtube.com/watch?v=cDVliwgwe_I" },
];

/** The 11-character video id of a YouTube link, or null. */
export function youtubeVideoId(url) {
  const m = String(url ?? "").match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}
/** YouTube's thumbnail of the video (hqdefault: 480x360, always there). */
export const tutorialThumb = (t) => { const id = youtubeVideoId(t.url); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null; };
/** Only the entries with a real YouTube link are ever shown (no broken cards). */
export const liveTutorials = (list = TUTORIALS) => list.filter((t) => youtubeVideoId(t.url));
/** A tool's newest tutorial, or null. */
export const tutorialFor = (tool, list = TUTORIALS) => liveTutorials(list).find((t) => t.tool === tool) ?? null;
