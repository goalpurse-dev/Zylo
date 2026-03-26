import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DELAY_MS = 450;
const RETRY_DELAY_MS = 1500;

const IMAGE_URL =
  "https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/sign/products/nanobanana2.webp?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV84Y2JmM2UzOS0xYzg1LTQxN2ItOGEyYS01ZDdiOTgzMWE5MTAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJwcm9kdWN0cy9uYW5vYmFuYW5hMi53ZWJwIiwiaWF0IjoxNzc0NDY0OTY3LCJleHAiOjE4MDYwMDA5Njd9.eiVTaRyVS2dOTVOGabQcGI-n-YQ5L0H-wkEgoJ-jOBA";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nanoBananaTwoHtml(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px; color:#111; line-height:1.6;">
    
    <p>Hey ${name},</p>

    <p>
      We just released <strong>Nano Banana 2</strong>.
    </p>

    <p>
      It’s easily the best image model we’ve added so far.
    </p>

    <a href="https://tryzyvo.com/workspace/image-generator">
      <img 
        src="${IMAGE_URL}"
        alt="Nano Banana 2 preview"
        style="width:100%; border-radius:10px; margin:16px 0;"
      />
    </a>

    <p>
      You’ll notice it immediately:
    </p>

    <p>
      • higher quality outputs<br>
      • more “viral-looking” images<br>
      • more consistent generations
    </p>

    <p>
      It’s also cheap enough to actually scale.
    </p>

    <p>
      On Pro, you can generate <strong>200+ images</strong> with this model.
    </p>

    <p>
      If you're making short-form content, thumbnails, or anything visual — this is the one to use.
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/image-generator">
        Try Nano Banana 2 →
      </a>
    </p>

    <p>— Niko</p>

  </div>
  `;
}

async function sendEmail(user) {
  const subject = "🍌 Nano Banana 2 is live";

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Niko <niko@tryzyvo.com>",
      to: user.email,
      subject,
      html: nanoBananaTwoHtml(user),
      reply_to: "niko@tryzyvo.com",
    });

    if (!error) {
      sendError = null;
      break;
    }

    sendError = error;
    console.error(`⚠️ Send attempt ${attempt} failed for ${user.email}`, error);
    await sleep(RETRY_DELAY_MS);
  }

  if (sendError) {
    console.error("❌ Final fail:", user.email, sendError);
    return false;
  }

  return true;
}

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting Nano Banana 2 launch email campaign...");

    const { data: users, error } = await supabase
      .from("profiles")
      .select("email, email_updates")
      .eq("email_updates", true);

    if (error) {
      console.error("❌ Supabase fetch error:", error);
      return res.status(500).json({ error: "Failed to fetch users" });
    }

    console.log(`📊 Total subscribed users: ${users.length}`);

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of users) {

      if (!user.email) {
        skipped++;
        console.log("⚠️ Skipping (no email)");
        continue;
      }

      console.log(`➡️ Sending to: ${user.email}`);

      const ok = await sendEmail(user);

      if (ok) {
        sent++;
        console.log(`✅ Sent (${sent}/${users.length}): ${user.email}`);
      } else {
        failed++;
      }

      await sleep(DELAY_MS);
    }

    console.log("🎯 Campaign finished");
    console.log(`✅ Sent: ${sent}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⚠️ Skipped: ${skipped}`);

    return res.status(200).json({
      success: true,
      total: users.length,
      sent,
      failed,
      skipped,
    });

  } catch (err) {
    console.error("🔥 Unexpected error:", err);
    return res.status(500).json({ error: "Unexpected error" });
  }
}

// ================= LOCAL RUN =================
if (process.argv[1]?.includes("send-nano-banana-2-launch-email.js")) {
  console.log("🟢 Running Nano Banana 2 campaign...");

  handler(
    {},
    {
      status: (code) => ({
        json: (data) => {
          console.log("📤 Response:", code, data);
        },
      }),
    }
  );
}