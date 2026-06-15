import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAnswerPayload,
  containsSensitivePattern,
  detectEscalationReason,
  fitHashingNaiveBayes,
  predictTopCategories,
  rankFaqs,
} from "../lib/answer-service.mjs";

const CAT_CLAIM = "\ubcf4\ud5d8\uae08 \uccad\uad6c";
const Q_CLAIM = "\ubcf4\ud5d8\uae08\uc740 \uc5b4\ub5bb\uac8c \uccad\uad6c\ud558\ub098\uc694?";
const A_CLAIM = "\uc571 \ub610\ub294 \ucf5c\uc13c\ud130\uc5d0\uc11c \uccad\uad6c\ud560 \uc218 \uc788\uace0 \ud544\uc694 \uc11c\ub958\ub97c \uc81c\ucd9c\ud558\uba74 \ub429\ub2c8\ub2e4.";
const CAT_BILLING = "\uc774\uc6a9\ub300\uae08";
const Q_BILLING = "\uc774\uc758\uc2e0\uccad\ud558\uba74 \uc5bc\ub9c8\ub97c \ub3cc\ub824\ubc1b\ub098\uc694?";
const A_BILLING = "\ud658\uae09 \uae08\uc561\uc740 \uac1c\ubcc4 \uc2ec\uc0ac \uacb0\uacfc\uc5d0 \ub530\ub77c \ub2ec\ub77c \uc0c1\ub2f4\uc0ac \ud655\uc778\uc774 \ud544\uc694\ud569\ub2c8\ub2e4.";
const CAT_COMPLAINT = "\ubbfc\uc6d0 \uc811\uc218";
const Q_COMPLAINT = "\ubd88\ub9cc \uc0ac\ud56d\uc744 \uc815\uc2dd\uc73c\ub85c \uc811\uc218\ud558\uace0 \uc2f6\uc5b4\uc694.";
const A_COMPLAINT = "\uace0\uac1d\uc13c\ud130 \ub610\ub294 \ubbfc\uc6d0 \uc811\uc218 \uba54\ub274\uc5d0\uc11c \uc811\uc218\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4.";
const CAT_LOST = "\ubd84\uc2e4/\ud574\uc81c";
const CAT_LIMIT = "\uc774\uc6a9\ud55c\ub3c4";
const Q_LOST_1 = "\uce74\ub4dc \uc815\uc9c0 \ud574\uc81c\ub294 \uc5b4\ub5bb\uac8c \ud558\ub098\uc694";
const Q_LOST_2 = "\ubd84\uc2e4 \uce74\ub4dc \ud574\uc81c \uc694\uccad \ubc29\ubc95\uc774 \uad81\uae08\ud574\uc694";
const Q_LIMIT_1 = "\uce74\ub4dc \ud55c\ub3c4\ub97c \uc62c\ub9ac\uace0 \uc2f6\uc5b4\uc694";
const Q_LIMIT_2 = "\uc774\uc6a9 \ud55c\ub3c4 \uc99d\uc561\uc774 \uac00\ub2a5\ud55c\uac00\uc694";
const Q_LOST_PREDICT = "\uce74\ub4dc \uc815\uc9c0 \ud574\uc81c \ubc29\ubc95\uc774 \uad81\uae08\ud574\uc694";

const faqs = [
  { id: 1, category: CAT_CLAIM, question: Q_CLAIM, answer: A_CLAIM, source: "AIHub(sample-1)" },
  { id: 2, category: CAT_BILLING, question: Q_BILLING, answer: A_BILLING, source: "AIHub(sample-2)" },
  { id: 3, category: CAT_COMPLAINT, question: Q_COMPLAINT, answer: A_COMPLAINT, source: "AIHub(sample-3)" },
];

test("containsSensitivePattern detects resident-like or long digit strings", () => {
  assert.equal(containsSensitivePattern("900101-1234567"), true);
  assert.equal(containsSensitivePattern("1234567890"), true);
  assert.equal(containsSensitivePattern(Q_CLAIM), false);
});

test("detectEscalationReason flags amount and coverage confirmation questions", () => {
  assert.equal(detectEscalationReason(Q_BILLING), "amount");
  assert.equal(detectEscalationReason("\uacb0\uc81c\uc77c\uc740 \uc5b8\uc81c\uc778\uac00\uc694?"), "amount");
  assert.equal(detectEscalationReason("\ud55c\ub3c4\ub97c \uc62c\ub9b4 \uc218 \uc788\ub098\uc694?"), "amount");
  assert.equal(detectEscalationReason("\uc774 \ud2b9\uc57d\uc774 \ubcf4\uc7a5\ub418\ub098\uc694?"), "coverage");
  assert.equal(detectEscalationReason(Q_CLAIM), null);
});

