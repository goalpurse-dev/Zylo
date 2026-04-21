import { buildOpenAIRequest } from "../src/lib/scriptPrompt.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  const { form, stylePreset } = req.body;
  if (!form || !stylePreset) {
    return res.status(400).json({ error: "Missing form or stylePreset" });
  }

  try {
    const body = buildOpenAIRequest(form, stylePreset);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: `OpenAI error ${response.status}: ${err}` });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: "OpenAI returned empty content" });

    const script = JSON.parse(raw);

    if (!script.meta.presetIcon && stylePreset?.icon) {
      script.meta.presetIcon = stylePreset.icon;
    }

    return res.status(200).json(script);
  } catch (err) {
    console.error("generate-script error:", err);
    return res.status(500).json({ error: err.message || "Internal error" });
  }
}
