import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/* ================= CONFIG ================= */

const DELAY_MS        = 400;
const RETRY_DELAY_MS  = 2000;
const BATCH_SIZE      = 1000;
const MAX_SEND        = 50000;          // effectively "everyone"
const MIN_HOURS_SINCE_LAST_EMAIL = 24;  // don't double-blast within a day
const DRY_RUN         = false;

/* ================= HELPERS ================= */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sentTooRecently(lastSentAt) {
  if (!lastSentAt) return false;
  const hoursSince = (Date.now() - new Date(lastSentAt).getTime()) / 36e5;
  return hoursSince < MIN_HOURS_SINCE_LAST_EMAIL;
}

/* ================= EMAIL TEMPLATE ================= */

function buildEmail(user) {
  const name = (user.email?.split("@")[0] || "creator")
    .replace(/[._\-+]/g, " ")
    .split(" ")[0];

  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Zyvo Script Builder just dropped</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- preview text (shows in inbox before email is opened) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0d0d0f;">
    we just built something that writes your entire TikTok script in 60 seconds ✍️&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0d0f;">
    <tr>
      <td align="center" style="padding:40px 16px 60px;">

        <!-- CARD -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#16181f;border-radius:24px;border:1px solid rgba(255,255,255,0.07);overflow:hidden;">

          <!-- TOP ACCENT BAR -->
          <tr>
            <td style="height:3px;background:linear-gradient(90deg,#7A3BFF,#c077ff,#ff57b2,#c077ff,#7A3BFF);"></td>
          </tr>

          <!-- LOGO ROW -->
          <tr>
            <td style="padding:28px 32px 0;display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Z<span style="color:#7A3BFF;">yvo</span></span>
            </td>
          </tr>

          <!-- HERO SECTION -->
          <tr>
            <td style="padding:28px 32px 0;">

              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.12em;color:#7A3BFF;text-transform:uppercase;">
                new feature drop ✍️
              </p>

              <h1 style="margin:0 0 20px;font-size:30px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">
                Your next viral video,<br/>
                <span style="background:linear-gradient(90deg,#7A3BFF,#c077ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">
                  fully scripted.
                </span>
              </h1>

              <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.7);">
                Hey ${displayName} 👋
              </p>

              <p style="margin:0 0 16px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.7);">
                We just shipped something I've been wanting to build for a long time.
              </p>

              <p style="margin:0 0 24px;font-size:16px;line-height:1.8;color:rgba(255,255,255,0.9);font-weight:600;">
                Zyvo now writes your scripts.
              </p>

              <p style="margin:0 0 24px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.7);">
                Not a generic template. Not a prompt you have to hack yourself.<br/>
                A <strong style="color:#fff;">full, structured viral script</strong> — hook, scene-by-scene breakdown, call to action — generated in under 60 seconds, built around your idea and your style.
              </p>

              <!-- SCRIPT PREVIEW CARD -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0d0f14;border:1px solid rgba(255,255,255,0.08);border-radius:16px;margin-bottom:24px;overflow:hidden;">
                <!-- window chrome -->
                <tr>
                  <td style="padding:12px 16px;background:#111318;border-bottom:1px solid rgba(255,255,255,0.06);">
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ff5f56;margin-right:5px;"></span>
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#ffbd2e;margin-right:5px;"></span>
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#27c93f;"></span>
                    <span style="font-size:11px;color:rgba(255,255,255,0.25);font-family:monospace;margin-left:10px;">MrBeast Style · Your Idea</span>
                  </td>
                </tr>
                <!-- HOOK -->
                <tr>
                  <td style="padding:14px 18px 10px;">
                    <p style="margin:0 0 5px;font-size:9px;font-weight:800;letter-spacing:0.15em;color:#7A3BFF;text-transform:uppercase;">HOOK</p>
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);line-height:1.6;font-style:italic;">"I gave 100 strangers $1 to spend in a thrift store. What they found changed everything."</p>
                  </td>
                </tr>
                <!-- SCENE -->
                <tr>
                  <td style="padding:6px 18px 10px;">
                    <p style="margin:0 0 5px;font-size:9px;font-weight:800;letter-spacing:0.15em;color:rgba(255,255,255,0.35);text-transform:uppercase;">SCENE 2</p>
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.6);line-height:1.6;font-style:italic;">"Camera follows each person down a different aisle — music building, reactions getting bigger…"</p>
                  </td>
                </tr>
                <!-- CTA -->
                <tr>
                  <td style="padding:6px 18px 16px;">
                    <p style="margin:0 0 5px;font-size:9px;font-weight:800;letter-spacing:0.15em;color:#10b981;text-transform:uppercase;">CALL TO ACTION</p>
                    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.85);line-height:1.6;font-style:italic;">"Subscribe — we're doing this again with $10 next week. Results were insane."</p>
                  </td>
                </tr>
                <!-- media prompts tag -->
                <tr>
                  <td style="padding:10px 18px 14px;border-top:1px solid rgba(255,255,255,0.05);background:rgba(122,59,255,0.06);">
                    <p style="margin:0;font-size:12px;color:#a07bff;font-weight:600;">🎨 + image & video prompts included for every scene</p>
                  </td>
                </tr>
              </table>

              <!-- DIVIDER -->
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 24px;" />

              <!-- WHAT YOU GET -->
              <p style="margin:0 0 14px;font-size:12px;font-weight:700;letter-spacing:0.1em;color:rgba(255,255,255,0.35);text-transform:uppercase;">what you get with every script</p>

              <!-- row 1 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td width="28" valign="top">
                    <div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">⚡</div>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;">Full script in under 60 seconds</p>
                    <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">Hook, scenes, and CTA — structured and ready to film.</p>
                  </td>
                </tr>
              </table>

              <!-- row 2 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td width="28" valign="top">
                    <div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">🎨</div>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;">AI image & video prompts per scene</p>
                    <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">Paste directly into Zyvo's image or video generator.</p>
                  </td>
                </tr>
              </table>

              <!-- row 3 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td width="28" valign="top">
                    <div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">🎭</div>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;">7 creator style presets</p>
                    <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">MrBeast, Storyteller, POV, Trend, Tutorial, Controversy, Emotional.</p>
                  </td>
                </tr>
              </table>

              <!-- row 4 -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
                <tr>
                  <td width="28" valign="top">
                    <div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">📱</div>
                  </td>
                  <td style="padding-left:10px;">
                    <p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;">Built for TikTok, Reels & YouTube Shorts</p>
                    <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">Platform-optimised pacing, hook timing, and CTA placement.</p>
                  </td>
                </tr>
              </table>

              <!-- DIVIDER -->
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 24px;" />

              <p style="margin:0 0 28px;font-size:15px;line-height:1.8;color:rgba(255,255,255,0.7);">
                It's in beta right now — which means you're one of the first people to use it.<br/>
                Go try it. Tell me what you think. Your feedback is literally shaping what we build next.
              </p>

              <!-- CTA BUTTON -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;">
                <tr>
                  <td style="border-radius:14px;background:linear-gradient(135deg,#7A3BFF,#9d4eff);box-shadow:0 8px 24px rgba(122,59,255,0.4);">
                    <a href="https://tryzyvo.com/workspace/viral-script"
                       style="display:inline-block;padding:16px 32px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.3px;">
                      Write my first script free →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:12px;color:rgba(255,255,255,0.3);">
                2 credits per script · no card needed
              </p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.7;">
                You're getting this because you opted in to Zyvo updates.<br/>
                <a href="https://tryzyvo.com/settings" style="color:rgba(255,255,255,0.35);text-decoration:underline;">Manage preferences</a>
                &nbsp;·&nbsp;
                <a href="https://tryzyvo.com" style="color:rgba(255,255,255,0.35);text-decoration:underline;">tryzyvo.com</a>
              </p>
            </td>
          </tr>

        </table>
        <!-- /CARD -->

      </td>
    </tr>
  </table>

