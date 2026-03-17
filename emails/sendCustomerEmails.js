import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const emails = [
  "stanislaw10@interia.pl",
  "prawetsukh.1962@gmail.com",
  "gabreutofani@gmail.com",
  "amar.d09@icloud.com",
  "stefanlavricut@gmail.com",
  "ciwanalishexo.300@gmail.com",
  "robertson.kash1@gmail.com",
  "samswitcher3550@gmail.com",
  "nibbleip4@gmail.com",
  "scotthipwell@hotmail.co.uk",
  "daviddobranici391@gmail.com",
  "arijandaut@gmail.com",
  "juliusolmeda9@gmail.com",
  "danmaughmer5@gmail.com"
];

function emailHTML(email) {
  return `
  <div style="font-family:Arial, sans-serif; color:#111; padding:20px; max-width:500px; margin:auto;">
    
    <p>Hey,</p>

    <p>
      you were really close to finishing your Zyvo setup earlier.
    </p>

    <p>
      We just released new video models that make content look way more cinematic 
      (especially for TikTok / Shorts).
    </p>

    <p>
      If you still want to try it, you can continue here:
    </p>

    <p>
      <a href="https://tryzyvo.com/workspace/pricing">
        https://tryzyvo.com/workspace/pricing
      </a>
    </p>

    <p>
      — Niko<br/>
      Zyvo
    </p>

  </div>
  `;
}

async function sendEmails() {

  console.log(`Sending ${emails.length} emails...`);

  for (const email of emails) {

    try {

      const { error } = await resend.emails.send({
        from: "Niko from Zyvo <niko@tryzyvo.com>", // 👈 IMPORTANT (personal sender)
        to: email,
        subject: "quick question",
        html: emailHTML(email),
      });

      if (error) {
        console.error("Failed:", email, error);
      } else {
        console.log("Sent to:", email);
      }

    } catch (err) {
      console.error("Error:", email, err);
    }

    await new Promise(r => setTimeout(r, 1200)); // slower = better deliverability
  }

  console.log("Done.");
}

sendEmails();