import { Resend } from "resend";
import { welcomeEmail } from "../src/lib/emails/welcomeEmail.js";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { email } = req.body;

    await resend.emails.send(
      welcomeEmail(email)
    );

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send email" });
  }

}