// Vercel serverless proxy → ElevenLabs Text-to-Speech.
// Keeps the ElevenLabs API key hidden (read from env var ELEVENLABS_API_KEY).
// Request body: { text: "...", voiceId: "..." }
// Returns: audio/mpeg bytes.

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing ELEVENLABS_API_KEY" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const text = (body.text || "").slice(0, 800); // safety cap to protect your quota
    const voiceId = body.voiceId || "pNInz6obpgDQGcFmaJgB"; // default (Adam)
    if (!text.trim()) return res.status(400).json({ error: "No text" });

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2", // higher quality, more natural
          voice_settings: { stability: 0.45, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true },
        }),
      }
    );

    if (!upstream.ok) {
      const errText = await upstream.text();
      return res.status(upstream.status).json({ error: "ElevenLabs error", detail: errText.slice(0, 300) });
    }

    const arrayBuf = await upstream.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(arrayBuf));
  } catch (err) {
    return res.status(500).json({ error: "Proxy error", detail: String(err.message || err) });
  }
}
