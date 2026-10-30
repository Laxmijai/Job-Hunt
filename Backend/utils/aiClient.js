// Small helper to talk to the AI model (clod.io - OpenAI compatible API).
// We only use it for job recommendations right now.

const askAI = async (systemPrompt, userPrompt) => {
  const baseUrl = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!baseUrl || !apiKey || !model) {
    throw new Error("AI config missing in .env (AI_BASE_URL / AI_API_KEY / AI_MODEL)");
  }

  // don't let a slow AI call hang the request - give up after 8s
  const controller = new AbortController();
  const timeoutMs = Math.max(5000, Number(process.env.AI_TIMEOUT_MS) || 20000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: Math.max(200, Number(process.env.AI_MAX_TOKENS) || 1400),
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || "";
  } finally {
    clearTimeout(timeout);
  }
};

export default askAI;
