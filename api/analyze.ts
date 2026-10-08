// Vercel Function: AI money analysis via Gemini.
// The Gemini key lives only here (env GEMINI_API_KEY); the browser never sees it.
// Callers must be signed in: we verify their Firebase ID token so the endpoint can't be
// used as a free Gemini proxy by anyone who finds the URL.

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
// Public Firebase web key (same one shipped in the client) — only used to verify ID tokens.
const FIREBASE_WEB_KEY = process.env.FIREBASE_WEB_API_KEY || "AIzaSyCWqsgTU6UW_ndXQeQlbubAqDBzuIGbeR4";
const MAX_BODY = 32_000;

const SYSTEM = `You are Kosh, a friendly, practical personal-finance coach inside a money-tracking app.
You receive a JSON summary of one person's finances (aggregated totals only) and optionally a question.
Rules:
- Use ONLY numbers present in the data. Never invent figures. Format money in the given currency.
- Be specific: name categories, months, goals and amounts from the data.
- "balance" is spendable money; "inGoals" is money set aside in savings goals.
- Savings rate = (income - expense) / income for a month.
- Keep each insight to 1-2 short sentences. Plain language, no jargon, no disclaimers.
- kind: "good" for something going well, "warning" for a risk (overspending, budget breach, goal off-track, overdue loans), "tip" for an idea.
- actions: 2-4 concrete next steps with amounts where possible (e.g. "Move ₹3,000 to Emergency fund on payday").
- score: 0-100 overall financial health from savings rate, budget adherence, goal progress and debts.
- If a question is given, answer it directly in "answer" (2-5 sentences) using the data; otherwise set "answer" to "".
- If there's too little data, say so kindly and suggest what to log.`;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    headline: { type: "STRING" },
    score: { type: "INTEGER" },
    insights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          detail: { type: "STRING" },
          kind: { type: "STRING", enum: ["good", "warning", "tip"] },
        },
        required: ["title", "detail", "kind"],
      },
    },
    actions: { type: "ARRAY", items: { type: "STRING" } },
    answer: { type: "STRING" },
  },
  required: ["headline", "score", "insights", "actions", "answer"],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

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
  if (!uid) return json(401, { error: "Sign in with Google to use AI analysis." });

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json(413, { error: "Too much data to analyse." });
  let body: { summary?: unknown; question?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "Bad request" });
  }
  if (!body.summary || typeof body.summary !== "object") return json(400, { error: "Missing summary" });
  const question = typeof body.question === "string" ? body.question.trim().slice(0, 400) : "";

  const prompt = `Financial summary (JSON):\n${JSON.stringify(body.summary)}\n\n${
    question ? `Question from the user: ${question}` : "No question — give a general analysis."
  }`;

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: "application/json", responseSchema: SCHEMA },
    }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    console.error("gemini error", r.status, detail.slice(0, 500));
    return json(502, { error: r.status === 429 ? "AI is busy right now — try again in a minute." : "AI request failed." });
  }
  const data = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  try {
    return json(200, { ...JSON.parse(text), model: MODEL });
  } catch {
    return json(502, { error: "AI returned an unexpected response." });
  }
}
