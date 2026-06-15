import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultBizRouterModel = "openai/gpt-5.4-mini";
const defaultClassifierPath = path.join(projectRoot, "ml", "minwon_classifier_model.json");
const DOMAIN_ALIASES = new Map([
  ["insurance", "insurance"],
  ["보험", "insurance"],
  ["보험faq", "insurance"],
  ["card", "card"],
  ["카드", "card"],
  ["하나카드", "card"],
]);

const STOPWORDS = new Set([
  "",
  "\uc740",
  "\ub294",
  "\uc774",
  "\uac00",
  "\uc744",
  "\ub97c",
  "\uc5d0",
  "\uc758",
  "\ub3c4",
  "\ub85c",
  "\uc73c\ub85c",
  "\uc640",
  "\uacfc",
  "\uc880",
  "\ubb38\uc758",
  "\ubb38\uc758\uc694",
  "\uc548\ub0b4",
  "\ubd80\ud0c1",
  "\ud574\uc8fc\uc138\uc694",
  "\ud574\uc918",
  "\uc54c\ub824\uc918",
  "\uc54c\ub824\uc8fc\uc138\uc694",
  "\uc5b4\ub5bb\uac8c",
  "\ubb34\uc5c7",
  "\ubad4\uac00\uc694",
  "\uc788\uc5b4\uc694",
  "\uc788\ub098\uc694",
  "\ub418\ub098\uc694",
  "\uc778\uac00\uc694",
]);

