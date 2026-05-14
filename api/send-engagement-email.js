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
  <title>you signed up. then disappeared.</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#f4f4f5;">
    Creators who started 3 weeks ago already have 50k followers. The window is still open — but not for long.&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
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
            Niko here. I'm not going to pretend this is a newsletter — I'm reaching out because you signed up for Zyvo and never made a single video.
          </p>

          <p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:#374151;">
            I get it. Starting feels hard. But here's what's been happening while you've been waiting:
          </p>

          <!-- What they missed -->
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
            <tr>
              <td style="padding:22px 24px;background:#0d0d0f;border-radius:12px;">
                <p style="margin:0 0 16px;font-size:13px;font-weight:700;color:#9ca3af;letter-spacing:0.1em;text-transform:uppercase;">While you were away</p>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                  <tr>
                    <td style="width:28px;padding-top:2px;">
                      <span style="font-size:18px;">📈</span>
                    </td>
                    <td>
                      <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">Fruit drama hit 4.7M views/week</p>
                      <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">The format blew up. Creators who started early are cashing in.</p>
                    </td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:14px;">
                  <tr>
                    <td style="width:28px;padding-top:2px;">
                      <span style="font-size:18px;">🚀</span>
                    </td>
                    <td>
                      <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">New creators hit 50k followers in 3 weeks</p>
                      <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Not influencers. Regular people who just showed up and posted.</p>
                    </td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="width:28px;padding-top:2px;">
                      <span style="font-size:18px;">⏳</span>
                    </td>
                    <td>
                      <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">The window is still open — barely</p>
                      <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">Every week more creators pile in. First-mover advantage fades fast.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 18px;font-size:15px;line-height:1.75;color:#374151;">
            You already did the hardest part — you found Zyvo before the crowd did. Don't let that head start go to waste.
          </p>

          <p style="margin:0 0 28px;font-size:15px;line-height:1.75;color:#374151;">
            One video. That's all it takes to see what this is. Pick a drama angle, hit generate, and Zyvo writes the script, creates the characters, animates the scenes, and exports a ready-to-post video. Under 5 minutes.
          </p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:22px;">
            <tr>
              <td style="border-radius:10px;background:linear-gradient(135deg,#7A3BFF,#9d4eff);">
                <a href="https://tryzyvo.com/workspace/ai-fruit-story"
                   style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:-0.2px;">
                  Make your first video now →
                </a>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 6px;font-size:14px;line-height:1.75;color:#9ca3af;">
            No filming. No editing. No experience needed.
          </p>

          <p style="margin:24px 0 0;font-size:14px;color:#6b7280;">
            — Niko<br/>
            <span style="color:#9ca3af;font-size:13px;">Founder, Zyvo</span>
          </p>

        </td></tr>

        <!-- footer -->
        <tr><td style="padding:20px 40px 24px;border-top:1px solid #f3f4f6;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.7;">
            You're getting this because you opted in to updates from Zyvo.<br/>
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
      subject: "you signed up. then disappeared.",
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
    console.log(`   dry_run=${DRY_RUN}  target=plan_code:free`);

    let allUsers = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("plan_code", "free")
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

    console.log(`📊 Total opted-in users to email: ${allUsers.length}`);

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
            last_email_type: "re_engagement_free_plan",
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