</body>
</html>`;

  return html;
}

/* ================= SEND WITH RETRY ================= */

async function sendEmail(user) {
  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Niko from Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject: "we just shipped something new ✍️",
      html: buildEmail(user),
    });

    if (!error) return true;

    lastError = error;
    console.error(`⚠️  Attempt ${attempt} failed for ${user.email}:`, error.message);
    if (attempt < 2) await sleep(RETRY_DELAY_MS);
  }

  console.error(`❌ Giving up on ${user.email}:`, lastError?.message);
  return false;
}

/* ================= MAIN HANDLER ================= */

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting engagement email campaign...");
    console.log(`   dry_run=${DRY_RUN}  max_send=${MAX_SEND}  cooldown=${MIN_HOURS_SINCE_LAST_EMAIL}h`);

    let allUsers = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, last_email_sent_at")
        .eq("email_updates", true)
        .range(from, from + BATCH_SIZE - 1);

      if (error) {
        console.error("❌ Supabase fetch error:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
      }

      if (!data || data.length === 0) break;
      allUsers.push(...data);
      if (data.length < BATCH_SIZE) break;
      from += BATCH_SIZE;
    }

    console.log(`📊 Total opted-in users: ${allUsers.length}`);

    let sent = 0, failed = 0, skipped = 0;

    for (const user of allUsers) {
      if (sent >= MAX_SEND) {
        console.log(`🛑 Reached MAX_SEND (${MAX_SEND}) — stopping.`);
        break;
      }

      if (!user.email) { skipped++; continue; }

      if (sentTooRecently(user.last_email_sent_at)) {
        skipped++;
        console.log(`⏭️  Skipping (emailed < ${MIN_HOURS_SINCE_LAST_EMAIL}h ago): ${user.email}`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`🧪 DRY RUN: would send to ${user.email}`);
        sent++;
        continue;
      }

      console.log(`➡️  Sending to: ${user.email}`);

      const ok = await sendEmail(user);

      if (ok) {
        sent++;
        await supabase
          .from("profiles")
          .update({
            last_email_sent_at: new Date().toISOString(),
            last_email_type: "script_builder_launch",
          })
          .eq("email", user.email);
      } else {
        failed++;
      }

      await sleep(DELAY_MS);
    }

    console.log("🎯 Campaign complete");
    console.log(`✅ Sent:    ${sent}`);
    console.log(`❌ Failed:  ${failed}`);
    console.log(`⏭️  Skipped: ${skipped}`);

    return res.status(200).json({ success: true, sent, failed, skipped });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}

/* ================= LOCAL RUN ================= */

if (process.argv[1]?.includes("send-engagement-email.js")) {
  console.log("🟢 Running engagement email locally...");
  handler(
    {},
    {
      status: (code) => ({ json: (data) => console.log("📤 Response:", code, data) }),
    }
  );
}
