import { http, HttpResponse } from "msw";

/**
 * Default MSW handlers used by every test. Individual tests can layer
 * additional or overriding handlers via `server.use(...)`.
 *
 * Strategy: handlers here return generic success payloads so a test that
 * happens to make an unrelated external call doesn't fail. Tests that
 * assert on a specific external interaction should override the handler.
 */
export const handlers = [
  // OpenAI Responses API (text + vision)
  http.post("https://api.openai.com/v1/responses", async () => {
    return HttpResponse.json({
      id: "resp_test",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: "Stub OpenAI response." }],
        },
      ],
    });
  }),

  // OpenAI image generation
  http.post("https://api.openai.com/v1/images/generations", async () => {
    return HttpResponse.json({
      created: Date.now(),
      data: [{ b64_json: "AAAA" }],
    });
  }),

  // Etsy Open API v3 — base
  http.all("https://openapi.etsy.com/v3/*", async () => {
    return HttpResponse.json({ ok: true });
  }),

  // Retrospectiva website revalidate endpoint
  http.post("https://retrospectiva.example/api/revalidate", async () => {
    return HttpResponse.json({ revalidated: true });
  }),
];
