import dotenv from "dotenv";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { welcomeEmail } from "../src/lib/emails/welcomeEmail.js";

dotenv.config({ path: ".env.local" });

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email missing" });
    }

    // check if email already sent
    const { data, error } = await supabase
      .from("profiles")
      .select("welcome_email_sent")
      .eq("email", email)
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ error: "Database error" });
    }

    if (data?.welcome_email_sent) {
      return res.status(200).json({
        message: "Welcome email already sent"
      });
    }

    // send welcome email
    await resend.emails.send(
      welcomeEmail(email)
    );

    // update column so it won't send again
    await supabase
      .from("profiles")
      .update({ welcome_email_sent: true })
      .eq("email", email);

    return res.status(200).json({
      success: true
    });

  } catch (err) {

    console.error("Email error:", err);

    return res.status(500).json({
      error: "Failed to send welcome email"
    });

  }

}