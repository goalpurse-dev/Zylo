export function welcomeEmail(userEmail) {
  return {
    from: "Niko from Zyvo <niko@tryzyvo.com>",
    to: userEmail,
    subject: "You’ve got 3 free image generations waiting",
    html: `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#0f1117;color:white;border-radius:16px">
      <h1 style="color:white;margin-bottom:12px;">Welcome to Zyvo 🚀</h1>

      <p style="color:#d1d5db;font-size:16px;line-height:1.6;">
        Your AI creator workspace is ready.
      </p>

      <p style="color:#d1d5db;font-size:16px;line-height:1.6;">
        You currently have <b>3 free image generations</b> waiting for you — use them to create scroll-stopping content in seconds.
      </p>

      <p style="color:#d1d5db;font-size:16px;line-height:1.6;">
        Inside Zyvo, you can generate:
      </p>

      <ul style="color:#d1d5db;line-height:1.8;padding-left:20px;">
        <li>AI images</li>
        <li>AI videos</li>
        <li>Product photos</li>
        <li>Viral content for TikTok, Reels and Shorts</li>
      </ul>

      <p style="color:#d1d5db;font-size:16px;line-height:1.6;">
        Try one of these:
      </p>

      <ul style="color:#d1d5db;line-height:1.8;padding-left:20px;">
        <li>"Luxury product photo with cinematic lighting"</li>
        <li>"Anime character in neon cyberpunk city"</li>
        <li>"Ultra realistic portrait photography"</li>
      </ul>

      <div style="text-align:center;margin:32px 0;">
        <a
          href="https://tryzyvo.com/workspace?source=welcome"
          style="background:#7A3BFF;color:white;padding:14px 28px;text-decoration:none;border-radius:10px;font-weight:bold;font-size:16px;display:inline-block;"
        >
          Use My Free Generations
        </a>
      </div>

      <p style="color:#9ca3af;font-size:15px;line-height:1.6;">
        Need more images, video generations, and higher limits later? You can upgrade to Starter anytime inside Zyvo.
      </p>

      <p style="margin-top:28px;color:#9ca3af;font-size:14px;">
        Just reply if you need help — I read these myself.
      </p>

      <p style="color:#9ca3af;font-size:14px;">
        — Niko, Founder of Zyvo
      </p>
    </div>
    `
  };
}