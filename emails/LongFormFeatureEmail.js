// "Long Form feature" email: a short personal note from Niko. Light, text-first,
// no images, one button. Send ONLY to profiles with email_updates = true
// (emails/sendLongFormFeature.js picks the recipients and sends it).
// Usage: const { subject, html, text, headers } = LongFormFeatureEmail({ name, unsubscribeUrl, oneClickUrl, subject });

const APP = "https://www.tryzyvo.com";
const UTM = "utm_source=email&utm_medium=campaign&utm_campaign=long_form_feature";
const TRY_URL = `${APP}/long-form/create?${UTM}`;

// Three to choose from; the send script takes --subject 1|2|3.
export const SUBJECTS = [
  "One idea in, a full YouTube video out",
  "New in Zyvo: 10-minute videos from one idea",
  "A quick note about Zyvo's new Long Form",
];

// Ideas the reader could make tonight (plain text, not links: one button only).
const IDEAS = [
  "How Did Early Humans Survive the Ice Age?",
  "What Did Roman Soldiers Eat on the March?",
  "What Was a Normal Day Like for a Medieval Peasant?",
];

const TEXT = "#1A1D21";
const MUTED = "#6B7280";
const LINE = "#E5E7EB";
const BUTTON = "#17181C";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// A first name we can greet with: letters only, a sane length (never an email
// address or a handle with digits pasted into the name field).
export function firstName(name) {
  const first = String(name ?? "").trim().split(/\s+/)[0] ?? "";
  if (!/^\p{L}[\p{L}'-]{1,19}$/u.test(first)) return null;
  return first[0].toUpperCase() + first.slice(1);
}

export function LongFormFeatureEmail({ name, unsubscribeUrl, oneClickUrl = unsubscribeUrl, subject = SUBJECTS[0] }) {
  if (!unsubscribeUrl) throw new Error("LongFormFeatureEmail needs an unsubscribeUrl");
  if (!SUBJECTS.includes(subject)) throw new Error("LongFormFeatureEmail: unknown subject");
  const first = firstName(name);
  const hi = first ? `Hey ${first},` : "Hey,";
  const preheader = "Long Form writes the script, adds the voiceover and draws every scene. Three ideas to try inside.";
  const p = (html, extra = "") => `<p style="margin:0 0 16px 0;font:400 16px/1.6 ${FONT};color:${TEXT};${extra}">${html}</p>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#FFFFFF;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#FFFFFF;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;">
<tr><td align="center" style="padding:28px 20px 36px 20px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td style="padding:0 0 22px 0;font:800 20px ${FONT};color:${TEXT};">Zyvo</td></tr>
  <tr><td>
    ${p(esc(hi))}
    ${p("Niko here, I build Zyvo.")}
    ${p("We just added something I've wanted for a long time: <strong>Long Form</strong>. You type one idea, and Zyvo makes the whole YouTube video, 8 to 15 minutes long. It researches the topic, writes the script, adds the voiceover and draws every scene in a 2D stickman style. You get the finished video, three thumbnails and a title.")}
    ${p("A video like that usually means days of writing, recording and editing. Here you pick the idea and review the result.")}
    ${p("Three ideas you could start with:", "margin-bottom:8px;")}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;">
      ${IDEAS.map((idea) => `<tr><td valign="top" style="width:18px;font:400 16px/1.6 ${FONT};color:${MUTED};">&bull;</td><td style="font:600 16px/1.5 ${FONT};color:${TEXT};padding:0 0 6px 0;">${esc(idea)}</td></tr>`).join("\n      ")}
    </table>
    ${p("You can see your idea before paying for anything: a free account gets a preview with a title, the opening line and three drawn scenes.", "margin-bottom:22px;")}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 22px 0;"><tr><td style="border-radius:10px;background:${BUTTON};">
      <a href="${TRY_URL}" target="_blank" style="display:inline-block;padding:14px 26px;font:700 16px ${FONT};color:#FFFFFF;text-decoration:none;border-radius:10px;">Try Long Form</a>
    </td></tr></table>
    ${p("If you have a question, just reply to this email.")}
    ${p("Niko<br><span style=\"color:" + MUTED + ";\">Zyvo</span>", "margin-bottom:0;")}
  </td></tr>
  <tr><td style="padding:28px 0 0 0;">
    <div style="border-top:1px solid ${LINE};padding-top:16px;font:400 12px/1.6 ${FONT};color:${MUTED};">
      You're getting this because product updates are turned on for your Zyvo account.<br>
      <a href="${esc(unsubscribeUrl)}" style="color:${MUTED};text-decoration:underline;">Unsubscribe</a>
    </div>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = `${hi}

Niko here, I build Zyvo.

We just added something I've wanted for a long time: Long Form. You type one idea, and Zyvo makes the whole YouTube video, 8 to 15 minutes long. It researches the topic, writes the script, adds the voiceover and draws every scene in a 2D stickman style. You get the finished video, three thumbnails and a title.

A video like that usually means days of writing, recording and editing. Here you pick the idea and review the result.

Three ideas you could start with:
${IDEAS.map((idea) => `- ${idea}`).join("\n")}

You can see your idea before paying for anything: a free account gets a preview with a title, the opening line and three drawn scenes.

Try Long Form: ${TRY_URL}

If you have a question, just reply to this email.

Niko
Zyvo

You're getting this because product updates are turned on for your Zyvo account.
Unsubscribe: ${unsubscribeUrl}`;

  return {
    subject,
    html,
    text,
    headers: {
      // One-click unsubscribe (RFC 8058), required by Gmail and Yahoo for bulk mail.
      "List-Unsubscribe": `<${oneClickUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