const MSG_EMPTY_QUESTION = "\uc9c8\ubb38\uc744 \uba3c\uc800 \uc785\ub825\ud574 \uc8fc\uc138\uc694.";
const MSG_SENSITIVE = "\uac1c\uc778\uc815\ubcf4\ub85c \ubcf4\uc77c \uc218 \uc788\ub294 \uc22b\uc790\ub294 \uc785\ub825\ud558\uc9c0 \ub9d0\uc544 \uc8fc\uc138\uc694.";
const MSG_SUPABASE_MISSING = "Supabase \ud658\uacbd\ubcc0\uc218\uac00 \uc124\uc815\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4.";
const MSG_ESCALATE = "\uad00\ub828 FAQ\uac00 \uc5c6\uc5b4 \ucd94\uce21\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \ub2f4\ub2f9\uc790 \uc5f0\uacb0(1588-0000)\ub85c \uc9c4\ud589\ud574 \uc8fc\uc138\uc694. \uadfc\uac70: FAQ \uc5c6\uc74c";
const MSG_CONFIRM = "\ucc38\uace0\uc6a9 \uc548\ub0b4\uc785\ub2c8\ub2e4. \uae08\uc561, \uacb0\uc81c\uc77c, \ud55c\ub3c4, \ud658\uae09\uae08\ucc98\ub7fc \ub2ec\ub77c\uc9c8 \uc218 \uc788\ub294 \ub0b4\uc6a9\uc740 \uc0c1\ub2f4\uc0ac \ub610\ub294 \ub2f4\ub2f9\uc790 \ud655\uc778\uc73c\ub85c \uc9c4\ud589\ud574 \uc8fc\uc138\uc694.";
const MSG_RETRY = "\uc7a0\uc2dc \ud6c4 \ub2e4\uc2dc \uc2dc\ub3c4\ud574\uc8fc\uc138\uc694.";
const LABEL_GROUNDING = "\uadfc\uac70:";
const LABEL_CUSTOMER_QUESTION = "\uace0\uac1d \uc9c8\ubb38:";
const LABEL_CATEGORY = "\uce74\ud14c\uace0\ub9ac:";
const LABEL_QUESTION = "\uc9c8\ubb38:";
const LABEL_ANSWER = "\ub2f5\ubcc0:";
const LABEL_SOURCE = "\ucd9c\ucc98:";
const LABEL_FAQ_CONTEXT = "\ucc38\uace0 FAQ:";
const GUARDRAIL_ESCALATE = "\uc774 \uc9c8\ubb38\uc740 \uae08\uc561, \uacb0\uc81c\uc77c, \ud55c\ub3c4, \ud658\uae09\uae08, \ubcf4\uc7a5 \uc5ec\ubd80\ucc98\ub7fc \ud655\uc815 \ud310\ub2e8\uc774 \ud544\uc694\ud55c \ud56d\ubaa9\uc77c \uc218 \uc788\uc2b5\ub2c8\ub2e4. \ud655\uc815\ud558\ub294 \ub9d0 \ub300\uc2e0 '\ucc38\uace0\uc6a9 \uc548\ub0b4'\ub77c\uace0 \ubc1d\ud788\uace0 \uc0c1\ub2f4\uc0ac \ub610\ub294 \ub2f4\ub2f9\uc790 \ud655\uc778\uc73c\ub85c \uc548\ub0b4\ud558\uc138\uc694.";
const GUARDRAIL_GENERAL = "FAQ \uadfc\uac70\uac00 \ubd80\uc871\ud558\uac70\ub098 \uc5c6\uc73c\uba74 \ucd94\uce21\ud558\uc9c0 \ub9d0\uace0 '\ub2f4\ub2f9\uc790 \uc5f0\uacb0(1588-0000)'\ub85c \uc548\ub0b4\ud558\uc138\uc694.";
const SYSTEM_PROMPT = "\ub2f9\uc2e0\uc740 \uc0dd\uba85\ubcf4\ud5d8 \uad50\uc721\uc6a9 \ubbfc\uc6d0 \uc9c0\uc2dd\ubd07\uc785\ub2c8\ub2e4. \uacf5\uac1c\u00b7\uac00\uc0c1\u00b7\ub354\ubbf8 FAQ \ubc94\uc704 \uc548\uc5d0\uc11c\ub9cc \ucc38\uace0\uc6a9 \ub2f5\ubcc0\uc744 \uc791\uc131\ud558\uc138\uc694. \ub2f5\ubcc0\uc740 \uc26c\uc6b4 \ub9d0 2~4\ubb38\uc7a5\uc73c\ub85c \uc4f0\uace0, FAQ \uadfc\uac70\uac00 \uc5c6\uc73c\uba74 \ucd94\uce21\ud558\uc9c0 \ub9d0\uace0 '\ub2f4\ub2f9\uc790 \uc5f0\uacb0(1588-0000)'\ub85c \uc548\ub0b4\ud558\uc138\uc694. \uae08\uc561, \uacb0\uc81c\uc77c, \ud55c\ub3c4, \ud658\uae09\uae08, \ubcf4\uc7a5 \uc5ec\ubd80\ub294 \ud655\uc815\ud558\ub294 \ub9d0\uc744 \uc4f0\uc9c0 \ub9d0\uace0 '\ucc38\uace0\uc6a9 \uc548\ub0b4'\ub77c\uace0 \ubc1d\ud600\uc57c \ud569\ub2c8\ub2e4. \uac1c\uc778\uc815\ubcf4\ub97c \uc694\uad6c\ud558\uc9c0 \ub9d0\uace0, \ubaa8\ub4e0 \ub2f5\ubcc0 \ub05d\uc5d0\ub294 \ubc18\ub4dc\uc2dc '\uadfc\uac70: FAQ #\ubc88\ud638'\ub97c \ud3ec\ud568\ud558\uc138\uc694. JSON\ub9cc \ucd9c\ub825\ud558\uc138\uc694.";
const RESPONSE_FORMAT = '{"answer":"...","sources":[1,2],"escalate":false}';

let cachedClassifierModel;

function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeQuestion(text) {
  return String(text ?? "").replace(/\s+/gu, " ").trim();
}

