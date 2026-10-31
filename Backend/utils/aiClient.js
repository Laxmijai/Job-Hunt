// Shared OpenAI-compatible AI client. Provider responses are validated before
// they reach controllers so HTML/challenge pages never leak into the UI.
const safeProviderMessage = (status) => {
  if (status === 401 || status === 403) return "The AI provider rejected the configured credentials. Check the AI API key and account permissions.";
  if (status === 429) return "The AI provider rate limit or quota has been reached. Please try again later.";
  if (status >= 500) return "The AI provider is temporarily unavailable. Please try again shortly.";
  return "The AI provider could not process this request. Please check the provider configuration.";
};

const askAI = async (systemPrompt, userPrompt) => {
  const baseUrl = process.env.AI_BASE_URL?.trim();
  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!baseUrl || !apiKey || !model) throw new Error("AI service is not configured. Add AI_BASE_URL, AI_API_KEY and AI_MODEL to the backend environment.");

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const endpoint = normalizedBase.endsWith("/chat/completions") ? normalizedBase : `${normalizedBase}/chat/completions`;
  const timeoutMs = Math.max(5000, Number(process.env.AI_TIMEOUT_MS) || 30000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        body: JSON.stringify({ model, temperature: 0.2, max_tokens: Math.max(300, Number(process.env.AI_MAX_TOKENS) || 1800), messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }] }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The AI provider took too long to respond. Please try again.");
      throw new Error("Could not connect to the configured AI provider. Check AI_BASE_URL and try again.");
    }

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const preview = raw.trim().slice(0, 500).toLowerCase();
    const looksLikeHtml = contentType.includes("text/html") || /^(<!doctype html|<html|<head|<script)/i.test(preview) || preview.includes("cf-chl-") || preview.includes("cloudflare");
    if (looksLikeHtml) throw new Error("The AI provider returned a security challenge page instead of an AI response. Check the configured provider URL or contact the provider.");
    if (!response.ok) throw new Error(safeProviderMessage(response.status));
    if (!contentType.includes("application/json") && !raw.trim().startsWith("{")) throw new Error("The AI provider returned an unsupported response format.");

    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("The AI provider returned invalid JSON. Please try again."); }
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error(data?.error ? "The AI provider reported an error. Please check your provider account and model settings." : "The AI provider returned an empty response. Please try again.");
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
};
export default askAI;
