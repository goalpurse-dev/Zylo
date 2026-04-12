import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// 🔥 SAFE SETTINGS
const DELAY_MS = 6000; // slower = better inbox
const RETRY_DELAY_MS = 2000;
const MAX_SEND = 300;

// 🔥 SUBJECT ROTATION
const SUBJECTS = [
  "quick question",
  "did you try this yet?",
  "this is interesting",
  "what do you think?",
  "one thing I noticed"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 🔥 CLEAN EMAIL (NO PROMO STYLE)
function simpleEmail(user) {
  const name = user.email?.split("@")[0] || "there";

  return `
  <div style="font-family:Arial, sans-serif; max-width:500px; margin:auto; padding:16px; color:#111;">
    
    <div style="display:none;max-height:0;overflow:hidden;">
      quick question about zyvo
    </div>

    <p>Hey ${name},</p>

    <p>
      quick question —
    </p>

    <p>
      did you try Nano Banana 2 yet?
    </p>

    <p>
      we’re seeing way better outputs compared to older models
    </p>

    <p>
      curious what you think:
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/image-generator">
        https://tryzyvo.com/workspace/image-generator
      </a>
    </p>

    <p>
      just reply if something didn’t work for you
    </p>

    <p>
      — Niko
    </p>

  </div>
  `;
}

// 🔥 PICK RANDOM SUBJECT
function getSubject() {
  return SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
}

async function sendEmail(user) {
  const subject = getSubject();

  let sendError = null;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const { error } = await resend.emails.send({
      from: "Niko <niko@tryzyvo.com>",
      to: user.email,
      subject,
      html: simpleEmail(user),
    });

    if (!error) {
      sendError = null;
      break;
    }

    sendError = error;
    await sleep(RETRY_DELAY_MS);
  }

  if (sendError) return false;
  return true;
}

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting clean cycle email...");

    const { data: users, error } = await supabase
      .from("profiles")
      .select("email, email_updates")
      .eq("email_updates", true)
      .limit(1000);

    if (error) {
      console.error(error);
      return res.status(500).json({ error: "fetch error" });
    }

    let sent = 0;
    let processed = 0;

    for (const user of users) {

      if (processed >= MAX_SEND) {
        console.log("🛑 MAX_SEND reached");
        break;
      }

      if (!user.email) continue;

      console.log(`➡️ Sending to: ${user.email}`);

      const ok = await sendEmail(user);

      if (ok) {
        sent++;
        processed++;
      }

      await sleep(DELAY_MS);
    }

    console.log(`✅ Sent: ${sent}`);

    return res.status(200).json({
      success: true,
      sent
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "internal error" });
  }
}

// LOCAL RUN
handler(
  {},
  {
    status: () => ({
      json: (data) => console.log("📤", data),
    }),
  }
);