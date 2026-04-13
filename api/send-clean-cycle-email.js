import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MAX_SEND = 300;
const DELAY_MS = 3000;
const RETRY_DELAY_MS = 1500;
const COOLDOWN_HOURS = 72; // ⏳ only resend after 3 days

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function emailHtml(user) {
  const raw = user.email?.split("@")[0] || "there";
  // Capitalize first letter, strip dots/underscores/numbers for a cleaner greeting
  const name = raw.replace(/[._\-\d]/g, " ").trim().split(" ")[0];
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>A note from Zyvo</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:#0d0d0d;padding:24px 32px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Zyvo</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 28px;font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a;">

              <p style="margin:0 0 16px;">Hey ${displayName},</p>

              <p style="margin:0 0 16px;">I noticed you signed up for Zyvo a little while back — wanted to check in personally.</p>

              <p style="margin:0 0 16px;">A lot of creators use Zyvo to produce scroll-stopping images and videos in minutes, then use that content across their channels, ads, and client work. No design skills needed.</p>

              <p style="margin:0 0 16px;">If you haven’t had a chance to dig in yet, now’s actually a pretty good time — we’re running <strong>25% off Pro</strong> for a limited window, and the upgrade takes about 30 seconds.</p>

              <p style="margin:0 0 28px;">No pressure either way, just didn’t want you to miss it.</p>

              <!-- CTA -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:#7A3BFF;">
                    <a href="https://tryzyvo.com/workspace/pricing"
                       style="display:inline-block;padding:13px 28px;font-family:Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.1px;">
                      See what Pro unlocks →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:32px 0 0;color:#555555;">— Niko from Zyvo</p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #eeeeee;font-family:Arial,sans-serif;font-size:12px;color:#999999;line-height:1.6;">
              <p style="margin:0 0 4px;">You’re getting this because you signed up at tryzyvo.com.</p>
              <p style="margin:0;">Zyvo · tryzyvo.com</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(user) {
  let sendError = null;

  for (let i = 1; i <= 2; i++) {
    const { error } = await resend.emails.send({
      from: "Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject: "a quick note from Zyvo",
      html: emailHtml(user),
    });

    if (!error) {
      sendError = null;
      break;
    }

    sendError = error;
    await sleep(RETRY_DELAY_MS);
  }

  if (sendError) return false;

  // 🔥 mark user as sent
  await supabase
    .from("profiles")
    .update({ last_email_sent_at: new Date().toISOString() })
    .eq("email", user.email);

  return true;
}

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting batch send...");

    const cutoff = new Date(
      Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000
    ).toISOString();

    let allUsers = [];
    let from = 0;
    const batchSize = 1000;

    // 🔥 FETCH WITH COOLDOWN FILTER
    while (true) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email, email_updates, last_email_sent_at")
        .eq("email_updates", true)
        .or(`last_email_sent_at.is.null,last_email_sent_at.lt.${cutoff}`)
        .range(from, from + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allUsers.push(...data);

      if (data.length < batchSize) break;
      from += batchSize;
    }

    console.log(`👥 Eligible users: ${allUsers.length}`);

    let sent = 0;
    let skipped = 0;

    for (const user of allUsers) {
      if (sent >= MAX_SEND) break;
      if (!user.email) {
        skipped++;
        continue;
      }

      console.log(`➡️ Sending to: ${user.email}`);
      const ok = await sendEmail(user);

      if (ok) sent++;
      else skipped++;

      await sleep(DELAY_MS);
    }

    console.log(`🎯 Done — Sent ${sent}`);

    return res?.status?.(200)?.json({
      success: true,
      sent,
      skipped,
    });

  } catch (err) {
    console.error("🔥 Error:", err);
    return res?.status?.(500)?.json({ error: "fail" });
  }
}

// 🧪 Local run
if (process.argv[1]?.includes("send-next-batch.js")) {
  handler({}, { status: c => ({ json: d => console.log(c, d) }) });
}
// ================= LOCAL RUN =================
if (process.argv[1]?.includes("send-clean-cycle-email.js")) {
  console.log("🟢 Running email batch...");

  handler(
    {},
    {
      status: (code) => ({
        json: (data) => {
          console.log("📤 Response:", code, data);
          process.exit(0);
        },
      }),
    }
  );
}