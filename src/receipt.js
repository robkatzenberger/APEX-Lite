const { sha256Hex, stableStringify } = require("./hash");

function buildReceipt({ intent, policy, decision, evaluatedAt, apexVersion }) {
  const policyHash = sha256Hex(stableStringify(policy));
  const intentHash = sha256Hex(stableStringify(intent));
  const executionRef = `exec_${sha256Hex(stableStringify({
    evaluated_at: evaluatedAt,
    intent_hash: intentHash,
    policy_hash: policyHash
  })).slice(0, 16)}`;

  const receipt = {
    receipt_type: "apex-lite.receipt",
    apex_version: apexVersion,
    evaluated_at: evaluatedAt,
    control_mode: "ALLOW_OR_ESCALATE",
    blocking: false,
    decision: decision.decision,
    reason: decision.reason,
    policy_id: decision.policy_id,
    execution_ref: executionRef,
    policy_hash: policyHash,
    intent_hash: intentHash,
    reward_signal: decision.decision === "ALLOW" ? null : "TRANSPARENCY_REWARDED",
    original_intent: intent
  };

  receipt.receipt_hash = sha256Hex(stableStringify(receipt));
  return receipt;
}

module.exports = {
  buildReceipt
};