test("rankFaqs returns the most relevant FAQ first for matching questions", () => {
  const ranked = rankFaqs(Q_CLAIM, faqs);
  assert.equal(ranked[0].id, 1);
  assert.ok(ranked[0].score > ranked[1].score);
});

test("rankFaqs still returns a relevant FAQ for complaint intake wording", () => {
  const ranked = rankFaqs("\ubbfc\uc6d0\uc744 \uc811\uc218\ud558\uace0 \uc2f6\uc5b4\uc694", faqs);
  assert.equal(ranked[0].id, 3);
});

test("predictTopCategories selects the closest category with hashing naive bayes", () => {
  const model = fitHashingNaiveBayes(
    [
      [CAT_LOST, Q_LOST_1],
      [CAT_LOST, Q_LOST_2],
      [CAT_LIMIT, Q_LIMIT_1],
      [CAT_LIMIT, Q_LIMIT_2],
    ],
    { numFeatures: 1024, ngramRange: [2, 4] },
  );

  const predicted = predictTopCategories(model, Q_LOST_PREDICT, 1);
  assert.deepEqual(predicted, [CAT_LOST]);
});

test("buildAnswerPayload keeps manual domain selection in sync with rpc search", async () => {
  const fetchCalls = [];
  const payload = await buildAnswerPayload(Q_CLAIM, {
    domain: "보험",
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_key" },
    fetchImpl: async (url) => {
      const href = String(url);
      fetchCalls.push(href);
      assert.match(href, /faq_domain=eq\.insurance/);
      return {
        ok: true,
        async json() {
          return [
            {
              id: 1,
              faq_domain: "insurance",
              category: CAT_CLAIM,
              question: Q_CLAIM,
              answer: A_CLAIM,
              source: "AIHub(sample-1)",
            },
          ];
        },
      };
    },
  });

  assert.equal(payload.status, 200);
  assert.equal(payload.body.requestedDomain, "insurance");
  assert.equal(payload.body.resolvedDomain, "insurance");
  assert.equal(payload.body.faqs[0].faq_domain, "insurance");
  assert.ok(fetchCalls.length >= 1);
  assert.ok(fetchCalls.some((href) => href.includes("faq_domain=eq.insurance")));
});

test("buildAnswerPayload falls back to all FAQs when category-first results are insufficient", async () => {
  const payload = await buildAnswerPayload(Q_CLAIM, {
    env: { SUPABASE_URL: "https://example.supabase.co", SUPABASE_PUBLISHABLE_KEY: "sb_key" },
    fetchImpl: async (url) => {
      const href = String(url);
      const isCategoryFirst = href.includes("category=in.");
      return {
        ok: true,
        async json() {
          if (isCategoryFirst) {
            return [
              {
                id: 1,
                faq_domain: "insurance",
                category: CAT_CLAIM,
                question: Q_CLAIM,
                answer: A_CLAIM,
                source: "AIHub(sample-1)",
              },
            ];
          }

          return [
            {
              id: 1,
              faq_domain: "insurance",
              category: CAT_CLAIM,
              question: Q_CLAIM,
              answer: A_CLAIM,
              source: "AIHub(sample-1)",
            },
            {
              id: 4,
              faq_domain: "insurance",
              category: CAT_CLAIM,
              question: "보험금 청구 서류는 무엇인가요?",
              answer: "청구서와 신분증 사본 등 기본 서류를 제출합니다.",
              source: "AIHub(sample-4)",
            },
            {
              id: 5,
              faq_domain: "insurance",
              category: CAT_CLAIM,
              question: "보험금 청구 접수는 어디에서 하나요?",
              answer: "앱, 홈페이지 또는 콜센터로 접수할 수 있습니다.",
              source: "AIHub(sample-5)",
            },
          ];
        },
      };
    },
  });

  assert.equal(payload.status, 200);
  assert.equal(payload.body.faqs.length, 3);
  assert.equal(payload.body.fallbackToAllFaqs, true);
  assert.ok((payload.body.categoryFirstCount ?? 0) >= 0);
});

test("buildAnswerPayload returns retry message when BizRouter fails", async () => {
  const payload = await buildAnswerPayload(Q_CLAIM, {
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_key",
      BIZROUTER_API_KEY: "secret",
    },
    fetchImpl: async (url) => {
      const href = String(url);
      if (href.includes("/chat/completions")) {
        throw new Error("network down");
      }

      return {
        ok: true,
        async json() {
          return [
            {
              id: 1,
              faq_domain: "insurance",
              category: CAT_CLAIM,
              question: Q_CLAIM,
              answer: A_CLAIM,
              source: "AIHub(sample-1)",
            },
          ];
        },
      };
    },
  });

  assert.equal(payload.status, 200);
  assert.equal(payload.body.answer, "\uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.");
  assert.equal(payload.body.escalate, true);
});
