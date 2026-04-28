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
  const name = (user.email?.split("@")[0] || "creator")
    .replace(/[._\-+]/g, " ")
    .split(" ")[0];

  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Kling 3.0 Pro has just landed</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

  <!-- preview text -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:#0d0d0f;">
    Kling 3.0 Pro is now inside Zyvo. Turn one prompt into cinematic AI video today.&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌
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
            <td style="padding:28px 32px 0;">
              <span style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">Z<span style="color:#7A3BFF;">yvo</span></span>
            </td>
          </tr>

          <!-- HERO -->
          <tr>
            <td style="padding:24px 32px 0;">

              <h1 style="margin:0 0 20px;font-size:26px;font-weight:800;color:#ffffff;line-height:1.25;letter-spacing:-0.4px;">
                ${displayName}, Kling 3.0 Pro just landed in Zyvo.
              </h1>

              <p style="margin:0 0 14px;font-size:15px;line-height:1.85;color:rgba(255,255,255,0.65);">
                This is the upgrade I would pay attention to. Kling 3.0 Pro gives you cinematic AI video from a simple prompt, with stronger motion, cleaner scenes, and more polished results.
              </p>

              <p style="margin:0 0 14px;font-size:15px;line-height:1.85;color:rgba(255,255,255,0.65);">
                If you have been waiting for video output that feels less random and more usable for Reels, TikTok, ads, product shots, and story-driven clips, this is the model to try first.
              </p>

              <p style="margin:0 0 24px;font-size:15px;line-height:1.85;color:rgba(255,255,255,0.65);">
                Your Zyvo account is already set up. Upgrade now and you can start using Kling 3.0 Pro alongside the tools that help you turn ideas into finished content faster.
              </p>

              <!-- SOCIAL PROOF BOX -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:rgba(122,59,255,0.07);border-left:3px solid #7A3BFF;border-radius:0 12px 12px 0;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 18px;">
                    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.75);line-height:1.7;font-style:italic;">
                      "The difference with Zyvo video is speed. I can test ideas in minutes instead of spending the whole day editing one concept."
                    </p>
                    <p style="margin:8px 0 0;font-size:12px;color:rgba(255,255,255,0.35);">— Sarah M., content creator on Pro plan</p>
                  </td>
                </tr>
              </table>

              <!-- DIVIDER -->
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 22px;" />

              <p style="margin:0 0 14px;font-size:13px;font-weight:700;letter-spacing:0.08em;color:rgba(255,255,255,0.3);text-transform:uppercase;">what you can make with the new video stack</p>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">🎬</div></td>
                  <td style="padding-left:10px;">
                    <p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;">AI videos with Kling 3.0 Pro</p>
                    <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Create sharper, more cinematic clips for hooks, ads, product scenes, and short-form stories.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">✍️</div></td>
                  <td style="padding-left:10px;">
                    <p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;">Viral scripts in 60 seconds</p>
                    <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Start with a hook, scene structure, CTA, and prompt direction before you generate the final clip.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                <tr>
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">🖼️</div></td>
                  <td style="padding-left:10px;">
                    <p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;">400 AI images/month — premium models</p>
                    <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Build supporting thumbnails, concepts, backgrounds, and stills around the same campaign idea.</p>
                  </td>
                </tr>
              </table>

              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:26px;">
                <tr>
                  <td width="28" valign="top"><div style="width:22px;height:22px;background:rgba(122,59,255,0.15);border:1px solid rgba(122,59,255,0.3);border-radius:7px;text-align:center;line-height:22px;font-size:11px;">📸</div></td>
                  <td style="padding-left:10px;">
                    <p style="margin:0;font-size:14px;color:#ffffff;font-weight:600;">Generate prompts from your own images</p>
                    <p style="margin:3px 0 0;font-size:12px;color:rgba(255,255,255,0.4);line-height:1.5;">Upload a reference and turn it into prompt ideas for videos, images, and campaign variations.</p>
                  </td>
                </tr>
              </table>

              <!-- CTA BUTTON -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:12px;width:100%;">
                <tr>
                  <td style="border-radius:14px;background:linear-gradient(135deg,#7A3BFF,#9d4eff);box-shadow:0 8px 32px rgba(122,59,255,0.5);">
                    <a href="https://tryzyvo.com/workspace/pricing"
                       style="display:block;text-align:center;padding:18px 32px;font-size:18px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:-0.3px;">
                      Try Kling 3.0 Pro in Zyvo →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 6px;text-align:center;font-size:12px;color:rgba(255,255,255,0.25);">
                Starter €12/mo · Pro €25/mo · Cancel anytime · No hidden fees
              </p>

              <p style="margin:0 0 26px;text-align:center;font-size:12px;color:rgba(255,255,255,0.2);">
                4,200+ creators already on paid plans
              </p>

              <!-- DIVIDER -->
              <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:0 0 20px;" />

              <!-- PS -->
              <p style="margin:0 0 6px;font-size:14px;line-height:1.8;color:rgba(255,255,255,0.55);">
                <strong style="color:rgba(255,255,255,0.8);">P.S.</strong> — My suggestion: start with one simple video idea and run it through the Viral Script Builder first. Then use Kling 3.0 Pro to generate the clip from a stronger prompt.
                <a href="https://tryzyvo.com/workspace/viral-script" style="color:#9B6DFF;text-decoration:none;font-weight:600;">Try it here →</a>
              </p>

              <p style="margin:16px 0 0;font-size:13px;color:rgba(255,255,255,0.3);">— Niko, Zyvo</p>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.25);line-height:1.7;">
                You created a Zyvo account — that's why you're hearing from us.<br/>
                <a href="https://tryzyvo.com/settings" style="color:rgba(255,255,255,0.35);text-decoration:underline;">Unsubscribe</a>
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
      subject: "Kling 3.0 Pro has just landed",
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
    console.log(`   dry_run=${DRY_RUN}  target=email_updates:true`);

    let allUsers = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from("profiles")
        .select("email")
        .eq("email_updates", true)
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
            last_email_type: "kling_3_pro_launch",
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
