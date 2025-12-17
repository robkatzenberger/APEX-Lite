#!/usr/bin/env node

/**
 * APEX Lite CLI (Stub)
 * This is a minimal reference interface.
 * It demonstrates how APEX Lite is invoked,
 * not a full policy engine.
 */

const fs = require("fs");
const path = require("path");

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readYAML(file) {
  // Stub behavior: YAML is not fully parsed yet
  // This is intentional and documented
  return fs.readFileSync(file, "utf8");
}

function evaluate(intentPath, policyPath) {
  const intent = readJSON(intentPath);
  readYAML(policyPath);

  // Minimal deterministic stub logic
  let decision = "ALLOW";
  let reason = "No blocking rules matched";
  let policy_id = null;

  if (
    intent.action === "send_email" &&
    Array.isArray(intent.data_classes) &&
    intent.data_classes.includes("PII")
  ) {
    decision = "REQUIRE_APPROVAL";
    reason = "Sending PII externally requires human approval";
    policy_id = "rule_02";
  }

  const result = {
    decision,
    reason,
    policy_id,
    apex_version: "lite-0.1",
    timestamp: Math.floor(Date.now() / 1000)
  };

  console.log(JSON.stringify(result, null, 2));
}

const args = process.argv.slice(2);

if (args[0] !== "evaluate" || args.length !== 3) {
  console.error("Usage:");
  console.error("  apex-lite evaluate <intent.json> <policy.yaml>");
  process.exit(1);
}

evaluate(
  path.resolve(args[1]),
  path.resolve(args[2])
); 

