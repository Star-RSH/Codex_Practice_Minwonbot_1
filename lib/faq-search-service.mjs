import { containsSensitivePattern, loadDotEnv, normalizeFaqDomain } from "./answer-service.mjs";

const MSG_EMPTY_QUERY = "\uac80\uc0c9\uc5b4\ub97c \uba3c\uc800 \uc785\ub825\ud574 \uc8fc\uc138\uc694.";
const MSG_SENSITIVE = "\uac1c\uc778\uc815\ubcf4\ub85c \ubcf4\uc77c \uc218 \uc788\ub294 \uc22b\uc790\ub294 \uc785\ub825\ud558\uc9c0 \ub9d0\uc544 \uc8fc\uc138\uc694.";
const MSG_SUPABASE_MISSING = "Supabase \ud658\uacbd\ubcc0\uc218\uac00 \uc124\uc815\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4.";
function clampLimit(value) {
  const parsed = Number.parseInt(value ?? "5", 10);
  if (Number.isNaN(parsed)) {
    return 5;
  }
  return Math.min(Math.max(parsed, 1), 20);
}

async function fetchFaqSearchResults(query, limit, domain, env, fetchImpl) {
  const url = new URL("/rest/v1/rpc/search_faqs", env.SUPABASE_URL);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      search_query: query,
      match_count: limit,
      requested_domain: domain,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase faq search failed with ${response.status}`);
  }

  return response.json();
}

export async function buildFaqSearchPayload(query, options = {}) {
  loadDotEnv();

  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const normalizedQuery = String(query ?? "").trim();
  const limit = clampLimit(options.limit);
  const domain = normalizeFaqDomain(options.domain);

  if (!normalizedQuery) {
    return { status: 400, body: { error: MSG_EMPTY_QUERY } };
  }

  if (containsSensitivePattern(normalizedQuery)) {
    return { status: 400, body: { error: MSG_SENSITIVE } };
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return { status: 500, body: { error: MSG_SUPABASE_MISSING } };
  }

  const results = await fetchFaqSearchResults(normalizedQuery, limit, domain, env, fetchImpl);
  return {
    status: 200,
    body: {
      query: normalizedQuery,
      requestedDomain: domain,
      resolvedDomain: Array.isArray(results) && results[0] ? results[0].resolved_domain ?? results[0].faq_domain ?? null : null,
      count: Array.isArray(results) ? results.length : 0,
      results: Array.isArray(results) ? results : [],
    },
  };
}
