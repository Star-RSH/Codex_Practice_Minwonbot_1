import test from "node:test";
import assert from "node:assert/strict";

import { buildFaqSearchPayload } from "../lib/faq-search-service.mjs";

test("buildFaqSearchPayload validates blank query", async () => {
  const payload = await buildFaqSearchPayload("   ", {
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_key" },
  });

  assert.equal(payload.status, 400);
});

test("buildFaqSearchPayload returns rpc results", async () => {
  const payload = await buildFaqSearchPayload("\ubcf4\ud5d8\uae08\uc740 \uc5b4\ub5bb\uac8c \uccad\uad6c\ud558\ub098\uc694?", {
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_key" },
    limit: 3,
    domain: "\ubcf4\ud5d8",
    fetchImpl: async () => ({
      ok: true,
      async json() {
        return [
          {
            id: 1,
            faq_domain: "insurance",
            resolved_domain: "insurance",
            category: "\ubcf4\ud5d8\uae08\uccad\uad6c",
            question: "\ubcf4\ud5d8\uae08\uc740 \uc5b4\ub5bb\uac8c \uccad\uad6c\ud558\ub098\uc694?",
            score: 17,
            match_reason: "exact_question",
          },
        ];
      },
    }),
  });

  assert.equal(payload.status, 200);
  assert.equal(payload.body.requestedDomain, "insurance");
  assert.equal(payload.body.resolvedDomain, "insurance");
  assert.equal(payload.body.count, 1);
  assert.equal(payload.body.results[0].id, 1);
});
