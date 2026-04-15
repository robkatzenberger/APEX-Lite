const fs = require("node:fs");
const path = require("node:path");
const { appendAuditLog } = require("./audit");
const { evaluateRules } = require("./engine");
const { readPolicy } = require("./policy");
const { buildReceipt } = require("./receipt");

const { version } = require(path.join(__dirname, "..", "package.json"));

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function evaluateFiles(intentPath, policyPath, options = {}) {
  const intent = readJSON(intentPath);
  const policy = readPolicy(policyPath);
  return evaluateIntent(intent, policy, options);
}

function evaluateIntent(intent, policy, options = {}) {
  const decision = evaluateRules(intent, policy);
  const receipt = buildReceipt({
    intent,
    policy,
    decision,
    evaluatedAt: options.evaluatedAt || new Date().toISOString(),
    apexVersion: version
  });

  if (options.logPath) {
    appendAuditLog(options.logPath, receipt);
  }

  return { decision, receipt };
}

module.exports = {
  evaluateFiles,
  evaluateIntent,
  readJSON,
  readPolicy
};
