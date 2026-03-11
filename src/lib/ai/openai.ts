import "server-only";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 8000;

export type OpenAiExplainRequest = {
  prompt: string;
  canonicalSolution: string;
  explainInput: string;
};

function buildExplainMessages(input: OpenAiExplainRequest) {
  return [
    {
      role: "system",
      content:
        "You are a strict physics explanation evaluator. Return ONLY JSON with fields: state, reason, feedback, grounded_quotes. " +
        "State must be one of CORRECT, PARTIAL, INCORRECT, UNSCORABLE. Keep feedback concise and learner-friendly."
    },
    {
      role: "user",
      content:
        "Evaluate the learner explanation against canonical solution. " +
        "Use only the canonical solution and algebra-based kinematics basics.\n\n" +
        `Question:\n${input.prompt}\n\n` +
        `Canonical solution:\n${input.canonicalSolution}\n\n` +
        `Learner explanation:\n${input.explainInput}\n\n` +
        "Return strict JSON object with: " +
        `{"state":"...","reason":"...","feedback":"...","grounded_quotes":["..."]}`
    }
  ];
}

export async function requestOpenAiExplainEvaluation(
  request: OpenAiExplainRequest,
  timeoutMs = DEFAULT_TIMEOUT_MS
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("missing_openai_api_key");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: buildExplainMessages(request)
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      throw new Error(`openai_http_${res.status}`);
    }

    const payload = await res.json();
    const text = payload?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("openai_empty_content");
    }

    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

