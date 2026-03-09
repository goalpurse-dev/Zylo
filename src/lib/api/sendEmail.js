import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to, subject, message } = req.body;

  try {

    const data = await resend.emails.send({
      from: "Zyvo <hello@tryzyvo.com>",
      to: to,
      subject: subject,
      html: `
        <div style="font-family:Arial, sans-serif; max-width:600px; margin:auto;">
          <h2>Zyvo AI</h2>
          <p>${message}</p>
          <br/>
          <p style="color:#666;font-size:12px">
          You are receiving this email because you enabled product updates.
          </p>
        </div>
      `
    });

    return res.status(200).json({ success: true, data });

  } catch (err) {

    console.error(err);

    return res.status(500).json({ error: "Email failed to send" });

  }
}