import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { welcomeEmail } from "../src/lib/emails/welcomeEmail.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const { error: sendError } = await resend.emails.send(welcomeEmail(email));

    if (sendError) {
      console.error("Resend error:", sendError);
      return res.status(500).json({ error: "Failed to send email" });
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("email", email);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return res.status(500).json({ error: "Email sent but failed to update profile" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Handler crash:", err);
    return res.status(500).json({ error: "Failed to send email" });
  }
}