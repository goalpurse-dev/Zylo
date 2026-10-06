// Long Form email #2 ("ideas") — send ONLY to profiles with email_updates = true.
// Usage: const { subject, html, text, headers } = LongFormIdeasEmail({ name, unsubscribeUrl, oneClickUrl });
//        await resend.emails.send({ from, to, subject, html, text, headers });

const APP = "https://tryzyvo.com";
const LONG_FORM_URL = `${APP}/long-form`;
const PRICING_URL = `${APP}/workspace/pricing`;
const UTM = "utm_source=email&utm_medium=campaign&utm_campaign=long_form_ideas";
const link = (url, content) => `${url}${url.includes("?") ? "&" : "?"}${UTM}&utm_content=${content}`;

// The YouTube ID of "How To Make Viral 2D History Stickman Videos With AI"
// (the part after watch?v=). The template refuses to render until this is set.
const TUTORIAL_ID = "cDVliwgwe_I";
const TUTORIAL = {
  title: "How To Make Viral 2D History Stickman Videos With AI",
  url: `https://www.youtube.com/watch?v=${TUTORIAL_ID}`,
  thumb: `https://i.ytimg.com/vi/${TUTORIAL_ID}/maxresdefault.jpg`,
};

// One ready-to-make idea per niche. Each links to the Long Form lobby.
const IDEAS = [
  { niche: "Ancient Humans & Prehistory", title: "How Did Early Humans Survive the Ice Age?", tag: "idea_ice_age" },
  { niche: "Daily Life in Past Eras", title: "What Was a Normal Day Like for a Medieval Peasant?", tag: "idea_peasant" },
  { niche: "Military & Logistics History", title: "What Did Roman Soldiers Eat on the March?", tag: "idea_roman_food" },
  { niche: "Dark & Brutal History", title: "The Worst Jobs in Ancient Rome", tag: "idea_worst_jobs" },
  { niche: "Ancient Medicine & Science", title: "How Did People Survive Surgery Before Anesthesia?", tag: "idea_surgery" },
];

// Brand (same as the launch email)
const BG = "#0A0B0D";
const CARD = "#131518";
const LINE = "#24272C";
const TEXT = "#FFFFFF";
const MUTED = "#A3A8B3";
const LIME = "#C5F35B";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ideaRow = (idea, i) => `
  <tr><td style="padding:${i === 0 ? "0" : "14px"} 0 14px 0;${i < IDEAS.length - 1 ? `border-bottom:1px solid ${LINE};` : ""}">
    <a href="${link(LONG_FORM_URL, idea.tag)}" target="_blank" style="text-decoration:none;display:block;">
      <div style="font:600 12px ${FONT};color:${LIME};">${esc(idea.niche)}</div>
      <div style="font:700 17px/1.35 ${FONT};color:${TEXT};margin-top:4px;">${esc(idea.title)}</div>
      <div style="font:600 13px ${FONT};color:${MUTED};margin-top:6px;text-decoration:underline;">Make this video</div>
    </a>
  </td></tr>`;

