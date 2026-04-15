const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { readAuditLog } = require("./audit");
const { evaluateIntent, readPolicy } = require("./index");
const { recordOperatorAction } = require("./operator-action");

const DEFAULT_POLICY_PATH = path.join(__dirname, "..", "examples", "policy.yaml");
const DEFAULT_AUDIT_PATH = path.join(__dirname, "..", "var", "audit.jsonl");
const DEFAULT_DASHBOARD_PATH = path.join(__dirname, "..", "public", "index.html");
const DEFAULT_APP_PATH = path.join(__dirname, "..", "public", "app.js");

function createApp(options = {}) {
  const policyPath = options.policyPath || DEFAULT_POLICY_PATH;
  const auditPath = options.auditPath || DEFAULT_AUDIT_PATH;
  const dashboardPath = options.dashboardPath || DEFAULT_DASHBOARD_PATH;
  const appPath = options.appPath || DEFAULT_APP_PATH;

  return http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/") {
        return sendFile(response, dashboardPath);
      }

      if (request.method === "GET" && request.url === "/app.js") {
        return sendFile(response, appPath, "application/javascript; charset=utf-8");
      }

      if (request.method === "GET" && request.url === "/api/audit") {
        return sendJSON(response, 200, { entries: readAuditEntries(auditPath, 20) });
      }

      if (request.method === "POST" && request.url === "/api/evaluate") {
        const payload = await readRequestJSON(request);
        const receipt = evaluateRequest(payload, policyPath, auditPath);
        return sendJSON(response, 200, receipt);
      }

      if (request.method === "POST" && request.url === "/api/operator-action") {
        const payload = await readRequestJSON(request);
        const entry = recordOperatorAction(payload, auditPath);
        return sendJSON(response, 200, entry);
      }

      sendJSON(response, 404, { error: "Not found" });
    } catch (error) {
      sendJSON(response, 400, { error: error.message });
    }
  });
}

function evaluateRequest(payload, policyPath, auditPath) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Request body must be a JSON object.");
  }

  const intent = normalizeIntent(payload.intent || payload);
  const policy = readPolicy(policyPath);
  const { receipt } = evaluateIntent(intent, policy, { logPath: auditPath });
  return receipt;
}

function normalizeIntent(intent) {
  const normalized = { ...intent };

  if (typeof normalized.data_classes === "string") {
    normalized.data_classes = normalized.data_classes
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (!Array.isArray(normalized.data_classes)) {
    normalized.data_classes = [];
  }

  if (normalized.timestamp === undefined || normalized.timestamp === null || normalized.timestamp === "") {
    normalized.timestamp = Math.floor(Date.now() / 1000);
  } else if (/^-?\d+$/.test(String(normalized.timestamp))) {
    normalized.timestamp = Number(normalized.timestamp);
  }

  for (const field of ["intent_id", "actor", "action", "target", "risk"]) {
    if (!normalized[field] && normalized[field] !== 0) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  return normalized;
}

function readAuditEntries(filePath, limit) {
  return readAuditLog(filePath).slice(-limit).reverse();
}

function readRequestJSON(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body.trim()) {
        reject(new Error("Request body is required."));
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

function sendFile(response, filePath, contentType = "text/html; charset=utf-8") {
  response.writeHead(200, { "Content-Type": contentType });
  response.end(fs.readFileSync(filePath, "utf8"));
}

function sendJSON(response, statusCode, value) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value, null, 2));
}

module.exports = {
  DEFAULT_AUDIT_PATH,
  DEFAULT_APP_PATH,
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_POLICY_PATH,
  createApp,
  evaluateRequest,
  normalizeIntent,
  readAuditEntries
};
