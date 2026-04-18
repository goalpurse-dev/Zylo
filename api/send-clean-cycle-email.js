import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BATCH_SIZE   = 400;
const BETWEEN_MS   = 3_000;   // 3s between individual sends
const RETRY_MS     = 1_500;
const COOLDOWN_MS  = 30 * 60 * 1_000; // 30 min between batches

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fmtMinutes(ms) {
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${m}m ${s}s`;
}

function emailHtml(user) {
  const raw = user.email?.split("@")[0] || "there";
  const name = raw.replace(/[._\-\d]/g, " ").trim().split(" ")[0];
  const displayName = name.charAt(0).toUpperCase() + name.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Zyvo account is ready</title>
</head>
<body style="margin:0;padding:0;background:#e8e8eb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8e8eb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td style="background:#07080f;padding:20px 32px;border-radius:16px 16px 0 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.8px;">Zyvo</span>
                  </td>
                  <td align="right">
                    <span style="font-family:Arial,sans-serif;font-size:10px;font-weight:700;color:#7A3BFF;letter-spacing:1.8px;text-transform:uppercase;border:1px solid rgba(122,59,255,0.4);padding:4px 10px;border-radius:20px;">AI Creator</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero gradient -->
          <tr>
            <td style="background:linear-gradient(145deg,#07080f 0%,#16093a 40%,#2a0a6b 75%,#7A3BFF 100%);padding:50px 32px 44px;text-align:center;">
              <div style="display:inline-block;background:rgba(122,59,255,0.2);border:1px solid rgba(122,59,255,0.4);border-radius:100px;padding:6px 18px;margin-bottom:22px;">
                <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#c084fc;letter-spacing:1.4px;text-transform:uppercase;">Your account is active</span>
              </div>
              <p style="margin:0 0 14px;font-family:Arial,sans-serif;font-size:40px;font-weight:900;color:#ffffff;line-height:1.05;letter-spacing:-1.5px;">
                The AI that makes<br/>creators go viral
              </p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:16px;color:rgba(255,255,255,0.6);line-height:1.7;max-width:400px;margin:0 auto;">
                You signed up — now let's actually make something. Here's everything waiting for you inside Zyvo right now.
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:44px 32px 8px;">

              <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:17px;line-height:1.75;color:#111111;">
                Hey ${displayName},
              </p>

              <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:15px;line-height:1.85;color:#333333;">
                You created a Zyvo account — and that's honestly the right move. Whether you're trying to grow on TikTok, build a brand, or just make something that looks incredible, Zyvo is the fastest way to get there.
              </p>

              <p style="margin:0 0 32px;font-family:Arial,sans-serif;font-size:15px;line-height:1.85;color:#333333;">
                Most creators spend hours trying to get good visuals. Zyvo users generate them in <strong style="color:#111111;">seconds</strong>.
              </p>

              <!-- What you can make -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 32px;">
                <tr>
                  <td style="padding:26px 26px 22px;background:#f9f8ff;border-radius:14px;border:1px solid #ede9ff;">
                    <p style="margin:0 0 18px;font-family:Arial,sans-serif;font-size:10px;font-weight:800;color:#7A3BFF;letter-spacing:2px;text-transform:uppercase;">What you can make right now</p>
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:10px 0 10px;border-bottom:1px solid #ede9ff;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:34px;vertical-align:top;padding-top:1px;">
                                <div style="width:26px;height:26px;background:linear-gradient(135deg,#7A3BFF,#9D6BFF);border-radius:8px;text-align:center;line-height:26px;font-size:13px;">🖼️</div>
                              </td>
                              <td style="padding-left:12px;">
                                <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#111111;">Scroll-stopping AI images</p>
                                <p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#888888;line-height:1.5;">Cinematic product shots, portraits, viral visuals — in seconds</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 10px;border-bottom:1px solid #ede9ff;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:34px;vertical-align:top;padding-top:1px;">
                                <div style="width:26px;height:26px;background:linear-gradient(135deg,#7A3BFF,#9D6BFF);border-radius:8px;text-align:center;line-height:26px;font-size:13px;">🎬</div>
                              </td>
                              <td style="padding-left:12px;">
                                <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#111111;">AI video from text or image</p>
                                <p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#888888;line-height:1.5;">Turn a single prompt into a cinematic short clip</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 10px;border-bottom:1px solid #ede9ff;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:34px;vertical-align:top;padding-top:1px;">
                                <div style="width:26px;height:26px;background:linear-gradient(135deg,#7A3BFF,#9D6BFF);border-radius:8px;text-align:center;line-height:26px;font-size:13px;">🛍️</div>
                              </td>
                              <td style="padding-left:12px;">
                                <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#111111;">Product photography without a studio</p>
                                <p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#888888;line-height:1.5;">Drop in your product, get studio-quality results</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="width:34px;vertical-align:top;padding-top:1px;">
                                <div style="width:26px;height:26px;background:linear-gradient(135deg,#7A3BFF,#9D6BFF);border-radius:8px;text-align:center;line-height:26px;font-size:13px;">🚀</div>
                              </td>
                              <td style="padding-left:12px;">
                                <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;font-weight:700;color:#111111;">20+ styles, updated weekly</p>
                                <p style="margin:2px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#888888;line-height:1.5;">Anime, photorealism, dark moody, editorial — your pick</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Free credits callout -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 36px;">
                <tr>
                  <td style="padding:20px 24px;background:linear-gradient(135deg,#0d0620,#1a0533);border-radius:14px;text-align:center;">
                    <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-1px;">10 free generations</p>
                    <p style="margin:0;font-family:Arial,sans-serif;font-size:13px;color:rgba(255,255,255,0.45);">waiting in your account right now · resets every month · no card needed</p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- CTA row -->
          <tr>
            <td style="background:#ffffff;padding:0 32px 40px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
                <tr>
                  <td style="border-radius:13px;background:linear-gradient(135deg,#7A3BFF,#9D6BFF);box-shadow:0 10px 36px rgba(122,59,255,0.55);">
                    <a href="https://tryzyvo.com/workspace/image-generator"
                       style="display:inline-block;padding:18px 52px;font-family:Arial,sans-serif;font-size:16px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.2px;">
                      Start creating now →
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:12px;color:#bbbbbb;">Free to use · No credit card · Takes 10 seconds</p>
            </td>
          </tr>

          <!-- Sign-off -->
          <tr>
            <td style="background:#fafafa;padding:28px 32px 32px;border-top:1px solid #f0f0f0;">
              <p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:14px;line-height:1.8;color:#666666;">
                The creators who get results are the ones who actually start. You already did the hard part by signing up — now just hit generate once and see what Zyvo can do for you.
              </p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:15px;line-height:1.8;color:#444444;">
                Let's build something,<br />
                <strong style="color:#111111;">Niko</strong><br />
                <span style="font-size:13px;color:#aaaaaa;">Founder, Zyvo</span>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f0f0f2;padding:18px 32px;border-top:1px solid #e4e4e6;border-radius:0 0 16px 16px;">
              <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:11px;color:#c0c0c0;line-height:1.6;">
                You're receiving this because you created a Zyvo account. This is a one-time activation email.
              </p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#c0c0c0;">
                Zyvo &middot; <a href="https://tryzyvo.com" style="color:#c0c0c0;text-decoration:underline;">tryzyvo.com</a>
              </p>
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
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Niko at Zyvo <niko@tryzyvo.com>",
      to: user.email,
      subject: "your Zyvo account has 10 free generations waiting",
      html: emailHtml(user),
    });

    if (!error) return true;

    console.warn(`   ⚠️  Attempt ${attempt} failed for ${user.email}: ${error.message}`);
    if (attempt < 2) await sleep(RETRY_MS);
  }

  return false;
}

async function fetchAllFreeUsers() {
  const users = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    console.log(`   Fetching rows ${from}–${from + PAGE - 1}...`);

    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("plan_code", "free")
      .not("email", "is", null)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Supabase fetch failed: ${error.message}`);
    if (!data || data.length === 0) break;

    users.push(...data.filter(u => u.email?.includes("@")));
    console.log(`   → ${data.length} rows fetched (total: ${users.length})`);

    if (data.length < PAGE) break;
    from += PAGE;
  }

  return users;
}

