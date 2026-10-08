// Vercel Function: read a credit card statement's text with Gemini when the on-device
// parser can't. Opt-in from the app, signed-in users only. The text arrives with long
// numbers / emails already masked by the client; we mask again here and never store it.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FIREBASE_WEB_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyCWqsgTU6UW_ndXQeQlbubAqDBzuIGbeR4";
const MAX_CHARS = 60_000;

const SYSTEM = `You extract transactions from the text of a credit card statement.
Return every individual transaction line exactly once. Do not include summary lines
(opening/closing balance, total due, minimum due, credit limit, reward point summaries).
- date: YYYY-MM-DD. Infer the year from the statement period if rows omit it.
- description: the merchant/description text as printed (trimmed).
- amount: positive number in the statement's billing currency (use the billed INR amount for foreign spends).
- direction: "credit" for payments, refunds, cashback, reversals (marked Cr, CR, C, +, minus or in brackets); otherwise "debit".`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    txs: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" },
          description: { type: "STRING" },
          amount: { type: "NUMBER" },
          direction: { type: "STRING", enum: ["debit", "credit"] },
        },
        required: ["date", "description", "amount", "direction"],
      },
    },
  },
  required: ["txs"],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const mask = (t: string) =>
  t
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[id]")
    .replace(/\d[\d -]{8,}\d/g, (m) => (m.replace(/\D/g, "").length >= 9 ? "[number]" : m));

async function verifyUser(req: Request): Promise<string | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_WEB_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: token }),
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { users?: { localId: string }[] };
  return data.users?.[0]?.localId ?? null;
}

export async function POST(req: Request): Promise<Response> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return json(503, { error: "AI isn't configured yet (GEMINI_API_KEY missing on the server)." });
  const uid = await verifyUser(req).catch(() => null);
  if (!uid) return json(401, { error: "Sign in with Google to use the AI statement reader." });

  let body: { text?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return json(400, { error: "Bad request" });
  }
  if (typeof body.text !== "string" || body.text.trim().length < 20) return json(400, { error: "No statement text" });
  const text = mask(body.text).slice(0, MAX_CHARS);

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: `Statement text:\n${text}` }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA },
    }),
  });
  if (!r.ok) {
    console.error("gemini error", r.status, (await r.text().catch(() => "")).slice(0, 500));
    return json(502, { error: r.status === 429 ? "AI is busy right now — try again in a minute." : "AI request failed." });
  }
  const data = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const out = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    const parsed = JSON.parse(out) as { txs: unknown[] };
    return json(200, { txs: Array.isArray(parsed.txs) ? parsed.txs : [] });
  } catch {
    return json(502, { error: "AI returned an unexpected response." });
  }
}
