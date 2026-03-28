import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAILS = [
  "atticafn@gmail.com",
  "wojsiatagnieszka@gmail.com",
  "abdif658@gmail.com",
  "tyshawnmatthewsjr964@gmail.com",
  "curranharper@icloud.com",
  "dmay198@gmail.com",
  "maxivey673@gmail.com"
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function recoveryHtml(email) {
  const name = email.split("@")[0];

  return `
  <div style="font-family:Arial, sans-serif; max-width:520px; margin:auto; padding:20px;">
    <p>Hey ${name},</p>

    <p>I saw you tried to complete your purchase, but something didn’t go through.</p>

    <p>You were literally one step away.</p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing">
        Complete it here →
      </a>
    </p>

    <p>If anything breaks, just reply and I’ll help you.</p>

    <p>— Zyvo</p>
  </div>
  `;
}

async function run() {
  console.log("🚀 Sending recovery emails...");

  for (const email of EMAILS) {
    console.log("➡️", email);

    const { error } = await resend.emails.send({
      from: "Zyvo <updates@tryzyvo.com>",
      to: email,
      subject: "you were almost done",
      html: recoveryHtml(email),
    });

    if (error) {
      console.error("❌", email, error);
    } else {
      console.log("✅ sent:", email);
    }

    await sleep(800); // slower = safer delivery
  }

  console.log("🎯 Done");
}

run();