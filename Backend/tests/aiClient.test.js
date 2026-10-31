import test from "node:test";
import assert from "node:assert/strict";
import askAI from "../utils/aiClient.js";

const originalFetch = global.fetch;
const originalEnv = { AI_BASE_URL: process.env.AI_BASE_URL, AI_API_KEY: process.env.AI_API_KEY, AI_MODEL: process.env.AI_MODEL };

test("AI client returns the model message from a valid provider response", async () => {
  process.env.AI_BASE_URL = "https://provider.example/v1";
  process.env.AI_API_KEY = "test-key";
  process.env.AI_MODEL = "test-model";
  global.fetch = async (url, options) => {
    assert.equal(url, "https://provider.example/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-key");
    return new Response(JSON.stringify({ choices: [{ message: { content: "{\\\"ok\\\":true}" } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  assert.equal(await askAI("system", "prompt"), "{\\\"ok\\\":true}");
});

test("AI client rejects Cloudflare HTML without exposing its script body", async () => {
  global.fetch = async () => new Response("<html><script>window._cf_chl_opt='secret challenge'</script></html>", { status: 200, headers: { "content-type": "text/html" } });
  await assert.rejects(() => askAI("system", "prompt"), error => {
    assert.match(error.message, /security challenge page/);
    assert.doesNotMatch(error.message, /secret challenge|script/);
    return true;
  });
});

test("AI client maps provider quota errors to a safe message", async () => {
  global.fetch = async () => new Response("provider internal payload", { status: 429, headers: { "content-type": "text/plain" } });
  await assert.rejects(() => askAI("system", "prompt"), /rate limit or quota/);
});

test.after(() => {
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
