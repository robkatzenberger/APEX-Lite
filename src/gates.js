const fs = require("node:fs");

function readGatesConfig(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function evaluateGates(intent, gatesConfig) {
  validateIntentSchema(intent, gatesConfig.intent_schema);

  const haystack = buildHaystack(intent);
  for (const gate of gatesConfig.gates || []) {
    if (!matchesAnyKeyword(haystack, gate.match_keywords)) {
      continue;
    }

    if (matchesAnyKeyword(haystack, gate.escalate_keywords)) {
      return {
        decision: "REQUIRE_APPROVAL",
        reason: `${gate.label} gate matched escalation keywords`,
        policy_id: gate.id
      };
    }

    if (matchesAnyKeyword(haystack, gate.allow_keywords)) {
      return {
        decision: "ALLOW",
        reason: `${gate.label} gate matched allow keywords`,
        policy_id: gate.id
      };
    }
  }

  return null;
}

function validateIntentSchema(intent, intentSchema = {}) {
  for (const field of intentSchema.required_fields || []) {
    if (!intent[field] && intent[field] !== 0) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
}

function buildHaystack(intent) {
  return [
    intent.actor,
    intent.action,
    intent.target,
    intent.risk,
    intent.declared_intent,
    intent.intent_id,
    ...(Array.isArray(intent.data_classes) ? intent.data_classes : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function matchesAnyKeyword(haystack, keywords = []) {
  return keywords.some((keyword) => haystack.includes(String(keyword).toLowerCase()));
}

module.exports = {
  evaluateGates,
  readGatesConfig
};