export function LongFormIdeasEmail({ name, unsubscribeUrl, oneClickUrl = unsubscribeUrl }) {
  if (!unsubscribeUrl) throw new Error("LongFormIdeasEmail needs an unsubscribeUrl");
  if (TUTORIAL_ID === "PASTE_YOUTUBE_ID") throw new Error("LongFormIdeasEmail: set TUTORIAL_ID first");
  const hi = name ? `Hey ${esc(name.split(" ")[0])},` : "Hey,";

  const subject = "5 YouTube videos you could make tonight";
  const preheader =
    "Pick one of these history ideas, give it to Long Form, and get a finished 8–15 minute video back.";

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:${BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BG};">${preheader}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

  <!-- Logo -->
  <tr><td style="padding:0 4px 20px 4px;font:800 22px ${FONT};color:${TEXT};">
    <span style="color:${LIME};">Z</span>yvo
  </td></tr>

  <!-- Intro -->
  <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:18px;padding:32px 28px;">
    <h1 style="margin:0 0 12px 0;font:800 30px/1.15 ${FONT};color:${TEXT};">
      Not sure what to make first?<br>Start with one of these.
    </h1>
    <p style="margin:0;font:400 16px/1.6 ${FONT};color:${MUTED};">
      ${hi} the hardest part of a YouTube video is picking the topic. So here are five that
      history channels keep winning with. Pick one, paste it into Long Form, and Zyvo
      writes, voices and draws the whole 8–15 minute video.
    </p>
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- Ideas -->
  <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:18px;padding:28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${IDEAS.map(ideaRow).join("")}
    </table>
    <p style="margin:18px 0 0 0;font:400 14px/1.5 ${FONT};color:${MUTED};">
      None of these for you? Long Form has 25 niches and can suggest 10 fresh ideas in any of them.
    </p>
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- Tutorial -->
  <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:18px;padding:28px;">
    <h2 style="margin:0 0 6px 0;font:800 20px ${FONT};color:${TEXT};">Watch the whole thing being made</h2>
    <p style="margin:0 0 18px 0;font:400 14px/1.5 ${FONT};color:${MUTED};">
      A full walkthrough, from picking the idea to the finished video on YouTube.
    </p>
    <a href="${TUTORIAL.url}" target="_blank" style="text-decoration:none;">
      <img src="${TUTORIAL.thumb}" width="504" alt="${esc(TUTORIAL.title)}"
        style="display:block;width:100%;max-width:504px;height:auto;border-radius:12px;border:1px solid ${LINE};" />
      <div style="font:700 15px/1.35 ${FONT};color:${TEXT};margin-top:12px;">${esc(TUTORIAL.title)}</div>
      <div style="font:600 13px ${FONT};color:${LIME};margin-top:4px;">▶ Watch on YouTube</div>
    </a>
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- CTA -->
  <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:18px;padding:28px;text-align:center;">
    <p style="margin:0 0 20px 0;font:400 14px/1.6 ${FONT};color:${MUTED};">
      A 10-minute video starts at 250 credits.<br>
      Starter gets 3 a month, Pro 6, Generative 12.
    </p>
    <table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:${LIME};">
      <a href="${link(LONG_FORM_URL, "cta_bottom")}" target="_blank"
        style="display:inline-block;padding:16px 28px;font:800 16px ${FONT};color:${BG};text-decoration:none;border-radius:12px;">
        Make my first video
      </a>
    </td></tr></table>
    <div style="margin-top:14px;font:600 13px ${FONT};">
      <a href="${link(PRICING_URL, "see_plans")}" target="_blank" style="color:${MUTED};text-decoration:underline;">See plans</a>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:24px 8px 0 8px;text-align:center;font:400 12px/1.6 ${FONT};color:#6B707C;">
    You're getting this because product updates are turned on for your Zyvo account.<br>
    <a href="${unsubscribeUrl}" style="color:#6B707C;text-decoration:underline;">Unsubscribe from updates</a>
    &nbsp;·&nbsp; <a href="${APP}" style="color:#6B707C;text-decoration:underline;">tryzyvo.com</a>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const text = `${hi}

The hardest part of a YouTube video is picking the topic. Here are five that history channels keep winning with. Pick one, paste it into Long Form, and Zyvo writes, voices and draws the whole 8–15 minute video.

${IDEAS.map((i) => `- ${i.title} (${i.niche})`).join("\n")}

None of these for you? Long Form has 25 niches and can suggest 10 fresh ideas in any of them.

Watch the whole thing being made: ${TUTORIAL.url}

A 10-minute video starts at 250 credits. Starter gets 3 a month, Pro 6, Generative 12.
See plans: ${link(PRICING_URL, "see_plans_text")}

Make your first video: ${link(LONG_FORM_URL, "text")}

Unsubscribe from updates: ${unsubscribeUrl}`;

  return {
    subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
