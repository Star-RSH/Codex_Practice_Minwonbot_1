import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildAnswerPayload, loadDotEnv } from "./lib/answer-service.mjs";
import { buildFaqSearchPayload } from "./lib/faq-search-service.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const port = Number(process.env.PORT || 4173);
const MSG_SERVER_ERROR = "잠시 후 다시 시도해주세요.";

loadDotEnv();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function safeRelativePath(reqPath) {
  const normalized = path.posix.normalize(reqPath === "/" ? "/index.html" : reqPath);
  if (normalized.includes("..")) {
    return null;
  }
  return normalized.replace(/^\/+/u, "");
}

function serveFile(reqPath, res) {
  const relativePath = safeRelativePath(reqPath);
  if (!relativePath) {
    sendJson(res, 400, { error: "Bad request" });
    return;
  }

  const fullPath = path.join(rootDir, relativePath);
  if (!fullPath.startsWith(rootDir) || !existsSync(fullPath) || statSync(fullPath).isDirectory()) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const ext = path.extname(fullPath);
  const contentType = mimeTypes[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(fullPath).pipe(res);
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return req.body ? JSON.parse(req.body) : {};
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

const server = createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { error: "Bad request" });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "POST" && url.pathname === "/api/answer") {
    try {
      const parsedBody = await readJsonBody(req);
      const payload = await buildAnswerPayload(parsedBody.question ?? "", {
        domain: parsedBody.domain,
      });
      sendJson(res, payload.status, payload.body);
    } catch (error) {
      console.error("POST /api/answer failed", error?.stack || error);
      sendJson(res, 500, { error: MSG_SERVER_ERROR });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/search-faqs") {
    try {
      const parsedBody = await readJsonBody(req);
      const payload = await buildFaqSearchPayload(parsedBody.query ?? "", {
        limit: parsedBody.limit,
        domain: parsedBody.domain,
      });
      sendJson(res, payload.status, payload.body);
    } catch (error) {
      console.error("POST /api/search-faqs failed", error?.stack || error);
      sendJson(res, 500, { error: MSG_SERVER_ERROR });
    }
    return;
  }

  if (req.method === "GET") {
    serveFile(url.pathname, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed" });
});

server.listen(port, () => {
  console.log(`Local server running at http://127.0.0.1:${port}`);
});
