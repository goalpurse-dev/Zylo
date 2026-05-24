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

const DELAY_MS                = 400;
const RETRY_DELAY_MS          = 2000;
const BATCH_SIZE              = 1000;
const DRY_RUN                 = false;

/* ================= HELPERS ================= */

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/* ================= EMAIL TEMPLATE ================= */

function buildEmail(user) {
  const raw = (user.email?.split("@")[0] || "")
    .replace(/[._\-+\d]/g, " ").trim().split(" ")[0] || "there";
  const displayName = raw.charAt(0).toUpperCase() + raw.slice(1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>we just dropped something wild 😮</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f4f5;">
    Face ASMR is live on Zyvo — upload any face, pick a scene, go viral.&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
    <tr><td align="center" style="padding:40px 16px 60px;">

      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 24px rgba(0,0,0,0.07);">

        <!-- top bar -->
        <tr><td style="height:3px;background:linear-gradient(90deg,#7A3BFF,#c077ff,#ff57b2);"></td></tr>

        <!-- content -->
        <tr><td style="padding:36px 40px 32px;">

          <!-- logo -->
          <p style="margin:0 0 32px;font-size:18px;font-weight:800;color:#0d0d0f;letter-spacing:-0.4px;">
            Z<span style="color:#7A3BFF;">yvo</span>
          </p>

          <p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#374151;">
            Hey ${displayName},
          </p>

          <p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#374151;">
            Niko here — we just shipped something I've been hyped about for a while, and I wanted to tell you about it directly.
          </p>

          <p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#374151;">
            <strong>Face ASMR is now live on Zyvo.</strong>
          </p>

          <p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#374151;">
            Here's how it works: you upload a face photo, pick one of our satisfying ASMR scenes, and we generate a full vertical video with that face placed right into the scene. Soap carving, kinetic sand, slime — whatever's trending. Takes about a minute. Gets millions of views.
          </p>

          <!-- Feature card -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td style="padding:22px 24px;background:#faf8ff;border-radius:12px;border:1px solid #ede9fe;">
                <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#7A3BFF;letter-spacing:0.08em;text-transform:uppercase;">What makes it viral</p>
                <p style="margin:0 0 10px;font-size:14px;color:#374151;line-height:1.7;"><span style="color:#7A3BFF;font-weight:700;">→</span> &nbsp;<strong>Any face works</strong> — upload a celebrity, your own face, anyone. The AI handles the rest.</p>
                <p style="margin:0 0 10px;font-size:14px;color:#374151;line-height:1.7;"><span style="color:#7A3BFF;font-weight:700;">→</span> &nbsp;<strong>Trending ASMR scenes</strong> — we built the scene library around what's actually blowing up on TikTok and Reels right now.</p>
                <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;"><span style="color:#7A3BFF;font-weight:700;">→</span> &nbsp;<strong>Full video, not a loop</strong> — you get a real video you can post directly, watermark-free on any paid plan.</p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#374151;">
            ASMR content is one of the highest-retention formats on short video right now. If you've been looking for a niche that's easy to make and hard to stop watching — this is it.
          </p>

          <p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:#374151;">
            Go try it — it's live right now.
          </p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
            <tr>
              <td style="border-radius:10px;background:linear-gradient(135deg,#7A3BFF,#9f5fff);">
                <a href="https://tryzyvo.com/face-asmr-maker"
                   style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                  Try Face ASMR now →
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:8px 0 24px;font-size:13px;color:#9ca3af;">Reply to this email if you have questions — it goes straight to me.</p>

          <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">
            — Niko<br/>
            <span style="color:#9ca3af;font-size:13px;">Founder, Zyvo</span>
          </p>

        </td></tr>

        <!-- footer -->
        <tr><td style="padding:20px 40px 24px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.7;">
            You're receiving this because you have a Zyvo account.<br/>
            <a href="https://tryzyvo.com/settings" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
            &nbsp;·&nbsp;
            <a href="https://tryzyvo.com" style="color:#9ca3af;text-decoration:underline;">tryzyvo.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
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
      subject: "we just dropped something wild 😮",
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
    console.log(`   dry_run=${DRY_RUN}  target=all_users`);

    let allUsers = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email")
        .not("email", "is", null)
        .range(from, from + BATCH_SIZE - 1);

      if (error) {
        console.error("❌ Supabase fetch error:", error);
        return res.status(500).json({ error: "Failed to fetch users" });
      }

      if (data?.length) {
        allUsers.push(...data);
      }

      hasMore = !!data && data.length === BATCH_SIZE;
      from += BATCH_SIZE;
    }

    console.log(`📊 Total users to email: ${allUsers.length}`);

    let sent = 0, failed = 0, skipped = 0;

    for (const user of allUsers) {
      if (!user.email) { skipped++; continue; }

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
            last_email_type: "face_asmr_launch",
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
