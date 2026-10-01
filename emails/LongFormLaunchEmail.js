// Long Form launch email — send ONLY to profiles with email_updates = true
// (emails/sendLongFormLaunch.js does the sending; nothing here sends).
// Usage: const { subject, html, text, headers } = LongFormLaunchEmail({ name, unsubscribeUrl, oneClickUrl });
//        await resend.emails.send({ from, to, subject, html, text, headers });
// unsubscribeUrl / oneClickUrl: emails/unsubscribeLink.js (signed per user).

const APP = "https://tryzyvo.com";
// The Long Form lobby (src/pages/workspace/long-form/index.jsx). Public: a
// signed-out reader sees it too and is asked to sign in only to create.
const LONG_FORM_URL = `${APP}/long-form`;
const PRICING_URL = `${APP}/workspace/pricing`;
const UTM = "utm_source=email&utm_medium=launch&utm_campaign=long_form_launch";
const link = (url, content) => `${url}${url.includes("?") ? "&" : "?"}${UTM}&utm_content=${content}`;

// The "What's new" popup's 3 fanned hunting thumbnails, 1120×600 palette PNG (~96 KB):
// public/email/long-form-hero.png, built by scripts/buildEmailHero.mjs. Live once the frontend is deployed.
const HERO_IMG = `${APP}/email/long-form-hero.png`;

// Required by anti-spam law (CAN-SPAM, and good practice under GDPR/ePrivacy):
// the sender's business name and a valid postal address. The send script refuses
// to send to users while this still holds the placeholder.
export const FOOTER_ADDRESS = "Zyvo · [Company name, street address, city, country]";

const VIDEOS = [
  {
    title: "How Did Early Humans Hunt?",
    url: "https://www.youtube.com/watch?v=-4oDXegn9vw",
    thumb: "https://i.ytimg.com/vi/-4oDXegn9vw/maxresdefault.jpg",
  },
  {
    title: "Did Vikings Really Wear Horned Helmets?",
    url: "https://www.youtube.com/watch?v=2DFxSoSB5hY",
    thumb: "https://i.ytimg.com/vi/2DFxSoSB5hY/maxresdefault.jpg",
  },
];

// Brand
const BG = "#0A0B0D";
const CARD = "#131518";
const LINE = "#24272C";
const TEXT = "#FFFFFF";
const MUTED = "#A3A8B3";
const LIME = "#C5F35B";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const step = (n, title, body) => `
  <tr>
    <td valign="top" width="40" style="padding:0 0 18px 0;">
      <div style="width:28px;height:28px;line-height:28px;border-radius:14px;background:${LIME};color:${BG};font:700 14px ${FONT};text-align:center;">${n}</div>
    </td>
    <td valign="top" style="padding:2px 0 18px 0;">
      <div style="font:700 16px/1.3 ${FONT};color:${TEXT};">${title}</div>
      <div style="font:400 14px/1.5 ${FONT};color:${MUTED};margin-top:4px;">${body}</div>
    </td>
  </tr>`;

const videoCard = (v, i) => `
  <td width="50%" valign="top" style="padding:${i === 0 ? "0 6px 0 0" : "0 0 0 6px"};">
    <a href="${v.url}" target="_blank" style="text-decoration:none;">
      <img src="${v.thumb}" width="252" alt="${esc(v.title)}" style="display:block;width:100%;max-width:252px;height:auto;border-radius:10px;border:1px solid ${LINE};" />
      <div style="font:700 14px/1.35 ${FONT};color:${TEXT};margin-top:10px;">${esc(v.title)}</div>
      <div style="font:600 13px ${FONT};color:${LIME};margin-top:4px;">▶ Watch on YouTube</div>
    </a>
  </td>`;