function tokenize(text) {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

function compactForNgrams(text) {
  return normalizeQuestion(text).replace(/\s+/gu, "");
}

function charNgrams(text, ngramRange = [2, 4]) {
  const compact = compactForNgrams(text);
  const grams = [];

  for (let n = ngramRange[0]; n <= ngramRange[1]; n += 1) {
    if (compact.length < n) {
      continue;
    }
    for (let index = 0; index <= compact.length - n; index += 1) {
      grams.push(compact.slice(index, index + n));
    }
  }

  if (grams.length === 0 && compact) {
    grams.push(compact);
  }

  return grams;
}

function crc32(text) {
  let crc = 0 ^ -1;
  for (let index = 0; index < text.length; index += 1) {
    crc ^= text.charCodeAt(index);
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ -1) >>> 0;
}

function hashedCounts(text, numFeatures, ngramRange) {
  const counts = new Map();
  for (const gram of charNgrams(text, ngramRange)) {
    const index = crc32(gram) % numFeatures;
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  return counts;
}

function sanitizeEnvValue(value) {
  let nextValue = String(value ?? "").trim();
  const hashIndex = nextValue.indexOf(" #");
  if (hashIndex >= 0) {
    nextValue = nextValue.slice(0, hashIndex).trim();
  }
  if (
    (nextValue.startsWith('"') && nextValue.endsWith('"')) ||
    (nextValue.startsWith("'") && nextValue.endsWith("'"))
  ) {
    nextValue = nextValue.slice(1, -1).trim();
  }
  const markdownUrlMatch = nextValue.match(/^\[(.+?)\]\((.+?)\)$/u);
  if (markdownUrlMatch) {
    return markdownUrlMatch[2].trim();
  }
  return nextValue;
}

export function normalizeFaqDomain(domain) {
  if (!domain) {
    return null;
  }

  const normalized = String(domain).trim().toLowerCase();
  return DOMAIN_ALIASES.get(normalized) ?? null;
}

export function fitHashingNaiveBayes(rows, options = {}) {
  const numFeatures = options.numFeatures ?? 4096;
  const ngramRange = options.ngramRange ?? [2, 4];
  const classFeatureCounts = new Map();
  const classDocCounts = new Map();

  for (const [category, question] of rows) {
    classDocCounts.set(category, (classDocCounts.get(category) ?? 0) + 1);
    if (!classFeatureCounts.has(category)) {
      classFeatureCounts.set(category, new Float64Array(numFeatures));
    }
    const counts = hashedCounts(question, numFeatures, ngramRange);
    const target = classFeatureCounts.get(category);
    for (const [index, count] of counts.entries()) {
      target[index] += count;
    }
  }

  const totalDocs = rows.length || 1;
  const labels = [...classFeatureCounts.keys()].sort();
  const classLogPriors = {};
  const featureLogProbs = {};

  for (const label of labels) {
    const rawCounts = classFeatureCounts.get(label);
    let total = 0;
    const smoothed = new Array(numFeatures);
    for (let index = 0; index < numFeatures; index += 1) {
      const value = rawCounts[index] + 1;
      smoothed[index] = value;
      total += value;
    }
    classLogPriors[label] = Math.log((classDocCounts.get(label) ?? 1) / totalDocs);
    featureLogProbs[label] = smoothed.map((value) => Math.log(value / total));
  }

  return {
    num_features: numFeatures,
    ngram_range: ngramRange,
    labels,
    class_log_priors: classLogPriors,
    feature_log_probs: featureLogProbs,
  };
}

export function predictTopCategories(model, question, topK = 5) {
  return predictCategoryCandidates(model, question, topK).map((entry) => entry.label);
}

export function predictCategoryCandidates(model, question, topK = 5) {
  if (!model || !Array.isArray(model.labels) || model.labels.length === 0) {
    return [];
  }

  const numFeatures = model.num_features ?? 4096;
  const ngramRange = model.ngram_range ?? [2, 4];
  const counts = hashedCounts(question, numFeatures, ngramRange);

  return [...model.labels]
    .map((label) => {
      let score = model.class_log_priors?.[label] ?? Number.NEGATIVE_INFINITY;
      const logProbs = model.feature_log_probs?.[label] ?? [];
      for (const [index, count] of counts.entries()) {
        score += count * (logProbs[index] ?? -50);
      }
      return { label, score };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, topK);
}

function isCategoryPredictionAmbiguous(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return true;
  }
  if (candidates.length === 1) {
    return false;
  }

  const [top, second] = candidates;
  return !Number.isFinite(top.score) || !Number.isFinite(second.score) || top.score - second.score < 1.2;
}

function normalizeSearchToken(token) {
  return String(token ?? "")
    .replace(/[,*()]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function buildSearchTerms(question) {
  const normalizedQuestion = normalizeQuestion(question);
  const uniqueTerms = new Set();

  if (normalizedQuestion.length >= 4) {
    uniqueTerms.add(normalizedQuestion);
  }

  for (const token of tokenize(question)) {
    uniqueTerms.add(token);
    if (uniqueTerms.size >= 5) {
      break;
    }
  }

  return [...uniqueTerms].map(normalizeSearchToken).filter(Boolean);
}

function loadClassifierModel(modelPath = defaultClassifierPath) {
  if (cachedClassifierModel !== undefined) {
    return cachedClassifierModel;
  }
  if (!existsSync(modelPath)) {
    cachedClassifierModel = null;
    return cachedClassifierModel;
  }
  cachedClassifierModel = JSON.parse(readFileSync(modelPath, "utf8"));
  return cachedClassifierModel;
}

export function loadDotEnv(envPath = path.join(projectRoot, ".env")) {
  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const delimiterIndex = line.indexOf("=");
    if (delimiterIndex === -1) {
      continue;
    }

    const key = line.slice(0, delimiterIndex).trim();
    const value = sanitizeEnvValue(line.slice(delimiterIndex + 1));
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

export function containsSensitivePattern(text) {
  const compact = String(text ?? "").replace(/\s|-/gu, "");
  return /\d{6}[1-4]\d{6}/u.test(compact) || /\d{6,}/u.test(compact);
}

export function detectEscalationReason(question) {
  const text = normalizeText(question);

  if (/(금액|결제일|납부일|청구일|한도|환급금|환급액|지급액|얼마|언제|결제\s*일|이용\s*한도)/u.test(text)) {
    return "amount";
  }
  if (/(보장|특약|면책|해당|가능하|가능한가|가능한지)/u.test(text)) {
    return "coverage";
  }

  if (/(얼마|금액|돌려받|지급액|받을 수 있|수령액)/u.test(text)) {
    return "amount";
  }
  if (/(보장|특약|면책|해당되|가능하|가능한가|가능한지)/u.test(text)) {
    return "coverage";
  }
  return null;
}

function scoreFaq(questionTokens, questionText, faq) {
  const haystack = normalizeText(`${faq.category} ${faq.question} ${faq.answer}`);
  const questionCompact = compactForNgrams(questionText);
  const questionGrams = new Set(charNgrams(questionCompact, [2, 3]));
  let score = 0;

  if (normalizeText(faq.question) === questionText) {
    score += 100;
  }
  if (haystack.includes(questionText) && questionText.length >= 4) {
    score += 25;
  }

  for (const token of questionTokens) {
    if (normalizeText(faq.question).includes(token)) {
      score += 10;
    }
    if (normalizeText(faq.category).includes(token)) {
      score += 6;
    }
    if (normalizeText(faq.answer).includes(token)) {
      score += 4;
    }
  }

  for (const field of [faq.question, faq.answer, faq.category]) {
    const fieldCompact = compactForNgrams(field);
    if (!fieldCompact) {
      continue;
    }

    const fieldGrams = new Set(charNgrams(fieldCompact, [2, 3]));
    let overlap = 0;
    for (const gram of questionGrams) {
      if (fieldGrams.has(gram)) {
        overlap += 1;
      }
    }

    if (overlap > 0) {
      score += Math.min(overlap, 12);
    }
  }

  return score;
}

export function rankFaqs(question, faqs) {
  const questionText = normalizeText(question);
  const questionTokens = tokenize(question);

  return [...faqs]
    .map((faq) => ({
      ...faq,
      score: scoreFaq(questionTokens, questionText, faq),
    }))
    .sort((left, right) => right.score - left.score || left.id - right.id);
}

function ensureGroundingSuffix(answer, sources) {
  const grounding = `${LABEL_GROUNDING} ${sources.map((source) => `FAQ #${source}`).join(", ")}`;
  return answer.includes(LABEL_GROUNDING) ? answer : `${answer} ${grounding}`;
}

function buildFallbackAnswer(rankedFaqs, escalationReason) {
  const topFaq = rankedFaqs[0];
  const sources = rankedFaqs.map((faq) => faq.id);

  if (!topFaq) {
    return { answer: MSG_ESCALATE, sources: [], escalate: true };
  }

  if (escalationReason) {
    return {
      answer: ensureGroundingSuffix(`${topFaq.answer} ${MSG_CONFIRM}`, sources),
      sources,
      escalate: true,
    };
  }

  return {
    answer: ensureGroundingSuffix(topFaq.answer, sources),
    sources,
    escalate: false,
  };
}

function buildRetryAnswer(rankedFaqs) {
  return {
    answer: MSG_RETRY,
    sources: rankedFaqs.map((faq) => faq.id),
    escalate: true,
  };
}

function buildFaqQueryUrl(env, options = {}) {
  const url = new URL("/rest/v1/faqs", env.SUPABASE_URL);
  url.searchParams.set("select", "id,faq_domain,category,question,answer,source");
  url.searchParams.set("order", "id.asc");

  const categories = Array.isArray(options.categories) ? options.categories : [];
  const searchTerms = Array.isArray(options.searchTerms) ? options.searchTerms : [];
  const limit = Number.isFinite(options.limit) ? options.limit : 80;

  if (options.domain) {
    url.searchParams.set("faq_domain", `eq.${options.domain}`);
  }

  if (categories.length > 0) {
    const escaped = categories.map((category) => `"${String(category).replace(/"/gu, '\\"')}"`);
    url.searchParams.set("category", `in.(${escaped.join(",")})`);
  }

  if (searchTerms.length > 0) {
    const filters = searchTerms.flatMap((term) => {
      const escaped = term.replace(/\*/gu, "");
      return [`question.ilike.*${escaped}*`, `answer.ilike.*${escaped}*`];
    });
    url.searchParams.set("or", `(${filters.join(",")})`);
  }

  url.searchParams.set("limit", String(limit));

  return url;
}

function buildExactQuestionQueryUrl(env, question) {
  const url = new URL("/rest/v1/faqs", env.SUPABASE_URL);
  url.searchParams.set("select", "id,faq_domain,category,question,answer,source");
  url.searchParams.set("question", `eq.${question}`);
  url.searchParams.set("limit", "20");
  return url;
}

async function fetchRankedFaqsFromRpc(question, env, fetchImpl, domain) {
  const url = new URL("/rest/v1/rpc/search_faqs", env.SUPABASE_URL);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({
      search_query: normalizeQuestion(question),
      match_count: 6,
      requested_domain: domain,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase rpc faq search failed with ${response.status}`);
  }

  return response.json();
}

async function fetchFaqsFromSupabase(env, fetchImpl, options = {}) {
  const response = await fetchImpl(buildFaqQueryUrl(env, options), {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase fetch failed with ${response.status}`);
  }
  return response.json();
}

async function fetchExactQuestionFaqs(env, fetchImpl, question) {
  const response = await fetchImpl(buildExactQuestionQueryUrl(env, question), {
    headers: {
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Supabase exact question fetch failed with ${response.status}`);
  }
  return response.json();
}

function buildBizRouterMessages(question, rankedFaqs, escalationReason) {
  const faqContext = rankedFaqs
    .map(
      (faq) =>
        `FAQ #${faq.id}\n${LABEL_CATEGORY} ${faq.category}\n${LABEL_QUESTION} ${faq.question}\n${LABEL_ANSWER} ${faq.answer}\n${LABEL_SOURCE} ${faq.source}`,
    )
    .join("\n\n");

  const guardrail =
    escalationReason === "amount" || escalationReason === "coverage"
      ? GUARDRAIL_ESCALATE
      : GUARDRAIL_GENERAL;

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `${LABEL_CUSTOMER_QUESTION} ${question}`,
        guardrail,
        LABEL_FAQ_CONTEXT,
        faqContext,
        "답변 규칙: 쉬운 말 2~4문장으로만 답하고, FAQ에 없는 내용은 추측하지 마세요.",
        "답변 규칙: 금액, 결제일, 한도, 환급금, 보장 여부는 '참고용 안내'라고 밝히고 상담사/담당자 확인을 안내하세요.",
        `\uc751\ub2f5 \ud615\uc2dd: ${RESPONSE_FORMAT}`,
      ].join("\n\n"),
    },
  ];
}

async function requestBizRouterAnswer(question, rankedFaqs, escalationReason, env, fetchImpl) {
  const baseUrl = (env.BIZROUTER_BASE_URL || "https://api.bizrouter.ai/v1").replace(/\/+$/u, "");
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.BIZROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.BIZROUTER_MODEL || defaultBizRouterModel,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: buildBizRouterMessages(question, rankedFaqs, escalationReason),
    }),
  });

  if (!response.ok) {
    throw new Error(`BizRouter request failed with ${response.status}`);
  }

  const payload = await response.json();
  const rawContent = payload?.choices?.[0]?.message?.content;
  if (!rawContent) {
    throw new Error("BizRouter response did not include message content");
  }

  const parsed = JSON.parse(rawContent);
  return {
    answer: parsed.answer,
    sources: Array.isArray(parsed.sources) ? parsed.sources : rankedFaqs.map((faq) => faq.id),
    escalate: Boolean(parsed.escalate),
  };
}

