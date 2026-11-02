// The welcome email: one per new account, sent by the send-welcome-email function when "Building your plan" finishes (or
// someone skips the survey). Short and personal, not a campaign. An offer appears only for someone who ticked the email
// opt-in, with the bonus's real end time. The footer (why, unsubscribe, company line) comes from _shared/emailRules.js.
// Links carry ?from=email: the app records the click itself, so click tracking stays off at Resend (it rewrites links,
// which hurts delivery: the owner's rule of 2026-10-12).
import { APP_URL } from "./emailRules.js";

export const WELCOME_SUBJECT = "Your first video is waiting";
export const WELCOME_WHY = "You're getting this because you just created a Zyvo account.";
export const WELCOME_VIDEO_URL = `${APP_URL}/welcome/first-video?from=email`;
export const WELCOME_IMAGES_URL = `${APP_URL}/workspace/image-generator?from=email`;

/** "Thursday 5 November, 21:02 UTC": the same moment for everyone, wherever they read it. */
export function bonusEndText(expiresAt) {
  const d = new Date(expiresAt);
  if (!Number.isFinite(d.getTime())) return null;
  const day = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).replace(",", "");
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return `${day}, ${time} UTC`;
}

/** bonusEndsAt: only for someone who opted in to offers, with a sign-up bonus still running. Otherwise no offer at all. */
export function welcomeEmail(footer, { bonusEndsAt = null } = {}) {
  const ends = bonusEndsAt ? bonusEndText(bonusEndsAt) : null;
  const p = "margin:0 0 16px;font-size:16px;line-height:1.55;color:#1f2328";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:8px 4px;color:#1f2328">
      <p style="${p}">Hi,</p>
      <p style="${p}">Thanks for joining Zyvo. Your first video is ready to start, and it only takes a minute or two.</p>
      <p style="margin:0 0 20px"><a href="${WELCOME_VIDEO_URL}" style="display:inline-block;background:#1f2328;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">Go to my video</a></p>
      <p style="${p}">You also have 5 free images. <a href="${WELCOME_IMAGES_URL}" style="color:#1f2328">Try one here</a>.</p>
      ${ends ? `<p style="${p}">Since you asked to hear about offers: start a plan by ${ends} and you get 50 bonus credits.</p>` : ""}
      <p style="${p}">If you get stuck, just reply. I read these myself.</p>
      <p style="${p}">Niko<br>Zyvo</p>
      ${footer.html}
    </div>`;
  const text = [
    "Hi,", "",
    "Thanks for joining Zyvo. Your first video is ready to start, and it only takes a minute or two.", "",
    `Go to my video: ${WELCOME_VIDEO_URL}`, "",
    `You also have 5 free images. Try one here: ${WELCOME_IMAGES_URL}`, "",
    ...(ends ? [`Since you asked to hear about offers: start a plan by ${ends} and you get 50 bonus credits.`, ""] : []),
    "If you get stuck, just reply. I read these myself.", "",
    "Niko", "Zyvo", "",
    footer.text,
  ].join("\n");
  return { html, text };
}
