#!/usr/bin/env node

/**
 * APEX Lite CLI
 * Minimal deterministic evaluator for the repository's reference policy format.
 */

const fs = require("fs");
const path = require("path");

function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseScalar(value) {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^-?\d+$/.test(value)) {
    return Number(value);
  }
  const quoted = value.match(/^"(.*)"$/);
  if (quoted) {
    return quoted[1];
  }
  return value;
}

function readPolicy(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const rules = [];
  let currentRule = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#") || line.trim() === "rules:") {
      continue;
    }

    const ruleMatch = line.match(/^\s*-\s+id:\s+(.+)$/);
    if (ruleMatch) {
      currentRule = { id: parseScalar(ruleMatch[1].trim()) };
      rules.push(currentRule);
      continue;
    }

    const fieldMatch = line.match(/^\s+([A-Za-z_]+):\s+(.+)$/);
    if (fieldMatch && currentRule) {
      currentRule[fieldMatch[1]] = parseScalar(fieldMatch[2].trim());
    }
  }

  return { rules };
}

function evaluateCondition(expression, intent) {
  const normalized = expression
    .replace(/\band\b/g, "&&")
    .replace(/\bor\b/g, "||")
    .replace(/"([^"]+)"\s+in\s+([A-Za-z_][A-Za-z0-9_]*)/g, 'includes($2, "$1")');

  const evaluator = new Function(
    "intent",
    "includes",
    `with (intent) { return (${normalized}); }`
  );

  return Boolean(
    evaluator(intent, (value, item) => Array.isArray(value) && value.includes(item))
  );
}

function evaluateRules(intent, policy) {
  for (const rule of policy.rules) {
    if (!rule.if || !evaluateCondition(rule.if, intent)) {
      continue;
    }

    if (rule.deny === true) {
      return {
        decision: "REQUIRE_APPROVAL",
        reason: rule.description || "Policy requires approval",
        policy_id: rule.id
      };
    }

    if (rule.require) {
      return {
        decision: "REQUIRE_APPROVAL",
        reason: rule.description || `Policy requires ${rule.require}`,
        policy_id: rule.id
      };
    }
  }

  return {
    decision: "ALLOW",
    reason: "No approval rules matched",
    policy_id: null
  };
}

function evaluate(intentPath, policyPath) {
  const intent = readJSON(intentPath);
  const policy = readPolicy(policyPath);
  const outcome = evaluateRules(intent, policy);

  const result = {
    ...outcome,
    apex_version: "lite-0.1",
    timestamp: Math.floor(Date.now() / 1000)
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

module.exports = {
  evaluate,
  evaluateRules,
  readPolicy,
  readJSON
};

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] !== "evaluate" || args.length !== 3) {
    console.error("Usage:");
    console.error("  apex-lite evaluate <intent.json> <policy.yaml>");
    process.exit(1);
  }

  evaluate(path.resolve(args[1]), path.resolve(args[2]));
}