function sanitizeFaqsForClient(faqs) {
  return faqs.map(({ score, ...faq }) => faq);
}

async function fetchCandidateFaqs(question, env, fetchImpl, domain) {
  const classifierModel = loadClassifierModel();
  const predictedCategoryCandidates = classifierModel ? predictCategoryCandidates(classifierModel, question, 5) : [];
  const predictedCategories = predictedCategoryCandidates.map((entry) => entry.label);
  const predictedCategory = predictedCategories[0] ?? null;
  const categoryPredictionAmbiguous = isCategoryPredictionAmbiguous(predictedCategoryCandidates);
  const normalizedDomain = normalizeFaqDomain(domain);
  const searchTerms = buildSearchTerms(question);
  const dedupedFaqs = new Map();
  let categoryFirstCount = 0;
  let usedCategoryFirst = false;
  let fallbackToAllFaqs = false;

  if (predictedCategory && !categoryPredictionAmbiguous) {
    usedCategoryFirst = true;
    const categoryFaqs = await fetchFaqsFromSupabase(env, fetchImpl, {
      categories: [predictedCategory],
      searchTerms,
      domain: normalizedDomain,
      limit: 80,
    });
    categoryFirstCount = categoryFaqs.length;
    for (const faq of categoryFaqs) {
      dedupedFaqs.set(faq.id, faq);
    }
  }

  if (categoryPredictionAmbiguous || categoryFirstCount < 5) {
    fallbackToAllFaqs = true;
    const fallbackFaqs = await fetchFaqsFromSupabase(env, fetchImpl, {
      searchTerms,
      domain: normalizedDomain,
      limit: 120,
    });
    for (const faq of fallbackFaqs) {
      dedupedFaqs.set(faq.id, faq);
    }
  }

  if (dedupedFaqs.size === 0) {
    const exactMatches = await fetchExactQuestionFaqs(env, fetchImpl, normalizeQuestion(question));
    for (const faq of exactMatches) {
      dedupedFaqs.set(faq.id, faq);
    }
  }

  const collectedFaqs = [...dedupedFaqs.values()];
  if (collectedFaqs.length > 0) {
    const rankedFaqs = rankFaqs(question, collectedFaqs);
    const effectivePredictedCategory =
      predictedCategory && categoryFirstCount > 0 ? predictedCategory : rankedFaqs[0]?.category ?? predictedCategory;
    return {
      faqs: rankedFaqs,
      predictedCategories,
      predictedCategoryCandidates,
      predictedCategory: effectivePredictedCategory,
      categoryPredictionAmbiguous,
      requestedDomain: normalizedDomain,
      resolvedDomain: normalizedDomain ?? rankedFaqs[0].faq_domain ?? null,
      usedCategoryFirst,
      fallbackToAllFaqs,
      categoryFirstCount,
    };
  }

  return {
    faqs: [],
    predictedCategories,
    predictedCategoryCandidates,
    predictedCategory,
    categoryPredictionAmbiguous,
    requestedDomain: normalizedDomain,
    resolvedDomain: normalizedDomain,
    usedCategoryFirst,
    fallbackToAllFaqs,
    categoryFirstCount,
  };
}

