export function welcomeEmail(userEmail) {
  return {
    from: "Zyvo <updates@tryzyvo.com>",
    to: userEmail,
    subject: "Welcome to Zyvo 🚀 Your AI creator workspace is ready",

    html: `
    <div style="font-family:Arial, sans-serif;max-width:600px;margin:auto;padding:20px">

    <h1 style="color:#111">Welcome to Zyvo 🚀</h1>

    <p>Your AI creator workspace is now ready.</p>

    <p>With Zyvo you can instantly generate:</p>

    <ul>
      <li>AI images</li>
      <li>AI videos</li>
      <li>Product photos</li>
      <li>Viral social media content</li>
    </ul>

    <h3>Try one of these prompts:</h3>

    <ul>
      <li>"Luxury product photo with cinematic lighting"</li>
      <li>"Anime character in neon cyberpunk city"</li>
      <li>"Ultra realistic portrait photography"</li>
    </ul>

    <div style="text-align:center;margin-top:30px">
      <a href="https://tryzyvo.com/workspace?source=welcome">
      style="background:#7A3BFF;color:white;padding:14px 28px;
      text-decoration:none;border-radius:8px;font-weight:bold;font-size:16px">
      Open Zyvo Workspace
      </a>
    </div>

    <p style="margin-top:30px;color:#666">
    If you have feedback or something doesn't work, just reply to this email.
    </p>

    <p style="color:#666">— Zyvo Founder</p>

    </div>
    `
  };
}