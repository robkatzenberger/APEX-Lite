import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { evaluateFiles } = require(path.join(repoRoot, "src"));
const { createApp } = require(path.join(repoRoot, "src", "server.js"));

const policyPath = path.join(repoRoot, "examples", "policy.yaml");
const dashboardPath = path.join(repoRoot, "public", "index.html");
const appPath = path.join(repoRoot, "public", "app.js");
const fixedTime = "2026-01-01T00:00:00.000Z";

const cases = [
  {
    name: "high-risk action triggers approval",
    intent: path.join(repoRoot, "examples", "intent-high-risk.json"),
    expectedDecision: "REQUIRE_APPROVAL",
    expectedPolicyId: "rule_01"
  },
  {
    name: "PII action triggers approval",
    intent: path.join(repoRoot, "examples", "intent.json"),
    expectedDecision: "REQUIRE_APPROVAL",
    expectedPolicyId: "rule_02"
  },
  {
    name: "safe action is allowed",
    intent: path.join(repoRoot, "examples", "intent-safe.json"),
    expectedDecision: "ALLOW",
    expectedPolicyId: null
  }
];

for (const testCase of cases) {
  const { decision, receipt } = evaluateFiles(testCase.intent, policyPath, {
    evaluatedAt: fixedTime
  });

  assert.equal(decision.decision, testCase.expectedDecision, testCase.name);
  assert.equal(decision.policy_id, testCase.expectedPolicyId, testCase.name);
  assert.equal(receipt.decision, testCase.expectedDecision, testCase.name);
  assert.equal(receipt.evaluated_at, fixedTime, `${testCase.name} receipt timestamp`);

  console.log(`passed: ${testCase.name}`);
}

const { receipt } = evaluateFiles(path.join(repoRoot, "examples", "intent-safe.json"), policyPath, {
  evaluatedAt: fixedTime
});

assert.match(receipt.receipt_hash, /^[a-f0-9]{64}$/);
assert.match(receipt.execution_ref, /^exec_[a-f0-9]{16}$/);
assert.match(receipt.policy_hash, /^[a-f0-9]{64}$/);
assert.match(receipt.intent_hash, /^[a-f0-9]{64}$/);
assert.equal(receipt.control_mode, "ALLOW_OR_ESCALATE");
assert.equal(receipt.blocking, false);
console.log("passed: receipt includes stable hashes and no-block control mode");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "apex-lite-"));
const logPath = path.join(tempDir, "audit.jsonl");

evaluateFiles(path.join(repoRoot, "examples", "intent-safe.json"), policyPath, {
  evaluatedAt: fixedTime,
  logPath
});

const lines = fs.readFileSync(logPath, "utf8").trim().split("\n");
assert.equal(lines.length, 1);

const loggedReceipt = JSON.parse(lines[0]);
assert.equal(loggedReceipt.receipt_type, "apex-lite.receipt");
assert.equal(loggedReceipt.decision, "ALLOW");
console.log("passed: audit log appends one JSON line per evaluation");

const auditPath = path.join(tempDir, "server-audit.jsonl");
const server = createApp({ policyPath, auditPath, dashboardPath, appPath });
await new Promise((resolve) => server.listen(0, resolve));
const port = server.address().port;