export async function buildAnswerPayload(question, options = {}) {
  loadDotEnv();

  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;

  if (!question || !String(question).trim()) {
    return { status: 400, body: { error: MSG_EMPTY_QUESTION } };
  }
  if (containsSensitivePattern(question)) {
    return { status: 400, body: { error: MSG_SENSITIVE } };
  }
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return { status: 500, body: { error: MSG_SUPABASE_MISSING } };
  }

  const escalationReason = detectEscalationReason(question);
  const {
    faqs,
    predictedCategories,
    predictedCategoryCandidates,
    predictedCategory,
    categoryPredictionAmbiguous,
    requestedDomain,
    resolvedDomain,
    usedCategoryFirst,
    fallbackToAllFaqs,
    categoryFirstCount,
  } = await fetchCandidateFaqs(question, env, fetchImpl, options.domain);
  const matchedFaqs = faqs.filter((faq) => (faq.score ?? 0) > 0);
  const referenceFaqs = matchedFaqs.slice(0, 5);
  const rankedFaqs = referenceFaqs.slice(0, 3);

  if (referenceFaqs.length === 0 || referenceFaqs[0].score < 6) {
    return {
      status: 200,
      body: {
        answer: MSG_ESCALATE,
        sources: [],
        faqs: [],
        escalate: true,
        predictedCategories,
        predictedCategoryCandidates,
        predictedCategory,
        categoryPredictionAmbiguous,
        requestedDomain,
        resolvedDomain,
        usedCategoryFirst,
        fallbackToAllFaqs,
        categoryFirstCount,
      },
    };
  }

  let answerPayload = buildFallbackAnswer(rankedFaqs, escalationReason);

  if (env.BIZROUTER_API_KEY) {
    try {
      answerPayload = await requestBizRouterAnswer(
        question,
        rankedFaqs,
        escalationReason,
        env,
        fetchImpl,
      );
      answerPayload.answer = ensureGroundingSuffix(answerPayload.answer, answerPayload.sources);
      if (escalationReason) {
        answerPayload.escalate = true;
      }
    } catch {
      answerPayload = buildRetryAnswer(rankedFaqs);
    }
  }

  return {
    status: 200,
    body: {
      ...answerPayload,
      faqs: sanitizeFaqsForClient(referenceFaqs),
      predictedCategories,
      predictedCategoryCandidates,
      predictedCategory,
      categoryPredictionAmbiguous,
      requestedDomain,
      resolvedDomain: resolvedDomain ?? referenceFaqs[0]?.faq_domain ?? null,
      usedCategoryFirst,
      fallbackToAllFaqs,
      categoryFirstCount,
    },
  };
}
