import { Resend } from "resend";

const resend = new Resend(import.meta.env.VITE_RESEND_API_KEY);

export async function sendStyleUpdateEmail() {
  try {
    const { data, error } = await resend.emails.send({
      from: "Zyvo Updates <updates@tryzyvo.com>",
      to: ["hillaryscott684@gmail.com"],
      subject: "🦴 New Viral Style Just Dropped in Zyvo",
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto">

        <h2 style="color:#7A3BFF;">New Zyvo Style Drop</h2>

        <p>Hello,</p>

        <p>
        We just added a <strong>new viral image style</strong> to Zyvo and it’s already one of the coolest ones yet.
        </p>

        <h3 style="margin-top:20px;">🦴 Dog Skeleton X-Ray</h3>

        <p>
        This style creates <strong>glowing x-ray skeleton visuals</strong> inside animals and characters.
        It looks like a cinematic medical scan and works perfectly for:
        </p>

        <ul>
        <li>viral TikTok science videos</li>
        <li>shorts content</li>
        <li>unique AI visuals</li>
        </ul>

        <p>
        Early users are already creating some insanely cool images with it.
        </p>

        <p style="margin:25px 0;">
          <a href="https://tryzyvo.com"
          style="
          background:#7A3BFF;
          color:white;
          padding:14px 22px;
          border-radius:8px;
          text-decoration:none;
          font-weight:bold;
          font-size:16px;
          ">
          Try the Dog Skeleton X-Ray Style
          </a>
        </p>

        <p>
        If you still have free generations left, this is a great one to test.
        </p>

        <p>
        Can't wait to see what you create.
        </p>

        <br>

        <p>
        — Zyvo Updates<br>
        updates@tryzyvo.com
        </p>

        </div>
      `,
    });

    if (error) {
      console.error("Email error:", error);
      return { success: false, error };
    }

    console.log("Email sent:", data);
    return { success: true };

  } catch (err) {
    console.error("Email send failed:", err);
    return { success: false, error: err };
  }
}