export function LongFormLaunchEmail({ name, unsubscribeUrl, oneClickUrl = unsubscribeUrl }) {
  if (!unsubscribeUrl) throw new Error("LongFormLaunchEmail needs an unsubscribeUrl");
  const hi = name ? `Hey ${esc(name.split(" ")[0])},` : "Hey,";

  const subject = "Your next YouTube video, made for you 🎬";
  const preheader =
    "Long Form is live: one idea becomes a full 8–15 minute YouTube video with script, voice, scenes and thumbnails.";

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

  <!-- Hero card -->
  <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:18px;padding:32px 28px;">

    <div style="display:inline-block;background:${LIME};color:${BG};font:800 12px ${FONT};padding:5px 10px;border-radius:999px;">NEW</div>

    <h1 style="margin:16px 0 10px 0;font:800 32px/1.15 ${FONT};color:${TEXT};">
      Your next YouTube video,<br>made for you.
    </h1>

    <p style="margin:0 0 22px 0;font:400 16px/1.6 ${FONT};color:${MUTED};">
      ${hi} Long Form just dropped on Zyvo. Give it one idea and you get back a finished
      8–15 minute YouTube explainer: researched script, voiceover, around 150 hand-drawn-style
      scenes, three thumbnails and a ready-to-paste title and description.
    </p>

    <a href="${link(LONG_FORM_URL, "hero_image")}" target="_blank" style="text-decoration:none;">
      <img src="${HERO_IMG}" width="504" alt="Three thumbnails made by Zyvo Long Form"
        style="display:block;width:100%;max-width:504px;height:auto;border-radius:12px;" />
    </a>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;"><tr><td style="border-radius:12px;background:${LIME};">
      <a href="${link(LONG_FORM_URL, "cta_top")}" target="_blank"
        style="display:inline-block;padding:16px 28px;font:800 16px ${FONT};color:${BG};text-decoration:none;border-radius:12px;">
        Make my first video
      </a>
    </td></tr></table>
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- How it works -->
  <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:18px;padding:28px;">
    <h2 style="margin:0 0 20px 0;font:800 20px ${FONT};color:${TEXT};">How it works</h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${step(1, "Pick a niche and an idea", "25 niches, from ancient history to psychology. Write your own topic or let Zyvo suggest 10 ideas.")}
      ${step(2, "Zyvo writes, voices and draws it", "It researches and fact-checks the script, records the voice you chose and draws every scene in sync with it.")}
      ${step(3, "Edit and publish", "Swap any scene, add text and music, then download your video, pick a thumbnail and copy the YouTube text.")}
    </table>
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- Real examples -->
  <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:18px;padding:28px;">
    <h2 style="margin:0 0 6px 0;font:800 20px ${FONT};color:${TEXT};">Made with Zyvo, live on YouTube</h2>
    <p style="margin:0 0 18px 0;font:400 14px/1.5 ${FONT};color:${MUTED};">Both started as a single idea.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      ${VIDEOS.map(videoCard).join("")}
    </tr></table>
  </td></tr>

  <tr><td style="height:16px;"></td></tr>

  <!-- Plans + final CTA -->
  <tr><td style="background:${CARD};border:1px solid ${LINE};border-radius:18px;padding:28px;text-align:center;">
    <h2 style="margin:0 0 8px 0;font:800 20px ${FONT};color:${TEXT};">Available from Starter</h2>
    <p style="margin:0 0 20px 0;font:400 14px/1.6 ${FONT};color:${MUTED};">
      A 10-minute video starts at 250 credits.<br>
      Starter gets 3 a month, Pro 6, Generative 12.
    </p>
    <table role="presentation" align="center" cellpadding="0" cellspacing="0"><tr><td style="border-radius:12px;background:${LIME};">
      <a href="${link(LONG_FORM_URL, "cta_bottom")}" target="_blank"
        style="display:inline-block;padding:16px 28px;font:800 16px ${FONT};color:${BG};text-decoration:none;border-radius:12px;">
        Start a Long Form video
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
    &nbsp;·&nbsp; <a href="${APP}" style="color:#6B707C;text-decoration:underline;">tryzyvo.com</a><br>
    ${esc(FOOTER_ADDRESS)}
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const text = `${hi}

Long Form just dropped on Zyvo. Give it one idea and get back a finished 8–15 minute YouTube explainer: researched script, voiceover, ~150 scenes, three thumbnails and a ready-to-paste title and description.

How it works
1. Pick a niche and an idea (25 niches, or let Zyvo suggest 10 ideas).
2. Zyvo writes, voices and draws it, fact-checked and in sync with the voice.
3. Edit any scene, then download the video, a thumbnail and the YouTube text.

Made with Zyvo, live on YouTube:
- ${VIDEOS[0].title}: ${VIDEOS[0].url}
- ${VIDEOS[1].title}: ${VIDEOS[1].url}

Available from Starter. A 10-minute video starts at 250 credits. Starter gets 3 a month, Pro 6, Generative 12.
See plans: ${link(PRICING_URL, "see_plans_text")}

Make your first video: ${link(LONG_FORM_URL, "text")}

Unsubscribe from updates: ${unsubscribeUrl}
${FOOTER_ADDRESS}`;

  return {
    subject,
    html,
    text,
    // One-click unsubscribe (RFC 8058) — Gmail and Yahoo require this for bulk senders.
    // oneClickUrl accepts the POST directly; the footer link opens the tryzyvo.com page.
    headers: {
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
