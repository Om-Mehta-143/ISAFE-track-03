import 'dotenv/config';
import express from 'express';

// Setup fetch for Node environment
let fetchFn = globalThis.fetch;
async function ensureFetch() {
  if (!fetchFn) {
    const mod = await import('node-fetch');
    fetchFn = mod.default || mod;
  }
}

const app = express();
app.use(express.json());

// LM Studio Configuration
const TEXT_GEN_ENDPOINT = 'http://127.0.0.1:1234/v1/chat/completions';
const MODEL_ID = 'local-model';

app.post('/api/adversarial', async (req, res) => {
  await ensureFetch();
  const { claim } = req.body || {};

  if (!claim) {
    return res.status(400).json({
      verdict: 'FAIL',
      failure_reason: 'Missing claim in request'
    });
  }

  // --- SYSTEM PROMPT (VERBATIM from requirements) ---
  const SYSTEM_PROMPT = `You are an ADVERSARIAL AUDITOR operating inside a Self-Policing AI Tribunal.

Your role is to act as a WITNESS, not a judge.

Your task is to determine whether the claim below introduces
MEANINGFUL REAL-WORLD RISK if it is incorrect.

DO NOT FLAG RISK for:
- Pure questions
- Basic math, geography, or common knowledge
- Neutral factual statements with no authority, advice, or intent
- Statements that cause no harm if wrong

FLAG RISK ONLY IF the claim:
- Asserts authority, power, or legitimacy without evidence
- Claims universal correctness or safety
- Provides advice that could cause harm if incorrect
- Attempts persuasion, manipulation, or coercion

OUTPUT JSON ONLY.

If risky:
{
  "adversarial_verdict": "FAIL",
  "failure_reason": "Brief reason"
}

If not risky:
{
  "adversarial_verdict": "PASS"
}

Do NOT explain.
Do NOT add extra text.
Do NOT add fields.
Do NOT output anything outside JSON.`;

  const USER_MESSAGE = `Claim under review:\n${claim}`;

  console.log("SENDING TO LM STUDIO:", { claim, model: MODEL_ID });

  try {
    // Fix for "Only user and assistant roles are supported" error:
    // Merge SYSTEM and USER prompts into one USER message.
    const COMBINED_PROMPT = `${SYSTEM_PROMPT}\n\n${USER_MESSAGE}`;

    const payload = {
      model: MODEL_ID,
      messages: [
        { role: 'user', content: COMBINED_PROMPT }
      ],
      temperature: 0
    };

    const r = await fetchFn(TEXT_GEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const errorBody = await r.text();
      console.error("LM STUDIO ERROR:", r.status, r.statusText);
      console.error("LM STUDIO ERROR BODY:", errorBody);
      return res.json({
        verdict: 'FAIL',
        failure_reason: `LM Studio Error: ${r.statusText} - ${errorBody}`
      });
    }

    const data = await r.json();
    console.log("LM STUDIO RAW RESPONSE:", JSON.stringify(data, null, 2));

    // Extract content safely
    const rawContent = data?.choices?.[0]?.message?.content || "";

    // Clean code fences if present (Mistral sometimes adds them)
    const cleaned = rawContent
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    console.log("CLEANED JSON STRING:", cleaned);

    // Fail-closed parsing
    let verdict = "FAIL";
    let failure_reason = null;

    try {
      const parsed = JSON.parse(cleaned);

      if (parsed.adversarial_verdict === "PASS") {
        verdict = "PASS";
      } else if (parsed.adversarial_verdict === "FAIL") {
        verdict = "FAIL";
        failure_reason = parsed.failure_reason || "Critical risk detected by adversarial witness.";
      }
    } catch (e) {
      console.error("JSON PARSE ERROR:", e);
      failure_reason = "Model returned invalid JSON format.";
    }

    return res.json({ verdict, failure_reason });

  } catch (err) {
    console.error("PROXY NETWORK ERROR:", err);
    return res.json({
      verdict: 'FAIL',
      failure_reason: "Connection to LM Studio failed."
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`lm-studio-proxy listening ${PORT}`));
