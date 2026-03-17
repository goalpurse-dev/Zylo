export function CustomerEmail({ email }) {
  return {
    subject: "You were one step away from Zyvo AI 🚀",

    html: `
      <div style="font-family: Arial, sans-serif; background:#0B0E1A; padding:40px; color:#ffffff;">
        
        <div style="max-width:520px; margin:0 auto; background:#111428; border-radius:16px; padding:32px; border:1px solid rgba(122,59,255,0.3);">
          
          <h1 style="font-size:24px; margin-bottom:12px;">
            You were one step away...
          </h1>

          <p style="color:#A0A3BD; font-size:14px; line-height:1.6;">
            You almost became a <strong style="color:#7A3BFF;">Zyvo AI creator</strong> — but didn’t finish checkout.
          </p>

          <p style="color:#A0A3BD; font-size:14px; line-height:1.6; margin-top:16px;">
            Since then, we’ve dropped <strong style="color:#ffffff;">new AI video models</strong> designed to help you go viral faster than ever.
          </p>

          <ul style="margin-top:16px; padding-left:18px; color:#A0A3BD; font-size:14px;">
            <li>⚡ Faster video generation</li>
            <li>🎬 Cinematic quality outputs</li>
            <li>📱 Built for TikTok, Reels & Shorts</li>
          </ul>

          <p style="color:#A0A3BD; font-size:14px; margin-top:20px;">
            You’re still one click away.
          </p>

          <a href="https://tryzyvo.com/workspace/pricing" 
             style="
              display:inline-block;
              margin-top:20px;
              padding:14px 20px;
              background:#7A3BFF;
              color:#fff;
              text-decoration:none;
              border-radius:10px;
              font-weight:bold;
              font-size:14px;
              box-shadow:0 0 20px rgba(122,59,255,0.4);
             ">
            Continue Checkout →
          </a>

          <p style="color:#6B6F9C; font-size:12px; margin-top:24px;">
            Don’t miss this. Creators are already using Zyvo to generate viral content daily.
          </p>

        </div>

        <p style="text-align:center; font-size:11px; color:#555; margin-top:20px;">
          Zyvo AI • Create content that wins
        </p>

      </div>
    `,
  };
}