try {
  const evaluateResponse = await requestJSON(port, "/api/evaluate", {
    method: "POST",
    body: {
      intent: {
        intent_id: "INT-API-001",
        actor: "agent_42",
        action: "send_email",
        target: "external_user",
        risk: "medium",
        data_classes: ["PII"],
        timestamp: 1730000000
      }
    }
  });

  assert.equal(evaluateResponse.statusCode, 200);
  assert.equal(evaluateResponse.body.decision, "REQUIRE_APPROVAL");
  assert.equal(evaluateResponse.body.policy_id, "rule_02");
  assert.equal(evaluateResponse.body.reward_signal, "TRANSPARENCY_REWARDED");
  assert.equal(evaluateResponse.body.blocking, false);
  assert.match(evaluateResponse.body.receipt_hash, /^[a-f0-9]{64}$/);
  assert.match(evaluateResponse.body.execution_ref, /^exec_[a-f0-9]{16}$/);
  console.log("passed: api evaluate returns a real receipt with rewarded escalation");

  const auditResponse = await requestJSON(port, "/api/audit");
  assert.equal(auditResponse.statusCode, 200);
  assert.equal(auditResponse.body.entries.length, 1);
  assert.equal(auditResponse.body.entries[0].original_intent.intent_id, "INT-API-001");
  console.log("passed: api audit returns appended receipts");

  const operatorResponse = await requestJSON(port, "/api/operator-action", {
    method: "POST",
    body: {
      action: "approve",
      receipt: evaluateResponse.body,
      operator: "ops_local"
    }
  });

  assert.equal(operatorResponse.statusCode, 200);
  assert.equal(operatorResponse.body.action, "APPROVE");
  assert.equal(operatorResponse.body.intent_id, "INT-API-001");
  assert.equal(operatorResponse.body.operator, "ops_local");
  assert.equal(operatorResponse.body.execution_ref, evaluateResponse.body.execution_ref);
  assert.equal(operatorResponse.body.receipt_hash, evaluateResponse.body.receipt_hash);
  assert.equal(operatorResponse.body.outcome, "ALLOW");
  console.log("passed: operator actions are recorded as audit events");

  const auditAfterAction = await requestJSON(port, "/api/audit");
  assert.equal(auditAfterAction.statusCode, 200);
  assert.equal(auditAfterAction.body.entries.length, 2);
  assert.equal(auditAfterAction.body.entries[0].receipt_type, "apex-lite.operator_action");
  assert.equal(auditAfterAction.body.entries[0].operator, "ops_local");
  assert.equal(auditAfterAction.body.entries[0].outcome, "ALLOW");
  console.log("passed: audit api returns operator action events");

  const forgedOperatorResponse = await requestJSON(port, "/api/operator-action", {
    method: "POST",
    body: {
      action: "approve",
      receipt: {
        ...evaluateResponse.body,
        receipt_hash: "f".repeat(64)
      }
    }
  });

  assert.equal(forgedOperatorResponse.statusCode, 400);
  assert.match(forgedOperatorResponse.body.error, /recorded evaluation receipt/i);
  console.log("passed: forged operator actions are rejected");

  const allowEvaluateResponse = await requestJSON(port, "/api/evaluate", {
    method: "POST",
    body: {
      intent: {
        intent_id: "INT-API-ALLOW",
        actor: "agent_12",
        action: "summarize_report",
        target: "internal_workspace",
        risk: "low",
        data_classes: [],
        timestamp: 1730000300
      }
    }
  });

  assert.equal(allowEvaluateResponse.statusCode, 200);
  assert.equal(allowEvaluateResponse.body.decision, "ALLOW");

  const invalidAllowAction = await requestJSON(port, "/api/operator-action", {
    method: "POST",
    body: {
      action: "approve",
      receipt: allowEvaluateResponse.body
    }
  });

  assert.equal(invalidAllowAction.statusCode, 400);
  assert.match(invalidAllowAction.body.error, /only valid for escalated evaluations/i);
  console.log("passed: non-escalated receipts cannot be resolved as operator actions");

  const invalidOperatorName = await requestJSON(port, "/api/operator-action", {
    method: "POST",
    body: {
      action: "approve",
      receipt: evaluateResponse.body,
      operator: "bad operator!"
    }
  });

  assert.equal(invalidOperatorName.statusCode, 400);
  assert.match(invalidOperatorName.body.error, /Operator must use 1-64 characters/i);
  console.log("passed: invalid operator identifiers are rejected");

  const dashboardResponse = await requestText(port, "/");
  assert.equal(dashboardResponse.statusCode, 200);
  assert.match(dashboardResponse.body, /intent input/i);
  assert.match(dashboardResponse.body, /Policy Gate Notice/i);
  assert.doesNotMatch(dashboardResponse.body, /Math\.random/);
  console.log("passed: dashboard is served without simulation logic");

  const appResponse = await requestText(port, "/app.js");
  assert.equal(appResponse.statusCode, 200);
  assert.match(appResponse.body, /fetch\(\"\/api\/evaluate\"/);
  assert.match(appResponse.body, /transparency rewarded/);
  assert.doesNotMatch(appResponse.body, /DENY/);
  console.log("passed: dashboard app is served");
} finally {
  server.close();
}

console.log("All APEX Lite tests passed.");

function requestJSON(port, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: requestPath,
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json"
        }
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body: body ? JSON.parse(body) : null
          });
        });
      }
    );

    request.on("error", reject);

    if (options.body) {
      request.write(JSON.stringify(options.body));
    }

    request.end();
  });
}

function requestText(port, requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: requestPath,
        method: "GET"
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode,
            body
          });
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}