export default async function handler(req, res) {
  try {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  Zyvo activation email — full free-user blast");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("📋 Fetching all free-plan users...");
    const allUsers = await fetchAllFreeUsers();
    console.log(`\n👥 Total free users: ${allUsers.length}\n`);

    if (allUsers.length === 0) {
      console.log("✅ No free users found. Nothing to send.");
      res?.status?.(200)?.json({ success: true, sent: 0, failed: 0 });
      return;
    }

    const totalBatches = Math.ceil(allUsers.length / BATCH_SIZE);
    let totalSent = 0;
    let totalFailed = 0;

    for (let b = 0; b < totalBatches; b++) {
      const batchNum  = b + 1;
      const batchStart = b * BATCH_SIZE;
      const batch     = allUsers.slice(batchStart, batchStart + BATCH_SIZE);

      console.log(`\n${"─".repeat(50)}`);
      console.log(`📦 Batch ${batchNum} / ${totalBatches}  (${batch.length} emails)`);
      console.log(`${"─".repeat(50)}`);

      let batchSent   = 0;
      let batchFailed = 0;

      for (let i = 0; i < batch.length; i++) {
        const user = batch[i];
        const label = `[${batchStart + i + 1}/${allUsers.length}]`;

        process.stdout.write(`➡️  ${label} ${user.email} ... `);
        const ok = await sendEmail(user);

        if (ok) {
          batchSent++;
          totalSent++;
          console.log("✅");
        } else {
          batchFailed++;
          totalFailed++;
          console.log("❌ failed");
        }

        if (i < batch.length - 1) await sleep(BETWEEN_MS);
      }

      console.log(`\n✔  Batch ${batchNum} done — sent: ${batchSent}, failed: ${batchFailed}`);
      console.log(`📊 Running total — sent: ${totalSent}, failed: ${totalFailed}`);

      // Pause between batches (skip after last batch)
      if (b < totalBatches - 1) {
        const waitMin = COOLDOWN_MS / 60_000;
        console.log(`\n⏸  Cooling down for ${waitMin} minutes before next batch...`);

        const tickEvery = 60_000; // log every 1 min
        let waited = 0;
        while (waited < COOLDOWN_MS) {
          await sleep(tickEvery);
          waited += tickEvery;
          const remaining = COOLDOWN_MS - waited;
          console.log(`   ⏳ ${fmtMinutes(remaining)} remaining...`);
        }

        console.log("▶  Resuming...");
      }
    }

    console.log(`\n${"━".repeat(50)}`);
    console.log(`🎯 All done — Total sent: ${totalSent} | Failed: ${totalFailed}`);
    console.log(`${"━".repeat(50)}\n`);

    res?.status?.(200)?.json({ success: true, sent: totalSent, failed: totalFailed });

  } catch (err) {
    console.error("\n🔥 Fatal error:", err.message);
    res?.status?.(500)?.json({ error: err.message });
  } finally {
    process.exit(0);
  }
}

// ─── Local run ────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes("send-clean-cycle-email.js")) {
  handler({}, { status: (code) => ({ json: (data) => console.log("\n📤 Result:", code, data) }) });
}
